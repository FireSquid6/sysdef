import { describe, test, expect, spyOn } from "bun:test";
import {
  type Module,
  type ServiceProvider,
  getServiceMap,
  syncServices,
  updateServiceTracking,
} from "../sysdef-src/sysdef";
import { Trackfile } from "../sysdef-src/trackfile";

// minimal module factory -- only the fields getServiceMap reads matter
function moduleWithServices(name: string, services: Record<string, string[]>): Module {
  return { name, variables: {}, packages: {}, directories: {}, files: {}, services };
}

describe("getServiceMap", () => {
  test("flattens services across modules", () => {
    const modules = [
      moduleWithServices("a", { systemd: ["sshd", "docker"] }),
      moduleWithServices("b", { systemd: ["cronie"] }),
    ];
    const map = getServiceMap(modules);
    expect(map.get("systemd")!.sort()).toEqual(["cronie", "docker", "sshd"]);
  });

  test("dedupes a service requested by more than one module", () => {
    const modules = [
      moduleWithServices("a", { systemd: ["sshd"] }),
      moduleWithServices("b", { systemd: ["sshd", "docker"] }),
    ];
    const map = getServiceMap(modules);
    expect(map.get("systemd")!.sort()).toEqual(["docker", "sshd"]);
  });

  test("is empty when no module declares services (services field omitted)", () => {
    const bare: Module = { name: "x", variables: {}, packages: {}, directories: {}, files: {} };
    expect(getServiceMap([bare]).size).toBe(0);
  });
});

describe("syncServices", () => {
  // records what the service provider was asked to enable/disable
  function recordingProvider(enabled: string[]) {
    const toEnable: string[] = [];
    const toDisable: string[] = [];
    const provider: ServiceProvider = {
      name: "systemd",
      enable: async (services) => { toEnable.push(...services); },
      disable: async (services) => { toDisable.push(...services); },
      getEnabled: async () => enabled,
    };
    return { provider, toEnable, toDisable };
  }

  const managed = (...names: string[]) => new Map([["systemd", new Set(names)]]);
  const noManaged = new Map<string, Set<string>>();
  const noUntracked = new Map<string, Set<string>>();
  const untracked = (...names: string[]) => new Map([["systemd", new Set(names)]]);
  const noop = async () => {};

  test("enables services that are not yet enabled", async () => {
    const { provider, toEnable, toDisable } = recordingProvider([]);
    const requested = new Map([["systemd", ["sshd"]]]);

    await syncServices(requested, [provider], false, noManaged, noUntracked, noop);

    expect(toEnable).toEqual(["sshd"]);
    expect(toDisable).toEqual([]);
  });

  test("does not re-enable an already-enabled service", async () => {
    const { provider, toEnable } = recordingProvider(["sshd"]);
    const requested = new Map([["systemd", ["sshd"]]]);

    await syncServices(requested, [provider], false, managed("sshd"), noUntracked, noop);

    expect(toEnable).toEqual([]);
  });

  test("disables a managed service that is no longer requested", async () => {
    const { provider, toEnable, toDisable } = recordingProvider(["sshd"]);
    const requested = new Map([["systemd", []]]);

    // sshd was previously enabled BY sysdef (managed)
    await syncServices(requested, [provider], false, managed("sshd"), noUntracked, noop);

    expect(toEnable).toEqual([]);
    expect(toDisable).toEqual(["sshd"]);
  });

  test("NEVER disables a service sysdef did not enable (safety)", async () => {
    const { provider, toDisable } = recordingProvider(["sshd"]);
    const requested = new Map([["systemd", []]]);

    // sshd is enabled but NOT in the managed set -> must be left alone
    await syncServices(requested, [provider], false, noManaged, noUntracked, noop);

    expect(toDisable).toEqual([]);
  });

  test("noDisable (--safe) skips disabling even managed services", async () => {
    const { provider, toDisable } = recordingProvider(["sshd"]);
    const requested = new Map([["systemd", []]]);

    await syncServices(requested, [provider], true, managed("sshd"), noUntracked, noop);

    expect(toDisable).toEqual([]);
  });

  test("warns and lists untracked (enabled-but-unmanaged) services", async () => {
    const { provider } = recordingProvider(["sshd", "getty@tty1", "cronie"]);
    const requested = new Map([["systemd", ["sshd"]]]);

    const log = spyOn(console, "log").mockImplementation(() => {});
    let out = "";
    try {
      await syncServices(requested, [provider], false, managed("sshd"), noUntracked, noop);
      out = log.mock.calls.map(c => c.join(" ")).join("\n");
    } finally {
      log.mockRestore();
    }

    expect(out).toContain("2 untracked");
    expect(out).toContain("getty@tty1, cronie");
    // a managed service must not be reported as untracked
    expect(out).not.toContain("sshd,");
  });

  test("suppresses explicitly-untracked services from the warning", async () => {
    const { provider } = recordingProvider(["getty@tty1", "cronie"]);
    const requested = new Map([["systemd", []]]);

    const log = spyOn(console, "log").mockImplementation(() => {});
    let out = "";
    try {
      await syncServices(requested, [provider], false, noManaged, untracked("getty@tty1"), noop);
      out = log.mock.calls.map(c => c.join(" ")).join("\n");
    } finally {
      log.mockRestore();
    }

    expect(out).toContain("1 untracked");
    expect(out).toContain("cronie");
    expect(out).not.toContain("getty@tty1,");
  });

  test("includes a hint pointing at the track command", async () => {
    const { provider } = recordingProvider(["cronie"]);
    const requested = new Map([["systemd", []]]);

    const log = spyOn(console, "log").mockImplementation(() => {});
    let out = "";
    try {
      await syncServices(requested, [provider], false, noManaged, noUntracked, noop);
      out = log.mock.calls.map(c => c.join(" ")).join("\n");
    } finally {
      log.mockRestore();
    }

    expect(out).toContain("sysdef track ignore-all systemd");
    expect(out).toContain("sysdef track ignore systemd");
  });

  test("is a no-op (no confirm, no enable/disable) when nothing changes", async () => {
    const { provider, toEnable, toDisable } = recordingProvider(["sshd"]);
    const requested = new Map([["systemd", ["sshd"]]]);

    let confirmed = false;
    const confirm = async () => { confirmed = true; };
    await syncServices(requested, [provider], false, managed("sshd"), noUntracked, confirm);

    expect(confirmed).toBe(false);
    expect(toEnable).toEqual([]);
    expect(toDisable).toEqual([]);
  });
});

describe("updateServiceTracking", () => {
  function providerNamed(name: string): ServiceProvider {
    return {
      name,
      enable: async () => {},
      disable: async () => {},
      getEnabled: async () => [],
    };
  }

  test("sets the managed set to exactly the requested services", async () => {
    const trackfile = new Trackfile();
    const requested = new Map([["systemd", ["sshd", "docker"]]]);

    await updateServiceTracking(requested, [providerNamed("systemd")], trackfile);

    expect(trackfile.getEnabledServices("systemd").sort()).toEqual(["docker", "sshd"]);
  });

  test("drops previously-managed services that are no longer requested", async () => {
    const trackfile = new Trackfile();
    trackfile.setEnabledServices("systemd", ["sshd", "docker"]);
    const requested = new Map([["systemd", ["sshd"]]]);

    await updateServiceTracking(requested, [providerNamed("systemd")], trackfile);

    expect(trackfile.getEnabledServices("systemd")).toEqual(["sshd"]);
  });

  test("clears the managed set when nothing is requested", async () => {
    const trackfile = new Trackfile();
    trackfile.setEnabledServices("systemd", ["sshd"]);
    const requested = new Map<string, string[]>();

    await updateServiceTracking(requested, [providerNamed("systemd")], trackfile);

    expect(trackfile.getEnabledServices("systemd")).toEqual([]);
    expect(trackfile.getServiceProviders()).toEqual([]);
  });
});

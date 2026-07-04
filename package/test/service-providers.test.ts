import { describe, test, expect } from "bun:test";
import type { Shell, ShellOptions, ShellResult } from "../sysdef-src/sysdef";

import systemdGen, { parseEnabledServices } from "../serviceProviders/systemd";

// Same recording mock Shell used for the package providers. Service providers
// receive it via their generator, so every command they build with the injected
// `run` is captured here.
function mockShell(responses: Record<string, Partial<ShellResult>> = {}) {
  const calls: Array<{ cmd: string; options: ShellOptions }> = [];
  const shell: Shell = async (s, options) => {
    const cmd = Array.isArray(s) ? s.join(" ") : s;
    calls.push({ cmd, options: options ?? {} });
    const r = responses[cmd];
    return { code: r?.code ?? 0, stdout: r?.stdout ?? "" };
  };
  return { shell, calls, cmds: () => calls.map((c) => c.cmd) };
}

describe("systemd service provider", () => {
  test("enable builds `systemctl enable --now` as root", async () => {
    const { shell, calls, cmds } = mockShell();
    const p = systemdGen(shell);
    await p.enable(["sshd", "docker"]);
    expect(cmds()).toEqual(["systemctl enable --now sshd docker"]);
    expect(calls[0]!.options.asRoot).toBe(true);
  });

  test("enable with no services shells out nothing", async () => {
    const { shell, cmds } = mockShell();
    const p = systemdGen(shell);
    await p.enable([]);
    expect(cmds()).toEqual([]);
  });

  test("disable builds `systemctl disable --now` as root", async () => {
    const { shell, calls, cmds } = mockShell();
    const p = systemdGen(shell);
    await p.disable(["sshd"]);
    expect(cmds()).toEqual(["systemctl disable --now sshd"]);
    expect(calls[0]!.options.asRoot).toBe(true);
  });

  test("disable with no services shells out nothing", async () => {
    const { shell, cmds } = mockShell();
    const p = systemdGen(shell);
    await p.disable([]);
    expect(cmds()).toEqual([]);
  });

  test("checkInstallation probes with `which systemctl`", async () => {
    const { shell, cmds } = mockShell();
    const p = systemdGen(shell);
    await p.checkInstallation!();
    expect(cmds()).toEqual(["which systemctl"]);
  });

  // getEnabled uses realShell (so it works under --dry-run); its parsing is
  // covered directly through parseEnabledServices below and end-to-end in
  // systemd.e2e.ts.
});

describe("parseEnabledServices", () => {
  test("parses unit-file listing and strips the .service suffix", () => {
    const out = [
      "sshd.service      enabled enabled",
      "docker.service    enabled enabled",
    ].join("\n");
    expect(parseEnabledServices(out)).toEqual(["sshd", "docker"]);
  });

  test("returns an empty list for empty output", () => {
    expect(parseEnabledServices("")).toEqual([]);
    expect(parseEnabledServices("\n\n")).toEqual([]);
  });

  test("ignores blank lines and tolerates leading/trailing whitespace", () => {
    const out = "\n  sshd.service   enabled enabled  \n\n  cronie.service enabled enabled\n";
    expect(parseEnabledServices(out)).toEqual(["sshd", "cronie"]);
  });

  test("keeps template/instance unit names (only a trailing .service is stripped)", () => {
    const out = "getty@.service enabled enabled\nfoo.timer      enabled enabled";
    // "getty@" keeps its @, ".timer" is not a .service suffix so it's left alone
    expect(parseEnabledServices(out)).toEqual(["getty@", "foo.timer"]);
  });
});

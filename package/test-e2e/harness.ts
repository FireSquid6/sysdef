// End-to-end test harness for sysdef.
//
// These tests spin up a real container, lay down a real sysdef install
// (the actual sysdef-src/providers copied verbatim, exactly like a user's
// machine), and drive `sysdef sync` through real package-manager operations.
//
// They are intentionally NOT named "*.test.ts" so `bun test` does not pick
// them up during normal unit runs. Run them explicitly, e.g.:
//
//   bun test ./test-e2e/bun.e2e.ts
//
// Requires a working Docker daemon with network access (images are pulled and
// bun/toolchains are installed at image-build time).

import fs from "fs";
import os from "os";
import path from "path";

const PACKAGE_DIR = path.resolve(import.meta.dir, "..");

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(cmd: string[], opts: { stdin?: string; timeoutMs?: number } = {}): RunResult {
  const proc = Bun.spawnSync(cmd, {
    stdin: opts.stdin !== undefined ? Buffer.from(opts.stdin) : undefined,
    stdout: "pipe",
    stderr: "pipe",
    timeout: opts.timeoutMs,
  });
  return {
    code: proc.exitCode ?? -1,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

export function dockerAvailable(): boolean {
  try {
    return run(["docker", "version"]).code === 0;
  } catch {
    return false;
  }
}

/** Build an image from an inline Dockerfile (no build context needed). */
export function buildImage(tag: string, dockerfile: string): void {
  const res = run(["docker", "build", "-t", tag, "-"], {
    stdin: dockerfile,
    timeoutMs: 15 * 60 * 1000,
  });
  if (res.code !== 0) {
    throw new Error(`Failed to build image ${tag}:\n${res.stdout}\n${res.stderr}`);
  }
}

export interface SyncResult extends RunResult {}

/**
 * A live container with a sysdef install mounted at /sysdef. Package-manager
 * state persists across `sync()` calls, so multi-step scenarios (install ->
 * add/remove -> update) run against a single evolving system.
 */
export class SysdefContainer {
  private id: string | null = null;
  private tmp: string;

  constructor(private image: string, private label: string, private opts: { systemd?: boolean } = {}) {
    this.tmp = fs.mkdtempSync(path.join(os.tmpdir(), `sysdef-e2e-${label}-`));
  }

  start(): void {
    // Keep the container alive; we drive it with `docker exec`.
    // Mount the real package dir read-only, then copy it to a writable /sysdef
    // so the lockfile can be written just like a real install.
    const args = [
      "docker", "run", "-d",
      "--name", this.containerName(),
      "-v", `${PACKAGE_DIR}:/src:ro`,
    ];
    if (this.opts.systemd) {
      // Boot real systemd as PID 1. On cgroup v2, --privileged alone gives the
      // container its OWN private, delegated cgroup subtree (default cgroup
      // namespace = private), so its systemd stays confined to the container.
      //
      // DO NOT add `--cgroupns=host` or bind-mount the host's /sys/fs/cgroup rw:
      // that puts the container's systemd in the HOST cgroup namespace, where it
      // can tear down cgroups belonging to the host's own systemd/logind and
      // kill the user's live graphical session on container shutdown.
      args.push(
        "--privileged",
        "--tmpfs", "/run",
        "--tmpfs", "/run/lock",
        this.image,
        "/sbin/init",
      );
    } else {
      args.push(this.image, "sleep", "infinity");
    }

    const res = run(args);
    if (res.code !== 0) {
      throw new Error(`Failed to start container: ${res.stderr || res.stdout}`);
    }
    this.id = res.stdout.trim();

    // Copy the install into place. Drop the unit tests and the e2e harness
    // sources, but keep test-e2e/image-files (the driver runs from there).
    const setup = this.exec(
      "cp -r /src /sysdef && rm -rf /sysdef/test && find /sysdef/test-e2e -maxdepth 1 -type f -delete && mkdir -p /sysdef/modules /sysdef/dotfiles",
    );
    if (setup.code !== 0) {
      throw new Error(`Failed to lay down /sysdef: ${setup.stderr || setup.stdout}`);
    }

    if (this.opts.systemd) {
      this.waitForSystemd();
    }
  }

  /** Poll `systemctl is-system-running` until systemd finishes booting. */
  private waitForSystemd(): void {
    for (let i = 0; i < 60; i++) {
      const state = this.exec("systemctl is-system-running").stdout.trim();
      // "running"/"degraded"/"maintenance" all mean boot has settled; only
      // "initializing"/"starting" (or empty, before the manager answers) mean
      // we should keep waiting. Degraded is expected (some units are masked).
      if (state && state !== "initializing" && state !== "starting") {
        return;
      }
      Bun.sleepSync(1000);
    }
    throw new Error("systemd did not finish booting in the container");
  }

  private containerName(): string {
    return `sysdef-e2e-${this.label}-${process.pid}`;
  }

  /** Run a shell command inside the container. */
  exec(cmd: string, opts: { stdin?: string; timeoutMs?: number } = {}): RunResult {
    if (!this.id) throw new Error("container not started");
    const args = ["docker", "exec"];
    if (opts.stdin !== undefined) args.push("-i");
    // `bash -c` (not `-lc`): preserve the image's ENV PATH. A login shell would
    // re-run /etc/profile and drop toolchain paths like /usr/local/cargo/bin.
    args.push(this.id, "bash", "-c", cmd);
    return run(args, { stdin: opts.stdin, timeoutMs: opts.timeoutMs ?? 10 * 60 * 1000 });
  }

  writeFile(containerPath: string, contents: string): void {
    // Stage on the host then docker cp -- robust for arbitrary content.
    const local = path.join(this.tmp, "staged");
    fs.writeFileSync(local, contents);
    const res = run(["docker", "cp", local, `${this.id}:${containerPath}`]);
    if (res.code !== 0) {
      throw new Error(`Failed to write ${containerPath}: ${res.stderr || res.stdout}`);
    }
  }

  writeConfig(yaml: string): void {
    this.writeFile("/sysdef/config.yaml", yaml);
  }

  writeModule(name: string, ts: string): void {
    this.writeFile(`/sysdef/modules/${name}.ts`, ts);
  }

  /** Run `sysdef sync`, auto-confirming every prompt. */
  sync(flags = ""): SyncResult {
    return this.exec(
      `cd /sysdef && yes | bun run sysdef-src/entrypoint.ts sync ${flags}`,
      { timeoutMs: 20 * 60 * 1000 },
    );
  }

  /**
   * Drive a provider's methods directly against the real package manager.
   * action is one of: install | uninstall | update | installed.
   * For system package managers (apt/pacman) this is preferable to a full
   * `sync`, whose getInstalled() covers the entire OS.
   */
  driver(provider: string, action: string, args: string[] = []): RunResult {
    return this.exec(
      `cd /sysdef && bun run test-e2e/image-files/e2e-driver.ts ${provider} ${action} ${args.join(" ")}`,
      { timeoutMs: 20 * 60 * 1000 },
    );
  }

  /** Parsed result of a provider's getInstalled() run inside the container. */
  installedVia(provider: string): Array<{ name: string; version: string; provider: string }> {
    const res = this.driver(provider, "installed");
    if (res.code !== 0) {
      throw new Error(`driver installed failed for ${provider}: ${res.stderr || res.stdout}`);
    }
    const line = res.stdout.split("\n").find((l) => l.startsWith("JSON:"));
    if (!line) throw new Error(`no JSON output from driver:\n${res.stdout}`);
    return JSON.parse(line.slice("JSON:".length));
  }

  hasPackage(provider: string, name: string): boolean {
    return this.installedVia(provider).some((p) => p.name === name);
  }

  versionOf(provider: string, name: string): string | undefined {
    return this.installedVia(provider).find((p) => p.name === name)?.version;
  }

  stop(): void {
    if (this.id) {
      run(["docker", "rm", "-f", this.id]);
      this.id = null;
    }
    fs.rmSync(this.tmp, { recursive: true, force: true });
  }
}

/** Convenience: a config that activates a single provider + module. */
export function singleModuleConfig(provider: string, moduleName: string, variables: Record<string, string> = {}): string {
  const vars = Object.entries(variables)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  return `providers:\n  - ${provider}\nmodules:\n  - ${moduleName}\nvariables:${vars ? "\n" + vars : " {}"}\n`;
}

/** Convenience: build a module .ts that only declares packages for one provider. */
export function packagesModule(name: string, provider: string, packages: string[]): string {
  return `import type { ModuleGenerator } from "../sysdef-src/sysdef";

const m: ModuleGenerator = () => ({
  name: ${JSON.stringify(name)},
  variables: {},
  files: {},
  directories: {},
  packages: {
    ${JSON.stringify(provider)}: ${JSON.stringify(packages)},
  },
});

export default m;
`;
}

/** Convenience: a config that activates a single service provider + module. */
export function serviceConfig(serviceProvider: string, moduleName: string): string {
  return `providers: []\nserviceProviders:\n  - ${serviceProvider}\nmodules:\n  - ${moduleName}\nvariables: {}\n`;
}

/** Convenience: build a module .ts that only declares services for one provider. */
export function servicesModule(name: string, provider: string, services: string[]): string {
  return `import type { ModuleGenerator } from "../sysdef-src/sysdef";

const m: ModuleGenerator = () => ({
  name: ${JSON.stringify(name)},
  variables: {},
  files: {},
  directories: {},
  packages: {},
  services: {
    ${JSON.stringify(provider)}: ${JSON.stringify(services)},
  },
});

export default m;
`;
}

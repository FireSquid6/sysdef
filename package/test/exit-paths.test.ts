import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

// Several failure paths in sysdef intentionally call errorOut() -> process.exit(1).
// We can't observe that in-process without killing the test runner, so we exercise
// them in a child bun process and assert on the exit code + output.

const SRC = path.resolve(import.meta.dir, "..", "sysdef-src");

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "sysdef-exit-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function runScript(script: string): { code: number; stdout: string; stderr: string } {
  const scriptPath = path.join(dir, "script.ts");
  fs.writeFileSync(scriptPath, script);
  const proc = Bun.spawnSync(["bun", "run", scriptPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: proc.exitCode ?? -1,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

describe("readConfig failure paths", () => {
  test("exits(1) when config.yaml is missing", () => {
    const result = runScript(`
      import { readConfig } from ${JSON.stringify(path.join(SRC, "configuration.ts"))};
      readConfig(${JSON.stringify(dir)});
      console.log("SHOULD_NOT_REACH");
    `);
    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain("SHOULD_NOT_REACH");
    expect(result.stdout).toContain("Error reading the config file");
  });

  test("exits(1) when config.yaml is structurally invalid", () => {
    fs.writeFileSync(path.join(dir, "config.yaml"), "providers: not-a-list\nmodules: []\nvariables: {}\n");
    const result = runScript(`
      import { readConfig } from ${JSON.stringify(path.join(SRC, "configuration.ts"))};
      readConfig(${JSON.stringify(dir)});
      console.log("SHOULD_NOT_REACH");
    `);
    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain("SHOULD_NOT_REACH");
  });
});

describe("Lockfile.readFromFile failure path", () => {
  test("exits(1) when the lockfile does not match the schema", () => {
    const lockPath = path.join(dir, "sysdef-lock.json");
    // top-level values must be objects of string->string; a number is invalid
    fs.writeFileSync(lockPath, JSON.stringify({ apt: 5 }));
    const result = runScript(`
      import { Lockfile } from ${JSON.stringify(path.join(SRC, "lockfile.ts"))};
      const lf = new Lockfile();
      lf.readFromFile(${JSON.stringify(lockPath)});
      console.log("SHOULD_NOT_REACH");
    `);
    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain("SHOULD_NOT_REACH");
    expect(result.stdout).toContain("Failed to read lockfile");
  });
});

describe("getPackageList version-conflict path", () => {
  test("exits(1) when two modules request different versions of the same package", () => {
    const result = runScript(`
      import { getPackageList } from ${JSON.stringify(path.join(SRC, "sysdef.ts"))};
      import { Lockfile } from ${JSON.stringify(path.join(SRC, "lockfile.ts"))};
      const modules = [
        { name: "a", variables: {}, packages: { apt: ["vim:8.2"] }, directories: {}, files: {} },
        { name: "b", variables: {}, packages: { apt: ["vim:9.0"] }, directories: {}, files: {} },
      ];
      getPackageList(modules, new Lockfile());
      console.log("SHOULD_NOT_REACH");
    `);
    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain("SHOULD_NOT_REACH");
    expect(result.stdout).toContain("Requested two different versions");
  });

  test("does NOT exit when the same version is requested twice", () => {
    const result = runScript(`
      import { getPackageList } from ${JSON.stringify(path.join(SRC, "sysdef.ts"))};
      import { Lockfile } from ${JSON.stringify(path.join(SRC, "lockfile.ts"))};
      const modules = [
        { name: "a", variables: {}, packages: { apt: ["vim:8.2"] }, directories: {}, files: {} },
        { name: "b", variables: {}, packages: { apt: ["vim:8.2"] }, directories: {}, files: {} },
      ];
      const list = getPackageList(modules, new Lockfile());
      console.log("OK:" + list.length);
    `);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("OK:2");
  });
});

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { debianImage, archImage } from "./images";

// Proves sysdef *fails fast* when a package can't be installed (e.g. it doesn't
// exist): sync aborts with a clean "Failed to install ..." error, exits non-zero,
// and never reaches the lockfile write (no pollution). Covers a representative
// subset of providers exercising the distinct install code paths:
//   - apt: previously swallowed the failure and exited 0 (the bug this fixes)
//   - bun: isolated-namespace full sync with a batched single install command
//   - arch-official: pacman with asRoot/displayOutput

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

const BOGUS = "this-package-does-not-exist-sysdef-xyz";

// Shared assertions on a failed `sync` run.
function expectCleanFailure(res: { code: number; stdout: string }, c: SysdefContainer) {
  expect(res.code).not.toBe(0); // aborts with a non-zero exit
  expect(res.stdout).toContain("Fatal error"); // errorOut banner
  expect(res.stdout).toContain("Failed to install"); // clean, provider-level message
  expect(res.stdout).not.toContain("Process called with"); // not a raw thrown-error stack
  // Bailed before the lockfile was written -> no pollution.
  expect(c.exec("test -f /sysdef/sysdef-lock.json").code).not.toBe(0);
}

describe.skipIf(!HAS_DOCKER)("apt install failure (e2e)", () => {
  let c: SysdefContainer;
  beforeAll(() => {
    c = new SysdefContainer(debianImage(), "apt-fail");
    c.start();
    expect(c.exec("apt-get update", { timeoutMs: STEP_TIMEOUT }).code).toBe(0);
    c.writeConfig(singleModuleConfig("apt", "pkgs"));
    c.writeModule("pkgs", packagesModule("pkgs", "apt", [BOGUS]));
  }, BUILD_TIMEOUT);
  afterAll(() => c?.stop());

  test("a nonexistent package aborts sync with a clean error and no lockfile", () => {
    // --safe so we exercise the install path without the whole-OS removal diff.
    const res = c.sync("--safe");
    expectCleanFailure(res, c);
  }, STEP_TIMEOUT);
});

describe.skipIf(!HAS_DOCKER)("bun install failure (e2e)", () => {
  let c: SysdefContainer;
  beforeAll(() => {
    c = new SysdefContainer(debianImage(), "bun-fail");
    c.start();
    expect(c.exec(`sed -i 's#/home/\${BUN_USER}/.bun#/root/.bun#g' /sysdef/providers/bun.ts`).code).toBe(0);
    c.writeConfig(singleModuleConfig("bun", "pkgs"));
    c.writeModule("pkgs", packagesModule("pkgs", "bun", [BOGUS]));
  }, BUILD_TIMEOUT);
  afterAll(() => c?.stop());

  test("a nonexistent package aborts sync with a clean error and no lockfile", () => {
    const res = c.sync();
    expectCleanFailure(res, c);
  }, STEP_TIMEOUT);
});

describe.skipIf(!HAS_DOCKER)("arch-official install failure (e2e)", () => {
  let c: SysdefContainer;
  beforeAll(() => {
    c = new SysdefContainer(archImage(), "arch-fail");
    c.start();
    expect(c.exec("pacman -Sy --noconfirm", { timeoutMs: STEP_TIMEOUT }).code).toBe(0);
    c.writeConfig(singleModuleConfig("arch-official", "pkgs"));
    c.writeModule("pkgs", packagesModule("pkgs", "arch-official", [BOGUS]));
  }, BUILD_TIMEOUT);
  afterAll(() => c?.stop());

  test("a nonexistent package aborts sync with a clean error and no lockfile", () => {
    const res = c.sync("--safe");
    expectCleanFailure(res, c);
  }, STEP_TIMEOUT);

  test("uninstall of a nonexistent package fails fast with a clean error", () => {
    const res = c.driver("arch-official", "uninstall", [BOGUS]);
    expect(res.code).not.toBe(0);
    expect(res.stdout).toContain("Failed to uninstall");
    expect(res.stdout).not.toContain("Process called with");
  }, STEP_TIMEOUT);

  test("update of a nonexistent package fails fast with a clean error", () => {
    const res = c.driver("arch-official", "update", [BOGUS]);
    expect(res.code).not.toBe(0);
    expect(res.stdout).toContain("Failed to update");
    expect(res.stdout).not.toContain("Process called with");
  }, STEP_TIMEOUT);
});

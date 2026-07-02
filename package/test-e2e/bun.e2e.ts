import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { debianImage } from "./images";

// bun is the most deterministic provider to exercise the full capability matrix:
// npm versions are immutable and always available, and installs are fast.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 5 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("bun provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = debianImage();
    c = new SysdefContainer(image, "bun");
    c.start();
    // The bun provider now derives its path from $HOME (os.homedir()), which is
    // /root in-container, matching the bun install -- no patching needed.
    c.writeConfig(singleModuleConfig("bun", "pkgs"));
  }, BUILD_TIMEOUT);

  afterAll(() => {
    c?.stop();
  });

  // Reads the global package.json the bun provider manages.
  function installed(): Record<string, string> {
    const res = c.exec("cat /root/.bun/install/global/package.json 2>/dev/null || echo '{}'");
    const json = JSON.parse(res.stdout.trim() || "{}");
    return json.dependencies ?? {};
  }

  test("fresh install: installs requested packages on a clean system", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "bun", ["is-odd", "is-number"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    const deps = installed();
    expect(deps).toHaveProperty("is-odd");
    expect(deps).toHaveProperty("is-number");
  }, STEP_TIMEOUT);

  test("removal: dropping a package uninstalls it", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "bun", ["is-odd"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    const deps = installed();
    expect(deps).toHaveProperty("is-odd");
    expect(deps).not.toHaveProperty("is-number");
  }, STEP_TIMEOUT);

  test("add + remove: simultaneously installs one and removes another", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "bun", ["is-number"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    const deps = installed();
    expect(deps).toHaveProperty("is-number"); // added
    expect(deps).not.toHaveProperty("is-odd"); // removed
  }, STEP_TIMEOUT);

  test("specific (not latest) version: pins the requested version", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "bun", ["left-pad:1.2.0"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    const deps = installed();
    expect(deps["left-pad"]).toBe("1.2.0");
  }, STEP_TIMEOUT);

  test("update version: changing the pin upgrades the package", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "bun", ["left-pad:1.3.0"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    const deps = installed();
    expect(deps["left-pad"]).toBe("1.3.0");
  }, STEP_TIMEOUT);

  test("idempotency: re-syncing an unchanged config installs/removes nothing", () => {
    const res = c.sync();
    expect(res.code).toBe(0);
    // "OK: N packages" with no INSTALLING/REMOVING lines for bun
    expect(res.stdout).not.toContain("INSTALLING:");
    expect(res.stdout).not.toContain("REMOVING:");
  }, STEP_TIMEOUT);
});

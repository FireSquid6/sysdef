import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { nodeImage } from "./images";

// npm manages an isolated namespace (global npm packages), so a full `sync` is
// safe. npm registry versions are immutable -> deterministic version cases.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 5 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("npm provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    c = new SysdefContainer(nodeImage(), "npm");
    c.start();
    c.writeConfig(singleModuleConfig("npm", "pkgs"));
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("fresh install: installs requested packages on a clean system", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "npm", ["is-odd", "is-number"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("npm", "is-odd")).toBe(true);
    expect(c.hasPackage("npm", "is-number")).toBe(true);
  }, STEP_TIMEOUT);

  test("removal: dropping a package uninstalls it", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "npm", ["is-odd"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("npm", "is-odd")).toBe(true);
    expect(c.hasPackage("npm", "is-number")).toBe(false);
  }, STEP_TIMEOUT);

  test("add + remove: simultaneously installs one and removes another", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "npm", ["is-number"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("npm", "is-number")).toBe(true);
    expect(c.hasPackage("npm", "is-odd")).toBe(false);
  }, STEP_TIMEOUT);

  test("specific (not latest) version: pins the requested version", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "npm", ["left-pad:1.2.0"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("npm", "left-pad")).toBe("1.2.0");
  }, STEP_TIMEOUT);

  test("update version: changing the pin upgrades the package", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "npm", ["left-pad:1.3.0"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("npm", "left-pad")).toBe("1.3.0");
  }, STEP_TIMEOUT);

  test("idempotency: re-syncing an unchanged config changes nothing", () => {
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(res.stdout).not.toContain("INSTALLING:");
    expect(res.stdout).not.toContain("REMOVING:");
  }, STEP_TIMEOUT);
});

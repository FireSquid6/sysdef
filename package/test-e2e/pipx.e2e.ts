import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { pythonImage } from "./images";

// pipx manages an isolated namespace (one venv per app), so a full `sync` is
// safe. PyPI versions are immutable -> deterministic version cases. pycowsay is
// a tiny, dependency-free demo CLI ideal for testing.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 5 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("pipx provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    c = new SysdefContainer(pythonImage(), "pipx");
    c.start();
    c.writeConfig(singleModuleConfig("pipx", "pkgs"));
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("fresh install", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "pipx", ["pycowsay", "pyjokes"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("pipx", "pycowsay")).toBe(true);
    expect(c.hasPackage("pipx", "pyjokes")).toBe(true);
  }, STEP_TIMEOUT);

  test("removal", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "pipx", ["pycowsay"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("pipx", "pycowsay")).toBe(true);
    expect(c.hasPackage("pipx", "pyjokes")).toBe(false);
  }, STEP_TIMEOUT);

  test("add + remove", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "pipx", ["pyjokes"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("pipx", "pyjokes")).toBe(true);
    expect(c.hasPackage("pipx", "pycowsay")).toBe(false);
  }, STEP_TIMEOUT);

  test("specific (not latest) version: pins the requested version", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "pipx", ["pycowsay:0.0.0.1"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("pipx", "pycowsay")).toBe("0.0.0.1");
  }, STEP_TIMEOUT);

  test("update version: changing the pin upgrades the package", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "pipx", ["pycowsay:0.0.0.2"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("pipx", "pycowsay")).toBe("0.0.0.2");
  }, STEP_TIMEOUT);

  test("idempotency: re-syncing an unchanged config changes nothing", () => {
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(res.stdout).not.toContain("INSTALLING:");
    expect(res.stdout).not.toContain("REMOVING:");
  }, STEP_TIMEOUT);
});

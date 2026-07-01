import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { rustImage } from "./images";

// cargo manages only crates it installed (`cargo install --list`), an isolated
// namespace, so a full `sync` is safe here. crates.io versions are immutable, so
// the specific-version and update cases are fully deterministic. We use small,
// fast-compiling crates (hexyl, ruplacer) to keep build time down.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("cargo provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = rustImage();
    c = new SysdefContainer(image, "cargo");
    c.start();
    c.writeConfig(singleModuleConfig("cargo", "pkgs"));
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("fresh install of a specific (not latest) version", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "cargo", ["hexyl:0.13.0"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("cargo", "hexyl")).toBe("0.13.0");
  }, STEP_TIMEOUT);

  test("update version: changing the pin upgrades the crate", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "cargo", ["hexyl:0.14.0"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("cargo", "hexyl")).toBe("0.14.0");
  }, STEP_TIMEOUT);

  test("add + remove: install one crate while removing another", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "cargo", ["ruplacer"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("cargo", "ruplacer")).toBe(true); // added
    expect(c.hasPackage("cargo", "hexyl")).toBe(false); // removed
  }, STEP_TIMEOUT);

  test("removal: emptying the module uninstalls everything", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "cargo", []));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.installedVia("cargo")).toHaveLength(0);
  }, STEP_TIMEOUT);

  test("idempotency: re-syncing an empty module changes nothing", () => {
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(res.stdout).not.toContain("INSTALLING:");
    expect(res.stdout).not.toContain("REMOVING:");
  }, STEP_TIMEOUT);
});

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { goImage } from "./images";

// go installs command binaries into GOBIN (an isolated namespace), so a full
// `sync` is safe. Module versions are immutable -> deterministic version cases.
// rsc.io/2fa is a tiny, dependency-light CLI with tagged versions.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 8 * 60 * 1000;

const TWOFA = "rsc.io/2fa";
const HELLO = "golang.org/x/example/hello";

describe.skipIf(!HAS_DOCKER)("go provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    c = new SysdefContainer(goImage(), "go");
    c.start();
    c.writeConfig(singleModuleConfig("go", "pkgs"));
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("fresh install of a specific (not latest) version", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "go", [`${TWOFA}:v1.1.0`]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("go", TWOFA)).toBe("v1.1.0");
  }, STEP_TIMEOUT);

  test("update version: changing the pin upgrades the binary", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "go", [`${TWOFA}:v1.2.0`]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.versionOf("go", TWOFA)).toBe("v1.2.0");
  }, STEP_TIMEOUT);

  test("add + remove: install one binary while removing another", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "go", [HELLO]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.hasPackage("go", HELLO)).toBe(true);
    expect(c.hasPackage("go", TWOFA)).toBe(false);
  }, STEP_TIMEOUT);

  test("removal: emptying the module uninstalls everything", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "go", []));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.installedVia("go")).toHaveLength(0);
  }, STEP_TIMEOUT);
});

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { debianImage } from "./images";

// apt manages the whole OS (getInstalled() lists every installed package), so a
// full `sync` without --safe would try to remove the base system. We therefore:
//   - use `sync --safe` to prove the whole sysdef pipeline installs on real apt
//   - drive the provider methods directly for remove/add-remove/version cases

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("apt provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = debianImage();
    c = new SysdefContainer(image, "apt");
    c.start();
    const upd = c.exec("apt-get update", { timeoutMs: STEP_TIMEOUT });
    expect(upd.code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  function dpkgInstalled(pkg: string): boolean {
    const res = c.exec(`dpkg -s ${pkg} 2>/dev/null | grep -q '^Status: install ok installed'`);
    return res.code === 0;
  }

  function availableVersion(pkg: string): string {
    const res = c.exec(`apt-cache madison ${pkg} | head -1`);
    // format: "pkg | 1.2-3 | http://..."
    const parts = res.stdout.split("|");
    return parts[1]!.trim();
  }

  test("fresh install via full `sync --safe` pipeline", () => {
    c.writeConfig(singleModuleConfig("apt", "pkgs"));
    c.writeModule("pkgs", packagesModule("pkgs", "apt", ["sl", "hello"]));
    const res = c.sync("--safe");
    expect(res.code).toBe(0);
    expect(dpkgInstalled("sl")).toBe(true);
    expect(dpkgInstalled("hello")).toBe(true);
    // lockfile was written with the installed versions
    const lock = c.exec("cat /sysdef/sysdef-lock.json");
    expect(lock.stdout).toContain("\"apt\"");
    expect(lock.stdout).toContain("sl");
  }, STEP_TIMEOUT);

  test("removal: uninstalling a package removes it", () => {
    const res = c.driver("apt", "uninstall", ["hello"]);
    expect(res.code).toBe(0);
    expect(dpkgInstalled("hello")).toBe(false);
    expect(dpkgInstalled("sl")).toBe(true); // untouched
  }, STEP_TIMEOUT);

  test("add + remove: install one package while removing another", () => {
    const add = c.driver("apt", "install", ["cowsay"]);
    expect(add.code).toBe(0);
    const rm = c.driver("apt", "uninstall", ["sl"]);
    expect(rm.code).toBe(0);
    expect(dpkgInstalled("cowsay")).toBe(true);
    expect(dpkgInstalled("sl")).toBe(false);
  }, STEP_TIMEOUT);

  test("specific (not latest) version: pins the requested version", () => {
    const ver = availableVersion("figlet");
    expect(ver.length).toBeGreaterThan(0);
    const res = c.driver("apt", "install", [`figlet:${ver}`]);
    expect(res.code).toBe(0);
    expect(dpkgInstalled("figlet")).toBe(true);
    // dpkg reports the exact installed version
    const shown = c.exec("dpkg-query -W -f='${Version}' figlet");
    expect(shown.stdout.trim()).toBe(ver);
  }, STEP_TIMEOUT);

  test("update path: `update` reinstalls/upgrades without error", () => {
    const res = c.driver("apt", "update", ["figlet"]);
    expect(res.code).toBe(0);
    expect(dpkgInstalled("figlet")).toBe(true);
  }, STEP_TIMEOUT);

  test("provider getInstalled reports a package we installed", () => {
    expect(c.hasPackage("apt", "cowsay")).toBe(true);
  }, STEP_TIMEOUT);
});

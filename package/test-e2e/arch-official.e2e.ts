import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { archImage } from "./images";

// pacman manages the whole OS, so (like apt) we use `sync --safe` to prove the
// pipeline installs on real pacman, and drive the provider methods directly for
// remove/add-remove/update. Official Arch repos only carry the current version
// of a package, so a "pin to an arbitrary old version" case isn't applicable
// here (that's covered deterministically by the bun and cargo suites).

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("arch-official provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = archImage();
    c = new SysdefContainer(image, "arch");
    c.start();
    const refresh = c.exec("pacman -Sy --noconfirm", { timeoutMs: STEP_TIMEOUT });
    expect(refresh.code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  function pacmanInstalled(pkg: string): boolean {
    return c.exec(`pacman -Q ${pkg} >/dev/null 2>&1`).code === 0;
  }

  test("fresh install via full `sync --safe` pipeline", () => {
    c.writeConfig(singleModuleConfig("arch-official", "pkgs"));
    c.writeModule("pkgs", packagesModule("pkgs", "arch-official", ["sl"]));
    const res = c.sync("--safe");
    expect(res.code).toBe(0);
    expect(pacmanInstalled("sl")).toBe(true);
    const lock = c.exec("cat /sysdef/sysdef-lock.json");
    expect(lock.stdout).toContain("arch-official");
  }, STEP_TIMEOUT);

  test("idempotency: re-running the same sync installs nothing new", () => {
    const res = c.sync("--safe");
    expect(res.code).toBe(0);
    expect(res.stdout).not.toContain("INSTALLING:");
  }, STEP_TIMEOUT);

  test("add + remove: install one package while removing another", () => {
    const add = c.driver("arch-official", "install", ["cowsay"]);
    expect(add.code).toBe(0);
    const rm = c.driver("arch-official", "uninstall", ["sl"]);
    expect(rm.code).toBe(0);
    expect(pacmanInstalled("cowsay")).toBe(true);
    expect(pacmanInstalled("sl")).toBe(false);
  }, STEP_TIMEOUT);

  test("removal: uninstalling a package removes it", () => {
    const rm = c.driver("arch-official", "uninstall", ["cowsay"]);
    expect(rm.code).toBe(0);
    expect(pacmanInstalled("cowsay")).toBe(false);
  }, STEP_TIMEOUT);

  test("update path: `update` runs a system upgrade without error", () => {
    const add = c.driver("arch-official", "install", ["figlet"]);
    expect(add.code).toBe(0);
    const upd = c.driver("arch-official", "update", ["figlet"]);
    expect(upd.code).toBe(0);
    expect(pacmanInstalled("figlet")).toBe(true);
  }, STEP_TIMEOUT);

  test("getInstalled reports explicitly-installed packages", () => {
    // arch-official filters out foreign (AUR) packages and lists explicit ones
    expect(c.hasPackage("arch-official", "figlet")).toBe(true);
  }, STEP_TIMEOUT);
});

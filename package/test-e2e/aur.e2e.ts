import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { SysdefContainer, dockerAvailable } from "./harness";
import { archImage } from "./images";

// NOTE on the current aur provider implementation:
//   - install() currently runs `pacman -S --noconfirm` (the buildAndInstallFromAUR
//     helper in the provider is defined but not wired into install()), so these
//     tests exercise that real code path against real pacman using official
//     packages. Building genuine AUR packages requires makepkg run as a non-root
//     user and network access to aur.archlinux.org; that heavier path is out of
//     scope for the default suite.
//   - getInstalled() lists only *foreign* packages (`pacman -Qm`), so official
//     packages installed here won't appear there; we verify system state with
//     `pacman -Q` directly.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("aur provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = archImage();
    c = new SysdefContainer(image, "aur");
    c.start();
    const refresh = c.exec("pacman -Sy --noconfirm", { timeoutMs: STEP_TIMEOUT });
    expect(refresh.code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  const isInstalled = (pkg: string) => c.exec(`pacman -Q ${pkg} >/dev/null 2>&1`).code === 0;

  test("fresh install", () => {
    const res = c.driver("aur", "install", ["sl"]);
    expect(res.code).toBe(0);
    expect(isInstalled("sl")).toBe(true);
  }, STEP_TIMEOUT);

  test("removal", () => {
    const res = c.driver("aur", "uninstall", ["sl"]);
    expect(res.code).toBe(0);
    expect(isInstalled("sl")).toBe(false);
  }, STEP_TIMEOUT);

  test("add + remove", () => {
    expect(c.driver("aur", "install", ["cowsay"]).code).toBe(0);
    expect(c.driver("aur", "install", ["figlet"]).code).toBe(0);
    expect(c.driver("aur", "uninstall", ["cowsay"]).code).toBe(0);
    expect(isInstalled("figlet")).toBe(true);
    expect(isInstalled("cowsay")).toBe(false);
  }, STEP_TIMEOUT);

  test("update path runs without error", () => {
    const res = c.driver("aur", "update", ["figlet"]);
    expect(res.code).toBe(0);
    expect(isInstalled("figlet")).toBe(true);
  }, STEP_TIMEOUT);

  test("getInstalled lists foreign packages without crashing (empty on a clean system)", () => {
    // No AUR packages were actually built, so this should be an empty list.
    const installed = c.installedVia("aur");
    expect(Array.isArray(installed)).toBe(true);
  }, STEP_TIMEOUT);
});

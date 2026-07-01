import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { SysdefContainer, dockerAvailable } from "./harness";
import { archImage } from "./images";

// Installing a real `yay` requires building it from the AUR (makepkg as a
// non-root user + network to aur.archlinux.org) which is slow and flaky in CI.
// The yay provider is a thin wrapper over the `yay` binary whose sub-commands
// mirror pacman (-S / -Rs / -Qe / -Syu). To exercise the provider's real command
// construction and its `yay -Qe` output parsing against real package state, we
// install a pacman-backed `yay` shim. This validates the provider code paths;
// the genuine AUR build path is out of scope for the default suite.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

const YAY_SHIM = `#!/bin/bash
# pacman-backed yay shim (see yay.e2e.ts). Runs as root, so no internal sudo.
sub="$1"; shift
case "$sub" in
  -S)   exec pacman -S "$@" ;;
  -Rs)  exec pacman -Rs "$@" ;;
  -Qe)  exec pacman -Qe "$@" ;;
  -Syu) exec pacman -Syu "$@" ;;
  *)    exec pacman "$sub" "$@" ;;
esac
`;

describe.skipIf(!HAS_DOCKER)("yay provider (e2e, pacman-backed shim)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = archImage();
    c = new SysdefContainer(image, "yay");
    c.start();
    expect(c.exec("pacman -Sy --noconfirm", { timeoutMs: STEP_TIMEOUT }).code).toBe(0);
    c.writeFile("/usr/local/bin/yay", YAY_SHIM);
    expect(c.exec("chmod +x /usr/local/bin/yay && which yay").code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  const isInstalled = (pkg: string) => c.exec(`pacman -Q ${pkg} >/dev/null 2>&1`).code === 0;

  test("checkInstallation passes when yay is on PATH", () => {
    const res = c.driver("yay", "installed"); // also exercises `yay -Qe` parsing
    expect(res.code).toBe(0);
  }, STEP_TIMEOUT);

  test("fresh install", () => {
    const res = c.driver("yay", "install", ["sl"]);
    expect(res.code).toBe(0);
    expect(isInstalled("sl")).toBe(true);
    expect(c.hasPackage("yay", "sl")).toBe(true); // shows up in `yay -Qe`
  }, STEP_TIMEOUT);

  test("removal", () => {
    const res = c.driver("yay", "uninstall", ["sl"]);
    expect(res.code).toBe(0);
    expect(isInstalled("sl")).toBe(false);
  }, STEP_TIMEOUT);

  test("add + remove", () => {
    expect(c.driver("yay", "install", ["cowsay"]).code).toBe(0);
    expect(c.driver("yay", "install", ["figlet"]).code).toBe(0);
    expect(c.driver("yay", "uninstall", ["cowsay"]).code).toBe(0);
    expect(isInstalled("figlet")).toBe(true);
    expect(isInstalled("cowsay")).toBe(false);
  }, STEP_TIMEOUT);

  test("update path runs without error", () => {
    const res = c.driver("yay", "update", ["figlet"]);
    expect(res.code).toBe(0);
    expect(isInstalled("figlet")).toBe(true);
  }, STEP_TIMEOUT);

  test("getInstalled parses `yay -Qe` output", () => {
    expect(c.hasPackage("yay", "figlet")).toBe(true);
  }, STEP_TIMEOUT);
});

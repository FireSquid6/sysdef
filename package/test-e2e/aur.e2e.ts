import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { SysdefContainer, dockerAvailable } from "./harness";
import { archImage } from "./images";

// The aur provider clones + builds packages from the AUR with makepkg (which
// refuses to run as root). The real build path is slow and network-flaky, so it
// is gated behind SYSDEF_E2E_AUR=1 and runs as the non-root `builder` user baked
// into the arch image. Fast, always-on checks live in the first describe;
// pinned-version rejection is covered in test/exit-paths.test.ts.

const HAS_DOCKER = dockerAvailable();
const RUN_AUR_BUILD = HAS_DOCKER && !!process.env.SYSDEF_E2E_AUR;
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 15 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("aur provider (e2e, fast)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    c = new SysdefContainer(archImage(), "aur");
    c.start();
    expect(c.exec("pacman -Sy --noconfirm", { timeoutMs: STEP_TIMEOUT }).code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("getInstalled returns an empty list on a clean system (no foreign packages)", () => {
    const installed = c.installedVia("aur");
    expect(Array.isArray(installed)).toBe(true);
    expect(installed).toHaveLength(0);
  }, STEP_TIMEOUT);
});

describe.skipIf(!RUN_AUR_BUILD)("aur provider (e2e, real build — SYSDEF_E2E_AUR=1)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    c = new SysdefContainer(archImage(), "aur-build");
    c.start();
    expect(c.exec("pacman -Sy --noconfirm", { timeoutMs: STEP_TIMEOUT }).code).toBe(0);
    // /sysdef is root-owned; let the builder user write the lockfile etc.
    expect(c.exec("chown -R builder /sysdef").code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  // run the provider driver as the non-root builder user (makepkg refuses root)
  const driverAsBuilder = (action: string, args: string[] = []) =>
    c.exec(
      `su builder -c 'cd /sysdef && bun run test-e2e/image-files/e2e-driver.ts aur ${action} ${args.join(" ")}'`,
      { timeoutMs: STEP_TIMEOUT },
    );

  test("builds and installs a real prebuilt AUR package", () => {
    // yay-bin ships a prebuilt binary (no compilation) -> reliable, quick build
    const res = driverAsBuilder("install", ["yay-bin"]);
    expect(res.code).toBe(0);
    expect(c.exec("pacman -Q yay-bin").code).toBe(0);
    // it now shows up as a foreign package
    expect(c.hasPackage("aur", "yay-bin")).toBe(true);
  }, STEP_TIMEOUT);

  test("uninstalls the AUR package", () => {
    const res = driverAsBuilder("uninstall", ["yay-bin"]);
    expect(res.code).toBe(0);
    expect(c.exec("pacman -Q yay-bin").code).not.toBe(0);
  }, STEP_TIMEOUT);
});

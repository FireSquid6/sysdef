import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { debianImage } from "./images";

// Proves the managed-set model (Gap 1): a full `sync` (no --safe) on a system
// package manager removes ONLY packages sysdef installed, never packages the
// user installed by other means. Also proves checkInstallation failures abort.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("managed-set removal safety (e2e)", () => {
  let c: SysdefContainer;

  const isInstalled = (pkg: string) => c.exec(`dpkg -s ${pkg} 2>/dev/null | grep -q '^Status: install ok installed'`).code === 0;

  beforeAll(() => {
    c = new SysdefContainer(debianImage(), "managed");
    c.start();
    expect(c.exec("apt-get update", { timeoutMs: STEP_TIMEOUT }).code).toBe(0);
    // sl is installed OUTSIDE sysdef -- sysdef must never touch it
    expect(c.exec("apt-get install -y sl", { timeoutMs: STEP_TIMEOUT }).code).toBe(0);
    c.writeConfig(singleModuleConfig("apt", "pkgs"));
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("a full sync installs declared packages but leaves unmanaged ones alone", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "apt", ["hello"]));
    const res = c.sync(); // NOTE: no --safe
    expect(res.code).toBe(0);
    expect(isInstalled("hello")).toBe(true); // sysdef installed it
    expect(isInstalled("sl")).toBe(true); // user-installed, untouched
  }, STEP_TIMEOUT);

  test("dropping a managed package removes it, still leaving unmanaged ones", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "apt", []));
    const res = c.sync(); // no --safe
    expect(res.code).toBe(0);
    expect(isInstalled("hello")).toBe(false); // sysdef managed it -> removed
    expect(isInstalled("sl")).toBe(true); // never managed -> survives
  }, STEP_TIMEOUT);
});

describe.skipIf(!HAS_DOCKER)("checkInstallation failure aborts sync (e2e)", () => {
  let c: SysdefContainer;

  const BOOM_PROVIDER = `import type { ProviderGenerator } from "../sysdef-src/sysdef";

const provider: ProviderGenerator = () => ({
  name: "boom",
  async checkInstallation() { throw new Error("boom is broken"); },
  async install() {},
  async uninstall() {},
  async getInstalled() { return []; },
  async update() {},
});

export default provider;
`;

  beforeAll(() => {
    c = new SysdefContainer(debianImage(), "checkinstall");
    c.start();
    c.writeFile("/sysdef/providers/boom.ts", BOOM_PROVIDER);
    c.writeConfig("providers:\n  - boom\nmodules: []\nvariables: {}\n");
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("a provider whose checkInstallation throws aborts the sync (exit 1)", () => {
    const res = c.sync();
    expect(res.code).not.toBe(0);
    expect(res.stdout).toContain("failed when checking its own installation");
  }, STEP_TIMEOUT);
});

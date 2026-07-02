import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { fedoraImage } from "./images";

// dnf reports the whole OS from getInstalled(), but the managed-set model keeps
// removal safe, so we can run the full `sync` matrix (including removals) here.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 10 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("dnf provider (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    c = new SysdefContainer(fedoraImage(), "dnf");
    c.start();
    c.writeConfig(singleModuleConfig("dnf", "pkgs"));
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  const isInstalled = (pkg: string) => c.exec(`rpm -q ${pkg} >/dev/null 2>&1`).code === 0;
  const availableVersion = (pkg: string) =>
    c.exec(`dnf repoquery --quiet --queryformat '%{VERSION}-%{RELEASE}' ${pkg} | tail -1`).stdout.trim();

  test("fresh install via full `sync`", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "dnf", ["sl", "hello"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(isInstalled("sl")).toBe(true);
    expect(isInstalled("hello")).toBe(true);
  }, STEP_TIMEOUT);

  test("managed removal: a dropped package is removed (managed-set on a system PM)", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "dnf", ["sl"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(isInstalled("sl")).toBe(true);
    expect(isInstalled("hello")).toBe(false);
  }, STEP_TIMEOUT);

  test("add + remove: install one package while removing another", () => {
    c.writeModule("pkgs", packagesModule("pkgs", "dnf", ["hello"]));
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(isInstalled("hello")).toBe(true);
    expect(isInstalled("sl")).toBe(false);
  }, STEP_TIMEOUT);

  test("specific (not latest) version: pins the requested version", () => {
    const evr = availableVersion("figlet");
    expect(evr.length).toBeGreaterThan(0);
    c.writeModule("pkgs", packagesModule("pkgs", "dnf", [`figlet:${evr}`]));
    const res = c.sync();
    expect(res.code).toBe(0);
    const shown = c.exec("rpm -q --qf '%{VERSION}-%{RELEASE}' figlet").stdout.trim();
    expect(shown).toBe(evr);
  }, STEP_TIMEOUT);

  test("idempotency: re-syncing an unchanged config changes nothing", () => {
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(res.stdout).not.toContain("INSTALLING:");
    expect(res.stdout).not.toContain("REMOVING:");
  }, STEP_TIMEOUT);
});

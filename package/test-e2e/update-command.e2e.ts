import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  SysdefContainer,
  dockerAvailable,
  singleModuleConfig,
  packagesModule,
} from "./harness";
import { nodeImage } from "./images";

// Proves the `sysdef update` command (Gap 2): provider.update() is now reachable
// and upgrades a managed package to its newest version, refreshing the lockfile.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 5 * 60 * 1000;

describe.skipIf(!HAS_DOCKER)("sysdef update command (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    c = new SysdefContainer(nodeImage(), "update-cmd");
    c.start();
    c.writeConfig(singleModuleConfig("npm", "pkgs"));
    // pin an old version so there is a newer one to update to
    c.writeModule("pkgs", packagesModule("pkgs", "npm", ["left-pad:1.2.0"]));
    expect(c.sync().code).toBe(0);
    expect(c.versionOf("npm", "left-pad")).toBe("1.2.0");
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("`sysdef update npm left-pad` upgrades to the newest version", () => {
    const res = c.exec(
      "cd /sysdef && bun run sysdef-src/entrypoint.ts update npm left-pad",
      { timeoutMs: STEP_TIMEOUT },
    );
    expect(res.code).toBe(0);
    // left-pad's newest version is 1.3.0
    expect(c.versionOf("npm", "left-pad")).toBe("1.3.0");
    // the lockfile was refreshed to the new version
    const lock = c.exec("cat /sysdef/sysdef-lock.json").stdout;
    expect(lock).toContain("1.3.0");
  }, STEP_TIMEOUT);
});

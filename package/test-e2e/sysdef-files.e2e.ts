import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { SysdefContainer, dockerAvailable } from "./harness";
import { debianImage } from "./images";

// Exercises the file-management half of a `sync` (the `-f/--files-only` path):
// symlinking a dotfile, generating a file from a function (with variable
// substitution), and linking a whole directory -- against a real filesystem.

const HAS_DOCKER = dockerAvailable();
const BUILD_TIMEOUT = 15 * 60 * 1000;
const STEP_TIMEOUT = 5 * 60 * 1000;

const FILES_MODULE = `import type { ModuleGenerator } from "../sysdef-src/sysdef";

const m: ModuleGenerator = () => ({
  name: "files",
  variables: {},
  files: {
    "{HOME}/.sysdef-linked": "./dotfiles/example.txt",
    "{HOME}/.sysdef-generated": (v) => \`home is \${v.get("HOME")}\\n\`,
  },
  directories: {
    "{HOME}/.sysdef-linkeddir": "./dotfiles/somedir",
  },
  packages: {},
  onEverySync: async (shell) => {
    await shell("touch /root/.sysdef-ran", {});
  },
});

export default m;
`;

const CONFIG = `providers: []
modules:
  - files
variables:
  HOME: /root
`;

describe.skipIf(!HAS_DOCKER)("sysdef file sync (e2e)", () => {
  let c: SysdefContainer;

  beforeAll(() => {
    const image = debianImage();
    c = new SysdefContainer(image, "files");
    c.start();
    c.writeConfig(CONFIG);
    c.writeModule("files", FILES_MODULE);
    // Seed the source dotfiles inside the install.
    const seed = c.exec(
      "mkdir -p /sysdef/dotfiles/somedir && " +
        "printf 'linked contents' > /sysdef/dotfiles/example.txt && " +
        "printf 'nested contents' > /sysdef/dotfiles/somedir/inner.txt",
    );
    expect(seed.code).toBe(0);
    const res = c.sync("-f");
    expect(res.code).toBe(0);
  }, BUILD_TIMEOUT);

  afterAll(() => c?.stop());

  test("symlinks a dotfile to its source in the install", () => {
    expect(c.exec("test -L /root/.sysdef-linked").code).toBe(0);
    expect(c.exec("readlink -f /root/.sysdef-linked").stdout.trim()).toBe(
      "/sysdef/dotfiles/example.txt",
    );
    expect(c.exec("cat /root/.sysdef-linked").stdout).toBe("linked contents");
  }, STEP_TIMEOUT);

  test("generates a file from a function with variable substitution", () => {
    // A generated file is a real file, not a symlink.
    expect(c.exec("test -L /root/.sysdef-generated").code).not.toBe(0);
    expect(c.exec("cat /root/.sysdef-generated").stdout).toBe("home is /root\n");
  }, STEP_TIMEOUT);

  test("links an entire directory", () => {
    expect(c.exec("test -L /root/.sysdef-linkeddir").code).toBe(0);
    expect(c.exec("cat /root/.sysdef-linkeddir/inner.txt").stdout).toBe("nested contents");
  }, STEP_TIMEOUT);

  test("re-running file sync is idempotent", () => {
    const res = c.sync("-f");
    expect(res.code).toBe(0);
    expect(c.exec("cat /root/.sysdef-generated").stdout).toBe("home is /root\n");
    expect(c.exec("test -L /root/.sysdef-linked").code).toBe(0);
  }, STEP_TIMEOUT);

  test("onEverySync events run during a full sync", () => {
    // -f (files-only) returns before events, so run a full sync. The config has
    // no providers, so this only links files and fires events.
    expect(c.exec("rm -f /root/.sysdef-ran").code).toBe(0);
    const res = c.sync();
    expect(res.code).toBe(0);
    expect(c.exec("test -f /root/.sysdef-ran").code).toBe(0);
  }, STEP_TIMEOUT);
});

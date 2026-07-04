import { describe, test, expect } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { Trackfile } from "../sysdef-src/trackfile";

function tmpPath(): string {
  return path.join(os.tmpdir(), `sysdef-track-test-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
}

describe("Trackfile", () => {
  test("addUntracked records names per provider and dedupes", () => {
    const t = new Trackfile();
    t.addUntracked("npm", "ripgrep");
    t.addUntracked("npm", "bat");
    t.addUntracked("npm", "ripgrep"); // duplicate, ignored
    t.addUntracked("cargo", "eza");

    expect(t.getUntracked("npm").sort()).toEqual(["bat", "ripgrep"]);
    expect(t.getUntracked("cargo")).toEqual(["eza"]);
    expect(t.isUntracked("npm", "ripgrep")).toBe(true);
    expect(t.isUntracked("npm", "missing")).toBe(false);
  });

  test("getUntracked returns an empty array for an unknown provider", () => {
    const t = new Trackfile();
    expect(t.getUntracked("nope")).toEqual([]);
  });

  test("removeUntracked drops a name and prunes empty providers", () => {
    const t = new Trackfile();
    t.addUntracked("npm", "ripgrep");
    t.addUntracked("npm", "bat");

    t.removeUntracked("npm", "ripgrep");
    expect(t.getUntracked("npm")).toEqual(["bat"]);

    t.removeUntracked("npm", "bat");
    // provider key pruned once empty
    expect(t.getProviders()).toEqual([]);
    // removing from a missing provider is a no-op
    expect(() => t.removeUntracked("gone", "x")).not.toThrow();
  });

  test("getProviders lists only providers with entries", () => {
    const t = new Trackfile();
    t.addUntracked("npm", "a");
    t.addUntracked("cargo", "b");
    expect(t.getProviders().sort()).toEqual(["cargo", "npm"]);
  });

  test("serializes to and reads back from disk (round trip)", () => {
    const file = tmpPath();
    try {
      const t = new Trackfile();
      t.addUntracked("npm", "ripgrep");
      t.addUntracked("cargo", "eza");
      t.setEnabledServices("systemd", ["sshd"]);
      t.serializeToFile(file);

      const raw = JSON.parse(fs.readFileSync(file).toString());
      expect(raw).toEqual({
        untracked: { npm: ["ripgrep"], cargo: ["eza"] },
        enabledServices: { systemd: ["sshd"] },
      });

      const loaded = new Trackfile();
      loaded.readFromFile(file);
      expect(loaded.getUntracked("npm")).toEqual(["ripgrep"]);
      expect(loaded.getUntracked("cargo")).toEqual(["eza"]);
      expect(loaded.getEnabledServices("systemd")).toEqual(["sshd"]);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  test("readFromFile on a missing file leaves the trackfile empty", () => {
    const t = new Trackfile();
    t.readFromFile(tmpPath()); // does not exist
    expect(t.getProviders()).toEqual([]);
    expect(t.getServiceProviders()).toEqual([]);
  });

  test("migrates a legacy flat trackfile into the untracked section", () => {
    const file = tmpPath();
    try {
      // the pre-services on-disk shape was just the untracked map
      fs.writeFileSync(file, JSON.stringify({ npm: ["ripgrep"], cargo: ["eza"] }));

      const t = new Trackfile();
      t.readFromFile(file);
      expect(t.getUntracked("npm")).toEqual(["ripgrep"]);
      expect(t.getUntracked("cargo")).toEqual(["eza"]);
      expect(t.getServiceProviders()).toEqual([]);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });
});

describe("Trackfile enabledServices", () => {
  test("setEnabledServices records, dedupes, and getEnabledServices/isServiceEnabled read back", () => {
    const t = new Trackfile();
    t.setEnabledServices("systemd", ["sshd", "docker", "sshd"]);

    expect(t.getEnabledServices("systemd").sort()).toEqual(["docker", "sshd"]);
    expect(t.isServiceEnabled("systemd", "sshd")).toBe(true);
    expect(t.isServiceEnabled("systemd", "missing")).toBe(false);
    expect(t.getServiceProviders()).toEqual(["systemd"]);
  });

  test("getEnabledServices returns an empty array for an unknown provider", () => {
    const t = new Trackfile();
    expect(t.getEnabledServices("nope")).toEqual([]);
  });

  test("setEnabledServices replaces the whole set and prunes when empty", () => {
    const t = new Trackfile();
    t.setEnabledServices("systemd", ["sshd", "docker"]);
    t.setEnabledServices("systemd", ["docker"]); // replace, not merge
    expect(t.getEnabledServices("systemd")).toEqual(["docker"]);

    t.setEnabledServices("systemd", []); // empty prunes the key
    expect(t.getServiceProviders()).toEqual([]);
  });

  test("enabledServices and untracked are independent for the same provider name", () => {
    const t = new Trackfile();
    t.addUntracked("systemd", "getty@tty1");
    t.setEnabledServices("systemd", ["sshd"]);

    expect(t.getUntracked("systemd")).toEqual(["getty@tty1"]);
    expect(t.getEnabledServices("systemd")).toEqual(["sshd"]);
  });
});

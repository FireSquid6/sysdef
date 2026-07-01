import { describe, test, expect } from "bun:test";
import {
  ANY_VERSION_STRING,
  type PackageInfo,
  type Shell,
  type ShellOptions,
  type ShellResult,
} from "../sysdef-src/sysdef";

import aptGen from "../providers/apt";
import archGen from "../providers/arch-official";
import aurGen from "../providers/aur";
import yayGen from "../providers/yay";
import cargoGen from "../providers/cargo";
import bunGen from "../providers/bun";
import customGen from "../providers/custom";

// A recording mock Shell. Providers receive this via their generator, so every
// command they build with the injected `run` is captured here. Canned responses
// can be keyed by the exact command string.
function mockShell(responses: Record<string, Partial<ShellResult>> = {}) {
  const calls: Array<{ cmd: string; options: ShellOptions }> = [];
  const shell: Shell = async (s, options) => {
    const cmd = Array.isArray(s) ? s.join(" ") : s;
    calls.push({ cmd, options: options ?? {} });
    const r = responses[cmd];
    return { code: r?.code ?? 0, stdout: r?.stdout ?? "" };
  };
  return { shell, calls, cmds: () => calls.map((c) => c.cmd) };
}

const pkg = (name: string, version: string, provider: string): PackageInfo => ({
  name,
  version,
  provider,
});

describe("apt provider", () => {
  test("install builds a single batched `apt install -y` command", async () => {
    const { shell, cmds } = mockShell();
    const p = aptGen(shell);
    await p.install([pkg("vim", ANY_VERSION_STRING, "apt"), pkg("git", "1:2.39", "apt")]);
    expect(cmds()).toEqual(["sudo apt install -y vim git=1:2.39"]);
  });

  test("install batches in groups of 10", async () => {
    const { shell, cmds } = mockShell();
    const p = aptGen(shell);
    const many = Array.from({ length: 23 }, (_, i) => pkg(`p${i}`, ANY_VERSION_STRING, "apt"));
    await p.install(many);
    const calls = cmds();
    expect(calls).toHaveLength(3); // 10 + 10 + 3
    expect(calls[0]!.split(" ").length).toBe(4 + 10); // "sudo apt install -y" + 10 names
    expect(calls[2]!).toContain("p20 p21 p22");
  });

  test("uninstall builds `apt remove -y`", async () => {
    const { shell, cmds } = mockShell();
    const p = aptGen(shell);
    await p.uninstall(["vim", "git"]);
    expect(cmds()).toEqual(["sudo apt remove -y vim git"]);
  });

  test("update with no packages does a full upgrade", async () => {
    const { shell, cmds } = mockShell();
    const p = aptGen(shell);
    await p.update([]);
    expect(cmds()).toEqual(["sudo apt update && sudo apt upgrade -y"]);
  });

  test("update with packages installs each", async () => {
    const { shell, cmds } = mockShell();
    const p = aptGen(shell);
    await p.update(["vim", "git"]);
    expect(cmds().sort()).toEqual(["sudo apt install -y git", "sudo apt install -y vim"]);
  });

  test("checkInstallation probes with `which apt`", async () => {
    const { shell, cmds } = mockShell();
    const p = aptGen(shell);
    await p.checkInstallation!();
    expect(cmds()).toEqual(["which apt"]);
  });
});

describe("arch-official provider", () => {
  test("install uses pacman -S as root, batched by 5", async () => {
    const { shell, calls, cmds } = mockShell();
    const p = archGen(shell);
    const many = Array.from({ length: 6 }, (_, i) => pkg(`p${i}`, ANY_VERSION_STRING, "arch-official"));
    await p.install(many);
    expect(cmds()).toHaveLength(2); // 5 + 1
    expect(cmds()[0]).toBe("pacman -S --noconfirm p0 p1 p2 p3 p4");
    expect(calls[0]!.options.asRoot).toBe(true);
  });

  test("install pins versions with `=`", async () => {
    const { shell, cmds } = mockShell();
    const p = archGen(shell);
    await p.install([pkg("vim", "9.0", "arch-official")]);
    expect(cmds()).toEqual(["pacman -S --noconfirm vim=9.0"]);
  });

  test("uninstall uses pacman -Rs as root", async () => {
    const { shell, calls, cmds } = mockShell();
    const p = archGen(shell);
    await p.uninstall(["vim"]);
    expect(cmds()).toEqual(["pacman -Rs --noconfirm vim"]);
    expect(calls[0]!.options.asRoot).toBe(true);
  });

  test("update uses pacman -Syu as root", async () => {
    const { shell, calls, cmds } = mockShell();
    const p = archGen(shell);
    await p.update(["vim"]);
    expect(cmds()).toEqual(["pacman -Syu --noconfirm vim"]);
    expect(calls[0]!.options.asRoot).toBe(true);
  });

  test("checkInstallation probes with `which pacman`", async () => {
    const { shell, cmds } = mockShell();
    const p = archGen(shell);
    await p.checkInstallation!();
    expect(cmds()).toEqual(["which pacman"]);
  });
});

describe("aur provider", () => {
  test("install uses pacman -S as root", async () => {
    const { shell, calls, cmds } = mockShell();
    const p = aurGen(shell);
    await p.install([pkg("yay", ANY_VERSION_STRING, "aur")]);
    expect(cmds()).toEqual(["pacman -S --noconfirm yay"]);
    expect(calls[0]!.options.asRoot).toBe(true);
  });

  test("uninstall uses pacman -Rs as root", async () => {
    const { shell, cmds } = mockShell();
    const p = aurGen(shell);
    await p.uninstall(["yay"]);
    expect(cmds()).toEqual(["pacman -Rs --noconfirm yay"]);
  });

  test("checkInstallation probes with `which pacman`", async () => {
    const { shell, cmds } = mockShell();
    const p = aurGen(shell);
    await p.checkInstallation!();
    expect(cmds()).toEqual(["which pacman"]);
  });
});

describe("yay provider", () => {
  test("install uses yay -S (not as root)", async () => {
    const { shell, calls, cmds } = mockShell();
    const p = yayGen(shell);
    await p.install([pkg("google-chrome", ANY_VERSION_STRING, "yay")]);
    expect(cmds()).toEqual(["yay -S --noconfirm google-chrome"]);
    expect(calls[0]!.options.asRoot).toBeUndefined();
  });

  test("uninstall uses yay -Rs", async () => {
    const { shell, cmds } = mockShell();
    const p = yayGen(shell);
    await p.uninstall(["google-chrome"]);
    expect(cmds()).toEqual(["yay -Rs --noconfirm google-chrome"]);
  });

  test("update uses yay -Syu", async () => {
    const { shell, cmds } = mockShell();
    const p = yayGen(shell);
    await p.update(["google-chrome"]);
    expect(cmds()).toEqual(["yay -Syu --noconfirm google-chrome"]);
  });

  test("checkInstallation probes with `which yay`", async () => {
    const { shell, cmds } = mockShell();
    const p = yayGen(shell);
    await p.checkInstallation!();
    expect(cmds()).toEqual(["which yay"]);
  });
});

describe("cargo provider", () => {
  test("install omits --version for ANY_VERSION_STRING", async () => {
    const { shell, cmds } = mockShell();
    const p = cargoGen(shell);
    await p.install([pkg("ripgrep", ANY_VERSION_STRING, "cargo")]);
    expect(cmds()).toEqual(["cargo install ripgrep"]);
  });

  test("install pins with --version", async () => {
    const { shell, cmds } = mockShell();
    const p = cargoGen(shell);
    await p.install([pkg("ripgrep", "13.0.0", "cargo")]);
    expect(cmds()).toEqual(["cargo install ripgrep --version 13.0.0"]);
  });

  test("uninstall uses cargo uninstall", async () => {
    const { shell, cmds } = mockShell();
    const p = cargoGen(shell);
    await p.uninstall(["ripgrep"]);
    expect(cmds()).toEqual(["cargo uninstall ripgrep"]);
  });

  test("getInstalled parses `cargo install --list`", async () => {
    const { shell } = mockShell({
      "cargo install --list": {
        stdout:
          "ripgrep v13.0.0:\n    rg\ncargo-edit v0.11.9:\n    cargo-add\n    cargo-rm\n",
      },
    });
    const p = cargoGen(shell);
    const installed = await p.getInstalled();
    expect(installed).toEqual([
      { name: "ripgrep", provider: "cargo", version: "13.0.0" },
      { name: "cargo-edit", provider: "cargo", version: "0.11.9" },
    ]);
  });

  test("getInstalled returns empty for empty output", async () => {
    const { shell } = mockShell({ "cargo install --list": { stdout: "" } });
    const p = cargoGen(shell);
    expect(await p.getInstalled()).toEqual([]);
  });

  test("update with no packages reinstalls everything currently installed", async () => {
    const { shell, cmds } = mockShell({
      "cargo install --list": { stdout: "ripgrep v13.0.0:\n    rg\n" },
    });
    const p = cargoGen(shell);
    await p.update([]);
    expect(cmds()).toContain("cargo install --list");
    expect(cmds()).toContain("cargo install ripgrep");
  });
});

describe("bun provider", () => {
  // BUN_USER is hard-coded in the provider, so assert on the shape of the command
  // rather than the exact home path.
  test("install targets the global bun with @version and -E", async () => {
    const { shell, cmds } = mockShell();
    const p = bunGen(shell);
    await p.install([pkg("typescript", "5.9.3", "bun")]);
    expect(cmds()).toHaveLength(1);
    expect(cmds()[0]).toMatch(/\.bun\/bin\/bun install -g typescript@5\.9\.3 -E$/);
  });

  test("install uses @latest for ANY_VERSION_STRING", async () => {
    const { shell, cmds } = mockShell();
    const p = bunGen(shell);
    await p.install([pkg("@tailwindcss/cli", ANY_VERSION_STRING, "bun")]);
    expect(cmds()[0]).toMatch(/install -g @tailwindcss\/cli@latest -E$/);
  });

  test("install batches all packages into one command (avoids global package.json races)", async () => {
    const { shell, cmds } = mockShell();
    const p = bunGen(shell);
    await p.install([
      pkg("is-odd", ANY_VERSION_STRING, "bun"),
      pkg("left-pad", "1.2.0", "bun"),
    ]);
    expect(cmds()).toHaveLength(1);
    expect(cmds()[0]).toMatch(/install -g is-odd@latest left-pad@1\.2\.0 -E$/);
  });

  test("install with no packages shells out nothing", async () => {
    const { shell, cmds } = mockShell();
    const p = bunGen(shell);
    await p.install([]);
    expect(cmds()).toEqual([]);
  });

  test("uninstall uses `bun remove -g` with all packages", async () => {
    const { shell, cmds } = mockShell();
    const p = bunGen(shell);
    await p.uninstall(["typescript", "is-odd"]);
    expect(cmds()).toHaveLength(1);
    expect(cmds()[0]).toMatch(/\.bun\/bin\/bun remove -g typescript is-odd$/);
  });

  test("update uses `bun update -g`", async () => {
    const { shell, cmds } = mockShell();
    const p = bunGen(shell);
    await p.update(["typescript"]);
    expect(cmds()[0]).toMatch(/\.bun\/bin\/bun update -g typescript$/);
  });
});

describe("custom provider", () => {
  test("is a no-op that reports nothing installed", async () => {
    const { shell, cmds } = mockShell();
    const p = customGen(shell);
    await p.checkInstallation!();
    await p.install([pkg("whatever", ANY_VERSION_STRING, "custom")]);
    await p.uninstall(["whatever"]);
    await p.update(["whatever"]);
    expect(await p.getInstalled()).toEqual([]);
    expect(cmds()).toEqual([]); // never shells out
  });
});

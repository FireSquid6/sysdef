---
name: sysdef
description: >
  Use when the user wants to change what their machine has installed or configured through
  sysdef — their declarative, git-tracked system manager living at `~/sysdef`. Triggers:
  "add X to my system", "install X with sysdef", "remove X", "manage/add a dotfile", "update
  my sysdef config", "sync my packages", "add a package to my <module> module", "why is
  sysdef warning about untracked packages". The workflow is always: edit declarations under
  `~/sysdef` (a module's `packages`/`files`/`directories`, or `config.yaml`), then run
  `sysdef sync`. Covers the install layout, `config.yaml`, the Module shape, adding
  packages/dotfiles, the CLI (`sync`, `update`, `update-lockfile`, `list-installed`,
  `providers`, `track`), providers, and the lockfile/trackfile. Does NOT cover editing the
  sysdef engine source itself (that's normal TypeScript work in the sysdef source repo); use
  this skill for changing a *machine's* configuration, not for hacking on the tool.
---

# Updating a sysdef installation

Sysdef is a declarative, provider-agnostic package & dotfile manager (Nix-lite for any
package manager). A machine's configuration lives in a single directory — by default
`~/sysdef` — that is meant to be committed to git. You declare the packages, files, and
directories you want; `sysdef sync` makes the system match.

## The golden rule

**Never install packages or place dotfiles directly.** Don't run `pacman -S`, `apt
install`, `npm i -g`, or `cp file ~/.config/...`. Instead:

1. Edit the declaration in `~/sysdef` (add the package to a module, add the file to a
   module, etc.).
2. Run `sysdef sync -d` (dry run) to preview.
3. Run `sysdef sync` to apply.

Installing out-of-band defeats the point: sysdef won't know about it, and it isn't captured
in the config the user commits.

## Locating the installation

- Default root is `~/sysdef`. It can be overridden by the `SYSDEF_ROOT_DIR` env var.
- The `sysdef` command is on `PATH` (the launcher is `~/sysdef/bin/sysdef`, which runs a
  bundled Bun). If `sysdef` isn't found, invoke `~/sysdef/bin/sysdef` directly.
- The engine *source* is a separate repo (e.g. `~/source/sysdef`) — only relevant when the
  user wants to modify sysdef itself, not their configuration.

## Layout of `~/sysdef`

```
~/sysdef/
├── config.yaml          # which providers + modules are active, and global variables
├── modules/*.ts         # module definitions (what to install / link)
├── providers/*.ts       # package-manager backends
├── dotfiles/            # actual dotfile contents you symlink from modules
├── sysdef-lock.json     # auto-generated: what sysdef installed + at what version
├── sysdef-track.json    # auto-generated: packages you marked "untracked" (per-machine)
└── bin/sysdef           # launcher (bundled Bun)
```

A module or provider file **only takes effect once its basename is listed in
`config.yaml`.** Dropping a file into `modules/` is not enough.

## config.yaml

Three top-level keys, all required:

```yaml
providers:          # provider basenames to activate (from providers/)
  - arch-official
modules:            # module basenames to activate (from modules/)
  - development
  - applications
variables:          # a MAP (key: value), not a list — global variables
  HOMEDIR: "/home/me"
```

`variables` is a map. Writing it as a YAML list (`- HOMEDIR: ...`) is invalid and will fail
to load.

## Editing a module (the common task)

A module is a `.ts` file default-exporting a function that returns the module object:

```ts
import type { ModuleGenerator } from "../sysdef-src/sysdef";

const m: ModuleGenerator = () => {
  return {
    name: "development",
    variables: { "HOME": "/home/me" },
    packages: {
      "arch-official": ["git", "neovim", "docker"],
      "bun": ["typescript:5.9.3"],
    },
    directories: {
      "{HOME}/.config/nvim": "./neovim",       // symlink a whole dir
    },
    files: {
      "{HOME}/.gitconfig": "./dotfiles/gitconfig",   // symlink a file
    },
  };
};

export default m;
```

- **`packages`** — a map of provider name → list of package specs. A spec is either
  `"name"` (any version; it gets pinned in the lockfile after the first sync) or
  `"name:version"` (everything after the first colon is the version).
- **`files`** — destination path → source. If the value is a **string**, it's a path
  relative to `~/sysdef` and gets **symlinked**. If it's a **function**
  `(vars) => string`, its return value is written as the file's **contents** (a generated
  file).
- **`directories`** — destination → source dir (relative to `~/sysdef`), symlinked.
- **`variables`** — per-module overrides, layered on top of `config.yaml` variables.
  Reference them in paths/content with `{NAME}`.

### To add a package

Add its name to the right provider's array in an active module (e.g. append `"htop"` to
`packages["arch-official"]` in a `system-utilities` module). Then dry-run and sync. Confirm
the provider is one that's active in `config.yaml` (if you add a `"bun"` entry but `bun` is
commented out under `providers`, it won't install).

### To add a dotfile

1. Put the file's contents under `~/sysdef/dotfiles/` (or a config subdir), e.g.
   `dotfiles/foo.conf`.
2. Map it in a module's `files`: `"{HOME}/.config/foo/foo.conf": "./dotfiles/foo.conf"`.
3. Dry-run, then sync. (For a whole directory, use `directories` instead.)

## CLI commands

- **`sysdef sync`** — the main action: links files, diffs & installs/removes packages,
  updates the lockfile. Flags:
  - `-d, --dry-run` — preview only, runs nothing. **Always do this first.**
  - `-s, --safe` — install but never remove (safe for testing).
  - `-f, --files-only` — only link files, skip packages.
- **`sysdef list-installed [provider]`** — what sysdef providers currently see installed.
- **`sysdef providers`** — check each active provider's installation.
- **`sysdef update [provider] [packages...]`** — upgrade managed packages to newest
  versions and re-pin the lockfile.
- **`sysdef update-lockfile`** — snapshot current versions into the lockfile without
  installing/removing anything (bookkeeping after out-of-band changes).
- **`sysdef track ignore|ignore-all|unignore|list`** — manage the "untracked packages"
  warning (below).

## The untracked-packages warning

System providers (`arch-official`, `apt`, `dnf`) report the **entire** OS through their
`getInstalled()`. So `sync` warns about packages that are installed but not declared in any
module. **Sysdef never removes these** — it only removes packages it installed itself
(recorded in `sysdef-lock.json`). To silence the noise for packages the user will never
manage with sysdef:

- `sysdef track ignore-all arch-official` — ignore everything currently unmanaged.
- `sysdef track ignore <provider> <pkg>...` — ignore specific packages.
- `sysdef track list` / `sysdef track unignore <provider> <pkg>...` — inspect / undo.

Adding a package to a module (making it managed) automatically un-ignores it on next sync.

## Providers

Built-ins: `apt`, `arch-official`, `aur`, `dnf`, `bun`, `npm`, `pipx`, `go`, `cargo`, and
`custom` (a stub you implement for things no package manager covers). Only the ones listed
under `providers:` in `config.yaml` are active. Package spec conventions differ per provider
(e.g. arch-official rejects version pins; dnf uses `name-version`), so match the style
already used in the module you're editing.

## Guardrails for agents

- **Dry-run first, every time:** show the user `sysdef sync -d` output before applying.
- **`sync` is interactive:** it prompts for the sudo password once and asks for
  confirmation before installing/removing. Prefer letting the user run the final
  `sysdef sync` themselves, or make clear you're about to run something that needs their
  password and confirmation. Don't try to script around the sudo prompt.
- **Only edit declarations**, not the live system. Adding to a module + syncing is the
  correct path; `pacman -S`/`apt install` is not.
- **Removing a package** = delete it from the module and sync (sysdef will offer to
  uninstall it, since it's in the lockfile). Use `-s/--safe` if you want to avoid removals.
- **Commit afterward** if the user keeps `~/sysdef` in git — the whole point is a tracked,
  reproducible config. Ask before committing.

For engine internals (how sync/providers/variables actually work), see the sysdef source
repo and its docs site.

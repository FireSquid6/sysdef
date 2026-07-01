# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What sysdef is

Sysdef is a declarative, provider-agnostic package/dotfile manager (think Nix-lite for any package manager). It is **not installed as an npm binary** — the TypeScript in `package/` is copied verbatim onto the user's machine (into `~/sysdef` by default) alongside a bundled Bun runtime, and run from there. This "copy the source onto the machine and let the user hack it" model is the core design constraint: keep the codebase self-contained and dependency-light, since users edit it in place.

## Repository layout

- `package/` — the core codebase that gets installed. Its subdirs are copied wholesale into a user install by `scripts/initialize-workspace.sh`:
  - `sysdef-src/` — all application logic
  - `providers/` — one file per package-manager backend (apt, yay, aur, arch-official, cargo, bun, custom)
  - `bin/sysdef`, `test/`, `package.json`, `tsconfig.json`
- `starter/` — files seeded into a *fresh* user install (`config.yaml`, an example module, the `bin/sysdef` launcher shim)
- `scripts/` — `clone-and-initialize.sh` (curl-piped installer) → `initialize-workspace.sh` (builds `~/sysdef`, installs Bun)
- `docs/` — separate Astro site (deployed to Vercel), its own `package.json`

## Commands

Everything runs on **Bun** (no build step — TS is executed directly). Work from inside `package/`:

```bash
bun install                       # install deps (@commander-js, yaml)
bun test                          # run the whole suite
bun test test/package-set.test.ts # single file
bun test -t "should replace single variable"  # single test by name
bun run bin/sysdef <command>      # invoke the CLI (see below)
```

Docs site: `cd docs && bun install && bun run dev`.

There is no linter or typecheck script; rely on `bun test` and `tsc` semantics from `tsconfig.json` (strict, `noUncheckedIndexedAccess`).

### CLI commands (defined in `sysdef-src/index.ts`)
- `sync` — the main action: link files, diff & install/remove packages, update lockfile. Flags: `-d/--dry-run`, `-s/--safe` (install only, never remove), `-f/--files-only`.
- `update-lockfile` — snapshot current system versions into `sysdef-lock.json`
- `providers` — run each provider's `checkInstallation()`
- `list-installed [provider]`

## Architecture

**Entry & root dir.** `bin/sysdef` and `entrypoint.ts` set `SYSDEF_ROOT_DIR` to the install directory, then call the Commander CLI in `index.ts`. Everything (config, lockfile, modules, providers, variables) is resolved relative to that root. In a real install the root is `~/sysdef`; the `package/` dir itself is not a runnable install (it has `example-modules/`, not `modules/`), so full `sync` runs happen on-machine — **local development is driven by the test suite**, not by running `sync`.

**Config-driven loading.** `config.yaml` at the root lists which `providers` and `modules` to activate (by basename) plus global `variables`. `loaders.ts` dynamically `import()`s each matching `.ts` file from `<root>/providers/`, `<root>/modules/`, and optional `<root>/variables.ts`. Each file **default-exports a generator function** that receives a `Shell` and returns the object:
- `ProviderGenerator → Provider` (`install`/`uninstall`/`getInstalled`/`update`, optional `checkInstallation`)
- `ModuleGenerator → Module` (`packages` per-provider, `files`, `directories`, `variables`)

**Modules** declare desired state. `packages` is `Record<providerName, string[]>` where an entry is `"name"` or `"name:version"`. `files` maps a destination path to either a string (symlink a file relative to root) or a `(VariableStore) => string` function (generate file contents). Paths run through `VariableStore.fillIn`, which substitutes `{VAR}` tokens.

**Sync pipeline** (`sysdef.ts`): `syncFiles` → `getPackageList` (flattens modules, resolves versions from lockfile, errors on version conflicts across modules) → `syncPackages` (per provider, diffs `getInstalled()` against requested using `PackageSet`, prompts before install/remove) → `runEvents` (stubbed) → `updateLockfile`.

**Version sentinel.** `ANY_VERSION_STRING = "_*_"` means "any version" — used when no explicit version and none pinned in the lockfile. `versionMatches` and `PackageSet.hasAnyVersion` treat it as a wildcard.

**Lockfile** (`sysdef-lock.json`, `lockfile.ts`) — nested `provider → package → version` map, JSON on disk.

**Side-effect abstractions enable `--dry-run`:**
- `Shell` type: `defaultShell` (real `Bun.spawn`, supports `asRoot` via sudo) vs `dryShell` (prints "Would run"). Providers receive one of these — never call subprocesses directly.
- `Filesystem` (`connections.ts`): `normalFilesystem`, `dryFilesystem`, `confirmationFilesystem`.

**Conventions specific to this codebase:**
- `errorOut(msg)` is the panic function — prints and `process.exit(1)`. Preferred over silent failure throughout.
- Validation uses the **hand-rolled `v` namespace** in `validation.ts` (Zod-like combinators) rather than an external lib — keep it dependency-free.
- Adding a provider = drop a new `providers/<name>.ts` default-exporting a `ProviderGenerator`; it becomes usable once listed in a `config.yaml`. Provider files may hard-code machine-specific paths (see `providers/bun.ts`'s `BUN_USER`) since users edit them locally.

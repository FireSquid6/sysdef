# sysdef end-to-end tests

These tests spin up real containers, lay down a real sysdef install (the actual
`sysdef-src/` + `providers/` copied verbatim, just like a user's machine), and
drive real package-manager operations through `sysdef sync` and the providers.

They are intentionally **not** named `*.test.ts`, so a normal `bun test` (the
unit suite) skips them. Run them explicitly:

```bash
bun run test:e2e                     # all providers
bun test ./test-e2e/bun.e2e.ts       # one provider
```

## Requirements

- A working Docker daemon with network access. Images are built on first run
  (Debian, Rust, Arch base images) and bundle `bun` plus the target toolchain.
- Tests auto-skip (not fail) when Docker is unavailable.

## What each file covers

| File | Env | Approach | Capabilities |
|------|-----|----------|-------------|
| `bun.e2e.ts` | Debian | full `sync` | fresh install, remove, add+remove, **specific version**, **update/change version**, idempotency |
| `cargo.e2e.ts` | Rust | full `sync` | fresh + **specific version**, **update**, add+remove, remove, idempotency |
| `apt.e2e.ts` | Debian | `sync --safe` + direct provider driver | fresh (full pipeline), remove, add+remove, specific version, update path, getInstalled |
| `arch-official.e2e.ts` | Arch | `sync --safe` + driver | fresh (full pipeline), idempotency, add+remove, remove, update path, getInstalled |
| `aur.e2e.ts` | Arch | driver | fresh, remove, add+remove, update path, getInstalled |
| `yay.e2e.ts` | Arch | driver (pacman-backed `yay` shim) | checkInstallation, fresh, remove, add+remove, update path, getInstalled |
| `sysdef-files.e2e.ts` | Debian | `sync -f` | dotfile symlink, generated file w/ variables, directory link, idempotency |

## Why two approaches

`bun` and `cargo` manage an **isolated namespace** (bun globals; cargo-installed
crates), so a full `sync` — which removes anything not declared — is safe and we
run the complete pipeline including removals and version changes.

`apt`, `pacman`, and `yay`/`aur` report the **entire OS** from `getInstalled()`,
so a full non-`--safe` `sync` would try to remove the base system. For those we
run `sync --safe` to prove the install pipeline on a real system, and drive the
provider methods directly (via `test-e2e/harness.ts`'s `driver()`, which loads
the real provider with the real shell) for the remove/update capabilities.

## Notes / known limitations

- Official `apt`/`pacman` repos generally expose only a single version of a
  package, so the deterministic "pin an arbitrary old version" and "upgrade
  between two versions" cases are proven by the `bun` and `cargo` suites
  (immutable registry versions). apt still verifies pinning to an available
  version.
- The `aur` provider's `install()` currently delegates to `pacman -S` (its
  `buildAndInstallFromAUR` helper is not wired in), so `aur.e2e.ts` tests that
  real code path with official packages. A genuine AUR build (makepkg as a
  non-root user + network to the AUR) is out of scope for the default suite.
- Installing a real `yay` requires an AUR build; `yay.e2e.ts` uses a documented
  pacman-backed `yay` shim to validate the provider's command construction and
  `yay -Qe` parsing against real package state.

# sysdef end-to-end tests

These tests spin up real containers, lay down a real sysdef install (the actual
`sysdef-src/` + `providers/` copied verbatim, just like a user's machine), and
drive real package-manager operations through `sysdef sync` and the providers.

They are intentionally **not** named `*.test.ts`, so a normal `bun test` (the
unit suite) skips them. Run them explicitly:

```bash
bun run test:e2e                     # all providers (except the gated AUR build)
bun test ./test-e2e/bun.e2e.ts       # one provider
SYSDEF_E2E_AUR=1 bun test ./test-e2e/aur.e2e.ts   # include the real AUR build
```

## Requirements

- A working Docker daemon with network access. Images are built on first run
  (Debian, Rust, Arch, Node, Python, Go, Fedora base images) and bundle `bun`
  plus the target toolchain.
- Tests auto-skip (not fail) when Docker is unavailable.

## What each file covers

| File | Env | Approach | Capabilities |
|------|-----|----------|-------------|
| `bun.e2e.ts` | Node/Debian | full `sync` | fresh, remove, add+remove, **specific version**, **update**, idempotency |
| `npm.e2e.ts` | Node | full `sync` | fresh, remove, add+remove, **specific version**, **update**, idempotency |
| `pipx.e2e.ts` | Python | full `sync` | fresh, remove, add+remove, **specific version**, **update**, idempotency |
| `go.e2e.ts` | Go | full `sync` | fresh + **specific version**, **update**, add+remove, remove |
| `cargo.e2e.ts` | Rust | full `sync` | fresh + **specific version**, **update**, add+remove, remove, idempotency |
| `dnf.e2e.ts` | Fedora | full `sync` | fresh, **managed removal**, add+remove, specific version, idempotency |
| `apt.e2e.ts` | Debian | `sync --safe` + driver | fresh (full pipeline), remove, add+remove, specific version, update path, getInstalled |
| `arch-official.e2e.ts` | Arch | `sync --safe` + driver | fresh (full pipeline), idempotency, add+remove, remove, update path, getInstalled |
| `aur.e2e.ts` | Arch | driver (as non-root `builder`) | getInstalled (always); real AUR build/uninstall (gated by `SYSDEF_E2E_AUR`) |
| `managed-set.e2e.ts` | Debian | full `sync` | proves removal only touches sysdef-managed packages; checkInstallation failure aborts |
| `update-command.e2e.ts` | Node | `sysdef update` | the `update` CLI upgrades a managed package + refreshes the lockfile |
| `install-failure.e2e.ts` | Debian/Arch | `sync` | failed installs abort cleanly (no lockfile written) |
| `sysdef-files.e2e.ts` | Debian | `sync -f` / `sync` | dotfile symlink, generated file, directory link, idempotency, `onEverySync` events |

## The managed-set model

sysdef only removes packages **it** installed — tracked in the lockfile. So a
full `sync` (even without `--safe`) is safe on system package managers: it never
removes packages the user installed by other means. `managed-set.e2e.ts` proves
this by installing a package outside sysdef and confirming a full sync leaves it
alone while still removing packages sysdef manages.

Because of this, `bun`, `npm`, `pipx`, `go`, `cargo`, and `dnf` run the full
`sync` matrix (including removals). `apt` and `arch-official` still use
`sync --safe` for the install pipeline and the provider `driver()` for the
remove/update cases, purely to keep those suites focused and fast.

## Deterministic version cases

Immutable-registry providers (`bun`/npm, `npm`, `pipx`, `go`, `cargo`) exercise
the real "pin an old version" and "upgrade between two versions" cases with fixed
versions (e.g. `left-pad` 1.2.0 → 1.3.0, `rsc.io/2fa` v1.2.0 → v1.3.0). `apt`,
`arch-official`, and `dnf` only carry the current repo version, so:

- `apt`/`dnf` verify pinning to a dynamically-resolved available version.
- `arch-official`/`aur` **reject** an arbitrary version pin with a clear error
  (verified in `test/exit-paths.test.ts`).

## AUR builds

The `aur` provider clones and builds packages with `makepkg`, which refuses to
run as root. The arch image includes a non-root `builder` user with passwordless
sudo; the real build test runs as that user and is gated behind `SYSDEF_E2E_AUR=1`
(it uses a prebuilt `*-bin` package to avoid compilation). The always-on aur test
just checks `getInstalled` on a clean system.

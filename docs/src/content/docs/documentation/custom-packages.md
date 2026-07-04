---
title: Custom Packages
description: Manage packages that aren't part of any package manager
sidebar:
    order: 600
---

Not everything you want to manage comes from a package manager. Maybe it's a binary you
download from a GitHub release, something you clone and build yourself, or a tool with its
own bespoke installer. The `custom` provider is a stub for exactly this: a provider you copy
and fill in with your own install/remove logic, so these packages can be declared in modules
and diffed on every sync just like any other.

## The `custom` provider

Sysdef ships a `custom` provider (`providers/custom.ts`) whose methods are all empty
no-ops. On its own it does nothing—it's a template. Copy it (or edit it in place, since your
sysdef directory is yours to hack) and implement the methods for whatever you're managing:

```ts
import { type ProviderGenerator, type Shell, type PackageInfo } from "../sysdef-src/sysdef";

const provider: ProviderGenerator = (run: Shell) => {
  return {
    name: "custom",

    async install(packages: PackageInfo[]) {
      for (const pkg of packages) {
        // however you install `pkg.name` (download, clone+build, run an installer, ...)
        await run(`./scripts/install-${pkg.name}.sh`, { displayOutput: true });
      }
    },

    async uninstall(names: string[]) {
      for (const name of names) {
        await run(`./scripts/uninstall-${name}.sh`, { displayOutput: true });
      }
    },

    async getInstalled(): Promise<PackageInfo[]> {
      // report what's currently installed so sync can diff against your modules.
      // return [] if nothing is installed yet.
      return [];
    },

    async update(names: string[]) {
      // optional: re-install / pull newest for these (or all if names is empty)
    },

    async checkInstallation() {
      // optional: throw if a prerequisite is missing
    },
  };
};

export default provider;
```

Then activate it in `config.yaml` and declare packages against it in a module:

```yaml
# config.yaml
providers:
  - custom
```

```ts
// modules/tools.ts
packages: {
  "custom": ["my-tool", "some-binary"],
}
```

## Why `getInstalled()` matters most

Sync decides what to install and remove by diffing your module declarations against what
`getInstalled()` reports (see [Providers](/documentation/providers)). For a custom provider
this is the part you must get right:

- If `getInstalled()` always returns `[]`, sysdef will think nothing is installed and call
  `install()` on **every** sync.
- Whatever names `getInstalled()` returns must match the names you write in your modules, or
  sysdef won't recognize a package as already present.

A simple, robust approach is to check for a marker on disk—a binary in `~/.local/bin`, a
directory, or a small manifest file your `install()` writes—and build the `PackageInfo[]`
from that.

## Alternatives

If the thing you want is really just an AUR package, a `go install` target, a cargo crate,
etc., prefer the [built-in provider](/documentation/providers#built-in-providers) for it
rather than reimplementing that logic in `custom`. Reach for `custom` when nothing else
fits.

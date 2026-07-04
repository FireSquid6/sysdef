---
title: Events
description: Run commands on every sync with onEverySync
sidebar:
    order: 500
---

Sometimes declaring files and packages isn't enough—you need to *do* something after a
sync, like reloading a service once its config file changes or rebuilding a cache. Modules
can hook into the sync with `onEverySync`.

## `onEverySync`

A module may define an optional `onEverySync` hook. It runs once per `sysdef sync`, after
files have been linked and packages have been installed/removed:

```ts
export interface Module {
  // ...
  readonly onEverySync?: (s: Shell) => Promise<void>;
}
```

The hook receives the same `Shell` function providers use, so it obeys dry-run mode: during
`sysdef sync --dry-run` it's handed `dryShell` (which only logs the commands it *would*
run) instead of actually executing anything.

## Example

```ts
import type { ModuleGenerator } from "../sysdef-src/sysdef";

const generator: ModuleGenerator = (shell) => {
  return {
    name: "desktop",
    variables: {},
    packages: {
      "arch-official": ["waybar"],
    },
    directories: {
      "{HOMEDIR}/.config/waybar": "./config/waybar",
    },
    files: {},
    // reload waybar so it picks up the config we just linked
    onEverySync: async (shell) => {
      await shell("killall -SIGUSR2 waybar", {
        throwOnError: false,   // fine if it isn't running yet
        displayOutput: true,
      });
    },
  };
};

export default generator;
```

Other common uses:

```ts
onEverySync: async (shell) => {
  // restart a user service after its unit/config changed
  await shell("systemctl --user restart example.service", { displayOutput: true });

  // run a setup script that lives in your sysdef directory
  await shell("bash ./scripts/post-sync.sh", { displayOutput: true });

  // something that needs root — use asRoot, never a hard-coded sudo
  await shell("fc-cache -f", { asRoot: true, displayOutput: true });
}
```

## Notes

- The hook runs on **every** sync, so make it idempotent—it should be safe to run
  repeatedly. Reloading a service or refreshing a cache is fine; one-time bootstrap steps
  are not a good fit.
- It runs even when there were no package or file changes on that particular sync.
- Use `throwOnError: false` for commands that may legitimately fail (for example signalling
  a program that isn't running yet); otherwise a non-zero exit will abort the sync.
- For running privileged commands, pass `{ asRoot: true }` rather than prefixing `sudo`—see
  [Providers](/documentation/providers#running-commands-as-root).

See [Modules](/documentation/modules) for the rest of the module shape.

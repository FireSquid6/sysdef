# sysdef
A declarative experience for any package manager.

# Installation
Sysdef does not work like standard programs--it's meant to be as hackable as possible. The typescript codebase is installed directly onto your machine with a [bun](https://bun.sh) installation next to it. You can run:

```bash
# TODO
```

This will get you a basic installation in `~/sysdef`. The `bin` directory will contain the `sysdef` executable and an installation of `bun`. You can see a couple of useful bash scripts for managing your installation (updating bun, updating the source, etc.) in `scripts`. A git repo is also initialized, meaning its easy to sync your config across multiple machines.

# Usage
Sysdef is programmatically configured in typescript files. This means that you can actually get editor autocomplete for it using the typescript language server for neovim, vscode, or whatever you use.

# Repo
The repo contains the following directories:
- `package` - the core package for sysdef. Everything in the `src` directory is actually copied over into your installation of sysdef 
- `example-workspace` - an example workspace to toy around with for development
- `providers` - the providers directory for every provider. If you make your own provider, put it here!

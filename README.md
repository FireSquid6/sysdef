# [sysdef](https://sysdef.vercel.app/)

```text
  ___  _   _  ___  ___   ___  ___
 / __|| | | |/ __||   \ | __|| __|
 \__ \| |_| |\__ \| |) || _| | _|
 |___/ \__, ||___/|___/ |___||_|
       |___/
       ⟳ keep systems in sync
```

A declarative experience for any package manager.

Sysdef is currently very experimental. Make backups before you use it. Not my fault if you brick your system[^1].

# Installation
Sysdef does not work like standard programs--it's meant to be as hackable as possible. The typescript codebase is installed directly onto your machine with a [bun](https://bun.sh) installation next to it. You can run:

```bash
curl -sL https://raw.githubusercontent.com/FireSquid6/sysdef/refs/heads/main/scripts/clone-and-initialize.sh | bash
```

This will get you a basic installation in `~/sysdef`. The `bin` directory will contain the `sysdef` executable and an installation of `bun`. 

# Usage
You can learn more by visiting the [sysdef docs](https://sysdef.vercel.app).

# Repo
The repo contains the following directories:
- `package` - the core package for sysdef. Everything in the `src` directory is actually copied over into your installation of sysdef 
- `example-workspace` - an example workspace to toy around with for development
- `providers` - the providers directory for every provider. If you make your own provider, put it here!

# To Do
- [ ] custom packages
- [ ] events
- [ ] auto config generator
- [ ] e2e test suite with docker
- [ ] split yay into using pacman + aur integration
- [x] docs
- [ ] make the base script execute with sudo


[^1]: Broken systems while developing counter: 2

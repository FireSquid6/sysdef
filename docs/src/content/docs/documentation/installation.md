---
title: Installation 
description: A guide to installing sysdef
sidebar:
    order: 200
---


You can easily install sysdef by running the commands:

```
git clone https://github.com/firesquid6/sysdef sysdef-codebase
sysdef-codebase/scripts/initialize-workspace.sh
```

This will install the latest version of Bun as well as initialize a sysdef workspace in `~/sysdef`. Add the `bin` directory inside of sysdef to your path to get access to the `sysdef` command everywhere, or otherwise just run `./bin/sysdef` from the workspace. Once you do that, you should see command output that looks something like:


```
Usage: sysdef [options] [command]

The hackable computer configuration system

Options:
  -h, --help                 display help for command

Commands:
  sync [options]             Sync all packages, modules, and files
  providers                  Subcommand to list all of the installed providers
  list-installed [provider]  list the installed packages from an optional provider
  hello

```

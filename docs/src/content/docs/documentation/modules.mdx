---
title: Modules 
description: A guide to using modules
sidebar:
    order: 300
---

Modules are the core building blocks of sysdef that define what packages, files, directories, and configurations should be managed on your system. Each module is a TypeScript file in the `modules/` directory that exports a function returning a Module object.

## Module Structure

A module is defined by the `Module` interface in `sysdef.ts:188`:

```ts
export interface Module {
  readonly name: string;
  readonly variables: Record<string, string>;
  readonly packages: Record<string, string[]>;
  readonly directories: Record<string, string>;
  readonly files: Record<string, File>;
  readonly onEverySync?: (s: Shell) => Promise<void>;
}
```

## Creating a Module

Module files must export a default function that takes a `Shell` function and returns a `Module` object:

```ts
import type { ModuleGenerator } from "../sysdef-src/sysdef";

const generator: ModuleGenerator = (shell) => {
  return {
    name: "example",
    variables: {
      "EXAMPLE_VAR": "example_value"
    },
    packages: {
      "yay": ["firefox", "git"],
      "apt": ["curl", "wget"]
    },
    directories: {
      "{HOMEDIR}/.config/example": "./config/example"
    },
    files: {
      "{HOMEDIR}/.bashrc": "./dotfiles/bashrc",
      "{HOMEDIR}/.vimrc": (variables) => {
        return `" Generated vimrc for ${variables.get("USER")}\nset number\n`;
      }
    },
    onEverySync: async (shell) => {
      await shell("echo 'Module synced!'", { displayOutput: true });
    }
  };
};

export default generator;
```

## Module Properties

### name
A unique identifier for your module. Used in logging and error messages.

### variables
Key-value pairs that can be used in file paths and file content generation. These variables:
- Override global variables from `config.yaml` with the same name
- Are scoped to this module only
- Can be referenced using `{VARIABLE_NAME}` syntax in file paths

### packages
Maps provider names to arrays of package specifications. Package specifications can be:
- **Simple names**: `"firefox"` - uses any version (or lockfile version)
- **Versioned**: `"firefox:115.0"` - requires specific version
- **Complex versions**: `"node:>=18.0.0"` - version constraints (provider-dependent)

Example:
```ts
packages: {
  "yay": ["firefox", "git:2.42.0", "nodejs:>=18"],
  "apt": ["curl", "wget"],
  "bun": ["typescript", "@types/node:20.8.0"]
}
```

### directories
Maps destination paths to source paths for directory symlinks. Both paths support variable substitution:

```ts
directories: {
  "{HOMEDIR}/.config/nvim": "./config/nvim",
  "/etc/example": "./system-config"
}
```

During sync, sysdef creates symlinks from the destination to the source (resolved relative to your sysdef root directory).

### files
Maps destination file paths to either:

1. **String paths** (for symlinks): `"{HOMEDIR}/.bashrc": "./dotfiles/bashrc"`
2. **Generator functions** (for generated content): 

```ts
files: {
  "{HOMEDIR}/.gitconfig": (variables) => `
[user]
    name = ${variables.get("GIT_USER_NAME")}
    email = ${variables.get("GIT_USER_EMAIL")}
[core]
    editor = nvim
`,
  "{HOMEDIR}/.profile": "./dotfiles/profile"
}
```

The `File` type is defined in `sysdef.ts:185` as:
```ts
export type File = string | ((v: VariableStore) => string);
```

### onEverySync (optional)
An async function that runs after files and packages are synced. Receives a `Shell` function for executing commands:

```ts
onEverySync: async (shell) => {
  // Restart a service after configuration changes
  await shell("systemctl --user restart example.service", { 
    displayOutput: true 
  });
  
  // Run custom setup scripts
  await shell("bash ./scripts/post-sync.sh", { 
    displayOutput: true 
  });
}
```

## Module Loading

Modules are loaded by the `loadModules()` function in `loaders.ts:8`. The loading process:

1. Scans the `modules/` directory for files with valid extensions (`.ts`, `.tsx`, `.js`, `.jsx`)
2. Only loads modules listed in `config.yaml`'s `modules` array
3. Dynamically imports each module file
4. Calls the default exported function with the appropriate `Shell` implementation
5. Collects all returned `Module` objects

## Variable Scoping

Variables follow a hierarchical scoping system:

1. **Global variables** from `config.yaml` are available to all modules
2. **Module variables** override global variables within that module
3. **Variable substitution** happens using `{VARIABLE_NAME}` syntax
4. **VariableStore** (defined in `sysdef.ts:24`) handles the substitution logic

Example with variable precedence:
```yaml
# config.yaml
variables:
  EDITOR: nano
  HOMEDIR: /home/user
```

```ts
// modules/dev.ts
return {
  name: "dev",
  variables: {
    EDITOR: "nvim"  // Overrides global EDITOR for this module
  },
  files: {
    "{HOMEDIR}/.bashrc": (vars) => `export EDITOR=${vars.get("EDITOR")}`
    // Will use "nvim", not "nano"
  }
};
```

## Package Version Management

Package versions are managed through:

1. **Explicit versions** in module definitions
2. **Lockfile** (`sysdef-lock.json`) for reproducible builds  
3. **Version conflict detection** - sysdef errors if modules request incompatible versions

The `getPackageList()` function in `sysdef.ts:204` handles version resolution and conflict detection.

## Error Handling

Common module errors:
- **Loading errors**: Syntax errors, missing exports
- **Version conflicts**: Multiple modules requesting different versions of the same package
- **Missing variables**: Using undefined variables in file paths or content
- **Invalid file paths**: Malformed destination paths

All errors use the `errorOut()` function for consistent error reporting and process termination.

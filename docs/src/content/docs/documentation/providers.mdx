---
title: Providers
description: Understand and build out providers
sidebar:
    order: 400
---

Providers are sysdef's interface to package managers. They abstract away the differences between various package management systems (yay, apt, bun, etc.) and provide a unified way for modules to declare package dependencies.

## Provider Interface

A provider is defined by the `Provider` interface in `sysdef.ts:169`:

```ts
export interface Provider {
  readonly name: string;
  install: (packages: PackageInfo[]) => Promise<void>;
  uninstall: (packages: string[]) => Promise<void>;
  getInstalled: () => Promise<PackageInfo[]>;
  update: (packages: string[]) => Promise<void>;
  checkInstallation?: () => Promise<void>;
}
```

Where `PackageInfo` is defined in `sysdef.ts:102`:

```ts
export interface PackageInfo {
  name: string;
  version: string;
  provider: string;
}
```

## Creating a Provider

Provider files must export a default function that takes a `Shell` function and returns a `Provider` object:

```ts
import type { ProviderGenerator, PackageInfo } from "../sysdef-src/sysdef";

const generator: ProviderGenerator = (shell) => {
  return {
    name: "example-package-manager",
    
    async install(packages: PackageInfo[]) {
      for (const pkg of packages) {
        const spec = pkg.version === "_*_" ? pkg.name : `${pkg.name}@${pkg.version}`;
        await shell(`example-pm install ${spec}`, { displayOutput: true });
      }
    },
    
    async uninstall(packageNames: string[]) {
      for (const name of packageNames) {
        await shell(`example-pm remove ${name}`, { displayOutput: true });
      }
    },
    
    async getInstalled(): Promise<PackageInfo[]> {
      const result = await shell("example-pm list --installed --json", {});
      const packages = JSON.parse(result.stdout);
      
      return packages.map((pkg: any) => ({
        name: pkg.name,
        version: pkg.version,
        provider: "example-package-manager"
      }));
    },
    
    async update(packageNames: string[]) {
      for (const name of packageNames) {
        await shell(`example-pm update ${name}`, { displayOutput: true });
      }
    },
    
    async checkInstallation() {
      await shell("which example-pm", { throwOnError: false });
    }
  };
};

export default generator;
```

## Provider Methods

### install(packages)
Installs the specified packages. Receives an array of `PackageInfo` objects containing:
- `name`: Package name
- `version`: Specific version or `_*_` for any version
- `provider`: Provider name (for context)

Implementation should handle version specifications appropriately for the underlying package manager.

### uninstall(packageNames)
Removes packages by name. Receives an array of package names as strings.

### getInstalled()
Returns all packages currently installed through this provider. Must return `PackageInfo[]` with accurate name, version, and provider fields.

This method is crucial for:
- Determining what needs to be installed/removed during sync
- The `sysdef list-installed` command
- Updating the lockfile with current versions

### update(packageNames)
Updates specified packages to their latest versions. Optional functionality depending on the package manager's capabilities.

### checkInstallation() (optional)
Verifies that the provider's underlying package manager is properly installed and configured. Called by:
- `sysdef sync` before package operations
- `sysdef providers` command for status checking

Should throw an error if the package manager is not available or misconfigured.

## Shell Integration

Providers receive a `Shell` function that provides a consistent interface for executing commands:

```ts
type Shell = (s: string, options: ShellOptions) => Promise<ShellResult>;

interface ShellOptions {
  throwOnError?: boolean;    // Default: true - throw on non-zero exit
  stdin?: string;           // Input to pipe to the command
  displayOutput?: boolean;  // Show output in real-time
}

interface ShellResult {
  code: number;     // Exit code
  stdout: string;   // Standard output
}
```

The shell function handles:
- **Dry-run mode**: When `--dry-run` is used, providers get `dryShell` which only logs commands
- **Error handling**: Throws exceptions on command failures (unless `throwOnError: false`)
- **Output capture**: Collects stdout for parsing package lists

Example shell usage patterns:

```ts
// Simple command execution
await shell("apt update", { displayOutput: true });

// Capture output for parsing
const result = await shell("apt list --installed", {});
const packages = parseAptOutput(result.stdout);

// Non-failing command (for checking if tool exists)
const check = await shell("which yay", { throwOnError: false });
if (check.code !== 0) {
  throw new Error("yay not found in PATH");
}
```

## Provider Loading

Providers are loaded by the `loadProviders()` function in `loaders.ts:51`. The loading process:

1. Scans the `providers/` directory for files with valid extensions (`.ts`, `.tsx`, `.js`, `.jsx`)
2. Only loads providers listed in `config.yaml`'s `providers` array
3. Dynamically imports each provider file
4. Calls the default exported function with the appropriate `Shell` implementation
5. Collects all returned `Provider` objects

## Package Synchronization

During `sysdef sync`, the `syncPackages()` function in `sysdef.ts:270` coordinates package management:

1. **Inventory**: Calls `getInstalled()` on each provider
2. **Diff calculation**: Determines what packages to install/remove
3. **User confirmation**: Prompts for approval of package operations
4. **Execution**: Calls `install()` and `uninstall()` methods
5. **Lockfile update**: Updates `sysdef-lock.json` with new versions

The sync process respects:
- **Version constraints**: Exact versions specified in modules
- **ANY_VERSION_STRING** (`"_*_"`): Accepts any installed version
- **Version conflicts**: Errors if modules request incompatible versions
- **Safe mode** (`--safe`): Skips package removal

## Built-in Providers

Sysdef includes default providers for common package managers:

- **yay**: Arch Linux AUR helper
- **apt**: Debian/Ubuntu package manager  
- **bun**: JavaScript runtime package manager

These serve as both functional providers and reference implementations for creating custom providers.

## Error Handling

Provider errors are handled by the `errorOut()` function for consistency:

- **Installation check failures**: During `sysdef sync` and `sysdef providers`
- **Command execution failures**: When shell commands return non-zero exit codes
- **Invalid package specifications**: Malformed version constraints
- **Provider not found**: When config references non-existent providers

## Best Practices

### Version Handling
- Support both exact versions (`"1.2.3"`) and version ranges where possible
- Handle `ANY_VERSION_STRING` gracefully by accepting any installed version
- Provide meaningful error messages for unsupported version specifications

### Output Parsing
- Make `getInstalled()` robust against package manager output format changes
- Handle edge cases like packages with special characters in names
- Consider locale-specific output formatting

### Performance
- Batch package operations when the underlying package manager supports it
- Cache expensive operations like package list queries when appropriate
- Minimize package manager invocations during sync operations

### Error Recovery
- Provide specific error messages for common failure modes
- Implement `checkInstallation()` to validate provider prerequisites
- Handle partial failures gracefully (e.g., some packages install, others fail)

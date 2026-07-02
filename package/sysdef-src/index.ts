import os from "os";
import path from "path";
import { loadModules, loadProviders, loadVariables } from "./loaders";
import { Lockfile } from "./lockfile";
import { dryFilesystem, normalFilesystem } from "./connections";
import { syncPackages, runEvents, updateLockfile, syncFiles, getPackageList, type PackageInfo, errorOut, defaultShell, dryShell } from "./sysdef";
import { Command } from "@commander-js/extra-typings";
import { readConfig } from "./configuration";

// defaults to $HOME/sysdef. You could change this if you'd like!
function getRootDir() {
  return process.env.SYSDEF_ROOT_DIR ?? path.join(os.homedir(), "sysdef");
}

// group a flat package list into a provider -> packages map
function toProviderMap(list: PackageInfo[]): Map<string, PackageInfo[]> {
  const map: Map<string, PackageInfo[]> = new Map();
  for (const p of list) {
    const current = map.get(p.provider);
    if (current) {
      current.push(p);
    } else {
      map.set(p.provider, [p]);
    }
  }
  return map;
}

// the set of packages sysdef currently manages (recorded in the lockfile), per
// provider. sysdef only removes packages in this set.
function managedSet(providers: { name: string }[], lockfile: Lockfile): Map<string, Set<string>> {
  const managed: Map<string, Set<string>> = new Map();
  for (const p of providers) {
    managed.set(p.name, new Set(lockfile.getPackages(p.name)));
  }
  return managed;
}


const cli = new Command()
  .name("sysdef")
  .description("The hackable computer configuration system")
  .action(async () => {
    cli.help();
  });



async function getCredentials() {
  console.log("Sysdef needs your credentials for commands that require root. These will only be used when necessary.");

  // this will keep the sudo credentials cached so each
  // successive sudo doesn't require the password
  const keepAlive = setInterval(async () => {
    await Bun.spawn(["sudo", "-v"]).exited;
  }, 4 * 60 * 1000);

  process.on("exit", () => {
    clearInterval(keepAlive);
    Bun.spawnSync(["sudo", "-k"]);
  })
}

const syncCommand = cli.command("sync")
  .description("Sync all packages, modules, and files")
  .option("-d, --dry-run", "do a dry-run and don't actually run any commands")
  .option("-s, --safe", "don't remove any packages, just install them")
  .option("-f, --files-only", "Only install files, don't bother with packages")
  .option("-h, --help", "See help for this command")
  .action(async (options) => {
    if (options.help) {
      syncCommand.help();
      return;
    }

    const rootDir = getRootDir();
    const dryRun = options.dryRun ?? false;
    const noRemove = options.safe ?? false;
    const filesOnly = options.filesOnly ?? false;
    const config = readConfig(rootDir);

    const modules = await loadModules(rootDir, dryRun, config.modules);
    const providers = await loadProviders(rootDir, dryRun, config.providers);
    const store = await loadVariables(rootDir, config.variables);

    for (const p of providers) {
      try {
        if (p.checkInstallation) { await p.checkInstallation(); }
      } catch (e) {
        errorOut(`${p.name} failed when checking its own installation: ${(e as Error).message}`);
      }
    }

    const lockfilePath = path.join(rootDir, "sysdef-lock.json");
    const lockfile = new Lockfile();
    lockfile.readFromFile(lockfilePath);

    const filesystem = options.dryRun ? dryFilesystem : normalFilesystem;

    console.log("\nSYNCING FILES:");
    await syncFiles(modules, store, filesystem, rootDir);

    if (filesOnly) {
      return;
    }

    const list = getPackageList(modules, lockfile);
    const map = toProviderMap(list);

    // capture the previously-managed set BEFORE we rewrite the lockfile
    const managed = managedSet(providers, lockfile);
    await syncPackages(map, providers, noRemove, managed);

    console.log("\nRUNNING EVENTS:");
    await runEvents(modules, dryRun ? dryShell : defaultShell);

    if (!dryRun) {
      await updateLockfile(map, providers, lockfile);
      lockfile.serializeToFile(lockfilePath);
    }
  });

cli.command("update-lockfile")
  .description("Update the lockfile to the current system state")
  .action(async () => {
    const rootDir = getRootDir();
    const config = readConfig(rootDir);
    const modules = await loadModules(rootDir, false, config.modules);
    const providers = await loadProviders(rootDir, false, config.providers);
    const lockfile = new Lockfile();
    const lockfilePath = path.join(rootDir, "sysdef-lock.json");

    lockfile.readFromFile(lockfilePath);

    const map = toProviderMap(getPackageList(modules, lockfile));
    await updateLockfile(map, providers, lockfile);
    lockfile.serializeToFile(lockfilePath);
  });

cli.command("update")
  .description("Update managed packages to their newest versions")
  .argument("[provider]", "only update packages for this provider")
  .argument("[packages...]", "only update these packages (default: all)")
  .action(async (provider, packages) => {
    const rootDir = getRootDir();
    const config = readConfig(rootDir);
    const modules = await loadModules(rootDir, false, config.modules);
    let providers = await loadProviders(rootDir, false, config.providers);

    if (provider !== undefined && providers.find(p => p.name === provider) === undefined) {
      errorOut(`Provider ${provider} was not found.`);
    }
    if (provider) {
      providers = providers.filter(p => p.name === provider);
    }

    for (const p of providers) {
      try {
        if (p.checkInstallation) { await p.checkInstallation(); }
      } catch (e) {
        errorOut(`${p.name} failed when checking its own installation: ${(e as Error).message}`);
      }
    }

    for (const p of providers) {
      console.log(`\nUPDATING PACKAGES FOR: ${p.name}`);
      await p.update(packages ?? []);
    }

    // refresh the lockfile so managed packages reflect their new versions
    const lockfilePath = path.join(rootDir, "sysdef-lock.json");
    const lockfile = new Lockfile();
    lockfile.readFromFile(lockfilePath);
    const map = toProviderMap(getPackageList(modules, lockfile));
    await updateLockfile(map, providers, lockfile);
    lockfile.serializeToFile(lockfilePath);
  });

cli.command("providers")
  .description("Subcommand to list all of the installed providers")
  .action(async () => {
    const rootDir = getRootDir();
    const config = readConfig(rootDir);
    const providers = await loadProviders(rootDir, false, config.providers);

    for (const p of providers) {
      try {
        if (p.checkInstallation) { await p.checkInstallation(); }
        console.log(`${p.name} is installed correctly`);
      } catch (e) {
        console.log(`${p.name} failed when checking its own installation: ${(e as Error).message}`);
      }
    }
  });

cli.command("list-installed")
  .description("list the installed packages from an optional provider")
  .argument("[provider]")
  .action(async (provider) => {
    const rootDir = getRootDir();
    const config = readConfig(rootDir);
    let providers = await loadProviders(rootDir, false, config.providers);

    if (provider !== undefined && providers.find(p => p.name === provider) === undefined) {
      errorOut(`Provider ${provider} was not found.`);
    }

    if (provider) {
      providers = providers.filter(p => p.name === provider);
    }
    for (const p of providers) {
      console.log(`Currently installed packages for ${p.name}:`);
      const packages = await p.getInstalled();
      for (const pkg of packages) {
        console.log(`  ${pkg.name}@${pkg.version}`);
      }
    }
  });

cli.command("hello")
  .action(() => {
    console.log("Hello, world!");
  });



export { cli }

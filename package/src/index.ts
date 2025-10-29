import os from "os";
import path from "path";
import { loadModules, loadProviders, loadVariables } from "./loaders";
import { Lockfile } from "./lockfile";
import { dryFilesystem, normalFilesystem } from "./connections";
import { syncModules, updateLockfile } from "./sysdef";
import { Command } from "@commander-js/extra-typings";

// defaults to $HOME/sysdef. You could change this if you'd like! 
function getRootDir() {
  return path.join(os.homedir(), "sysdef");
}


const cli = new Command()
  .name("sysdef")
  .description("The hackable computer configuration system")
  .action(async () => {
    cli.help();
  });

cli.command("sync")
  .description("Sync all packages, modules, and files")
  .option("-d, --dry-run", "run in dry-run mode")
  .action(async (options) => {
    const rootDir = getRootDir();

    const modules = await loadModules(rootDir, options.dryRun ?? false);
    const providers = await loadProviders(rootDir, options.dryRun ?? false);
    const store = await loadVariables(rootDir);

    const lockfilePath = path.join(rootDir, "sysdef-lock.json");
    const lockfile = new Lockfile();
    lockfile.readFromFile(lockfilePath);

    const filesystem = options.dryRun ? dryFilesystem : normalFilesystem;

    await syncModules({
      modules,
      providers,
      lockfile,
      store,
      filesystem
    });

    await updateLockfile(providers, lockfile);
    lockfile.serializeToFile(lockfilePath);
  });

cli.command("hello")
  .action(() => {
    console.log("Hello, world!");
  });



export { cli }

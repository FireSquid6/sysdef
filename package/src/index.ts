import os from "os";
import path from "path";
import { loadModules, loadProviders, loadVariables } from "./loaders";
import { Lockfile } from "./lockfile";
import { dryFilesystem, normalFilesystem } from "./connections";
import { syncModules, updateLockfile } from "./sysdef";
import { command } from "./argparse";

// defaults to $HOME/sysdef. You could change this if you'd like! 
function getRootDir() {
  return path.join(os.homedir(), "sysdef");
}


const cli = command("sysdef", "The hackable computer configuration system")
  .action(async () => {
    console.log(cli.help());
  })

cli.subcommand("sync", "Sync all packages, modules, and files")
  .flag("dryRun", { short: "d" })
  .action(async (args) => {
    const rootDir = getRootDir();

    const modules = await loadModules(rootDir, args.dryRun);
    const providers = await loadProviders(rootDir, args.dryRun);
    const store = await loadVariables(rootDir);

    const lockfilePath = path.join(rootDir, "sysdef-lock.json");
    const lockfile = new Lockfile();
    lockfile.readFromFile(lockfilePath);

    const filesystem = args.dryRun ? dryFilesystem : normalFilesystem;

    await syncModules({
      modules,
      providers,
      lockfile,
      store,
      filesystem
    });

    await updateLockfile(providers, lockfile);
    lockfile.serializeToFile(lockfilePath)

  })


cli.subcommand("hello")
  .action(() => {
    console.log("Hello, world!");
  })



export { cli }

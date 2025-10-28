import os from "os";
import path from "path";
import { loadModules, loadProviders, loadVariables } from "./loaders";
import { Lockfile } from "./lockfile";
import { dryFilesystem, normalFilesystem } from "./connections";
import { syncModules } from "./sysdef";
import { command } from "./argparse";

// defaults to $HOME/sysdef. You could change this if you'd like! 
function getRootDir() {
  return path.join(os.homedir(), "sysdef");
}


const cli = command("sysdef", "The hackable computer configuration system")
  .flag("verbose", { short: "v" })
  .option("configDir", { short: "v", required: true })
  .action(async (args) => {
    console.log(args.verbose);
    console.log(args.configDir);
    console.log("This is the basic action");
  })

cli.subcommand("sync", "Sync all packages, modules, and files")
  .action(async (args) => {
    const dryRun: boolean = true;
    // const rootDir = getRootDir();
    const rootDir = process.cwd();

    const modules = await loadModules(rootDir, dryRun);
    const providers = await loadProviders(rootDir, dryRun);
    const store = await loadVariables(rootDir);

    const lockfile = new Lockfile();
    lockfile.readFromFile(path.join(rootDir, "sysdef-lock.json"));

    const filesystem = dryRun ? dryFilesystem : normalFilesystem;

    await syncModules({
      modules,
      providers,
      lockfile,
      store,
      filesystem
    });

  })


cli.subcommand("hello")
  .action(() => {
    console.log("Hello, world!");
  })


await cli.execute();

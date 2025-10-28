import { flag, option, positional, command, executeArgs, parseArgs, filterArgs } from "./argparse";
import os from "os";
import path from "path";
import { loadModules, loadProviders, loadVariables } from "./loaders";
import { Lockfile } from "./lockfile";
import { dryFilesystem, normalFilesystem } from "./connections";
import { syncModules } from "./sysdef";


const program = command({
  flags: [],
  options: [],
  positional: [],

  async action() {
    console.log("This is your sysdef installation!");
  },
  subcommands: {
    sync: command({
      flags: [
        flag({ name: "dry-run", alternatives: ["D"] }),
      ],
      options: [
        option({ name: "mything", alternatives: ["-D"], required: true})
      ],
      positional: [],
      subcommands: undefined,
      async action(options, flags, positional) {
        const dryRun: boolean = true;
        // const rootDir = path.join(os.homedir(), "sysdef");
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
      },
    }),
    update: command({
      flags: [],
      options: [],
      positional: [
        positional({ name: "pkg", required: false }),
      ],
      subcommands: undefined,
      action(_options, _flags, positional) {
        console.log("Update command is under construction");
      },
    }),
    manage: command({
      flags: [],
      options: [],
      positional: [],
      subcommands: [
      ],
      action(options, flags, positional) {
        console.log("Manage command and subcommands still under construction!")
      },
    })
  },
})


// defaults to $HOME/sysdef. You could change this if you'd like! 
function getRootDir() {

}

const filtered = filterArgs(process.argv);
const parsed = parseArgs(filtered);

await executeArgs(parsed, program, "sysdef");

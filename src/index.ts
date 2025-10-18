
import { flag, option, positional, command } from "./argparse";

const program = {
  sync: command({
    flags: [
      flag({ name: "no-remove", alternatives: ["K"] }),
      flag({ name: "dry-run", alternatives: ["D"] }),
      flag({ name: "only-dotfiles", alternatives: ["F"] }),
    ],
    options: [],
    positional: [],
    subcommands: undefined,
    action(options, flags, positional) {
        
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
    action: (options, flags, positional) {
      console.log("Manage command and subcommands still under construction!")
    },
  })
}


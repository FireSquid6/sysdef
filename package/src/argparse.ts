export interface ParsedArgs {
  flags: Record<string, boolean>;
  options: Record<string, string>;
  positional: string[];
}

export function filterArgs(args: string[]): string[] {
  // First pass: look for script files
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.endsWith(".ts") || arg.endsWith(".js") || arg.endsWith(".mjs") || arg.endsWith(".cjs")) {
      return args.slice(i + 1);
    }
  }

  // Second pass: look for subcommands (non-path, non-flag arguments after first arg)
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    const prevArg = args[i - 1]!;

    if (!prevArg.includes("/") && !arg.startsWith("-") && !arg.includes("/")) {
      return args.slice(i);
    }
  }

  return args.slice(2);
}

export function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    flags: {},
    options: {},
    positional: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        result.options[name] = nextArg;
        i++;
      } else {
        result.flags[name] = true;
      }
    } else if (arg.startsWith("-") && arg.length > 1) {
      for (const char of arg.slice(1)) {
        result.flags[char] = true;
      }
    } else {
      result.positional.push(arg);
    }
  }

  return result;
}


export type FlagConfig<T extends string> = {
  name: T;
  alternatives: string[];
  description?: string;
}

export type OptionConfig<T extends string> = {
  name: T;
  required: boolean;
  alternatives: string[];
  description?: string;
}

export type PositionalConfig<T extends string> = {
  name: T;
  required: boolean;
  description?: string;
}

export type ExtractName<T> = T extends { name: infer N } ? N : never;

export type ParsedFlags<Flags extends readonly FlagConfig<string>[]> = { [K in Flags[number]as ExtractName<K>]: boolean }
export type ParsedOptions<Args extends readonly OptionConfig<string>[]> = {
  [K in Args[number]as ExtractName<K>]: K extends { required: true }
  ? string
  : string | undefined
}

export type ParsedPositional<Positionals extends readonly PositionalConfig<string>[]> = {
  [K in Positionals[number]as ExtractName<K>]: K extends { required: true }
  ? string
  : string | undefined
}


export type Command<
  Flags extends readonly FlagConfig<string>[],
  Options extends readonly OptionConfig<string>[],
  Positional extends readonly PositionalConfig<string>[],
  Subcommands extends CommandMap | undefined = undefined
> = {
  flags: Flags;
  options: Options;
  positional: Positional;
  subcommands: Subcommands;
  description?: string;
  action: (
    options: ParsedOptions<Options>,
    flags: ParsedFlags<Flags>,
    positional: ParsedPositional<Positional>,
  ) => void | Promise<void>;
}

export type CommandMap = Record<string, Command<FlagConfig<string>[], OptionConfig<string>[], PositionalConfig<string>[], any>>;

export function flag<T extends FlagConfig<string>>(f: T): T {
  return f;
}

export function option<T extends OptionConfig<string>>(o: T): T {
  return o;
}

export function positional<T extends PositionalConfig<string>>(p: T): T {
  return p;
}

export function command<T extends Command<any, any, any, any>>(command: T): T {
  return command;
}

export function errorOut(message: string): never {
  throw new Error(`Error: ${message}`);
}

export function generateHelp<T extends CommandMap>(
  commandMap: T,
  commandName: string = "_default",
  programName: string = "program"
): string {
  const command = commandMap[commandName];
  if (!command) {
    return `Command '${commandName}' not found`;
  }

  let help = `Usage: ${programName}`;

  if (commandName !== "_default") {
    help += ` ${commandName}`;
  }

  if (command.flags.length > 0) {
    help += " [FLAGS]";
  }

  if (command.options.length > 0) {
    help += " [OPTIONS]";
  }

  for (const pos of command.positional) {
    if (pos.required) {
      help += ` <${pos.name}>`;
    } else {
      help += ` [${pos.name}]`;
    }
  }

  if (command.subcommands && Object.keys(command.subcommands).length > 0) {
    help += " [SUBCOMMAND]";
  }

  help += "\n";

  if (command.description) {
    help += `\n${command.description}\n`;
  }

  // Positional
  if (command.positional.length > 0) {
    help += "\nARGUMENTS:\n";
    for (const pos of command.positional) {
      help += `    ${pos.name}`;
      if (pos.description) {
        help += `    ${pos.description}`;
      }
      if (pos.required) {
        help += " (required)";
      }
      help += "\n";
    }
  }

  // Options
  if (command.options.length > 0) {
    help += "\nOPTIONS:\n";
    for (const option of command.options) {
      const names = [option.name, ...option.alternatives];
      const namesList = names.map(name => name.length === 1 ? `-${name}` : `--${name}`).join(", ");
      help += `    ${namesList} <value>`;
      if (option.description) {
        help += `    ${option.description}`;
      }
      if (option.required) {
        help += " (required)";
      }
      help += "\n";
    }
  }

  // Flags
  if (command.flags.length > 0) {
    help += "\nFLAGS:\n";
    for (const flag of command.flags) {
      const names = [flag.name, ...flag.alternatives];
      const namesList = names.map(name => name.length === 1 ? `-${name}` : `--${name}`).join(", ");
      help += `    ${namesList}`;
      if (flag.description) {
        help += `    ${flag.description}`;
      }
      help += "\n";
    }
  }

  if (command.subcommands && Object.keys(command.subcommands).length > 0) {
    help += "\nSUBCOMMANDS:\n";
    for (const [subName, subCommand] of Object.entries(command.subcommands)) {
      help += `    ${subName}`;
      //@ts-expect-error it's fine. Subcommands is typed to any because typescript is annoying
      if (subCommand.description) {
        //@ts-expect-error it's fine
        help += `    ${subCommand.description}`;
      }
      help += "\n";
    }
    help += `\nUse '${programName} ${commandName !== "_default" ? commandName + " " : ""}[SUBCOMMAND] --help' for more information on a subcommand.\n`;
  }

  return help;
}

export async function executeArgs<T extends CommandMap>(
  args: ParsedArgs,
  map: T,
  programName: string = "program"
): Promise<void> {
  const commandName = args.positional.length === 0 ? "_default" : args.positional.shift()!;
  const command = map[commandName];

  if (command === undefined) {
    errorOut(`Command ${commandName} not found`);
  }

  // Check for help flag before processing anything else
  if (args.flags.help || args.flags.h) {
    // we just wanna do help in this case
    console.log(generateHelp(map, commandName, programName));
    return;
  }

  // check for a subcommand
  const subcommandName = args.positional[0];
  const subcommandExists = command.subcommands !== undefined && Object.keys(command.subcommands).find(c => c === subcommandName) !== undefined

  // we don't get static typing here to avoid circular definitions
  // subcommands is typed to any
  if (subcommandExists) {
    executeArgs(args, command.subcommands, programName);
    return;
  }

  const validatedFlags: Record<string, boolean> = {};
  const usedFlagNames = new Set<string>();

  for (const flagConfig of command.flags) {
    const allFlagNames = [flagConfig.name, ...flagConfig.alternatives];
    let foundFlag = false;
    let foundName = '';

    for (const flagName of allFlagNames) {
      if (args.flags[flagName]) {
        if (foundFlag) {
          errorOut(`Flag '${flagConfig.name}' specified multiple times using different names: '${foundName}' and '${flagName}'`);
        }
        foundFlag = true;
        foundName = flagName;

        if (usedFlagNames.has(flagName)) {
          errorOut(`Flag '${flagName}' specified multiple times`);
        }
        usedFlagNames.add(flagName);
      }
    }

    validatedFlags[flagConfig.name] = foundFlag;
  }

  for (const flagName in args.flags) {
    if (!usedFlagNames.has(flagName)) {
      errorOut(`Unknown flag: '${flagName}'`);
    }
  }

  const validatedOptions: Record<string, string | undefined> = {};
  const usedOptionNames = new Set<string>();

  for (const optionConfig of command.options) {
    const allOptionNames = [optionConfig.name, ...optionConfig.alternatives];
    let foundOption = false;
    let foundValue = '';
    let foundName = '';

    for (const optionName of allOptionNames) {
      if (args.options[optionName] !== undefined) {
        if (foundOption) {
          errorOut(`Option '${optionConfig.name}' specified multiple times using different names: '${foundName}' and '${optionName}'`);
        }
        foundOption = true;
        foundValue = args.options[optionName]!;
        foundName = optionName;

        if (usedOptionNames.has(optionName)) {
          errorOut(`Option '${optionName}' specified multiple times`);
        }
        usedOptionNames.add(optionName);
      }
    }

    if (optionConfig.required && !foundOption) {
      errorOut(`Required option '${optionConfig.name}' is missing`);
    }

    validatedOptions[optionConfig.name] = foundOption ? foundValue : undefined;
  }

  for (const optionName in args.options) {
    if (!usedOptionNames.has(optionName)) {
      errorOut(`Unknown option: '${optionName}'`);
    }
  }

  const validatedPositional: Record<string, string | undefined> = {};

  for (let i = 0; i < command.positional.length; i++) {
    const positionalConfig = command.positional[i]!;
    const value = args.positional[i];

    if (positionalConfig.required && value === undefined) {
      errorOut(`Required positional argument '${positionalConfig.name}' is missing`);
    }

    validatedPositional[positionalConfig.name] = value;
  }

  if (args.positional.length > command.positional.length) {
    const extraArgs = args.positional.slice(command.positional.length);
    errorOut(`Unexpected positional arguments: ${extraArgs.join(', ')}`);
  }

  await command.action(
    validatedOptions as ParsedOptions<typeof command.options>,
    validatedFlags as ParsedFlags<typeof command.flags>,
    validatedPositional as ParsedPositional<typeof command.positional>
  );
}

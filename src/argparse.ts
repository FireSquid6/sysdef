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
}

export type OptionConfig<T extends string> = {
  name: T;
  required: boolean;
  alternatives: string[]
}

export type PositionalConfig<T extends string> = {
  name: T;
  required: boolean;
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

export async function executeArgs<T extends CommandMap>(args: ParsedArgs, map: T): Promise<void> {
  const commandName = args.positional.length === 0 ? "_default" : args.positional.shift()!;
  const command = map[commandName];

  if (command === undefined) {
    errorOut(`Command ${commandName} not found`);
  }

  // check for a subcommand
  const subcommandName = args.positional[0];
  const subcommandExists = command.subcommands !== undefined && Object.keys(command.subcommands).find(c => c === subcommandName) !== undefined

  // we don't get static typing here to avoid circular definitions
  // subcommands is typed to any
  if (subcommandExists) {
    executeArgs(args, command.subcommands);
    return;
  }

  // Validate flags
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
  
  // Check for unknown flags
  for (const flagName in args.flags) {
    if (!usedFlagNames.has(flagName)) {
      errorOut(`Unknown flag: '${flagName}'`);
    }
  }

  // Validate options
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
  
  // Check for unknown options
  for (const optionName in args.options) {
    if (!usedOptionNames.has(optionName)) {
      errorOut(`Unknown option: '${optionName}'`);
    }
  }

  // Validate positional arguments
  const validatedPositional: Record<string, string | undefined> = {};
  
  for (let i = 0; i < command.positional.length; i++) {
    const positionalConfig = command.positional[i]!;
    const value = args.positional[i];
    
    if (positionalConfig.required && value === undefined) {
      errorOut(`Required positional argument '${positionalConfig.name}' is missing`);
    }
    
    validatedPositional[positionalConfig.name] = value;
  }
  
  // Check for extra positional arguments
  if (args.positional.length > command.positional.length) {
    const extraArgs = args.positional.slice(command.positional.length);
    errorOut(`Unexpected positional arguments: ${extraArgs.join(', ')}`);
  }

  // Execute the command action
  await command.action(
    validatedOptions as ParsedOptions<typeof command.options>,
    validatedFlags as ParsedFlags<typeof command.flags>,
    validatedPositional as ParsedPositional<typeof command.positional>
  );
}

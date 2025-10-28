type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
};

type InferType<T extends keyof TypeMap | undefined> = T extends keyof TypeMap ? TypeMap[T] : string;

export interface ArgumentConfig<T extends keyof TypeMap = 'string'> {
  name: string;
  description?: string;
  required?: boolean;
  type?: T;
  default?: InferType<T>;
}

export interface FlagConfig<T extends keyof TypeMap = 'boolean'> {
  short?: string;
  long: string;
  description?: string;
  type?: T;
  default?: InferType<T>;
}

export interface OptionConfig<T extends keyof TypeMap = 'string'> {
  short?: string;
  long: string;
  description?: string;
  type?: T;
  required?: boolean;
  default?: InferType<T>;
}

type ArgumentsType<T extends ReadonlyArray<ArgumentConfig<any>>> = {
  [K in T[number] as K['name']]: K['required'] extends false 
    ? InferType<K['type']> | undefined
    : InferType<K['type']>
} & { _: string[] };

type FlagsType<T extends ReadonlyArray<FlagConfig<any>>> = {
  [K in T[number] as K['long']]: InferType<K['type']>
};

type OptionsType<T extends ReadonlyArray<OptionConfig<any>>> = {
  [K in T[number] as K['long']]: K['required'] extends false
    ? InferType<K['type']> | undefined
    : InferType<K['type']>
};

type ParsedArgs<
  TArgs extends ReadonlyArray<ArgumentConfig<any>> = [],
  TFlags extends ReadonlyArray<FlagConfig<any>> = [],
  TOptions extends ReadonlyArray<OptionConfig<any>> = []
> = ArgumentsType<TArgs> & FlagsType<TFlags> & OptionsType<TOptions>;

export class Command<
  TArgs extends ReadonlyArray<ArgumentConfig<any>> = [],
  TFlags extends ReadonlyArray<FlagConfig<any>> = [],
  TOptions extends ReadonlyArray<OptionConfig<any>> = []
> {
  private _name: string;
  private _description?: string;
  private _arguments: ArgumentConfig<any>[] = [];
  private _flags: FlagConfig<any>[] = [];
  private _options: OptionConfig<any>[] = [];
  private _subcommands: Map<string, Command<any, any, any>> = new Map();
  private _handler?: (args: ParsedArgs<TArgs, TFlags, TOptions>) => void | Promise<void>;

  constructor(name: string, description?: string) {
    this._name = name;
    this._description = description;
  }

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  argument<TName extends string, TType extends keyof TypeMap = 'string'>(
    name: TName, 
    config: Omit<ArgumentConfig<TType>, 'name'> = {} as any
  ): Command<
    [...TArgs, ArgumentConfig<TType> & { name: TName }],
    TFlags,
    TOptions
  > {
    const newArgs = [...this._arguments, { name, ...config }] as const;
    const newCommand = new Command<
      [...TArgs, ArgumentConfig<TType> & { name: TName }],
      TFlags,
      TOptions
    >(this._name, this._description);
    
    newCommand._arguments = newArgs as any;
    newCommand._flags = [...this._flags];
    newCommand._options = [...this._options];
    newCommand._subcommands = new Map(this._subcommands);
    newCommand._handler = this._handler as any;
    
    return newCommand;
  }

  flag<TName extends string, TType extends keyof TypeMap = 'boolean'>(
    long: TName, 
    config: Omit<FlagConfig<TType>, 'long'> = {} as any
  ): Command<
    TArgs,
    [...TFlags, FlagConfig<TType> & { long: TName }],
    TOptions
  > {
    const newFlags = [...this._flags, { long, ...config }] as const;
    const newCommand = new Command<
      TArgs,
      [...TFlags, FlagConfig<TType> & { long: TName }],
      TOptions
    >(this._name, this._description);
    
    newCommand._arguments = [...this._arguments];
    newCommand._flags = newFlags as any;
    newCommand._options = [...this._options];
    newCommand._subcommands = new Map(this._subcommands);
    newCommand._handler = this._handler as any;
    
    return newCommand;
  }

  option<TName extends string, TType extends keyof TypeMap = 'string'>(
    long: TName, 
    config: Omit<OptionConfig<TType>, 'long'> = {} as any
  ): Command<
    TArgs,
    TFlags,
    [...TOptions, OptionConfig<TType> & { long: TName }]
  > {
    const newOptions = [...this._options, { long, ...config }] as const;
    const newCommand = new Command<
      TArgs,
      TFlags,
      [...TOptions, OptionConfig<TType> & { long: TName }]
    >(this._name, this._description);
    
    newCommand._arguments = [...this._arguments];
    newCommand._flags = [...this._flags];
    newCommand._options = newOptions as any;
    newCommand._subcommands = new Map(this._subcommands);
    newCommand._handler = this._handler as any;
    
    return newCommand;
  }

  use<TNewFlags extends ReadonlyArray<FlagConfig<any>>, TNewOptions extends ReadonlyArray<OptionConfig<any>>>(
    set: FlagSet<TNewFlags> | OptionSet<TNewOptions> | MixedSet<TNewFlags, TNewOptions>
  ): Command<TArgs, any, any> {
    const newCommand = new Command<TArgs, any, any>(this._name, this._description);
    
    newCommand._arguments = [...this._arguments];
    
    if (set instanceof FlagSet) {
      newCommand._flags = [...this._flags, ...set.flags] as any;
      newCommand._options = [...this._options];
    } else if (set instanceof OptionSet) {
      newCommand._flags = [...this._flags];
      newCommand._options = [...this._options, ...set.options] as any;
    } else if (set instanceof MixedSet) {
      newCommand._flags = [...this._flags, ...set.flags] as any;
      newCommand._options = [...this._options, ...set.options] as any;
    }
    
    newCommand._subcommands = new Map(this._subcommands);
    newCommand._handler = this._handler as any;
    
    return newCommand;
  }

  subcommand(name: string, description?: string): Command<[], [], []> {
    const subcmd = new Command<[], [], []>(name, description);
    this._subcommands.set(name, subcmd as any);
    return subcmd;
  }

  action(handler: (args: ParsedArgs<TArgs, TFlags, TOptions>) => void | Promise<void>): this {
    this._handler = handler;
    return this;
  }

  parse(args: string[] = process.argv.slice(2)): ParsedArgs<TArgs, TFlags, TOptions> {
    const result: any = { _: [] };
    
    // Initialize defaults
    this._flags.forEach(flag => {
      if (flag.default !== undefined) {
        result[flag.long] = flag.default;
      }
    });
    
    this._options.forEach(option => {
      if (option.default !== undefined) {
        result[option.long] = option.default;
      }
    });

    let i = 0;
    let positionalIndex = 0;

    while (i < args.length) {
      const arg = args[i]!;

      // Check for subcommand
      if (this._subcommands.has(arg)) {
        const subcmd = this._subcommands.get(arg)!;
        const remainingArgs = args.slice(i + 1);
        return subcmd.parse(remainingArgs) as ParsedArgs<TArgs, TFlags, TOptions>;
      }

      // Handle long flags/options (--flag or --option=value)
      if (arg.startsWith('--')) {
        const parts = arg.slice(2).split('=', 2);
        const flagName = parts[0];
        const value = parts[1];
        
        if (!flagName) {
          throw new Error('Invalid flag format');
        }
        
        const flag = this._flags.find(f => f.long === flagName);
        const option = this._options.find(o => o.long === flagName);

        if (flag) {
          if (flag.type === 'boolean' || flag.type === undefined) {
            result[flag.long] = value !== undefined ? this.parseValue(value, flag.type || 'boolean') : true;
          } else {
            const nextValue = value !== undefined ? value : args[++i];
            if (nextValue === undefined) {
              throw new Error(`Flag --${flagName} requires a value`);
            }
            result[flag.long] = this.parseValue(nextValue, flag.type);
          }
        } else if (option) {
          const nextValue = value !== undefined ? value : args[++i];
          if (nextValue === undefined) {
            throw new Error(`Option --${flagName} requires a value`);
          }
          result[option.long] = this.parseValue(nextValue, option.type || 'string');
        } else {
          throw new Error(`Unknown flag/option: --${flagName}`);
        }
      }
      // Handle short flags/options (-f or -o value)
      else if (arg.startsWith('-') && arg.length > 1) {
        const flagName = arg.slice(1);
        
        if (!flagName) {
          throw new Error('Invalid flag format');
        }
        
        const flag = this._flags.find(f => f.short === flagName);
        const option = this._options.find(o => o.short === flagName);

        if (flag) {
          if (flag.type === 'boolean' || flag.type === undefined) {
            result[flag.long] = true;
          } else {
            const nextValue = args[++i];
            if (nextValue === undefined) {
              throw new Error(`Flag -${flagName} requires a value`);
            }
            result[flag.long] = this.parseValue(nextValue, flag.type);
          }
        } else if (option) {
          const nextValue = args[++i];
          if (nextValue === undefined) {
            throw new Error(`Option -${flagName} requires a value`);
          }
          result[option.long] = this.parseValue(nextValue, option.type || 'string');
        } else {
          throw new Error(`Unknown flag/option: -${flagName}`);
        }
      }
      // Handle positional arguments
      else {
        if (positionalIndex < this._arguments.length) {
          const argConfig = this._arguments[positionalIndex];
          if (argConfig) {
            result[argConfig.name] = this.parseValue(arg, argConfig.type || 'string');
          }
          positionalIndex++;
        } else {
          result._.push(arg);
        }
      }

      i++;
    }

    // Validate required arguments
    this._arguments.forEach((argConfig, index) => {
      if (argConfig.required && index >= positionalIndex) {
        throw new Error(`Missing required argument: ${argConfig.name}`);
      }
    });

    // Validate required options
    this._options.forEach(option => {
      if (option.required && result[option.long] === undefined) {
        throw new Error(`Missing required option: --${option.long}`);
      }
    });

    return result;
  }

  private parseValue(value: string, type: 'string' | 'number' | 'boolean'): any {
    switch (type) {
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${value}`);
        }
        return num;
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      default:
        return value;
    }
  }

  async execute(args?: string[]): Promise<void> {
    const parsed = this.parse(args);
    if (this._handler) {
      await this._handler(parsed);
    }
  }

  help(): string {
    let help = `Usage: ${this._name}`;
    
    if (this._arguments.length > 0) {
      help += ' ' + this._arguments.map(arg => 
        arg.required ? `<${arg.name}>` : `[${arg.name}]`
      ).join(' ');
    }

    if (this._flags.length > 0 || this._options.length > 0) {
      help += ' [options]';
    }

    if (this._subcommands.size > 0) {
      help += ' [command]';
    }

    if (this._description) {
      help += `\n\n${this._description}`;
    }

    if (this._arguments.length > 0) {
      help += '\n\nArguments:';
      this._arguments.forEach(arg => {
        help += `\n  ${arg.name.padEnd(20)} ${arg.description || ''}`;
      });
    }

    if (this._flags.length > 0) {
      help += '\n\nFlags:';
      this._flags.forEach(flag => {
        const short = flag.short ? `-${flag.short}, ` : '    ';
        help += `\n  ${short}--${flag.long.padEnd(16)} ${flag.description || ''}`;
      });
    }

    if (this._options.length > 0) {
      help += '\n\nOptions:';
      this._options.forEach(option => {
        const short = option.short ? `-${option.short}, ` : '    ';
        help += `\n  ${short}--${option.long.padEnd(16)} ${option.description || ''}`;
      });
    }

    if (this._subcommands.size > 0) {
      help += '\n\nCommands:';
      this._subcommands.forEach((cmd, name) => {
        help += `\n  ${name.padEnd(20)} ${cmd._description || ''}`;
      });
    }

    return help;
  }
}

export class FlagSet<TFlags extends ReadonlyArray<FlagConfig<any>> = []> {
  constructor(public readonly flags: TFlags) {}

  static create() {
    return new FlagSet([] as const);
  }

  flag<TName extends string, TType extends keyof TypeMap = 'boolean'>(
    long: TName, 
    config: Omit<FlagConfig<TType>, 'long'> = {} as any
  ): FlagSet<[...TFlags, FlagConfig<TType> & { long: TName }]> {
    return new FlagSet([...this.flags, { long, ...config }] as const);
  }
}

export class OptionSet<TOptions extends ReadonlyArray<OptionConfig<any>> = []> {
  constructor(public readonly options: TOptions) {}

  static create() {
    return new OptionSet([] as const);
  }

  option<TName extends string, TType extends keyof TypeMap = 'string'>(
    long: TName, 
    config: Omit<OptionConfig<TType>, 'long'> = {} as any
  ): OptionSet<[...TOptions, OptionConfig<TType> & { long: TName }]> {
    return new OptionSet([...this.options, { long, ...config }] as const);
  }
}

export class MixedSet<
  TFlags extends ReadonlyArray<FlagConfig<any>> = [],
  TOptions extends ReadonlyArray<OptionConfig<any>> = []
> {
  constructor(
    public readonly flags: TFlags,
    public readonly options: TOptions
  ) {}

  static create() {
    return new MixedSet([] as const, [] as const);
  }

  flag<TName extends string, TType extends keyof TypeMap = 'boolean'>(
    long: TName, 
    config: Omit<FlagConfig<TType>, 'long'> = {} as any
  ): MixedSet<[...TFlags, FlagConfig<TType> & { long: TName }], TOptions> {
    return new MixedSet([...this.flags, { long, ...config }] as const, this.options);
  }

  option<TName extends string, TType extends keyof TypeMap = 'string'>(
    long: TName, 
    config: Omit<OptionConfig<TType>, 'long'> = {} as any
  ): MixedSet<TFlags, [...TOptions, OptionConfig<TType> & { long: TName }]> {
    return new MixedSet(this.flags, [...this.options, { long, ...config }] as const);
  }
}

export function flagSet() {
  return FlagSet.create();
}

export function optionSet() {
  return OptionSet.create();
}

export function mixedSet() {
  return MixedSet.create();
}

export function command(name: string, description?: string): Command<[], [], []> {
  return new Command<[], [], []>(name, description);
}

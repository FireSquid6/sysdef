import { describe, test, expect } from "bun:test";
import { command, flagSet, optionSet, mixedSet } from "../src/argparse";

describe("CLI Argparse Library", () => {
  test("should create basic command", () => {
    const cli = command('test', 'A test command');
    expect(cli.help()).toContain('test');
    expect(cli.help()).toContain('A test command');
  });

  test("should parse basic arguments", () => {
    const cli = command('test')
      .argument('file', { type: 'string', required: true })
      .action((args) => {
        expect(args.file).toBe('input.txt');
        expect(args._).toEqual([]);
      });
    
    cli.execute(['input.txt']);
  });

  test("should parse flags", () => {
    const cli = command('test')
      .flag('verbose', { short: 'v' })
      .flag('debug', { type: 'boolean' })
      .action((args) => {
        expect(args.verbose).toBe(true);
        expect(args.debug).toBe(true);
      });
    
    cli.execute(['--verbose', '--debug']);
  });

  test("should parse options", () => {
    const cli = command('test')
      .option('output', { short: 'o', type: 'string', required: true })
      .option('count', { type: 'number' })
      .action((args) => {
        expect(args.output).toBe('result.txt');
        expect(args.count).toBe(42);
      });
    
    cli.execute(['--output', 'result.txt', '--count', '42']);
  });

  test("should handle mixed arguments, flags and options", () => {
    const cli = command('test')
      .argument('input', { type: 'string', required: true })
      .flag('verbose', { short: 'v' })
      .option('output', { short: 'o', type: 'string' })
      .action((args) => {
        expect(args.input).toBe('file.txt');
        expect(args.verbose).toBe(true);
        expect(args.output).toBe('out.txt');
      });
    
    cli.execute(['file.txt', '-v', '-o', 'out.txt']);
  });

  test("should throw error for missing required arguments", () => {
    const cli = command('test')
      .argument('required', { required: true });
    
    expect(() => cli.parse([])).toThrow('Missing required argument: required');
  });

  test("should throw error for missing required options", () => {
    const cli = command('test')
      .option('required', { required: true });
    
    expect(() => cli.parse([])).toThrow('Missing required option: --required');
  });

  test("should support subcommands", () => {
    const cli = command('main');
    const buildCmd = cli.subcommand('build', 'Build the project')
      .argument('target', { required: true })
      .action((args) => {
        expect(args.target).toBe('production');
      });
    
    cli.execute(['build', 'production']);
  });

  test("should generate help text", () => {
    const cli = command('myapp', 'My application')
      .argument('file', { description: 'Input file' })
      .flag('verbose', { short: 'v', description: 'Verbose output' })
      .option('output', { short: 'o', description: 'Output file' });
    
    const help = cli.help();
    expect(help).toContain('myapp');
    expect(help).toContain('My application');
    expect(help).toContain('file');
    expect(help).toContain('Input file');
    expect(help).toContain('-v, --verbose');
    expect(help).toContain('Verbose output');
    expect(help).toContain('-o, --output');
    expect(help).toContain('Output file');
  });

  test("should support reusable flag sets", () => {
    const commonFlags = flagSet()
      .flag('verbose', { short: 'v' })
      .flag('debug');

    const cli = command('test')
      .use(commonFlags)
      .action((args) => {
        expect(args.verbose).toBe(true);
        expect(args.debug).toBe(true);
      });

    cli.execute(['--verbose', '--debug']);
  });

  test("should support reusable option sets", () => {
    const commonOptions = optionSet()
      .option('output', { short: 'o', type: 'string' })
      .option('count', { type: 'number' });

    const cli = command('test')
      .use(commonOptions)
      .action((args) => {
        expect(args.output).toBe('file.txt');
        expect(args.count).toBe(42);
      });

    cli.execute(['--output', 'file.txt', '--count', '42']);
  });

  test("should support mixed flag/option sets", () => {
    const mixedCommon = mixedSet()
      .flag('force', { short: 'f' })
      .option('config', { type: 'string' });

    const cli = command('test')
      .use(mixedCommon)
      .action((args) => {
        expect(args.force).toBe(true);
        expect(args.config).toBe('config.json');
      });

    cli.execute(['--force', '--config', 'config.json']);
  });

  test("should combine multiple sets", () => {
    const flags = flagSet().flag('verbose', { short: 'v' });
    const options = optionSet().option('output', { type: 'string' });

    const cli = command('test')
      .use(flags)
      .use(options)
      .action((args) => {
        expect(args.verbose).toBe(true);
        expect(args.output).toBe('result.txt');
      });

    cli.execute(['--verbose', '--output', 'result.txt']);
  });
});
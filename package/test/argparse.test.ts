import { describe, test, expect } from "bun:test";
import { command, flagSet } from "../src/argparse";

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

  test("should support reusable flag sets with flags and options", () => {
    const commonSet = flagSet()
      .flag('verbose', { short: 'v' })
      .flag('debug')
      .option('output', { short: 'o', type: 'string' })
      .option('count', { type: 'number' });

    const cli = command('test')
      .use(commonSet)
      .action((args) => {
        expect(args.verbose).toBe(true);
        expect(args.debug).toBe(true);
        expect(args.output).toBe('file.txt');
        expect(args.count).toBe(42);
      });

    cli.execute(['--verbose', '--debug', '--output', 'file.txt', '--count', '42']);
  });

  test("should combine multiple flag sets", () => {
    const logFlags = flagSet()
      .flag('verbose', { short: 'v' })
      .flag('debug');
    
    const outputSet = flagSet()
      .option('output', { type: 'string' })
      .option('format', { type: 'string' });

    const cli = command('test')
      .use(logFlags)
      .use(outputSet)
      .action((args) => {
        expect(args.verbose).toBe(true);
        expect(args.debug).toBe(true);
        expect(args.output).toBe('result.txt');
        expect(args.format).toBe('json');
      });

    cli.execute(['--verbose', '--debug', '--output', 'result.txt', '--format', 'json']);
  });
});
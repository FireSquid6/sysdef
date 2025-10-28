import { describe, test, expect, mock } from "bun:test";
import { command, flagSet } from "../src/argparse";

describe("CLI Argparse Library", () => {
  test("should create basic command", () => {
    const cli = command('test', 'A test command');
    expect(cli.help()).toContain('test');
    expect(cli.help()).toContain('A test command');
  });

  test("should parse basic arguments", async () => {
    const mockAction = mock((args) => {
      expect(args.file).toBe('input.txt');
      expect(args._).toEqual([]);
    });

    const cli = command('test')
      .argument('file', { type: 'string', required: true })
      .action(mockAction);
    
    await cli.execute(['input.txt']);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test("should parse flags", async () => {
    const mockAction = mock((args) => {
      expect(args.verbose).toBe(true);
      expect(args.debug).toBe(true);
    });

    const cli = command('test')
      .flag('verbose', { short: 'v' })
      .flag('debug', { type: 'boolean' })
      .action(mockAction);
    
    await cli.execute(['--verbose', '--debug']);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test("should parse options", async () => {
    const mockAction = mock((args) => {
      expect(args.output).toBe('result.txt');
      expect(args.count).toBe(42);
    });

    const cli = command('test')
      .option('output', { short: 'o', type: 'string', required: true })
      .option('count', { type: 'number' })
      .action(mockAction);
    
    await cli.execute(['--output', 'result.txt', '--count', '42']);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test("should handle mixed arguments, flags and options", async () => {
    const mockAction = mock((args) => {
      expect(args.input).toBe('file.txt');
      expect(args.verbose).toBe(true);
      expect(args.output).toBe('out.txt');
    });

    const cli = command('test')
      .argument('input', { type: 'string', required: true })
      .flag('verbose', { short: 'v' })
      .option('output', { short: 'o', type: 'string' })
      .action(mockAction);
    
    await cli.execute(['file.txt', '-v', '-o', 'out.txt']);
    expect(mockAction).toHaveBeenCalledTimes(1);
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

  test("should support subcommands", async () => {
    const mockAction = mock((args) => {
      expect(args.target).toBe('production');
    });

    const cli = command('main');
    cli.subcommand('build', 'Build the project')
      .argument('target', { required: true })
      .action(mockAction);
    
    await cli.execute(['build', 'production']);
    expect(mockAction).toHaveBeenCalledTimes(1);
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

  test("should support reusable flag sets with flags and options", async () => {
    const mockAction = mock((args) => {
      expect(args.verbose).toBe(true);
      expect(args.debug).toBe(true);
      expect(args.output).toBe('file.txt');
      expect(args.count).toBe(42);
    });

    const commonSet = flagSet()
      .flag('verbose', { short: 'v' })
      .flag('debug')
      .option('output', { short: 'o', type: 'string' })
      .option('count', { type: 'number' });

    const cli = command('test')
      .use(commonSet)
      .action(mockAction);

    await cli.execute(['--verbose', '--debug', '--output', 'file.txt', '--count', '42']);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test("should combine multiple flag sets", async () => {
    const mockAction = mock((args) => {
      expect(args.verbose).toBe(true);
      expect(args.debug).toBe(true);
      expect(args.output).toBe('result.txt');
      expect(args.format).toBe('json');
    });

    const logFlags = flagSet()
      .flag('verbose', { short: 'v' })
      .flag('debug');
    
    const outputSet = flagSet()
      .option('output', { type: 'string' })
      .option('format', { type: 'string' });

    const cli = command('test')
      .use(logFlags)
      .use(outputSet)
      .action(mockAction);

    await cli.execute(['--verbose', '--debug', '--output', 'result.txt', '--format', 'json']);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test("should handle command without action", async () => {
    const cli = command('test');
    // Should not throw when no action is defined
    await expect(cli.execute([])).resolves.toBeUndefined();
  });

  test("should handle flag defaults", async () => {
    const mockAction = mock((args) => {
      expect(args.verbose).toBe(false);
      expect(args.count).toBe(10);
    });

    const cli = command('test')
      .flag('verbose', { default: false })
      .option('count', { type: 'number', default: 10 })
      .action(mockAction);

    await cli.execute([]);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test("should handle short flags", async () => {
    const mockAction = mock((args) => {
      expect(args.verbose).toBe(true);
      expect(args.output).toBe('test.txt');
    });

    const cli = command('test')
      .flag('verbose', { short: 'v' })
      .option('output', { short: 'o', type: 'string' })
      .action(mockAction);

    await cli.execute(['-v', '-o', 'test.txt']);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test("should handle extra positional arguments in _", async () => {
    const mockAction = mock((args) => {
      expect(args.input).toBe('main.txt');
      expect(args._).toEqual(['extra1', 'extra2']);
    });

    const cli = command('test')
      .argument('input', { required: true })
      .action(mockAction);

    await cli.execute(['main.txt', 'extra1', 'extra2']);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
});
import { describe, test, expect } from "bun:test";
import { parseArgs, filterArgs, executeArgs, generateHelp, flag, option, positional, command } from "./argparse";

describe("parseArgs", () => {
  test("should parse empty args", () => {
    const result = parseArgs([]);
    expect(result).toEqual({
      flags: {},
      options: {},
      positional: []
    });
  });

  test("should parse long flags", () => {
    const result = parseArgs(["--verbose", "--debug"]);
    expect(result).toEqual({
      flags: { verbose: true, debug: true },
      options: {},
      positional: []
    });
  });

  test("should parse short flags", () => {
    const result = parseArgs(["-v", "-d"]);
    expect(result).toEqual({
      flags: { v: true, d: true },
      options: {},
      positional: []
    });
  });

  test("should parse combined short flags", () => {
    const result = parseArgs(["-vd"]);
    expect(result).toEqual({
      flags: { v: true, d: true },
      options: {},
      positional: []
    });
  });

  test("should parse long options with values", () => {
    const result = parseArgs(["--name", "john", "--age", "25"]);
    expect(result).toEqual({
      flags: {},
      options: { name: "john", age: "25" },
      positional: []
    });
  });

  test("should parse positional arguments", () => {
    const result = parseArgs(["file1", "file2", "file3"]);
    expect(result).toEqual({
      flags: {},
      options: {},
      positional: ["file1", "file2", "file3"]
    });
  });

  test("should parse mixed arguments", () => {
    const result = parseArgs(["--verbose", "-d", "--name", "john", "file1", "file2"]);
    expect(result).toEqual({
      flags: { verbose: true, d: true },
      options: { name: "john" },
      positional: ["file1", "file2"]
    });
  });

  test("should treat option without value as flag", () => {
    const result = parseArgs(["--verbose", "--debug"]);
    expect(result).toEqual({
      flags: { verbose: true, debug: true },
      options: {},
      positional: []
    });
  });

  test("should handle options at end of args", () => {
    const result = parseArgs(["--name", "john", "--verbose"]);
    expect(result).toEqual({
      flags: { verbose: true },
      options: { name: "john" },
      positional: []
    });
  });

  test("should handle option followed by flag-like value", () => {
    const result = parseArgs(["--name", "--john"]);
    expect(result).toEqual({
      flags: { name: true, john: true },
      options: {},
      positional: []
    });
  });

  test("should handle empty string arguments", () => {
    const result = parseArgs(["", "file"]);
    expect(result).toEqual({
      flags: {},
      options: {},
      positional: ["", "file"]
    });
  });

  test("should handle single dash as positional", () => {
    const result = parseArgs(["-"]);
    expect(result).toEqual({
      flags: {},
      options: {},
      positional: ["-"]
    });
  });

  test("should handle complex scenario", () => {
    const result = parseArgs(["-vd", "--name", "john", "input.txt", "--output", "result.txt", "extra"]);
    expect(result).toEqual({
      flags: { v: true, d: true },
      options: { name: "john", output: "result.txt" },
      positional: ["input.txt", "extra"]
    });
  });
});

describe("filterArgs", () => {
  test("should return args from index 2 for simple case", () => {
    const result = filterArgs(["node", "script.js", "arg1", "arg2"]);
    expect(result).toEqual(["arg1", "arg2"]);
  });

  test("should filter after .ts file", () => {
    const result = filterArgs(["bun", "run", "script.ts", "arg1", "arg2"]);
    expect(result).toEqual(["arg1", "arg2"]);
  });

  test("should filter after .js file", () => {
    const result = filterArgs(["node", "script.js", "arg1", "arg2"]);
    expect(result).toEqual(["arg1", "arg2"]);
  });

  test("should filter after .mjs file", () => {
    const result = filterArgs(["node", "script.mjs", "arg1", "arg2"]);
    expect(result).toEqual(["arg1", "arg2"]);
  });

  test("should filter after .cjs file", () => {
    const result = filterArgs(["node", "script.cjs", "arg1", "arg2"]);
    expect(result).toEqual(["arg1", "arg2"]);
  });

  test("should handle non-path argument after first arg", () => {
    const result = filterArgs(["cmd", "subcommand", "arg1", "arg2"]);
    expect(result).toEqual(["subcommand", "arg1", "arg2"]);
  });

  test("should return from index 2 when no script file found", () => {
    const result = filterArgs(["node", "--version", "extra"]);
    expect(result).toEqual(["extra"]);
  });

  test("should handle empty args", () => {
    const result = filterArgs([]);
    expect(result).toEqual([]);
  });

  test("should handle single arg", () => {
    const result = filterArgs(["node"]);
    expect(result).toEqual([]);
  });

  test("should handle path-like argument", () => {
    const result = filterArgs(["node", "/path/to/script", "arg1"]);
    expect(result).toEqual(["arg1"]);
  });

  test("should handle flag starting argument", () => {
    const result = filterArgs(["cmd", "--flag", "value"]);
    expect(result).toEqual(["value"]);
  });

  test("should handle script file at different positions", () => {
    const result = filterArgs(["bun", "--watch", "script.ts", "arg1", "arg2"]);
    expect(result).toEqual(["arg1", "arg2"]);
  });
});

describe("executeArgs", () => {
  test("should execute command with no arguments", async () => {
    let executed = false;
    const testCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: undefined,
      action: () => { executed = true; }
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: {}, options: {}, positional: [] };
    
    await executeArgs(args, commandMap);
    expect(executed).toBe(true);
  });

  test("should execute command with flags", async () => {
    let receivedFlags: any = {};
    const testCommand = command({
      flags: [
        flag({ name: "verbose", alternatives: ["v"] }),
        flag({ name: "debug", alternatives: [] })
      ],
      options: [],
      positional: [],
      subcommands: undefined,
      action: (options, flags, positional) => { receivedFlags = flags; }
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: { verbose: true, debug: true }, options: {}, positional: [] };
    
    await executeArgs(args, commandMap);
    expect(receivedFlags).toEqual({ verbose: true, debug: true });
  });

  test("should execute command with options", async () => {
    let receivedOptions: any = {};
    const testCommand = command({
      flags: [],
      options: [
        option({ name: "name", required: true, alternatives: [] }),
        option({ name: "age", required: false, alternatives: [] })
      ],
      positional: [],
      subcommands: undefined,
      action: (options, flags, positional) => { receivedOptions = options; }
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: {}, options: { name: "john", age: "25" }, positional: [] };
    
    await executeArgs(args, commandMap);
    expect(receivedOptions).toEqual({ name: "john", age: "25" });
  });

  test("should execute command with positional arguments", async () => {
    let receivedPositional: any = {};
    const testCommand = command({
      flags: [],
      options: [],
      positional: [
        positional({ name: "file", required: true }),
        positional({ name: "output", required: false })
      ],
      subcommands: undefined,
      action: (options, flags, positional) => { receivedPositional = positional; }
    });
    
    const commandMap = { mycommand: testCommand };
    const args = { flags: {}, options: {}, positional: ["mycommand", "input.txt", "output.txt"] };
    
    await executeArgs(args, commandMap);
    expect(receivedPositional).toEqual({ file: "input.txt", output: "output.txt" });
  });

  test("should handle flag alternatives", async () => {
    let receivedFlags: any = {};
    const testCommand = command({
      flags: [flag({ name: "verbose", alternatives: ["v"] })],
      options: [],
      positional: [],
      subcommands: undefined,
      action: (options, flags, positional) => { receivedFlags = flags; }
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: { v: true }, options: {}, positional: [] };
    
    await executeArgs(args, commandMap);
    expect(receivedFlags).toEqual({ verbose: true });
  });

  test("should handle option alternatives", async () => {
    let receivedOptions: any = {};
    const testCommand = command({
      flags: [],
      options: [option({ name: "output", required: false, alternatives: ["o"] })],
      positional: [],
      subcommands: undefined,
      action: (options, flags, positional) => { receivedOptions = options; }
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: {}, options: { o: "result.txt" }, positional: [] };
    
    await executeArgs(args, commandMap);
    expect(receivedOptions).toEqual({ output: "result.txt" });
  });

  test("should throw error for unknown command", async () => {
    const commandMap = { test: command({ flags: [], options: [], positional: [], subcommands: undefined, action: () => {} }) };
    const args = { flags: {}, options: {}, positional: ["unknown"] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Command unknown not found");
  });

  test("should throw error for unknown flag", async () => {
    const testCommand = command({
      flags: [flag({ name: "verbose", alternatives: [] })],
      options: [],
      positional: [],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: { unknown: true }, options: {}, positional: [] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Unknown flag: 'unknown'");
  });

  test("should throw error for unknown option", async () => {
    const testCommand = command({
      flags: [],
      options: [option({ name: "name", required: false, alternatives: [] })],
      positional: [],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: {}, options: { unknown: "value" }, positional: [] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Unknown option: 'unknown'");
  });

  test("should throw error for missing required option", async () => {
    const testCommand = command({
      flags: [],
      options: [option({ name: "name", required: true, alternatives: [] })],
      positional: [],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: {}, options: {}, positional: [] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Required option 'name' is missing");
  });

  test("should throw error for missing required positional", async () => {
    const testCommand = command({
      flags: [],
      options: [],
      positional: [positional({ name: "file", required: true })],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: {}, options: {}, positional: [] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Required positional argument 'file' is missing");
  });

  test("should throw error for extra positional arguments", async () => {
    const testCommand = command({
      flags: [],
      options: [],
      positional: [positional({ name: "file", required: true })],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { mycommand: testCommand };
    const args = { flags: {}, options: {}, positional: ["mycommand", "file1", "file2", "file3"] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Unexpected positional arguments: file2, file3");
  });

  test("should throw error for duplicate flag using different names", async () => {
    const testCommand = command({
      flags: [flag({ name: "verbose", alternatives: ["v"] })],
      options: [],
      positional: [],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: { verbose: true, v: true }, options: {}, positional: [] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Flag 'verbose' specified multiple times using different names: 'verbose' and 'v'");
  });

  test("should throw error for duplicate option using different names", async () => {
    const testCommand = command({
      flags: [],
      options: [option({ name: "output", required: false, alternatives: ["o"] })],
      positional: [],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: {}, options: { output: "file1.txt", o: "file2.txt" }, positional: [] };
    
    await expect(executeArgs(args, commandMap)).rejects.toThrow("Error: Option 'output' specified multiple times using different names: 'output' and 'o'");
  });

  test("should handle subcommands", async () => {
    let executed = false;
    const subCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: undefined,
      action: () => { executed = true; }
    });
    
    const mainCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: { sub: subCommand },
      action: () => {}
    });
    
    const commandMap = { main: mainCommand };
    const args = { flags: {}, options: {}, positional: ["main", "sub"] };
    
    await executeArgs(args, commandMap);
    expect(executed).toBe(true);
  });
});

describe("generateHelp", () => {
  test("should generate basic help for command with no arguments", () => {
    const testCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: undefined,
      description: "A simple test command",
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const help = generateHelp(commandMap, "_default", "myapp");
    
    expect(help).toContain("Usage: myapp");
    expect(help).toContain("A simple test command");
  });

  test("should generate help with flags and options", () => {
    const testCommand = command({
      flags: [
        flag({ name: "verbose", alternatives: ["v"], description: "Enable verbose output" }),
        flag({ name: "debug", alternatives: [], description: "Enable debug mode" })
      ],
      options: [
        option({ name: "output", required: false, alternatives: ["o"], description: "Output file path" }),
        option({ name: "config", required: true, alternatives: [], description: "Configuration file" })
      ],
      positional: [],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const help = generateHelp(commandMap, "_default", "myapp");
    
    expect(help).toContain("Usage: myapp [FLAGS] [OPTIONS]");
    expect(help).toContain("FLAGS:");
    expect(help).toContain("--verbose, -v    Enable verbose output");
    expect(help).toContain("--debug    Enable debug mode");
    expect(help).toContain("OPTIONS:");
    expect(help).toContain("--output, -o <value>    Output file path");
    expect(help).toContain("--config <value>    Configuration file (required)");
  });

  test("should generate help with positional arguments", () => {
    const testCommand = command({
      flags: [],
      options: [],
      positional: [
        positional({ name: "input", required: true, description: "Input file" }),
        positional({ name: "output", required: false, description: "Output file" })
      ],
      subcommands: undefined,
      action: () => {}
    });
    
    const commandMap = { _default: testCommand };
    const help = generateHelp(commandMap, "_default", "myapp");
    
    expect(help).toContain("Usage: myapp <input> [output]");
    expect(help).toContain("ARGUMENTS:");
    expect(help).toContain("input    Input file (required)");
    expect(help).toContain("output    Output file");
  });

  test("should generate help with subcommands", () => {
    const subCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: undefined,
      description: "A subcommand",
      action: () => {}
    });
    
    const mainCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: { sub: subCommand },
      description: "Main command",
      action: () => {}
    });
    
    const commandMap = { _default: mainCommand };
    const help = generateHelp(commandMap, "_default", "myapp");
    
    expect(help).toContain("Usage: myapp [SUBCOMMAND]");
    expect(help).toContain("SUBCOMMANDS:");
    expect(help).toContain("sub    A subcommand");
    expect(help).toContain("Use 'myapp [SUBCOMMAND] --help' for more information");
  });

  test("should generate help for named command", () => {
    const testCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: undefined,
      description: "Test command",
      action: () => {}
    });
    
    const commandMap = { test: testCommand };
    const help = generateHelp(commandMap, "test", "myapp");
    
    expect(help).toContain("Usage: myapp test");
    expect(help).toContain("Test command");
  });

  test("should handle command not found", () => {
    const commandMap = { test: command({ flags: [], options: [], positional: [], subcommands: undefined, action: () => {} }) };
    const help = generateHelp(commandMap, "unknown", "myapp");
    
    expect(help).toBe("Command 'unknown' not found");
  });
});

describe("executeArgs with help", () => {
  test("should show help when --help flag is used", async () => {
    let helpOutput = "";
    const originalLog = console.log;
    console.log = (message: string) => { helpOutput = message; };
    
    const testCommand = command({
      flags: [flag({ name: "verbose", alternatives: [], description: "Verbose mode" })],
      options: [],
      positional: [],
      subcommands: undefined,
      description: "Test command",
      action: () => { throw new Error("Should not execute action"); }
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: { help: true }, options: {}, positional: [] };
    
    await executeArgs(args, commandMap, "myapp");
    
    expect(helpOutput).toContain("Usage: myapp");
    expect(helpOutput).toContain("Test command");
    
    console.log = originalLog;
  });

  test("should show help when -h flag is used", async () => {
    let helpOutput = "";
    const originalLog = console.log;
    console.log = (message: string) => { helpOutput = message; };
    
    const testCommand = command({
      flags: [],
      options: [],
      positional: [],
      subcommands: undefined,
      action: () => { throw new Error("Should not execute action"); }
    });
    
    const commandMap = { _default: testCommand };
    const args = { flags: { h: true }, options: {}, positional: [] };
    
    await executeArgs(args, commandMap, "myapp");
    
    expect(helpOutput).toContain("Usage: myapp");
    
    console.log = originalLog;
  });
});
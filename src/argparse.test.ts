import { describe, test, expect } from "bun:test";
import { parseArgs, filterArgs } from "./argparse";

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
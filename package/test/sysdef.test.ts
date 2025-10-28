import { describe, test, expect } from "bun:test";
import { VariableStore } from "../src/sysdef";

describe("VariableStore", () => {
  describe("fillIn", () => {
    test("should replace single variable", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("Hello {name}!");
      expect(result).toBe("Hello John!");
    });

    test("should replace multiple variables", () => {
      const store = new VariableStore();
      store.set("first", "John");
      store.set("last", "Doe");
      
      const result = store.fillIn("{first} {last}");
      expect(result).toBe("John Doe");
    });

    test("should handle empty string", () => {
      const store = new VariableStore();
      
      const result = store.fillIn("");
      expect(result).toBe("");
    });

    test("should handle string without variables", () => {
      const store = new VariableStore();
      
      const result = store.fillIn("No variables here");
      expect(result).toBe("No variables here");
    });

    test("should handle undefined variables", () => {
      const store = new VariableStore();
      
      const result = store.fillIn("Hello {undefined}!");
      expect(result).toBe("Hello {undefined}!");
    });

    test("should handle empty variable name", () => {
      const store = new VariableStore();
      
      const result = store.fillIn("Hello {}!");
      expect(result).toBe("Hello {}!");
    });

    test("should handle nested braces", () => {
      const store = new VariableStore();
      store.set("var", "value");
      
      const result = store.fillIn("{{var}}");
      expect(result).toBe("{value}");
    });

    test("should handle unmatched opening brace", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("Hello {name");
      expect(result).toBe("Hello {name");
    });

    test("should handle unmatched closing brace", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("Hello name}");
      expect(result).toBe("Hello name}");
    });

    test("should handle multiple unmatched braces", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("{{{name");
      expect(result).toBe("{{{name");
    });

    test("should handle consecutive variables", () => {
      const store = new VariableStore();
      store.set("a", "A");
      store.set("b", "B");
      
      const result = store.fillIn("{a}{b}");
      expect(result).toBe("AB");
    });

    test("should handle variable at start of string", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("{name} is here");
      expect(result).toBe("John is here");
    });

    test("should handle variable at end of string", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("Hello {name}");
      expect(result).toBe("Hello John");
    });

    test("should handle same variable multiple times", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("{name} {name} {name}");
      expect(result).toBe("John John John");
    });

    test("should handle empty variable value", () => {
      const store = new VariableStore();
      store.set("empty", "");
      
      const result = store.fillIn("Hello {empty}world");
      expect(result).toBe("Hello world");
    });

    test("should handle variable with spaces in name", () => {
      const store = new VariableStore();
      store.set("full name", "John Doe");
      
      const result = store.fillIn("Hello {full name}!");
      expect(result).toBe("Hello John Doe!");
    });

    test("should handle variable with special characters in name", () => {
      const store = new VariableStore();
      store.set("var-1_test", "value");
      
      const result = store.fillIn("{var-1_test}");
      expect(result).toBe("value");
    });

    test("should handle braces in variable value", () => {
      const store = new VariableStore();
      store.set("brackets", "{value}");
      
      const result = store.fillIn("Result: {brackets}");
      expect(result).toBe("Result: {value}");
    });

    test("should handle multiple opening braces before variable", () => {
      const store = new VariableStore();
      store.set("name", "John");
      
      const result = store.fillIn("{{name}");
      expect(result).toBe("{John");
    });

    test("should handle complex nested scenario", () => {
      const store = new VariableStore();
      store.set("inner", "value");
      store.set("outer", "{inner}");
      
      const result = store.fillIn("{outer}");
      expect(result).toBe("{inner}");
    });

    test("should handle mixed content with variables and text", () => {
      const store = new VariableStore();
      store.set("name", "John");
      store.set("age", "25");
      
      const result = store.fillIn("Name: {name}, Age: {age}, Status: Active");
      expect(result).toBe("Name: John, Age: 25, Status: Active");
    });
  });
});

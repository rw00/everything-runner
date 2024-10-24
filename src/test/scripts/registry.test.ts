import fs from "fs";
import os from "os";
import path from "path";
import {
  BuiltInScriptProvider,
  FileSystemScriptProvider,
  IScriptProvider
} from "../../application/provider";
import { ScriptRegistry } from "../../application/registry";
import { sortTextScript } from "../../application/scripts/sort_text";
import {
  defineScript,
  resolveParams,
  toScriptDescriptor
} from "../../domain/script";
import {
  expandHomePath,
  loadSettings,
  saveSettings
} from "../../infrastructure/settings";

describe("ScriptRegistry and Dependency Injection", () => {
  const registry = new ScriptRegistry([new BuiltInScriptProvider()]);

  test("should list all built-in scripts with documentation", () => {
    const scripts = registry.getScripts();
    expect(scripts).toHaveLength(5);
    expect(scripts.map((s) => s.id)).toEqual([
      "sort-text",
      "count-words",
      "remove-duplicate-lines",
      "change-case",
      "format-json"
    ]);
    expect(scripts.map((s) => s.icon)).toEqual(["⇅", "#", "≠", "Aa", "{ }"]);
  });

  test("should accept custom IScriptProvider via Dependency Injection", () => {
    const mockProvider: IScriptProvider = {
      id: "mock-provider",
      provideScripts: () => [
        {
          definition: defineScript({
            id: "mock-script",
            name: "Mock Script",
            description: "Custom injected mock",
            icon: "🧪",
            run: (text) => `Mocked: ${text}`
          }),
          isCustom: true
        }
      ]
    };

    const diRegistry = new ScriptRegistry([mockProvider]);
    const scripts = diRegistry.getScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].id).toBe("mock-script");
    expect(scripts[0].isCustom).toBe(true);

    const res = diRegistry.execute("mock-script", "test input");
    expect(res.outputText).toBe("Mocked: test input");
  });

  test("should sort text in descending order and unescape delimiters", () => {
    const res = registry.execute("sort-text", "Banana\nApple\nCherry", {
      ascending: false,
      splitDelimiter: "\\n",
      joinSeparator: ", "
    });
    expect(res.outputText).toBe("Cherry, Banana, Apple");
    expect(res.error).toBeUndefined();
  });

  test("should return error on invalid regex in sort-text", () => {
    const res = registry.execute("sort-text", "a\nb", {
      splitDelimiter: "["
    });
    expect(res.error).toBeDefined();
    expect(res.outputText).toBe("a\nb");
  });

  test("should count words, characters, and lines accurately", () => {
    const res = registry.execute("count-words", "Hello world\nSecond line");
    expect(res.outputText).toBe("4");
    expect(res.resultData.words).toBe(4);
    expect(res.resultData.characters).toBe(23);
    expect(res.resultData.charactersNoSpaces).toBe(20);
    expect(res.resultData.lines).toBe(2);
  });

  test("should remove duplicate lines with case and trim options", () => {
    const res = registry.execute(
      "remove-duplicate-lines",
      "alpha\nbeta\nalpha\ngamma\nbeta"
    );
    expect(res.outputText).toBe("alpha\nbeta\ngamma");
    expect(res.resultData.removedCount).toBe(2);

    const caseInsensitive = registry.execute(
      "remove-duplicate-lines",
      "  Alpha \nalpha\nBETA\n beta ",
      {
        caseSensitive: false,
        trimLines: true
      }
    );
    expect(caseInsensitive.outputText).toBe("Alpha\nBETA");
    expect(caseInsensitive.resultData.removedCount).toBe(2);
  });

  test("should change case across all supported formats", () => {
    expect(
      registry.execute("change-case", "Hello World Example", {
        targetCase: "snake"
      }).outputText
    ).toBe("hello_world_example");

    expect(
      registry.execute("change-case", "Hello World", {
        targetCase: "upper"
      }).outputText
    ).toBe("HELLO WORLD");

    expect(
      registry.execute("change-case", "Hello World", {
        targetCase: "lower"
      }).outputText
    ).toBe("hello world");

    expect(
      registry.execute("change-case", "hello world example", {
        targetCase: "title"
      }).outputText
    ).toBe("Hello World Example");

    expect(
      registry.execute("change-case", "Hello_world-example", {
        targetCase: "camel"
      }).outputText
    ).toBe("helloWorldExample");

    expect(
      registry.execute("change-case", "hello_world_example", {
        targetCase: "pascal"
      }).outputText
    ).toBe("HelloWorldExample");

    expect(
      registry.execute("change-case", "HelloWorldExample", {
        targetCase: "kebab"
      }).outputText
    ).toBe("hello-world-example");
  });

  test("should format, sort keys, minify, and validate JSON", () => {
    const pretty = registry.execute("format-json", '{"b":1,"a":[3,2]}', {
      minify: false,
      sortKeys: true
    });
    expect(pretty.outputText).toBe(
      '{\n  "a": [\n    3,\n    2\n  ],\n  "b": 1\n}'
    );
    expect(pretty.resultData.valid).toBe(true);

    const minified = registry.execute(
      "format-json",
      '{\n  "b": 1,\n  "a": 2\n}',
      {
        minify: true,
        sortKeys: true
      }
    );
    expect(minified.outputText).toBe('{"a":2,"b":1}');

    const invalid = registry.execute("format-json", "{invalid json}");
    expect(invalid.resultData.valid).toBe(false);
    expect(invalid.error).toBeDefined();

    const empty = registry.execute("format-json", "   ");
    expect(empty.resultData.valid).toBe(false);
    expect(empty.error).toBe("Empty input");
  });

  test("should generate descriptor with paramsSchema and resolve params directly without .value", () => {
    const descriptor = toScriptDescriptor(sortTextScript);

    expect(descriptor.paramsSchema).toEqual([
      {
        key: "ascending",
        name: "Ascending Order (A → Z)",
        label: "Ascending Order (A → Z)",
        description: "Whether to sort in ascending order",
        type: "boolean",
        defaultValue: true,
        options: undefined,
        allowEmpty: undefined
      },
      {
        key: "splitDelimiter",
        name: "Split Delimiter (Regex)",
        label: "Split Delimiter (Regex)",
        description: "Regex used to split the text",
        type: "string",
        defaultValue: "\\n",
        options: undefined,
        allowEmpty: false
      },
      {
        key: "joinSeparator",
        name: "Join Separator",
        label: "Join Separator",
        description: "Character used to join the sorted lines",
        type: "string",
        defaultValue: "\\n",
        options: undefined,
        allowEmpty: undefined
      }
    ]);

    const resolved = resolveParams(sortTextScript.params, { ascending: false });
    expect(resolved.ascending).toBe(false);
    expect(resolved.splitDelimiter).toBe("\\n");
    expect(resolved.joinSeparator).toBe("\\n");
  });

  test("should support defineScript helper for custom scripts with full type inference", () => {
    const dummyScript = defineScript({
      id: "reverse-lines",
      name: "Reverse Lines",
      description: "Reverses lines in text",
      icon: "🔃",
      params: {
        preserveTrailingNewline: {
          name: "Preserve Trailing Newline",
          description: "Keep ending newline intact",
          type: "boolean",
          defaultValue: true
        }
      },
      run(text, params) {
        const lines = text.split("\n");
        const reversed = lines.reverse().join("\n");
        return params.preserveTrailingNewline ? reversed : reversed.trim();
      }
    });

    const res = dummyScript.run("one\ntwo\nthree", {
      preserveTrailingNewline: true
    });
    expect(res).toBe("three\ntwo\none");
  });

  test("should throw on unknown script ID", () => {
    expect(() => registry.execute("non-existent", "test")).toThrow(
      "Unknown script ID: non-existent"
    );
  });

  test("should load .js custom scripts via FileSystemScriptProvider and ignore .cjs files", () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "everything-runner-custom-")
    );
    try {
      const base64ScriptPath = path.join(tmpDir, "base64_encode.js");
      fs.writeFileSync(
        base64ScriptPath,
        `
        const { defineScript } = require("everything-runner");

        module.exports = defineScript({
          id: "base64-encode",
          name: "Base64 Encode",
          description: "Encodes the selected text into Base64 format.",
          icon: "64",
          params: {
            urlSafe: {
              name: "URL-Safe",
              description: "URL-safe format (-_ instead of +/)",
              type: "boolean",
              defaultValue: false
            }
          },
          run(text, params = {}) {
            if (!text) return "";
            let encoded = Buffer.from(text, "utf8").toString("base64");
            if (params.urlSafe) {
              encoded = encoded.replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
            }
            return encoded;
          }
        });
        `,
        "utf8"
      );

      // Create a .cjs file that should be ignored
      const cjsScriptPath = path.join(tmpDir, "ignored_script.cjs");
      fs.writeFileSync(
        cjsScriptPath,
        `
        module.exports = {
          id: "ignored-cjs",
          name: "Ignored CJS",
          run: (t) => t
        };
        `,
        "utf8"
      );

      const fsProvider = new FileSystemScriptProvider(tmpDir);
      const customRegistry = new ScriptRegistry([
        new BuiltInScriptProvider(),
        fsProvider
      ]);
      const allScripts = customRegistry.getScripts();

      // 5 built-in + 1 .js script = 6 total (the .cjs script MUST be ignored)
      expect(allScripts).toHaveLength(6);
      expect(allScripts.some((s) => s.id === "ignored-cjs")).toBe(false);

      const base64Doc = allScripts.find((s) => s.id === "base64-encode");
      expect(base64Doc).toBeDefined();
      expect(base64Doc?.name).toBe("Base64 Encode");
      expect(base64Doc?.isCustom).toBe(true);
      expect(base64Doc?.paramsSchema?.[0].name).toBe("URL-Safe");

      const encodedRes = customRegistry.execute(
        "base64-encode",
        "Hello Everything Runner!"
      );
      expect(encodedRes.outputText).toBe("SGVsbG8gRXZlcnl0aGluZyBSdW5uZXIh");
      expect(encodedRes.error).toBeUndefined();

      const urlSafeRes = customRegistry.execute("base64-encode", "subjects?d", {
        urlSafe: true
      });
      expect(urlSafeRes.outputText).toBe("c3ViamVjdHM_ZA");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("should support async script execution via executeAsync", async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "everything-runner-async-")
    );
    try {
      const asyncScriptPath = path.join(tmpDir, "async_echo.js");
      fs.writeFileSync(
        asyncScriptPath,
        `
        module.exports = {
          id: "async-echo",
          name: "Async Echo",
          description: "Asynchronously echoes text with simulated delay",
          icon: "⏳",
          async run(text) {
            await new Promise((r) => setTimeout(r, 10));
            return {
              text: "Async: " + text,
              badge: "Delayed Echo"
            };
          }
        };
        `,
        "utf8"
      );

      const asyncRegistry = new ScriptRegistry([
        new FileSystemScriptProvider(tmpDir)
      ]);
      const res = await asyncRegistry.executeAsync("async-echo", "hello");
      expect(res.outputText).toBe("Async: hello");
      expect(res.badge).toBe("Delayed Echo");
      expect(res.error).toBeUndefined();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("should provide stats and badge metadata without hardcoding", () => {
    const wordCountRes = registry.execute("count-words", "alpha beta gamma");
    expect(wordCountRes.badge).toBe('Enter copies "3"');
    expect(wordCountRes.stats).toEqual([
      { label: "Words", value: 3, primary: true },
      { label: "Characters (with spaces)", value: 16, primary: false },
      { label: "Characters (no spaces)", value: 14, primary: false },
      { label: "Lines", value: 1, primary: false }
    ]);

    const dupRes = registry.execute(
      "remove-duplicate-lines",
      "line1\nline1\nline2"
    );
    expect(dupRes.badge).toBe("1 duplicate(s) removed · 2 lines");
  });

  test("should expand ~ in settings paths and persist settings", () => {
    expect(expandHomePath("~/runner-custom-scripts")).toBe(
      path.join(os.homedir(), "runner-custom-scripts")
    );

    const tmpSettingsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "everything-runner-settings-")
    );
    const settingsFile = path.join(tmpSettingsDir, "settings.json");
    try {
      saveSettings(
        { customScriptsDir: "~/runner-custom-scripts" },
        settingsFile
      );
      const loaded = loadSettings(settingsFile);
      expect(loaded.customScriptsDir).toBe("~/runner-custom-scripts");
    } finally {
      fs.rmSync(tmpSettingsDir, { recursive: true, force: true });
    }
  });
});

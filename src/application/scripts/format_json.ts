import { BuiltInScriptId, ScriptMode } from "../../domain/common";
import { defineScript } from "../../domain/script";

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonKeys(item));
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    const sorted: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      sorted[k] = sortJsonKeys(v);
    }
    return sorted;
  }
  return value;
}

export const formatJsonScript = defineScript({
  id: BuiltInScriptId.FormatJson,
  name: "Format / Minify JSON",
  description:
    "Pretty-prints or minifies JSON text with customizable indentation.",
  icon: "{ }",
  mode: ScriptMode.Transform,
  params: {
    minify: {
      name: "Minify (Single Line)",
      description: "Compress JSON into a single line without whitespace",
      type: "boolean",
      defaultValue: false
    },
    sortKeys: {
      name: "Sort Object Keys",
      description: "Sort object keys alphabetically",
      type: "boolean",
      defaultValue: false
    }
  },
  run(raw, { minify, sortKeys }) {
    const text = raw.trim();
    if (!text) {
      return {
        text: "",
        data: { valid: false },
        error: "Empty input"
      };
    }

    try {
      const parsed: unknown = JSON.parse(text);
      const normalized = sortKeys ? sortJsonKeys(parsed) : parsed;
      const formatted = minify
        ? JSON.stringify(normalized)
        : JSON.stringify(normalized, null, 2);

      return {
        text: formatted,
        data: { valid: true }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      return {
        text,
        data: { valid: false },
        error: message
      };
    }
  }
});

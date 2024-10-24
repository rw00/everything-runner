import { BuiltInScriptId, ScriptMode } from "../../domain/common";
import { defineScript } from "../../domain/script";

export const removeDuplicateLinesScript = defineScript({
  id: BuiltInScriptId.RemoveDuplicateLines,
  name: "Remove Duplicate Lines",
  description:
    "Removes duplicate lines from the selected text while preserving order.",
  icon: "≠",
  mode: ScriptMode.Transform,
  params: {
    caseSensitive: {
      name: "Case Sensitive",
      description: "Whether line comparisons are case sensitive",
      type: "boolean",
      defaultValue: true
    },
    trimLines: {
      name: "Trim Whitespace",
      description: "Trim whitespace before comparing lines",
      type: "boolean",
      defaultValue: false
    }
  },
  run(source, params) {
    if (!source) {
      return {
        text: "",
        badge: "0 lines",
        data: { removedCount: 0 }
      };
    }

    const lines = source.split(/\r?\n/);
    const seen = new Set<string>();
    const uniqueLines: string[] = [];

    for (const line of lines) {
      let key = params.trimLines ? line.trim() : line;
      if (!params.caseSensitive) {
        key = key.toLowerCase();
      }
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLines.push(params.trimLines ? line.trim() : line);
      }
    }

    const removedCount = lines.length - uniqueLines.length;
    const outLines = uniqueLines.length;

    return {
      text: uniqueLines.join("\n"),
      badge: `${removedCount} duplicate(s) removed · ${outLines} line${outLines === 1 ? "" : "s"}`,
      data: { removedCount }
    };
  }
});

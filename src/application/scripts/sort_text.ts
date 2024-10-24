import { BuiltInScriptId, ScriptMode } from "../../domain/common";
import { defineScript } from "../../domain/script";

export const sortTextScript = defineScript({
  id: BuiltInScriptId.SortText,
  name: "Sort Text",
  description:
    "Sorts the selected text; splitting into lines firstly and then joining.",
  icon: "⇅",
  mode: ScriptMode.Transform,
  params: {
    ascending: {
      name: "Ascending Order (A → Z)",
      description: "Whether to sort in ascending order",
      type: "boolean",
      defaultValue: true
    },
    splitDelimiter: {
      name: "Split Delimiter (Regex)",
      description: "Regex used to split the text",
      type: "string",
      defaultValue: "\\n",
      allowEmpty: false
    },
    joinSeparator: {
      name: "Join Separator",
      description: "Character used to join the sorted lines",
      type: "string",
      defaultValue: "\\n"
    }
  },
  run(text, params) {
    if (!text) {
      return "";
    }

    const unescapedDelimiter = params.splitDelimiter
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r");
    const delimiterPattern =
      unescapedDelimiter === "\n" ? /\r?\n/ : new RegExp(unescapedDelimiter);

    const lines = text.split(delimiterPattern);
    if (lines.length === 0) {
      return "";
    }

    lines.sort((a, b) => {
      return params.ascending ? a.localeCompare(b) : b.localeCompare(a);
    });

    const unescapedSeparator = params.joinSeparator
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r");

    return lines.join(unescapedSeparator);
  }
});

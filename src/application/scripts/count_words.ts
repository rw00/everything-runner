import { BuiltInScriptId, ScriptMode } from "../../domain/common";
import { defineScript } from "../../domain/script";

export const countWordsScript = defineScript({
  id: BuiltInScriptId.CountWords,
  name: "Count Words",
  description: "Counts the words, characters, and lines in the selected text.",
  icon: "#",
  mode: ScriptMode.Info,
  run(raw) {
    const trimmed = raw.trim();
    const count = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
    const characters = raw.length;
    const charactersNoSpaces = raw.replace(/\s/g, "").length;
    const lines = raw.length === 0 ? 0 : raw.split(/\r?\n/).length;

    return {
      text: String(count),
      badge: `Enter copies "${count}"`,
      stats: [
        { label: "Words", value: count, primary: true },
        {
          label: "Characters (with spaces)",
          value: characters,
          primary: false
        },
        {
          label: "Characters (no spaces)",
          value: charactersNoSpaces,
          primary: false
        },
        { label: "Lines", value: lines, primary: false }
      ],
      data: {
        count,
        words: count,
        characters,
        charactersNoSpaces,
        lines
      }
    };
  }
});

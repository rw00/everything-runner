import { BuiltInScriptId, ScriptMode } from "../../domain/common";
import { defineScript } from "../../domain/script";

export enum TargetCase {
  Upper = "upper",
  Lower = "lower",
  Title = "title",
  Camel = "camel",
  Pascal = "pascal",
  Snake = "snake",
  Kebab = "kebab"
}

function splitIntoWords(text: string): string[] {
  return text
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0);
}

export const changeCaseScript = defineScript({
  id: BuiltInScriptId.ChangeCase,
  name: "Change Case",
  description:
    "Converts text between UPPERCASE, lowercase, Title Case, camelCase, PascalCase, snake_case, and kebab-case.",
  icon: "Aa",
  mode: ScriptMode.Transform,
  params: {
    targetCase: {
      name: "Target Case",
      description: "The case formatting style to apply to the text",
      type: "select",
      defaultValue: TargetCase.Upper,
      options: [
        { label: "UPPERCASE", value: TargetCase.Upper },
        { label: "lowercase", value: TargetCase.Lower },
        { label: "Title Case", value: TargetCase.Title },
        { label: "camelCase", value: TargetCase.Camel },
        { label: "PascalCase", value: TargetCase.Pascal },
        { label: "snake_case", value: TargetCase.Snake },
        { label: "kebab-case", value: TargetCase.Kebab }
      ]
    }
  },
  run(text, { targetCase }) {
    switch (targetCase) {
      case TargetCase.Upper:
        return text.toUpperCase();
      case TargetCase.Lower:
        return text.toLowerCase();
      case TargetCase.Title:
        return text.replace(
          /\w\S*/g,
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        );
      case TargetCase.Camel: {
        const words = splitIntoWords(text);
        return words
          .map((w, i) =>
            i === 0
              ? w.toLowerCase()
              : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          )
          .join("");
      }
      case TargetCase.Pascal: {
        const words = splitIntoWords(text);
        return words
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join("");
      }
      case TargetCase.Snake: {
        const words = splitIntoWords(text);
        return words.map((w) => w.toLowerCase()).join("_");
      }
      case TargetCase.Kebab: {
        const words = splitIntoWords(text);
        return words.map((w) => w.toLowerCase()).join("-");
      }
      default:
        return text;
    }
  }
});

import { AnyScriptDefinition } from "../domain/script";
import { loadCustomScriptsFromDir } from "../infrastructure/custom_scripts";
import { changeCaseScript } from "./scripts/change_case";
import { countWordsScript } from "./scripts/count_words";
import { formatJsonScript } from "./scripts/format_json";
import { removeDuplicateLinesScript } from "./scripts/remove_duplicates";
import { sortTextScript } from "./scripts/sort_text";

export interface ScriptProviderItem {
  definition: AnyScriptDefinition;
  isCustom?: boolean;
  filePath?: string;
}

export interface IScriptProvider {
  readonly id: string;
  provideScripts(): Promise<ScriptProviderItem[]> | ScriptProviderItem[];
}

export const DEFAULT_BUILT_IN_SCRIPTS: AnyScriptDefinition[] = [
  sortTextScript,
  countWordsScript,
  removeDuplicateLinesScript,
  changeCaseScript,
  formatJsonScript
];

export class BuiltInScriptProvider implements IScriptProvider {
  public readonly id = "builtin";
  private readonly scripts: AnyScriptDefinition[];

  constructor(scripts: AnyScriptDefinition[] = DEFAULT_BUILT_IN_SCRIPTS) {
    this.scripts = [...scripts];
  }

  public provideScripts(): ScriptProviderItem[] {
    return this.scripts.map((definition) => ({
      definition,
      isCustom: false
    }));
  }
}

export class FileSystemScriptProvider implements IScriptProvider {
  public readonly id = "filesystem";
  private directory: string;

  constructor(directory = "") {
    this.directory = directory.trim();
  }

  public getDirectory(): string {
    return this.directory;
  }

  public setDirectory(directory: string): void {
    this.directory = directory.trim();
  }

  public provideScripts(): ScriptProviderItem[] {
    if (!this.directory) {
      return [];
    }

    const loaded = loadCustomScriptsFromDir(this.directory);
    return loaded.map((item) => ({
      definition: item.definition,
      isCustom: true,
      filePath: item.filePath
    }));
  }
}

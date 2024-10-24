export {
  BuiltInScriptId,
  CapturedTextSource,
  ConfirmAction,
  HelperCommand,
  IpcChannel,
  ScriptMode,
  ScriptParamType
} from "./domain/common";

export {
  defineScript,
  resolveParams,
  toScriptDescriptor,
  type BaseParamDefinition,
  type BooleanParamDefinition,
  type InferParams,
  type NumberParamDefinition,
  type ParamDefinition,
  type ParamOption,
  type ParamType,
  type ScriptDefinition,
  type ScriptDescriptor,
  type ScriptExecutionResponse,
  type ScriptOutput,
  type ScriptParamField,
  type ScriptParamsSchema,
  type ScriptRunResult,
  type ScriptStatItem,
  type SelectParamDefinition,
  type StringParamDefinition
} from "./domain/script";

export {
  BuiltInScriptProvider,
  DEFAULT_BUILT_IN_SCRIPTS,
  FileSystemScriptProvider,
  type IScriptProvider,
  type ScriptProviderItem
} from "./application/provider";

export { ScriptRegistry } from "./application/registry";

export {
  changeCaseScript,
  TargetCase
} from "./application/scripts/change_case";
export { countWordsScript } from "./application/scripts/count_words";
export { formatJsonScript } from "./application/scripts/format_json";
export { removeDuplicateLinesScript } from "./application/scripts/remove_duplicates";
export { sortTextScript } from "./application/scripts/sort_text";

export {
  loadCustomScriptsFromDir,
  type LoadedCustomScript
} from "./infrastructure/custom_scripts";

export {
  ensureSettingsFile,
  expandHomePath,
  getSettingsPath,
  loadSettings,
  saveSettings,
  type RunnerSettings
} from "./infrastructure/settings";

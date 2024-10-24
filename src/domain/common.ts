export enum ScriptMode {
  Transform = "transform",
  Info = "info"
}

export enum ScriptParamType {
  Boolean = "boolean",
  String = "string",
  Select = "select",
  Number = "number"
}

export enum BuiltInScriptId {
  SortText = "sort-text",
  CountWords = "count-words",
  RemoveDuplicateLines = "remove-duplicate-lines",
  ChangeCase = "change-case",
  FormatJson = "format-json"
}

export enum CapturedTextSource {
  Selection = "selection",
  Clipboard = "clipboard",
  Empty = "empty"
}

export enum ConfirmAction {
  Copy = "copy",
  Replace = "replace"
}

export enum HelperCommand {
  Capture = "capture",
  Replace = "replace",
  ActivateTarget = "activate-target",
  FocusSelf = "focus-self"
}

export enum IpcChannel {
  ScriptsList = "scripts:list",
  ScriptsRun = "scripts:run",
  ScriptsUpdated = "scripts:updated",
  SettingsGet = "settings:get",
  SettingsSave = "settings:save",
  SettingsBrowseDir = "settings:browse-dir",
  SettingsOpenFile = "settings:open-file",
  AppConfirm = "app:confirm",
  AppDismiss = "app:dismiss",
  AppOpenAccessibility = "app:open-accessibility",
  AppSummoned = "app:summoned",
  AppOpenSettings = "app:open-settings"
}

import { ScriptMode } from "../domain/common";
import type { ScriptStatItem } from "../domain/script";
import type { SettingsPayload } from "../electron/preload";
import { elements } from "./elements";
import { getActiveScript, runnerStore } from "./store";

export function renderPreviewMessage(className: string, message: string): void {
  const previewBody = elements.previewBody;
  previewBody.textContent = "";
  const div = document.createElement("div");
  div.className = className;
  div.textContent = message;
  previewBody.appendChild(div);
}

export function renderStatsGrid(items: ScriptStatItem[]): void {
  const previewBody = elements.previewBody;
  previewBody.textContent = "";
  const grid = document.createElement("div");
  grid.className = "stats-grid";

  for (const item of items) {
    const card = document.createElement("div");
    card.className = item.primary ? "stat-card primary" : "stat-card";

    const valEl = document.createElement("div");
    valEl.className = "stat-value";
    valEl.textContent = String(item.value);

    const labelEl = document.createElement("div");
    labelEl.className = "stat-label";
    labelEl.textContent = item.label;

    card.appendChild(valEl);
    card.appendChild(labelEl);
    grid.appendChild(card);
  }

  previewBody.appendChild(grid);
}

export function renderCodePreview(text: string): void {
  const previewBody = elements.previewBody;
  previewBody.textContent = "";
  const pre = document.createElement("pre");
  pre.className = "preview-code";
  pre.textContent = text;
  previewBody.appendChild(pre);
}

export function updateFooterButtons(): void {
  const script = getActiveScript();
  const { currentAppName } = runnerStore.getState();
  const targetName = currentAppName || "App";

  if (script && script.mode === ScriptMode.Info) {
    elements.btnCopy.classList.add("action-btn-primary");
    elements.btnReplace.classList.remove("action-btn-primary");
    elements.copyKbd.textContent = "↵";
    elements.copyLabel.textContent = "Copy Result";
    elements.replaceKbd.textContent = "⌘↵";
    elements.replaceLabel.textContent = `Paste in ${targetName}`;
  } else {
    elements.btnReplace.classList.add("action-btn-primary");
    elements.btnCopy.classList.remove("action-btn-primary");
    elements.replaceKbd.textContent = "↵";
    elements.replaceLabel.textContent = `Replace in ${targetName}`;
    elements.copyKbd.textContent = "⌥↵";
    elements.copyLabel.textContent = "Copy Only";
  }
}

export function updateInputMeta(source: string): void {
  const { currentInputText, currentAppName } = runnerStore.getState();
  const len = currentInputText.length;
  const lines = len === 0 ? 0 : currentInputText.split(/\r?\n/).length;
  elements.inputSummary.textContent = `${len} chars · ${lines} line${lines === 1 ? "" : "s"}`;

  const appSuffix = currentAppName ? ` in ${currentAppName}` : "";
  if (source === "selection") {
    elements.sourceLabel.textContent = `Selected${appSuffix} (${len} chars)`;
  } else if (source === "clipboard") {
    elements.sourceLabel.textContent = `Clipboard (${len} chars)`;
  } else if (source === "manual") {
    elements.sourceLabel.textContent = `Edited (${len} chars)`;
  } else {
    elements.sourceLabel.textContent = "Empty Input";
  }
}

export function updateSettingsMeta(settingsPayload?: SettingsPayload): void {
  if (!settingsPayload) {
    return;
  }
  if (document.activeElement !== elements.customScriptsDirInput) {
    elements.customScriptsDirInput.value =
      settingsPayload.customScriptsDir || "";
  }
  const count = settingsPayload.customScriptCount || 0;
  if (settingsPayload.customScriptsDir) {
    elements.settingsMeta.textContent = `${count} custom script${count === 1 ? "" : "s"} loaded from ${settingsPayload.customScriptsDir}`;
  } else {
    elements.settingsMeta.textContent = `Settings file: ${settingsPayload.settingsFilePath || "~/.everything-runner/settings.json"}`;
  }
}

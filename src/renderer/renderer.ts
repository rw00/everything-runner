import { ConfirmAction } from "../domain/common";
import { debounce } from "./debounce";
import { elements } from "./elements";
import { setupKeyboardNavigation } from "./keyboard";
import { renderParamsPanel } from "./paramsPanel";
import {
  renderCodePreview,
  renderPreviewMessage,
  renderStatsGrid,
  updateFooterButtons,
  updateInputMeta,
  updateSettingsMeta
} from "./previewPanel";
import { getActiveScript, getParamsForScript, runnerStore } from "./store";
import { renderToolList } from "./toolList";

const api = window.everythingRunner;
const DEBOUNCE_WAIT_MS = 120;

async function executeCurrentScriptImmediate(): Promise<void> {
  const state = runnerStore.getState();
  const nextSeq = state.executionSeq + 1;
  runnerStore.setState({ executionSeq: nextSeq });

  const script = getActiveScript();
  updateFooterButtons();

  if (!script?.id) {
    elements.previewTitle.textContent = "No Tool Selected";
    elements.previewBadge.textContent = "";
    renderPreviewMessage("preview-empty", "No matching tool found.");
    runnerStore.setState({ currentOutputText: "" });
    return;
  }

  const params = getParamsForScript(script);
  let res;
  try {
    res = await api.runScript(script.id, state.currentInputText, params);
  } catch (err) {
    if (nextSeq !== runnerStore.getState().executionSeq) {
      return;
    }
    elements.previewTitle.textContent = `${script.name} — Result`;
    elements.previewBadge.textContent = "Error";
    renderPreviewMessage(
      "preview-error",
      `⚠️ ${err instanceof Error ? err.message : "Execution failed"}`
    );
    return;
  }

  if (nextSeq !== runnerStore.getState().executionSeq) {
    return;
  }

  runnerStore.setState({ currentOutputText: res.outputText });
  elements.previewTitle.textContent = `${script.name} — Result`;

  if (res.error) {
    elements.previewBadge.textContent = "Error";
    renderPreviewMessage("preview-error", `⚠️ ${res.error}`);
    return;
  }

  elements.previewBadge.textContent = res.badge ?? "";

  if (res.stats && res.stats.length > 0) {
    renderStatsGrid(res.stats);
    return;
  }

  if (!res.outputText) {
    renderPreviewMessage(
      "preview-empty",
      "Select text in any app and press ⌘⌥⇧Space (or click the top-right badge to type/paste input text)."
    );
  } else {
    renderCodePreview(res.outputText);
  }
}

const executeCurrentScriptDebounced = debounce(
  () => void executeCurrentScriptImmediate(),
  DEBOUNCE_WAIT_MS
);

function executeCurrentScript(immediate = false): void {
  if (immediate) {
    executeCurrentScriptDebounced.cancel();
    void executeCurrentScriptImmediate();
  } else {
    executeCurrentScriptDebounced();
  }
}

function selectToolIndex(index: number): void {
  runnerStore.setState({ selectedIndex: index });
  renderToolList(selectToolIndex);
  renderParamsPanel(handleParamChange);
  updateFooterButtons();
  executeCurrentScript(true);
}

function handleParamChange(): void {
  executeCurrentScript(false);
}

function applyFilter(preserveSelection = false): void {
  const state = runnerStore.getState();
  const previousActiveId =
    preserveSelection && getActiveScript() ? getActiveScript()?.id : null;
  const query = elements.searchInput.value.trim().toLowerCase();

  const filteredScripts = !query
    ? [...state.allScripts]
    : state.allScripts.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      );

  let selectedIndex = 0;
  if (previousActiveId) {
    const foundIdx = filteredScripts.findIndex(
      (s) => s.id === previousActiveId
    );
    selectedIndex = foundIdx >= 0 ? foundIdx : 0;
  }

  runnerStore.setState({
    searchQuery: query,
    filteredScripts,
    selectedIndex
  });

  renderToolList(selectToolIndex);
  renderParamsPanel(handleParamChange);
  updateFooterButtons();
  executeCurrentScript(false);
}

async function saveCustomScriptsSettings(): Promise<void> {
  const dir = elements.customScriptsDirInput.value.trim();
  const payload = await api.saveSettings(dir);
  updateSettingsMeta(payload);
  if (Array.isArray(payload.scripts)) {
    runnerStore.setState({ allScripts: payload.scripts });
    applyFilter(true);
  }
}

async function confirmResult(action: ConfirmAction): Promise<void> {
  const script = getActiveScript();
  if (!script) {
    return;
  }
  const { currentOutputText } = runnerStore.getState();
  await api.confirmResult(currentOutputText, action);
}

function setupEventListeners(): void {
  elements.searchInput.addEventListener("input", () => {
    applyFilter();
  });

  elements.toggleInputBtn.addEventListener("click", () => {
    elements.inputDrawer.classList.toggle("hidden");
    if (!elements.inputDrawer.classList.contains("hidden")) {
      elements.inputTextarea.focus();
    }
  });

  elements.toggleSettingsBtn.addEventListener("click", () => {
    void (async () => {
      elements.settingsDrawer.classList.toggle("hidden");
      if (!elements.settingsDrawer.classList.contains("hidden")) {
        const settingsPayload = await api.getSettings();
        updateSettingsMeta(settingsPayload);
        elements.customScriptsDirInput.focus();
        elements.customScriptsDirInput.select();
      }
    })();
  });

  elements.browseScriptsDirBtn.addEventListener("click", () => {
    void (async () => {
      const selected = await api.browseScriptsDir();
      if (selected) {
        elements.customScriptsDirInput.value = selected;
        await saveCustomScriptsSettings();
      }
    })();
  });

  elements.saveSettingsBtn.addEventListener("click", () => {
    void saveCustomScriptsSettings();
  });

  elements.openSettingsFileBtn.addEventListener("click", () => {
    void api.openSettingsFile();
  });

  elements.customScriptsDirInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      void saveCustomScriptsSettings();
    }
  });

  elements.inputTextarea.addEventListener("input", () => {
    const text = elements.inputTextarea.value;
    runnerStore.setState({ currentInputText: text });
    updateInputMeta("manual");
    executeCurrentScript(false);
  });

  elements.accessibilityBtn.addEventListener("click", () => {
    void api.openAccessibility();
  });

  elements.btnCopy.addEventListener("click", () => {
    void confirmResult(ConfirmAction.Copy);
  });

  elements.btnReplace.addEventListener("click", () => {
    void confirmResult(ConfirmAction.Replace);
  });

  elements.paramsContainer.addEventListener("focusin", () => {
    elements.paramsContainer.classList.add("focused-within");
  });

  elements.paramsContainer.addEventListener("focusout", () => {
    elements.paramsContainer.classList.remove("focused-within");
  });

  setupKeyboardNavigation({
    onSelectIndex: selectToolIndex,
    onConfirm: (action) => {
      void confirmResult(action);
    },
    onToggleSettings: () => {
      elements.toggleSettingsBtn.click();
    },
    onDismiss: () => {
      void api.dismiss();
    }
  });

  api.onScriptsUpdated((scripts) => {
    if (Array.isArray(scripts)) {
      runnerStore.setState({ allScripts: scripts });
      applyFilter(true);
    }
    void api.getSettings().then(updateSettingsMeta);
  });

  api.onOpenSettings(() => {
    void (async () => {
      elements.settingsDrawer.classList.remove("hidden");
      const settingsPayload = await api.getSettings();
      updateSettingsMeta(settingsPayload);
      elements.customScriptsDirInput.focus();
      elements.customScriptsDirInput.select();
    })();
  });

  api.onSummon((payload) => {
    void (async () => {
      const inputText = payload.text ?? "";
      const appName = payload.appName ?? "";

      runnerStore.setState({
        currentInputText: inputText,
        currentAppName: appName
      });

      elements.inputTextarea.value = inputText;
      updateInputMeta(payload.source);
      updateFooterButtons();

      if (payload.accessibilityTrusted) {
        elements.accessibilityBtn.classList.add("hidden");
      } else {
        elements.accessibilityBtn.classList.remove("hidden");
      }

      if (!inputText) {
        elements.inputDrawer.classList.remove("hidden");
      } else {
        elements.inputDrawer.classList.add("hidden");
      }

      elements.settingsDrawer.classList.add("hidden");
      elements.searchInput.value = "";
      elements.searchInput.focus();

      if (payload.settings) {
        updateSettingsMeta(payload.settings);
        if (Array.isArray(payload.settings.scripts)) {
          runnerStore.setState({ allScripts: payload.settings.scripts });
        }
      } else {
        const scripts = await api.getScripts();
        runnerStore.setState({ allScripts: scripts });
        const settingsPayload = await api.getSettings();
        updateSettingsMeta(settingsPayload);
      }

      applyFilter();
    })();
  });
}

async function init(): Promise<void> {
  setupEventListeners();
  const scripts = await api.getScripts();
  const settingsPayload = await api.getSettings();
  updateSettingsMeta(settingsPayload);

  runnerStore.setState({
    allScripts: scripts,
    filteredScripts: [...scripts]
  });

  renderToolList(selectToolIndex);
  renderParamsPanel(handleParamChange);
  updateFooterButtons();
  executeCurrentScript(true);
  elements.searchInput.focus();
}

void init();

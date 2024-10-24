import { ConfirmAction, ScriptMode } from "../domain/common";
import { elements } from "./elements";
import { getActiveScript, runnerStore } from "./store";

interface KeyboardHandlers {
  onSelectIndex: (index: number) => void;
  onConfirm: (action: ConfirmAction) => void;
  onToggleSettings: () => void;
  onDismiss: () => void;
}

export function setupKeyboardNavigation(handlers: KeyboardHandlers): void {
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault();
      handlers.onToggleSettings();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (
        document.activeElement &&
        document.activeElement !== elements.searchInput
      ) {
        elements.searchInput.focus();
        return;
      }
      handlers.onDismiss();
      return;
    }

    if (
      e.key === "Enter" &&
      document.activeElement !== elements.inputTextarea &&
      document.activeElement !== elements.customScriptsDirInput
    ) {
      e.preventDefault();
      const script = getActiveScript();
      if (e.altKey) {
        handlers.onConfirm(ConfirmAction.Copy);
      } else if (e.metaKey || e.ctrlKey) {
        handlers.onConfirm(ConfirmAction.Replace);
      } else if (script && script.mode === ScriptMode.Info) {
        handlers.onConfirm(ConfirmAction.Copy);
      } else {
        handlers.onConfirm(ConfirmAction.Replace);
      }
      return;
    }

    if (
      e.key === "Tab" &&
      document.activeElement !== elements.inputTextarea &&
      document.activeElement !== elements.customScriptsDirInput
    ) {
      const controls = Array.from(
        elements.paramsFields.querySelectorAll<HTMLElement>(".param-control")
      );
      if (controls.length > 0) {
        e.preventDefault();
        const activeIdx = controls.indexOf(
          document.activeElement as HTMLElement
        );
        if (activeIdx === -1) {
          controls[0].focus();
          if ("select" in controls[0]) {
            (controls[0] as HTMLInputElement).select();
          }
        } else if (e.shiftKey) {
          if (activeIdx === 0) {
            elements.searchInput.focus();
          } else {
            controls[activeIdx - 1].focus();
          }
        } else {
          if (activeIdx + 1 < controls.length) {
            controls[activeIdx + 1].focus();
            if ("select" in controls[activeIdx + 1]) {
              (controls[activeIdx + 1] as HTMLInputElement).select();
            }
          } else {
            elements.searchInput.focus();
          }
        }
      }
      return;
    }

    const isSelectFocused =
      document.activeElement && document.activeElement.tagName === "SELECT";
    if (
      document.activeElement !== elements.inputTextarea &&
      document.activeElement !== elements.customScriptsDirInput &&
      !isSelectFocused
    ) {
      const { filteredScripts, selectedIndex } = runnerStore.getState();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredScripts.length > 0) {
          const nextIndex = (selectedIndex + 1) % filteredScripts.length;
          handlers.onSelectIndex(nextIndex);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredScripts.length > 0) {
          const prevIndex =
            (selectedIndex - 1 + filteredScripts.length) %
            filteredScripts.length;
          handlers.onSelectIndex(prevIndex);
        }
      }
    }
  });
}

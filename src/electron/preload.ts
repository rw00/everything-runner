import { contextBridge, ipcRenderer } from "electron";
import { ConfirmAction, IpcChannel } from "../domain/common";
import type { ScriptExecutionResponse } from "../domain/script";
import type { ScriptDescriptor } from "../domain/script";
import type { CapturedTextInfo } from "../infrastructure/macos";

export interface SettingsPayload {
  customScriptsDir: string;
  resolvedDir: string;
  settingsFilePath: string;
  customScriptCount: number;
  scripts?: ScriptDescriptor[];
}

export interface SummonPayload extends CapturedTextInfo {
  settings?: SettingsPayload;
}

export interface RunnerBridge {
  getScripts(): Promise<ScriptDescriptor[]>;
  runScript(
    scriptId: string,
    text: string,
    params: Record<string, unknown>
  ): Promise<ScriptExecutionResponse>;
  getSettings(): Promise<SettingsPayload>;
  saveSettings(customScriptsDir: string): Promise<SettingsPayload>;
  browseScriptsDir(): Promise<string | null>;
  openSettingsFile(): Promise<void>;
  confirmResult(text: string, action: ConfirmAction): Promise<{ ok: boolean }>;
  dismiss(): Promise<void>;
  openAccessibility(): Promise<void>;
  onSummon(callback: (payload: SummonPayload) => void): () => void;
  onScriptsUpdated(callback: (scripts: ScriptDescriptor[]) => void): () => void;
  onOpenSettings(callback: () => void): () => void;
}

const bridge: RunnerBridge = {
  getScripts: () =>
    ipcRenderer.invoke(IpcChannel.ScriptsList) as Promise<ScriptDescriptor[]>,
  runScript: (
    scriptId: string,
    text: string,
    params: Record<string, unknown>
  ) =>
    ipcRenderer.invoke(
      IpcChannel.ScriptsRun,
      scriptId,
      text,
      params
    ) as Promise<ScriptExecutionResponse>,
  getSettings: () =>
    ipcRenderer.invoke(IpcChannel.SettingsGet) as Promise<SettingsPayload>,
  saveSettings: (customScriptsDir: string) =>
    ipcRenderer.invoke(
      IpcChannel.SettingsSave,
      customScriptsDir
    ) as Promise<SettingsPayload>,
  browseScriptsDir: () =>
    ipcRenderer.invoke(IpcChannel.SettingsBrowseDir) as Promise<string | null>,
  openSettingsFile: () =>
    ipcRenderer.invoke(IpcChannel.SettingsOpenFile) as Promise<void>,
  confirmResult: (text: string, action: ConfirmAction) =>
    ipcRenderer.invoke(IpcChannel.AppConfirm, text, action) as Promise<{
      ok: boolean;
    }>,
  dismiss: () => ipcRenderer.invoke(IpcChannel.AppDismiss) as Promise<void>,
  openAccessibility: () =>
    ipcRenderer.invoke(IpcChannel.AppOpenAccessibility) as Promise<void>,
  onSummon: (callback: (payload: SummonPayload) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: SummonPayload
    ): void => {
      callback(payload);
    };
    ipcRenderer.removeAllListeners(IpcChannel.AppSummoned);
    ipcRenderer.on(IpcChannel.AppSummoned, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannel.AppSummoned, listener);
    };
  },
  onScriptsUpdated: (callback: (scripts: ScriptDescriptor[]) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      scripts: ScriptDescriptor[]
    ): void => {
      callback(scripts);
    };
    ipcRenderer.removeAllListeners(IpcChannel.ScriptsUpdated);
    ipcRenderer.on(IpcChannel.ScriptsUpdated, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannel.ScriptsUpdated, listener);
    };
  },
  onOpenSettings: (callback: () => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.removeAllListeners(IpcChannel.AppOpenSettings);
    ipcRenderer.on(IpcChannel.AppOpenSettings, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannel.AppOpenSettings, listener);
    };
  }
};

declare global {
  interface Window {
    everythingRunner: RunnerBridge;
  }
}

contextBridge.exposeInMainWorld("everythingRunner", bridge);

import fs from "fs";
import os from "os";
import path from "path";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray
} from "electron";
import {
  BuiltInScriptProvider,
  FileSystemScriptProvider
} from "../application/provider";
import { ScriptRegistry } from "../application/registry";
import { ConfirmAction, IpcChannel, ScriptMode } from "../domain/common";
import { ScriptExecutionResponse } from "../domain/script";
import {
  activatePreviousApp,
  captureSelectedText,
  checkAccessibilityPermission,
  ensureAccessibilityOnStartup,
  focusRunnerApp,
  pasteIntoActiveApp,
  requestAndOpenAccessibilitySettings,
  startMacOSHelper,
  stopMacOSHelper
} from "../infrastructure/macos";
import {
  ensureSettingsFile,
  expandHomePath,
  getSettingsPath,
  loadSettings,
  saveSettings
} from "../infrastructure/settings";
import { RUNNER_SHORTCUT, TIMING_CONFIG, WINDOW_CONFIG } from "./constants";
import { SettingsPayload, SummonPayload } from "./preload";

const fsProvider = new FileSystemScriptProvider();
const builtInProvider = new BuiltInScriptProvider();
const registry = new ScriptRegistry([builtInProvider, fsProvider]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isSummoning = false;
let isBrowsingFolder = false;
let lastShownTime = 0;
let watchedSettingsPath: string | null = null;

function syncSettingsAndRegistry(): SettingsPayload {
  const settings = loadSettings();
  fsProvider.setDirectory(settings.customScriptsDir);
  registry.reload();
  const scripts = registry.getScripts();
  const customScriptCount = scripts.filter((s) => s.isCustom).length;
  return {
    customScriptsDir: settings.customScriptsDir,
    resolvedDir: expandHomePath(settings.customScriptsDir),
    settingsFilePath: getSettingsPath(),
    customScriptCount,
    scripts
  };
}

function broadcastScriptsUpdate(): void {
  const payload = syncSettingsAndRegistry();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      IpcChannel.ScriptsUpdated,
      payload.scripts ?? []
    );
  }
}

function watchSettingsFile(): void {
  const filePath = getSettingsPath();
  if (watchedSettingsPath === filePath) {
    return;
  }
  unwatchSettingsFile();
  watchedSettingsPath = filePath;
  fs.watchFile(
    filePath,
    { interval: TIMING_CONFIG.settingsWatchIntervalMs },
    () => {
      broadcastScriptsUpdate();
    }
  );
}

function unwatchSettingsFile(): void {
  if (watchedSettingsPath) {
    fs.unwatchFile(watchedSettingsPath);
    watchedSettingsPath = null;
  }
}

function createWindow(): BrowserWindow {
  const windowIconPath = path.join(__dirname, "..", "renderer", "icon.png");
  const win = new BrowserWindow({
    width: WINDOW_CONFIG.width,
    height: WINDOW_CONFIG.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    icon: windowIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  win.setAlwaysOnTop(true, "pop-up-menu");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  const htmlPath = path.join(__dirname, "..", "renderer", "index.html");
  void win.loadFile(htmlPath);

  win.on("blur", () => {
    if (isBrowsingFolder) {
      return;
    }
    const elapsed = Date.now() - lastShownTime;
    if (isSummoning || elapsed < TIMING_CONFIG.blurIgnoreThresholdMs) {
      if (win.isVisible()) {
        win.focus();
        win.webContents.focus();
      }
      return;
    }
    if (win.isVisible()) {
      hideRunnerWindow(false);
    }
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideRunnerWindow(true);
    }
  });

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  return win;
}

function positionWindowOnActiveScreen(win: BrowserWindow): void {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = display.workArea;
  const winBounds = win.getBounds();

  const targetX = Math.round(x + (width - winBounds.width) / 2);
  const targetY = Math.round(
    y +
      Math.min(
        WINDOW_CONFIG.maxTopOffsetPx,
        height * WINDOW_CONFIG.heightOffsetRatio
      )
  );

  win.setPosition(targetX, targetY, false);
}

function hideRunnerWindow(restorePreviousApp = false): void {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
    return;
  }
  mainWindow.hide();
  if (restorePreviousApp) {
    void activatePreviousApp();
  }
}

async function ensureWindowReady(): Promise<BrowserWindow> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
  }
  const win = mainWindow;
  if (win.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      win.webContents.once("did-finish-load", () => {
        resolve();
      });
    });
  }
  return win;
}

async function summonRunnerWindow(openSettings = false): Promise<void> {
  if (isSummoning) {
    return;
  }

  if (
    !openSettings &&
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.isVisible() &&
    Date.now() - lastShownTime > TIMING_CONFIG.doubleSummonDismissThresholdMs
  ) {
    hideRunnerWindow(true);
    return;
  }

  isSummoning = true;
  try {
    const settingsPayload = syncSettingsAndRegistry();
    const captured = await captureSelectedText();
    const win = await ensureWindowReady();

    positionWindowOnActiveScreen(win);
    const summonPayload: SummonPayload = {
      ...captured,
      settings: settingsPayload
    };
    win.webContents.send(IpcChannel.AppSummoned, summonPayload);
    if (openSettings) {
      win.webContents.send(IpcChannel.AppOpenSettings);
    }

    lastShownTime = Date.now();
    if (process.platform === "darwin") {
      app.show();
      app.focus({ steal: true });
    }
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.show();
    win.moveTop();
    win.focus();
    win.webContents.focus();
    void focusRunnerApp();
  } finally {
    setTimeout(() => {
      isSummoning = false;
    }, TIMING_CONFIG.summonCooldownMs);
  }
}

function createTray(): void {
  const trayIconPath = path.join(
    __dirname,
    "..",
    "renderer",
    "trayTemplate.png"
  );
  const trayIcon = nativeImage.createFromPath(trayIconPath);
  if (!trayIcon.isEmpty()) {
    trayIcon.setTemplateImage(true);
    tray = new Tray(trayIcon);
  } else {
    tray = new Tray(nativeImage.createEmpty());
    tray.setTitle("⌘");
  }
  tray.setToolTip(`Everything Runner (${RUNNER_SHORTCUT})`);

  const updateMenu = (): void => {
    const trusted = checkAccessibilityPermission(false);
    const loginSettings = app.getLoginItemSettings();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open Everything Runner",
        accelerator: RUNNER_SHORTCUT,
        click: () => {
          void summonRunnerWindow();
        }
      },
      {
        label: "Settings (Custom Scripts)...",
        accelerator: "CommandOrControl+,",
        click: () => {
          void summonRunnerWindow(true);
        }
      },
      {
        label: "Reload Custom Scripts",
        accelerator: "CommandOrControl+R",
        click: () => {
          broadcastScriptsUpdate();
        }
      },
      { type: "separator" },
      {
        label: trusted
          ? "Accessibility Permission Granted"
          : "⚠️ Grant Accessibility Permission (for auto-copy/paste)...",
        type: "checkbox",
        checked: trusted,
        click: () => {
          requestAndOpenAccessibilitySettings();
          updateMenu();
        }
      },
      {
        label: "Launch at Login",
        type: "checkbox",
        checked: loginSettings.openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked
          });
        }
      },
      { type: "separator" },
      {
        label: "Quit Everything Runner",
        accelerator: "CommandOrControl+Q",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray?.setContextMenu(contextMenu);
  };

  updateMenu();
  tray.on("mouse-enter", updateMenu);
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.ScriptsList, () => {
    const payload = syncSettingsAndRegistry();
    return payload.scripts ?? [];
  });

  ipcMain.handle(
    IpcChannel.ScriptsRun,
    async (
      _event,
      scriptId: unknown,
      text: unknown,
      params: unknown
    ): Promise<ScriptExecutionResponse> => {
      const safeId = typeof scriptId === "string" ? scriptId : "";
      const safeText = typeof text === "string" ? text : "";
      const safeParams =
        params !== null && typeof params === "object" && !Array.isArray(params)
          ? (params as Record<string, unknown>)
          : {};
      try {
        return await registry.executeAsync(safeId, safeText, safeParams);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to execute script";
        return {
          scriptId: safeId,
          name: safeId,
          mode: ScriptMode.Transform,
          inputText: safeText,
          outputText: safeText,
          resultData: {},
          error: message
        };
      }
    }
  );

  ipcMain.handle(IpcChannel.SettingsGet, (): SettingsPayload => {
    return syncSettingsAndRegistry();
  });

  ipcMain.handle(
    IpcChannel.SettingsSave,
    (_event, customScriptsDir: unknown): SettingsPayload => {
      const safeDir =
        typeof customScriptsDir === "string" ? customScriptsDir : "";
      saveSettings({ customScriptsDir: safeDir });
      const payload = syncSettingsAndRegistry();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          IpcChannel.ScriptsUpdated,
          payload.scripts ?? []
        );
      }
      return payload;
    }
  );

  ipcMain.handle(
    IpcChannel.SettingsBrowseDir,
    async (): Promise<string | null> => {
      isBrowsingFolder = true;
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
        }
        if (process.platform === "darwin") {
          app.focus({ steal: true });
        }

        const currentSettings = loadSettings();
        const resolvedCurrent = expandHomePath(
          currentSettings.customScriptsDir
        );
        const defaultPath =
          resolvedCurrent && fs.existsSync(resolvedCurrent)
            ? resolvedCurrent
            : os.homedir();

        const dialogOptions: Electron.OpenDialogOptions = {
          title: "Select Custom Scripts Directory",
          defaultPath,
          properties: ["openDirectory", "createDirectory"]
        };

        const result = await dialog.showOpenDialog(dialogOptions);
        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }
        return result.filePaths[0] ?? null;
      } finally {
        isBrowsingFolder = false;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(true, "pop-up-menu");
          if (mainWindow.isVisible()) {
            mainWindow.moveTop();
            mainWindow.focus();
            mainWindow.webContents.focus();
          }
        }
      }
    }
  );

  ipcMain.handle(IpcChannel.SettingsOpenFile, async (): Promise<void> => {
    const filePath = ensureSettingsFile();
    hideRunnerWindow(false);
    await shell.openPath(filePath);
  });

  ipcMain.handle(
    IpcChannel.AppConfirm,
    async (_event, text: unknown, action: unknown) => {
      const safeText = typeof text === "string" ? text : "";
      if (action === ConfirmAction.Replace) {
        await pasteIntoActiveApp(safeText, () => {
          hideRunnerWindow(false);
        });
      } else {
        clipboard.writeText(safeText);
        hideRunnerWindow(true);
      }
      return { ok: true };
    }
  );

  ipcMain.handle(IpcChannel.AppDismiss, () => {
    hideRunnerWindow(true);
  });

  ipcMain.handle(IpcChannel.AppOpenAccessibility, () => {
    hideRunnerWindow(false);
    requestAndOpenAccessibilitySettings();
  });
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    void summonRunnerWindow();
  });

  void app.whenReady().then(() => {
    if (process.platform === "darwin") {
      app.dock?.hide();
    }

    syncSettingsAndRegistry();
    watchSettingsFile();
    startMacOSHelper();
    ensureAccessibilityOnStartup();
    registerIpcHandlers();
    mainWindow = createWindow();
    createTray();

    globalShortcut.register(RUNNER_SHORTCUT, () => {
      void summonRunnerWindow();
    });

    // Show window on initial launch once ready so user gets immediate feedback
    mainWindow.webContents.once("did-finish-load", () => {
      void summonRunnerWindow();
    });
  });
}

app.on("activate", () => {
  void summonRunnerWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  unwatchSettingsFile();
  stopMacOSHelper();
});

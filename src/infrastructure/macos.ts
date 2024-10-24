import { ChildProcessByStdio, execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Readable, Writable } from "stream";
import { clipboard, shell, systemPreferences } from "electron";
import { CapturedTextSource, HelperCommand } from "../domain/common";
import { TIMING_CONFIG } from "../electron/constants";

export interface CapturedTextInfo {
  text: string;
  source: CapturedTextSource;
  accessibilityTrusted: boolean;
  appName?: string;
  targetPid?: number;
}

interface HelperResponse {
  id?: number;
  ok?: boolean;
  text?: string;
  source?: CapturedTextSource;
  accessibilityTrusted?: boolean;
  appName?: string;
  targetPid?: number;
}

const MAX_STDOUT_BUFFER_BYTES = TIMING_CONFIG.maxStdoutBufferBytes;

let helperProc: ChildProcessByStdio<Writable, Readable, null> | null = null;
let stdoutBuffer = "";
let nextReqId = 1;
let lastTargetPid = 0;
let lastAppName = "";
const pendingRequests = new Map<
  number,
  {
    resolve: (res: HelperResponse) => void;
    timer: NodeJS.Timeout;
  }
>();

function getHelperBinaryPath(): string {
  return path.join(__dirname, "macos-helper");
}

export function startMacOSHelper(): void {
  if (process.platform !== "darwin" || helperProc) {
    return;
  }
  const binPath = getHelperBinaryPath();
  if (!fs.existsSync(binPath)) {
    return;
  }

  try {
    const proc = spawn(binPath, [], {
      stdio: ["pipe", "pipe", "ignore"]
    });
    helperProc = proc;
    stdoutBuffer = "";

    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      if (stdoutBuffer.length > MAX_STDOUT_BUFFER_BYTES) {
        stdoutBuffer = "";
        return;
      }
      let newlineIdx = stdoutBuffer.indexOf("\n");
      while (newlineIdx !== -1) {
        const line = stdoutBuffer.slice(0, newlineIdx).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
        if (line.length > 0) {
          try {
            const parsed = JSON.parse(line) as HelperResponse;
            if (typeof parsed.id === "number") {
              const entry = pendingRequests.get(parsed.id);
              if (entry) {
                clearTimeout(entry.timer);
                pendingRequests.delete(parsed.id);
                entry.resolve(parsed);
              }
            }
          } catch {
            // Ignore malformed line
          }
        }
        newlineIdx = stdoutBuffer.indexOf("\n");
      }
    });

    proc.on("exit", () => {
      if (helperProc === proc) {
        helperProc = null;
      }
      for (const [id, entry] of pendingRequests.entries()) {
        clearTimeout(entry.timer);
        pendingRequests.delete(id);
        entry.resolve({ ok: false });
      }
    });

    proc.on("error", () => {
      if (helperProc === proc) {
        helperProc = null;
      }
    });
  } catch {
    helperProc = null;
  }
}

export function stopMacOSHelper(): void {
  if (helperProc) {
    try {
      helperProc.kill();
    } catch {
      // Ignore
    }
    helperProc = null;
  }
}

function sendHelperCommand(
  payload: Record<string, unknown>,
  timeoutMs: number = TIMING_CONFIG.helperDefaultTimeoutMs
): Promise<HelperResponse> {
  if (process.platform !== "darwin") {
    return Promise.resolve({ ok: false });
  }
  if (!helperProc) {
    startMacOSHelper();
  }
  const proc = helperProc;
  if (!proc) {
    return Promise.resolve({ ok: false });
  }

  const id = nextReqId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      resolve({ ok: false });
    }, timeoutMs);

    pendingRequests.set(id, { resolve, timer });
    try {
      proc.stdin.write(`${JSON.stringify({ ...payload, id })}\n`);
    } catch {
      clearTimeout(timer);
      pendingRequests.delete(id);
      resolve({ ok: false });
    }
  });
}

export function checkAccessibilityPermission(promptUser: boolean): boolean {
  if (process.platform !== "darwin") {
    return true;
  }
  return systemPreferences.isTrustedAccessibilityClient(promptUser);
}

export function openAccessibilitySettings(): void {
  void shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
  );
}

function triggerFreshAccessibilityPrompt(openSettings: boolean): void {
  if (process.platform !== "darwin") {
    return;
  }
  if (checkAccessibilityPermission(false)) {
    if (openSettings) {
      openAccessibilitySettings();
    }
    return;
  }

  // Clear any stale ad-hoc CDHash entry in macOS TCC so the current binary is registered cleanly
  execFile(
    "/usr/bin/tccutil",
    ["reset", "Accessibility", "com.everythingrunner.app"],
    { timeout: TIMING_CONFIG.tccutilTimeoutMs },
    () => {
      checkAccessibilityPermission(true);
      const binPath = getHelperBinaryPath();
      if (fs.existsSync(binPath)) {
        execFile(
          binPath,
          ["--prompt"],
          { timeout: TIMING_CONFIG.tccutilTimeoutMs },
          () => {
            if (openSettings) {
              openAccessibilitySettings();
            }
          }
        );
      } else if (openSettings) {
        openAccessibilitySettings();
      }
    }
  );
}

export function ensureAccessibilityOnStartup(): void {
  if (process.platform !== "darwin") {
    return;
  }
  if (!checkAccessibilityPermission(false)) {
    triggerFreshAccessibilityPrompt(false);
  }
}

export function requestAndOpenAccessibilitySettings(): void {
  triggerFreshAccessibilityPrompt(true);
}

export async function captureSelectedText(): Promise<CapturedTextInfo> {
  const accessibilityTrusted = checkAccessibilityPermission(false);
  const res = await sendHelperCommand(
    { cmd: HelperCommand.Capture },
    TIMING_CONFIG.captureTimeoutMs
  );

  if (typeof res.targetPid === "number" && res.targetPid > 0) {
    lastTargetPid = res.targetPid;
  }
  if (typeof res.appName === "string" && res.appName.length > 0) {
    lastAppName = res.appName;
  }

  if (res.ok && typeof res.text === "string" && res.source) {
    return {
      text: res.text,
      source: res.source,
      accessibilityTrusted: res.accessibilityTrusted ?? accessibilityTrusted,
      appName: lastAppName,
      targetPid: lastTargetPid
    };
  }

  const previousClipboard = clipboard.readText();
  if (previousClipboard.length > 0) {
    return {
      text: previousClipboard,
      source: CapturedTextSource.Clipboard,
      accessibilityTrusted,
      appName: lastAppName,
      targetPid: lastTargetPid
    };
  }

  return {
    text: "",
    source: CapturedTextSource.Empty,
    accessibilityTrusted,
    appName: lastAppName,
    targetPid: lastTargetPid
  };
}

export async function pasteIntoActiveApp(
  text: string,
  hideRunnerApp: () => void
): Promise<boolean> {
  clipboard.writeText(text);
  hideRunnerApp();

  const accessibilityTrusted = checkAccessibilityPermission(false);
  const res = await sendHelperCommand(
    {
      cmd: HelperCommand.Replace,
      text,
      targetPid: lastTargetPid
    },
    TIMING_CONFIG.replaceTimeoutMs
  );

  if (!accessibilityTrusted && !res.accessibilityTrusted) {
    requestAndOpenAccessibilitySettings();
    return false;
  }

  return Boolean(res.ok);
}

export async function activatePreviousApp(): Promise<void> {
  await sendHelperCommand(
    {
      cmd: HelperCommand.ActivateTarget,
      targetPid: lastTargetPid
    },
    TIMING_CONFIG.activateTargetTimeoutMs
  );
}

export async function focusRunnerApp(): Promise<void> {
  await sendHelperCommand(
    { cmd: HelperCommand.FocusSelf },
    TIMING_CONFIG.focusSelfTimeoutMs
  );
}

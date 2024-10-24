import fs from "fs";
import os from "os";
import path from "path";

export interface RunnerSettings {
  customScriptsDir: string;
}

const DEFAULT_SETTINGS: RunnerSettings = {
  customScriptsDir: ""
};

export function expandHomePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return "";
  }

  const home = os.homedir();
  let expanded = trimmed;

  if (expanded === "~") {
    expanded = home;
  } else if (expanded.startsWith("~/") || expanded.startsWith("~\\")) {
    expanded = path.join(home, expanded.slice(2));
  }

  expanded = expanded.replace(/\$HOME\b/g, home).replace(/\$\{HOME\}/g, home);

  return path.resolve(expanded);
}

export function getSettingsPath(customPath?: string): string {
  if (customPath) {
    return expandHomePath(customPath);
  }

  const envPath = process.env.EVERYTHING_RUNNER_SETTINGS_PATH;
  if (envPath && envPath.trim().length > 0) {
    return expandHomePath(envPath);
  }

  return path.join(os.homedir(), ".everything-runner", "settings.json");
}

function parseSettingsObject(raw: unknown): RunnerSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.customScriptsDir === "string") {
    return { customScriptsDir: record.customScriptsDir.trim() };
  }

  return { ...DEFAULT_SETTINGS };
}

export function ensureSettingsFile(customPath?: string): string {
  const filePath = getSettingsPath(customPath);
  if (!fs.existsSync(filePath)) {
    saveSettings(DEFAULT_SETTINGS, filePath);
  }
  return filePath;
}

export function loadSettings(customPath?: string): RunnerSettings {
  const filePath = getSettingsPath(customPath);
  try {
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_SETTINGS };
    }
    const content = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(content);
    return parseSettingsObject(parsed) ?? { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(
  settings: RunnerSettings,
  customPath?: string
): RunnerSettings {
  const normalized: RunnerSettings = {
    customScriptsDir: settings.customScriptsDir.trim()
  };
  const serialized = `${JSON.stringify(normalized, null, 2)}\n`;
  const filePath = getSettingsPath(customPath);

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, serialized, "utf8");
  } catch {
    // Ignore unwritable paths
  }

  return normalized;
}

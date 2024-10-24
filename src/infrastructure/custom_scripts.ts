import fs from "fs";
import Module from "module";
import path from "path";
import { ScriptMode } from "../domain/common";
import {
  defineScript,
  ParamDefinition,
  ParamOption,
  ParamType,
  resolveParams,
  ScriptDefinition,
  ScriptParamsSchema,
  ScriptRunResult,
  ScriptStatItem
} from "../domain/script";
import { expandHomePath } from "./settings";

export interface LoadedCustomScript {
  definition: ScriptDefinition;
  filePath: string;
}

function slugifyFilename(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return (
    base
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") || "custom-script"
  );
}

function humanizeFilename(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return (
    base
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[\s_-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase()) || "Custom Script"
  );
}

function loadModule(filePath: string): unknown {
  const rawSource = fs.readFileSync(filePath, "utf8");

  const customModule = new Module(filePath, module);
  customModule.filename = filePath;
  const nodeModulePaths = (
    Module as unknown as { _nodeModulePaths: (from: string) => string[] }
  )._nodeModulePaths(path.dirname(filePath));
  customModule.paths = [...nodeModulePaths, ...module.paths];

  const originalRequire = customModule.require.bind(customModule);
  const customRequire = ((id: string): unknown => {
    if (id === "everything-runner") {
      return {
        defineScript,
        resolveParams,
        ScriptMode
      };
    }
    return originalRequire(id);
  }) as NodeJS.Require;
  Object.assign(customRequire, originalRequire);
  customModule.require = customRequire;

  (
    customModule as unknown as {
      _compile: (content: string, filename: string) => void;
    }
  )._compile(rawSource, filePath);

  return customModule.exports;
}

function normalizeParams(
  rawParams: unknown,
  rawSchema: unknown
): ScriptParamsSchema | undefined {
  if (rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)) {
    return rawParams as ScriptParamsSchema;
  }
  if (Array.isArray(rawSchema)) {
    const schema: ScriptParamsSchema = {};
    for (const item of rawSchema) {
      if (item && typeof item === "object") {
        const field = item as Record<string, unknown>;
        if (typeof field.key === "string" && field.key.trim().length > 0) {
          const key = field.key.trim();
          const name =
            typeof field.name === "string"
              ? field.name
              : typeof field.label === "string"
                ? field.label
                : key;
          const description =
            typeof field.description === "string" ? field.description : "";
          const rawType = field.type;
          const type: ParamType =
            rawType === "boolean" ||
            rawType === "number" ||
            rawType === "select"
              ? rawType
              : "string";

          const options = Array.isArray(field.options)
            ? (field.options as ParamOption[])
            : undefined;
          const allowEmpty =
            typeof field.allowEmpty === "boolean"
              ? field.allowEmpty
              : undefined;

          schema[key] = {
            name,
            description,
            type,
            defaultValue: field.defaultValue,
            options,
            allowEmpty
          } as ParamDefinition;
        }
      }
    }
    return Object.keys(schema).length > 0 ? schema : undefined;
  }
  return undefined;
}

function normalizeRunResult(
  raw: unknown,
  fallbackText: string
): ScriptRunResult {
  if (typeof raw === "string") {
    return raw;
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const text =
      typeof record.text === "string"
        ? record.text
        : typeof record.outputText === "string"
          ? record.outputText
          : fallbackText;
    const error = typeof record.error === "string" ? record.error : undefined;
    const badge = typeof record.badge === "string" ? record.badge : undefined;
    const stats = Array.isArray(record.stats)
      ? (record.stats as ScriptStatItem[])
      : undefined;
    return {
      text,
      data: record,
      error,
      badge,
      stats
    };
  }
  return fallbackText;
}

function extractScriptDefinition(
  rawExport: unknown,
  filePath: string
): ScriptDefinition | null {
  if (!rawExport) {
    return null;
  }

  let docSource: Record<string, unknown> = {};
  let runFn: ((...args: unknown[]) => unknown) | null = null;

  if (typeof rawExport === "function") {
    runFn = rawExport as (...args: unknown[]) => unknown;
    docSource = rawExport as unknown as Record<string, unknown>;
  } else if (typeof rawExport === "object") {
    const targetObj = rawExport as Record<string, unknown>;
    if (typeof targetObj.run === "function") {
      runFn = targetObj.run as (...args: unknown[]) => unknown;
      docSource = targetObj;
    }
  }

  if (!runFn) {
    return null;
  }

  const id =
    typeof docSource.id === "string" && docSource.id.trim().length > 0
      ? docSource.id.trim()
      : slugifyFilename(filePath);

  const name =
    typeof docSource.name === "string" && docSource.name.trim().length > 0
      ? docSource.name.trim()
      : humanizeFilename(filePath);

  const description =
    typeof docSource.description === "string" &&
    docSource.description.trim().length > 0
      ? docSource.description.trim()
      : `Custom script (${path.basename(filePath)})`;

  const icon =
    typeof docSource.icon === "string" && docSource.icon.trim().length > 0
      ? docSource.icon.trim()
      : "⌘";

  const mode =
    docSource.mode === ScriptMode.Info ? ScriptMode.Info : ScriptMode.Transform;

  const params = normalizeParams(docSource.params, docSource.paramsSchema);

  return {
    id,
    name,
    description,
    icon,
    mode,
    params,
    run(
      text: string,
      paramsMap: Record<string, unknown>
    ): ScriptRunResult | Promise<ScriptRunResult> {
      const result = runFn(text, paramsMap);
      if (
        result !== null &&
        typeof result === "object" &&
        typeof (result as { then?: unknown }).then === "function"
      ) {
        return (result as Promise<unknown>).then((res) =>
          normalizeRunResult(res, text)
        );
      }
      return normalizeRunResult(result, text);
    }
  };
}

export function loadCustomScriptsFromDir(rawDir: string): LoadedCustomScript[] {
  const resolvedDir = expandHomePath(rawDir);
  if (!resolvedDir || !fs.existsSync(resolvedDir)) {
    return [];
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedDir);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(resolvedDir).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }

  const scripts: LoadedCustomScript[] = [];

  for (const entry of entries) {
    if (
      entry.startsWith(".") ||
      entry.endsWith(".d.ts") ||
      entry.includes(".test.") ||
      entry.includes(".spec.")
    ) {
      continue;
    }

    const fullPath = path.join(resolvedDir, entry);
    let fileStat: fs.Stats;
    try {
      fileStat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!fileStat.isFile()) {
      continue;
    }

    // Only .js files are supported (not .ts, not .cjs)
    const ext = path.extname(entry).toLowerCase();
    if (ext === ".js") {
      try {
        const loaded = loadModule(fullPath);
        const scriptDef = extractScriptDefinition(loaded, fullPath);
        if (scriptDef) {
          scripts.push({
            definition: scriptDef,
            filePath: fullPath
          });
        }
      } catch {
        // Skip invalid script file without aborting other scripts
      }
    }
  }

  return scripts;
}

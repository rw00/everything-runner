import { BuiltInScriptId, ScriptMode, ScriptParamType } from "./common";

export { BuiltInScriptId, ScriptMode, ScriptParamType };

export type ParamType = "string" | "boolean" | "select" | "number";

export interface ParamOption<T extends string | number = string | number> {
  label: string;
  value: T;
}

export interface BaseParamDefinition<T = unknown> {
  name: string;
  description: string;
  defaultValue: T;
}

export interface StringParamDefinition extends BaseParamDefinition<string> {
  type: "string";
  allowEmpty?: boolean;
}

export interface BooleanParamDefinition extends BaseParamDefinition<boolean> {
  type: "boolean";
}

export interface NumberParamDefinition extends BaseParamDefinition<number> {
  type: "number";
}

export interface SelectParamDefinition<
  T extends string = string
> extends BaseParamDefinition<T> {
  type: "select";
  options: ParamOption<T>[];
}

export type ParamDefinition =
  | StringParamDefinition
  | BooleanParamDefinition
  | NumberParamDefinition
  | SelectParamDefinition<string>;

export type ScriptParamsSchema = Record<string, ParamDefinition>;

export type InferParams<T extends ScriptParamsSchema> = {
  [K in keyof T]: T[K] extends SelectParamDefinition<infer U>
    ? U
    : T[K] extends BaseParamDefinition<infer V>
      ? V
      : unknown;
};

export interface ScriptStatItem {
  label: string;
  value: string | number;
  primary?: boolean;
}

export interface ScriptOutput {
  text?: string;
  data?: Record<string, unknown>;
  error?: string;
  badge?: string;
  stats?: ScriptStatItem[];
}

export type ScriptRunResult = string | ScriptOutput | void;

export interface ScriptDefinition<
  TParams extends ScriptParamsSchema = ScriptParamsSchema
> {
  id: string;
  name: string;
  description: string;
  icon: string;
  mode?: ScriptMode;
  params?: TParams;
  run: (
    text: string,
    params: InferParams<TParams>
  ) => ScriptRunResult | Promise<ScriptRunResult>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScriptDefinition = ScriptDefinition<any>;

export function defineScript<
  TParams extends ScriptParamsSchema = ScriptParamsSchema
>(def: ScriptDefinition<TParams>): ScriptDefinition<TParams> {
  return def;
}

export interface ScriptParamField {
  key: string;
  name: string;
  label: string;
  description: string;
  type: ParamType;
  defaultValue: unknown;
  options?: ParamOption[];
  allowEmpty?: boolean;
}

export interface ScriptDescriptor {
  id: string;
  name: string;
  description: string;
  icon: string;
  mode: ScriptMode;
  paramsSchema?: ScriptParamField[];
  isCustom?: boolean;
  filePath?: string;
}

export interface ScriptExecutionResponse {
  scriptId: string;
  name: string;
  mode: ScriptMode;
  inputText: string;
  outputText: string;
  resultData: Record<string, unknown>;
  badge?: string;
  stats?: ScriptStatItem[];
  error?: string;
}

export function toScriptDescriptor<
  TParams extends ScriptParamsSchema = ScriptParamsSchema
>(
  script: ScriptDefinition<TParams>,
  meta?: { isCustom?: boolean; filePath?: string }
): ScriptDescriptor {
  const fields: ScriptParamField[] = [];

  if (script.params) {
    const paramsMap = script.params as Record<string, ParamDefinition>;
    for (const [key, pDef] of Object.entries(paramsMap)) {
      fields.push({
        key,
        name: pDef.name,
        label: pDef.name,
        description: pDef.description,
        type: pDef.type,
        defaultValue: pDef.defaultValue,
        options: "options" in pDef ? pDef.options : undefined,
        allowEmpty: "allowEmpty" in pDef ? pDef.allowEmpty : undefined
      });
    }
  }

  return {
    id: script.id,
    name: script.name,
    description: script.description,
    icon: script.icon,
    mode: script.mode ?? ScriptMode.Transform,
    paramsSchema: fields.length > 0 ? fields : undefined,
    isCustom: meta?.isCustom,
    filePath: meta?.filePath
  };
}

export function resolveParams<
  TParams extends ScriptParamsSchema = ScriptParamsSchema
>(
  schema?: TParams,
  rawParams: Record<string, unknown> = {}
): InferParams<TParams> {
  if (!schema) {
    return {} as InferParams<TParams>;
  }

  const resolved: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(schema)) {
    const rawVal = rawParams[key];

    if (rawVal === undefined || rawVal === null) {
      resolved[key] = def.defaultValue;
      continue;
    }

    switch (def.type) {
      case "boolean":
        resolved[key] = typeof rawVal === "boolean" ? rawVal : Boolean(rawVal);
        break;
      case "number": {
        const num = Number(rawVal);
        resolved[key] = Number.isFinite(num) ? num : def.defaultValue;
        break;
      }
      case "select": {
        const valid = def.options.some((opt) => opt.value === rawVal);
        resolved[key] = valid ? rawVal : def.defaultValue;
        break;
      }
      case "string":
      default: {
        const str = String(rawVal);
        if (def.allowEmpty === false && str.length === 0) {
          resolved[key] = def.defaultValue;
        } else {
          resolved[key] = str;
        }
        break;
      }
    }
  }

  return resolved as InferParams<TParams>;
}

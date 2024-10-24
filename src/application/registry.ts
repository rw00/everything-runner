import { ScriptMode } from "../domain/common";
import {
  AnyScriptDefinition,
  resolveParams,
  ScriptDescriptor,
  ScriptExecutionResponse,
  ScriptRunResult,
  toScriptDescriptor
} from "../domain/script";
import {
  BuiltInScriptProvider,
  IScriptProvider,
  ScriptProviderItem
} from "./provider";

export { type ScriptExecutionResponse };

interface RegisteredScript {
  definition: AnyScriptDefinition;
  isCustom?: boolean;
  filePath?: string;
}

export class ScriptRegistry {
  private providers: IScriptProvider[] = [];
  private readonly scripts = new Map<string, RegisteredScript>();

  constructor(providers: IScriptProvider[] = [new BuiltInScriptProvider()]) {
    this.providers = [...providers];
    this.reload();
  }

  public getProviders(): readonly IScriptProvider[] {
    return this.providers;
  }

  public setProviders(providers: IScriptProvider[]): void {
    this.providers = [...providers];
    this.reload();
  }

  public addProvider(provider: IScriptProvider): void {
    this.providers.push(provider);
    this.reload();
  }

  public reload(): ScriptDescriptor[] {
    this.scripts.clear();

    for (const provider of this.providers) {
      const items = provider.provideScripts();
      if (Array.isArray(items)) {
        this.registerProviderItems(items);
      }
    }

    return this.getScripts();
  }

  public async reloadAsync(): Promise<ScriptDescriptor[]> {
    this.scripts.clear();

    for (const provider of this.providers) {
      const items = await provider.provideScripts();
      this.registerProviderItems(items);
    }

    return this.getScripts();
  }

  private registerProviderItems(items: ScriptProviderItem[]): void {
    for (const item of items) {
      this.scripts.set(item.definition.id, {
        definition: item.definition,
        isCustom: item.isCustom ?? false,
        filePath: item.filePath
      });
    }
  }

  public getScripts(): ScriptDescriptor[] {
    const descriptors: ScriptDescriptor[] = [];
    for (const item of this.scripts.values()) {
      descriptors.push(
        toScriptDescriptor(item.definition, {
          isCustom: item.isCustom,
          filePath: item.filePath
        })
      );
    }
    return descriptors;
  }

  public execute(
    scriptId: string,
    inputText: string,
    rawParams: Record<string, unknown> = {}
  ): ScriptExecutionResponse {
    const registered = this.scripts.get(scriptId);
    if (!registered) {
      throw new Error(`Unknown script ID: ${scriptId}`);
    }

    const script = registered.definition;
    const mode = script.mode ?? ScriptMode.Transform;
    const resolvedParams = resolveParams(script.params, rawParams);

    try {
      const rawResult = script.run(inputText, resolvedParams);
      if (
        rawResult instanceof Promise ||
        (rawResult !== null &&
          typeof rawResult === "object" &&
          typeof (rawResult as { then?: unknown }).then === "function")
      ) {
        throw new Error(
          "Asynchronous scripts must be executed via executeAsync()"
        );
      }
      return this.formatSuccessResponse(script, mode, inputText, rawResult);
    } catch (err) {
      return this.formatErrorResponse(script, mode, inputText, err);
    }
  }

  public async executeAsync(
    scriptId: string,
    inputText: string,
    rawParams: Record<string, unknown> = {}
  ): Promise<ScriptExecutionResponse> {
    const registered = this.scripts.get(scriptId);
    if (!registered) {
      throw new Error(`Unknown script ID: ${scriptId}`);
    }

    const script = registered.definition;
    const mode = script.mode ?? ScriptMode.Transform;
    const resolvedParams = resolveParams(script.params, rawParams);

    try {
      const rawResult = await script.run(inputText, resolvedParams);
      return this.formatSuccessResponse(script, mode, inputText, rawResult);
    } catch (err) {
      return this.formatErrorResponse(script, mode, inputText, err);
    }
  }

  private formatSuccessResponse(
    script: AnyScriptDefinition,
    mode: ScriptMode,
    inputText: string,
    result: ScriptRunResult
  ): ScriptExecutionResponse {
    let outputText = inputText;
    let resultData: Record<string, unknown> = {};
    let error: string | undefined;
    let badge: string | undefined;
    let stats: import("../domain/script").ScriptStatItem[] | undefined;

    if (typeof result === "string") {
      outputText = result;
    } else if (result && typeof result === "object") {
      if (typeof result.text === "string") {
        outputText = result.text;
      }
      if (result.data && typeof result.data === "object") {
        resultData = { ...result.data };
      }
      if (typeof result.error === "string") {
        error = result.error;
      }
      if (typeof result.badge === "string") {
        badge = result.badge;
      }
      if (Array.isArray(result.stats)) {
        stats = result.stats;
      }
    }

    if (!badge && !error) {
      const outLines =
        outputText.length === 0 ? 0 : outputText.split(/\r?\n/).length;
      badge = `${outputText.length} chars · ${outLines} line${outLines === 1 ? "" : "s"}`;
    }

    return {
      scriptId: script.id,
      name: script.name,
      mode,
      inputText,
      outputText,
      resultData,
      badge,
      stats,
      error
    };
  }

  private formatErrorResponse(
    script: AnyScriptDefinition,
    mode: ScriptMode,
    inputText: string,
    err: unknown
  ): ScriptExecutionResponse {
    const message =
      err instanceof Error ? err.message : "Script execution failed";
    return {
      scriptId: script.id,
      name: script.name,
      mode,
      inputText,
      outputText: inputText,
      resultData: {},
      error: message
    };
  }
}

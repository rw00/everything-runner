import type { ScriptDescriptor } from "../domain/script";

export interface RunnerState {
  allScripts: ScriptDescriptor[];
  filteredScripts: ScriptDescriptor[];
  searchQuery: string;
  selectedIndex: number;
  currentInputText: string;
  currentOutputText: string;
  currentAppName: string;
  executionSeq: number;
  paramsState: Record<string, Record<string, unknown>>;
  inputSource: string;
  accessibilityTrusted: boolean;
  isSettingsOpen: boolean;
  isInputDrawerOpen: boolean;
}

export const INITIAL_STATE: RunnerState = {
  allScripts: [],
  filteredScripts: [],
  searchQuery: "",
  selectedIndex: 0,
  currentInputText: "",
  currentOutputText: "",
  currentAppName: "",
  executionSeq: 0,
  paramsState: {},
  inputSource: "empty",
  accessibilityTrusted: true,
  isSettingsOpen: false,
  isInputDrawerOpen: false
};

export type Listener<T> = (state: Readonly<T>, prevState: Readonly<T>) => void;

export class ObservableStore<T> {
  private state: T;
  private readonly listeners = new Set<Listener<T>>();

  constructor(initialState: T) {
    this.state = { ...initialState };
  }

  public getState(): Readonly<T> {
    return this.state;
  }

  public setState(
    updater: Partial<T> | ((prev: Readonly<T>) => Partial<T>)
  ): void {
    const prev = this.state;
    const partial = typeof updater === "function" ? updater(prev) : updater;
    this.state = { ...prev, ...partial };
    for (const listener of this.listeners) {
      listener(this.state, prev);
    }
  }

  public subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const runnerStore = new ObservableStore<RunnerState>(INITIAL_STATE);

export function getActiveScript(
  state: Readonly<RunnerState> = runnerStore.getState()
): ScriptDescriptor | null {
  return state.filteredScripts[state.selectedIndex] ?? null;
}

export function getParamsForScript(
  script: ScriptDescriptor | null,
  state: Readonly<RunnerState> = runnerStore.getState()
): Record<string, unknown> {
  if (!script?.id) {
    return {};
  }
  const id = script.id;
  const existing = state.paramsState[id];
  if (existing) {
    return existing;
  }

  const defaults: Record<string, unknown> = {};
  if (Array.isArray(script.paramsSchema)) {
    for (const field of script.paramsSchema) {
      defaults[field.key] = field.defaultValue;
    }
  }
  return defaults;
}

export function updateScriptParam(
  scriptId: string,
  paramKey: string,
  value: unknown
): void {
  runnerStore.setState((prev) => {
    const scriptParams = { ...(prev.paramsState[scriptId] ?? {}) };
    scriptParams[paramKey] = value;
    return {
      paramsState: {
        ...prev.paramsState,
        [scriptId]: scriptParams
      }
    };
  });
}

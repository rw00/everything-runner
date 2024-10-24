export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(...args: Parameters<T>): void;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  waitMs: number
): DebouncedFunction<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  }) as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  debounced.flush = (...args: Parameters<T>) => {
    const argsToUse = args.length > 0 ? args : lastArgs;
    debounced.cancel();
    if (argsToUse !== null) {
      fn(...argsToUse);
    }
  };

  return debounced;
}

export const RUNNER_SHORTCUT = "CommandOrControl+Alt+Shift+Space";

export const WINDOW_CONFIG = {
  width: 780,
  height: 500,
  maxTopOffsetPx: 140,
  heightOffsetRatio: 0.16
} as const;

export const TIMING_CONFIG = {
  blurIgnoreThresholdMs: 280,
  doubleSummonDismissThresholdMs: 250,
  summonCooldownMs: 80,
  settingsWatchIntervalMs: 750,
  helperDefaultTimeoutMs: 800,
  captureTimeoutMs: 600,
  replaceTimeoutMs: 900,
  activateTargetTimeoutMs: 300,
  focusSelfTimeoutMs: 200,
  tccutilTimeoutMs: 1500,
  maxStdoutBufferBytes: 10 * 1024 * 1024
} as const;

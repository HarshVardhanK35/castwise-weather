// @castwise/ignition is deliberately plain JS (no TypeScript build step —
// see its own readme), so it ships no .d.ts of its own. This declares just
// the shape we actually use, so TypeScript knows what init()/updateConfig()
// return instead of erroring on an untyped import.
declare module "@castwise/ignition" {
  export interface IgnitionPayload {
    appName?: string;
    config: Record<string, unknown>;
    data: unknown;
    onPlay: (cb: () => void) => void;
    onPause: (cb: () => void) => void;
    onMute: (cb: () => void) => void;
    onUnmute: (cb: () => void) => void;
    onTimeout: (cb: () => void) => void;
    trigger: (event: string) => void;
    logger: {
      log: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
    };
  }

  export interface IgnitionUpdatePayload {
    appName?: string;
    config: Record<string, unknown>;
    data: unknown;
  }

  export function init(appConfig?: Record<string, unknown>): Promise<IgnitionPayload>;
  export function updateConfig(
    newAppConfig?: Record<string, unknown>,
  ): Promise<IgnitionUpdatePayload>;
  export function watchHostConfig(
    onConfig: (config: Record<string, unknown>) => void,
  ): () => void;
  export const VERSION: string;
}

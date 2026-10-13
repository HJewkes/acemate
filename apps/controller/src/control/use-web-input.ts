import type { InputActions } from "./web-input";

/** Keyboard and gamepad are web-only (use-web-input.web.ts); a phone drives with the touch stick alone. */
export function useWebInput(_makeActions: () => InputActions, _enabled: boolean): void {
  return;
}

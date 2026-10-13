import type { Assumptions, FireMessage } from "@acemate/core";

export type VariantId = "a" | "b" | "c" | "d";

/** One way of specifying a shot. Each keeps its own state, so switching away and back loses nothing. */
export interface LauncherVariant {
  readonly id: VariantId;
  readonly name: string;
  /** Renders into el, replacing what was there. onChange runs whenever current() may have changed. */
  mount(el: HTMLElement, onChange: () => void, assumptions: Assumptions): void;
  /** The shot Fire would send now, or null when there is nothing to send (an empty queue). */
  current(): FireMessage | null;
  /** Called after a fire is handed to the launch path, e.g. to step a sequence on. */
  fired?(): void;
}

export const VARIANT_IDS: VariantId[] = ["a", "b", "c", "d"];

export function variantIdOf(value: string | null | undefined): VariantId | null {
  return VARIANT_IDS.find((id) => id === value?.toLowerCase()) ?? null;
}

/** The URL wins over the stored choice, which wins over A. */
export function initialVariant(urlValue: string | null, stored: string | null): VariantId {
  return variantIdOf(urlValue) ?? variantIdOf(stored) ?? "a";
}

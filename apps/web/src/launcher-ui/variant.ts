import type { LaunchMessage } from "../../../../tools/web-drive/src/launcher.js";
import type { Assumptions } from "./assumptions.js";
import { directionLabel } from "./aim.js";
import { spinLabel } from "./spin.js";

export type VariantId = "a" | "b" | "c" | "d";
export type FireMessage = Extract<LaunchMessage, { kind: "machine" | "machine-queue" | "target" }>;

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

/** One line for the Fire bar, in the same left/right words the variants use. */
export function describeShot(message: FireMessage | null, flipDirection: boolean): string {
  if (!message) return "nothing to fire";
  if (message.kind === "target") {
    return `target x ${message.x.toFixed(1)} m, z ${message.z.toFixed(1)} m · height ${message.heightLevel} · ${spinLabel(message.spin)}`;
  }
  if (message.kind === "machine-queue") return `${message.balls.length}-ball queue · every ${message.interval} s`;
  const balls = message.count === 1 ? "1 ball" : `${message.count} balls every ${message.interval} s`;
  return `${directionLabel(message.direction, flipDirection)} · elev ${message.elevation}° · speed ${message.speed} · ${spinLabel(message.spin)} · ${balls}`;
}

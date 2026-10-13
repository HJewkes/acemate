import type { LaunchMessage } from "../launch/launch-controller";
import { directionLabel } from "./aim";
import { spinLabel } from "./spin";

export type FireMessage = Extract<LaunchMessage, { kind: "machine" | "machine-queue" | "target" }>;

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

import type { Motion } from "../protocol/protocol";

export type { Motion };

/** Desired movement, each axis in [-1, 1]. y is forward, x is strafe right, turn is clockwise. */
export interface DriveInput {
  x: number;
  y: number;
  turn: number;
}

/**
 * The firmware does not blend motions, so exactly one wins. With priority "rotate":
 *   1. |turn| > rotateThreshold          -> turn_left / turn_right
 *   2. else the larger of |y| and |x| > deadzone -> go_front/go_back or go_left/go_right (y wins ties)
 *   3. else |turn| > deadzone            -> turn (a gentle twist with nothing else held)
 *   4. else                              -> stop
 * Priority "translate" skips step 1, so any translation beats rotation.
 */
export interface MotionRule {
  priority: "rotate" | "translate";
  rotateThreshold: number;
  deadzone: number;
}

export const MOTION_RULE: MotionRule = { priority: "rotate", rotateThreshold: 0.5, deadzone: 0.25 };

export function resolveMotion(input: DriveInput, rule: MotionRule = MOTION_RULE): Motion {
  if (rule.priority === "rotate" && Math.abs(input.turn) > rule.rotateThreshold) return turnMotion(input.turn);
  const translate = translateMotion(input, rule.deadzone);
  if (translate) return translate;
  if (Math.abs(input.turn) > rule.deadzone) return turnMotion(input.turn);
  return "stop";
}

function turnMotion(turn: number): Motion {
  return turn > 0 ? "turn_right" : "turn_left";
}

function translateMotion({ x, y }: DriveInput, deadzone: number): Motion | null {
  if (Math.max(Math.abs(x), Math.abs(y)) <= deadzone) return null;
  if (Math.abs(y) >= Math.abs(x)) return y > 0 ? "go_front" : "go_back";
  return x > 0 ? "go_right" : "go_left";
}

/** Merges input sources (touch, keys, gamepad) per axis: the stronger push wins, so none cancels another. */
export function combineInputs(...inputs: DriveInput[]): DriveInput {
  const strongest = (axis: keyof DriveInput) =>
    inputs.reduce((best, input) => (Math.abs(input[axis]) > Math.abs(best) ? input[axis] : best), 0);
  return { x: strongest("x"), y: strongest("y"), turn: strongest("turn") };
}

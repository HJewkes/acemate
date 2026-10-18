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

type Translate = (input: DriveInput, deadzone: number) => Motion | null;

export function resolveMotion(input: DriveInput, rule: MotionRule = MOTION_RULE): Motion {
  return resolveWith(translateMotion, input, rule);
}

/**
 * resolveMotion with eight translate directions instead of four: the stick's angle picks the nearest 45° octant, so
 * a push within 22.5° of a diagonal sends go_front_left and the like. The turn rules are the same as resolveMotion's.
 */
export function resolveDiagonalMotion(input: DriveInput, rule: MotionRule = MOTION_RULE): Motion {
  return resolveWith(octantMotion, input, rule);
}

/** A guess: the firmware names a speed field but not its range, so 1..5 is a starting point for the bench test. */
export const DIAGONAL_SPEED_LEVELS = 5;

export interface SpeedMotion {
  motion: Motion;
  /** 1..DIAGONAL_SPEED_LEVELS from how far past the deadzone the stick (or the twist, for a turn) is pushed. */
  speed: number;
}

/** The diagonal drive mode's command: resolveDiagonalMotion plus a speed graded by stick magnitude. */
export function resolveSpeedMotion(input: DriveInput, rule: MotionRule = MOTION_RULE): SpeedMotion {
  const motion = resolveDiagonalMotion(input, rule);
  const turning = motion === "turn_left" || motion === "turn_right";
  const strength = turning ? Math.abs(input.turn) : Math.min(1, Math.hypot(input.x, input.y));
  const graded = Math.ceil(((strength - rule.deadzone) / (1 - rule.deadzone)) * DIAGONAL_SPEED_LEVELS);
  return { motion, speed: Math.min(DIAGONAL_SPEED_LEVELS, Math.max(1, graded)) };
}

function resolveWith(translate: Translate, input: DriveInput, rule: MotionRule): Motion {
  if (rule.priority === "rotate" && Math.abs(input.turn) > rule.rotateThreshold) return turnMotion(input.turn);
  const moving = translate(input, rule.deadzone);
  if (moving) return moving;
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

// Clockwise from forward, one per 45° octant.
const OCTANTS: readonly Motion[] = [
  "go_front",
  "go_front_right",
  "go_right",
  "go_back_right",
  "go_back",
  "go_back_left",
  "go_left",
  "go_front_left",
];

function octantMotion({ x, y }: DriveInput, deadzone: number): Motion | null {
  if (Math.max(Math.abs(x), Math.abs(y)) <= deadzone) return null;
  const octant = Math.round(Math.atan2(x, y) / (Math.PI / 4));
  return OCTANTS[(octant + OCTANTS.length) % OCTANTS.length] ?? null;
}

/** Merges input sources (touch, keys, gamepad) per axis: the stronger push wins, so none cancels another. */
export function combineInputs(...inputs: DriveInput[]): DriveInput {
  const strongest = (axis: keyof DriveInput) =>
    inputs.reduce((best, input) => (Math.abs(input[axis]) > Math.abs(best) ? input[axis] : best), 0);
  return { x: strongest("x"), y: strongest("y"), turn: strongest("turn") };
}

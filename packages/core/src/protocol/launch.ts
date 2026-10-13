// Launcher payloads from app 2.2.0 (ui/drills/DrillSetModeHelper.java); see capabilities-survey.md §1.
import type { Request } from "./protocol";

export class LaunchValidationError extends Error {}

interface Range {
  min: number;
  max: number;
  integer: boolean;
}

// S10 (non-Pro) limits: DeviceType.java and the ball-machine sliders in ui/custom/BallMachineFragment.java.
export const S10_LIMITS = {
  direction: { min: -15, max: 15, integer: true },
  speed: { min: 1, max: 10, integer: true },
  spin: { min: -3, max: 3, integer: true },
  elevation: { min: 10, max: 40, integer: true },
  interval: { min: 1, max: 15, integer: false },
  heightLevel: { min: 1, max: 10, integer: true },
  // Court frame in metres (TrainingCourtView.java:42; height_ranges depths in s10_train_config.json).
  targetX: { min: -4.115, max: 4.115, integer: false },
  targetZ: { min: 7, max: 23, integer: false },
} satisfies Record<string, Range>;

// A probe-side cap so a typo cannot start a long routine; the firmware's own limit is unknown.
export const MAX_TOTAL_BALLS = 10;

// heightMapConfigs midValue per level (train/s10_train_config.json); the app sends metres, not the level.
export const HEIGHT_METRES_BY_LEVEL = [1.5, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.6, 3.3, 3.5];

const DEFAULT_TRAIN_ID = "drive_probe";
// ServeRhythm.MEDIUM default (common/ServeRhythm.java:30), the app's fallback rhythm.
const DEFAULT_SERVE_RHYTHM_OFFSET_S = 0.5;

/** Direction uses the app's UI convention; the payload carries its negation, as the app does. */
export interface Ball {
  direction: number;
  speed: number;
  spin: number;
  elevation: number;
}

export interface BallMachineOptions {
  balls: Ball[];
  totalBalls?: number;
  interval?: number;
  trainId?: string;
}

export interface TargetShotOptions {
  x: number;
  z: number;
  heightLevel: number;
  spin: number;
  trainId?: string;
}

function check(name: string, value: number, range: Range): number {
  if (!Number.isFinite(value)) throw new LaunchValidationError(`${name} must be a number, got ${value}`);
  if (range.integer && !Number.isInteger(value))
    throw new LaunchValidationError(`${name} must be an integer, got ${value}`);
  if (value < range.min || value > range.max) {
    throw new LaunchValidationError(`${name} ${value} is outside the S10 range ${range.min}..${range.max}`);
  }
  return value;
}

function checkInterval(value: number): number {
  check("interval", value, S10_LIMITS.interval);
  if (!Number.isInteger(value * 2)) throw new LaunchValidationError(`interval ${value} must be a multiple of 0.5 s`);
  return value;
}

function checkTotalBalls(value: number): number {
  return check("total_balls", value, { min: 1, max: MAX_TOTAL_BALLS, integer: true });
}

function encodeBall(ball: Ball, index: number): number[] {
  const at = (field: string) => `ball ${index + 1} ${field}`;
  return [
    -check(at("direction"), ball.direction, S10_LIMITS.direction) || 0,
    check(at("speed"), ball.speed, S10_LIMITS.speed),
    check(at("spin"), ball.spin, S10_LIMITS.spin),
    check(at("elevation"), ball.elevation, S10_LIMITS.elevation),
  ];
}

export function ballMachine(options: BallMachineOptions): Request {
  if (options.balls.length === 0) throw new LaunchValidationError("at least one ball is required");
  if (options.balls.length > MAX_TOTAL_BALLS) throw new LaunchValidationError(`at most ${MAX_TOTAL_BALLS} balls`);
  return {
    type: "set_mode",
    data: {
      mode: "ball_machine",
      interval: checkInterval(options.interval ?? 1),
      b: options.balls.map(encodeBall),
      total_balls: checkTotalBalls(options.totalBalls ?? options.balls.length),
      random_order: false,
      group_interval: 0,
      train_id: options.trainId ?? DEFAULT_TRAIN_ID,
    },
  };
}

export function singleShot(ball: Ball, trainId?: string): Request {
  return ballMachine({ balls: [ball], totalBalls: 1, trainId });
}

/** One drill ball aimed at a court point; the robot solves direction, speed and elevation itself. */
export function targetShot(options: TargetShotOptions): Request {
  const level = check("height level", options.heightLevel, S10_LIMITS.heightLevel);
  const target = {
    location: null,
    x: check("x", options.x, S10_LIMITS.targetX),
    z: check("z", options.z, S10_LIMITS.targetZ),
  };
  return {
    type: "set_mode",
    data: {
      mode: "drill",
      total_balls: 1,
      need_catch_ball: false,
      random_order: false,
      group_interval: 0,
      serve_rhythm_offset_s: DEFAULT_SERVE_RHYTHM_OFFSET_S,
      balls: [
        {
          shot: {
            target: [target],
            spin: check("spin", options.spin, S10_LIMITS.spin),
            height: HEIGHT_METRES_BY_LEVEL[level - 1],
          },
          receiving_area: null,
        },
      ],
      train_id: options.trainId ?? DEFAULT_TRAIN_ID,
      override_user_launcher_pitch_offset_with: null,
    },
  };
}

// model/BluetoothData.java:80-98. run_start also resumes a paused run.
export const runRequests = {
  start: (): Request => ({ type: "run_start" }),
  pause: (): Request => ({ type: "run_pause" }),
  stop: (): Request => ({ type: "run_stop" }),
};

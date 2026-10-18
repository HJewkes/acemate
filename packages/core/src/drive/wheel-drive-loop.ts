import { factoryTestRequests, WHEEL_SPEED, type WheelDirection } from "../protocol/wheel-test";
import type { Request } from "../protocol/protocol";
import type { DriveInput } from "./motion";

export interface WheelCommand {
  direction: WheelDirection;
  speed: number;
}

/** deadzone applies to the stick's length; maxSpeed caps the fastest command (10 is about 2 m/s). */
export interface WheelRule {
  deadzone: number;
  maxSpeed: number;
}

export const WHEEL_RULE: WheelRule = { deadzone: 0.25, maxSpeed: WHEEL_SPEED.max };

/**
 * wheel_test takes one preset direction at a time, so there is no diagonal and no turn: the dominant axis picks the
 * direction (y wins ties) and the stick's length, capped at 1, picks the speed. input.turn is ignored. A blended
 * holonomic drive would need a robot-side node.
 */
export function resolveWheelCommand(input: DriveInput, rule: WheelRule = WHEEL_RULE): WheelCommand | null {
  const magnitude = Math.min(1, Math.hypot(input.x, input.y));
  if (magnitude <= rule.deadzone) return null;
  const speed = Math.min(rule.maxSpeed, Math.max(WHEEL_SPEED.min, Math.round(magnitude * rule.maxSpeed)));
  return { direction: dominantDirection(input), speed };
}

function dominantDirection({ x, y }: DriveInput): WheelDirection {
  if (Math.abs(y) >= Math.abs(x)) return y > 0 ? "drive_up" : "drive_down";
  return x > 0 ? "drive_right" : "drive_left";
}

export interface WheelDriveLoopConfig {
  /** Resend wheel_test this often; each send moves the wheels for only ~0.5 s. 100 ms is proven on hardware. */
  resendMs: number;
  /** Stop if update() goes quiet this long; a live controller calls it on every tick. */
  inputTimeoutMs: number;
  /** Extra wheel stops after the first, one per resend slot, in case a without-response write is dropped. */
  stopRepeats: number;
}

export const DEFAULT_WHEEL_LOOP: WheelDriveLoopConfig = { resendMs: 100, inputTimeoutMs: 500, stopRepeats: 2 };

/**
 * The advanced drive path over the factory-test channel, separate from DriveLoop's motion_control path. Call start()
 * once, update() on every input tick, release() when input goes away or the link errors, tick() often (every ~10 ms),
 * and close() when done. Time comes only from now(), so tests drive it with a fake clock.
 */
export class WheelDriveLoop {
  private started = false;
  private current: WheelCommand | null = null;
  private lastSentAt = -Infinity;
  private lastInputAt = -Infinity;
  private stopsPending = 0;

  constructor(
    private readonly send: (request: Request) => void,
    private readonly now: () => number,
    private readonly config: WheelDriveLoopConfig = DEFAULT_WHEEL_LOOP,
    private readonly rule: WheelRule = WHEEL_RULE,
  ) {}

  get command(): WheelCommand | null {
    return this.current;
  }

  get active(): boolean {
    return this.started;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.send(factoryTestRequests.enter());
  }

  /** Ignored until start(), so nothing moves outside factory mode. */
  update(input: DriveInput): void {
    if (!this.started) return;
    this.lastInputAt = this.now();
    const next = resolveWheelCommand(input, this.rule);
    if (!sameCommand(next, this.current)) this.switchTo(next);
  }

  release(): void {
    if (this.current) this.switchTo(null);
  }

  tick(): void {
    if (!this.started) return;
    const now = this.now();
    if (this.current && now - this.lastInputAt >= this.config.inputTimeoutMs) {
      this.switchTo(null);
    } else if (now - this.lastSentAt >= this.config.resendMs) {
      this.resend();
    }
  }

  private resend(): void {
    if (this.current) {
      this.emit(this.current);
    } else if (this.stopsPending > 0) {
      this.stopsPending--;
      this.emit(null);
    }
  }

  /** Stops the wheels, then leaves factory mode. */
  close(): void {
    if (!this.started) return;
    this.current = null;
    this.stopsPending = 0;
    this.emit(null);
    this.send(factoryTestRequests.exit());
    this.started = false;
  }

  private switchTo(command: WheelCommand | null): void {
    this.current = command;
    this.stopsPending = command ? 0 : this.config.stopRepeats;
    this.emit(command);
  }

  private emit(command: WheelCommand | null): void {
    this.lastSentAt = this.now();
    this.send(
      command ? factoryTestRequests.wheelStart(command.direction, command.speed) : factoryTestRequests.wheelStop(),
    );
  }
}

function sameCommand(a: WheelCommand | null, b: WheelCommand | null): boolean {
  return a?.direction === b?.direction && a?.speed === b?.speed;
}

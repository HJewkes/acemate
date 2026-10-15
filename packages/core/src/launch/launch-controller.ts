import { ballMachine, runRequests, singleShot, targetShot, type Ball } from "../protocol/launch";
import type { Request } from "../protocol/protocol";

export type LaunchMessage =
  | {
      kind: "machine";
      direction: number;
      speed: number;
      spin: number;
      elevation: number;
      count: number;
      interval: number;
      trainId?: string;
    }
  /** Distinct balls fired in order (random_order:false), one pass of total_balls = balls.length. */
  | { kind: "machine-queue"; balls: Ball[]; interval: number; trainId?: string }
  | { kind: "target"; x: number; z: number; heightLevel: number; spin: number; trainId?: string }
  | { kind: "stop" }
  | { kind: "pause" };

const KINDS = new Set(["machine", "machine-queue", "target", "stop", "pause"]);
const SET_MODE_TIMEOUT_MS = 3000;
// The robot can accept set_mode and then silently refuse run_start (seen 2026-10-11 at bat 0).
export const START_TIMEOUT_MS = 8000;

/** Page messages are {"launch": {...}}; anything else is not a launch message. */
export function parseLaunch(data: unknown): LaunchMessage | null {
  try {
    const launch = (JSON.parse(String(data)) as { launch?: { kind?: unknown } } | null)?.launch;
    return launch && KINDS.has(String(launch.kind)) ? (launch as LaunchMessage) : null;
  } catch {
    return null;
  }
}

/** Throws LaunchValidationError for anything outside the S10 limits. */
export function setModeFor(message: Extract<LaunchMessage, { kind: "machine" | "machine-queue" | "target" }>): Request {
  if (message.kind === "target") return targetShot(message);
  if (message.kind === "machine-queue") {
    return ballMachine({ balls: message.balls, interval: message.interval, trainId: message.trainId });
  }
  const ball = { direction: message.direction, speed: message.speed, spin: message.spin, elevation: message.elevation };
  if (message.count === 1) return singleShot(ball, message.trainId);
  return ballMachine({
    balls: [ball],
    totalBalls: message.count,
    interval: message.interval,
    trainId: message.trainId,
  });
}

export interface LaunchDeps {
  send(request: Request): Promise<void>;
  waitFor(type: string, timeoutMs: number): Promise<Request | null>;
  driveStopped(): boolean;
  report(text: string): void;
  now(): number;
}

/**
 * One run at a time; refuses to fire while driving or while a set_mode awaits its reply,
 * and only starts after the robot acknowledges set_mode.
 */
export class LaunchController {
  private active = false;
  private firing = false;
  private stoppedWhileFiring = false;
  private sawRunning = false;
  private pushedStart = false;
  private robotStartTime: number | null = null;
  private startedAt = 0;

  constructor(private readonly deps: LaunchDeps) {}

  get running(): boolean {
    return this.active;
  }

  /** True while a fire waits for its set_mode reply, before the run counts as active. */
  get inFlight(): boolean {
    return this.firing;
  }

  /** A run may be going on the robot: it is active, or a set_mode was sent and its reply is pending. */
  get mayBeRunning(): boolean {
    return this.active || this.firing;
  }

  async handle(message: LaunchMessage): Promise<void> {
    if (message.kind === "stop") return this.stop();
    if (message.kind === "pause") return this.command(runRequests.pause(), "run_pause sent");
    return this.fire(message);
  }

  /**
   * The robot pushed run_start: the active run has started. start_time (robot clock) is kept to spot a stale run_stop.
   * A push while no run is active (a gesture start, or after we stopped) is not ours to track.
   */
  onRunStart(startTime: unknown): void {
    if (!this.active) return;
    this.pushedStart = true;
    this.robotStartTime = finiteNumber(startTime);
  }

  /**
   * The robot pushed run_stop. Pushes carry no run id, so it ends the active run only once this run is known to have
   * started (BLE keeps order, so a run_stop after that is about this run) and its end_time is not before start_time.
   */
  onRunStop(reason: unknown, endTime: unknown): void {
    if (!this.active || !(this.pushedStart || this.sawRunning)) return;
    const end = finiteNumber(endTime);
    if (end !== null && this.robotStartTime !== null && end < this.robotStartTime) return;
    this.finish(`Run finished (run_stop${typeof reason === "string" ? ` ${reason}` : ""})`);
  }

  /** Clears the active run once a heartbeat shows it finished, or that it never started. */
  onCarState(running: boolean, now: number): void {
    if (!this.active) return;
    if (running) this.sawRunning = true;
    // A heartbeat can be sampled before the robot raises running, even after its run_start push, so only a
    // heartbeat that has itself shown running:true may end the run by going false; the push alone may not.
    else if (this.sawRunning) this.finish("Run finished (heartbeat running:false)");
    else if (now - this.startedAt < START_TIMEOUT_MS) return;
    else if (this.pushedStart) this.finish("Run ended without a run_stop push (running stayed false); cleared.");
    else this.finish("Robot did not start the run (running stayed false); cleared.");
  }

  private async fire(message: Extract<LaunchMessage, { kind: "machine" | "machine-queue" | "target" }>): Promise<void> {
    // active is only set once rsp_set_mode arrives (up to 3 s); firing covers the wait before it.
    if (this.firing) return this.deps.report("Still waiting for the last launch; try again.");
    if (this.active) return this.deps.report("A run is already active; stop it first.");
    if (!this.deps.driveStopped()) return this.deps.report("Stop driving before launching.");
    let setMode: Request;
    try {
      setMode = setModeFor(message);
    } catch (error) {
      return this.deps.report(`Rejected: ${(error as Error).message}`);
    }
    this.firing = true;
    this.stoppedWhileFiring = false;
    let reply: Request | null;
    try {
      await this.deps.send(setMode);
      reply = await this.deps.waitFor("rsp_set_mode", SET_MODE_TIMEOUT_MS);
    } finally {
      this.firing = false;
    }
    if (!reply) return this.deps.report("No rsp_set_mode within 3 s; not starting.");
    if (this.stoppedWhileFiring) return this.deps.report("Stopped before the run started; not starting.");
    this.deps.report(`rsp_set_mode ${JSON.stringify(reply.data ?? {})}`);
    this.active = true;
    this.sawRunning = false;
    this.pushedStart = false;
    this.robotStartTime = null;
    this.startedAt = this.deps.now();
    await this.command(runRequests.start(), "run_start sent");
  }

  private async stop(): Promise<void> {
    this.stoppedWhileFiring ||= this.firing;
    await this.command(runRequests.stop(), "run_stop sent");
    this.finish(null);
  }

  private async command(request: Request, text: string): Promise<void> {
    await this.deps.send(request);
    this.deps.report(text);
  }

  private finish(text: string | null): void {
    this.active = false;
    this.sawRunning = false;
    if (text) this.deps.report(text);
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

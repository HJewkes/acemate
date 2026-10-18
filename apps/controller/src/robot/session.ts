import {
  DEFAULT_LOOP,
  DEFAULT_WHEEL_LOOP,
  DriveLoop,
  LineDecoder,
  encodeLine,
  parseMessage,
  requests,
  WheelDriveLoop,
  type DriveInput,
  type DriveLoopConfig,
  type Motion,
  type Request,
  type WheelDriveLoopConfig,
} from "@acemate/core";
import { trace } from "../debug/log-buffer";
import type { ByteChannel } from "./channel";
import type { DriveMode } from "./drive-mode";
import { LaunchLink } from "./launch-link";

export type RobotMessage = ReturnType<typeof parseMessage>;

interface SessionConfig {
  loop: DriveLoopConfig;
  wheels: WheelDriveLoopConfig;
  /** The app polls the heartbeat every few seconds, and only while the robot is stopped. */
  heartbeatMs: number;
}

export const DEFAULT_SESSION: SessionConfig = { loop: DEFAULT_LOOP, wheels: DEFAULT_WHEEL_LOOP, heartbeatMs: 3000 };

// On iOS, with-response writes at connect stalled the queue (2026-10-12); unacked writes up to one packet worked.
// Only lines too big for one packet (iOS allows ~182 bytes unacked) go with response, as a long write.
const MAX_UNACKED_WRITE = 180;
// A hung write must never block the queue: motion and stop have to keep flowing.
const WRITE_TIMEOUT_MS = 1000;

const NO_INPUT: DriveInput = { x: 0, y: 0, turn: 0 };

// Drive commands are logged only when they change, not on every resend; anything else returns null and always logs.
function driveLogKey(request: Request): string | null {
  const { command, action, data } = request as {
    command?: string;
    action?: string;
    data?: { motion?: string; direction?: string; speed?: number };
  };
  if (request.type === "motion_control") return `motion ${data?.motion} ${data?.speed ?? ""}`;
  if (command === "wheel_test") return `wheel ${action} ${data?.direction} ${data?.speed}`;
  return null;
}

function debugLog(direction: "rx" | "tx", payload: unknown): void {
  trace(`${direction} ${JSON.stringify(payload).slice(0, 240)}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (error: unknown) => (clearTimeout(timer), reject(error)),
    );
  });
}

/**
 * One connected robot: frames requests onto the channel, decodes its messages, and runs the drive loop.
 * Call drive() with the wanted motion and tick() every ~10 ms; time comes only from now(), so tests use a fake clock.
 * The drive mode picks the path: stock and diagonal share the motion_control DriveLoop (diagonal adds a speed field and
 * is fed by driveDiagonal()); wheel runs the factory-test WheelDriveLoop, fed by driveWheels(). One path sends at a time.
 */
export class RobotSession {
  readonly launch: LaunchLink;
  /** The stock app blocks motion during a run, so how the firmware handles it is unknown; off by default. */
  allowDriveDuringRun = false;
  // The first motion of each run is logged, so a test drive shows up in Metro without flooding it.
  private drivenThisRun = false;
  private readonly loop: DriveLoop;
  private readonly wheels: WheelDriveLoop;
  private readonly decoder = new LineDecoder();
  private readonly unsubscribe: () => void;
  private diagonal = false;
  // The diagonal mode's latest speed; a change alone goes out on the next resend, within one resend period.
  private speed = 1;
  private queue = Promise.resolve();
  private lastHeartbeatAt: number;
  private closed = false;

  constructor(
    readonly channel: ByteChannel,
    onMessage: (message: RobotMessage) => void,
    private readonly now: () => number = Date.now,
    private readonly config: SessionConfig = DEFAULT_SESSION,
  ) {
    this.loop = new DriveLoop((motion) => this.fire(this.motionFrame(motion)), now, config.loop);
    this.wheels = new WheelDriveLoop((request) => this.fire(request), now, config.wheels);
    this.launch = new LaunchLink({
      send: (request) => this.send(request),
      driveStopped: () => this.stopped,
      now,
    });
    this.launch.listen({ report: (text) => trace(`launch ${text}`), carState: () => undefined });
    this.unsubscribe = channel.onData((data) =>
      this.decoder
        .push(data)
        .map(parseMessage)
        .forEach((message) => {
          debugLog("rx", message);
          this.launch.onMessage(message);
          onMessage(message);
        }),
    );
    this.lastHeartbeatAt = now();
    this.fire(requests.askInit());
  }

  get motion(): Motion {
    return this.loop.motion;
  }

  /** Wheel while factory mode is entered; an emergency stop leaves it, falling back to stock. */
  get driveMode(): DriveMode {
    if (this.wheels.active) return "wheel";
    return this.diagonal ? "diagonal" : "stock";
  }

  private get stopped(): boolean {
    return this.wheels.active ? this.wheels.command === null : this.loop.motion === "stop";
  }

  /** Any switch stops the current path first; entering wheel enters factory mode and leaving it exits. */
  setDriveMode(mode: DriveMode): void {
    if (this.closed || mode === this.driveMode) return;
    this.loop.release();
    this.wheels.close();
    this.diagonal = mode === "diagonal";
    if (mode === "wheel") this.wheels.start();
  }

  /**
   * While a launch run is active the robot is held at stop, whatever the sticks say, unless allowDriveDuringRun.
   * Either way a new launch still needs the robot stopped. Ignored outside stock mode.
   */
  drive(motion: Motion): void {
    if (this.closed || this.driveMode !== "stock") return;
    this.driveMotion(motion);
  }

  /** The diagonal-mode drive(): any of the eight directions, with the speed sent alongside it. */
  driveDiagonal(motion: Motion, speed: number): void {
    if (this.closed || this.driveMode !== "diagonal") return;
    this.speed = speed;
    this.driveMotion(motion);
  }

  private driveMotion(motion: Motion): void {
    const wanted = this.holdForRun(motion !== "stop", () => motion) ? "stop" : motion;
    this.loop.update(wanted);
  }

  // Stops always go as the stock frame, the one stop known to work, so shot_switch stays "off" on every frame.
  private motionFrame(motion: Motion): Request {
    return this.diagonal && motion !== "stop" ? requests.motionWithSpeed(motion, this.speed) : requests.motion(motion);
  }

  /** The wheel-mode drive(): the stick vector goes to the wheel loop, with the same hold during a run. */
  driveWheels(input: DriveInput): void {
    if (this.closed || this.driveMode !== "wheel") return;
    const moving = input.x !== 0 || input.y !== 0;
    this.wheels.update(this.holdForRun(moving, () => JSON.stringify(input)) ? NO_INPUT : input);
  }

  private holdForRun(moving: boolean, describe: () => string): boolean {
    const running = this.launch.running;
    const hold = running && !this.allowDriveDuringRun;
    if (running && moving && !hold && !this.drivenThisRun) trace(`driving during run: ${describe()}`);
    this.drivenThisRun = running && (this.drivenThisRun || (moving && !hold));
    return hold;
  }

  /** Stops driving at once (in wheel mode: stops the wheels and leaves factory mode), then stops any launch run. */
  emergencyStop(): void {
    if (this.wheels.active) this.wheels.close();
    else this.driveMotion("stop");
    void this.launch.handle({ kind: "stop" });
  }

  tick(): void {
    if (this.closed) return;
    if (this.wheels.active) this.wheels.tick();
    else this.loop.tick();
    if (this.stopped && this.now() - this.lastHeartbeatAt >= this.config.heartbeatMs) {
      this.lastHeartbeatAt = this.now();
      this.fire(requests.heartbeat());
    }
  }

  /**
   * Stops the robot, then any launch run that may be going, waits for those writes, then disconnects. Safe to call twice.
   * Whether the robot ends a run on link loss is unverified, so a run is never left to outlive the session.
   */
  async shutdown(): Promise<void> {
    if (this.closed) return;
    this.wheels.close();
    this.loop.release();
    const stopped = this.send(requests.motion("stop"));
    const runStopped = this.launch.mayBeRunning ? this.launch.handle({ kind: "stop" }) : Promise.resolve();
    this.closed = true;
    this.unsubscribe();
    await stopped.catch(() => undefined);
    await runStopped;
    await this.channel.close();
  }

  // A dropped write is tolerated: motions resend every 50 ms and stops repeat. Link loss surfaces as a disconnect.
  private fire(request: Request): void {
    this.send(request).catch(() => undefined);
  }

  private lastLoggedDrive = "";

  private logSend(request: Request): void {
    const key = driveLogKey(request);
    if (key !== null && key === this.lastLoggedDrive) return;
    this.lastLoggedDrive = key ?? this.lastLoggedDrive;
    debugLog("tx", request);
  }

  // One request per write, queued so writes never overlap; a failed write doesn't jam the queue.

  private send(request: Request): Promise<void> {
    if (this.closed) return Promise.resolve();
    const line = encodeLine(request);
    const withResponse = line.length > Math.min(MAX_UNACKED_WRITE, this.channel.maxUnackedWrite ?? MAX_UNACKED_WRITE);
    this.logSend(request);
    const write = () => withTimeout(this.channel.write(line, withResponse), WRITE_TIMEOUT_MS, request.type);
    this.queue = this.queue.catch(() => undefined).then(write);
    this.queue.catch((error: Error) => trace(`${request.type} write failed: ${error.message}`));
    return this.queue;
  }
}

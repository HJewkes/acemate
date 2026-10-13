// The browser half of what tools/web-drive/src/server.ts does: inbox, set_time, heartbeat, car_state and the drive loop.
import { parseMessage, requests, type Request } from "../../../tools/drive-probe/src/protocol.js";
import { runRequests } from "../../../tools/drive-probe/src/launch.js";
import { DriveLoop } from "../../../tools/web-drive/src/drive-loop.js";
import { LaunchController, type LaunchMessage } from "../../../tools/web-drive/src/launcher.js";
import type { Motion } from "../../../tools/web-drive/src/motion.js";
import type { Link } from "./link.js";

export type CarState = { running?: boolean; bat?: number | null; mode?: string; time_is_set?: boolean } & Record<string, unknown>;

export const HEARTBEAT_MS = 3000;
export const SET_TIME_RETRY_MS = 30_000;

export function carStateOf(message: Request): CarState | null {
  if (message.type !== "rsp_heartbeat") return null;
  return (message.data as { car_state?: CarState } | undefined)?.car_state ?? null;
}

// The app sends set_time whenever the heartbeat says the clock is unset (BluetoothService.java:698-703).
export function needsSetTime(carState: CarState, now: number, lastSentAt: number): boolean {
  return carState.time_is_set === false && now - lastSentAt > SET_TIME_RETRY_MS;
}

export function setTimeRequest(nowMs: number, timeZone: string, countryCode: string): Request {
  return {
    type: "set_time",
    data: { unix_timestamp: Math.floor(nowMs / 1000), time_zone: timeZone, country_code: countryCode },
  };
}

// The stock app skips heartbeats while moving; mirror that so polls never compete with motion writes.
export function heartbeatDue(motion: Motion, now: number, lastAt: number, intervalMs = HEARTBEAT_MS): boolean {
  return motion === "stop" && now - lastAt >= intervalMs;
}

type Waiter = { type: string; resolve: (message: Request | null) => void };

/** Lets a caller await the next robot message of one type, e.g. rsp_set_mode after set_mode. */
export class Inbox {
  private readonly waiters = new Set<Waiter>();

  dispatch(message: Request): void {
    for (const waiter of this.waiters) if (waiter.type === message.type) waiter.resolve(message);
  }

  waitFor(type: string, timeoutMs: number): Promise<Request | null> {
    return new Promise((resolve) => {
      const waiter: Waiter = {
        type,
        resolve: (message) => {
          this.waiters.delete(waiter);
          clearTimeout(timer);
          resolve(message);
        },
      };
      const timer = setTimeout(() => waiter.resolve(null), timeoutMs);
      this.waiters.add(waiter);
    });
  }
}

export interface SessionEvents {
  onCarState(carState: CarState): void;
  onMessage(message: Request): void;
  /** The motion now being sent, reported only when it changes. */
  onSent(motion: Motion): void;
  report(text: string): void;
}

export interface SessionClock {
  now(): number;
  timeZone: string;
  countryCode: string;
}

/**
 * One connected robot. Call drive() with the wanted motion on every input frame and tick() every ~10 ms.
 * Nothing is sent until start(), which the page calls only after the user's Connect.
 */
export class RobotSession {
  readonly launcher: LaunchController;
  private readonly loop: DriveLoop;
  private readonly inbox = new Inbox();
  private lastHeartbeatAt = -Infinity;
  private timeSentAt = -Infinity;
  private reported: Motion = "stop";

  constructor(
    private readonly link: Link,
    private readonly events: SessionEvents,
    private readonly clock: SessionClock,
  ) {
    this.loop = new DriveLoop((motion) => this.sendMotion(motion), clock.now);
    this.launcher = new LaunchController({
      send: (request) => this.send(request),
      waitFor: (type, timeoutMs) => this.inbox.waitFor(type, timeoutMs),
      driveStopped: () => this.loop.motion === "stop",
      report: events.report,
      now: clock.now,
    });
    link.onLine((line) => this.receive(parseMessage(line) as Request));
  }

  get motion(): Motion {
    return this.loop.motion;
  }

  start(): Promise<void> {
    this.lastHeartbeatAt = this.clock.now();
    return this.send(requests.askInit());
  }

  /** While a launch run is active, drive input is held at stop, as the stock app does. */
  drive(motion: Motion): void {
    this.loop.update(this.launcher.running ? "stop" : motion);
  }

  release(): void {
    this.loop.release();
  }

  tick(): void {
    this.loop.tick();
    const now = this.clock.now();
    if (!heartbeatDue(this.loop.motion, now, this.lastHeartbeatAt)) return;
    this.lastHeartbeatAt = now;
    void this.send(requests.heartbeat());
  }

  launch(message: LaunchMessage): Promise<void> {
    return this.launcher.handle(message);
  }

  /** Stops driving and any launch run. Sends run_stop even if the page thinks nothing is running. */
  emergencyStop(): Promise<void> {
    this.loop.release();
    return this.launcher.handle({ kind: "stop" });
  }

  /** Stops the robot, waits for the stop to be written, then disconnects. */
  async shutdown(): Promise<void> {
    this.loop.release();
    if (this.launcher.running) await this.send(runRequests.stop());
    await this.send(requests.motion("stop"));
    await this.link.close();
  }

  private receive(message: Request): void {
    this.inbox.dispatch(message);
    this.events.onMessage(message);
    const carState = carStateOf(message);
    if (!carState) return;
    const now = this.clock.now();
    if (needsSetTime(carState, now, this.timeSentAt)) {
      this.timeSentAt = now;
      void this.send(setTimeRequest(now, this.clock.timeZone, this.clock.countryCode));
    }
    this.launcher.onCarState(carState.running === true, now);
    this.events.onCarState(carState);
  }

  private sendMotion(motion: Motion): void {
    // A dropped motion write is tolerated: it resends in 50 ms, and stops repeat.
    this.link.send(requests.motion(motion)).catch(() => undefined);
    if (motion === this.reported) return;
    this.reported = motion;
    this.events.onSent(motion);
  }

  private send(request: Request): Promise<void> {
    return this.link.send(request).catch((error: unknown) => this.events.report(`${request.type} failed: ${String(error)}`));
  }
}

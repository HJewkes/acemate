import type { Motion } from "./motion";

export interface DriveLoopConfig {
  /** Resend the held motion this often; the robot accepts 50 ms without-response writes. */
  resendMs: number;
  /** Stop if the page goes quiet this long; it heartbeats every 50 ms while open. */
  inputTimeoutMs: number;
  /** Extra stops after the first, one per resend slot, in case a without-response write is dropped. */
  stopRepeats: number;
}

export const DEFAULT_LOOP: DriveLoopConfig = { resendMs: 50, inputTimeoutMs: 300, stopRepeats: 2 };

/**
 * Owns what goes to the robot. Call update() for every page message, release() when the page goes away,
 * and tick() often (every ~10 ms); time comes only from now(), so tests drive it with a fake clock.
 */
export class DriveLoop {
  private current: Motion = "stop";
  private lastSentAt = -Infinity;
  private lastInputAt = -Infinity;
  private stopsPending = 0;

  constructor(
    private readonly send: (motion: Motion) => void,
    private readonly now: () => number,
    private readonly config: DriveLoopConfig = DEFAULT_LOOP,
  ) {}

  get motion(): Motion {
    return this.current;
  }

  update(motion: Motion): void {
    this.lastInputAt = this.now();
    if (motion !== this.current) this.switchTo(motion);
  }

  release(): void {
    if (this.current !== "stop") this.switchTo("stop");
  }

  tick(): void {
    const now = this.now();
    if (this.current !== "stop" && now - this.lastInputAt >= this.config.inputTimeoutMs) return this.switchTo("stop");
    if (now - this.lastSentAt < this.config.resendMs) return;
    if (this.current !== "stop") return this.emit(this.current);
    if (this.stopsPending > 0) {
      this.stopsPending--;
      this.emit("stop");
    }
  }

  private switchTo(motion: Motion): void {
    this.current = motion;
    this.stopsPending = motion === "stop" ? this.config.stopRepeats : 0;
    this.emit(motion);
  }

  private emit(motion: Motion): void {
    this.lastSentAt = this.now();
    this.send(motion);
  }
}

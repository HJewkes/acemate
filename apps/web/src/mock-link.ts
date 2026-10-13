import type { Request } from "../../../tools/drive-probe/src/protocol.js";
import type { Link } from "./link.js";

const REPLY_DELAY_MS = 30;

/** A pretend S10 for ?mock=1: answers init, heartbeat, set_time, set_mode and runs, so the page works with no robot. */
export class MockLink implements Link {
  readonly name = "ACEMATE-MOCK0";
  readonly sent: Request[] = [];
  private readonly lineListeners: ((line: string) => void)[] = [];
  private readonly disconnectListeners: (() => void)[] = [];
  private carState = { car_loc_status: 0, time_is_set: false, mode: "rally", running: false, train_id: null, runner_state: 0, bat: 76 };
  private runSeconds = 1;
  private runTimer: ReturnType<typeof setTimeout> | undefined;

  async send(request: Request): Promise<void> {
    this.sent.push(request);
    const reply = this.answer(request);
    if (reply) setTimeout(() => this.emit(reply), REPLY_DELAY_MS);
  }

  onLine(listener: (line: string) => void): void {
    this.lineListeners.push(listener);
  }

  onDisconnect(listener: () => void): void {
    this.disconnectListeners.push(listener);
  }

  async close(): Promise<void> {
    clearTimeout(this.runTimer);
    this.disconnectListeners.forEach((listener) => listener());
  }

  private answer(request: Request): Request | null {
    switch (request.type) {
      case "ask_init_data":
        return { type: "rsp_init_data", data: { robot_id: "MOCK", rk_software_version: "mock", mode: "rally" } };
      case "ask_heartbeat":
        return { type: "rsp_heartbeat", data: { car_state: { ...this.carState } } };
      case "set_time":
        this.carState.time_is_set = true;
        return { type: "rsp_set_time", data: { result: "ok" } };
      case "set_mode":
        return this.setMode(request);
      case "run_start":
        this.setRunning(true);
        return null;
      case "run_pause":
      case "run_stop":
        this.setRunning(false);
        return null;
      default:
        return null;
    }
  }

  private setMode(request: Request): Request {
    const data = (request.data ?? {}) as { mode?: string; total_balls?: number; interval?: number };
    this.carState.mode = data.mode ?? this.carState.mode;
    this.runSeconds = (data.total_balls ?? 1) * (data.interval ?? 1);
    return { type: "rsp_set_mode", data: { mode: this.carState.mode, result: "ok" } };
  }

  private setRunning(running: boolean): void {
    clearTimeout(this.runTimer);
    this.carState.running = running;
    if (running) this.runTimer = setTimeout(() => (this.carState.running = false), this.runSeconds * 1000);
  }

  private emit(message: Request): void {
    const line = JSON.stringify(message);
    this.lineListeners.forEach((listener) => listener(line));
  }
}

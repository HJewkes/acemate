import { parseMessage, type Request } from "../protocol/protocol";

// Reply shapes follow captures in docs/protocol.md; rsp_set_time and rsp_set_mode fields beyond type are unconfirmed.
export const MOCK_ROBOT_NAME = "ACEMATE-MOCK0";
const REPLY_DELAY_MS = 30;
// Each wheel_test start drives one CAN frame that lasts about this long on the robot.
export const MOCK_WHEEL_FRAME_MS = 500;

export interface MockCarState {
  car_loc_status: number;
  time_is_set: boolean;
  mode: string;
  running: boolean;
  train_id: null;
  runner_state: number;
  bat: number;
}

/** Factory-test state the hardware does not report; tests read it to see what the wheels would do. */
export interface MockFactoryState {
  factoryMode: boolean;
  wheels: { direction: string; speed: number } | null;
}

/** One robot-to-app message as the S10 sends it: compact JSON ending in the +==ACE==+ marker. */
export function robotLine(message: Request): string {
  return `${JSON.stringify(message)}+==ACE==+`;
}

/**
 * A pretend S10 with no transport: each write's text goes in, replies come out through emit after a short delay.
 * It models what the hardware showed: a write that is not one whole message is ignored, and run_start does nothing
 * until set_time has set the clock.
 */
export class MockRobot {
  /** Every request received, oldest first. */
  readonly received: Request[] = [];
  private readonly carState: MockCarState = {
    car_loc_status: 0,
    time_is_set: false,
    mode: "rally",
    running: false,
    train_id: null,
    runner_state: 0,
    bat: 76,
  };
  private readonly factory: MockFactoryState = { factoryMode: false, wheels: null };
  private runSeconds = 1;
  private runTimer: ReturnType<typeof setTimeout> | undefined;
  private wheelTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly emit: (message: Request) => void) {}

  get state(): Readonly<MockCarState> {
    return { ...this.carState };
  }

  get factoryState(): Readonly<MockFactoryState> {
    return { ...this.factory };
  }

  /** Takes the text of one BLE write; the robot parses each write as a whole message. */
  receive(text: string): void {
    const request = parseMessage(text.trim());
    if (request.type === "raw") return;
    this.received.push(request);
    const reply = this.answer(request);
    if (reply) this.later(reply);
  }

  /** Cancels a pending run end and wheel frame, as a dropped link would. */
  close(): void {
    clearTimeout(this.runTimer);
    clearTimeout(this.wheelTimer);
  }

  private answer(request: Request): Request | null {
    switch (request.type) {
      case "ask_init_data":
        return {
          type: "rsp_init_data",
          data: { robot_id: "MOCK", rk_software_version: "mock", mode: this.carState.mode },
        };
      case "ask_heartbeat":
        return { type: "rsp_heartbeat", data: { car_state: this.state } };
      case "set_time":
        this.carState.time_is_set = true;
        return { type: "rsp_set_time", data: { result: "ok" } };
      case "set_mode":
        return this.setMode(request);
      case "run_start":
        return this.startRun();
      case "factory_test":
        return this.factoryTest(request);
      case "run_pause":
      case "run_stop":
        this.endRun();
        return null;
      default:
        return null;
    }
  }

  private setMode(request: Request): Request {
    const data = (request.data ?? {}) as { mode?: unknown; total_balls?: unknown; interval?: unknown };
    if (typeof data.mode === "string") this.carState.mode = data.mode;
    const balls = typeof data.total_balls === "number" ? data.total_balls : 1;
    const interval = typeof data.interval === "number" ? data.interval : 1;
    this.runSeconds = balls * interval;
    return { type: "rsp_set_mode", data: { mode: this.carState.mode, result: "ok" } };
  }

  // The robot acks entry with factory_test/start/success; the exact field names are unconfirmed.
  private factoryTest(request: Request): Request | null {
    const { command, action } = request;
    if (command === "wheel_test") return this.wheelTest(action, request.data);
    if (action !== "start" && action !== "stop") return null;
    this.factory.factoryMode = action === "start";
    this.setWheels(null);
    return { type: "factory_test", action, result: "success" };
  }

  // wheels_speeds is an instantaneous readback that always shows zeros on the hardware.
  private wheelTest(action: unknown, data: unknown): Request | null {
    if (!this.factory.factoryMode) return null;
    if (action === "stop") this.setWheels(null);
    else if (action === "start") this.setWheels(wheelsFrom(data));
    else return null;
    return {
      type: "factory_test",
      command: "wheel_test",
      action,
      result: "success",
      data: { wheels_speeds: [0, 0, 0, 0] },
    };
  }

  private setWheels(wheels: MockFactoryState["wheels"]): void {
    clearTimeout(this.wheelTimer);
    this.factory.wheels = wheels;
    if (wheels) this.wheelTimer = setTimeout(() => (this.factory.wheels = null), MOCK_WHEEL_FRAME_MS);
  }

  private startRun(): Request | null {
    if (!this.carState.time_is_set) return null;
    clearTimeout(this.runTimer);
    this.carState.running = true;
    this.runTimer = setTimeout(() => {
      this.endRun();
      this.emit({ type: "run_stop", reason: "ball_machine_finished" });
    }, this.runSeconds * 1000);
    return { type: "run_start", mode: this.carState.mode, start_time: Math.floor(Date.now() / 1000) };
  }

  private endRun(): void {
    clearTimeout(this.runTimer);
    this.carState.running = false;
  }

  private later(message: Request): void {
    setTimeout(() => this.emit(message), REPLY_DELAY_MS);
  }
}

function wheelsFrom(data: unknown): MockFactoryState["wheels"] {
  const { direction, speed } = (data ?? {}) as { direction?: unknown; speed?: unknown };
  return typeof direction === "string" && typeof speed === "number" ? { direction, speed } : null;
}

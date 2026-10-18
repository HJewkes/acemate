// Nordic UART over BLE: one compact JSON line per write; robot messages end with +==ACE==+, not a newline.
export const NUS_SERVICE = "6e400001b5a3f393e0a9e50e24dcca9e";
export const NUS_WRITE = "6e400002b5a3f393e0a9e50e24dcca9e";
export const NUS_NOTIFY = "6e400003b5a3f393e0a9e50e24dcca9e";

export const MOTIONS = ["go_front", "go_back", "go_left", "go_right", "turn_left", "turn_right", "stop"] as const;
/**
 * Found in firmware 2.2.11's motion_control string table, next to speed/f_speed/h_speed/yaw_speed; never seen on the
 * wire from the stock app, so whether the robot acts on them is unverified. Only the diagonal drive mode sends them.
 */
export const DIAGONAL_MOTIONS = ["go_front_left", "go_front_right", "go_back_left", "go_back_right"] as const;
export type Motion = (typeof MOTIONS)[number] | (typeof DIAGONAL_MOTIONS)[number];

export type Request = Record<string, unknown> & { type: string };

export const requests = {
  askInit: (): Request => ({ type: "ask_init_data" }),
  heartbeat: (): Request => ({ type: "ask_heartbeat" }),
  remoteMode: (): Request => ({ type: "set_mode", data: { mode: "motion_control" } }),
  motion: (motion: Motion): Request => ({
    type: "motion_control",
    data: { motion, shot_switch: "off" },
  }),
  /** motion_control with the per-message speed field guessed from the firmware strings; unverified on hardware. */
  motionWithSpeed: (motion: Motion, speed: number): Request => ({
    type: "motion_control",
    data: { motion, speed, shot_switch: "off" },
  }),
};

/** The wire text of one request; browsers encode it with TextEncoder, Node with encodeLine. */
export function lineText(request: Request): string {
  return `${JSON.stringify(request)}\r\n`;
}

export function encodeLine(request: Request): Buffer {
  return Buffer.from(lineText(request), "utf8");
}

export function chunk(buffer: Buffer, size: number): Buffer[] {
  const parts: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += size) {
    parts.push(buffer.subarray(offset, offset + size));
  }
  return parts;
}

// Robot-to-app messages end with the +==ACE==+ marker (BluetoothService.java:101), not CRLF.
const MESSAGE_BOUNDARY = /\+==ACE==\+|\r?\n/;

// Notifications may split or merge messages, so reassemble on the end marker; newlines are accepted defensively.
// Takes any Uint8Array (a Node Buffer or a browser DataView's bytes); streaming decode keeps split UTF-8 characters whole.
export class LineDecoder {
  private pending = "";
  private readonly utf8 = new TextDecoder();

  push(data: Uint8Array): string[] {
    this.pending += this.utf8.decode(data, { stream: true });
    const lines = this.pending.split(MESSAGE_BOUNDARY);
    this.pending = lines.pop() ?? "";
    return lines.map((line) => line.trim()).filter((line) => line.length > 0);
  }
}

export function parseMessage(line: string): Request | { type: "raw"; line: string } {
  try {
    const value: unknown = JSON.parse(line);
    if (value && typeof value === "object" && "type" in value) return value as Request;
  } catch {
    // Not JSON; fall through to raw.
  }
  return { type: "raw", line };
}

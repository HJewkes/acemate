import { MOTIONS, type DriveLoop, parseLaunch, type LaunchMessage, type Motion } from "@acemate/core";

/** The slice of a ws WebSocket this needs, so tests can pass an EventEmitter. */
export interface ControlSocket {
  on(event: "message", listener: (data: unknown) => void): unknown;
  on(event: "close", listener: () => void): unknown;
}

/** Page messages are {"motion": M}; anything unparseable counts as stop rather than being ignored. */
export function parseControl(data: unknown): Motion {
  try {
    const value: unknown = JSON.parse(String(data));
    const motion = (value as { motion?: unknown } | null)?.motion;
    return MOTIONS.find((m) => m === motion) ?? "stop";
  } catch {
    return "stop";
  }
}

export interface LaunchHooks {
  onLaunch(message: LaunchMessage): void;
  /** True while a launch run is active; drive input is held at stop so the robot stays put. */
  blockMotion(): boolean;
}

export function attachControl(socket: ControlSocket, loop: DriveLoop, launch?: LaunchHooks): void {
  socket.on("message", (data) => {
    const message = launch ? parseLaunch(data) : null;
    if (message && launch) return launch.onLaunch(message);
    loop.update(launch?.blockMotion() ? "stop" : parseControl(data));
  });
  socket.on("close", () => loop.release());
}

import { applyStopLatch, combineInputs, resolveMotion, type Motion } from "@acemate/core";
import { IDLE, axesToInput, stickToAxes, type DriveAxes, type Horizontal, type Stick } from "./sticks";

export interface ControlState {
  motion: Motion;
  /** True after an emergency stop until every input is back in its deadzone. */
  latched: boolean;
}

/** The touch stick, the keyboard (web) and a gamepad (web). */
export type InputSource = "touch" | "keys" | "pad";

const ALL_IDLE: Record<InputSource, DriveAxes> = { touch: IDLE, keys: IDLE, pad: IDLE };

/** Holds each input source, what their horizontal axis does, and the e-stop latch; read() resolves them to one motion. */
export class Controller {
  private sources = ALL_IDLE;
  private latched = false;
  private suspended = false;
  private horizontal: Horizontal = "strafe";

  setHorizontal(horizontal: Horizontal): void {
    this.horizontal = horizontal;
  }

  setStick(stick: Stick): void {
    this.setSource("touch", stickToAxes(stick));
  }

  setSource(source: InputSource, axes: DriveAxes): void {
    if (!this.suspended) this.sources = { ...this.sources, [source]: axes };
  }

  /** While suspended (a menu covers the stick) every source reads idle and new input is ignored. */
  suspend(suspended: boolean): void {
    this.suspended = suspended;
    this.sources = ALL_IDLE;
  }

  emergencyStop(): void {
    this.latched = true;
  }

  /** The stronger push wins per axis across sources, then resolveMotion picks the one motion to send. */
  read(): ControlState {
    const inputs = Object.values(this.sources).map((axes) => axesToInput(axes, this.horizontal));
    const result = applyStopLatch(this.latched, resolveMotion(combineInputs(...inputs)));
    this.latched = result.latched;
    return result;
  }
}

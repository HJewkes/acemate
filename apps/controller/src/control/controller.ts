import {
  applyStopLatch,
  combineInputs,
  resolveMotion,
  resolveSpeedMotion,
  type DriveInput,
  type Motion,
} from "@acemate/core";
import { IDLE, axesToInput, stickToAxes, type DriveAxes, type Horizontal, type Stick } from "./sticks";

export interface ControlState {
  motion: Motion;
  /** True after an emergency stop until every input is back in its deadzone. */
  latched: boolean;
  /** Only in diagonal reads: the graded speed sent with the motion. */
  speed?: number;
}

/** The touch stick, the keyboard (web) and a gamepad (web). */
type InputSource = "touch" | "keys" | "pad";

const ALL_IDLE: Record<InputSource, DriveAxes> = { touch: IDLE, keys: IDLE, pad: IDLE };
const NO_INPUT: DriveInput = { x: 0, y: 0, turn: 0 };

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

  /**
   * The stronger push wins per axis across sources, then resolveMotion picks the one motion to send. A diagonal read
   * picks from eight directions instead and adds a speed; both resolvers agree on when to stop.
   */
  read(diagonal = false): ControlState {
    if (!diagonal) return this.latch(resolveMotion(this.combined()));
    const { motion, speed } = resolveSpeedMotion(this.combined());
    return { ...this.latch(motion), speed };
  }

  private latch(motion: Motion): ControlState {
    const result = applyStopLatch(this.latched, motion);
    this.latched = result.latched;
    return result;
  }

  /** The same combined input as a continuous vector for the wheel drive; zero while read() holds the e-stop latch. */
  readVector(): DriveInput {
    return this.latched ? NO_INPUT : this.combined();
  }

  private combined(): DriveInput {
    return combineInputs(...Object.values(this.sources).map((axes) => axesToInput(axes, this.horizontal)));
  }
}

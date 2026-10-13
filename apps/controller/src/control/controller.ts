import { applyStopLatch, resolveMotion, type Motion } from "../shared";
import { CENTERED, stickToInput, type Horizontal, type Stick } from "./sticks";

export interface ControlState {
  motion: Motion;
  /** True after an emergency stop until the stick is back in its deadzone. */
  latched: boolean;
}

/** Holds the drive stick, what its horizontal axis does, and the e-stop latch; read() resolves them to one motion. */
export class Controller {
  private stick: Stick = CENTERED;
  private latched = false;
  private suspended = false;
  private horizontal: Horizontal = "strafe";

  setHorizontal(horizontal: Horizontal): void {
    this.horizontal = horizontal;
  }

  setStick(stick: Stick): void {
    if (!this.suspended) this.stick = stick;
  }

  /** While suspended (a menu covers the stick) the stick reads centred and its input is ignored. */
  suspend(suspended: boolean): void {
    this.suspended = suspended;
    this.stick = CENTERED;
  }

  emergencyStop(): void {
    this.latched = true;
  }

  read(): ControlState {
    const wanted = resolveMotion(stickToInput(this.stick, this.horizontal));
    const result = applyStopLatch(this.latched, wanted);
    this.latched = result.latched;
    return result;
  }
}

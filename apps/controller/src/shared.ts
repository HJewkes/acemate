// The drive rules, loop and wire protocol are imported from the laptop tools rather than copied, so a
// fix there reaches the phone. metro.config.js watches ../../tools and maps their ".js" specifiers to ".ts".
export { DEFAULT_LOOP, DriveLoop, type DriveLoopConfig } from "../../../tools/web-drive/src/drive-loop";
export { applyStopLatch } from "../../../tools/web-drive/src/input";
export { MOTION_RULE, NEUTRAL, resolveMotion, type DriveInput, type Motion } from "../../../tools/web-drive/src/motion";
export {
  LineDecoder,
  NUS_NOTIFY,
  NUS_SERVICE,
  NUS_WRITE,
  chunk,
  encodeLine,
  parseMessage,
  requests,
  type Request,
} from "../../../tools/drive-probe/src/protocol";
export { LaunchController, type LaunchMessage } from "../../../tools/web-drive/src/launcher";
// The launcher's pure mappings and hold-to-fire come from the web app, so both controllers aim the same way.
export { directionLabel, pixelToAim, aimToPad, type Aim } from "../../web/src/launcher-ui/aim";
export { flipped, DEFAULT_ASSUMPTIONS } from "../../web/src/launcher-ui/assumptions";
export { HOLD_MS, createHoldFire, type HoldFire, type HoldReading } from "../../web/src/launcher-ui/hold-fire";
export { SPANS, clamp, snapTo, stepBy, type Span } from "../../web/src/launcher-ui/ranges";
export { SPIN_STYLES, spinLabel, spinStyle, spinValue, type SpinStyle } from "../../web/src/launcher-ui/spin";
export { describeShot, type FireMessage } from "../../web/src/launcher-ui/variant";

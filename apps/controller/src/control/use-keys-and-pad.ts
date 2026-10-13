import { useCallback, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { DEFAULT_ASSUMPTIONS } from "@acemate/core";
import { robotFireLock } from "../launcher/fire-lock";
import type { Shot } from "../launcher/shot";
import type { HoldFireView } from "../launcher/use-hold-fire";
import type { RobotView } from "../robot/use-robot";
import type { Controller } from "./controller";
import { useWebInput } from "./use-web-input";
import { createInputActions } from "./web-input";

interface Wiring {
  robot: RobotView;
  hold: HoldFireView;
  setShot: Dispatch<SetStateAction<Shot>>;
}

/** Keyboard and gamepad on web, sharing the touch controls' controller, fire hold and fire lock; a no-op on native. */
export function useKeysAndPad(controller: Controller, wiring: Wiring, menuOpen: boolean): void {
  const latest = useRef(wiring);
  useLayoutEffect(() => {
    latest.current = wiring;
  });
  // Called from an effect, so the actions read the latest robot, hold and setter through the ref.
  const makeActions = useCallback(
    () =>
      createInputActions({
        controller,
        hold: {
          press: () => latest.current.hold.press(),
          release: () => latest.current.hold.release(),
          cancel: () => latest.current.hold.cancel(),
        },
        fireLocked: () => robotFireLock(latest.current.robot) !== null,
        updateAim: (change) => latest.current.setShot((shot) => ({ ...shot, ...change(shot) })),
        flipDirection: DEFAULT_ASSUMPTIONS.flipDirection,
        stopRobot: () => latest.current.robot.emergencyStop(),
      }),
    [controller],
  );
  useWebInput(makeActions, !menuOpen);
}

// The factory-test channel drives the omni wheels with a graded speed and true strafe, which motion_control cannot.
import type { Request } from "./protocol";

/** drive_up/drive_down are forward/back; drive_left/drive_right strafe without turning. */
export const WHEEL_DIRECTIONS = ["drive_up", "drive_down", "drive_left", "drive_right"] as const;
export type WheelDirection = (typeof WHEEL_DIRECTIONS)[number];

/** Speed 10 is about 2 m/s on the hardware. */
export const WHEEL_SPEED = { min: 1, max: 10 } as const;

function checkWheelSpeed(speed: number): void {
  if (!Number.isInteger(speed) || speed < WHEEL_SPEED.min || speed > WHEEL_SPEED.max) {
    throw new RangeError(`wheel speed must be an integer ${WHEEL_SPEED.min}..${WHEEL_SPEED.max}, got ${speed}`);
  }
}

export const factoryTestRequests = {
  enter: (): Request => ({ type: "factory_test", action: "start" }),
  exit: (): Request => ({ type: "factory_test", action: "stop" }),
  /** Each send moves the wheels for only ~0.5 s, so a driver must resend it while the stick is held. */
  wheelStart: (direction: WheelDirection, speed: number): Request => {
    checkWheelSpeed(speed);
    return { type: "factory_test", command: "wheel_test", action: "start", data: { direction, speed } };
  },
  wheelStop: (): Request => ({ type: "factory_test", command: "wheel_test", action: "stop" }),
};

/**
 * Which path drives the robot; only one sends at a time.
 * stock: motion_control with the stock app's seven motions. wheel: the factory_test wheel path (graded speed, no
 * turning). diagonal: motion_control with eight directions and a speed field, both unverified on hardware.
 */
export const DRIVE_MODES = ["stock", "wheel", "diagonal"] as const;
export type DriveMode = (typeof DRIVE_MODES)[number];

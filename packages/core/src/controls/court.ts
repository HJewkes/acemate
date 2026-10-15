import { flipped } from "./assumptions";
import { SPANS, snapTo } from "./ranges";

// ITF court in metres, drill frame: x across (0 = centre line), z deep from the robot-side baseline.
export const COURT = {
  singlesHalf: 4.115,
  doublesHalf: 5.485,
  length: 23.77,
  net: 11.885,
  serviceFromNet: 6.4,
};

export interface CourtPoint {
  x: number;
  z: number;
}

/** View units are metres, robot at the bottom facing up: u runs right, v runs down. */
export interface ViewPoint {
  u: number;
  v: number;
}

export interface ViewBox {
  minU: number;
  minV: number;
  width: number;
  height: number;
}

const MARGIN = 0.8;
// The reachable zone only: S10 drills land between z 7 and 23, so the robot's half of the court is cropped away.
const NEAR_Z = 6;
const FAR_Z = COURT.length + 0.73;

export const COURT_VIEW_BOX: ViewBox = {
  minU: -COURT.doublesHalf - MARGIN,
  minV: -FAR_Z,
  width: 2 * (COURT.doublesHalf + MARGIN),
  height: FAR_Z - NEAR_Z,
};

export function courtToView(point: CourtPoint, flipX: boolean): ViewPoint {
  return { u: flipped(point.x, flipX), v: -point.z };
}

export function viewToCourt(point: ViewPoint, flipX: boolean): CourtPoint {
  return { x: flipped(point.u, flipX), z: -point.v || 0 };
}

/** Clamps into the S10 drill limits and snaps to 0.1 m. */
export function snapTarget(point: CourtPoint): CourtPoint {
  return { x: snapTo(point.x, SPANS.targetX), z: snapTo(point.z, SPANS.targetZ) };
}

/** A pointer offset inside the face to view units, scaled to fit the box and centred (SVG "meet"). */
export function pixelToView(px: number, py: number, size: { width: number; height: number }): ViewPoint {
  const box = COURT_VIEW_BOX;
  const scale = Math.min(size.width / box.width, size.height / box.height);
  const padX = (size.width - box.width * scale) / 2;
  const padY = (size.height - box.height * scale) / 2;
  return { u: box.minU + (px - padX) / scale, v: box.minV + (py - padY) / scale };
}

export function pixelToTarget(
  px: number,
  py: number,
  size: { width: number; height: number },
  flipX: boolean,
): CourtPoint {
  return snapTarget(viewToCourt(pixelToView(px, py, size), flipX));
}

/** "R 1.3 m · 18.2 m": the side of the centre line, then the depth from the robot's baseline. */
export function targetReadout(target: CourtPoint, flipX: boolean): string {
  const right = flipped(target.x, flipX);
  const side = right === 0 ? "centre" : `${right > 0 ? "R" : "L"} ${Math.abs(right).toFixed(1)} m`;
  return `${side} · ${target.z.toFixed(1)} m`;
}

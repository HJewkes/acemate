import { flipped, SPANS, snapTo } from "@acemate/core";

// ITF court in metres, drill frame: x across (0 = centre line), z deep from the robot-side baseline.
export const COURT = {
  singlesHalf: 4.115,
  doublesHalf: 5.485,
  length: 23.77,
  net: 11.885,
  serviceFromNet: 6.4,
};

export type Orientation = "vertical" | "horizontal";

export interface CourtPoint {
  x: number;
  z: number;
}

/** SVG user units are metres. Vertical: the robot at the bottom faces up. Horizontal: the robot at the left faces right. */
export interface SvgPoint {
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

export function courtToSvg(point: CourtPoint, orientation: Orientation, flipX: boolean): SvgPoint {
  const right = flipped(point.x, flipX);
  return orientation === "vertical" ? { u: right, v: -point.z } : { u: point.z, v: right };
}

export function svgToCourt(point: SvgPoint, orientation: Orientation, flipX: boolean): CourtPoint {
  const right = orientation === "vertical" ? point.u : point.v;
  const z = orientation === "vertical" ? -point.v : point.u;
  return { x: flipped(right, flipX), z: z || 0 };
}

/** Clamps into the S10 drill limits and snaps to 0.1 m. */
export function snapTarget(point: CourtPoint): CourtPoint {
  return { x: snapTo(point.x, SPANS.targetX), z: snapTo(point.z, SPANS.targetZ) };
}

export function courtViewBox(orientation: Orientation, robotZ: number): ViewBox {
  const nearZ = Math.min(0, robotZ) - 1.6;
  const farZ = COURT.length + MARGIN;
  const across = { min: -COURT.doublesHalf - MARGIN, size: 2 * (COURT.doublesHalf + MARGIN) };
  if (orientation === "horizontal") return { minU: nearZ, minV: across.min, width: farZ - nearZ, height: across.size };
  return { minU: across.min, minV: -farZ, width: across.size, height: farZ - nearZ };
}

/** A pointer offset inside the rendered <svg> to user units, for preserveAspectRatio="xMidYMid meet". */
export function pixelToSvg(px: number, py: number, size: { width: number; height: number }, box: ViewBox): SvgPoint {
  const scale = Math.min(size.width / box.width, size.height / box.height);
  const padX = (size.width - box.width * scale) / 2;
  const padY = (size.height - box.height * scale) / 2;
  return { u: box.minU + (px - padX) / scale, v: box.minV + (py - padY) / scale };
}

export function pixelToTarget(
  px: number,
  py: number,
  size: { width: number; height: number },
  view: { orientation: Orientation; flipX: boolean; robotZ: number },
): CourtPoint {
  const svg = pixelToSvg(px, py, size, courtViewBox(view.orientation, view.robotZ));
  return snapTarget(svgToCourt(svg, view.orientation, view.flipX));
}

/** How a label is drawn so it never ends in "…": full size, shrunk, its short form, or wrapped. */
export interface Fit {
  scale: number;
  short: boolean;
  lines: number;
}

export const FULL: Fit = { scale: 1, short: false, lines: 1 };
/** Below this the text gets hard to read at arm's length on court, so the label falls back instead. */
export const MIN_SCALE = 0.75;
// Rounding down a little leaves room for sub-pixel differences between measurement and paint.
const STEP = 0.02;

interface FitInput {
  /** The text's natural width at full size. */
  natural: number;
  /** The width it may take. */
  available: number;
  minScale?: number;
  /** Whether a short form (usually an icon) exists. */
  hasShort?: boolean;
  /** Lines it may wrap to as a last resort. */
  maxLines?: number;
}

/** Shrinks the text to fit, down to minScale; then uses the short form; then wraps at minScale. */
export function chooseFit({ natural, available, minScale = MIN_SCALE, hasShort = false, maxLines = 1 }: FitInput): Fit {
  if (natural <= available || natural <= 0) return FULL;
  const scale = Math.floor((available / natural) * (1 / STEP)) * STEP;
  if (scale >= minScale) return { scale, short: false, lines: 1 };
  if (hasShort) return { scale: 1, short: true, lines: 1 };
  return { scale: minScale, short: false, lines: maxLines };
}

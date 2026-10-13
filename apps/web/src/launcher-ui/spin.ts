export type SpinStyle = "slice" | "flat" | "topspin";

/** The coarse spin buttons; a fine-tune slider covers the rest of −3..3. */
export const SPIN_STYLES: { style: SpinStyle; label: string; value: number }[] = [
  { style: "slice", label: "Slice", value: -2 },
  { style: "flat", label: "Flat", value: 0 },
  { style: "topspin", label: "Topspin", value: 2 },
];

export function spinStyle(spin: number): SpinStyle {
  if (spin < 0) return "slice";
  return spin > 0 ? "topspin" : "flat";
}

export function spinValue(style: SpinStyle): number {
  return SPIN_STYLES.find((entry) => entry.style === style)?.value ?? 0;
}

/** "flat", "topspin 2", "slice 3". */
export function spinLabel(spin: number): string {
  const style = spinStyle(spin);
  return style === "flat" ? style : `${style} ${Math.abs(spin)}`;
}

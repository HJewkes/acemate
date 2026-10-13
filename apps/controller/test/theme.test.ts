import { describe, expect, it } from "vitest";
import { PALETTES, contrastRatio } from "../src/ui/theme";

describe("theme contrast", () => {
  it.each(["dark", "light"] as const)("keeps %s text readable (WCAG AA, 4.5:1) on panel and page", (name) => {
    const p = PALETTES[name];
    for (const [fg, bg] of [
      [p.text, p.panel],
      [p.text, p.page],
      [p.textMuted, p.panel],
      [p.label, p.panel],
      [p.onAccent, p.accent],
      [p.onDisabled, p.disabled],
    ] as const) {
      expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("never uses brand green as text on the light panel", () => {
    expect(contrastRatio(PALETTES.light.accent, PALETTES.light.panel)).toBeLessThan(4.5);
    expect(PALETTES.light.label).not.toBe(PALETTES.light.accent);
  });
});

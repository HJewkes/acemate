import { createContext, useContext, useMemo } from "react";

export type ThemeName = "dark" | "light";
export const THEME_NAMES: readonly ThemeName[] = ["dark", "light"];

export interface Palette {
  page: string;
  panel: string;
  panelBorder: string;
  text: string;
  textMuted: string;
  /** Caps labels and the aim crosshair: text-safe on the panel. */
  label: string;
  /** Brand green: fills only, always with onAccent text. */
  accent: string;
  onAccent: string;
  track: string;
  grid: string;
  gridAxis: string;
  /** Outlines that must read as controls (>= 3:1 on the panel). */
  ring: string;
  knobBorder: string;
  linkOk: string;
  linkBusy: string;
  linkOff: string;
  danger: string;
  batteryOk: string;
  batteryLow: string;
  disabled: string;
  onDisabled: string;
  wordmark: string;
}

// Brand values from design/brand.md. Its Android #AARRGGBB tokens are written here as rgba().
// Contrast (WCAG): every text colour is >= 4.5:1 on the surface it sits on; brand green is never text on white.
export const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    page: "#353f4f",
    panel: "#111827",
    panelBorder: "rgba(255,255,255,0.1)",
    text: "#ffffff",
    textMuted: "#94a3b8",
    label: "#8dc21f",
    accent: "#8dc21f",
    onAccent: "#111827",
    track: "#353f4f",
    grid: "rgba(141,194,31,0.18)",
    gridAxis: "rgba(141,194,31,0.6)",
    ring: "#8dc21f",
    knobBorder: "#ffffff",
    linkOk: "#00c48e",
    linkBusy: "#f59e0b",
    linkOff: "#94a3b8",
    danger: "#ea5f5f",
    batteryOk: "#10b981",
    batteryLow: "#ff0000",
    disabled: "#353f4f",
    onDisabled: "#e2e8f0",
    wordmark: "rgba(141,194,31,0.22)",
  },
  light: {
    // Readability pass (2026-10-12): ink text, solid slate secondary text, visible borders and grid.
    page: "#e9eef2",
    panel: "#ffffff",
    panelBorder: "#94a3b8",
    text: "#111827",
    textMuted: "#334155",
    label: "#3f6212",
    accent: "#8dc21f",
    onAccent: "#111827",
    track: "#cbd5e1",
    grid: "rgba(53,63,79,0.18)",
    gridAxis: "rgba(53,63,79,0.65)",
    ring: "#353f4f",
    knobBorder: "#111827",
    linkOk: "#047857",
    linkBusy: "#b45309",
    linkOff: "#475569",
    danger: "#b91c1c",
    batteryOk: "#047857",
    batteryLow: "#b91c1c",
    disabled: "#cbd5e1",
    onDisabled: "#1e293b",
    wordmark: "rgba(53,63,79,0.14)",
  },
};

/** WCAG relative-luminance contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r = 0, g = 0, bl = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export const ThemeContext = createContext<Palette>(PALETTES.dark);

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/** Rebuilds a component's styles only when the palette changes. */
export function useThemedStyles<T>(create: (palette: Palette) => T): T {
  const palette = useTheme();
  return useMemo(() => create(palette), [create, palette]);
}

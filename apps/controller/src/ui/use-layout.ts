import { createContext, useContext } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { computeLayout, type DriveLayout } from "./layout";
import type { Size } from "./web-shell";

/** The phone frame the drive screen sits in on a laptop (WebShell.web.tsx); null when it fills the window. */
export const FrameContext = createContext<Size | null>(null);

export function useFrame(): Size | null {
  return useContext(FrameContext);
}

/** The drive layout for the frame, or else the window; recomputes on rotation or resize. */
export function useDriveLayout(): DriveLayout {
  const window = useWindowDimensions();
  const frame = useFrame();
  return computeLayout({ ...(frame ?? window), inset: Platform.OS !== "web" || frame !== null });
}

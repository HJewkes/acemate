import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chooseArrangement, computeLayout, type Arrangement, type DriveLayout } from "./layout";
import { computeDriveLayout } from "./layout-portrait";
import { PHONE_INSETS, type Size } from "./web-shell";

/** The phone frame the drive screen sits in on a laptop (WebShell.web.tsx); null when it fills the window. */
export const FrameContext = createContext<Size | null>(null);

export function useFrame(): Size | null {
  return useContext(FrameContext);
}

/** The drive layout for the frame, or else the window; recomputes on rotation or resize. */
export function useDriveLayout(): DriveLayout {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  // The laptop frame stands for the phone, so it takes the phone's insets rather than the laptop's.
  return frame ? computeLayout({ ...frame, insets: PHONE_INSETS }) : computeDriveLayout({ ...window, insets });
}

/** Row or column for the whole window, for overlays such as the device menu that sit outside the laptop frame. */
export function useScreenArrangement(): Arrangement {
  return chooseArrangement(useWindowDimensions());
}

import { useWindowDimensions } from "react-native";
import { computeLayout, type DriveLayout } from "./layout";

/** The drive layout for the current window; recomputes on rotation or resize. */
export function useDriveLayout(): DriveLayout {
  const { width, height } = useWindowDimensions();
  return computeLayout({ width, height });
}

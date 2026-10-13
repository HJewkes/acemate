import { useSyncExternalStore } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useThemedStyles, type Palette } from "../theme";
import { FrameContext } from "../use-layout";
import { BEZEL, SHELL_MARGIN, computeWebShell, type Pointer } from "../web-shell";
import { SidePanel } from "./SidePanel";
import type { WebShellProps } from "./WebShell";

const FINE_POINTER = "(pointer: fine)";

function subscribePointer(listener: () => void): () => void {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

// A touch laptop reports its primary pointer, so it is framed while a phone or tablet is not.
function usePointer(): Pointer {
  return useSyncExternalStore(subscribePointer, () => (window.matchMedia(FINE_POINTER).matches ? "fine" : "coarse"));
}

/**
 * On a laptop, the drive screen at phone size in a frame with the side panel beside it; otherwise it fills the window.
 * The tree has the same shape in both modes, so a resize across the threshold never remounts the drive screen.
 */
export function WebShell({ robot, shot, children }: WebShellProps) {
  const styles = useThemedStyles(createStyles);
  const shell = computeWebShell({ ...useWindowDimensions(), pointer: usePointer() });
  const frame = shell.mode === "framed" ? shell.frame : null;
  return (
    <View style={[styles.page, frame && styles.framedPage]}>
      <View style={frame ? styles.bezel : styles.fill}>
        <FrameContext.Provider value={frame}>
          <View style={frame ? [frame, styles.glass] : styles.fill}>{children}</View>
        </FrameContext.Provider>
      </View>
      {shell.mode === "framed" && (
        <View style={{ width: shell.panel, alignSelf: "stretch" }}>
          <SidePanel robot={robot} shot={shot} />
        </View>
      )}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    page: { flex: 1, flexDirection: "row" },
    framedPage: { alignItems: "center", justifyContent: "center", gap: SHELL_MARGIN, padding: SHELL_MARGIN },
    fill: { flex: 1 },
    // The border is part of the bezel, so the frame plus bezel stays inside computeWebShell's budget.
    bezel: {
      padding: BEZEL - 1,
      borderRadius: 36,
      overflow: "hidden",
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.panelBorder,
    },
    glass: { borderRadius: 26, overflow: "hidden" },
  });
}

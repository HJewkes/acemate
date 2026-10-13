import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { AppState, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Controller } from "./src/control/controller";
import { useKeysAndPad } from "./src/control/use-keys-and-pad";
import { requestedProbe } from "./src/debug/probe-env";
import type { Horizontal, Stick } from "./src/control/sticks";
import { singleBall, type Shot } from "./src/launcher/shot";
import { useHoldFire } from "./src/launcher/use-hold-fire";
import { useRobot } from "./src/robot/use-robot";
import type { SavedRobot, UnackedLimit } from "./src/storage/settings";
import { useSettings } from "./src/storage/use-settings";
import { DriveScreen } from "./src/ui/drive/DriveScreen";
import { DeviceMenu } from "./src/ui/menu/DeviceMenu";
import { ProbePanel } from "./src/ui/ProbePanel";
import { WebShell } from "./src/ui/shell/WebShell";
import { PALETTES, ThemeContext, type ThemeName } from "./src/ui/theme";

export default function App() {
  const controller = useMemo(() => new Controller(), []);
  const [probe, setProbe] = useState(requestedProbe);
  const { settings, loaded, update } = useSettings();
  const { horizontal, shot: aimShot, theme, lastRobot, allowDriveDuringRun, maxUnackedWrite } = settings;
  const rememberRobot = useCallback((robot: SavedRobot) => update(() => ({ lastRobot: robot })), [update]);
  const robot = useRobot(controller, {
    lastRobot: loaded ? lastRobot : null,
    onConnected: rememberRobot,
    allowDriveDuringRun,
    maxUnackedWrite,
  });
  const setAimShot = useCallback(
    (action: SetStateAction<Shot>) =>
      update((current) => ({ shot: typeof action === "function" ? action(current.shot) : action })),
    [update],
  );
  const setStick = useCallback((stick: Stick) => controller.setStick(stick), [controller]);
  const setHorizontal = useCallback((next: Horizontal) => update(() => ({ horizontal: next })), [update]);
  const setTheme = useCallback((next: ThemeName) => update(() => ({ theme: next })), [update]);
  const setAllowDrive = useCallback((allow: boolean) => update(() => ({ allowDriveDuringRun: allow })), [update]);
  const setWriteLimit = useCallback((limit: UnackedLimit) => update(() => ({ maxUnackedWrite: limit })), [update]);
  useEffect(() => {
    controller.setHorizontal(horizontal);
  }, [controller, horizontal]);
  const hold = useHoldFire(() => {
    if (menu.open) return;
    const message = singleBall(aimShot);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    robot.fire(message);
  });
  useLatchOnBackground(controller, hold.cancel);
  const menu = useDeviceMenu(controller, hold.cancel);
  useKeysAndPad(controller, { robot, hold, setShot: setAimShot }, menu.open);

  useEffect(() => {
    void Haptics.selectionAsync();
  }, [robot.control.motion]);

  const robotName = robot.status === "connected" ? robot.detail : (lastRobot?.name ?? "No robot");
  return (
    <ThemeContext.Provider value={PALETTES[theme]}>
      <GestureHandlerRootView style={[styles.root, { backgroundColor: PALETTES[theme].page }]}>
        <StatusBar hidden />
        <WebShell robot={robot} shot={aimShot}>
          <DriveScreen
            robot={robot}
            robotName={robotName}
            onOpenMenu={menu.show}
            horizontal={horizontal}
            onHorizontal={setHorizontal}
            onStick={setStick}
            shot={aimShot}
            onShot={setAimShot}
            hold={hold}
          />
        </WebShell>
        <DeviceMenu
          visible={menu.open}
          onClose={menu.hide}
          robot={robot}
          lastRobot={lastRobot}
          theme={theme}
          onTheme={setTheme}
          allowDriveDuringRun={allowDriveDuringRun}
          onAllowDriveDuringRun={setAllowDrive}
          maxUnackedWrite={maxUnackedWrite}
          onMaxUnackedWrite={setWriteLimit}
        />
        {probe && <ProbePanel env={probe} onClose={() => setProbe(null)} />}
      </GestureHandlerRootView>
    </ThemeContext.Provider>
  );
}

// There is no on-screen E-STOP: releasing the stick stops, and useRobot stops the robot and any run on leaving the app.
// This latches the stick too, so a thumb still down on return cannot drive until it is released.
function useLatchOnBackground(controller: Controller, cancelHold: () => void) {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      controller.emergencyStop();
      cancelHold();
    });
    return () => subscription.remove();
  }, [controller, cancelHold]);
}

// The menu covers the stick and the fire bar, so neither may act while it is open.
function useDeviceMenu(controller: Controller, cancelHold: () => void) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => {
    controller.suspend(true);
    cancelHold();
    setOpen(true);
  }, [controller, cancelHold]);
  const hide = useCallback(() => {
    controller.suspend(false);
    setOpen(false);
  }, [controller]);
  return { open, show, hide };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { robotFireLock } from "../../launcher/fire-lock";
import { launchNotice } from "../../launcher/notice";
import { singleBall, type Shot } from "../../launcher/shot";
import type { HoldFireView } from "../../launcher/use-hold-fire";
import type { RobotView } from "../../robot/use-robot";
import { DEFAULT_ASSUMPTIONS, SPANS, describeShot, type Aim } from "@acemate/core";
import { AimPad } from "../launcher/AimPad";
import { SpinSegmented, HorizontalSlider } from "../launcher/inputs";
import { PANEL_INSET, WIDE_GAP, WIDE_SIDE, type DriveLayout } from "../layout";
import { useThemedStyles, type Palette } from "../theme";
import { useFlash } from "../use-clock";

// The stacked panel matches the thumbstick column (owner, 2026-10-12), so both sides mirror and the centre group sits mid-screen.
const PANEL_PADDING = PANEL_INSET - 2;
const NOTICE_MS = 4000;
// Hardware has not yet confirmed which way +direction aims.
const { flipDirection } = DEFAULT_ASSUMPTIONS;

interface Props {
  robot: RobotView;
  shot: Shot;
  onShot: Dispatch<SetStateAction<Shot>>;
  hold: HoldFireView;
  /** Panel width, pad size and shape, from computeLayout. */
  layout: Pick<DriveLayout, "launcher" | "panel" | "pad">;
}

/** Spin, speed, the square aim pad, a one-line readout, and the hold-to-fire bar. Nothing here drives. */
export function LauncherPanel({ robot, shot, onShot, hold, layout }: Props) {
  const { launcher, panel, pad } = layout;
  const styles = useThemedStyles(createStyles);
  const setAim = useCallback((aim: Aim) => onShot((current) => ({ ...current, ...aim })), [onShot]);
  const aimPad = <AimPad aim={shot} width={pad} height={pad} flipDirection={flipDirection} onAim={setAim} />;
  if (launcher === "wide") {
    // The pad on the left, nearest the centre; spin, speed, readout and Fire beside it, Fire at the thumb.
    return (
      <View style={[styles.panel, shapes.widePanel, { width: panel }]}>
        {aimPad}
        <View style={[shapes.wideSide, { width: WIDE_SIDE, height: pad }]}>
          <View style={shapes.wideGroup}>
            <ShotControls shot={shot} onShot={onShot} />
          </View>
          <Readout robot={robot} shot={shot} lines={3} />
          <FireBar robot={robot} hold={hold} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.panel, { width: panel }]}>
      <ShotControls shot={shot} onShot={onShot} />
      <View style={shapes.padSlot}>{aimPad}</View>
      <Readout robot={robot} shot={shot} lines={1} />
      <FireBar robot={robot} hold={hold} />
    </View>
  );
}

function ShotControls({ shot, onShot }: Pick<Props, "shot" | "onShot">) {
  const setSpeed = useCallback((speed: number) => onShot((current) => ({ ...current, speed })), [onShot]);
  const setSpin = useCallback((spin: number) => onShot((current) => ({ ...current, spin })), [onShot]);
  return (
    <>
      <SpinSegmented spin={shot.spin} onChange={setSpin} />
      <HorizontalSlider label="Speed" value={shot.speed} span={SPANS.speed} onChange={setSpeed} />
    </>
  );
}

/** The shot in words, or a launch notice for a few seconds. Web has no shrink-to-fit text, so wide gets more lines. */
function Readout({ robot, shot, lines }: Pick<Props, "robot" | "shot"> & { lines: number }) {
  const styles = useThemedStyles(createStyles);
  const notice = useFlash(launchNotice(robot.launch.log[0]), robot.launch.reportedAt, NOTICE_MS);
  return (
    <Text
      style={[styles.readout, notice !== null && styles.notice]}
      numberOfLines={lines}
      adjustsFontSizeToFit={lines === 1}
    >
      {notice ?? describeShot(singleBall(shot), flipDirection)}
    </Text>
  );
}

// Theme-free arrangement of the two launcher shapes.
const shapes = StyleSheet.create({
  widePanel: { flexDirection: "row", gap: WIDE_GAP },
  wideSide: { justifyContent: "space-between", gap: 6 },
  wideGroup: { gap: 6 },
  padSlot: { alignItems: "center" },
});

function FireBar({ robot, hold }: Pick<Props, "robot" | "hold">) {
  const styles = useThemedStyles(createStyles);
  const lock = robotFireLock(robot);
  const locked = lock !== null;
  const { cancel } = hold;
  // A disabled Pressable may never see the finger lift, so drop any hold rather than leave it spent.
  useEffect(() => {
    if (locked) cancel();
  }, [locked, cancel]);
  return (
    <Pressable
      style={[styles.fire, locked && styles.fireLocked]}
      disabled={locked}
      onPressIn={hold.press}
      onPressOut={hold.release}
    >
      {!locked && <View style={[styles.fireSweep, { width: `${hold.progress * 100}%` }]} />}
      <Text style={[styles.fireText, locked && styles.fireTextLocked]} numberOfLines={1}>
        {lock ?? (hold.progress >= 1 ? "FIRED" : "HOLD TO FIRE")}
      </Text>
    </Pressable>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    panel: {
      padding: PANEL_PADDING,
      gap: 6,
      borderRadius: 14,
      backgroundColor: palette.panel,
      borderWidth: 2,
      borderColor: palette.panelBorder,
    },
    readout: { color: palette.text, fontSize: 12, fontWeight: "600", textAlign: "center" },
    notice: { color: palette.danger },
    fire: {
      height: 46,
      borderRadius: 10,
      backgroundColor: palette.accent,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    fireLocked: { backgroundColor: palette.disabled },
    // Darkens the green as the hold fills; ink text stays readable over both.
    fireSweep: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(17,24,39,0.28)" },
    fireText: { color: palette.onAccent, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
    fireTextLocked: { color: palette.onDisabled, fontSize: 13, fontWeight: "700", letterSpacing: 0 },
  });
}

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fireLock } from "../../launcher/fire-lock";
import { launchNotice } from "../../launcher/notice";
import { singleBall, type Shot } from "../../launcher/shot";
import type { HoldFireView } from "../../launcher/use-hold-fire";
import type { RobotView } from "../../robot/use-robot";
import { DEFAULT_ASSUMPTIONS, SPANS, describeShot, type Aim } from "@acemate/core";
import { AimPad } from "../launcher/AimPad";
import { SpinSegmented, HorizontalSlider } from "../launcher/inputs";
import { useThemedStyles, type Palette } from "../theme";
import { useFlash } from "../use-clock";

// The whole panel matches the thumbstick column (owner, 2026-10-12), so both sides mirror and the centre group sits mid-screen.
const PANEL_PADDING = 10;
const NOTICE_MS = 4000;
// Hardware has not yet confirmed which way +direction aims.
const { flipDirection } = DEFAULT_ASSUMPTIONS;

interface Props {
  robot: RobotView;
  shot: Shot;
  onShot: Dispatch<SetStateAction<Shot>>;
  hold: HoldFireView;
  /** Matches the thumbstick column, so both sides mirror and the centre group stays centred. */
  width: number;
}

/** Spin, speed, the square aim pad, a one-line readout, and the hold-to-fire bar. Nothing here drives. */
export function LauncherPanel({ robot, shot, onShot, hold, width }: Props) {
  // Speed sits under spin, so the aim pad gets the full inner width as a square.
  const aimPad = width - 2 * PANEL_PADDING;
  const styles = useThemedStyles(createStyles);
  const setAim = useCallback((aim: Aim) => onShot((current) => ({ ...current, ...aim })), [onShot]);
  const setSpeed = useCallback((speed: number) => onShot((current) => ({ ...current, speed })), [onShot]);
  const setSpin = useCallback((spin: number) => onShot((current) => ({ ...current, spin })), [onShot]);
  const notice = useFlash(launchNotice(robot.launch.log[0]), robot.launch.reportedAt, NOTICE_MS);
  return (
    <View style={[styles.panel, { width }]}>
      <SpinSegmented spin={shot.spin} onChange={setSpin} />
      <HorizontalSlider label="Speed" value={shot.speed} span={SPANS.speed} onChange={setSpeed} />
      <AimPad aim={shot} width={aimPad} height={aimPad} flipDirection={flipDirection} onAim={setAim} />
      <Text style={[styles.readout, notice !== null && styles.notice]} numberOfLines={1} adjustsFontSizeToFit>
        {notice ?? describeShot(singleBall(shot), flipDirection)}
      </Text>
      <FireBar robot={robot} hold={hold} />
    </View>
  );
}

function FireBar({ robot, hold }: Pick<Props, "robot" | "hold">) {
  const styles = useThemedStyles(createStyles);
  const { launch } = robot;
  const lock = fireLock({
    connected: robot.status === "connected",
    motion: robot.control.motion,
    inFlight: launch.inFlight,
    runActive: launch.runActive,
  });
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

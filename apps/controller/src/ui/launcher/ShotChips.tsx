import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { StyleSheet, View } from "react-native";
import { SPANS } from "@acemate/core";
import { chipLabels } from "../../launcher/chips";
import type { Shot } from "../../launcher/shot";
import { useThemedStyles, type Palette } from "../theme";
import { CHIP_TRACK_PADDING } from "../layout";
import { Chip, ChipPopover, HorizontalSlider, SpinSegmented, Stepper, useShortTogether, type Anchor } from "./inputs";

type ChipName = "Spin" | "Balls";

interface Props {
  shot: Shot;
  onShot: Dispatch<SetStateAction<Shot>>;
}

/** The Spin and Balls chips, in the old spin switch's slot; each opens its options in a popover under the row. */
export function ShotChips({ shot, onShot }: Props) {
  const styles = useThemedStyles(createStyles);
  const row = useRef<View>(null);
  const { open, toggle, close } = useChipPopover(row);
  const { compact, report } = useShortTogether<ChipName>();
  const labels = chipLabels(shot);
  const chip = (name: ChipName, label: typeof labels.spin) => (
    <Chip
      name={name}
      label={label}
      open={open?.chip === name}
      compact={compact}
      onPress={() => toggle(name)}
      onNeedsShort={(needsShort) => report(name, needsShort)}
    />
  );
  return (
    <>
      <View ref={row} style={styles.row}>
        {chip("Spin", labels.spin)}
        {chip("Balls", labels.balls)}
      </View>
      <ChipPopover anchor={open?.anchor ?? null} label={`${open?.chip ?? ""} options`} onClose={close}>
        {open?.chip === "Spin" && <SpinOptions shot={shot} onShot={onShot} onPicked={close} />}
        {open?.chip === "Balls" && <BallsOptions shot={shot} onShot={onShot} />}
      </ChipPopover>
    </>
  );
}

/** Which chip's popover is open, hung from the chip row; tapping the open chip again closes it. */
function useChipPopover(row: RefObject<View | null>) {
  const [open, setOpen] = useState<{ chip: ChipName; anchor: Anchor } | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const toggle = (chip: ChipName) => {
    if (open?.chip === chip) {
      close();
      return;
    }
    row.current?.measureInWindow((x, y, width, height) => setOpen({ chip, anchor: { x, y, width, height } }));
  };
  return { open, toggle, close };
}

/** The coarse styles close the popover on a pick; the fine slider stays open while it is dragged. */
function SpinOptions({ shot, onShot, onPicked }: Props & { onPicked(): void }) {
  const setSpin = useCallback((spin: number) => onShot((current) => ({ ...current, spin })), [onShot]);
  const pick = (spin: number) => {
    setSpin(spin);
    onPicked();
  };
  return (
    <>
      <SpinSegmented spin={shot.spin} onChange={pick} />
      <HorizontalSlider label="Spin" value={shot.spin} span={SPANS.spin} onChange={setSpin} />
    </>
  );
}

// "Every 12.5 s" needs a wider green zone than the default to stay on green.
const EVERY_LABEL_ZONE = 100;

/** The interval means nothing at one ball, so its slider is muted there. */
function BallsOptions({ shot, onShot }: Props) {
  const setCount = useCallback((count: number) => onShot((current) => ({ ...current, count })), [onShot]);
  const setEvery = useCallback((interval: number) => onShot((current) => ({ ...current, interval })), [onShot]);
  return (
    <>
      <Stepper label="Balls" value={shot.count} span={SPANS.count} onChange={setCount} />
      <HorizontalSlider
        label="Every"
        unit="s"
        value={shot.interval}
        span={SPANS.interval}
        onChange={setEvery}
        disabled={shot.count === 1}
        labelZone={EVERY_LABEL_ZONE}
      />
    </>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignSelf: "stretch",
      padding: CHIP_TRACK_PADDING,
      gap: 3,
      borderRadius: 10,
      backgroundColor: palette.track,
    },
  });
}

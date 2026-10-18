import { Pressable, ScrollView, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { DriveMode } from "../../robot/drive-mode";
import { Segmented } from "../launcher/inputs";
import { useTheme, useThemedStyles, type Palette, type ThemeName } from "../theme";
import type { MenuSettings } from "./DeviceMenu";

const THEME_OPTIONS: { value: ThemeName; label: string; short: string }[] = [
  { value: "dark", label: "☾ Dark", short: "☾" },
  { value: "light", label: "☀ Light", short: "☀" },
];

// A list, not a Segmented: three labels did not fit side by side in the phone menus.
const DRIVE_MODES: { value: DriveMode; label: string; caption: string }[] = [
  { value: "stock", label: "Stock", caption: "The stock app's motion: four directions and turning at one speed." },
  {
    value: "wheel",
    label: "Wheel (factory, beta)",
    caption: "Graded speed and true strafe, one direction at a time; no turning.",
  },
  {
    value: "diagonal",
    label: "Motion+diagonal (beta)",
    caption: "Stock motion plus diagonals and a 1-5 speed. Untested on the robot.",
  },
];

type Props = Pick<
  MenuSettings,
  "theme" | "onTheme" | "allowDriveDuringRun" | "onAllowDriveDuringRun" | "driveMode" | "onDriveMode"
> & {
  style?: StyleProp<ViewStyle>;
};

/** Theme, driving during runs and the drive mode. */
export function SettingsColumn(props: Props) {
  const { theme, onTheme, allowDriveDuringRun, onAllowDriveDuringRun, driveMode, onDriveMode, style } = props;
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.settings, style]}>
      <View style={styles.header}>
        <Text style={styles.heading}>SETTINGS</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Theme</Text>
        <Segmented options={THEME_OPTIONS} selected={theme} onSelect={onTheme} />
        <SwitchRow label="Allow driving during runs" value={allowDriveDuringRun} onChange={onAllowDriveDuringRun} />
        <Text style={styles.caption}>
          Untested: the stock app never drives during a run. Firing still needs the robot stopped.
        </Text>
        <Text style={[styles.label, styles.spaced]}>Drive mode</Text>
        <DriveModeList selected={driveMode} onSelect={onDriveMode} />
      </ScrollView>
    </View>
  );
}

function DriveModeList({ selected, onSelect }: { selected: DriveMode; onSelect(mode: DriveMode): void }) {
  const styles = useThemedStyles(createStyles);
  const caption = DRIVE_MODES.find((mode) => mode.value === selected)?.caption;
  return (
    <>
      <View style={styles.modeList} accessibilityRole="radiogroup">
        {DRIVE_MODES.map(({ value, label }) => (
          <Pressable
            key={value}
            style={[styles.mode, value === selected && styles.modeOn]}
            onPress={() => onSelect(value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === selected }}
            accessibilityLabel={label}
          >
            <Text style={[styles.modeText, value === selected && styles.modeTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.switchRow}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.accent, false: palette.track }}
        accessibilityLabel={label}
      />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    settings: { flex: 1, gap: 8 },
    // The scroll clips its box, and a wrapped caption's trailing space paints just past the text's right edge.
    body: { gap: 8, paddingRight: 6 },
    header: { height: 28, justifyContent: "center" },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    label: { color: palette.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
    spaced: { marginTop: 6 },
    modeList: { padding: 3, gap: 3, borderRadius: 10, backgroundColor: palette.track },
    mode: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
    modeOn: { backgroundColor: palette.accent },
    modeText: { color: palette.text, fontSize: 13, fontWeight: "600" },
    modeTextOn: { color: palette.onAccent, fontWeight: "800" },
    caption: { color: palette.textMuted, fontSize: 11, lineHeight: 15 },
  });
}

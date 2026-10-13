import { useRef, useSyncExternalStore } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { devLog } from "../../debug/log-buffer";
import { useThemedStyles, type Palette } from "../theme";

const subscribe = (listener: () => void) => devLog.subscribe(listener);
const snapshot = () => devLog.lines;

/** The recent rx/tx and launch reports, newest at the bottom; follows new lines as they arrive. */
export function DebugLog() {
  const styles = useThemedStyles(createStyles);
  const lines = useSyncExternalStore(subscribe, snapshot);
  const scroll = useRef<ScrollView>(null);
  return (
    <View style={styles.column}>
      <View style={styles.header}>
        <Text style={styles.heading}>DEBUG LOG</Text>
      </View>
      <ScrollView
        ref={scroll}
        style={styles.log}
        contentContainerStyle={styles.logContent}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        <Text style={styles.mono} selectable>
          {lines.length > 0 ? lines.join("\n") : "Nothing yet."}
        </Text>
      </ScrollView>
      <Pressable style={styles.action} onPress={() => devLog.clear()} hitSlop={6}>
        <Text style={styles.actionText}>Clear log</Text>
      </Pressable>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    column: { flex: 1.4, gap: 6 },
    header: { height: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    action: { alignSelf: "stretch", alignItems: "center", paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.ring },
    actionText: { color: palette.text, fontSize: 12, fontWeight: "700" },
    log: { flex: 1, borderRadius: 10, backgroundColor: palette.page },
    logContent: { padding: 8 },
    mono: { color: palette.text, fontSize: 10, lineHeight: 14, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
  });
}

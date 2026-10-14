import { useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { FULL, MIN_SCALE, chooseFit, type Fit } from "./fit";
import type { FitTextProps } from "./FitText";

const DEFAULT_FONT_SIZE = 14;

/**
 * Web has no adjustsFontSizeToFit, so this measures the label at full size and shrinks it, swaps in its short form,
 * or wraps it. A fit holds only for the text and container width it was measured at; anything else renders full
 * size for one measuring pass. Layout effects run before paint, so that pass is never seen.
 */
export function FitText(props: FitTextProps) {
  const { text, short, minScale = MIN_SCALE, maxLines = 1, style, forceShort = false } = props;
  const ref = useRef<Text>(null);
  const width = useContainerWidth(ref);
  const key = [text, short, minScale, maxLines, width].join("\u0000");
  const [measured, setMeasured] = useState<{ key: string; fit: Fit } | null>(null);
  useLayoutEffect(() => {
    const node = domNode(ref.current);
    if (!node || measured?.key === key) return;
    const fit = chooseFit({
      natural: node.scrollWidth,
      available: node.clientWidth,
      minScale,
      hasShort: short !== undefined,
      maxLines,
    });
    setMeasured({ key, fit });
  }, [key, measured, minScale, maxLines, short]);
  useReportShort(measured?.key === key ? measured.fit.short : null, props.onNeedsShort);
  const fit = measured?.key === key ? measured.fit : FULL;
  // A forced short form only applies once measured, so the measuring pass still sees the full label.
  const shown = forceShort && measured?.key === key && short !== undefined ? { ...FULL, short: true } : fit;
  const fontSize = (StyleSheet.flatten(style).fontSize ?? DEFAULT_FONT_SIZE) * shown.scale;
  return (
    <Text ref={ref} style={[style, shown.scale !== 1 && { fontSize }]} numberOfLines={shown.lines}>
      {shown.short && short !== undefined ? short : text}
    </Text>
  );
}

function useReportShort(needsShort: boolean | null, onNeedsShort: ((needsShort: boolean) => void) | undefined) {
  useLayoutEffect(() => {
    if (needsShort !== null) onNeedsShort?.(needsShort);
  }, [needsShort, onNeedsShort]);
}

/** The width of the label's container, which changes on rotation or when a sibling grows. */
function useContainerWidth(ref: { current: Text | null }): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const container = domNode(ref.current)?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver(() => setWidth(container.clientWidth));
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return width;
}

// On web a Text ref is its DOM element.
function domNode(instance: unknown): HTMLElement | null {
  return instance instanceof HTMLElement ? instance : null;
}

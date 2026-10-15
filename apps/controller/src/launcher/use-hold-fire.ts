import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createHoldFire, HOLD_MS, type HoldReading } from "@acemate/core";

const TICK_MS = 16;

export interface HoldFireView {
  /** 0..1 across the hold; 1 once fired until the finger lifts. */
  progress: number;
  press(): void;
  release(): void;
  cancel(): void;
}

/** Drives the shared hold-to-fire machine from a press: fires once per hold, after HOLD_MS. */
export function useHoldFire(onFire: () => void): HoldFireView {
  const hold = useRef(createHoldFire(HOLD_MS));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fireRef = useRef(onFire);
  useLayoutEffect(() => {
    fireRef.current = onFire;
  });
  const [progress, setProgress] = useState(0);

  const stopTicking = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  const apply = useCallback(
    (reading: HoldReading) => {
      setProgress(reading.progress);
      if (!reading.fire) return;
      stopTicking();
      fireRef.current();
    },
    [stopTicking],
  );
  const press = useCallback(() => {
    apply(hold.current.press(Date.now()));
    if (!timer.current) timer.current = setInterval(() => apply(hold.current.tick(Date.now())), TICK_MS);
  }, [apply]);
  const release = useCallback(() => (stopTicking(), apply(hold.current.release())), [apply, stopTicking]);
  const cancel = useCallback(() => (stopTicking(), apply(hold.current.cancel())), [apply, stopTicking]);

  useEffect(() => stopTicking, [stopTicking]);
  return { progress, press, release, cancel };
}

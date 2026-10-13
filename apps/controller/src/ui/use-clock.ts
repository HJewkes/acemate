import { useEffect, useState } from "react";

/** The current time, refreshed every `everyMs` while active; frozen (and timer-free) otherwise. */
export function useNow(active: boolean, everyMs = 500): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs]);
  return now;
}

/** Shows `text` for `forMs` each time `at` changes, then clears it. */
export function useFlash(text: string | null, at: number, forMs: number): string | null {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    setShown(text);
    if (!text) return;
    const timer = setTimeout(() => setShown(null), forMs);
    return () => clearTimeout(timer);
  }, [text, at, forMs]);
  return shown;
}

import { useEffect, useState } from "react";

/** The current time, refreshed every `everyMs` while active; frozen (and timer-free) otherwise. */
export function useNow(active: boolean, everyMs = 500): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    // Refresh straight away rather than showing the time frozen at the last deactivation for a whole period.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, everyMs]);
  return now;
}

/** Shows `text` for `forMs` each time `at` changes, then clears it. */
export function useFlash(text: string | null, at: number, forMs: number): string | null {
  const [expired, setExpired] = useState<{ text: string; at: number } | null>(null);
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setExpired({ text, at }), forMs);
    return () => clearTimeout(timer);
  }, [text, at, forMs]);
  return text && !(expired?.text === text && expired.at === at) ? text : null;
}

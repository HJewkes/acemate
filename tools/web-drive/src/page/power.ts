export interface CarStateView {
  bat?: number | null;
  running?: boolean;
  mode?: string;
}

// Mirrors the app's CarState.getBatLevel: 0 only at 0%, 1 for 1-19%, then one level per further 20%.
export function batteryBars(bat: number | null | undefined): number | null {
  if (bat === null || bat === undefined || bat < 0 || bat > 100) return null;
  if (bat === 0) return 0;
  return Math.min(5, Math.floor(bat / 20) + 1);
}

export function powerText(state: CarStateView, at: Date): string {
  const bars = batteryBars(state.bat);
  const meter = bars === null ? "?" : `${"▮".repeat(bars)}${"▯".repeat(5 - bars)} ${state.bat}%`;
  const run = state.running ? "running" : "idle";
  return `battery ${meter} · ${state.mode ?? "?"} · ${run} · ${at.toLocaleTimeString()}`;
}

export function showPower(state: CarStateView): void {
  const view = document.getElementById("power") as HTMLElement;
  const bars = batteryBars(state.bat);
  view.textContent = powerText(state, new Date());
  view.className = `power ${bars === null ? "" : bars <= 1 ? "low" : bars <= 2 ? "mid" : "ok"}`;
}

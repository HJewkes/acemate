export const DEBUG_LOG_LINES = 200;

/** The newest `capacity` lines, oldest first; each change replaces the array, so it works as a React snapshot. */
export class LogBuffer {
  private snapshot: readonly string[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly capacity = DEBUG_LOG_LINES) {}

  get lines(): readonly string[] {
    return this.snapshot;
  }

  push(line: string): void {
    const kept = this.snapshot.length >= this.capacity ? this.snapshot.slice(this.snapshot.length - this.capacity + 1) : this.snapshot;
    this.replace([...kept, line]);
  }

  clear(): void {
    this.replace([]);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private replace(lines: readonly string[]): void {
    this.snapshot = lines;
    this.listeners.forEach((listener) => listener());
  }
}

/** What the device menu's debug log shows: rx/tx, write failures and launch reports. */
export const devLog = new LogBuffer();

function clockTime(at: number): string {
  const time = new Date(at);
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad(time.getMilliseconds(), 3)}`;
}

/** Keeps the line for the debug log always, and echoes it to the Metro console in dev builds. */
export function trace(line: string, at: number = Date.now()): void {
  devLog.push(`${clockTime(at)} ${line}`);
  if (typeof __DEV__ !== "undefined" && __DEV__) console.log(`[acemate] ${line}`);
}

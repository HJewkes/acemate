import type { Request } from "../../../tools/drive-probe/src/protocol.js";

/** One connected robot, as the rest of the page sees it. BrowserBleLink talks to hardware; MockLink fakes it. */
export interface Link {
  readonly name: string;
  send(request: Request): Promise<void>;
  /** Each complete robot message, already split on the +==ACE==+ marker. */
  onLine(listener: (line: string) => void): void;
  onDisconnect(listener: () => void): void;
  close(): Promise<void>;
}

export type WriteMode = "withResponse" | "withoutResponse";

// Motion resends every 50 ms, which only works without response: a write with response costs a 40-60 ms round trip.
// Everything else is rare and must arrive, so it waits for the ATT acknowledgement, as the stock app does.
export function writeModeFor(request: Request): WriteMode {
  return request.type === "motion_control" ? "withoutResponse" : "withResponse";
}

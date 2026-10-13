/** The raw link to one robot: ble-channel.ts on native, web-bluetooth.ts in the browser; tests use a fake. */
export interface ByteChannel {
  readonly name: string;
  /**
   * One complete request per write: the robot parses each write as a whole message, so requests are never chunked.
   * Motion goes without response (50 ms cadence); everything else with response, which iOS sends as a long write.
   */
  write(data: Buffer, withResponse: boolean): Promise<void>;
  /**
   * Lowers the session's unacked-write limit for this link: longer lines go with response. Android may keep a
   * 23-byte ATT MTU, where a 76-byte motion written without response would be cut short.
   */
  maxUnackedWrite?: number;
  onData(listener: (data: Buffer) => void): () => void;
  onDisconnect(listener: () => void): () => void;
  close(): Promise<void>;
}

export interface OpenedRobot {
  /** ble-plx's device id on native; on the web, the browser's opaque per-origin id. */
  id: string;
  channel: ByteChannel;
}

/** The raw link to one robot. The BLE implementation is ble-channel.ts; tests use a fake. */
export interface ByteChannel {
  readonly name: string;
  /**
   * One complete request per write: the robot parses each write as a whole message, so requests are never chunked.
   * Motion goes without response (50 ms cadence); everything else with response, which iOS sends as a long write.
   */
  write(data: Buffer, withResponse: boolean): Promise<void>;
  onData(listener: (data: Buffer) => void): () => void;
  onDisconnect(listener: () => void): () => void;
  close(): Promise<void>;
}

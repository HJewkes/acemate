import { Buffer } from "buffer";
import { MOCK_ROBOT_NAME, MockRobot, robotLine } from "@acemate/core";
import type { ByteChannel, OpenedRobot } from "./channel";

/** ?mock=1 (any value) in the page URL swaps the robot for MockRobot, so the app runs with no S10 nearby. */
export function mockRequested(search: string): boolean {
  return new URLSearchParams(search).has("mock");
}

/** A ByteChannel to the shared MockRobot: each write is one whole message, as on BLE. */
export class MockChannel implements ByteChannel {
  readonly name = MOCK_ROBOT_NAME;
  private readonly robot = new MockRobot((message) =>
    this.dataListeners.forEach((listener) => listener(Buffer.from(robotLine(message)))),
  );
  private readonly dataListeners = new Set<(data: Buffer) => void>();
  private readonly disconnectListeners = new Set<() => void>();
  private connected = true;

  async write(data: Buffer): Promise<void> {
    if (!this.connected) throw new Error("Robot is disconnected");
    this.robot.receive(data.toString("utf8"));
  }

  onData(listener: (data: Buffer) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    this.robot.close();
    this.disconnectListeners.forEach((listener) => listener());
  }
}

export function openMockRobot(): OpenedRobot {
  return { id: "mock", channel: new MockChannel() };
}

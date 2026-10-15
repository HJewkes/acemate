import { LineDecoder, MOCK_ROBOT_NAME, MockRobot, chunk, encodeLine, robotLine } from "@acemate/core";
import type { Link } from "./link.js";

export { MOCK_ROBOT_NAME };

/** A Link to the shared MockRobot: writes are chunked as on BLE, replies come back through the same line decoder. */
export function createMockLink(chunkSize: number): Link {
  const decoder = new LineDecoder();
  const listeners: Array<(line: string) => void> = [];
  const robot = new MockRobot((message) => {
    const lines = decoder.push(Buffer.from(robotLine(message)));
    for (const line of lines) listeners.forEach((listener) => listener(line));
  });
  return {
    async send(request) {
      for (const part of chunk(encodeLine(request), chunkSize)) robot.receive(part.toString("utf8"));
    },
    onLine: (listener) => void listeners.push(listener),
    close: async () => robot.close(),
  };
}

// Copied from tools/drive-probe/src/link.ts at 587182f, minus scan; a failed write no longer jams the queue.
// Importing it would resolve @stoprocent/noble from drive-probe's node_modules and force a second install.
// protocol.ts has no dependencies, so it is imported instead of copied.
import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import {
  LineDecoder,
  NUS_NOTIFY,
  NUS_SERVICE,
  NUS_WRITE,
  chunk,
  encodeLine,
  type Request,
} from "../../drive-probe/src/protocol.js";

export interface Link {
  name: string;
  send(request: Request): Promise<void>;
  onLine(listener: (line: string) => void): void;
  onDisconnect(listener: () => void): void;
  close(): Promise<void>;
}

export async function findFirst(timeoutSeconds: number, nameFilter?: string): Promise<Peripheral> {
  await noble.waitForPoweredOnAsync(10_000);
  await noble.startScanningAsync([NUS_SERVICE], false);
  try {
    return await new Promise<Peripheral>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("No Acemate (NUS) device found")), timeoutSeconds * 1000);
      noble.on("discover", (p) => {
        if (nameFilter && !(p.advertisement.localName ?? "").includes(nameFilter)) return;
        clearTimeout(timer);
        resolve(p);
      });
    });
  } finally {
    await noble.stopScanningAsync();
  }
}

export async function connect(peripheral: Peripheral, chunkSize: number): Promise<Link> {
  await peripheral.connectAsync();
  const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
    [NUS_SERVICE],
    [NUS_WRITE, NUS_NOTIFY],
  );
  const writer = pick(characteristics, NUS_WRITE);
  const notifier = pick(characteristics, NUS_NOTIFY);
  await notifier.subscribeAsync();
  return buildLink(peripheral, writer, notifier, chunkSize);
}

function pick(characteristics: Characteristic[], uuid: string): Characteristic {
  const found = characteristics.find((c) => c.uuid === uuid);
  if (!found) throw new Error(`Characteristic ${uuid} not found`);
  return found;
}

// Always writes without response: that is what makes the 50 ms resend rate possible (docs/protocol.md).
function buildLink(peripheral: Peripheral, writer: Characteristic, notifier: Characteristic, chunkSize: number): Link {
  const decoder = new LineDecoder();
  let queue = Promise.resolve();
  return {
    name: peripheral.advertisement.localName ?? peripheral.id,
    send(request) {
      const parts = chunk(encodeLine(request), chunkSize);
      queue = queue
        .catch(() => undefined)
        .then(async () => {
          for (const part of parts) await writer.writeAsync(part, true);
        });
      return queue;
    },
    onLine(listener) {
      notifier.on("data", (data) => decoder.push(data).forEach(listener));
    },
    onDisconnect(listener) {
      peripheral.once("disconnect", listener);
    },
    close: () => peripheral.disconnectAsync(),
  };
}

/** No robot: accepts everything, so the page and send loop can be tried at a desk. */
export function dryRunLink(): Link {
  return {
    name: "dry-run",
    send: async () => undefined,
    onLine: () => undefined,
    onDisconnect: () => undefined,
    close: async () => undefined,
  };
}

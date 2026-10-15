import noble, { type Characteristic, type Peripheral } from "@stoprocent/noble";
import { LineDecoder, NUS_NOTIFY, NUS_SERVICE, NUS_WRITE, chunk, encodeLine, type Request } from "@acemate/core";

export interface Link {
  send(request: Request): Promise<void>;
  onLine(listener: (line: string) => void): void;
  close(): Promise<void>;
}

export async function scan(seconds: number, onFound: (p: Peripheral) => void): Promise<void> {
  await noble.waitForPoweredOnAsync(10_000);
  noble.on("discover", onFound);
  await noble.startScanningAsync([NUS_SERVICE], false);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  await noble.stopScanningAsync();
  noble.removeListener("discover", onFound);
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

interface WriteOptions {
  chunkSize: number;
  withoutResponse: boolean;
}

export async function connect(peripheral: Peripheral, options: WriteOptions): Promise<Link> {
  await peripheral.connectAsync();
  const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
    [NUS_SERVICE],
    [NUS_WRITE, NUS_NOTIFY],
  );
  const writer = pick(characteristics, NUS_WRITE);
  const notifier = pick(characteristics, NUS_NOTIFY);
  await notifier.subscribeAsync();
  return buildLink(peripheral, writer, notifier, options);
}

function pick(characteristics: Characteristic[], uuid: string): Characteristic {
  const found = characteristics.find((c) => c.uuid === uuid);
  if (!found) throw new Error(`Characteristic ${uuid} not found`);
  return found;
}

function buildLink(
  peripheral: Peripheral,
  writer: Characteristic,
  notifier: Characteristic,
  options: WriteOptions,
): Link {
  const decoder = new LineDecoder();
  let queue = Promise.resolve();
  return {
    send(request) {
      const parts = chunk(encodeLine(request), options.chunkSize);
      queue = queue.then(async () => {
        for (const part of parts) await writer.writeAsync(part, options.withoutResponse);
      });
      return queue;
    },
    onLine(listener) {
      notifier.on("data", (data) => decoder.push(data).forEach(listener));
    },
    close: () => peripheral.disconnectAsync(),
  };
}

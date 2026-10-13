/** CoreBluetooth only parses 128-bit UUIDs in the 8-4-4-4-12 form; protocol.ts keeps them undashed. */
export function dashedUuid(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`Not a 128-bit UUID: ${uuid}`);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

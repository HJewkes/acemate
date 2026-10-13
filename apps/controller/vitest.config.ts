import { defineConfig } from "vitest/config";

// Only the pure modules are unit-tested; React Native components and the ble-plx channel need a device.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});

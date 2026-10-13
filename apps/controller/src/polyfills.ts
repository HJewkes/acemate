import { Buffer } from "buffer";

// @acemate/core's encodeLine and chunk use Node's Buffer; Hermes has none.
globalThis.Buffer ??= Buffer as unknown as typeof globalThis.Buffer;

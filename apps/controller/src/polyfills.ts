import { Buffer } from "buffer";

// The shared protocol module uses Node's Buffer; Hermes has none.
globalThis.Buffer ??= Buffer as unknown as typeof globalThis.Buffer;

#!/usr/bin/env node
// @acemate/core ships as TypeScript source, so the CLI runs through tsx rather than a build step.
import { register } from "tsx/esm/api";

register();
await import("../src/cli.ts");

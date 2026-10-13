import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The page imports shared logic from tools/, outside this package, so the dev server must be allowed to read the repo.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  // Relative asset URLs, so the build works from any GitHub Pages subpath.
  base: "./",
  server: { fs: { allow: [repoRoot] } },
  build: { outDir: "dist", emptyOutDir: true },
  test: { include: ["test/**/*.test.ts"] },
});

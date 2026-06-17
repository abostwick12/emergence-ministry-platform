import { defineConfig } from "vitest/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

// Unit tests only. Playwright end-to-end specs live under tests/ and are run
// separately via `npm run test:e2e`, so they are intentionally excluded here.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@": rootDir
    }
  }
});

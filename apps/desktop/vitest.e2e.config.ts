import { defineConfig } from "vitest/config";

/**
 * Electron end-to-end suite. Drives the real app window, so run it on a
 * machine with a display (not in headless CI): `pnpm test:e2e`.
 */
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
  },
});

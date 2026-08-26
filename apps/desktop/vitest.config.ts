import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Electron E2E has its own config and script (`pnpm test:e2e`).
    exclude: ["tests/e2e/**"],
    environment: "node",
  },
});

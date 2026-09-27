import { defineConfig } from "vitest/config";

export default defineConfig({
  // Renderer components are tested by server-rendering them to markup, so the
  // automatic JSX runtime has to be on for .tsx sources under Vitest.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Electron E2E has its own config and script (`pnpm test:e2e`).
    exclude: ["tests/e2e/**"],
    environment: "node",
  },
});

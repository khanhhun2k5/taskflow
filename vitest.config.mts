import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    // NFR-61: line coverage ≥ 90% for pure domain code and shared helpers.
    // Run with `npm run test:coverage` (all projects, so PostgreSQL must be running).
    coverage: {
      provider: "v8",
      include: ["src/features/**/domain/**", "src/lib/**"],
      exclude: ["**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 90 },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup-dom.ts"],
        },
      },
      {
        // Needs PostgreSQL running: `docker compose up -d db` (docs/09 section 2).
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./tests/integration/setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

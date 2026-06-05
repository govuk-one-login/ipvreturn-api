import 'dotenv/config';
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/tests/**/*.test.ts"],
    clearMocks: true,
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["**/*.ts"],
      exclude: [
        "**/tests/**/*.ts",
        "**/types/**/*.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
        "**/node_modules/**",
        "tsconfig.json",
      ],
      reportsDirectory: "coverage",
      reporter: ["lcov", "text"],
    },
    reporters: ["default"],
  },
});
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentMatchGlobs: [["src/client/**", "jsdom"]],
    setupFiles: ["src/client/__tests__/setup.ts"],
    env: {
      JWT_SECRET: "test-secret-do-not-use-in-production",
    },
  },
});

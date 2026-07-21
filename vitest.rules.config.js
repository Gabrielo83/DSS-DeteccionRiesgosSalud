import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/securityRules.rules.js"],
    testTimeout: 20000,
  },
});

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

/**
 * Target defaults to production per spec; override for a safer local run:
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Mutating specs only ever touch roles they create themselves, namespaced with
 * E2E_ROLE_PREFIX, and clean up afterwards — they never modify system roles or
 * any pre-existing custom role.
 */
const baseURL = process.env.BASE_URL || "https://elevateu.dranzo.com";

export default defineConfig({
  testDir: "./e2e",
  // Specs mutate a shared roles list, so they must not race each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
});

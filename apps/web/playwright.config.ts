import { defineConfig, devices } from "@playwright/test";

const browserChannel = process.env.PLAYWRIGHT_CHANNEL?.trim();
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000";
const webPort = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    ...(browserChannel ? { channel: browserChannel } : {}),
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /responsive\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: /responsive\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "tablet",
      testMatch: /responsive\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],
  webServer: [
    {
      command: "npm --prefix ../api run start:dev",
      reuseExistingServer: true,
      timeout: 90_000,
      url: "http://localhost:3001/health",
    },
    {
      command: `npm run dev -- --port ${webPort}`,
      reuseExistingServer: true,
      timeout: 90_000,
      url: baseURL,
    },
  ],
});

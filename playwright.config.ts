import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3333",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3333/en",
    env: {
      PORT: "3333",
      INTAKE_PASSWORD: "test-pass",
      INTAKE_SESSION_SECRET: "test-secret-32-chars-minimum-1234",
      SQLITE_FILE: "data/diva.e2e.sqlite",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

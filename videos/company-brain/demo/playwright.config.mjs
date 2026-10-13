import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  forbidOnly: Boolean(process.env.CI),
  outputDir: "./output/playwright/results",
  reporter: [["list"], ["html", { outputFolder: "./output/playwright/report", open: "never" }]],
  use: {
    browserName: "chromium",
    viewport: { width: 1904, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});

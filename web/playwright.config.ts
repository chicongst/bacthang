import { defineConfig, devices } from "@playwright/test";

const PORT = 5174;

// The smoke suite runs against sample data (?mock), so it needs no database and no
// Discord app. It exists to catch what jsdom cannot: a broken bundle, a CSS rule that
// hides a control, a runtime error that only a real browser throws.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/?mock`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

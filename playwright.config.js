import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/* The container these agents run in has Chromium at a fixed path and no
   network for `playwright install`. CI installs its own. */
const LOCAL_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = Number(process.env.SMOKE_PORT ?? 4161);

export default defineConfig({
  testDir: "tests",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://localhost:${PORT}/`,
    launchOptions: existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {},
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
  },
});

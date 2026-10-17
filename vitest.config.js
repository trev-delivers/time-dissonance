import { defineConfig } from "vitest/config";

/* Age tests depend on the time zone, so pin one. Europe/London has the
   spring-forward and fall-back days the tests check. */
process.env.TZ = "Europe/London";

export default defineConfig({
  test: {
    include: ["src/**/*.test.js"],
    env: { TZ: "Europe/London" },
  },
});

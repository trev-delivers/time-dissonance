import { expect, test } from "@playwright/test";

/* Opens the built page at phone and desktop width, enters a date of birth
   and checks the results appear, nothing scrolls sideways and nothing
   logs an error. Run after `npm run build`. */

for (const width of [390, 1280]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 800 } });

    test("works out the numbers for a date of birth", async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

      // Vercel serves the analytics script; vite preview doesn't.
      await page.route("**/_vercel/insights/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await sidewaysScroll(page)).toBe(0);

      await page.getByLabel("Date of birth").fill("1950-06-15");
      await page.getByLabel("Where did you grow up?").selectOption("de");
      await page.getByRole("button", { name: "Work it out" }).click();

      await expect(page.getByText("Hours skipped since you were born")).toBeVisible();
      await expect(page.locator(".td-stolen-num")).toHaveText("47");
      expect(await sidewaysScroll(page)).toBe(0);

      await page.getByRole("button", { name: "Start again" }).click();
      await expect(page.getByLabel("Date of birth")).toBeVisible();

      expect(errors).toEqual([]);
    });
  });
}

test("the date error stays until the date changes", async ({ page }) => {
  await page.route("**/_vercel/insights/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await page.goto("/");
  const work = page.getByRole("button", { name: "Work it out" });
  const message = page.locator("#td-dob-error");

  await work.click();
  await expect(message).toHaveText("Enter your date of birth.");
  // It used to clear itself after 3 seconds.
  await page.waitForTimeout(3500);
  await expect(message).toHaveText("Enter your date of birth.");

  // The message said "between 1900 and today" but 1899 went through.
  await page.getByLabel("Date of birth").fill("1899-12-31");
  await expect(message).toHaveText("");
  await work.click();
  await expect(message).toHaveText("Enter a date between 1 January 1900 and today.");
  await expect(page.getByText("Hours skipped since you were born")).toHaveCount(0);
});

function sidewaysScroll(page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
}

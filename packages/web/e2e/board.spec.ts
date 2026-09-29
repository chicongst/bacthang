import { expect, test } from "@playwright/test";

// ?lang=en keeps the assertions readable; the Vietnamese path is covered by the unit tests.
const MOCK = "/?mock&clean&lang=en";

test("the board opens with the podium and the full ranking", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(MOCK);

  await expect(page.getByRole("tab", { name: "Board" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".podium li")).toHaveCount(3);
  await expect(page.locator(".rows li")).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("every tab renders", async ({ page }) => {
  await page.goto(MOCK);

  for (const [tab, marker] of [
    ["Add match", "Opponent"],
    ["Recent", "beat"],
    ["Rules", "How points work"],
    ["Group", "Members"],
  ] as const) {
    await page.getByRole("tab", { name: tab, exact: false }).click();
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
  }
});

test("the result step only appears once an opponent is chosen", async ({ page }) => {
  await page.goto(MOCK);
  await page.getByRole("tab", { name: "Add match" }).click();

  await expect(page.getByRole("radio", { name: /I won/ })).toHaveCount(0);

  await page.getByRole("radio", { name: /Hoàng Long/ }).click();

  await expect(page.getByRole("radio", { name: /I won/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose win or loss/ })).toBeDisabled();
});

test("an opponent with no matches left cannot be picked", async ({ page }) => {
  await page.goto(MOCK);
  await page.getByRole("tab", { name: "Add match" }).click();

  await expect(page.getByRole("radio", { name: /Văn Nam/ })).toBeDisabled();
});

test("the language toggle switches the interface", async ({ page }) => {
  await page.goto(MOCK);

  await page.getByRole("button", { name: /Vietnamese|Tiếng Việt|Switch/ }).click();

  await expect(page.getByRole("tab", { name: "Bảng" })).toBeVisible();
});

test("nothing scrolls sideways on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "only meaningful at phone width");
  await page.goto(MOCK);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

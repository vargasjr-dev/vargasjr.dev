import { expect, test } from "@playwright/test";

test("the admin gate runs before mounting the app", async ({ page }) => {
  await page.goto("/admin/dev/assistant/");
  await expect(page).toHaveURL(/\/admin\/$/);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("pairs an unauthenticated browser and keeps assistant navigation under the dev mount", async ({
  page,
}) => {
  let paired = false;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("admin_token", "dev-test-token"),
  );
  await page.route("**/_allauth/**", (route) =>
    route.fulfill({ status: 401, json: { status: 401, data: {} } }),
  );
  await page.route(/\/v1\/assistant\/?$/, (route) =>
    route.fulfill(
      paired
        ? {
            json: {
              status: "ready",
              assistant: { id: "test-assistant", version: "test" },
            },
          }
        : { status: 401, json: { error: "unauthenticated" } },
    ),
  );
  await page.route(
    "**/v1/assistant/remote-web/pairing-token",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        deviceCode: "test-device-code",
      });
      paired = true;
      await route.fulfill({
        json: {
          status: "approved",
          accessToken: "test-only-access",
          accessTokenExpiresAt: Date.now() + 60000,
          refreshAfter: Date.now() + 30000,
        },
      });
    },
  );
  await page.route(/\/web\/assistant(?:\/|$)/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Assistant test runtime</title><p>Test runtime</p>",
    }),
  );
  await page.goto("/admin/dev/");
  await expect(page).toHaveURL(/\/admin\/dev\/account\/pair\/?$/);
  await expect(
    page.getByRole("heading", { name: "Pair a device" }),
  ).toBeVisible();
  await page.getByRole("textbox").fill("test-device-code");
  await page.getByRole("button", { name: "Pair", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dev\/assistant\/?$/);
  const frame = page.locator("iframe");
  await expect(frame).toHaveAttribute("src", /\/web\/assistant\/?$/);
  await page
    .frameLocator("iframe")
    .locator("body")
    .evaluate(() => {
      window.parent.postMessage(
        {
          source: "mycadet-web-nav",
          path: "/web/assistant/conversations/test/?view=chat#message-1",
          nav: "push",
        },
        window.location.origin,
      );
    });
  await expect(page).toHaveURL(
    /\/admin\/dev\/assistant\/conversations\/test\/\?view=chat#message-1$/,
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/dev\/assistant\/?$/);
  expect(errors).toEqual([]);
});

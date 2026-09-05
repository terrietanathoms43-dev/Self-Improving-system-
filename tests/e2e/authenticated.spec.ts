import { test, expect } from "@playwright/test";
const email = process.env.E2E_STAFF_EMAIL;
const password = process.env.E2E_STAFF_PASSWORD;
const staffTest = email && password ? test : test.skip;
staffTest(
  "authorized staff can sign in and reach the dashboard",
  async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /AI review and governance/i }),
    ).toBeVisible();
    await expect(page.getByText(/AI-only rejection blocked/i)).toBeVisible();
  },
);

const roleChecks = [
  ["INTAKE", "/dashboard/intake", "/dashboard/governance"],
  ["MEDICAL", "/dashboard/verification", "/dashboard/admin"],
  ["SOCIAL", "/dashboard/verification", "/dashboard/queue"],
  ["CASE_REVIEW", "/dashboard/queue", "/dashboard/admin"],
  ["OVERSIGHT", "/dashboard/governance", "/dashboard/documents"],
  ["APPEALS", "/dashboard/appeals", "/dashboard/governance"],
  ["ADMIN", "/dashboard/admin", null],
] as const;
for (const [role, route, forbiddenRoute] of roleChecks) {
  const roleEmail = process.env[`E2E_${role}_EMAIL`];
  const rolePassword = process.env[`E2E_${role}_PASSWORD`];
  const roleTest = roleEmail && rolePassword ? test : test.skip;
  roleTest(
    `${role.toLowerCase()} role has the expected route boundary`,
    async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(roleEmail!);
      await page.getByLabel("Password").fill(rolePassword!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.locator("main h1")).toBeVisible();
      if (forbiddenRoute) {
        await page.goto(forbiddenRoute);
        await expect(page).toHaveURL(/\/unauthorized$/);
      }
    },
  );
}

import {test,expect} from "@playwright/test";
const email=process.env.E2E_STAFF_EMAIL;const password=process.env.E2E_STAFF_PASSWORD;
const staffTest=email&&password?test:test.skip;
staffTest("authorized staff can sign in and reach the dashboard",async({page})=>{await page.goto("/login");await page.getByLabel("Email").fill(email!);await page.getByLabel("Password").fill(password!);await page.getByRole("button",{name:"Sign in"}).click();await expect(page).toHaveURL(/\/dashboard/);await expect(page.getByRole("heading",{name:/AI review and governance/i})).toBeVisible();await expect(page.getByText(/AI-only rejection blocked/i)).toBeVisible()});

const roleChecks=[
  ["INTAKE","/dashboard/intake"],["MEDICAL","/dashboard/verification"],["SOCIAL","/dashboard/verification"],
  ["CASE_REVIEW","/dashboard/queue"],["OVERSIGHT","/dashboard/governance"],["APPEALS","/dashboard/appeals"],["ADMIN","/dashboard/admin"],
] as const;
for(const [role,route] of roleChecks){const roleEmail=process.env[`E2E_${role}_EMAIL`];const rolePassword=process.env[`E2E_${role}_PASSWORD`];const roleTest=roleEmail&&rolePassword?test:test.skip;roleTest(`${role.toLowerCase()} role can reach its protected workspace`,async({page})=>{await page.goto("/login");await page.getByLabel("Email").fill(roleEmail!);await page.getByLabel("Password").fill(rolePassword!);await page.getByRole("button",{name:"Sign in"}).click();await page.goto(route);await expect(page).toHaveURL(new RegExp(`${route}$`));await expect(page.locator("main h1")).toBeVisible();});}

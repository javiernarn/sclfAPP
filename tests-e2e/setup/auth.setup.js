import { test as setup, expect } from '@playwright/test';
import { ROLES } from '../fixtures/roles.js';

// Performs a *real* login through the actual LoginPage UI for each seeded
// role, then saves Playwright's storageState (cookies + localStorage,
// which is where the app keeps its access/refresh token pair via
// react-secure-storage). Every other spec loads one of these files
// instead of re-doing the login dance, so tests stay fast without ever
// faking auth — the login flow itself still gets exercised once per run.

// Fires once, before any timed login, purely to force Vite (dev server)
// and Laravel to finish their first-request compile/bootstrap cost up
// front. Without this, whichever role happens to run first eats that
// one-time cold-start delay on top of MainPage's fixed 7s "figuring out
// where you go" screen and can blow past a tight waitForURL budget.
setup('warm up the app before timed logins', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible({ timeout: 60_000 });
});

for (const [role, account] of Object.entries(ROLES)) {
    setup(`authenticate as ${role}`, async ({ page }) => {
        await page.goto('/login');

        await page.locator('#email').fill(account.email);
        await page.locator('#password').fill(account.password);

        await page.getByRole('button', { name: /sign in/i }).click();

        // Login navigates to "/" first (the branded loading screen) before
        // the router settles on the role's real dashboard — wait for that
        // final destination rather than the intermediate screen. MainPage
        // holds there for a fixed 7s, so the budget below is generous on
        // top of that rather than tight against it.
        await page.waitForURL(new RegExp(account.dashboard.replace(/\//g, '\\/')), {
            timeout: 30_000,
        });

        await expect(page.locator('body')).not.toContainText('Invalid credentials');

        await page.context().storageState({ path: account.storageState });
    });
}

import { test, expect } from '@playwright/test';
import { ROLES } from '../fixtures/roles.js';

// Runs logged-out throughout — no shared session needed.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', () => {
    test('rejects wrong credentials with a visible error', async ({ page }) => {
        await page.goto('/login');
        await page.locator('#email').fill(ROLES.student.email);
        await page.locator('#password').fill('definitely-wrong-password');
        await page.getByRole('button', { name: /sign in/i }).click();

        await expect(page.locator('.lg-banner, [aria-invalid="true"]').first()).toBeVisible({
            timeout: 10_000,
        });
        await expect(page).toHaveURL(/\/login/);
    });

    test('shows the session-expired banner when redirected with that flag', async ({ page }) => {
        await page.goto('/login?type=session-expired');
        await expect(page.getByText(/session expired/i)).toBeVisible();
    });

    test('each role lands on its own dashboard after signing in', async ({ browser }) => {
        // Fresh context per role — a shared page here would leave the
        // previous role's background timers (silent token refresh,
        // notification polling) racing the next iteration's navigation.
        for (const [role, account] of Object.entries(ROLES)) {
            const context = await browser.newContext();
            const page = await context.newPage();

            await page.goto('/login');
            await page.locator('#email').fill(account.email);
            await page.locator('#password').fill(account.password);
            await page.getByRole('button', { name: /sign in/i }).click();

            await page.waitForURL(new RegExp(account.dashboard.replace(/\//g, '\\/')), {
                timeout: 30_000,
            });
            expect(page.url(), `${role} should land on ${account.dashboard}`).toContain(account.dashboard);

            await context.close();
        }
    });

    test('"Keep this session open" persists credentials into the form on next visit', async ({ page }) => {
        await page.goto('/login');
        await page.locator('#email').fill(ROLES.student.email);
        await page.locator('#password').fill(ROLES.student.password);
        await page.locator('#remember').check();
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(new RegExp(ROLES.student.dashboard.replace(/\//g, '\\/')), { timeout: 30_000 });

        await page.goto('/login');
        await expect(page.locator('#email')).toHaveValue(ROLES.student.email);
    });
});

import { test, expect } from '@playwright/test';
import { ROLES } from '../fixtures/roles.js';
import { loginAs } from '../fixtures/login.js';

// Runs only under the "mobile-chromium" project (Pixel 7 viewport) —
// see playwright.config.js. Below the 960px desktop breakpoint the
// sidebar becomes a slide-over overlay instead of a persistent column.

test.describe('Mobile navigation', () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'student');
    });

    test('sidebar starts hidden and opens as an overlay via the burger button', async ({ page }) => {
        await page.goto(ROLES.student.dashboard);

        const backdrop = page.locator('.ds-sidebar-backdrop');
        await expect(backdrop).not.toHaveClass(/open/);

        await page.getByRole('button', { name: /toggle sidebar|expand sidebar/i }).click();
        await expect(backdrop).toHaveClass(/open/);
        await expect(page.getByRole('link', { name: 'Report Lost Item' })).toBeVisible();
    });

    test('tapping the backdrop closes the overlay', async ({ page }) => {
        await page.goto(ROLES.student.dashboard);
        await page.getByRole('button', { name: /toggle sidebar|expand sidebar/i }).click();

        const backdrop = page.locator('.ds-sidebar-backdrop');
        await expect(backdrop).toHaveClass(/open/);
        // Click a point clearly to the right of the sidebar (which is
        // 300px wide and also starts at x:0), so the click actually
        // lands on the backdrop instead of being intercepted by the
        // higher z-index sidebar sitting on top of it in that corner.
        await backdrop.click({ position: { x: 350, y: 300 } });
        await expect(backdrop).not.toHaveClass(/open/);
    });

    test('navigating to a page via the mobile overlay closes it and loads the page', async ({ page }) => {
        await page.goto(ROLES.student.dashboard);
        await page.getByRole('button', { name: /toggle sidebar|expand sidebar/i }).click();
        await page.getByRole('link', { name: 'Notifications' }).click();

        await page.waitForURL(/\/app\/notifications/);
        await expect(page.locator('.ds-sidebar-backdrop')).not.toHaveClass(/open/);
    });
});

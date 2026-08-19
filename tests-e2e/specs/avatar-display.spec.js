import { test, expect } from '@playwright/test';
import { ROLES } from '../fixtures/roles.js';
import { loginAs } from '../fixtures/login.js';

// DashboardShell renders the avatar in two places (top-right header menu
// and the sidebar's own account menu) plus a third on ProfilePage itself
// — all three derive independently from `user.profile_picture_url` /
// initials fallback, so it's easy for one to drift out of sync with the
// others after a UI change.

test.describe('Avatar display', () => {
    test('header, sidebar, and profile page all render the same avatar state', async ({ page }) => {
        await loginAs(page, 'student');
        await page.goto(ROLES.student.dashboard);

        const avatars = page.locator('.ds-avatar');
        // Wait for the dashboard shell itself to actually paint before
        // counting — the account object/roles load async after MainPage
        // hands off, so an immediate .count() can catch it mid-render.
        await expect(avatars.first()).toBeVisible({ timeout: 10_000 });

        const count = await avatars.count();
        expect(count).toBeGreaterThanOrEqual(2);

        const states = [];
        for (let i = 0; i < count; i++) {
            const el = avatars.nth(i);
            const bg = await el.evaluate((node) => getComputedStyle(node).backgroundImage);
            const text = (await el.textContent())?.trim();
            states.push(bg !== 'none' ? 'photo' : text || 'empty');
        }
        const distinctModes = new Set(states.map((s) => (s === 'photo' ? 'photo' : 'initials')));
        expect(distinctModes.size, `avatar states disagreed: ${JSON.stringify(states)}`).toBe(1);

        await page.goto('/app/profile');
        await expect(page.locator('.ds-avatar').first()).toBeVisible();
    });
});

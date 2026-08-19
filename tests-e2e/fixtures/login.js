import { expect } from '@playwright/test';
import { ROLES } from './roles.js';

// Logs in through the actual /login form and waits for the role's real
// dashboard to load. Deliberately NOT using a shared storageState file:
// this app's refresh tokens are single-use/rotating (see
// resources/js/config/axiosConfig.js), so any earlier test that
// triggers a silent refresh burns the refresh token for every other
// test that later loads the same static snapshot. Logging in fresh per
// test costs a few extra seconds but means every test's session is its
// own and can never be invalidated by another test.
export async function loginAs(page, roleKey) {
    const account = ROLES[roleKey];
    if (!account) throw new Error(`Unknown role "${roleKey}" — check fixtures/roles.js`);

    await page.goto('/login');
    await page.locator('#email').fill(account.email);
    await page.locator('#password').fill(account.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(new RegExp(account.dashboard.replace(/\//g, '\\/')), {
        timeout: 30_000,
    });
    await expect(page.locator('body')).not.toContainText('Invalid credentials');

    return account;
}

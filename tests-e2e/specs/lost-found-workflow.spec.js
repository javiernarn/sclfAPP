import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/login.js';

// Exercises the real form -> axios -> API -> DB -> list-refresh round trip,
// which unit/feature tests never touch since they call controllers
// directly. Each test gets its own fresh login (see fixtures/login.js)
// rather than a shared session.

test.describe('Lost & found end-to-end', () => {
    test('student reports a lost item and sees it in their list', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'student');

        const itemName = `E2E Lost Umbrella ${Date.now()}`;

        await page.goto('/app/lost-items/create');

        // Legitimacy-notice gate must be accepted before the form unlocks.
        await page.getByRole('button', { name: /add report/i }).click();
        await page.getByRole('button', { name: /i agree, unlock form/i }).click();

        await page.getByLabel('Item Name').fill(itemName);
        await page.getByLabel('Description').fill('Black umbrella with a broken tip, lost near the gym.');
        await page.getByLabel('Location Lost').fill('Gymnasium');

        await page.getByRole('button', { name: /submit report/i }).click();

        await page.waitForURL(/\/app\/lost-items(?!\/create)/, { timeout: 15_000 });
        await expect(page.getByText(itemName)).toBeVisible({ timeout: 10_000 });

        await context.close();
    });

    test('security officer submits a found item and sees it in the review queue', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'security_officer');

        const itemName = `E2E Found Wallet ${Date.now()}`;

        await page.goto('/app/found-items/create');

        // Legitimacy-notice gate must be accepted before the form unlocks.
        await page.getByRole('button', { name: /add report/i }).click();
        await page.getByRole('button', { name: /i agree, unlock form/i }).click();

        await page.getByLabel('Item Name').fill(itemName);
        await page.getByLabel('Description').fill('Brown leather wallet found at the front gate.');
        await page.getByLabel('Location Found').fill('Front Gate');

        await page.getByRole('button', { name: /submit found item report/i }).click();

        await page.waitForURL(/\/app\/found-items(?!\/create)/, { timeout: 15_000 });
        await expect(page.getByText(itemName)).toBeVisible({ timeout: 10_000 });

        await page.goto('/app/security/found-items');
        await expect(page.getByText(itemName)).toBeVisible({ timeout: 10_000 });

        await context.close();
    });

    test('a found item detail page is reachable and shows submitted fields', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'student');

        const itemName = `E2E Found Detail Check ${Date.now()}`;
        await page.goto('/app/found-items/create');

        // Legitimacy-notice gate must be accepted before the form unlocks.
        await page.getByRole('button', { name: /add report/i }).click();
        await page.getByRole('button', { name: /i agree, unlock form/i }).click();

        await page.getByLabel('Item Name').fill(itemName);
        await page.getByLabel('Description').fill('Grey backpack, one strap torn.');
        await page.getByRole('button', { name: /submit found item report/i }).click();
        await page.waitForURL(/\/app\/found-items(?!\/create)/, { timeout: 15_000 });

        await page.getByText(itemName).click();
        await page.waitForURL(/\/app\/found-items\/\d+/, { timeout: 10_000 });
        await expect(page.getByText(itemName)).toBeVisible();
        await expect(page.getByText(/grey backpack/i)).toBeVisible();

        await context.close();
    });
});

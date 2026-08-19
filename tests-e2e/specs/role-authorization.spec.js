import { test, expect } from '@playwright/test';
import { ROLES } from '../fixtures/roles.js';
import { loginAs } from '../fixtures/login.js';

// ProtectedRoute (RootApp.jsx) bounces anyone lacking requiredRoles to
// /app/dashboard. These checks matter because the API being locked down
// is not the same guarantee as the UI actually hiding/blocking things —
// that's the "UI authorization visibility" gap.

test.describe('Admin-only routes', () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'student');
    });

    test('student is redirected away from /app/admin/users', async ({ page }) => {
        await page.goto('/app/admin/users');
        await page.waitForURL(/\/app\/dashboard/, { timeout: 15_000 });
        await expect(page.getByText(/users/i)).not.toBeVisible();
    });

    test('student is redirected away from /app/admin/audit-log', async ({ page }) => {
        await page.goto('/app/admin/audit-log');
        await page.waitForURL(/\/app\/dashboard/, { timeout: 15_000 });
    });
});

test.describe('Security-officer/admin-only routes', () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'student');
    });

    test('student is redirected away from the QR release scanner', async ({ page }) => {
        await page.goto('/app/security/qr-scanner');
        await page.waitForURL(/\/app\/dashboard/, { timeout: 15_000 });
    });

    test('student is redirected away from the security inventory', async ({ page }) => {
        await page.goto('/app/security/inventory');
        await page.waitForURL(/\/app\/dashboard/, { timeout: 15_000 });
    });
});

test.describe('Sidebar nav matches role', () => {
    test('student does not see Users, Audit Log, or QR Scanner in the nav', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'student');

        await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Audit Log' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'QR Release Scanner' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Report Lost Item' })).toBeVisible();

        await context.close();
    });

    test('security officer sees the QR scanner and inventory, not admin Users', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'security_officer');

        await expect(page.getByRole('link', { name: 'QR Release Scanner' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Inventory', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);

        await context.close();
    });

    test('admin sees Users and Audit Log', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'admin');

        await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible();

        await context.close();
    });
});

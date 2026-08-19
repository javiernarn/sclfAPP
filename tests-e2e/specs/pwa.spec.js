import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/login.js';

test.describe('PWA installability', () => {
    test('manifest.json is served with the fields Android/Chrome require to install', async ({ request }) => {
        const res = await request.get('/manifest.json');
        expect(res.ok()).toBeTruthy();
        // PwaManifestController intentionally serves application/manifest+json
        // (the spec-correct MIME type for a web manifest), not plain
        // application/json.
        expect(res.headers()['content-type']).toContain('application/manifest+json');

        const manifest = await res.json();
        expect(manifest.name).toBe('SCLF - Opol Community College');
        expect(manifest.short_name).toBe('SCLF');
        expect(manifest.display).toBe('standalone');
        // Scope must stay under /app/ — this is what keeps /login,
        // /register etc. opening in the plain browser instead of being
        // swallowed by the installed app shell. Regressing this silently
        // breaks email/SMS deep links on an installed PWA.
        expect(manifest.scope).toBe('/app/');
        expect(manifest.start_url).toBe('/app/dashboard');
        expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeGreaterThan(0);
        for (const icon of manifest.icons) {
            expect(icon.src).toMatch(/^https?:\/\//);
            expect(icon.sizes).toBeTruthy();
        }
    });

    test('/sw.js is served and registers without error on an authenticated page', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'student');

        const swResponse = await context.request.get('/sw.js');
        expect(swResponse.ok()).toBeTruthy();

        await page.goto('/app/dashboard');
        const registered = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return 'unsupported';
            try {
                const reg = await navigator.serviceWorker.ready;
                return !!reg.active || !!reg.installing || !!reg.waiting;
            } catch {
                return false;
            }
        });
        expect(registered).not.toBe(false);

        await context.close();
    });

    test('the manifest is linked from the authenticated app shell', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs(page, 'student');

        const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
        expect(manifestHref).toContain('manifest.json');

        await context.close();
    });
});

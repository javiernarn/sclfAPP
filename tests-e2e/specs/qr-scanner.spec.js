import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/login.js';

// Real hardware/camera scanning can't be automated, but the surrounding
// UI (permission states, tab switching, manual-entry fallback) can be —
// which is exactly what regresses silently without a test.
//
// Chromium is launched with fake-device flags so getUserMedia() succeeds
// against a synthetic video feed instead of hanging/erroring on missing
// hardware in CI. See launchOptions below.

test.use({
    launchOptions: {
        args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
        ],
    },
});

test.describe('QR release scanner', () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'security_officer');
    });

    test('camera permission granted: live scan tab renders a video feed', async ({ context, page }) => {
        await context.grantPermissions(['camera']);
        await page.goto('/app/security/qr-scanner');

        await expect(page.getByRole('button', { name: /scan with camera/i })).toBeVisible();
        const video = page.locator('video.sclf-scan-video');
        await expect(video).toBeVisible({ timeout: 10_000 });
    });

    test('camera permission denied: falls back with a clear message, not a crash', async ({ context, page }) => {
        await context.clearPermissions();

        // --use-fake-ui-for-media-stream (set above for the whole file, so
        // the "granted" test above can get a synthetic video feed without
        // a real permission prompt) auto-accepts getUserMedia() regardless
        // of context.clearPermissions() — so a denial can't be simulated
        // through browser permissions here. Reject getUserMedia directly
        // instead, the same way the real browser would after the user
        // declines the prompt.
        await page.addInitScript(() => {
            navigator.mediaDevices.getUserMedia = () =>
                Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
        });

        await page.goto('/app/security/qr-scanner');

        await expect(page.getByRole('button', { name: /scan with camera/i })).toBeVisible();
        await expect(page.getByText(/could not access the camera|no camera was found/i)).toBeVisible({
            timeout: 10_000,
        });
    });

    test('manual entry tab requires both a code and a token, and a bogus pair is rejected', async ({ page }) => {
        await page.goto('/app/security/qr-scanner');
        await page.getByRole('button', { name: /manual entry/i }).click();

        await expect(page.getByText(/generate.*regenerate.*code/i)).toBeVisible();

        await page.getByPlaceholder('SCLF-ITEM-000245').fill('SCLF-ITEM-000000');
        await page.getByPlaceholder(/paste the token/i).fill('bogus-token-does-not-exist');
        await page.getByRole('button', { name: /release item/i }).click();

        // The same error text renders twice at once (an inline .ds-error
        // banner and a toast), so this needs .first() to avoid a
        // strict-mode multi-match.
        await expect(page.getByText(/could not release item|invalid|not found|unrecognized/i).first()).toBeVisible({
            timeout: 10_000,
        });
    });

    test('upload-QR tab is available as a camera-less alternative', async ({ page }) => {
        await page.goto('/app/security/qr-scanner');
        await page.getByRole('button', { name: /upload qr image/i }).click();
        await expect(page.getByText(/click to choose a qr code image/i)).toBeVisible();
    });
});

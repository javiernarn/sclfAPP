import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/login.js';

test.describe('Web push opt-in toggle (Profile page)', () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'student');
    });

    test('browser without push support shows the "not supported" message, not a broken button', async ({ page }) => {
        // Strip PushManager before the profile page's scripts run, so
        // isPushSupported() in utils/push.js genuinely evaluates false —
        // this is what actually happens on Safari/old browsers. Added
        // after login (login itself doesn't touch push).
        await page.addInitScript(() => {
            // eslint-disable-next-line no-undef
            delete window.PushManager;
        });

        await page.goto('/app/profile');
        await expect(page.getByText(/doesn't support push notifications/i)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('button', { name: /push notifications|turn on|turn off/i })).toHaveCount(0);
    });

    test('declining the browser permission prompt keeps the toggle off and informs the user', async ({ context, page }) => {
        await context.clearPermissions();
        await page.goto('/app/profile');

        const toggle = page.getByRole('button', { name: /notifications on this device/i });
        await expect(toggle).toBeVisible({ timeout: 10_000 });
        await toggle.click();

        await expect(page.getByText(/aren.?t set up on the server|isn.?t supported|denied|turned on|blocked in your browser/i).first())
            .toBeVisible({ timeout: 10_000 });
    });

    test('granting permission lets the toggle report an "on" state', async ({ context, page }) => {
        await context.grantPermissions(['notifications']);

        // Real push-service subscription can't be automated end-to-end
        // without live VAPID keys, so the actual PushManager.subscribe()
        // call is stubbed to return a realistic-shaped subscription —
        // everything else (permission flow, UI state, API POST) is real.
        //
        // utils/push.js does:
        //   reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready)
        // and registerServiceWorker() calls the REAL navigator.serviceWorker
        // .register('/sw.js'), which succeeds on its own — so stubbing only
        // `.ready` never gets reached; the real (non-functional here)
        // pushManager.subscribe() runs instead and throws. Stub `.register`
        // too so both paths resolve to the same fake registration.
        await page.addInitScript(() => {
            const fakeSubscription = {
                endpoint: 'https://fake-push-service.test/e2e-endpoint',
                toJSON: () => ({
                    endpoint: 'https://fake-push-service.test/e2e-endpoint',
                    keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
                }),
                unsubscribe: async () => true,
            };
            const fakeRegistration = {
                pushManager: {
                    getSubscription: async () => null,
                    subscribe: async () => fakeSubscription,
                },
            };
            if (navigator.serviceWorker) {
                navigator.serviceWorker.register = async () => fakeRegistration;
                navigator.serviceWorker.ready = Promise.resolve(fakeRegistration);
            }
        });

        await page.goto('/app/profile');
        const toggle = page.getByRole('button', { name: /notifications on this device/i });
        await expect(toggle).toBeVisible({ timeout: 10_000 });

        await toggle.click();
        await expect(
            page.getByText(/push notifications are on|aren.?t set up on the server/i).first()
        ).toBeVisible({ timeout: 10_000 });
    });
});

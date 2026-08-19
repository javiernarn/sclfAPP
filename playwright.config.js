// @ts-check
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

export default defineConfig({
    testDir: './tests-e2e',
    fullyParallel: false, // shared MySQL data across specs — keep it predictable
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 60_000,

    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'desktop-chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: /mobile-.*\.spec\.js/,
        },
        {
            name: 'mobile-chromium',
            use: { ...devices['Pixel 7'] },
            testMatch: /mobile-.*\.spec\.js/,
        },
    ],

    // Uncomment if you want Playwright to boot the app itself. Left off
    // by default since it requires migrations/seeding/VAPID keys to
    // already be in place — see tests-e2e/README.md.
    // webServer: {
    //     command: 'php artisan serve',
    //     url: BASE_URL,
    //     reuseExistingServer: !process.env.CI,
    // },
});

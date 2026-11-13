import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROLES } from '../fixtures/roles.js';
import { loginAs } from '../fixtures/login.js';

// Skip link + automated axe checks.
//
// NOT RUN when written: it was authored in an environment without a browser.
// The first real run is the baseline.
//
//  * axe scans REPORT violations (attached to the test + printed) and only fail
//    when A11Y_STRICT=1, so the first run cannot surprise-break CI.
//        A11Y_STRICT=1 npx playwright test accessibility
//  * The `meta-viewport` rule is switched off on purpose: it flags the zoom
//    lock (user-scalable=no), which is a recorded owner decision.
//  * Colour contrast is included; it is the main unknown across the 3 themes.

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const OWNER_ACCEPTED = ['meta-viewport'];

async function scan(page, label) {
    const { violations } = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .disableRules(OWNER_ACCEPTED)
        .analyze();

    const summary = violations.map((v) => ({
        rule: v.id, impact: v.impact, count: v.nodes.length, help: v.help,
        sample: v.nodes[0]?.target?.join(' '),
    }));
    await test.info().attach(`axe-${label}.json`, { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
    // eslint-disable-next-line no-console
    console.log(`[axe] ${label}: ${violations.length} rule(s) violated`, summary.map((s) => `${s.rule}(${s.count})`).join(', '));

    if (process.env.A11Y_STRICT) expect(summary).toEqual([]);
}

async function expectSkipLinkWorks(page) {
    const skip = page.getByRole('link', { name: /skip to main content/i });

    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    const urlBefore = page.url();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(page.url()).toBe(urlBefore); // no "#main-content" added to the address
}

test.describe('Skip link', () => {
    test('login page: first Tab shows it, Enter moves focus to the main content', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('#email')).toBeVisible({ timeout: 60_000 });
        await expectSkipLinkWorks(page);
    });

    test('signed-in dashboard: same behaviour past the sidebar', async ({ page }) => {
        await loginAs(page, 'student');
        await page.goto(ROLES.student.dashboard);
        await expect(page.locator('#main-content')).toBeAttached();
        await expectSkipLinkWorks(page);
    });
});

test.describe('axe (WCAG 2.1 A/AA)', () => {
    test('login page', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('#email')).toBeVisible({ timeout: 60_000 });
        await scan(page, 'login');
    });

    for (const role of ['student', 'security_officer', 'admin']) {
        test(`${role} dashboard`, async ({ page }) => {
            if (!ROLES[role]) test.skip(true, `no "${role}" account in fixtures/roles.js`);
            await loginAs(page, role);
            await expect(page.locator('#main-content')).toBeAttached();
            await scan(page, `${role}-dashboard`);
        });
    }
});

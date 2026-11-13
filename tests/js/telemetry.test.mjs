// Run with:  node --test tests/js/*.test.mjs
// resources/js/utils/telemetry.js with a fake browser (window, navigator, fetch).
import test from 'node:test';
import assert from 'node:assert/strict';

const sent = [];
globalThis.window = { location: { pathname: '/app/claims/42' }, addEventListener() {} };
Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true, sendBeacon: (url, blob) => { sent.push({ url, blob }); return true; } },
    configurable: true,
});

const t = await import(`../../resources/js/utils/telemetry.js?${Date.now()}`);
const body = async (i) => JSON.parse(await sent[i].blob.text());

test('a crash is sent to the endpoint with the path only', async () => {
    t.reportClientError({ type: 'error', error: new Error('x is not a function') });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, '/api/client-errors');
    const b = await body(0);
    assert.equal(b.type, 'error');
    assert.equal(b.url, '/app/claims/42');
});

test('the same error is sent once', () => {
    const before = sent.length;
    const thrownFromTheSameSpot = () => new Error('repeat');
    t.reportClientError({ type: 'error', error: thrownFromTheSameSpot() });
    t.reportClientError({ type: 'error', error: thrownFromTheSameSpot() });
    assert.equal(sent.length, before + 1);
});

test('noise is not sent: stale-deploy chunks, ResizeObserver, opaque script errors, extensions, axios errors', () => {
    const before = sent.length;
    t.reportClientError({ error: new Error('Failed to fetch dynamically imported module: /build/x.js') });
    t.reportClientError({ message: 'ResizeObserver loop completed with undelivered notifications.' });
    t.reportClientError({ message: 'Script error.' });
    t.reportClientError({ message: 'boom', filename: 'chrome-extension://abc/content.js' });
    const axiosErr = Object.assign(new Error('Request failed with status code 500'), { isAxiosError: true });
    t.reportClientError({ type: 'rejection', error: axiosErr });
    const cancelled = Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' });
    t.reportClientError({ type: 'rejection', error: cancelled });
    assert.equal(sent.length, before);
});

test('a runaway loop is capped per page load', () => {
    const before = sent.length;
    for (let i = 0; i < 50; i += 1) t.reportClientError({ error: new Error(`loop ${i}`) });
    assert.ok(sent.length - before <= 5);
});

test('reporting never throws, even with hostile input or no network', () => {
    assert.doesNotThrow(() => t.reportClientError());
    assert.doesNotThrow(() => t.reportClientError({ error: { get message() { throw new Error('nope'); } } }));
    navigator.onLine = false;
    assert.equal(t.sendTelemetry({ type: 'error', message: 'offline' }), false);
    navigator.onLine = true;
});

test('oversized payloads are dropped client-side', () => {
    assert.equal(t.sendTelemetry({ type: 'error', message: 'x'.repeat(13000) }), false);
});

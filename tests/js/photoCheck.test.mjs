// Run with:  node --test tests/js
// Pure-function tests for resources/js/utils/photoCheck.js using synthetic
// RGBA images + hand-made 68-point landmarks (no browser, no face models).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from '../../resources/js/utils/photoCheck.js';

const W = 400; const H = 500;
const SKIN = [224, 172, 140];

function canvas(bg = [248, 248, 248]) {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255; }
    return { data, width: W, height: H };
}
const px = (img, x, y, c) => { const i = (y * img.width + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; };
const rect = (img, x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(img, x, y, c); };
const ellipse = (img, cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) px(img, x, y, c);
    }
};

/** A front-facing person centred at cx: face ellipse, neck, shoulders, plus matching landmarks. */
function person(cx = 200, cy = 190, { cap = false } = {}) {
    const img = canvas();
    rect(img, cx - 140, 330, cx + 140, H, [60, 70, 110]);              // shirt / shoulders
    rect(img, cx - 28, 270, cx + 28, 340, SKIN);                          // neck
    ellipse(img, cx, cy, 70, 90, SKIN);                                   // face
    ellipse(img, cx, cy - 100, 70, 30, [30, 24, 20]);                      // hair on top (hairline above the forehead strip)
    if (cap) { rect(img, cx - 80, cy - 125, cx + 80, cy - 40, [25, 30, 45]); }  // cap down over the forehead
    // add faint noise so texture checks have something to measure
    for (let i = 0; i < img.data.length; i += 4) { const n = ((i * 2654435761) >>> 0) % 7 - 3; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }

    const pts = Array.from({ length: 68 }, () => ({ x: cx, y: cy }));
    for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); pts[i] = { x: cx - Math.cos(a) * 66, y: cy + 10 + Math.sin(a) * 78 }; }
    for (let i = 0; i < 5; i++) { pts[17 + i] = { x: cx - 56 + i * 11, y: cy - 38 }; pts[22 + i] = { x: cx + 12 + i * 11, y: cy - 38 }; }
    pts[28] = { x: cx, y: cy - 5 }; pts[30] = { x: cx, y: cy + 12 };
    pts[31] = { x: cx - 14, y: cy + 20 }; pts[35] = { x: cx + 14, y: cy + 20 };
    const eye = (x0) => [[0, 0], [0.3, -6], [0.7, -6], [1, 0], [0.7, 6], [0.3, 6]].map(([a, b]) => ({ x: x0 + a * 26, y: cy - 14 + b }));
    eye(cx - 52).forEach((p, i) => { pts[36 + i] = p; });
    eye(cx + 26).forEach((p, i) => { pts[42 + i] = p; });
    const box = { x: cx - 70, y: cy - 70, width: 140, height: 170 };
    return { img, box, points: pts };
}
const run = (p) => Object.fromEntries([...pc.evaluateFace({ box: p.box, points: p.points }, W, H), ...pc.evaluatePixels(p.img, p.box, p.points)].map((c) => [c.id, c]));

test('a centred, plain-background portrait passes framing, forehead and held-object checks', () => {
    const r = run(person());
    assert.equal(r.framing.pass, true);
    assert.equal(r.headwear.pass, true);
    assert.equal(r.held.pass, true);
    assert.equal(r.background.pass, true);
});

test('a face that is off to one side fails framing and says which way to move', () => {
    const r = run(person(256));            // centre ≈ 0.64 of the width — the case that used to pass
    assert.equal(r.framing.pass, false);
    assert.match(r.framing.fix, /move left/i);
    const l = run(person(150));
    assert.equal(l.framing.pass, false);
    assert.match(l.framing.fix, /move right/i);
});

test('a cap pulled down over the forehead fails the forehead check', () => {
    const r = run(person(200, 190, { cap: true }));
    assert.equal(r.headwear.pass, false);
});

test('a hand / arm raised in front of the body fails the held-object check', () => {
    const p = person();
    ellipse(p.img, 110, 410, 40, 55, SKIN);
    assert.equal(run(p).held.pass, false);
});

test('a bright card covered in printed detail fails the held-object check', () => {
    const p = person();
    rect(p.img, 40, 360, 200, 470, [235, 235, 240]);
    for (let y = 366; y < 466; y += 6) for (let x = 46; x < 196; x += 2) if ((x / 2 + y) % 3) rect(p.img, x, y, x + 2, y + 2, [40, 40, 60]);
    assert.equal(run(p).held.pass, false);
});

test('a busy background (dark door / poster behind the person) fails the background check', () => {
    const p = person();
    rect(p.img, 0, 0, 90, 300, [20, 20, 20]);
    assert.equal(run(p).background.pass, false);
});

test('AI and editing tags are found in file metadata', () => {
    const enc = (t) => new TextEncoder().encode(`\xff\xd8 ${t} \x00data`);
    assert.ok(pc.scanForAiMarkers(enc('DigitalSourceType trainedAlgorithmicMedia')).length);
    assert.ok(pc.scanForEditMarkers(enc('Software: Adobe Photoshop 25.0')).length);
    assert.ok(pc.scanForEditMarkers(enc('Software: FaceApp')).length);
    // the generic header found in many ordinary JPEGs must not count as "edited"
    assert.equal(pc.scanForEditMarkers(enc('JFIF Photoshop 3.0 8BIM')).length, 0);
    assert.equal(pc.scanForAiMarkers(enc('Make: samsung Model: SM-A546E')).length, 0);
    assert.equal(pc.scanForEditMarkers(enc('Make: samsung Model: SM-A546E')).length, 0);
});

test('bare arms entering the frame at the bottom corners do not fail the held-object check', () => {
    const p = person();
    ellipse(p.img, 15, 480, 30, 40, SKIN);     // left forearm, outer edge, bottom of the frame
    ellipse(p.img, W - 15, 470, 30, 45, SKIN); // right forearm, outer edge, bottom of the frame
    assert.equal(run(p).held.pass, true);
});

test('a cut-out photo with a transparent background fails with a specific message', () => {
    const p = person();
    const { data, width, height } = p.img;
    const bandX = Math.round(width * 0.14); const bandTop = Math.round(height * 0.08);
    for (let y = 0; y < Math.round(height * 0.55); y++) {
        for (let x = 0; x < width; x++) {
            if (y < bandTop || x < bandX || x >= width - bandX) { const i = (y * width + x) * 4; data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0; }
        }
    }
    const r = run(p);
    assert.equal(r.background.pass, false);
    assert.match(r.background.fix, /transparent/i);
});

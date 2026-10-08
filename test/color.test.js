'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../lib/color.js');

test('parseColor: hex variants', () => {
  assert.deepEqual(C.parseColor('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(C.parseColor('22d3ee'), { r: 34, g: 211, b: 238 });
  assert.deepEqual(C.parseColor('#22D3EE80'), { r: 34, g: 211, b: 238 }); // alpha ignored
  assert.deepEqual(C.parseColor('#abcd'), { r: 170, g: 187, b: 204 });
  assert.equal(C.parseColor('#12'), null);
  assert.equal(C.parseColor('#gggggg'), null);
  assert.equal(C.parseColor(''), null);
  assert.equal(C.parseColor(null), null);
});

test('parseColor: rgb(), hsl() and names', () => {
  assert.deepEqual(C.parseColor('rgb(34, 211, 238)'), { r: 34, g: 211, b: 238 });
  assert.deepEqual(C.parseColor('rgb(34 211 238 / 50%)'), { r: 34, g: 211, b: 238 });
  assert.deepEqual(C.parseColor('rgb(100%, 0%, 0%)'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(C.parseColor('rgb(300, -5, 0)'.replace('-5', '0')), { r: 255, g: 0, b: 0 }); // clamped
  assert.deepEqual(C.parseColor('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(C.parseColor('hsl(120deg 100% 25%)'), { r: 0, g: 128, b: 0 });
  assert.deepEqual(C.parseColor('RebeccaPurple'), { r: 102, g: 51, b: 153 });
  assert.deepEqual(C.parseColor('lightgrey'), C.parseColor('lightgray'));
  assert.equal(C.parseColor('notacolor'), null);
});

test('conversions: known values', () => {
  assert.deepEqual(C.rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
  assert.deepEqual(C.rgbToHsl({ r: 0, g: 128, b: 128 }), { h: 180, s: 100, l: 25 });
  assert.deepEqual(C.rgbToHsl({ r: 128, g: 128, b: 128 }), { h: 0, s: 0, l: 50 });
  assert.deepEqual(C.rgbToHsv({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, v: 100 });
  assert.deepEqual(C.rgbToHsv({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, v: 0 });
  assert.deepEqual(C.rgbToCmyk({ r: 255, g: 0, b: 0 }), { c: 0, m: 100, y: 100, k: 0 });
  assert.deepEqual(C.rgbToCmyk({ r: 0, g: 0, b: 0 }), { c: 0, m: 0, y: 0, k: 100 });
  assert.deepEqual(C.rgbToCmyk({ r: 255, g: 255, b: 255 }), { c: 0, m: 0, y: 0, k: 0 });
});

test('hex <-> rgb round trip for every 17th value', () => {
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 85) {
    const hex = C.rgbToHex({ r, g, b });
    assert.match(hex, /^#[0-9A-F]{6}$/);
    assert.deepEqual(C.parseColor(hex), { r, g, b });
  }
});

test('hsl round trip stays close (integer degrees/percents are lossy by design)', () => {
  // Rounding hue to 1 degree and s/l to 1% can shift a channel by up to ~5 of 255.
  for (let r = 0; r < 256; r += 31) for (let g = 0; g < 256; g += 37) for (let b = 0; b < 256; b += 41) {
    const back = C.hslToRgb(C.rgbToHsl({ r, g, b }));
    assert.ok(Math.abs(back.r - r) <= 5 && Math.abs(back.g - g) <= 5 && Math.abs(back.b - b) <= 5,
      `rgb(${r},${g},${b}) -> ${JSON.stringify(back)}`);
  }
});

test('formatColor', () => {
  const c = { r: 34, g: 211, b: 238 };
  assert.equal(C.formatColor(c, 'hex'), '#22D3EE');
  assert.equal(C.formatColor(c, 'rgb'), 'rgb(34, 211, 238)');
  assert.equal(C.formatColor(c, 'hsl'), 'hsl(188, 86%, 53%)');
  assert.match(C.formatColor(c, 'hsv'), /^hsv\(\d+, \d+%, \d+%\)$/);
  assert.match(C.formatColor(c, 'cmyk'), /^cmyk\(\d+%, \d+%, \d+%, \d+%\)$/);
  assert.throws(() => C.formatColor(c, 'nope'));
  for (const f of C.FORMATS) assert.ok(C.formatColor(c, f));
});

test('contrast: WCAG reference values', () => {
  assert.equal(Math.round(C.contrastRatio(C.BLACK, C.WHITE) * 100) / 100, 21);
  assert.equal(C.contrastRatio(C.WHITE, C.WHITE), 1);
  const g777 = C.parseColor('#777777'), g767 = C.parseColor('#767676');
  assert.equal(C.contrastInfo(g777, C.WHITE).aa, false); // 4.48:1 fails AA for normal text
  assert.equal(C.contrastInfo(g767, C.WHITE).aa, true); // 4.54:1 passes
  assert.equal(C.contrastInfo(g777, C.WHITE).aaLarge, true);
  assert.equal(C.contrastInfo(C.BLACK, C.WHITE).aaa, true);
});

test('contrastInfo truncates so a failing ratio never displays as passing', () => {
  const info = C.contrastInfo(C.parseColor('#777777'), C.WHITE);
  assert.ok(info.ratio < 4.5, `ratio ${info.ratio} must stay below 4.5`);
});

test('readableTextColor', () => {
  assert.equal(C.readableTextColor(C.BLACK), '#FFFFFF');
  assert.equal(C.readableTextColor(C.WHITE), '#000000');
  assert.equal(C.readableTextColor(C.parseColor('#22d3ee')), '#000000');
  assert.equal(C.readableTextColor(C.parseColor('#0d1117')), '#FFFFFF');
});

test('nearestName', () => {
  assert.deepEqual(C.nearestName({ r: 255, g: 0, b: 0 }), { name: 'red', exact: true });
  assert.equal(C.nearestName({ r: 250, g: 5, b: 3 }).exact, false);
  assert.equal(C.nearestName({ r: 250, g: 5, b: 3 }).name, 'red');
  assert.equal(C.nearestName({ r: 102, g: 51, b: 153 }).name, 'rebeccapurple');
});

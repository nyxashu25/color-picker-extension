/*
 * Color utilities: parsing, conversion, formatting, WCAG contrast and CSS color names.
 * Pure functions with no DOM or extension APIs, so they run in the popup and under Node tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ColorLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // CSS Color Module Level 4 named colors (hex without '#').
  var NAMED = {
    aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff',
    beige: 'f5f5dc', bisque: 'ffe4c4', black: '000000', blanchedalmond: 'ffebcd', blue: '0000ff',
    blueviolet: '8a2be2', brown: 'a52a2a', burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00',
    chocolate: 'd2691e', coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c',
    cyan: '00ffff', darkblue: '00008b', darkcyan: '008b8b', darkgoldenrod: 'b8860b', darkgray: 'a9a9a9',
    darkgreen: '006400', darkkhaki: 'bdb76b', darkmagenta: '8b008b', darkolivegreen: '556b2f',
    darkorange: 'ff8c00', darkorchid: '9932cc', darkred: '8b0000', darksalmon: 'e9967a',
    darkseagreen: '8fbc8f', darkslateblue: '483d8b', darkslategray: '2f4f4f', darkturquoise: '00ced1',
    darkviolet: '9400d3', deeppink: 'ff1493', deepskyblue: '00bfff', dimgray: '696969',
    dodgerblue: '1e90ff', firebrick: 'b22222', floralwhite: 'fffaf0', forestgreen: '228b22',
    fuchsia: 'ff00ff', gainsboro: 'dcdcdc', ghostwhite: 'f8f8ff', gold: 'ffd700', goldenrod: 'daa520',
    gray: '808080', green: '008000', greenyellow: 'adff2f', honeydew: 'f0fff0', hotpink: 'ff69b4',
    indianred: 'cd5c5c', indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa',
    lavenderblush: 'fff0f5', lawngreen: '7cfc00', lemonchiffon: 'fffacd', lightblue: 'add8e6',
    lightcoral: 'f08080', lightcyan: 'e0ffff', lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3',
    lightgreen: '90ee90', lightpink: 'ffb6c1', lightsalmon: 'ffa07a', lightseagreen: '20b2aa',
    lightskyblue: '87cefa', lightslategray: '778899', lightsteelblue: 'b0c4de', lightyellow: 'ffffe0',
    lime: '00ff00', limegreen: '32cd32', linen: 'faf0e6', magenta: 'ff00ff', maroon: '800000',
    mediumaquamarine: '66cdaa', mediumblue: '0000cd', mediumorchid: 'ba55d3', mediumpurple: '9370db',
    mediumseagreen: '3cb371', mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a',
    mediumturquoise: '48d1cc', mediumvioletred: 'c71585', midnightblue: '191970', mintcream: 'f5fffa',
    mistyrose: 'ffe4e1', moccasin: 'ffe4b5', navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6',
    olive: '808000', olivedrab: '6b8e23', orange: 'ffa500', orangered: 'ff4500', orchid: 'da70d6',
    palegoldenrod: 'eee8aa', palegreen: '98fb98', paleturquoise: 'afeeee', palevioletred: 'db7093',
    papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f', pink: 'ffc0cb', plum: 'dda0dd',
    powderblue: 'b0e0e6', purple: '800080', rebeccapurple: '663399', red: 'ff0000', rosybrown: 'bc8f8f',
    royalblue: '4169e1', saddlebrown: '8b4513', salmon: 'fa8072', sandybrown: 'f4a460',
    seagreen: '2e8b57', seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0', skyblue: '87ceeb',
    slateblue: '6a5acd', slategray: '708090', snow: 'fffafa', springgreen: '00ff7f', steelblue: '4682b4',
    tan: 'd2b48c', teal: '008080', thistle: 'd8bfd8', tomato: 'ff6347', turquoise: '40e0d0',
    violet: 'ee82ee', wheat: 'f5deb3', white: 'ffffff', whitesmoke: 'f5f5f5', yellow: 'ffff00',
    yellowgreen: '9acd32'
  };
  var NAMED_LIST = Object.keys(NAMED).map(function (name) {
    var n = parseInt(NAMED[name], 16);
    return { name: name, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  });

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function byte(n) { return clamp(Math.round(n), 0, 255); }
  function toRgb(c) { return { r: byte(c.r), g: byte(c.g), b: byte(c.b) }; }

  /** Parses #rgb, #rgba, #rrggbb, #rrggbbaa (with or without '#'), rgb(), hsl() and CSS names. Alpha is ignored. */
  function parseColor(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim().toLowerCase();
    if (!s) return null;

    var m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(function (ch) { return ch + ch; }).join('');
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }

    m = /^rgba?\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(%?)(?:[\s,/]+[\d.]+%?)?\s*\)$/.exec(s);
    if (m) {
      var ch = [[m[1], m[2]], [m[3], m[4]], [m[5], m[6]]].map(function (p) {
        var v = parseFloat(p[0]);
        return p[1] === '%' ? (v / 100) * 255 : v;
      });
      return toRgb({ r: ch[0], g: ch[1], b: ch[2] });
    }

    m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+[\d.]+%?)?\s*\)$/.exec(s);
    if (m) return hslToRgb({ h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) });

    var named = NAMED[s.replace(/grey/g, 'gray')];
    if (named) return parseColor('#' + named);
    return null;
  }

  function pad2(n) { return (n < 16 ? '0' : '') + n.toString(16); }

  function rgbToHex(c) {
    c = toRgb(c);
    return ('#' + pad2(c.r) + pad2(c.g) + pad2(c.b)).toUpperCase();
  }

  function rgbToHsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2, h = 0, s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(c) {
    var h = (((c.h % 360) + 360) % 360) / 360, s = clamp(c.s, 0, 100) / 100, l = clamp(c.l, 0, 100) / 100;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function hue(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    if (s === 0) return toRgb({ r: l * 255, g: l * 255, b: l * 255 });
    return toRgb({ r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 });
  }

  function rgbToHsv(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: Math.round(h) % 360, s: Math.round((max === 0 ? 0 : d / max) * 100), v: Math.round(max * 100) };
  }

  function rgbToCmyk(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1 - r - k) / (1 - k)) * 100),
      m: Math.round(((1 - g - k) / (1 - k)) * 100),
      y: Math.round(((1 - b - k) / (1 - k)) * 100),
      k: Math.round(k * 100)
    };
  }

  var FORMATS = ['hex', 'rgb', 'hsl', 'hsv', 'cmyk'];

  function formatColor(c, format) {
    c = toRgb(c);
    switch (format) {
      case 'hex': return rgbToHex(c);
      case 'rgb': return 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')';
      case 'hsl': var l = rgbToHsl(c); return 'hsl(' + l.h + ', ' + l.s + '%, ' + l.l + '%)';
      case 'hsv': var v = rgbToHsv(c); return 'hsv(' + v.h + ', ' + v.s + '%, ' + v.v + '%)';
      case 'cmyk': var k = rgbToCmyk(c); return 'cmyk(' + k.c + '%, ' + k.m + '%, ' + k.y + '%, ' + k.k + '%)';
      default: throw new Error('Unknown format: ' + format);
    }
  }

  // WCAG 2.x relative luminance and contrast ratio.
  function relativeLuminance(c) {
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  }

  function contrastRatio(a, b) {
    var la = relativeLuminance(a), lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Ratio is truncated (not rounded) to 2 decimals so a value that fails a threshold never displays as passing. */
  function contrastInfo(a, b) {
    var ratio = contrastRatio(a, b);
    return {
      ratio: Math.floor(ratio * 100) / 100,
      aa: ratio >= 4.5,
      aaa: ratio >= 7,
      aaLarge: ratio >= 3,
      aaaLarge: ratio >= 4.5
    };
  }

  var WHITE = { r: 255, g: 255, b: 255 }, BLACK = { r: 0, g: 0, b: 0 };

  function readableTextColor(c) {
    return contrastRatio(c, WHITE) >= contrastRatio(c, BLACK) ? '#FFFFFF' : '#000000';
  }

  function nearestName(c) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < NAMED_LIST.length; i++) {
      var n = NAMED_LIST[i];
      var d = (n.r - c.r) * (n.r - c.r) + (n.g - c.g) * (n.g - c.g) + (n.b - c.b) * (n.b - c.b);
      if (d < bestD) { bestD = d; best = n; }
    }
    return { name: best.name, exact: bestD === 0 };
  }

  return {
    FORMATS: FORMATS, WHITE: WHITE, BLACK: BLACK,
    parseColor: parseColor, rgbToHex: rgbToHex, rgbToHsl: rgbToHsl, hslToRgb: hslToRgb,
    rgbToHsv: rgbToHsv, rgbToCmyk: rgbToCmyk, formatColor: formatColor,
    relativeLuminance: relativeLuminance, contrastRatio: contrastRatio, contrastInfo: contrastInfo,
    readableTextColor: readableTextColor, nearestName: nearestName
  };
});

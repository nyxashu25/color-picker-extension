(function () {
  'use strict';

  var C = window.ColorLib;
  var MAX_HISTORY = 24;
  var DEFAULT_COLOR = { r: 34, g: 211, b: 238 };
  var LABELS = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', hsv: 'HSV', cmyk: 'CMYK' };

  var $ = function (id) { return document.getElementById(id); };
  var hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  // chrome.storage.local in the extension, localStorage when the page is opened as a plain web page.
  var store = {
    get: function (keys) {
      if (hasChromeStorage) return chrome.storage.local.get(keys);
      return Promise.resolve().then(function () {
        var out = {};
        keys.forEach(function (k) {
          try { var v = localStorage.getItem('cp:' + k); if (v !== null) out[k] = JSON.parse(v); } catch (e) { /* ignore */ }
        });
        return out;
      });
    },
    set: function (obj) {
      if (hasChromeStorage) return chrome.storage.local.set(obj);
      return Promise.resolve().then(function () {
        Object.keys(obj).forEach(function (k) {
          try { localStorage.setItem('cp:' + k, JSON.stringify(obj[k])); } catch (e) { /* ignore */ }
        });
      });
    }
  };

  var state = { color: DEFAULT_COLOR, history: [], format: 'hex', autoCopy: true };
  var msgTimer = null;

  function message(text, isError) {
    var el = $('msg');
    el.textContent = text;
    el.className = 'msg' + (isError ? ' error' : '');
    clearTimeout(msgTimer);
    if (text) msgTimer = setTimeout(function () { el.textContent = ''; }, 2600);
  }

  function copyText(text) {
    function fallback() {
      return new Promise(function (resolve) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        resolve(ok);
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return fallback();
  }

  function saveHistory() { return store.set({ history: state.history }); }

  function remember(rgb) {
    var hex = C.rgbToHex(rgb);
    state.history = [hex].concat(state.history.filter(function (h) { return h !== hex; })).slice(0, MAX_HISTORY);
    saveHistory();
  }

  function setColor(rgb, opts) {
    opts = opts || {};
    state.color = rgb;
    if (opts.record) remember(rgb);
    render(opts);
  }

  function renderFormats() {
    var ul = $('formats');
    ul.textContent = '';
    C.FORMATS.forEach(function (f) {
      var text = C.formatColor(state.color, f);
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fmt';
      b.setAttribute('aria-pressed', String(state.format === f));
      b.setAttribute('aria-label', 'Copy ' + LABELS[f] + ' value ' + text);
      [['k', LABELS[f]], ['v', text], ['c', 'Copy']].forEach(function (pair) {
        var s = document.createElement('span');
        s.className = pair[0];
        s.textContent = pair[1];
        b.appendChild(s);
      });
      b.addEventListener('click', function () {
        state.format = f;
        store.set({ format: f });
        copyText(text).then(function (ok) {
          message(ok ? 'Copied ' + text : 'Could not access the clipboard', !ok);
        });
        renderFormats();
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function renderContrast() {
    var box = $('contrast');
    box.textContent = '';
    [['White text', C.WHITE, '#ffffff'], ['Black text', C.BLACK, '#000000']].forEach(function (t) {
      var info = C.contrastInfo(state.color, t[1]);
      var tile = document.createElement('div');
      tile.className = 'tile';
      tile.style.background = C.rgbToHex(state.color);
      tile.style.color = t[2];
      var big = document.createElement('div'); big.className = 'big'; big.textContent = 'Aa';
      var ratio = document.createElement('div'); ratio.className = 'ratio'; ratio.textContent = t[0] + ' · ' + info.ratio.toFixed(2) + ':1';
      var badges = document.createElement('div'); badges.className = 'badges';
      [['AA', info.aa], ['AAA', info.aaa], ['AA large', info.aaLarge]].forEach(function (b) {
        var s = document.createElement('span');
        s.className = 'badge' + (b[1] ? '' : ' fail');
        s.textContent = b[0];
        s.setAttribute('aria-label', b[0] + (b[1] ? ' passes' : ' fails'));
        badges.appendChild(s);
      });
      tile.appendChild(big); tile.appendChild(ratio); tile.appendChild(badges);
      box.appendChild(tile);
    });
  }

  function renderHistory() {
    var box = $('history');
    box.textContent = '';
    var current = C.rgbToHex(state.color);
    state.history.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.style.background = hex;
      b.title = hex;
      b.setAttribute('aria-label', 'Use color ' + hex);
      if (hex === current) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () { setColor(C.parseColor(hex), {}); });
      box.appendChild(b);
    });
    $('empty').hidden = state.history.length > 0;
    $('clear').hidden = state.history.length === 0;
  }

  function render(opts) {
    opts = opts || {};
    var hex = C.rgbToHex(state.color);
    $('swatch').style.background = hex;
    if (!opts.keepInput) { $('value').value = hex; $('value').removeAttribute('aria-invalid'); }
    $('native').value = hex.toLowerCase();
    var n = C.nearestName(state.color);
    $('name').textContent = n.exact ? 'CSS name: ' + n.name : 'Nearest CSS name: ' + n.name;
    renderFormats();
    renderContrast();
    renderHistory();
  }

  function pick() {
    if (!('EyeDropper' in window)) {
      message('This browser has no eyedropper. Use the palette or type a color.', true);
      return;
    }
    var btn = $('pick');
    btn.disabled = true;
    new window.EyeDropper().open().then(function (result) {
      var rgb = C.parseColor(result.sRGBHex);
      if (!rgb) throw new Error('Unexpected color value');
      setColor(rgb, { record: true });
      if (state.autoCopy) {
        var text = C.formatColor(rgb, state.format);
        return copyText(text).then(function (ok) { message(ok ? 'Copied ' + text : 'Picked ' + text); });
      }
      message('Picked ' + C.rgbToHex(rgb));
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return; // user pressed Esc
      message('Eyedropper failed: ' + (err && err.message ? err.message : err), true);
    }).then(function () { btn.disabled = false; });
  }

  function wire() {
    $('pick').addEventListener('click', pick);

    var input = $('value');
    function commit() {
      var rgb = C.parseColor(input.value);
      if (!rgb) { input.setAttribute('aria-invalid', 'true'); message('Not a valid color', true); return; }
      setColor(rgb, { record: true });
    }
    input.addEventListener('change', commit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
    input.addEventListener('input', function () { input.removeAttribute('aria-invalid'); });

    var native = $('native');
    native.addEventListener('input', function () { setColor(C.parseColor(native.value), { keepInput: false }); });
    native.addEventListener('change', function () { setColor(C.parseColor(native.value), { record: true }); });

    $('clear').addEventListener('click', function () {
      state.history = [];
      saveHistory();
      renderHistory();
    });

    $('autoCopy').addEventListener('change', function (e) {
      state.autoCopy = e.target.checked;
      store.set({ autoCopy: state.autoCopy });
    });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey && tag !== 'INPUT' && tag !== 'TEXTAREA') pick();
    });

    if (!('EyeDropper' in window)) {
      $('pick').title = 'The eyedropper needs Chrome 95 or newer';
    }
  }

  store.get(['history', 'format', 'autoCopy']).then(function (saved) {
    if (Array.isArray(saved.history)) {
      state.history = saved.history.filter(function (h) { return typeof h === 'string' && C.parseColor(h); }).slice(0, MAX_HISTORY);
    }
    if (C.FORMATS.indexOf(saved.format) !== -1) state.format = saved.format;
    if (typeof saved.autoCopy === 'boolean') state.autoCopy = saved.autoCopy;
    $('autoCopy').checked = state.autoCopy;
    var start = state.history.length ? C.parseColor(state.history[0]) : DEFAULT_COLOR;
    state.color = start || DEFAULT_COLOR;
    wire();
    render();
  });
})();

'use strict';
// Runs the real service worker in a sandbox with a stubbed chrome API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function boot(setPanelBehavior) {
  let onInstalled;
  const chrome = {
    runtime: { onInstalled: { addListener: (f) => { onInstalled = f; } } },
    sidePanel: { setPanelBehavior }
  };
  const errors = [];
  vm.runInContext(source, vm.createContext({ chrome, console: { error: (...a) => errors.push(a) } }), { filename: 'background.js' });
  return { fire: () => onInstalled(), errors };
}

test('opens the side panel when the toolbar icon is clicked', async () => {
  const seen = [];
  const { fire } = boot(async (opts) => { seen.push(opts); });
  fire();
  await new Promise((r) => setImmediate(r));
  // Objects created inside the vm sandbox have a different prototype, so compare as plain JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(seen)), [{ openPanelOnActionClick: true }]);
});

test('a failure to configure the panel is logged, not thrown', async () => {
  const { fire, errors } = boot(async () => { throw new Error('nope'); });
  fire();
  await new Promise((r) => setImmediate(r));
  assert.equal(errors.length, 1);
});

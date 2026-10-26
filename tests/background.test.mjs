import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../background.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

async function extension(initial = {}) {
  const state = { ...initial };
  const action = {};
  let clicked;
  let changed;
  const chrome = {
    action: {
      onClicked: { addListener(fn) { clicked = fn; } },
      async setBadgeText({ text }) { action.badge = text; },
      async setBadgeBackgroundColor() {},
      async setTitle({ title }) { action.title = title; },
    },
    storage: {
      local: {
        async get() { return { ...state }; },
        async set(values) {
          const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]));
          Object.assign(state, values);
          changed(changes, 'local');
        },
      },
      onChanged: { addListener(fn) { changed = fn; } },
    },
  };
  runInNewContext(source, { chrome });
  await new Promise(resolve => setImmediate(resolve));
  return { state, action, clicked, externalSet: async values => {
    await chrome.storage.local.set(values);
    await new Promise(resolve => setImmediate(resolve));
  } };
}

test('toolbar opens shared settings without changing placement and keeps full Options available', async () => {
  const app = await extension();
  const popup = new URL(manifest.action.default_popup, 'https://extension.invalid/');
  assert.equal(popup.pathname, `/${manifest.options_ui.page}`);
  assert.equal(popup.searchParams.has('popup'), true);
  assert.equal(manifest.options_ui.open_in_tab, true);
  assert.equal(app.clicked, undefined);
  assert.deepEqual(app.state, {});
  assert.equal(app.action.badge, 'R');
  assert.match(app.action.title, /right.*Click to open settings/);
  await app.externalSet({ right: false });
  assert.equal(app.state.right, false);
  assert.equal(app.action.badge, 'L');
  assert.match(app.action.title, /left.*Click to open settings/);
  await app.externalSet({ right: true });
  assert.equal(app.state.right, true);
  assert.equal(app.action.badge, 'R');
});

test('toolbar restores saved left mode and reflects changes from another context', async () => {
  const app = await extension({ right: false, rightWidth: 380 });
  assert.equal(app.action.badge, 'L');
  await app.externalSet({ right: true });
  assert.equal(app.action.badge, 'R');
  assert.equal(app.state.rightWidth, 380);
});

test('legacy master state cannot disable sidebar placement or change other preferences', async () => {
  const app = await extension({ enabled: false, right: false, rightWidth: 380 });
  assert.equal(app.action.badge, 'L');
  assert.match(app.action.title, /left.*Click to open settings/);
  await app.externalSet({ right: true });
  assert.equal(app.state.right, true);
  assert.equal(app.state.rightWidth, 380);
  assert.equal(app.state.enabled, false);
  assert.equal(app.action.badge, 'R');
  await app.externalSet({ right: false });
  assert.equal(app.state.right, false);
});

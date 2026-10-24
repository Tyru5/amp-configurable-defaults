import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../background.js', import.meta.url), 'utf8');

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
  return { state, action, click: () => clicked(), externalSet: async values => {
    await chrome.storage.local.set(values);
    await new Promise(resolve => setImmediate(resolve));
  } };
}

test('toolbar defaults right and alternates persisted preference and accessible title', async () => {
  const app = await extension();
  assert.equal(app.action.badge, 'R');
  assert.match(app.action.title, /right.*Click to move left/);
  await app.click();
  assert.equal(app.state.right, false);
  assert.equal(app.action.badge, 'L');
  assert.match(app.action.title, /left.*Click to move right/);
  await app.click();
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
  assert.match(app.action.title, /left.*Click to move right/);
  await app.click();
  assert.equal(app.state.right, true);
  assert.equal(app.state.rightWidth, 380);
  assert.equal(app.state.enabled, false);
  assert.equal(app.action.badge, 'R');
  await app.click();
  assert.equal(app.state.right, false);
});

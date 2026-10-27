import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../background.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

async function extension(initial = {}, beforeUpdate = async () => {}) {
  const state = { ...initial };
  const action = {};
  let clicked;
  let changed;
  let messageListener;
  let tabRemoved;
  const rules = new Map();
  const chrome = {
    runtime: { onMessage: { addListener(fn) { messageListener = fn; } } },
    tabs: { onRemoved: { addListener(fn) { tabRemoved = fn; } } },
    declarativeNetRequest: {
      async updateSessionRules({ removeRuleIds, addRules }) {
        await beforeUpdate();
        for (const id of removeRuleIds) rules.delete(id);
        for (const rule of addRules) rules.set(rule.id, JSON.parse(JSON.stringify(rule)));
      },
    },
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
  runInNewContext(source, { chrome, crypto: webcrypto });
  await new Promise(resolve => setImmediate(resolve));
  return { state, action, clicked, rules, tabRemoved,
    message: (message, sender = { frameId: 0, tab: { id: 17 }, url: 'https://ampcode.com/threads/current' }) =>
      new Promise(resolve => messageListener(message, sender, resolve)),
    externalSet: async values => {
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

const open = { type: 'amp-thread-split-open', threadID: 'T-01234567-89ab-cdef-0123-456789abcdef' };
const close = { type: 'amp-thread-split-close' };

test('embedding permission matches only the requested frame URL, originating site, and tab', async () => {
  const app = await extension();
  const result = await app.message(open);
  assert.equal(result.ok, true);
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://ampcode.com');
  assert.equal(url.pathname, `/threads/${open.threadID}`);
  assert.match(url.searchParams.get('amp-thread-split'), /^[\da-f-]{36}$/);
  const rule = app.rules.get(17);
  assert.deepEqual(rule.condition, {
    tabIds: [17], initiatorDomains: ['ampcode.com'], resourceTypes: ['sub_frame'],
    urlFilter: `|${result.url}|`,
  });
  assert.deepEqual(rule.action, {
    type: 'modifyHeaders', responseHeaders: [
      { header: 'x-frame-options', operation: 'remove' },
      { header: 'content-security-policy', operation: 'remove' },
    ],
  });
  const second = await app.message(open, { frameId: 0, tab: { id: 28 }, url: 'https://ampcode.com/threads/other' });
  assert.notEqual(second.url, result.url);
  await app.message(close);
  assert.equal(app.rules.has(17), false);
  assert.equal(app.rules.has(28), true);
  app.tabRemoved(28);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.rules.size, 0);
});

test('untrusted senders and malformed thread IDs cannot change framing rules', async () => {
  const app = await extension();
  for (const threadID of ['../../settings', `${open.threadID}?anything=*`, null]) {
    assert.match((await app.message({ ...open, threadID })).error, /Invalid/);
  }
  for (const sender of [
    { frameId: 1, tab: { id: 17 }, url: 'https://ampcode.com/threads/current' },
    { frameId: 0, tab: { id: 17 }, url: 'https://ampcode.com.evil.test/' },
    { frameId: 0, tab: { id: -1 }, url: 'https://ampcode.com/' },
    { frameId: 0, url: 'https://ampcode.com/' },
  ]) assert.match((await app.message(open, sender)).error, /Invalid/);
  assert.equal(app.rules.size, 0);
});

test('closing during an in-flight open removes its rule, and failures allow retry', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const app = await extension({}, () => pending);
  const opening = app.message(open);
  const closing = app.message(close);
  finish();
  await Promise.all([opening, closing]);
  assert.equal(app.rules.size, 0);
  let fail = true;
  const retry = await extension({}, async () => { if (fail) throw new Error('permission denied'); });
  assert.match((await retry.message(open)).error, /access/);
  assert.equal(retry.rules.size, 0);
  fail = false;
  assert.equal((await retry.message(open)).ok, true);
  assert.equal(retry.rules.size, 1);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../options.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const features = ['right', 'resizeSidebar', 'moveViews', 'indentThreads', 'showHeaderToggle', 'subagentPanel', 'showComposerContext'];

function options(search = '', openOptionsPage = async () => {}) {
  const controls = Object.fromEntries(['enabled', ...features, 'hideSidebarFooter', 'status', 'open-options'].map(id => [id, {
    checked: id === 'enabled', disabled: true, textContent: '', hidden: true,
    addEventListener(type, fn) { this[type] = fn; },
  }]));
  const window = { closed: false, close() { this.closed = true; } };
  let resolveRead, rejectRead, changed, save;
  const read = new Promise((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
  const writes = [];
  runInNewContext(source, {
    URLSearchParams,
    location: { search },
    window,
    document: {
      documentElement: { classList: { add() {} } },
      querySelector: selector => controls[selector.slice(1)],
    },
    chrome: { runtime: { openOptionsPage }, storage: {
      local: {
        get: () => read,
        set: values => { writes.push({ ...values }); return save?.(); },
      },
      onChanged: { addListener(fn) { changed = fn; } },
    } },
  });
  return { controls, writes, resolveRead, rejectRead, window,
    setSave: fn => { save = fn; },
    external: (key, newValue, area = 'local') => changed({ [key]: { newValue } }, area),
  };
}

test('Options defaults footer visible, saves opt-in, and restores it independently of side', async () => {
  const app = options();
  app.resolveRead({});
  await tick();
  assert.equal(app.controls['open-options'].hidden, true);
  const { right, hideSidebarFooter: footer, status } = app.controls;
  assert.equal(right.checked, true);
  assert.equal(footer.checked, false);
  assert.equal(footer.disabled, false);
  footer.checked = true;
  await footer.change();
  assert.deepEqual(app.writes, [{ hideSidebarFooter: true }]);
  assert.equal(status.textContent, 'Saved.');
  app.external('right', false);
  assert.equal(right.checked, false);
  assert.equal(footer.checked, true);
  assert.equal(footer.disabled, false);
  footer.checked = false;
  await footer.change();
  assert.deepEqual(app.writes[1], { hideSidebarFooter: false });
});

test('pending initial read merges storage changes per preference, including removal', async () => {
  const app = options();
  app.external('right', false);
  app.external('hideSidebarFooter', true, 'sync');
  app.resolveRead({ right: true, hideSidebarFooter: true });
  await tick();
  assert.equal(app.controls.right.checked, false);
  assert.equal(app.controls.hideSidebarFooter.checked, true);
  app.external('hideSidebarFooter', undefined);
  assert.equal(app.controls.hideSidebarFooter.checked, false);
  app.external('right', undefined);
  assert.equal(app.controls.right.checked, true);
});

test('failed saves restore the prior checkbox unless another tab changed that preference', async () => {
  const app = options();
  app.resolveRead({});
  await tick();
  const footer = app.controls.hideSidebarFooter;
  app.setSave(() => Promise.reject(new Error('unavailable')));
  footer.checked = true;
  await footer.change();
  assert.equal(footer.checked, false);
  assert.equal(footer.disabled, false);
  assert.match(app.controls.status.textContent, /Could not save/);
  let reject;
  app.setSave(() => new Promise((_, fail) => { reject = fail; }));
  footer.checked = true;
  const saving = footer.change();
  assert.equal(footer.disabled, true);
  app.external('hideSidebarFooter', true);
  reject(new Error('unavailable'));
  await saving;
  assert.equal(footer.checked, true);
});

test('failed reads keep all controls disabled and announce recovery', async () => {
  const app = options();
  app.rejectRead(new Error('unavailable'));
  await tick();
  for (const key of ['enabled', ...features, 'hideSidebarFooter']) {
    assert.equal(app.controls[key].disabled, true, key);
  }
  assert.match(app.controls.status.textContent, /Reopen this page/);
});

test('every feature saves with right placement off, ignoring the legacy master setting', async () => {
  const app = options();
  app.external('moveViews', false);
  app.resolveRead({ enabled: false, right: false, rightWidth: 380 });
  await tick();
  for (const key of features.filter(key => key !== 'right')) {
    const control = app.controls[key];
    assert.equal(control.checked, key !== 'moveViews', key);
    assert.equal(control.disabled, false, key);
    control.checked = false;
    await control.change();
    assert.deepEqual(app.writes.at(-1), { [key]: false });
    app.external(key, undefined);
    assert.equal(control.checked, true, key);
    app.external(key, false);
    assert.equal(control.checked, false, key);
    assert.equal(app.controls.right.checked, false);
  }
  assert.equal(app.controls.enabled.change, undefined, 'legacy master is not an Options control');
});

test('popup saves every setting, receives external changes, and opens the full Options page', async () => {
  let opened = false;
  const app = options('?popup', async () => { opened = true; });
  app.resolveRead({ right: false, hideSidebarFooter: true });
  await tick();
  assert.equal(app.controls.right.checked, false);
  assert.equal(app.controls.hideSidebarFooter.checked, true);
  for (const key of [...features, 'hideSidebarFooter']) {
    const toggle = app.controls[key];
    const next = !toggle.checked;
    toggle.checked = next;
    await toggle.change();
    assert.deepEqual(app.writes.at(-1), { [key]: next });
    app.external(key, !next);
    assert.equal(toggle.checked, !next);
  }
  assert.equal(app.controls['open-options'].hidden, false);
  await app.controls['open-options'].click();
  assert.equal(opened, true);
  assert.equal(app.window.closed, true);
});

test('popup announces failure to open the full Options page', async () => {
  const app = options('?popup', async () => { throw new Error('unavailable'); });
  app.resolveRead({});
  await tick();
  await app.controls['open-options'].click();
  assert.match(app.controls.status.textContent, /Could not open settings/);
  assert.equal(app.window.closed, false);
});

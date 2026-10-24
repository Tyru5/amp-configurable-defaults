import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../options.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const features = ['right', 'resizeSidebar', 'moveViews', 'indentThreads', 'showHeaderToggle', 'subagentPanel'];

function options() {
  const controls = Object.fromEntries(['enabled', ...features, 'hideSidebarFooter', 'status'].map(id => [id, {
    checked: id === 'enabled', disabled: true, textContent: '',
    addEventListener(type, fn) { this[type] = fn; },
  }]));
  let resolveRead, rejectRead, changed, save;
  const read = new Promise((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
  const writes = [];
  runInNewContext(source, {
    document: { querySelector: selector => controls[selector.slice(1)] },
    chrome: { storage: {
      local: {
        get: () => read,
        set: values => { writes.push({ ...values }); return save?.(); },
      },
      onChanged: { addListener(fn) { changed = fn; } },
    } },
  });
  return { controls, writes, resolveRead, rejectRead,
    setSave: fn => { save = fn; },
    external: (key, newValue, area = 'local') => changed({ [key]: { newValue } }, area),
  };
}

test('Options defaults footer visible, saves opt-in, and restores it independently of master', async () => {
  const app = options();
  app.resolveRead({});
  await tick();
  const { enabled, hideSidebarFooter: footer, status } = app.controls;
  assert.equal(enabled.checked, true);
  assert.equal(footer.checked, false);
  assert.equal(footer.disabled, false);
  footer.checked = true;
  await footer.change();
  assert.deepEqual(app.writes, [{ hideSidebarFooter: true }]);
  assert.equal(status.textContent, 'Saved.');
  app.external('enabled', false);
  assert.equal(enabled.checked, false);
  assert.equal(footer.checked, true);
  assert.equal(footer.disabled, false);
  footer.checked = false;
  await footer.change();
  assert.deepEqual(app.writes[1], { hideSidebarFooter: false });
});

test('pending initial read merges storage changes per preference, including removal', async () => {
  const app = options();
  app.external('enabled', false);
  app.external('hideSidebarFooter', true, 'sync');
  app.resolveRead({ enabled: true, hideSidebarFooter: true });
  await tick();
  assert.equal(app.controls.enabled.checked, false);
  assert.equal(app.controls.hideSidebarFooter.checked, true);
  app.external('hideSidebarFooter', undefined);
  assert.equal(app.controls.hideSidebarFooter.checked, false);
  app.external('enabled', undefined);
  assert.equal(app.controls.enabled.checked, true);
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

test('every feature defaults on, saves independently while master is off, and synchronizes removals', async () => {
  const app = options();
  app.external('moveViews', false);
  app.resolveRead({ enabled: false, rightWidth: 380 });
  await tick();
  for (const key of features) {
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
    assert.equal(app.controls.enabled.checked, false);
  }
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const session = 'spaces-layout';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
const evaluate = code => JSON.parse(browser('--json', 'eval', code)).data.result;
const check = (code, label) => {
  assert.ok(evaluate(code), label);
  console.log(`PASS ${label}`);
};
const leftOf = (a, b) => `document.querySelector('${a}').getBoundingClientRect().right <= document.querySelector('${b}').getBoundingClientRect().left + 1`;

try {
  browser('open', process.argv[2] || 'http://localhost:8765/tests/fixture.html');
  browser('set', 'viewport', '1600', '900', '2');
  browser('eval', 'localStorage.clear(); location.reload()');
  browser('wait', '--fn', "document.documentElement.hasAttribute('data-amp-sidebar-right')");
  browser('select', '#view', 'Files');
  browser('eval', `(() => {
    // Native Spaces has coordinator/worker resizable wrappers, with a second
    // horizontal group inside the worker. See the November 7 live DOM capture.
    document.querySelector('.test-controls span').textContent = 'Spaces layout fixture · Not live Amp · 1600 × 900';
    document.querySelector('.app-primary-navigation').setAttribute('aria-label', 'Space navigation');
    document.querySelector('main').setAttribute('data-space-thread-pane', '');
    const outer = document.querySelector('#view-group');
    outer.setAttribute('data-slot', 'resizable-pane-group');
    document.querySelector('#agent-pane article').innerHTML = '<h1>Space coordinator</h1><label>Unsent coordinator draft<textarea id="message">Keep coordinator draft</textarea></label>';
    const worker = document.querySelector('#view-pane');
    worker.innerHTML = '<section data-thread-file-tab-pane><div data-space-thread-tab-content="thread:worker"><div id="worker-group" class="thread-file-tab-pane-group" data-pane-group data-direction="horizontal" style="display:flex;height:100%;flex-direction:row"><div id="worker-chat" data-pane style="flex:65 1 0;min-width:0"><h2>Space worker</h2><label>Unsent worker draft<textarea>Keep worker draft</textarea></label></div><div data-pane-resizer role="separator" tabindex="0" aria-label="Resize worker views"></div><div id="worker-files" data-pane style="flex:35 1 0;min-width:0"><h2>Files</h2><p>Worker auxiliary view</p></div></div></div></section>';
    worker.querySelector('section').style.height = '100%';
    worker.querySelector('[data-space-thread-tab-content]').style.height = '100%';
    const group = document.querySelector('#worker-group');
    const handle = group.querySelector('[data-pane-resizer]');
    const chat = document.querySelector('#worker-chat');
    const files = document.querySelector('#worker-files');
    files.style.overflowWrap = 'anywhere';
    let drag;
    const size = value => { const n = Math.max(20, Math.min(80, value)); chat.style.flexGrow = n; files.style.flexGrow = 100 - n; };
    handle.addEventListener('mousedown', event => { event.preventDefault(); drag = { x: event.clientX, size: parseFloat(chat.style.flexGrow) }; });
    document.addEventListener('mousemove', event => { if (drag) size(drag.size + (event.clientX - drag.x) / group.clientWidth * 100); });
    window.addEventListener('mouseup', () => { drag = null; });
    handle.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); size(parseFloat(chat.style.flexGrow) + (event.key === 'ArrowRight' ? 5 : -5)); } });
    window.fixturePaneNodes = [...outer.querySelectorAll('[data-pane]')];
  })()`);
  for (const right of [false, true]) {
    for (const moveViews of [false, true]) {
      const reversed = right && moveViews;
      const state = `${right ? 'right' : 'left'}-${moveViews ? 'opposite' : 'native'}`;
      browser('eval', `chrome.storage.local.set({ right: ${right}, moveViews: ${moveViews} })`);
      check(leftOf(right ? 'main' : '.app-primary-navigation', right ? '.app-primary-navigation' : 'main'), `${state}: Space navigation rail follows sidebar`);
      check(leftOf(reversed ? '#view-pane' : '#agent-pane', reversed ? '#agent-pane' : '#view-pane'), `${state}: native coordinator/worker placement`);
      check(leftOf(reversed ? '#worker-files' : '#worker-chat', reversed ? '#worker-chat' : '#worker-files'), `${state}: nested worker auxiliary placement`);
      for (const selector of ['#view-group > [data-pane-resizer]', '#worker-group > [data-pane-resizer]']) {
        const x = evaluate(`Math.round(document.querySelector('${selector}').getBoundingClientRect().x + 2)`);
        browser('mouse', 'move', String(x), '420');
        browser('mouse', 'down', 'left');
        browser('mouse', 'move', String(x + 24), '420');
        browser('mouse', 'up', 'left');
        check(`Math.abs(document.querySelector('${selector}').getBoundingClientRect().x + 2 - ${x + 24}) < 2`, `${state}: ${selector} follows a 24px rightward drag`);
        browser('focus', selector);
        const before = evaluate(`document.querySelector('${selector}').getBoundingClientRect().x`);
        browser('press', 'ArrowLeft');
        check(`document.querySelector('${selector}').getBoundingClientRect().x < ${before}`, `${state}: keyboard divider moves left`);
      }
      browser('click', '[aria-label="Toggle sidebar"]');
      check(`(() => { const trigger = document.querySelector('.sidebar-trigger-wrapper').getBoundingClientRect(); const frame = document.querySelector('.app-content-frame').getBoundingClientRect(); return ${right} ? trigger.left > frame.right - 60 : trigger.right < frame.left + 60; })()`, `${state}: collapsed sidebar toggle stays beside navigation rail`);
      if (right) check(`document.querySelector('.app-title-bar > :last-child').getBoundingClientRect().right <= document.querySelector('.sidebar-trigger-wrapper').getBoundingClientRect().left`, `${state}: header actions do not overlap the collapsed toggle`);
      check(`window.fixturePaneNodes.every(node => node.isConnected) && document.querySelector('#message').value === 'Keep coordinator draft' && document.querySelector('#worker-chat textarea').value === 'Keep worker draft'`, `${state}: pane nodes and both drafts survive switching and collapse`);
      if (process.env.SCREENSHOT_DIR) browser('screenshot', `${process.env.SCREENSHOT_DIR}/spaces-${state}-collapsed.png`);
      browser('click', '[aria-label="Toggle sidebar"]');
      if (process.env.SCREENSHOT_DIR) browser('screenshot', `${process.env.SCREENSHOT_DIR}/spaces-${state}.png`);
    }
  }
  browser('set', 'viewport', '767', '900', '2');
  check(`getComputedStyle(document.querySelector('#view-group')).flexDirection === 'row' && getComputedStyle(document.querySelector('#worker-group')).flexDirection === 'row'`, 'mobile preserves both native split directions');
  console.log('All Spaces layout checks passed.');
} finally {
  browser('close');
}

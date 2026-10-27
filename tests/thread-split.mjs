import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Use an explicitly connected browser; never launch or close the user's browser.
const [session, url = 'http://localhost:8765/tests/fixture.html'] = process.argv.slice(2);
assert.ok(session, 'Pass an agent-browser session connected to your test browser');
function browser(...args) {
  const result = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8', timeout: 40000 }));
  assert.ok(result.success, result.error);
  return result.data;
}
const evaluate = code => browser('eval', code).result;
function check(code, label) { assert.ok(evaluate(code), label); console.log(`PASS ${label}`); }
const row = '#thread-parent a';
const frame = 'document.querySelector("[data-amp-thread-pane] iframe")';
const divider = '[data-amp-thread-divider]';
let tab;
try {
  browser('tab', 'new', url);
  tab = browser('tab').tabs.find(t => t.active).tabId;
  browser('set', 'viewport', '1280', '800');
  evaluate(`(async () => {
    await chrome.storage.local.set({right:true});
    window.originalMain = document.querySelector('main').firstElementChild;
    window.navigations = 0;
    for (const [i, row] of [...document.querySelectorAll('#thread-parent a, #thread-other a')].entries()) {
      row.dataset.sidebarThreadId = 'T-00000000-0000-0000-0000-00000000000' + i;
      row.href = '/threads/' + row.dataset.sidebarThreadId;
      row.draggable = false;
      row.addEventListener('pointerdown', () => navigations++);
      row.addEventListener('click', e => { e.preventDefault(); navigations++; });
    }
    chrome.runtime.sendMessage = async ({type}) => {
      if (type === 'amp-thread-split-close') { window.ruleActive = false; return {ok:true}; }
      if (window.rejectSplit) return {error:'Fixture permission denied'};
      window.ruleActive = true;
      return {ok:true, url: '/tests/fixture.html?embedded-fixture'};
    };
    await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = '/thread-split.js'; script.onload = resolve; document.head.append(script);
    });
  })()`);
  browser('fill', '#message', 'Primary draft stays here');
  function drag(side) {
    const point = evaluate(`(() => {
      const r=document.querySelector('${row}').getBoundingClientRect();
      const m=document.querySelector('main').getBoundingClientRect();
      return {x:r.x+80,y:r.y+15,drop:${side === 'left' ? 'm.left+40' : side === 'right' ? 'm.right-40' : 'm.left+m.width/2'},dy:m.top+180};
    })()`);
    browser('mouse', 'move', String(point.x), String(point.y));
    browser('mouse', 'down');
    browser('mouse', 'move', String(point.x - 20), String(point.y + 4));
    browser('mouse', 'move', String(point.drop), String(point.dy));
    browser('mouse', 'move', String(point.drop + 1), String(point.dy + 1));
    browser('mouse', 'up');
  }
  drag('middle');
  check(`!${frame} && navigations===0 && !document.querySelector('[data-amp-thread-drop]')`, 'drop outside edges cancels without navigation');
  drag('right');
  browser('wait', '--fn', `${frame} && !${frame}.hidden`);
  check(`document.querySelector('main').dataset.ampThreadSplit==='right' && navigations===0`, 'real drag opens the right split, not the thread link');
  evaluate(`window.savedFrame=${frame}; savedFrame.contentDocument.querySelector('#message').value='Secondary draft stays here'`);
  drag('left');
  check(`document.querySelector('main').dataset.ampThreadSplit==='left' && ${frame}===savedFrame && savedFrame.contentDocument.querySelector('#message').value==='Secondary draft stays here'`, 'drag over the iframe moves the same pane without losing its draft');
  check(`document.querySelector('main').firstElementChild===originalMain && document.querySelector('#message').value==='Primary draft stays here'`, 'primary DOM and draft survive splitting');
  browser('focus', divider);
  browser('press', 'ArrowLeft');
  check(`document.querySelector('${divider}').getAttribute('aria-valuenow')==='45'`, 'keyboard divider moves in the physical direction');
  browser('dblclick', divider);
  check(`document.querySelector('${divider}').getAttribute('aria-valuenow')==='50'`, 'double click resets split width');
  browser('focus', '#thread-other a');
  browser('press', 'Alt+Shift+ArrowRight');
  check(`${frame}===savedFrame && document.querySelector('[role=status]').textContent.includes('Close this split')`, 'another thread cannot replace an unsent split');
  browser('set', 'viewport', '600', '800');
  check(`${frame}===savedFrame && document.querySelector('${divider}').getAttribute('aria-orientation')==='horizontal' && ${frame}.getBoundingClientRect().bottom <= originalMain.getBoundingClientRect().top`, 'narrow window stacks the existing pane without reloading');
  browser('click', '[aria-label="Close thread split"]');
  check(`!${frame} && !window.ruleActive && document.querySelector('#message').value==='Primary draft stays here'`, 'close restores the primary pane and releases its rule');
  browser('set', 'viewport', '1280', '800');
  evaluate('window.rejectSplit=true');
  browser('focus', row);
  browser('press', 'Alt+Shift+ArrowLeft');
  check(`document.querySelector('[role=status]').textContent==='Fixture permission denied' && !document.querySelector('[data-amp-thread-pane] > button').hidden`, 'permission failure offers retry');
  evaluate('window.rejectSplit=false');
  browser('click', '[data-amp-thread-pane] > button');
  browser('wait', '--fn', `${frame} && !${frame}.hidden`);
  browser('click', '[aria-label="Close thread split"]');
  browser('click', row);
  check('navigations===1', 'ordinary click still navigates once');
} finally {
  if (tab) browser('tab', 'close', tab);
}

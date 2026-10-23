import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const url = process.argv[2] || 'http://localhost:8765/tests/fixture.html';
const session = 'amp-sidebar-test';
function browser(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
}
function evaluate(code) {
  return JSON.parse(browser('--json', 'eval', code)).data.result;
}
function check(condition, label) {
  assert.ok(evaluate(condition), label);
  console.log(`PASS ${label}`);
}
const bounds = `(() => {
  const box = selector => { const { x, width, right } = document.querySelector(selector).getBoundingClientRect(); return { x, width, right }; };
  return { sidebar: box('[data-slot="sidebar-container"]'), main: box('main'), frame: box('.app-content-frame'), rail: box('.app-primary-navigation') };
})()`;
const viewsOnLeft = `document.querySelector('#view-pane').getBoundingClientRect().right <= document.querySelector('#agent-pane').getBoundingClientRect().left`;

try {
  browser('open', url);
  browser('set', 'viewport', '1280', '800', '2');
  browser('eval', "localStorage.clear(); location.reload()");
  browser('wait', '--fn', "document.documentElement.hasAttribute('data-amp-sidebar-right')");
  check(`(${bounds}).sidebar.x === 924 && (${bounds}).sidebar.width === 300`, 'right mode preserves native width and leaves the rail at the far right');
  check(`(${bounds}).main.x === 0 && (${bounds}).main.right === 924`, 'conversation fills remaining space without overlap');
  browser('fill', '#message', 'Keep this unsent draft');
  for (const name of ['Files', 'Changes', 'Portal', 'Terminal', 'Desktop']) {
    browser('select', '#view', name);
    check(viewsOnLeft, `${name} opens to the left of the conversation`);
  }
  for (const layout of ['thread-file-tab-pane-group', 'multi-pane-pane-group']) {
    browser('eval', `document.querySelector('#view-group').className = '${layout}'`);
    check(viewsOnLeft, `${layout} places views on the left`);
    const handleX = evaluate(`Math.round(document.querySelector('[data-pane-resizer]').getBoundingClientRect().x + 2)`);
    const viewWidth = evaluate(`document.querySelector('#view-pane').getBoundingClientRect().width`);
    browser('mouse', 'move', String(handleX), '400');
    browser('mouse', 'down', 'left');
    browser('mouse', 'move', String(handleX + 60), '400');
    browser('mouse', 'up', 'left');
    check(`Math.abs(document.querySelector('#view-pane').getBoundingClientRect().width - ${viewWidth + 60}) < 1`, 'dragging the view divider right grows the left view by 60px');
    const resizedWidth = evaluate(`document.querySelector('#view-pane').getBoundingClientRect().width`);
    browser('focus', '[data-pane-resizer]');
    browser('press', 'ArrowLeft');
    check(`document.querySelector('#view-pane').getBoundingClientRect().width < ${resizedWidth}`, 'keyboard left moves the view divider left');
  }
  browser('eval', `document.querySelector('#view-group').className = 'thread-file-tab-pane-group'`);
  check(`document.querySelector('#message').value === 'Keep this unsent draft' && getComputedStyle(document.querySelector('#view-pane')).direction === 'ltr'`, 'views retain text direction and the unsent draft');
  browser('click', '#switch');
  check(`(${bounds}).sidebar.x === 56 && (${bounds}).main.x === 356`, 'toolbar handler restores left layout');
  check(`document.querySelector('#agent-pane').getBoundingClientRect().right <= document.querySelector('#view-pane').getBoundingClientRect().left`, 'left-sidebar mode restores views on the right');
  check(`document.querySelector('#message').value === 'Keep this unsent draft'`, 'switching preserves the composer draft');
  browser('click', '#switch');
  browser('select', '#view', '');
  browser('click', '[aria-label="Toggle sidebar"]');
  check(`(${bounds}).main.width === 1224 && (${bounds}).sidebar.x >= 1224`, 'collapsed sidebar is offscreen and frees its space');
  browser('click', '[aria-label="Toggle sidebar"]');
  browser('mouse', 'move', '926', '400');
  browser('mouse', 'down', 'left');
  browser('mouse', 'move', '846', '400');
  browser('mouse', 'up', 'left');
  check(`(${bounds}).sidebar.width === 380 && (${bounds}).main.right === 844`, 'dragging the right divider left grows the sidebar by 80px');
  browser('reload');
  browser('wait', '--fn', "document.documentElement.style.getPropertyValue('--amp-sidebar-right-width') === '380px'");
  check(`(${bounds}).sidebar.width === 380`, 'resized width survives reload');
  browser('click', '#replace');
  check(`(${bounds}).sidebar.x === 844`, 'new SPA shell inherits right position and saved width');
  for (const [distance, expected] of [[-300, 480], [400, 200]]) {
    const x = evaluate(`(${bounds}).sidebar.x + 2`);
    browser('mouse', 'move', String(x), '400');
    browser('mouse', 'down', 'left');
    browser('mouse', 'move', String(x + distance), '400');
    browser('mouse', 'up', 'left');
    check(`(${bounds}).sidebar.width === ${expected}`, `resize clamps at ${expected}px`);
  }
  browser('dblclick', '.resize-handle');
  check(`(${bounds}).sidebar.width === 300`, 'double-click restores native width');
  browser('tab', 'new', url);
  browser('wait', '--fn', "document.documentElement.hasAttribute('data-amp-sidebar-right')");
  browser('click', '#switch');
  browser('tab', 't1');
  check(`!document.documentElement.hasAttribute('data-amp-sidebar-right')`, 'side changes propagate to an already open tab');
  check(`(${bounds}).sidebar.width === 300`, 'left mode restores native width independently');
  browser('reload');
  browser('wait', '--fn', "!document.documentElement.hasAttribute('data-amp-sidebar-right')");
  check(`(${bounds}).sidebar.x === 56`, 'left preference survives reload');
  browser('click', '#switch');
  browser('select', '#view', 'Files');
  browser('set', 'viewport', '767', '800', '2');
  check(`getComputedStyle(document.querySelector('.app-content-frame')).flexDirection === 'row'`, 'mobile breakpoint retains native direction');
  check(`getComputedStyle(document.querySelector('.thread-file-tab-pane-group')).flexDirection === 'row'`, 'mobile views retain their native layout');
  browser('set', 'viewport', '768', '800', '2');
  check(`getComputedStyle(document.querySelector('.app-content-frame')).flexDirection === 'row-reverse'`, 'desktop breakpoint applies at exactly 768px');
  check(viewsOnLeft, 'desktop view placement applies at exactly 768px');
  browser('eval', `const group = document.querySelector('.thread-file-tab-pane-group'); group.dataset.direction = 'vertical'; group.style.flexDirection = 'column'`);
  check(`getComputedStyle(document.querySelector('.thread-file-tab-pane-group')).flexDirection === 'column'`, 'vertical view splits are not reversed');
  console.log('All browser checks passed.');
} finally {
  browser('close');
}

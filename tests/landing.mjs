import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const url = process.argv[2] || 'http://localhost:8765/docs/';
const session = 'landing-test';
function browser(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
}
function viewport(width, height) {
  browser('set', 'viewport', String(width), String(height), '2');
  browser('eval', 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}
function check(expression, label) {
  const result = JSON.parse(browser('--json', 'eval', expression)).data.result;
  assert.ok(result, label);
  console.log(`PASS ${label}`);
}
const bounds = `(() => {
  const box = selector => {
    const { left, right } = document.querySelector(selector).getBoundingClientRect();
    return { left, right };
  };
  return { nav: box('.demo-navigation'), chat: box('.demo-conversation'), agents: box('.demo-agents') };
})()`;

try {
  browser('open', url);
  viewport(1440, 1000);
  check(`document.querySelectorAll('main section').length === 5 && document.querySelectorAll('h1').length === 1`, 'all landing content is inside one main landmark');
  browser('click', 'button[data-side="left"]');
  check(`document.querySelector('button[data-side="left"]').getAttribute('aria-pressed') === 'true' && document.querySelector('button[data-side="right"]').getAttribute('aria-pressed') === 'false'`, 'demo selection exposes its pressed state');
  check(`(${bounds}).nav.right <= (${bounds}).chat.left && (${bounds}).agents.left >= (${bounds}).chat.right`, 'left demo places navigation left and subagents right');
  browser('focus', 'button[data-side="right"]');
  browser('press', 'Enter');
  check(`(${bounds}).nav.left >= (${bounds}).chat.right && (${bounds}).agents.right <= (${bounds}).chat.left`, 'keyboard switches the demo back to right navigation');
  check(`document.querySelector('[role="status"]').textContent === 'Right sidebar selected in preview.'`, 'selected layout is announced');
  check(`getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) > 0`, 'keyboard focus has a visible indicator');
  browser('focus', 'details:nth-child(2) summary');
  browser('press', 'Enter');
  check(`document.querySelector('details:nth-child(2)').open && document.querySelector('details:nth-child(2)').textContent.includes('reading and changing site data')`, 'FAQ opens by keyboard and explains site access');
  browser('press', 'Enter');
  check(`!document.querySelector('details:nth-child(2)').open`, 'FAQ closes by keyboard');

  browser('eval', 'window.scrollTo({ top: 0, behavior: "instant" })');
  for (const width of [320, 390, 700, 768, 1024, 1280, 1440]) {
    viewport(width, 900);
    check(`document.documentElement.scrollWidth <= innerWidth`, `no horizontal overflow at ${width}px`);
  }
  viewport(390, 844);
  browser('click', 'button[data-side="left"]');
  check(`(${bounds}).nav.right <= (${bounds}).chat.left`, 'compact illustration switches to left navigation');
  browser('click', 'button[data-side="right"]');
  check(`(${bounds}).nav.left >= (${bounds}).chat.right`, 'compact illustration switches back to right navigation');
  browser('click', '.hero-copy .button');
  browser('wait', '--fn', `location.hash === '#install' && Math.abs(document.querySelector('#install').getBoundingClientRect().top - 30) < 3`);
  check(`document.querySelector('#install .button').href === 'https://github.com/Tyru5/amp-sidebar-right/archive/refs/heads/main.zip'`, 'install action reaches the guide and offers the public source archive');
  browser('eval', 'Promise.all([...document.images].map(image => image.decode()))');
  check(`[...document.images].every(image => image.complete && image.naturalWidth > 0)`, 'all landing images load');
  browser('set', 'media', 'reduced-motion');
  check(`getComputedStyle(document.documentElement).scrollBehavior === 'auto'`, 'reduced motion disables animated anchor scrolling');
} finally {
  browser('close');
}

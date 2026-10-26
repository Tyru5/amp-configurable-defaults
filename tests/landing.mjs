import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const url = process.argv[2] || "http://localhost:8765/docs/";
const session = "landing-test";
function browser(...args) {
  return execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8",
  }).trim();
}
function viewport(width, height) {
  browser("set", "viewport", String(width), String(height), "2");
  browser(
    "eval",
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}
function check(expression, label) {
  const result = JSON.parse(browser("--json", "eval", expression)).data.result;
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
  browser("open", url);
  browser("check", 'input[name="theme"][value="system"]');
  browser("set", "media", "light");
  viewport(1440, 1000);
  const lightBackground = JSON.parse(
    browser("--json", "eval", "getComputedStyle(document.documentElement).backgroundColor"),
  ).data.result;
  check(
    `document.querySelectorAll('main section').length === 4 && document.querySelectorAll('h1').length === 1`,
    "all landing content is inside one main landmark",
  );
  browser("click", 'button[data-side="left"]');
  check(
    `document.querySelector('button[data-side="left"]').getAttribute('aria-pressed') === 'true' && document.querySelector('button[data-side="right"]').getAttribute('aria-pressed') === 'false'`,
    "demo selection exposes its pressed state",
  );
  check(
    `(${bounds}).nav.right <= (${bounds}).chat.left && (${bounds}).agents.left >= (${bounds}).chat.right`,
    "left demo places navigation left and subagents right",
  );
  check(
    `document.querySelector('.demo-thread.child').getBoundingClientRect().left > document.querySelector('.demo-thread.current').getBoundingClientRect().left`,
    "left preview retains child hierarchy in v1.2",
  );
  browser("focus", 'button[data-side="right"]');
  browser("press", "Enter");
  check(
    `(${bounds}).nav.left >= (${bounds}).chat.right && (${bounds}).agents.right <= (${bounds}).chat.left`,
    "keyboard switches the demo back to right navigation",
  );
  check(
    `document.querySelector('.demo-thread.child').getBoundingClientRect().left > document.querySelector('.demo-thread.current').getBoundingClientRect().left`,
    "right preview retains child hierarchy in v1.2",
  );
  check(
    `document.querySelector('[role="status"]').textContent === 'Right sidebar selected in preview.'`,
    "selected layout is announced",
  );
  check(
    `getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) > 0`,
    "keyboard focus has a visible indicator",
  );
  browser("focus", "details:nth-child(2) summary");
  browser("press", "Enter");
  check(
    `document.querySelector('details:nth-child(2)').open && document.querySelector('details:nth-child(2)').textContent.includes('reading and changing site data')`,
    "FAQ opens by keyboard and explains site access",
  );
  browser("press", "Enter");
  check(`!document.querySelector('details:nth-child(2)').open`, "FAQ closes by keyboard");

  browser("eval", 'window.scrollTo({ top: 0, behavior: "instant" })');
  for (const width of [320, 390, 700, 768, 1024, 1280, 1440]) {
    viewport(width, 900);
    check(
      `document.documentElement.scrollWidth <= innerWidth`,
      `no horizontal overflow at ${width}px`,
    );
  }
  viewport(390, 844);
  browser("click", 'button[data-side="left"]');
  check(
    `(${bounds}).nav.right <= (${bounds}).chat.left`,
    "compact illustration switches to left navigation",
  );
  browser("click", 'button[data-side="right"]');
  check(
    `(${bounds}).nav.left >= (${bounds}).chat.right`,
    "compact illustration switches back to right navigation",
  );
  browser("click", ".hero-copy .button");
  browser(
    "wait",
    "--fn",
    `location.hash === '#install' && Math.abs(document.querySelector('#install').getBoundingClientRect().top - 30) < 3`,
  );
  check(
    `document.querySelector('#install .button').href === 'https://github.com/Tyru5/amp-configurable-defaults/archive/refs/heads/main.zip'`,
    "install action reaches the guide and offers the public source archive",
  );
  browser("eval", "Promise.all([...document.images].map(image => image.decode()))");
  check(
    `[...document.images].every(image => image.complete && image.naturalWidth > 0)`,
    "all landing images load",
  );
  browser("set", "media", "dark");
  check(
    `getComputedStyle(document.documentElement).colorScheme === 'dark' && getComputedStyle(document.documentElement).backgroundColor !== ${JSON.stringify(lightBackground)}`,
    "system dark preference changes the page palette without a reload",
  );
  for (const width of [320, 390, 700, 768, 1024, 1280, 1440]) {
    viewport(width, 900);
    check(
      `document.documentElement.scrollWidth <= innerWidth`,
      `dark theme has no horizontal overflow at ${width}px`,
    );
  }
  browser("focus", 'button[data-side="left"]');
  browser("press", "Enter");
  check(
    `document.querySelector('button[data-side="left"]').getAttribute('aria-pressed') === 'true' && getComputedStyle(document.activeElement).outlineStyle !== 'none'`,
    "dark theme retains keyboard selection and visible focus",
  );
  browser("set", "media", "light");
  check(
    `getComputedStyle(document.documentElement).colorScheme === 'light' && getComputedStyle(document.documentElement).backgroundColor === ${JSON.stringify(lightBackground)}`,
    "switching the system preference back restores the light palette",
  );
  browser("check", 'input[name="theme"][value="dark"]');
  check(
    `getComputedStyle(document.documentElement).colorScheme === 'dark' && getComputedStyle(document.documentElement).backgroundColor !== ${JSON.stringify(lightBackground)} && [...document.querySelectorAll('meta[name="theme-color"]')].every(meta => meta.content === '#1b2a22')`,
    "explicit dark mode overrides a light system preference and browser chrome",
  );
  browser("reload");
  check(
    `document.querySelector('input[name="theme"]:checked').value === 'dark' && getComputedStyle(document.documentElement).colorScheme === 'dark'`,
    "the saved dark override survives a reload",
  );
  browser("set", "media", "dark");
  browser("focus", 'input[name="theme"]:checked');
  browser("press", "ArrowLeft");
  check(
    `document.querySelector('input[name="theme"]:checked').value === 'light' && getComputedStyle(document.documentElement).backgroundColor === ${JSON.stringify(lightBackground)} && getComputedStyle(document.activeElement).outlineStyle !== 'none'`,
    "keyboard selection can override a dark system preference with light mode",
  );
  browser("reload");
  check(
    `document.querySelector('input[name="theme"]:checked').value === 'light' && getComputedStyle(document.documentElement).colorScheme === 'light' && [...document.querySelectorAll('meta[name="theme-color"]')].every(meta => meta.content === '#e7eddf')`,
    "the saved light override and browser chrome survive a reload",
  );
  browser("check", 'input[name="theme"][value="system"]');
  check(
    `localStorage.getItem('landing-theme') === null && getComputedStyle(document.documentElement).colorScheme === 'dark' && [...document.querySelectorAll('meta[name="theme-color"]')].every(meta => meta.content === (meta.media.includes('dark') ? '#1b2a22' : '#e7eddf'))`,
    "System clears the saved override and restores automatic page and browser colors",
  );
  browser("set", "media", "light");
  check(
    `getComputedStyle(document.documentElement).backgroundColor === ${JSON.stringify(lightBackground)}`,
    "System continues responding to preference changes after a manual override",
  );
  browser(
    "eval",
    `void Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } })`,
  );
  browser("check", 'input[name="theme"][value="dark"]');
  check(
    `getComputedStyle(document.documentElement).colorScheme === 'dark'`,
    "theme selection still works when storage is blocked",
  );
  browser("reload");
  browser("set", "media", "reduced-motion");
  check(
    `getComputedStyle(document.documentElement).scrollBehavior === 'auto'`,
    "reduced motion disables animated anchor scrolling",
  );
} finally {
  browser("close");
}

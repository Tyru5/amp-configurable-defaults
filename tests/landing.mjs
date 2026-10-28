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
  check(
    `(() => { const img = document.querySelector('.hero-shot img'); return img.currentSrc.endsWith('assets/hero-live.webp') && img.alt.includes('redacted') && img.getBoundingClientRect().width > 1000; })()`,
    "hero shows the redacted live Amp capture at full width",
  );
  check(
    `document.querySelector('.hero-shot figcaption').textContent.includes('real Amp session') && document.querySelectorAll('.hero-points li').length === 4`,
    "hero caption identifies the live capture and what it shows",
  );
  check(
    `(() => { const section = document.querySelector('#split-panes'); const image = section?.querySelector('img'); return image?.getAttribute('src') === 'assets/thread-split.webp' && image.alt.includes('redacted') && section.textContent.includes('Alt+Shift+Left') && section.textContent.includes('Alt+Shift+Right') && section.querySelector('a').hash === '#embedded-thread-security-exception'; })()`,
    "split panes have a real redacted capture, keyboard instructions, and the security disclosure",
  );
  browser("focus", "details:nth-child(2) summary");
  check(
    `getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) > 0`,
    "keyboard focus has a visible indicator",
  );
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
  check(
    `(() => { const img = document.querySelector('.hero-shot img').getBoundingClientRect(); return img.left >= 0 && img.right <= innerWidth && Math.abs(img.width / img.height - 2400 / 1428) < 0.01; })()`,
    "compact hero image fits the viewport without distortion",
  );
  check(
    `['.hero-copy .button', '.closing .button', '#install .install-intro p a'].every(selector => document.querySelector(selector)?.href === 'https://chromewebstore.google.com/detail/amp-configurable-defaults/hpobhiphbifcjhplkegebmpiehkcpjod')`,
    "primary install actions and installation copy link to the published Chrome Web Store listing",
  );
  browser("click", 'nav a[href="#install"]');
  browser(
    "wait",
    "--fn",
    `location.hash === '#install' && Math.abs(document.querySelector('#install').getBoundingClientRect().top - 30) < 3`,
  );
  check(
    `document.querySelector('#install .button').href === 'https://github.com/Tyru5/amp-configurable-defaults/archive/refs/heads/main.zip'`,
    "installation navigation still reaches the guide and offers the public source archive",
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

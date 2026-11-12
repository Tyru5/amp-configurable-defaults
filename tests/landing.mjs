import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const url = process.argv[2] || "http://localhost:8765/docs/";
const session = `landing-test-${process.pid}`;
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
    "hero shows the redacted live 1.4.3 capture at full width",
  );
  check(
    `document.querySelector('.hero-shot figcaption').textContent.includes('Live, signed-in Amp') && document.querySelectorAll('.hero-points li').length === 4`,
    "hero caption identifies the live capture and what it shows",
  );
  check(
    `(() => { const note = document.querySelector('.hero .native-note'); return note?.textContent.includes('really use the native Amp apps') && note.querySelector('a').href === 'https://ampcode.com/download'; })()`,
    "hero points readers to the native Amp apps",
  );
  check(
    `document.querySelectorAll('#features .feature-story').length === 2 && document.querySelector('#batch-archive').textContent.includes('1.4.3 source preview') && document.querySelector('#features a[href="features/"]') && document.querySelector('.install-note a').getAttribute('href') === 'features/#source-preview' && document.querySelector('.install-note').textContent.includes('Not yet in the store')`,
    "landing highlights two features, including new batch archive, and links to the full list",
  );
  check(
    `!document.querySelector('img[src*="fixture"]') && [...document.querySelectorAll('figure img')].every(img => /live amp/i.test(img.alt + img.closest('figure').querySelector('figcaption').textContent) && /redact/i.test(img.alt + img.closest('figure').querySelector('figcaption').textContent))`,
    "landing images are real Amp captures that disclose their redactions",
  );
  check(
    `[...document.styleSheets].some(sheet => [...sheet.cssRules].some(rule => rule instanceof CSSViewTransitionRule && rule.navigation === 'auto'))`,
    "pages opt in to cross-document view transitions",
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
  check(
    `(() => { const text = document.querySelector('details:nth-child(2)').textContent.replace(/\\s+/g, ' '); return text.includes('fourteen local preferences') && text.includes('older and newer transcript pages') && text.includes('does not send messages') && text.includes('Content Security Policy'); })()`,
    "privacy disclosure covers new preferences and skill history without hiding the framing exception",
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
  check(
    `[...document.querySelectorAll('figure img')].every(image => Math.abs(Number(image.getAttribute('width')) / Number(image.getAttribute('height')) - image.naturalWidth / image.naturalHeight) < 0.01)`,
    "screenshot dimensions reserve the correct aspect ratio before loading",
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
  browser("set", "media", "no-preference");
  browser("focus", 'nav a[href="features/"]');
  browser("press", "Enter");
  browser("wait", "--fn", `location.pathname.endsWith('/features/') && document.readyState === 'complete'`);
  check(
    `document.querySelectorAll('h1').length === 1 && document.querySelector('nav a[aria-current="page"]').textContent === 'Features' && ['source-preview', 'layout', 'threads', 'composer', 'reading', 'settings'].every(id => document.querySelector('.feature-jump a[href="#' + id + '"]') && document.getElementById(id))`,
    "features route has one heading and a jump link for every group",
  );
  check(
    `['batch-archive', 'composer-tools', 'tool-previews', 'thread-messages', 'spaces', 'timestamp-dates', 'sidebar-settings'].every(id => document.getElementById(id)?.textContent.includes('1.4.3 source preview')) && [...document.querySelectorAll('.whats-new a')].every(a => document.getElementById(a.hash.slice(1))?.querySelector('.new-badge, h3'))`,
    "features route covers recently merged features and distinguishes them from the store release",
  );
  check(
    `document.querySelector('#sidebar-settings').textContent.replace(/\\s+/g, ' ').includes('hide the placement switch') && document.querySelector('#composer-tools').textContent.includes('Back') && document.querySelectorAll('.settings-table tbody tr').length === 14 && document.querySelector('.settings-table caption').textContent.includes('fourteen checkboxes')`,
    "features route lists every setting, the settings gear, and return from Thread tools",
  );
  browser("eval", "Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode(); }))");
  check(
    `[...document.images].every(image => image.complete && image.naturalWidth > 0) && !document.querySelector('img[src*="fixture"]') && [...document.querySelectorAll('figure img')].every(img => /live amp/i.test(img.alt + img.closest('figure').querySelector('figcaption').textContent))`,
    "features route images load and are all live Amp captures",
  );
  for (const width of [320, 390, 768, 1024, 1440]) {
    viewport(width, 900);
    check(`document.documentElement.scrollWidth <= innerWidth`, `features route has no horizontal overflow at ${width}px`);
  }
  browser("click", '.whats-new a[href="#batch-archive"]');
  browser("wait", "--fn", `location.hash === '#batch-archive' && Math.abs(document.querySelector('#batch-archive').getBoundingClientRect().top - 30) < 3`);
  browser("click", "header .brand");
  browser("wait", "--fn", `!location.pathname.endsWith('/features/') && !!document.querySelector('#hero-title')`);
  browser("set", "media", "reduced-motion");
  check(
    `[...document.querySelectorAll('#install a, .faq-list a')].filter(a => a.getAttribute('href') === 'windows/').length === 2 && document.querySelector('.faq-list').textContent.includes('No equivalent setup has been verified for the native Mac app')`,
    "installation and FAQ link to Windows setup without claiming Mac was tested",
  );
  browser("focus", 'nav a[href="windows/"]');
  browser("press", "Enter");
  check(
    `location.pathname.endsWith('/windows/') && document.querySelectorAll('h1').length === 1 && document.querySelector('main').textContent.includes('not an official Amp install path')`,
    "keyboard navigation reaches the experimental Windows route",
  );
  check(
    `document.querySelector('#how a').hostname === 'learn.microsoft.com' && !document.querySelector('a[href^="https://ampcode.com/threads/"]') && !/\\bREA\\b|Ghidra|Rust|Win32|Electron|CreateCoreWebView2EnvironmentWithOptions|__native\\/home/.test(document.body.textContent) && document.querySelector('#mac').textContent.includes('no verified native Mac setup')`,
    "guide retains the public Microsoft reference and Mac caveat without investigation details",
  );
  check(
    `(() => { const setup = document.querySelector('#setup pre').textContent; const undo = document.querySelector('#undo pre').textContent; return setup.includes('--embedded-browser-webview-enable-extension --load-extension=') && setup.includes("-Name 'Amp.exe'") && setup.includes('manifest.json') && setup.includes('arguments already exist') && !setup.includes('remote-debugging-port') && undo.includes("Remove-ItemProperty -LiteralPath $key -Name 'Amp.exe'") && !undo.includes('Remove-Item '); })()`,
    "setup guards existing arguments; rollback removes only the app-specific value",
  );
  check(
    `(() => { const text = document.querySelector('#verify').textContent; return text.includes('did not certify every feature') && text.includes('WebView2 profile') && text.includes('Fully restart Amp'); })()`,
    "guide states native test limits, separate settings, and update procedure",
  );
  check(
    `[...document.querySelectorAll('a[href^="#"]')].every(a => document.getElementById(a.hash.slice(1))) && [...document.images].every(image => image.complete && image.naturalWidth > 0)`,
    "guide section links and relative image assets resolve",
  );
  for (const theme of ["light", "dark"]) {
    browser("check", `input[name="theme"][value="${theme}"]`);
    for (const width of [320, 390, 768, 1440]) {
      viewport(width, 900);
      check(
        `document.documentElement.scrollWidth <= innerWidth`,
        `Windows guide has no horizontal overflow at ${width}px in ${theme} mode`,
      );
    }
  }
  browser("reload");
  check(
    `document.querySelector('input[name="theme"]:checked').value === 'dark' && getComputedStyle(document.documentElement).colorScheme === 'dark'`,
    "guide shares the persisted landing-page theme",
  );
  browser("focus", '.guide-contents a[href="#undo"]');
  browser("press", "Enter");
  browser("wait", "--fn", `location.hash === '#undo' && document.querySelector('#undo').getBoundingClientRect().top >= 0 && document.querySelector('#undo').getBoundingClientRect().bottom <= innerHeight`);
  browser("click", '#mac a[href="../#install"]');
  browser("wait", "--fn", `location.hash === '#install' && !!document.querySelector('#install-title')`);
  check(
    `getComputedStyle(document.documentElement).colorScheme === 'dark'`,
    "guide returns to browser installation without losing the selected theme",
  );
} finally {
  browser("close");
}

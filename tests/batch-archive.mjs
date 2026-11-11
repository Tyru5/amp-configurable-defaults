import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Batch archive against the local fixture, with Amp's group markup, a stand-in
// for Amp's context menu, and a mocked archive command. Not live Amp.
const session = `amp-batch-archive-test-${process.pid}`;
const url = process.argv[2] || 'http://localhost:8765/tests/fixture.html';
const shots = process.argv[3];
function browser(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 40000 }).trim();
}
const evaluate = code => JSON.parse(browser('--json', 'eval', code)).data.result;
function check(code, label) {
  assert.ok(evaluate(code), label);
  console.log(`PASS ${label}`);
}
function eventually(code, label) {
  assert.ok(evaluate(`(async () => {
    const deadline = performance.now() + 4000;
    do {
      if ((() => (${code}))()) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (performance.now() < deadline);
    return false;
  })()`), label);
  console.log(`PASS ${label}`);
}
const shot = name => { if (shots) browser('screenshot', `${shots}/${name}.png`); };
const click = selector => evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); node.click(); return true; })()`);
function point(selector) {
  return evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
}
// A real click, or a dispatched one with Shift held, through pointer, mouse, and click.
function mouseClick(selector, shift) {
  if (shift) {
    evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)});
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        const Event = type.startsWith('pointer') ? PointerEvent : MouseEvent;
        node.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, composed: true, button: 0, shiftKey: true, pointerType: 'mouse' }));
      }
      return true; })()`);
    return;
  }
  const { x, y } = point(selector);
  browser('mouse', 'move', String(Math.round(x)), String(Math.round(y)));
  browser('mouse', 'down');
  browser('mouse', 'up');
}
function rightClick(selector) {
  evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.x + 20, clientY: r.y + 8 })); return true; })()`);
}
const menuLabels = 'JSON.stringify([...document.querySelectorAll("[data-amp-context-menu] [data-amp-batch-menu-item][role=menuitem]")].map(n => n.textContent))';
const archivedIDs = 'JSON.stringify([...document.querySelectorAll("[data-amp-batch-archived] [data-sidebar-thread-id]")].map(n => n.dataset.sidebarThreadId))';
const selectedIDs = 'JSON.stringify([...document.querySelectorAll("[data-amp-batch-selected] [data-sidebar-thread-id]")].map(n => n.dataset.sidebarThreadId))';

try {
  browser('open', url);
  browser('wait', '--fn', 'document.readyState === "complete" && Boolean(window.chrome?.storage?.local) && Boolean(document.querySelector(".sidebar-toolbar"))');
  browser('set', 'viewport', '1280', '800');
  evaluate(`(async () => {
    await chrome.storage.local.set({ right: false });
    const inner = document.querySelector('[data-slot="sidebar-inner"]');
    const groups = document.createElement('ul');
    groups.className = 'amp-test-groups';
    // Amp's markup: a heading wrapper, then a list item holding the group's rows.
    const rows = (items) => items.map(([id, title, extra = '']) =>
      '<li data-slot="sidebar-menu-item"><a data-sidebar-thread-id="' + id + '" data-sidebar-group-id="g" href="/threads/' + id + '"><span class="status"></span>' + title + extra + '</a></li>').join('');
    groups.innerHTML =
      // An empty project with no row list, alone in its section, right before a section with rows.
      '<li><ul><li class="py-0.5"><div class="sidebar-thread-heading" data-sidebar-project-hover-id="p0"><button type="button" data-testid="sidebar-thread-group-header" aria-expanded="true"><span class="truncate">empty-project</span></button></div></li></ul></li>' +
      '<li><ul><li class="py-0.5"><div class="sidebar-thread-heading" data-sidebar-project-hover-id="p1"><button type="button" data-testid="sidebar-thread-group-header" aria-expanded="true"><span><span class="truncate">amp-configurable-defaults</span></span></button></div></li>' +
      '<li><div><ul>' + rows([['T-a', 'Batch archive feature', '<span data-thread-row-running-icon></span>'], ['T-b', 'Fix context menu']]) +
        // T-b's subthread, collapsed: Amp keeps it mounted but inert.
        '<li><div data-sidebar-subthreads-of="T-b"><div inert><ul>' + rows([['T-sub', 'Hidden subthread']]) + '</ul></div></div></li>' +
        rows([['T-c', 'Release 1.4.3'], ['T-d', 'Teammate review']]) + '</ul></div></li>' +
      '<li class="py-0.5"><div class="sidebar-thread-heading"><button type="button" data-testid="sidebar-thread-group-header" aria-expanded="true"><span class="truncate">wsl.personal</span></button></div></li>' +
      '<li><div><ul>' + rows([['T-x', 'Runner cleanup']]) + '</ul></div></li></ul></li>' +
      // A row with a real thread ID, which thread-split.js also handles.
      '<li><ul><li class="py-0.5"><div class="sidebar-thread-heading"><button type="button" data-testid="sidebar-thread-group-header" aria-expanded="true"><span class="truncate">split</span></button></div></li>' +
      '<li><div><ul>' + rows([['T-00000000-0000-0000-0000-000000000001', 'Split thread']]) + '</ul></div></li></ul></li>' +
      // A project with one thread.
      '<li><ul><li class="py-0.5"><div class="sidebar-thread-heading" data-sidebar-project-hover-id="p2"><button type="button" data-testid="sidebar-thread-group-header" aria-expanded="true"><span class="truncate">solo-project</span></button></div></li>' +
      '<li><div><ul>' + rows([['T-y', 'Solo thread']]) + '</ul></div></li></ul></li>' +
      // Amp's Archived group: its rows carry the group's ID.
      '<li><ul><li class="py-0.5"><div class="sidebar-thread-heading" data-test-archived><button type="button" data-testid="sidebar-thread-group-header" aria-expanded="true"><span class="truncate">Archived</span></button></div></li>' +
      '<li><div><ul>' + rows([['T-old', 'Archived long ago']]).replace('data-sidebar-group-id="g"', 'data-sidebar-group-id="archived"') +
        // Spaces: in Amp's Spaces group, or marked by their member avatars elsewhere.
        rows([['T-pucks', 'Space']]).replace('data-sidebar-group-id="g"', 'data-sidebar-group-id="project-pucks"') +
        rows([['T-space', 'Pinned Space', '<span data-thread-row-space-members></span>']]) + '</ul></div></li></ul></li>';
    const style = document.createElement('style');
    style.textContent = '.amp-test-groups{list-style:none;margin:0;padding:0 10px 90px}[inert]{display:none}.amp-test-groups ul{list-style:none;margin:0;padding:0}.amp-test-groups li{position:relative}' +
      '.sidebar-thread-heading{display:flex;align-items:center;gap:4px;padding:8px 8px 4px;color:#6b6d67;font-size:12px}.sidebar-thread-heading button{all:unset;flex:1;cursor:pointer}' +
      '.amp-test-groups a{display:flex;gap:8px;align-items:center;padding:7px 8px;color:inherit;text-decoration:none;border-radius:6px;font-size:13px}.amp-test-groups a:hover{background:#e5e8df}' +
      '.status{width:12px;height:12px;border-radius:50%;border:1.5px solid #9a9c95;flex:none}[data-amp-context-menu]{position:fixed;z-index:50;min-width:220px;padding:4px;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 10px 30px -10px #0004;font:13px system-ui}' +
      '[data-amp-context-menu] .item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer}[data-amp-context-menu] .sep{height:1px;margin:4px -4px;background:#e5e5e5}';
    document.head.append(style);
    inner.querySelector('.sidebar-body').after(groups);
    window.navigations = 0;
    for (const row of groups.querySelectorAll('a')) row.addEventListener('click', e => { e.preventDefault(); navigations++; });
    // Amp opens a portaled menu after the row's contextmenu event, and closes it on Escape.
    document.addEventListener('contextmenu', event => {
      if (!event.target.closest?.('[data-sidebar-thread-id], [data-sidebar-project-hover-id]')) return;
      event.preventDefault();
      document.querySelector('[data-amp-context-menu]')?.remove();
      const menu = document.createElement('div');
      menu.setAttribute('data-amp-context-menu', '');
      menu.setAttribute('role', 'menu');
      menu.style.left = event.clientX + 'px';
      menu.style.top = event.clientY + 'px';
      menu.innerHTML = '<div data-amp-context-menu-scroll><div role="menuitem" class="item">Open Thread</div><div role="separator" class="sep"></div><div role="menuitem" class="item">Rename</div></div>';
      document.body.append(menu);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelector('[data-amp-context-menu]')?.remove(); });
    // The archive command: record payloads, and report T-d as not archivable.
    window.archiveRequests = [];
    window.failArchive = false;
    window.archiveDelay = 0;
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      if (!String(input).includes('/_app/remote/')) return realFetch(input, init);
      const body = JSON.parse(init.body);
      const base64 = body.payload.replaceAll('-', '+').replaceAll('_', '/');
      const payload = new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
      window.archiveRequests.push({ url: String(input), method: init.method, payload });
      await new Promise(resolve => setTimeout(resolve, window.archiveDelay));
      if (window.failArchive) return new Response('{"type":"error","error":{"message":"down"}}', { status: 500 });
      const values = JSON.parse(payload);
      const ids = values[values[0].threadIDs].map(index => values[index]).filter(id => id !== 'T-d');
      const data = JSON.stringify([{ _: 1 }, { updatedThreadIDs: 2 }, ids.map((_, i) => 3 + i), ...ids]);
      return new Response(JSON.stringify({ type: 'result', data }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    // In manifest order: thread-split.js sees row presses first.
    for (const src of ['/thread-split.js', '/batch-archive.js']) await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = src; script.onload = resolve; document.head.append(script);
    });
    // Amp's popovers (bits-ui) close on an outside press seen on document.
    window.outsidePresses = 0;
    document.addEventListener('pointerdown', () => { outsidePresses++; }, true);
    // Amp's own multi-select (behind a flag) takes modified row clicks on window, capture phase.
    window.addEventListener('click', event => {
      if ((event.shiftKey || event.metaKey || event.ctrlKey) && event.target.closest?.('[data-sidebar-thread-id]')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  })()`);

  eventually('document.querySelector(".sidebar-toolbar [data-amp-batch-button]")?.getAttribute("aria-pressed") === "false"', 'header offers a select button');
  check('document.querySelector("[data-amp-batch-button]").nextElementSibling?.matches("[data-amp-sidebar-toggle], [data-amp-settings-button]")', 'select button sits before the placement switch and settings');
  check('!document.querySelector("[data-amp-batch-bar], [data-amp-batch-group]")', 'nothing else appears until selecting');

  // Right-click a row: Amp's menu gains Select Threads, which starts a selection.
  rightClick('[data-sidebar-thread-id="T-a"]');
  eventually(`${menuLabels} === JSON.stringify(["Select Threads"])`, 'row menu offers Select Threads after Amp items');
  check('document.querySelector("[data-amp-batch-menu-item][role=menuitem]").className === document.querySelector("[data-amp-context-menu] .item").className', 'injected item reuses Amp item styling');
  click('[data-amp-batch-menu-item][role=menuitem]');
  eventually(`!document.querySelector("[data-amp-context-menu]") && ${selectedIDs} === JSON.stringify(["T-a"])`, 'Select Threads closes the menu and selects the row');
  eventually('document.querySelector("[data-amp-batch-bar] span").textContent === "1 selected"', 'action bar shows the count');

  mouseClick('[data-sidebar-thread-id="T-c"]', true);
  eventually(`${selectedIDs} === JSON.stringify(["T-a","T-b","T-c"])`, 'Shift-click selects the range');
  mouseClick('[data-sidebar-thread-id="T-b"]');
  eventually(`${selectedIDs} === JSON.stringify(["T-a","T-c"])`, 'click toggles one row off');
  check('navigations === 0', 'selection clicks do not open threads');
  check(`(async () => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.querySelector('[data-slot="sidebar-container"]'), { childList: true, subtree: true, characterData: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    observer.disconnect();
    return count === 0;
  })()`, 'an idle selection makes no further DOM changes');

  // Group select all, then archive with a confirmation naming running threads.
  eventually('document.querySelector("[data-sidebar-project-hover-id=p1] [data-amp-batch-group]")?.textContent === "Select all"', 'group heading offers Select all while selecting');
  click('[data-sidebar-project-hover-id=p1] [data-amp-batch-group]');
  eventually(`${selectedIDs} === JSON.stringify(["T-a","T-b","T-c","T-d"])`, 'Select all adds every row in the group');
  eventually('document.querySelector("[data-sidebar-project-hover-id=p1] [data-amp-batch-group]").getAttribute("aria-pressed") === "true"', 'group control switches to Clear');
  check('!document.querySelector("[data-sidebar-thread-id=T-x]").closest("[data-amp-batch-selected]")', 'other groups stay unselected');
  check('!document.querySelector("[data-sidebar-project-hover-id=p0] [data-amp-batch-group]")', 'an empty project offers nothing to select');
  check('!document.querySelector("[data-test-archived] [data-amp-batch-group]")', 'the Archived group offers nothing to select');
  mouseClick('[data-sidebar-thread-id="T-old"]');
  check(`navigations === 1 && !${selectedIDs}.includes("T-old")`, 'an archived row is not selectable');
  evaluate('window.outsidePresses = 0; window.navigations = 0');
  mouseClick('[data-sidebar-thread-id="T-c"]');
  mouseClick('[data-sidebar-thread-id="T-c"]');
  eventually(`outsidePresses === 2 && navigations === 0 && document.activeElement === document.querySelector("[data-sidebar-thread-id=T-c]") && ${selectedIDs} === JSON.stringify(["T-a","T-b","T-c","T-d"])`, 'row presses reach Amp popovers, focus the row, and do not navigate');
  evaluate('window.navigations = 1');
  for (const id of ['T-pucks', 'T-space']) mouseClick(`[data-sidebar-thread-id="${id}"]`);
  check(`navigations === 3 && !/T-pucks|T-space/.test(${selectedIDs}) && ["T-pucks", "T-space"].every(id => getComputedStyle(document.querySelector("[data-sidebar-thread-id=" + id + "]").closest("li"), "::before").content === "none")`, 'Spaces are not selectable');
  check('getComputedStyle(document.querySelector("[data-sidebar-thread-id=T-old]").closest("li"), "::before").content === "none" && getComputedStyle(document.querySelector("[data-sidebar-thread-id=T-a]").closest("li"), "::before").content !== "none"', 'an archived row shows no checkbox, other rows do');
  evaluate('window.navigations = 0');
  evaluate('document.querySelector("[data-sidebar-project-hover-id=p1] button").setAttribute("aria-expanded", "false")');
  eventually('!document.querySelector("[data-sidebar-project-hover-id=p1] [data-amp-batch-group]")', 'collapsing a group removes its Select all');
  evaluate('document.querySelector("[data-sidebar-project-hover-id=p1] button").setAttribute("aria-expanded", "true")');
  eventually('document.querySelector("[data-sidebar-project-hover-id=p1] [data-amp-batch-group]")', 'expanding it brings Select all back');
  // A held key toggles once.
  evaluate('document.querySelector("[data-sidebar-thread-id=T-c]").dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true, cancelable: true }))');
  check(`${selectedIDs} === JSON.stringify(["T-a","T-b","T-c","T-d"])`, 'a repeated key does not toggle again');
  shot('selecting');
  click('[data-amp-batch-bar] [data-amp-batch-primary]');
  eventually('document.querySelector("[data-amp-batch-dialog][open] h2")?.textContent === "Archive 4 Threads?"', 'confirmation names the count');
  check('(d => d.querySelector("#" + d.getAttribute("aria-labelledby")).tagName === "H2" && d.querySelector("#" + d.getAttribute("aria-describedby")).tagName === "P")(document.querySelector("[data-amp-batch-dialog]"))', 'confirmation is labelled and described');
  check('document.querySelector("[data-amp-batch-dialog] p").textContent.includes("1 of 4 threads is running. Archiving will stop it")', 'confirmation warns about running threads');
  shot('confirm');
  click('[data-amp-batch-dialog] button[value=archive]');
  eventually('archiveRequests.length === 1', 'one batch request for the selection');
  check(`archiveRequests[0].url === '/_app/remote/145jw2/setThreadsArchivedCommand' && archiveRequests[0].method === 'POST' &&
    archiveRequests[0].payload === '[{"threadIDs":1,"archived":6},[2,3,4,5],"T-a","T-b","T-c","T-d",true]'`, 'request uses Amp\'s command with a devalue payload in sidebar order');
  eventually(`${archivedIDs} === JSON.stringify(["T-a","T-b","T-c"])`, 'only threads Amp archived are hidden');
  eventually('getComputedStyle(document.querySelector("[data-sidebar-thread-id=T-a]").closest("li")).display === "none"', 'archived rows leave the layout after filing away');
  eventually('document.querySelector("[data-amp-batch-toast]")?.textContent === "Archived 3 of 4 threads. Only a thread\'s creator can archive the other 1.Undo"', 'toast reports the partial result with Undo');
  check(`${selectedIDs} === JSON.stringify(["T-d"]) && document.querySelector("[data-amp-batch-bar]")`, 'the unarchived thread stays selected');
  shot('archived');

  // A second archive while Undo is offered: Undo then restores both.
  mouseClick('[data-sidebar-thread-id="T-x"]');
  eventually(`${selectedIDs} === JSON.stringify(["T-d","T-x"])`, 'another row joins the selection');
  click('[data-amp-batch-bar] [data-amp-batch-primary]');
  eventually('document.querySelector("[data-amp-batch-dialog][open]")', 'second confirmation opens');
  click('[data-amp-batch-dialog] button[value=archive]');
  eventually('document.querySelector("[data-amp-batch-toast]")?.textContent === "Archived 1 of 2 threads. Only a thread\'s creator can archive the other 1.Undo"', 'second archive reports its own result');
  click('[data-amp-batch-toast] button');
  eventually('archiveRequests.length === 3 && archiveRequests[2].payload.endsWith(",false]")', 'Undo unarchives');
  check(`(() => { const v = JSON.parse(archiveRequests[2].payload); return v[v[0].threadIDs].map(i => v[i]).join() === "T-a,T-b,T-c,T-x"; })()`, 'Undo covers both archives and only archived IDs');
  eventually(`${archivedIDs} === "[]"`, 'Undo shows the rows again');

  // Project heading menu: archive every thread shown in the project.
  rightClick('[data-sidebar-project-hover-id=p1] [data-testid="sidebar-thread-group-header"]');
  eventually(`${menuLabels} === JSON.stringify(["Archive All 5 Threads","Select Threads in Group"])`, 'project Archive All includes the collapsed subthread');
  shot('project-menu');
  click('[data-amp-batch-menu-item][role=menuitem]');
  eventually('document.querySelector("[data-amp-batch-dialog][open] p")?.textContent.startsWith("Archive all 5 threads listed under amp-configurable-defaults.")', 'project archive confirms with the project name');
  click('[data-amp-batch-dialog] button[value=cancel]');
  eventually('!document.querySelector("[data-amp-batch-dialog]")', 'Cancel closes the confirmation');
  check('archiveRequests.length === 3', 'Cancel sends nothing');
  rightClick('[data-sidebar-project-hover-id=p0] [data-testid="sidebar-thread-group-header"]');
  eventually(`${menuLabels} === JSON.stringify(["No Threads Loaded to Archive","Select Threads in Group"])`, 'an empty project does not borrow the next section');
  browser('keydown', 'Escape');
  browser('keyup', 'Escape');
  eventually('!document.querySelector("[data-amp-context-menu]")', 'menu closes');

  // Row menu while selecting.
  rightClick('[data-sidebar-thread-id="T-b"]');
  eventually(`${menuLabels} === JSON.stringify(["Add to Selection","Archive 1 Selected","Clear Selection"])`, 'row menu while selecting offers selection actions');
  browser('keydown', 'Escape');
  browser('keyup', 'Escape');
  eventually('!document.querySelector("[data-amp-context-menu]")', 'Escape closes the menu');
  check('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(Boolean(document.querySelector("[data-amp-batch-bar]"))))))', 'closing the menu with Escape keeps the selection');
  check(`document.querySelector("[data-sidebar-thread-id=T-d]").getAttribute("aria-description") === "Selected" && !document.querySelector("[data-sidebar-thread-id=T-b]").hasAttribute("aria-description")`, 'screen readers hear which rows are selected');
  rightClick('[data-sidebar-thread-id="T-b"]');
  eventually('document.querySelector("[data-amp-context-menu]")', 'row menu opens again');
  // The menu covers T-b, so dispatch the press; Shift extends from the last row, T-x.
  mouseClick('[data-sidebar-thread-id="T-b"]', true);
  eventually(`!document.querySelector("[data-amp-context-menu]") && ${selectedIDs} === JSON.stringify(["T-b","T-c","T-d","T-x"])`, 'pressing a row closes the open menu and selects');
  check('!document.querySelector("[data-sidebar-thread-id=T-b]").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, button: 0 }))', 'double-click does not start a rename');
  for (const id of ['T-b', 'T-c', 'T-x']) mouseClick(`[data-sidebar-thread-id="${id}"]`);
  // A plain mouse press, which thread-split.js would otherwise take, closes the menu too.
  const split = '[data-sidebar-thread-id="T-00000000-0000-0000-0000-000000000001"]';
  // T-a's menu opens well above the split row, so the press reaches the row.
  rightClick('[data-sidebar-thread-id="T-a"]');
  eventually('document.querySelector("[data-amp-context-menu]")', 'row menu opens over the selection');
  mouseClick(split);
  eventually(`!document.querySelector("[data-amp-context-menu]") && document.querySelector(${JSON.stringify(split)}).closest("[data-amp-batch-selected]") && !document.querySelector(${JSON.stringify(split)}).hasAttribute("draggable")`, 'a plain press on a thread-split row closes the menu and selects');
  mouseClick(split);
  eventually(`${selectedIDs} === JSON.stringify(["T-d"])`, 'clicks restore the selection');
  evaluate('document.querySelector("#message").focus()');
  browser('keydown', 'Escape');
  browser('keyup', 'Escape');
  check('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(Boolean(document.querySelector("[data-amp-batch-bar]"))))))', 'Escape in the composer leaves the selection alone');
  evaluate('document.activeElement.blur()');
  evaluate(`(() => { const p = document.createElement('div'); p.id = 'test-popover'; p.popover = 'auto'; p.textContent = 'Thread info'; document.body.append(p); p.showPopover(); return true; })()`);
  // Native popovers close only on a full press; return the tab to the front after it (see spaces.mjs).
  browser('press', 'Escape');
  browser('tab', JSON.parse(browser('--json', 'tab', 'list')).data.tabs.find(tab => tab.active).tabId);
  check('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(!document.querySelector("#test-popover:popover-open") && Boolean(document.querySelector("[data-amp-batch-bar]"))))))', 'Escape closes an open popover, not the selection');
  evaluate('document.querySelector("#test-popover").remove()');

  // A failed request changes nothing.
  evaluate('failArchive = true');
  click('[data-amp-batch-bar] [data-amp-batch-primary]');
  eventually('document.querySelector("[data-amp-batch-dialog][open]")', 'confirmation opens for the selection');
  // Clicking the dialog's text leaves focus on body; Escape then cancels the dialog only.
  evaluate('document.activeElement.blur()');
  browser('press', 'Escape');
  browser('tab', JSON.parse(browser('--json', 'tab', 'list')).data.tabs.find(tab => tab.active).tabId);
  eventually('!document.querySelector("[data-amp-batch-dialog][open]") && Boolean(document.querySelector("[data-amp-batch-bar]"))', 'Escape in the confirmation cancels it, not the selection');
  click('[data-amp-batch-bar] [data-amp-batch-primary]');
  eventually('document.querySelector("[data-amp-batch-dialog][open]")', 'confirmation reopens');
  check('!document.querySelector("[data-amp-batch-dialog] button[value=archive]").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true })) && document.querySelector("[data-amp-batch-dialog][open]")', 'a held Enter does not confirm');
  click('[data-amp-batch-dialog] button[value=archive]');
  eventually('document.querySelector("[data-amp-batch-toast]")?.textContent === "Archive failed, so no threads changed. Try again."', 'failure is reported');
  check(`${archivedIDs} === "[]" && ${selectedIDs} === JSON.stringify(["T-d"])`, 'failure keeps rows and selection');
  // A search hides rows without removing them from the selection.
  evaluate(`(() => { const input = document.createElement('input'); input.id = 'test-search'; input.value = 'Release'; document.querySelector('[data-slot="sidebar-inner"]').prepend(input);
    document.querySelector("[data-sidebar-thread-id=T-d]").closest("li").remove(); return true; })()`);
  check('new Promise(resolve => setTimeout(() => resolve(document.querySelector("[data-amp-batch-bar] span").textContent === "1 selected"), 200))', 'a search keeps hidden rows selected');
  evaluate('document.querySelector("#test-search").remove()');
  eventually(`${selectedIDs} === "[]" && document.querySelector("[data-amp-batch-bar] span").textContent === "Click threads to select"`, 'a row Amp removes leaves the selection');

  // Archiving a one-thread project with an empty selection keeps selection mode.
  evaluate('failArchive = false');
  rightClick('[data-sidebar-project-hover-id=p2] [data-testid="sidebar-thread-group-header"]');
  eventually(`${menuLabels} === JSON.stringify(["Archive 1 Thread","Select Threads in Group"])`, 'a one-thread project reads Archive 1 Thread');
  click('[data-amp-batch-menu-item][role=menuitem]');
  eventually('document.querySelector("[data-amp-batch-dialog][open]")', 'project confirmation opens');
  // T-y is the open thread; record where archiving it navigates.
  evaluate(`(() => { window.fixturePath = location.pathname; history.replaceState(null, '', '/threads/T-y'); window.leftTo = [];
    document.addEventListener('click', event => { const a = event.target.closest?.('a[hidden]'); if (a) { event.preventDefault(); leftTo.push(a.getAttribute('href')); } }, true); return true; })()`);
  evaluate('window.archiveDelay = 5000');
  click('[data-amp-batch-dialog] button[value=archive]');
  const toastText = 'document.querySelector("[data-amp-batch-toast]")?.textContent';
  eventually(`${toastText} === "Archiving 1 thread…"`, 'a slow archive shows progress');
  check('document.querySelector("[data-amp-batch-bar] [data-amp-batch-primary]").getAttribute("aria-disabled") === "true"', 'the bar marks Archive busy without disabling focus');
  rightClick('[data-sidebar-project-hover-id=p1] [data-testid="sidebar-thread-group-header"]');
  eventually('document.querySelector("[data-amp-batch-menu-item][role=menuitem]")', 'project menu opens during the archive');
  click('[data-amp-batch-menu-item][role=menuitem]');
  eventually(`${toastText} === "Wait for the current archive or Undo to finish."`, 'a second archive waits');
  check(`new Promise(resolve => setTimeout(() => resolve(${toastText} === "Archiving 1 thread…"), 4300))`, 'progress returns after the wait message');
  evaluate('window.archiveDelay = 0');
  eventually(`${archivedIDs} === JSON.stringify(["T-y"])`, 'project archive archives its thread');
  check('leftTo.length === 1 && leftTo[0].endsWith("/threads/T-00000000-0000-0000-0000-000000000001")', 'archiving the open thread moves to the previous row, like Amp');
  evaluate('history.replaceState(null, "", fixturePath)');
  check('Boolean(document.querySelector("[data-amp-batch-bar]"))', 'an empty selection stays in selection mode');

  // A right-click that opens no Amp menu must not add items to a later menu.
  // All in one step, well inside the 500 ms window, so only the keypress clears the target.
  evaluate(`(() => {
    const heading = document.querySelector('.amp-test-groups li:not(:has([data-sidebar-project-hover-id])) > div.sidebar-thread-heading [data-testid="sidebar-thread-group-header"]');
    heading.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    const m = document.createElement('div'); m.setAttribute('data-amp-context-menu', ''); m.innerHTML = '<div data-amp-context-menu-scroll><div role="menuitem">Other</div></div>'; document.body.append(m);
    return true; })()`);
  check(`new Promise(r => setTimeout(() => r(${menuLabels} === "[]"), 100))`, 'no items join a menu opened by other means');
  evaluate('document.querySelector("[data-amp-context-menu]").remove()');

  evaluate('document.querySelector("[data-amp-batch-bar] button").focus()');
  browser('keydown', 'Escape');
  browser('keyup', 'Escape');
  eventually('!document.querySelector("[data-amp-batch-bar], [data-amp-batch-group], [data-amp-batch-selected], [data-amp-batch-selecting]")', 'Escape ends the selection');
  check('document.activeElement === document.querySelector("[data-amp-batch-button]")', 'focus moves from the bar to the select button');
  mouseClick('[data-sidebar-thread-id="T-c"]');
  check('navigations === 1', 'rows open threads again after selecting');

  evaluate('chrome.storage.local.set({ batchArchive: false })');
  eventually('!document.querySelector("[data-amp-batch-button]")', 'turning the setting off removes the select button');
  rightClick('[data-sidebar-thread-id="T-a"]');
  eventually('document.querySelector("[data-amp-context-menu]")', 'Amp menu still opens');
  check(`${menuLabels} === "[]"`, 'no menu items when the setting is off');
  evaluate('chrome.storage.local.set({ batchArchive: true })');
  eventually('document.querySelector("[data-amp-batch-button]")', 'turning it back on restores the button');
  console.log('All batch archive checks passed.');
} finally {
  try { browser('close'); } catch {}
}

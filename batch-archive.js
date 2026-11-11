(() => {
  const desktop = matchMedia("(min-width: 768px)");
  const sidebarSelector = '[data-slot="sidebar-container"]';
  // Rows in Amp's Archived group are already archived. Spaces archive with their
  // child threads through their own command, which Amp's batch archive also leaves out.
  const threadSelector = '[data-sidebar-thread-id]:not([data-sidebar-group-id="archived"], [data-sidebar-group-id^="project-pucks"], :has([data-thread-row-space-active], [data-thread-row-space-members]))';
  const rowSelector = `${sidebarSelector} ${threadSelector}`;
  const headingSelector = `${sidebarSelector} [data-testid="sidebar-thread-group-header"]`;
  const ignoredTargets = 'button, input, textarea, [contenteditable="true"], [data-thread-row-header-popover]';
  const icons = {
    select: "M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17M11 6h10M11 12h10M11 18h10",
    archive: "M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4",
    clear: "M18 6 6 18M6 6l12 12",
  };
  let enabled = false;
  let selecting = false;
  let selected = new Set();
  let anchor = null;
  let pending = false;
  let busy = false;

  // Archiving uses the same batch command as Amp's own multi-select. Its ID is
  // a hash of Amp's source path, so rediscover it from loaded chunks if it moves.
  let commandID = "145jw2";
  const commandName = "setThreadsArchivedCommand";

  // SvelteKit remote functions take a devalue-encoded payload in base64url.
  function encodePayload(value) {
    const values = [];
    const seen = new Map();
    const flatten = item => {
      if (seen.has(item)) return seen.get(item);
      const index = values.length;
      seen.set(item, index);
      values.push(null);
      values[index] = Array.isArray(item) ? `[${item.map(flatten).join(",")}]`
        : item && typeof item === "object" ? `{${Object.entries(item).map(([key, entry]) => `${JSON.stringify(key)}:${flatten(entry)}`).join(",")}}`
        : JSON.stringify(item);
      return index;
    };
    flatten(value);
    const bytes = new TextEncoder().encode(`[${values.join(",")}]`);
    return btoa(String.fromCharCode(...bytes)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
  }

  // Enough of devalue's format for the command's plain result object.
  function decodeResult(text) {
    const values = JSON.parse(text);
    if (!Array.isArray(values)) return undefined;
    const done = new Map();
    const hydrate = index => {
      if (index < 0 || index >= values.length) return undefined;
      if (done.has(index)) return done.get(index);
      const value = values[index];
      if (Array.isArray(value)) {
        if (typeof value[0] === "string") return undefined;
        const list = [];
        done.set(index, list);
        for (const item of value) list.push(hydrate(item));
        return list;
      }
      if (value && typeof value === "object") {
        const object = {};
        done.set(index, object);
        for (const [key, item] of Object.entries(value)) object[key] = hydrate(item);
        return object;
      }
      done.set(index, value);
      return value;
    };
    return hydrate(0);
  }

  async function discoverCommandID() {
    const urls = new Set([...document.querySelectorAll('link[rel="modulepreload"], script[src]')].map(node => node.href || node.src));
    for (const entry of performance.getEntriesByType("resource")) urls.add(entry.name);
    const pattern = new RegExp(`[\`"']([\\w-]+)/${commandName}[\`"']`);
    for (const url of urls) {
      if (!/^https:\/\/ampcode\.com\/_app\/immutable\/.+\.js$/.test(url)) continue;
      const match = (await fetch(url, { cache: "force-cache" }).then(response => response.text()).catch(() => ""))
        .match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async function setArchived(threadIDs, archived, retry = true) {
    const response = await fetch(`/_app/remote/${commandID}/${commandName}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-sveltekit-pathname": location.pathname, "x-sveltekit-search": location.search },
      body: JSON.stringify({ payload: encodePayload({ threadIDs, archived }), refreshes: [] }),
    });
    if (response.status === 404 && retry) {
      const id = await discoverCommandID();
      if (id && id !== commandID) {
        commandID = id;
        return setArchived(threadIDs, archived, false);
      }
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.type !== "result") throw new Error(`Archive request: ${response.status}`);
    const result = body.data ? decodeResult(body.data)?._ : undefined;
    // Amp reports which threads changed; others may belong to someone else.
    return Array.isArray(result?.updatedThreadIDs) ? result.updatedThreadIDs : threadIDs;
  }

  // Stops at the first failed request; `sent` counts IDs Amp answered for.
  async function setArchivedInChunks(threadIDs, archived) {
    const updated = [];
    let sent = 0;
    for (; sent < threadIDs.length; sent += 100) {
      try {
        updated.push(...await setArchived(threadIDs.slice(sent, sent + 100), archived));
      } catch {
        break;
      }
    }
    sent = Math.min(sent, threadIDs.length);
    return { updated, sent, failed: sent < threadIDs.length };
  }

  const rowID = row => row.dataset.sidebarThreadId || null;
  const rowItem = row => row.closest('[data-slot="sidebar-menu-item"]') ?? row;
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const capital = (count, word) => count === 1 ? word : `${count} ${word}s`;

  function threadRow(target) {
    if (!enabled || !desktop.matches || !(target instanceof Element) || target.closest(ignoredTargets)) return null;
    return target.closest(rowSelector);
  }

  // Rows in reading order, skipping collapsed subthreads, for Shift ranges.
  function visibleRows() {
    return [...document.querySelectorAll(rowSelector)].filter(row => !row.closest("[inert]") &&
      !rowItem(row).hasAttribute("data-amp-batch-archived"));
  }

  // A group heading's rows sit in the list item that follows its wrapper: the
  // first sibling after the heading's own markup. An empty group ends there too,
  // rather than borrowing the next section's rows.
  function groupRows(heading) {
    const sidebar = heading.closest(sidebarSelector);
    for (let node = heading.parentElement; node && node !== sidebar; node = node.parentElement) {
      const list = node.nextElementSibling;
      if (!list) continue;
      if (list.querySelector('[data-testid="sidebar-thread-group-header"]')) return [];
      return [...list.querySelectorAll(threadSelector)]
        .filter(row => !rowItem(row).hasAttribute("data-amp-batch-archived"));
    }
    return [];
  }
  // Selecting works on rows you can see; a collapsed group or subthread is inert.
  const shownGroupRows = heading => groupRows(heading).filter(row => !row.closest("[inert]"));

  // Rewriting equal text still replaces the node, which would wake the observer.
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const groupName = heading => (heading.querySelector(".truncate")?.textContent || heading.textContent).replace(/\s+/g, " ").trim();
  const uniqueIDs = rows => [...new Set(rows.map(rowID).filter(Boolean))];

  function sync() {
    pending = false;
    for (const sidebar of document.querySelectorAll(sidebarSelector)) {
      sidebar.toggleAttribute("data-amp-batch-selecting", selecting && enabled);
    }
    const rows = document.querySelectorAll(rowSelector);
    // Drop threads whose rows Amp removed, such as ones archived elsewhere,
    // but not while a sidebar search hides rows.
    const searching = [...document.querySelectorAll(`${sidebarSelector} input`)].some(input => input.value.trim());
    if (selecting && rows.length && !searching) {
      const present = new Set([...rows].map(rowID));
      for (const id of selected) if (!present.has(id)) selected.delete(id);
    }
    for (const row of rows) {
      const on = selecting && selected.has(rowID(row));
      rowItem(row).toggleAttribute("data-amp-batch-selected", on);
      // The checkbox is drawn in CSS, so tell screen readers too.
      if (on) row.setAttribute("aria-description", "Selected");
      else if (row.getAttribute("aria-description") === "Selected") row.removeAttribute("aria-description");
    }
    syncHeader();
    syncGroups();
    syncBar();
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(sync);
  }

  function setSelecting(value) {
    selecting = value && enabled;
    if (!selecting) {
      selected = new Set();
      anchor = null;
    }
    schedule();
  }

  function toggle(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    anchor = id;
    schedule();
  }

  function selectRange(id) {
    const ids = uniqueIDs(visibleRows());
    const from = ids.indexOf(anchor ?? id);
    const to = ids.indexOf(id);
    if (from === -1 || to === -1) return toggle(id);
    for (const item of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) selected.add(item);
    schedule();
  }

  function selectGroup(heading, add) {
    for (const id of uniqueIDs(shownGroupRows(heading))) {
      if (add) selected.add(id);
      else selected.delete(id);
    }
    schedule();
  }

  // Header: a selection switch beside the placement switch and settings button.
  function syncHeader() {
    for (const header of document.querySelectorAll(`${sidebarSelector} .sidebar-toolbar`)) {
      let button = header.querySelector("[data-amp-batch-button]");
      if (!enabled) {
        button?.remove();
        continue;
      }
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-amp-batch-button", "");
        button.append(globalThis.ampIcon(icons.select));
        button.addEventListener("click", () => setSelecting(!selecting));
      }
      const next = header.querySelector("[data-amp-sidebar-toggle], [data-amp-settings-button]");
      if (next && button.nextElementSibling !== next) next.before(button);
      else if (!next && !button.isConnected) header.append(button);
      button.setAttribute("aria-pressed", String(selecting));
      const label = selecting ? "Stop selecting threads" : "Select threads to archive";
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }

  // While selecting, each group heading offers select all and clear.
  function syncGroups() {
    for (const heading of document.querySelectorAll(headingSelector)) {
      const host = heading.parentElement;
      let button = host.querySelector(":scope > [data-amp-batch-group]");
      // Amp keeps a collapsed group's rows mounted but inert; offer only open groups.
      const ids = selecting && enabled && heading.getAttribute("aria-expanded") !== "false" ? uniqueIDs(shownGroupRows(heading)) : [];
      if (!ids.length) {
        button?.remove();
        continue;
      }
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-amp-batch-group", "");
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          selectGroup(heading, button.getAttribute("aria-pressed") !== "true");
        });
      }
      if (button.parentElement !== host || button !== host.lastElementChild) host.append(button);
      const all = ids.every(id => selected.has(id));
      const name = groupName(heading);
      button.setAttribute("aria-pressed", String(all));
      setText(button, all ? "Clear" : "Select all");
      button.title = `${all ? "Clear" : "Select all"} ${plural(ids.length, "thread")} in ${name}`;
      button.setAttribute("aria-label", button.title);
    }
  }

  // The selection's actions sit at the bottom of the sidebar.
  let bar = null;
  let barCount = null;
  let barArchive = null;
  function syncBar() {
    const sidebar = document.querySelector(sidebarSelector);
    if (!selecting || !enabled || !desktop.matches || !sidebar) {
      // Keep keyboard focus nearby instead of dropping it to the page.
      if (bar?.contains(document.activeElement)) document.querySelector("[data-amp-batch-button]")?.focus();
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.setAttribute("data-amp-batch-bar", "");
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("aria-label", "Selected threads");
      barCount = document.createElement("span");
      barCount.setAttribute("aria-live", "polite");
      const all = document.createElement("button");
      all.type = "button";
      all.textContent = "Select all";
      all.title = "Select every thread shown in the sidebar";
      all.addEventListener("click", () => {
        for (const id of uniqueIDs(visibleRows())) selected.add(id);
        schedule();
      });
      barArchive = document.createElement("button");
      barArchive.type = "button";
      barArchive.setAttribute("data-amp-batch-primary", "");
      barArchive.append(globalThis.ampIcon(icons.archive), "Archive");
      barArchive.addEventListener("click", () => archiveSelected());
      const close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", "Stop selecting threads");
      close.title = "Stop selecting (Escape)";
      close.append(globalThis.ampIcon(icons.clear));
      close.addEventListener("click", () => setSelecting(false));
      bar.append(barCount, all, barArchive, close);
    }
    // Sit above Amp's footer in the sidebar's own column, so nothing is covered.
    const footer = sidebar.querySelector('[data-slot="sidebar-footer"]');
    const parent = footer?.parentElement ?? sidebar.querySelector('[data-slot="sidebar-inner"]') ?? sidebar;
    if (bar.parentElement !== parent || (footer && bar.nextElementSibling !== footer)) parent.insertBefore(bar, footer);
    setText(barCount, selected.size ? `${selected.size} selected` : "Click threads to select");
    // Busy only marks the button: disabling it would drop keyboard focus.
    barArchive.disabled = selected.size === 0;
    if (busy) barArchive.setAttribute("aria-disabled", "true");
    else barArchive.removeAttribute("aria-disabled");
  }

  // Confirmation matches Amp's own wording for running threads.
  function confirmArchive(ids, place) {
    const running = ids.filter(id => document.querySelector(`${rowSelector}[data-sidebar-thread-id="${CSS.escape(id)}"] :is([data-thread-row-running-icon], [data-thread-row-spinner])`)).length;
    const dialog = document.createElement("dialog");
    dialog.setAttribute("data-amp-batch-dialog", "");
    const title = document.createElement("h2");
    title.id = "amp-batch-dialog-title";
    dialog.setAttribute("aria-labelledby", title.id);
    title.textContent = `Archive ${capital(ids.length, "Thread")}?`;
    const text = document.createElement("p");
    text.id = "amp-batch-dialog-text";
    dialog.setAttribute("aria-describedby", text.id);
    text.textContent = [
      // Counts every loaded thread under the heading, including collapsed ones.
      place ? `Archive ${ids.length === 1 ? "the thread" : `all ${ids.length} threads`} listed under ${place}.` : "",
      running === 0 ? "" : running === ids.length && running === 1 ? "This thread is running. Archiving will stop it and delete any queued messages."
        : `${running} of ${plural(ids.length, "thread")} ${running === 1 ? "is" : "are"} running. Archiving will stop ${running === 1 ? "it" : "them"} and delete any queued messages.`,
      "Archiving also pauses any enabled automations and their orbs.",
      "You can unarchive threads at any time.",
    ].filter(Boolean).join(" ");
    const form = document.createElement("form");
    form.method = "dialog";
    const cancel = document.createElement("button");
    cancel.value = "cancel";
    cancel.textContent = "Cancel";
    const confirm = document.createElement("button");
    confirm.value = "archive";
    confirm.autofocus = true;
    confirm.setAttribute("data-amp-batch-primary", "");
    confirm.textContent = `Archive ${capital(ids.length, "Thread")}`;
    form.append(cancel, confirm);
    dialog.append(title, text, form);
    document.body.append(dialog);
    // A held Enter that opened the dialog must not also confirm it.
    dialog.addEventListener("keydown", event => { if (event.repeat) event.preventDefault(); }, true);
    dialog.showModal();
    return new Promise(resolve => dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(dialog.returnValue === "archive");
    }, { once: true }));
  }

  let toast = null;
  let toastTimer = 0;
  // Progress toasts stay until the result replaces them.
  let progress = "";
  function showProgress(message) {
    progress = message;
    showToast(message, null, null, true);
  }
  function showToast(message, action, expire, persist) {
    clearTimeout(toastTimer);
    toast ??= document.createElement("div");
    toast.setAttribute("data-amp-batch-toast", "");
    toast.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = message;
    toast.replaceChildren(text);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        clearTimeout(toastTimer);
        toast.remove();
        action.run();
      }, { once: true });
      toast.append(button);
    }
    if (!toast.isConnected) document.body.append(toast);
    if (persist) return;
    toastTimer = setTimeout(() => {
      toast.remove();
      expire?.();
    }, action ? 8000 : 4000);
  }

  // Undo covers every archive since its offer appeared, so a quick second
  // archive does not strand the first one.
  let undoable = [];
  function showResult(message) {
    if (!undoable.length) return showToast(message);
    showToast(message, { label: "Undo", run: () => {
      const ids = undoable;
      undoable = [];
      void unarchive(ids);
    } }, () => { undoable = []; });
  }

  // Hide archived rows at once; Amp's live sidebar update then removes them.
  function markArchived(ids, archived) {
    const set = new Set(ids);
    for (const row of document.querySelectorAll(rowSelector)) {
      if (set.has(rowID(row))) rowItem(row).toggleAttribute("data-amp-batch-archived", archived);
    }
  }

  // Like Amp's own archive, leave the open thread when it was archived.
  function leaveArchived(updated) {
    const current = location.pathname.match(/\/threads\/(T-[\w-]+)/)?.[1];
    if (!current || !updated.includes(current)) return;
    const done = new Set(updated);
    const rows = visibleRows();
    const index = rows.findIndex(row => rowID(row) === current);
    const open = row => !done.has(rowID(row)) && row.href;
    const next = rows.slice(index + 1).find(open) ?? rows.slice(0, Math.max(index, 0)).findLast(open);
    // A plain link, so Amp's router navigates without a reload.
    const link = document.createElement("a");
    link.href = next?.href ?? "/";
    link.hidden = true;
    (document.querySelector(sidebarSelector) ?? document.body).append(link);
    link.click();
    link.remove();
  }

  async function archive(ids, place) {
    if (busy) return showToast("Wait for the current archive or Undo to finish.", null, () => { if (busy) showProgress(progress); });
    if (!ids.length || !await confirmArchive(ids, place)) return;
    // Leave selection mode only when this archive empties a selection; read it
    // first, since Amp may remove archived rows while the request runs.
    const hadSelection = selected.size > 0;
    busy = true;
    schedule();
    showProgress(`Archiving ${plural(ids.length, "thread")}…`);
    const { updated, sent } = await setArchivedInChunks(ids, true);
    busy = false;
    leaveArchived(updated);
    markArchived(updated, true);
    for (const id of updated) selected.delete(id);
    if (hadSelection && !selected.size) setSelecting(false);
    else schedule();
    // Amp skips threads the viewer did not create; requests after a failure were never sent.
    const requested = new Set(ids);
    const archived = updated.filter(id => requested.has(id)).length;
    const skipped = sent - archived;
    const unsent = ids.length - sent;
    // A failed archive keeps offering Undo for an earlier one; say so.
    const earlier = undoable.length ? " Undo restores the earlier archive." : "";
    undoable = [...new Set([...undoable, ...updated])];
    if (sent === 0) return showResult(`Archive failed, so no threads changed. Try again.${earlier}`);
    if (!archived && !unsent) return showResult(`Amp archived none of these. Only a thread's creator can archive it.${earlier}`);
    if (!skipped && !unsent) return showResult(`Archived ${plural(archived, "thread")}`);
    const notes = [
      skipped ? (unsent ? `Only a thread's creator can archive ${skipped} of them.` : `Only a thread's creator can archive the other ${skipped}.`) : "",
      unsent ? `The last ${unsent} failed; try again.` : "",
    ];
    showResult([`Archived ${archived} of ${plural(ids.length, "thread")}.`, ...notes].filter(Boolean).join(" "));
  }

  async function unarchive(ids) {
    // Busy here too, so an archive cannot start an Undo offer this toast would replace.
    busy = true;
    schedule();
    showProgress(`Unarchiving ${plural(ids.length, "thread")}…`);
    const { updated, failed } = await setArchivedInChunks(ids, false);
    busy = false;
    schedule();
    markArchived(updated, false);
    showToast(failed || updated.length < ids.length
      ? `Unarchived ${updated.length} of ${plural(ids.length, "thread")}. Unarchive the rest from each thread's menu.`
      : `Unarchived ${plural(updated.length, "thread")}`);
  }

  function archiveSelected() {
    const order = uniqueIDs(visibleRows());
    const ids = [...selected].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    void archive(ids);
  }

  // Selection mode owns plain clicks on rows: toggle, or Shift to extend.
  // On window, ahead of Amp's own window-level multi-select click handler.
  window.addEventListener("click", event => {
    if (!selecting || event.button !== 0 || event.altKey) return;
    const row = threadRow(event.target);
    const id = row && rowID(row);
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.shiftKey) selectRange(id);
    else toggle(id);
  }, true);
  for (const type of ["pointerdown", "mousedown"]) {
    document.addEventListener(type, event => {
      if (!selecting || event.button !== 0 || !threadRow(event.target)) return;
      // Amp navigates on pointerdown; Shift would also start a text selection.
      if (event.shiftKey || event.metaKey || event.ctrlKey) event.preventDefault();
      if (type !== "pointerdown") return;
      menuTarget = null;
      const menu = document.querySelector("[data-amp-context-menu]");
      if (menu) closeMenu(menu);
      // Amp skips navigating on a prevented mouse press, and its popovers still
      // see it and close. A touch press would open Amp's row menu, so stop it.
      if (event.pointerType !== "mouse") return event.stopImmediatePropagation();
      event.preventDefault();
      // Preventing the press also skips focusing the row, which Space needs.
      threadRow(event.target).focus({ preventScroll: true });
    }, true);
  }
  // Amp renames a row on double-click.
  document.addEventListener("dblclick", event => {
    if (selecting && threadRow(event.target)) event.preventDefault();
  }, true);
  document.addEventListener("keydown", event => {
    if (!selecting || event.defaultPrevented || event.isComposing) return;
    // Escape ends selecting only from the sidebar or the page itself; menus,
    // dialogs, panels, and the composer keep their own Escape.
    // Clicking a popover's or dialog's text leaves focus on body, so check for them too.
    const target = event.target;
    if (event.key === "Escape" && !document.querySelector('[data-amp-context-menu], :popover-open:not([popover="manual"]), dialog:modal') &&
        !target.closest?.('input, textarea, [contenteditable="true"]') &&
        (target === document.body || target === document.documentElement || target.closest?.(sidebarSelector))) {
      event.preventDefault();
      setSelecting(false);
      return;
    }
    if (event.key !== " " && event.key !== "Enter") return;
    const row = threadRow(event.target);
    const id = row && rowID(row);
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // A held key toggles once.
    if (event.repeat) return;
    if (event.shiftKey) selectRange(id);
    else toggle(id);
  }, true);

  // Amp builds its context menu from Svelte snippets, so add plain menu items
  // to the rendered menu for the row or project heading that opened it.
  let menuTarget = null;
  document.addEventListener("contextmenu", event => {
    menuTarget = null;
    for (const node of document.querySelectorAll("[data-amp-batch-menu-item]")) node.remove();
    if (!enabled || !desktop.matches || !(event.target instanceof Element)) return;
    const row = event.target.closest(rowSelector);
    const heading = event.target.closest(`${sidebarSelector} [data-sidebar-project-hover-id]`)?.querySelector('[data-testid="sidebar-thread-group-header"]') ??
      event.target.closest(headingSelector);
    if (row) menuTarget = { row, time: performance.now() };
    else if (heading) menuTarget = { heading, time: performance.now() };
  }, true);

  // A right-click that opened no Amp menu must not lend items to a later one.
  for (const type of ["pointerdown", "keydown"]) {
    document.addEventListener(type, event => { if (event.button !== 2) menuTarget = null; }, true);
  }

  function closeMenu(menu) {
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  }

  function menuItems() {
    if (menuTarget.row) {
      const id = rowID(menuTarget.row);
      if (!id) return [];
      const items = [];
      if (!selecting) {
        items.push({ label: "Select Threads", icon: icons.select, run: () => { setSelecting(true); toggle(id); } });
      } else if (!selected.has(id)) {
        items.push({ label: "Add to Selection", icon: icons.select, run: () => { if (!selected.has(id)) toggle(id); } });
      }
      if (selecting && selected.size) {
        items.push({ label: `Archive ${selected.size} Selected`, icon: icons.archive, run: archiveSelected });
        items.push({ label: "Clear Selection", icon: icons.clear, run: () => setSelecting(false) });
      }
      return items;
    }
    const heading = menuTarget.heading;
    const ids = uniqueIDs(groupRows(heading));
    const name = groupName(heading);
    return [
      { label: ids.length > 1 ? `Archive All ${ids.length} Threads` : ids.length ? "Archive 1 Thread" : "No Threads Loaded to Archive", icon: icons.archive,
        disabled: !ids.length, run: () => void archive(ids, name) },
      { label: "Select Threads in Group", icon: icons.select, disabled: !shownGroupRows(heading).length,
        run: () => { setSelecting(true); selectGroup(heading, true); } },
    ];
  }

  function extendMenu(menu) {
    const list = menu.querySelector("[data-amp-context-menu-scroll]") ?? menu;
    if (!menuTarget || performance.now() - menuTarget.time > 500 || list.querySelector("[data-amp-batch-menu-item]")) return;
    const items = menuItems();
    menuTarget = null;
    if (!items.length) return;
    const native = list.querySelector('[role="menuitem"]');
    const separator = list.querySelector('[role="separator"]')?.cloneNode(false) ?? document.createElement("div");
    separator.setAttribute("role", "separator");
    separator.setAttribute("data-amp-batch-menu-item", "separator");
    list.append(separator);
    for (const item of items) {
      const node = document.createElement("div");
      if (native) node.className = native.className;
      node.setAttribute("role", "menuitem");
      node.setAttribute("tabindex", "-1");
      node.setAttribute("data-amp-batch-menu-item", "");
      node.setAttribute("data-context-menu-item", "");
      const content = document.createElement("span");
      const label = document.createElement("span");
      label.className = "truncate";
      label.textContent = item.label;
      content.append(globalThis.ampIcon(item.icon), label);
      node.append(content);
      if (item.disabled) {
        node.setAttribute("aria-disabled", "true");
        node.setAttribute("data-disabled", "");
      }
      const run = event => {
        event.preventDefault();
        event.stopPropagation();
        if (item.disabled) return;
        closeMenu(menu);
        // Let the menu return focus before a dialog takes it.
        setTimeout(item.run, 0);
      };
      node.addEventListener("click", run);
      node.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") run(event);
      });
      node.addEventListener("pointerenter", () => node.focus({ preventScroll: true }));
      list.append(node);
    }
  }

  new MutationObserver(records => {
    let sidebarChanged = false;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        const menu = node.closest("[data-amp-context-menu]") ?? node.querySelector("[data-amp-context-menu]");
        if (menu && menuTarget) extendMenu(menu);
        if (!sidebarChanged && (node.closest(sidebarSelector) || node.querySelector(sidebarSelector))) sidebarChanged = true;
      }
      if (!sidebarChanged && record.target instanceof Element && record.target.closest(sidebarSelector)) sidebarChanged = true;
    }
    if (sidebarChanged && (enabled || bar?.isConnected)) schedule();
  // Collapsing a group only changes attributes; its Select all follows.
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded", "inert"] });
  desktop.addEventListener("change", () => {
    if (!desktop.matches) setSelecting(false);
    schedule();
  });

  function apply(value) {
    enabled = value !== false;
    if (!enabled) setSelecting(false);
    schedule();
  }
  // Register first so a change during the initial read is not lost.
  let changed = false;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.batchArchive) return;
    changed = true;
    apply(changes.batchArchive.newValue);
  });
  chrome.storage.local.get(["batchArchive"]).then(settings => {
    if (!changed) apply(settings.batchArchive);
  });
})();

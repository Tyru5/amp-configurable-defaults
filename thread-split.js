(() => {
  const desktop = matchMedia("(min-width: 768px)");
  const rowSelector = '[data-slot="sidebar-container"] a[data-sidebar-thread-id]';
  let prepared = null;
  let drag = null;
  let overlay = null;
  let split = null;

  function threadRow(target) {
    if (!desktop.matches || !(target instanceof Element) ||
        target.closest('button, input, textarea, [contenteditable="true"], [data-thread-row-header-popover]')) return null;
    const row = target.closest(rowSelector);
    if (!row || !/^T-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.dataset.sidebarThreadId)) return null;
    const url = new URL(row.href);
    return url.origin === location.origin && url.pathname === `/threads/${row.dataset.sidebarThreadId}` ? row : null;
  }

  function clearDrag() {
    overlay?.remove();
    overlay = null;
    drag = null;
    if (prepared) {
      if (prepared.draggable === null) prepared.row.removeAttribute("draggable");
      else prepared.row.setAttribute("draggable", prepared.draggable);
      prepared = null;
    }
  }

  function releaseRule() {
    return chrome.runtime.sendMessage({ type: "amp-thread-split-close" }).catch(() => {});
  }

  function closeSplit(focus = true) {
    if (!split) return;
    const current = split;
    split = null;
    clearTimeout(current.timer);
    current.observer?.disconnect();
    current.main.removeAttribute("data-amp-thread-split");
    current.main.removeAttribute("data-amp-split-resizing");
    current.main.style.removeProperty("--amp-split-track");
    current.main.style.removeProperty("--amp-main-track");
    current.pane.remove();
    current.handle.remove();
    void releaseRule();
    if (focus && current.row.isConnected) current.row.focus();
  }

  function setSize(current, size) {
    current.size = Math.max(25, Math.min(75, size));
    current.main.style.setProperty("--amp-split-track", `${current.size}fr`);
    current.main.style.setProperty("--amp-main-track", `${100 - current.size}fr`);
    current.handle.setAttribute("aria-valuenow", String(Math.round(current.size)));
    current.handle.setAttribute("aria-orientation", desktop.matches ? "vertical" : "horizontal");
  }

  async function loadThread(current) {
    current.status.hidden = false;
    current.status.textContent = "Loading thread…";
    current.frame.hidden = true;
    current.retry.hidden = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: "amp-thread-split-open", threadID: current.threadID });
      if (split !== current) return;
      if (!result?.ok) throw new Error(result?.error || "Could not open the thread.");
      current.frame.src = result.url;
      clearTimeout(current.timer);
      current.timer = setTimeout(() => {
        if (split !== current || !current.frame.hidden) return;
        current.status.textContent = "The thread has not loaded. Retry or open it in a new tab.";
        current.retry.hidden = false;
      }, 20000);
    } catch (error) {
      if (split !== current) return;
      current.status.textContent = error.message;
      current.retry.hidden = false;
    }
  }

  function prepareFrame(current) {
    if (split !== current || !current.frame.getAttribute("src")) return;
    current.observer?.disconnect();
    try {
      const doc = current.frame.contentDocument;
      if (!doc?.head) throw new Error("Thread embedding was blocked. Retry or open the thread in a new tab.");
      const style = doc.createElement("style");
      // Keep Amp's thread and composer intact; only remove the duplicate app navigation.
      style.textContent = '.app-primary-navigation, [data-slot="sidebar"], .app-navigation-sidebar, .sidebar-trigger-wrapper, .app-content-frame > .resize-handle { display: none !important; } [data-slot="sidebar-inset"] { margin: 0 !important; }';
      doc.head.append(style);
      const ready = () => {
        if (!doc.querySelector('.thread-layout, .thread-layout-panes')) return;
        current.frame.hidden = false;
        current.status.hidden = true;
        current.retry.hidden = true;
        clearTimeout(current.timer);
        current.title.textContent = doc.title.replace(/ - Amp$/, "") || "Thread";
      };
      current.observer = new MutationObserver(ready);
      current.observer.observe(doc, { childList: true, subtree: true });
      ready();
    } catch (error) {
      clearTimeout(current.timer);
      current.status.textContent = error.message;
      current.retry.hidden = false;
    }
  }

  function openSplit(row, side) {
    const main = document.querySelector('[data-slot="sidebar-inset"]');
    if (!main) return;
    if (split) {
      if (split.threadID === row.dataset.sidebarThreadId) {
        split.side = side;
        main.dataset.ampThreadSplit = side;
      } else {
        split.status.hidden = false;
        split.status.textContent = "Close this split before opening another thread. Its unsent draft will not be replaced.";
      }
      return;
    }
    const pane = document.createElement("section");
    pane.setAttribute("data-amp-thread-pane", "");
    pane.setAttribute("aria-label", "Split thread");
    const header = document.createElement("div");
    header.setAttribute("data-amp-thread-pane-header", "");
    const title = document.createElement("strong");
    title.textContent = "Thread";
    const link = document.createElement("a");
    link.href = row.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open in new tab";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close thread split");
    close.addEventListener("click", () => closeSplit());
    header.append(title, link, close);
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry loading thread";
    retry.hidden = true;
    const frame = document.createElement("iframe");
    frame.title = "Split thread conversation";
    frame.hidden = true;
    pane.append(header, status, retry, frame);
    const handle = document.createElement("div");
    handle.setAttribute("data-amp-thread-divider", "");
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", "Resize thread split");
    handle.setAttribute("aria-valuemin", "25");
    handle.setAttribute("aria-valuemax", "75");
    handle.tabIndex = 0;
    const current = { main, pane, handle, frame, title, status, retry, row, side, threadID: row.dataset.sidebarThreadId };
    split = current;
    frame.addEventListener("load", () => prepareFrame(current));
    retry.addEventListener("click", () => void loadThread(current));
    main.dataset.ampThreadSplit = side;
    setSize(current, 50);
    main.append(handle, pane);
    let resizing = null;
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      resizing = event.pointerId;
      handle.setPointerCapture(event.pointerId);
      main.setAttribute("data-amp-split-resizing", "");
    });
    handle.addEventListener("pointermove", event => {
      if (resizing !== event.pointerId) return;
      const rect = main.getBoundingClientRect();
      const offset = desktop.matches ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
      setSize(current, (current.side === "left" ? offset : 1 - offset) * 100);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      handle.addEventListener(type, () => { resizing = null; main.removeAttribute("data-amp-split-resizing"); });
    }
    handle.addEventListener("dblclick", () => setSize(current, 50));
    handle.addEventListener("keydown", event => {
      const delta = (desktop.matches ? { ArrowLeft: -5, ArrowRight: 5 } : { ArrowUp: -5, ArrowDown: 5 })[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      setSize(current, current.size + delta * (current.side === "left" ? 1 : -1));
    });
    void loadThread(current);
  }

  // Amp normally navigates on pointerdown. Leave navigation to its click handler
  // so a drag can start without replacing the current conversation or draft.
  document.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const row = threadRow(event.target);
    if (!row) return;
    clearDrag();
    prepared = { row, draggable: row.getAttribute("draggable") };
    row.draggable = true;
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener("dragstart", event => {
    const row = threadRow(event.target);
    const main = document.querySelector('[data-slot="sidebar-inset"]');
    if (!row || row !== prepared?.row || !main || !event.dataTransfer) return;
    drag = { row, main };
    event.dataTransfer.setData("text/uri-list", row.href);
    event.dataTransfer.effectAllowed = "link";
    overlay = document.createElement("div");
    overlay.setAttribute("data-amp-thread-drop", "");
    for (const side of ["left", "right"]) {
      const zone = document.createElement("div");
      zone.dataset.ampThreadDropSide = side;
      zone.textContent = `Open thread in ${side} pane`;
      overlay.append(zone);
    }
    const rect = main.getBoundingClientRect();
    Object.assign(overlay.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    document.body.append(overlay);
  }, true);
  function dropSide(event) {
    if (!drag.main.isConnected || !desktop.matches) return null;
    const rect = drag.main.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right) return null;
    const width = Math.min(160, rect.width / 4);
    if (event.clientX <= rect.left + width) return "left";
    if (event.clientX >= rect.right - width) return "right";
    return null;
  }
  document.addEventListener("dragover", event => {
    if (!drag) return;
    const side = dropSide(event);
    overlay.dataset.activeSide = side || "";
    event.preventDefault();
    event.stopImmediatePropagation();
    event.dataTransfer.dropEffect = side ? "link" : "none";
  }, true);
  document.addEventListener("drop", event => {
    if (!drag) return;
    const row = drag.row;
    const side = dropSide(event);
    clearDrag();
    event.preventDefault();
    event.stopImmediatePropagation();
    if (side) openSplit(row, side);
  }, true);
  document.addEventListener("dragend", clearDrag, true);
  document.addEventListener("pointerup", () => { if (!drag) clearDrag(); }, true);
  document.addEventListener("pointercancel", () => { if (!drag) clearDrag(); }, true);
  window.addEventListener("blur", clearDrag);
  window.addEventListener("resize", clearDrag);
  window.addEventListener("pagehide", () => closeSplit(false));
  desktop.addEventListener("change", () => { clearDrag(); if (split) setSize(split, split.size); });
  new MutationObserver(() => { if (split && !split.pane.isConnected) closeSplit(false); })
    .observe(document, { childList: true, subtree: true });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { clearDrag(); return; }
    const side = { ArrowLeft: "left", ArrowRight: "right" }[event.key];
    if (!side || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const row = threadRow(event.target);
    if (!row) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openSplit(row, side);
  }, true);
  // A newly loaded top-level page releases rules left by its previous document.
  void releaseRule();
})();

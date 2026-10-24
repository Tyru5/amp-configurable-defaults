(() => {
  const root = document.documentElement;
  const desktop = matchMedia("(min-width: 768px)");
  let right = true;
  let resize = null;
  let settingsReady = false;
  let settings = {};
  const settingKeys = ["right", "rightWidth", "hideSidebarFooter",
    "resizeSidebar", "moveViews", "indentThreads", "showHeaderToggle"];

  const sidebarSelector = '[data-slot="sidebar-container"]';
  function updateHeader() {
    for (const header of document.querySelectorAll(`${sidebarSelector} .sidebar-toolbar`)) {
      let button = header.querySelector('[data-amp-sidebar-toggle]');
      if (settings.showHeaderToggle === false) {
        button?.remove();
        continue;
      }
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-amp-sidebar-toggle", "");
        button.setAttribute("role", "switch");
        button.setAttribute("aria-label", "Move sidebar to the right");
        button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 4v16M6 12h7m-3-3 3 3-3 3"/></svg>';
        button.addEventListener("click", () => {
          chrome.storage.local.set({ right: !right }).catch(() => {
            button.title = "Could not save the setting. Click to try again.";
          });
        });
        const actions = header.querySelector('[data-testid="sidebar-search-button"]')?.parentElement;
        if (actions) actions.prepend(button);
        else header.append(button);
      }
      button.setAttribute("aria-checked", String(right));
      button.title = `Move sidebar to the ${right ? "left" : "right"}`;
      button.disabled = !settingsReady;
    }
  }

  // Amp supplies the hierarchy; indent the whole row, not only its branch icon.
  let indentPending = false;
  function indentThreads() {
    indentPending = false;
    if (settings.indentThreads === false) return;
    for (const row of document.querySelectorAll(`${sidebarSelector} [data-slot="sidebar-menu-item"]`)) {
      const marker = row.querySelector(':scope > [data-sidebar-thread-id] > [data-thread-row-nesting-depth]');
      const depth = Number(marker?.dataset.threadRowNestingDepth);
      if (Number.isInteger(depth) && depth > 0) {
        row.setAttribute("data-amp-thread-child", "");
        row.style.setProperty("--amp-thread-indent", `${Math.min(depth * 20, 64)}px`);
      } else {
        row.removeAttribute("data-amp-thread-child");
        row.style.removeProperty("--amp-thread-indent");
      }
    }
  }
  new MutationObserver(records => {
    const sidebarChanged = records.some(record =>
      record.target instanceof Element && record.target.closest(sidebarSelector) ||
      Array.from(record.addedNodes).some(node => node instanceof Element &&
        (node.matches(sidebarSelector) || node.querySelector(sidebarSelector))));
    if (sidebarChanged && !indentPending) {
      indentPending = true;
      requestAnimationFrame(() => {
        updateHeader();
        indentThreads();
      });
    }
  }).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["data-thread-row-nesting-depth"] });
  indentThreads();

  // Amp closes desktop hover cards when there is no room to the anchor's right.
  // Its touch-preview marker bypasses that guard. Borrow it only for mouse/keyboard
  // previews, then position the native card on the left without replacing content.
  const hoverSelector = '[data-thread-list-hover-card][role="tooltip"]';
  let hoverAnchor = null;
  let hoverCard = null;
  const previewMarkers = new Set();
  const hoverSizing = new ResizeObserver(positionHover);

  function releaseHoverCard() {
    if (!hoverCard) return;
    hoverSizing.unobserve(hoverCard);
    hoverCard.removeAttribute("data-amp-thread-hover-left");
    root.style.removeProperty("--amp-hover-x");
    root.style.removeProperty("--amp-hover-y");
    hoverCard = null;
  }

  function clearHover() {
    releaseHoverCard();
    hoverSizing.disconnect();
    for (const anchor of previewMarkers) anchor.removeAttribute("data-sidebar-touch-preview");
    previewMarkers.clear();
    hoverAnchor = null;
  }

  function positionHover() {
    if (!right || !desktop.matches || !hoverAnchor?.isConnected) {
      clearHover();
      return;
    }
    const card = document.querySelector(hoverSelector);
    if (!card && hoverCard) {
      clearHover();
      return;
    }
    if (card !== hoverCard) {
      releaseHoverCard();
      hoverCard = card;
      if (card) hoverSizing.observe(card);
    }
    if (!card) return;
    const rect = hoverAnchor.getBoundingClientRect();
    const x = Math.max(8, Math.min(rect.left - card.offsetWidth - 5, innerWidth - card.offsetWidth - 8));
    const y = Math.max(8, Math.min(rect.top, innerHeight - card.offsetHeight - 8));
    // Amp replaces the card's entire style attribute during its position updates.
    root.style.setProperty("--amp-hover-x", `${x}px`);
    root.style.setProperty("--amp-hover-y", `${y}px`);
    card.setAttribute("data-amp-thread-hover-left", "");
  }

  function prepareHover(event) {
    if (!right || !desktop.matches || !(event.target instanceof Element)) return;
    if (event.type === "pointerover" && event.pointerType !== "mouse") return;
    if (event.type === "focusin" && !event.target.matches(":focus-visible")) return;
    const anchor = event.target.closest(`${sidebarSelector} [data-sidebar-thread-id]`);
    if (!anchor) {
      if (event.target.closest("[data-sidebar-thread-id], [data-sidebar-project-hover-id]")) clearHover();
      return;
    }
    if (anchor === hoverAnchor) return;
    // Keep the previous anchor marked during Amp's deferred row-to-row switch.
    // Removing it now would let the old card's overflow check cancel the switch.
    hoverSizing.disconnect();
    if (hoverCard) hoverSizing.observe(hoverCard);
    hoverAnchor = anchor;
    if (!anchor.hasAttribute("data-sidebar-touch-preview")) {
      previewMarkers.add(anchor);
      anchor.setAttribute("data-sidebar-touch-preview", "");
    }
    hoverSizing.observe(anchor.closest(sidebarSelector));
    positionHover();
  }
  document.addEventListener("pointerover", prepareHover, true);
  document.addEventListener("focusin", prepareHover, true);
  // Do not opt touch-capable desktops into Amp's first-tap preview behavior.
  document.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse") clearHover();
  }, true);
  new MutationObserver(positionHover).observe(document, { childList: true, subtree: true });
  desktop.addEventListener("change", positionHover);

  // Amp's pane library assumes DOM order is left-to-right. Mirror only input
  // to the reversed Views split; let Amp own sizing, constraints, and state.
  let viewDrag = null;
  const mirroredEvents = new WeakSet();
  function viewHandle(target) {
    return right && settings.moveViews !== false && desktop.matches && target instanceof Element
      ? target.closest(':is(.thread-file-tab-pane-group, .multi-pane-pane-group)[data-direction="horizontal"] > [data-pane-resizer]')
      : null;
  }
  function forward(event, mirrored) {
    event.preventDefault();
    event.stopImmediatePropagation();
    mirroredEvents.add(mirrored);
    event.target.dispatchEvent(mirrored);
  }
  for (const type of ["mousedown", "touchstart"]) {
    document.addEventListener(type, event => {
      const handle = viewHandle(event.target);
      if (!handle || handle.dataset.enabled === "false") return;
      if (type === "mousedown" && event.button !== 0) return;
      if (type === "touchstart" && event.touches.length !== 1) return;
      const point = type === "touchstart" ? event.touches[0] : event;
      viewDrag = { handle, clientX: point.clientX, screenX: point.screenX };
    }, true);
  }
  for (const type of ["mousemove", "mouseleave", "touchmove"]) {
    document.addEventListener(type, event => {
      if (mirroredEvents.has(event) || !viewDrag || !viewDrag.handle.isConnected || !viewHandle(viewDrag.handle)) return;
      const init = { bubbles: event.bubbles, cancelable: true, composed: true, view: window,
        ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey };
      if (type === "touchmove") {
        const mirror = touch => new Touch({ identifier: touch.identifier, target: touch.target,
          clientX: 2 * viewDrag.clientX - touch.clientX, clientY: touch.clientY,
          screenX: 2 * viewDrag.screenX - touch.screenX, screenY: touch.screenY,
          radiusX: touch.radiusX, radiusY: touch.radiusY, rotationAngle: touch.rotationAngle, force: touch.force });
        forward(event, new TouchEvent(type, { ...init,
          touches: Array.from(event.touches, mirror), targetTouches: Array.from(event.targetTouches, mirror),
          changedTouches: Array.from(event.changedTouches, mirror) }));
      } else {
        forward(event, new MouseEvent(type, { ...init,
          clientX: 2 * viewDrag.clientX - event.clientX, clientY: event.clientY,
          screenX: 2 * viewDrag.screenX - event.screenX, screenY: event.screenY,
          button: event.button, buttons: event.buttons }));
      }
    }, { capture: true, passive: false });
  }
  document.addEventListener("keydown", event => {
    if (mirroredEvents.has(event) || !viewHandle(event.target)) return;
    const key = { ArrowLeft: "ArrowRight", ArrowRight: "ArrowLeft", Home: "End", End: "Home" }[event.key];
    if (key) forward(event, new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true, composed: true,
      ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey, repeat: event.repeat }));
  }, true);
  for (const type of ["mouseup", "touchend", "touchcancel"]) {
    window.addEventListener(type, () => { viewDrag = null; }, true);
  }
  window.addEventListener("blur", () => { viewDrag = null; });

  function apply(settings) {
    right = settings.right !== false;
    if (!right) clearHover();
    updateHeader();
    indentThreads();
    if (!right || settings.moveViews === false) viewDrag = null;
    root.toggleAttribute("data-amp-sidebar-hide-footer", settings.hideSidebarFooter === true);
    root.toggleAttribute("data-amp-sidebar-right", right);
    root.toggleAttribute("data-amp-sidebar-move-views", right && settings.moveViews !== false);
    root.toggleAttribute("data-amp-sidebar-indent", settings.indentThreads !== false);
    root.toggleAttribute("data-amp-sidebar-resize", right && settings.resizeSidebar !== false);
    const width = settings.rightWidth;
    const customWidth = right && settings.resizeSidebar !== false && Number.isFinite(width) && width >= 200 && width <= 480;
    root.toggleAttribute("data-amp-sidebar-right-width", customWidth);
    if (customWidth) {
      root.style.setProperty("--amp-sidebar-right-width", `${width}px`);
    } else {
      root.style.removeProperty("--amp-sidebar-right-width");
    }
  }

  // Register first so changes made while the initial read is pending are not lost.
  let changed = false;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of settingKeys) {
      if (changes[key]) {
        changed = true;
        settings[key] = changes[key].newValue;
      }
    }
    apply(settings);
    if (!right || settings.resizeSidebar === false) finishResize();
  });
  chrome.storage.local.get(settingKeys).then((initial) => {
    settings = changed ? { ...initial, ...settings } : initial;
    settingsReady = true;
    apply(settings);
  });

  // Amp's native divider assumes a left sidebar. Own only this divider while
  // right mode is active, leaving Amp's other split panes and left mode alone.
  document.addEventListener("pointerdown", (event) => {
    if (!right || settings.resizeSidebar === false || !desktop.matches || event.button !== 0 || !event.isPrimary) return;
    const handle = event.target instanceof Element
      ? event.target.closest(".app-content-frame > .resize-handle")
      : null;
    if (!handle || handle.hidden) return;
    const frame = handle.parentElement;
    const sidebar = frame.querySelector('[data-slot="sidebar-container"]');
    const state = frame.querySelector('[data-slot="sidebar"]');
    if (!sidebar || state?.dataset.state === "collapsed") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    resize = {
      handle,
      pointer: event.pointerId,
      startX: event.clientX,
      startWidth: sidebar.getBoundingClientRect().width,
    };
    handle.setPointerCapture(event.pointerId);
    root.setAttribute("data-amp-sidebar-right-resizing", "");
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (!resize || event.pointerId !== resize.pointer) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const width = Math.round(Math.min(480, Math.max(200,
      resize.startWidth + resize.startX - event.clientX)));
    settings.rightWidth = width;
    root.setAttribute("data-amp-sidebar-right-width", "");
    root.style.setProperty("--amp-sidebar-right-width", `${width}px`);
  }, true);

  document.addEventListener("dblclick", (event) => {
    if (!right || settings.resizeSidebar === false || !desktop.matches || !(event.target instanceof Element)) return;
    if (!event.target.closest(".app-content-frame > .resize-handle")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    finishResize();
    settings.rightWidth = null;
    apply(settings);
    chrome.storage.local.set({ rightWidth: null });
  }, true);

  function finishResize() {
    if (!resize) return;
    const { handle, pointer } = resize;
    resize = null;
    root.removeAttribute("data-amp-sidebar-right-resizing");
    if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
    if (Number.isFinite(settings.rightWidth)) {
      chrome.storage.local.set({ rightWidth: settings.rightWidth });
    }
  }

  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    document.addEventListener(type, (event) => {
      if (!resize || event.pointerId !== resize.pointer) return;
      event.stopImmediatePropagation();
      finishResize();
    }, true);
  }
  desktop.addEventListener("change", finishResize);
  window.addEventListener("blur", finishResize);
})();

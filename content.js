(() => {
  const root = document.documentElement;
  const desktop = matchMedia("(min-width: 768px)");
  let right = true;
  let resize = null;

  // Amp's pane library assumes DOM order is left-to-right. Mirror only input
  // to the reversed Views split; let Amp own sizing, constraints, and state.
  let viewDrag = null;
  const mirroredEvents = new WeakSet();
  function viewHandle(target) {
    return right && desktop.matches && target instanceof Element
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
    if (!right) viewDrag = null;
    root.toggleAttribute("data-amp-sidebar-right", right);
    const width = settings.rightWidth;
    const customWidth = Number.isFinite(width) && width >= 200 && width <= 480;
    root.toggleAttribute("data-amp-sidebar-right-width", customWidth);
    if (customWidth) {
      root.style.setProperty("--amp-sidebar-right-width", `${width}px`);
    } else {
      root.style.removeProperty("--amp-sidebar-right-width");
    }
  }

  // Register first so changes made while the initial read is pending are not lost.
  let settings = {};
  let changed = false;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of ["right", "rightWidth"]) {
      if (changes[key]) {
        changed = true;
        settings[key] = changes[key].newValue;
      }
    }
    apply(settings);
    if (!right) finishResize();
  });
  chrome.storage.local.get(["right", "rightWidth"]).then((initial) => {
    settings = changed ? { ...initial, ...settings } : initial;
    apply(settings);
  });

  // Amp's native divider assumes a left sidebar. Own only this divider while
  // right mode is active, leaving Amp's other split panes and left mode alone.
  document.addEventListener("pointerdown", (event) => {
    if (!right || !desktop.matches || event.button !== 0 || !event.isPrimary) return;
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
    if (!right || !desktop.matches || !(event.target instanceof Element)) return;
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

(() => {
  const root = document.documentElement;
  const desktop = matchMedia("(min-width: 768px)");
  let right = true;
  let resize = null;

  function apply(settings) {
    right = settings.right !== false;
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

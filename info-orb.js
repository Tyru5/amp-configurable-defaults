(() => {
  const desktop = matchMedia("(min-width: 768px)");
  let enabled = false;
  let settings = {};
  let pending = false;
  const controllers = new Map();
  let sequence = 0;

  function controller() {
  let state;
  let view;

  // Amp's title bar hides its project, mode, and visibility controls at
  // narrower widths. Read the same nodes so the card always matches Amp.
  function details(bar) {
    const rows = [];
    const add = (label, value) => {
      value = value?.replace(/\s+/g, " ").trim();
      if (value) rows.push([label, value]);
    };
    const context = globalThis.ampThreadContexts?.get(view.id);
    add("Thread", (bar?.querySelector('[data-card-tab="agent"] > button[role="tab"] .truncate') ??
      bar?.querySelector("[data-title-text]") ?? bar?.querySelector("h2"))?.textContent || context?.title);
    const runner = context?.runner;
    add("Executor", bar?.querySelector("[data-thread-title-executor-icon]")?.getAttribute("aria-label") ??
      (runner?.label === "Executor" ? runner.name : null));
    if (runner?.label === "Runner") add("Runner", runner.name);
    add("Directory", runner?.directory);
    let mode = false;
    for (const control of bar?.querySelectorAll(".thread-title-bar-meta-control") ?? []) {
      if (control.querySelector(".truncate")) add("Project", control.textContent);
      else if (control.querySelector(".border")) add("Visibility", control.textContent);
      else {
        mode = true;
        add("Mode", control.textContent);
      }
    }
    if (!mode) add("Mode", bar?.querySelector("[data-thread-title-mode-icon]")?.getAttribute("aria-label") ?? context?.mode);
    return rows;
  }

  function isOpen() {
    return !!state?.panel.matches(":popover-open");
  }

  function setup() {
    // A quiet control in the composer toolbar, first among the thread's
    // controls. It opens a popover above the composer with the title-bar details.
    const panel = document.createElement("section");
    panel.id = `amp-thread-info-${++sequence}`;
    panel.dataset.ampThreadInfoUi = "panel";
    panel.popover = "auto";
    panel.setAttribute("data-amp-composer-popover", "");
    panel.setAttribute("aria-label", "Thread info");
    const list = document.createElement("dl");
    panel.append(list);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.ampThreadInfoUi = "toggle";
    toggle.dataset.ampComposerControl = "info";
    toggle.title = "Thread info";
    toggle.setAttribute("aria-label", "Thread info");
    toggle.popoverTargetElement = panel;
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.append(globalThis.ampIcon("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16v-4M12 8h.01"));
    // The popover's toggle event drives the control's state, so the button, Escape,
    // and clicks elsewhere (light dismiss) all open and close it the same way.
    panel.addEventListener("toggle", event => {
      const open = event.newState === "open";
      toggle.setAttribute("aria-expanded", String(open));
      if (open) globalThis.ampPlacePopover(panel, toggle);
      else if (panel.contains(document.activeElement) || document.activeElement === document.body) toggle.focus({ preventScroll: true });
    });
    for (const node of [toggle, panel]) {
      node.addEventListener("keydown", event => {
        if (event.key !== "Escape" || event.defaultPrevented || !isOpen()) return;
        event.preventDefault();
        panel.hidePopover();
      });
    }
    state = { toggle, panel, list, bar: null, observer: new MutationObserver(render) };
  }

  function teardown() {
    if (!state) return;
    state.observer.disconnect();
    state.toggle.remove();
    state.panel.remove();
    state = undefined;
  }

  // The card stays current while closed so opening it never shows stale details.
  function render() {
    if (!state) return;
    const rows = details(state.bar);
    const signature = JSON.stringify(rows);
    if (state.list.dataset.signature === signature) return;
    state.list.dataset.signature = signature;
    state.list.replaceChildren(...rows.flatMap(([label, value]) => {
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      return [term, description];
    }));
    if (isOpen()) globalThis.ampPlacePopover(state.panel, state.toggle);
  }

  function refresh(next) {
    view = next;
    // Read-only threads have no composer; their title bar holds the control.
    const toolbar = view.toolbar ?? view.header;
    if (!enabled || !desktop.matches || !toolbar) {
      teardown();
      return;
    }
    const bar = view.titleBar;
    if (!state) setup();
    if (state.bar !== bar) {
      state.bar = bar;
      state.observer.disconnect();
      if (bar) state.observer.observe(bar, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    if (state.panel.parentElement !== view.host) view.host.append(state.panel);
    globalThis.ampMountComposerControl(toolbar, state.toggle);
    render();
    if (isOpen()) globalThis.ampPlacePopover(state.panel, state.toggle);
  }

  return { refresh, teardown };
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      globalThis.ampSyncThreadViews(controllers, controller);
    });
  }

  new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof Element && record.target.closest("[data-amp-thread-info-ui]")))) schedule();
  }).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "style", "data-state", "data-thread-id", "hidden"] });
  addEventListener("amp-thread-context-change", schedule);
  addEventListener("resize", schedule);
  desktop.addEventListener("change", schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.infoOrb) return;
    settings.infoOrb = changes.infoOrb.newValue;
    enabled = settings.infoOrb !== false;
    schedule();
  });
  chrome.storage.local.get(["infoOrb"]).then(initial => {
    settings = { ...initial, ...settings };
    enabled = settings.infoOrb !== false;
    schedule();
  });
})();

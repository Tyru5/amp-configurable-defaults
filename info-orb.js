(() => {
  const desktop = matchMedia("(min-width: 768px)");
  const barSelector = ".thread-title-bar-container .app-title-bar";
  let enabled = false;
  let settings = {};
  let pending = false;
  let state;

  // Amp's title bar hides its project, mode, and visibility controls at
  // narrower widths. Read the same nodes so the card always matches Amp.
  function details(bar) {
    const rows = [];
    const add = (label, value) => {
      value = value?.replace(/\s+/g, " ").trim();
      if (value) rows.push([label, value]);
    };
    add("Thread", (bar.querySelector("[data-title-text]") ?? bar.querySelector("h2"))?.textContent);
    add("Executor", bar.querySelector("[data-thread-title-executor-icon]")?.getAttribute("aria-label"));
    let mode = false;
    for (const control of bar.querySelectorAll(".thread-title-bar-meta-control")) {
      if (control.querySelector(".truncate")) add("Project", control.textContent);
      else if (control.querySelector(".border")) add("Visibility", control.textContent);
      else {
        mode = true;
        add("Mode", control.textContent);
      }
    }
    if (!mode) add("Mode", bar.querySelector("[data-thread-title-mode-icon]")?.getAttribute("aria-label"));
    return rows;
  }

  function show(pinned = state.pinned) {
    clearTimeout(state.hideTimer);
    state.pinned = pinned;
    state.orb.setAttribute("aria-pressed", String(pinned));
    state.orb.setAttribute("aria-expanded", "true");
    state.card.hidden = false;
    render();
  }

  function hide() {
    clearTimeout(state.hideTimer);
    state.pinned = false;
    state.orb.setAttribute("aria-pressed", "false");
    state.orb.setAttribute("aria-expanded", "false");
    state.card.hidden = true;
  }

  function hideSoon() {
    clearTimeout(state.hideTimer);
    if (state.pinned) return;
    // A short grace period lets the pointer cross the gap from orb to card.
    state.hideTimer = setTimeout(() => {
      if (!state.pinned && !state.orb.matches(":hover, :focus-visible") && !state.card.matches(":hover, :focus-within")) hide();
    }, 150);
  }

  function setup() {
    const orb = document.createElement("button");
    orb.type = "button";
    orb.setAttribute("data-amp-info-orb", "");
    orb.setAttribute("aria-label", "Thread info. Click to pin.");
    orb.setAttribute("aria-controls", "amp-info-card");
    orb.setAttribute("aria-expanded", "false");
    orb.setAttribute("aria-pressed", "false");
    const card = document.createElement("section");
    card.id = "amp-info-card";
    card.setAttribute("data-amp-info-card", "");
    card.setAttribute("aria-label", "Thread info");
    card.hidden = true;
    const list = document.createElement("dl");
    card.append(list);
    state = { orb, card, list, pinned: false, hideTimer: 0, bar: null, observer: new MutationObserver(render) };

    orb.addEventListener("pointerenter", () => show());
    orb.addEventListener("focus", () => { if (!state.returningFocus && orb.matches(":focus-visible")) show(); });
    orb.addEventListener("click", () => {
      if (state.pinned) {
        hide();
        if (orb.matches(":hover")) show(false);
      } else show(true);
    });
    for (const node of [orb, card]) {
      node.addEventListener("pointerleave", hideSoon);
      node.addEventListener("focusout", hideSoon);
      node.addEventListener("keydown", event => {
        if (event.key !== "Escape" || card.hidden) return;
        event.stopPropagation();
        hide();
        state.returningFocus = true;
        orb.focus();
        state.returningFocus = false;
      });
    }
    card.addEventListener("pointerenter", () => clearTimeout(state.hideTimer));
    document.body.append(orb, card);
  }

  function teardown() {
    if (!state) return;
    clearTimeout(state.hideTimer);
    state.observer.disconnect();
    state.orb.remove();
    state.card.remove();
    state = undefined;
  }

  function render() {
    if (!state || state.card.hidden || !state.bar) return;
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
  }

  function refresh() {
    pending = false;
    const bar = enabled && desktop.matches && document.body ? document.querySelector(barSelector) : null;
    if (!bar) {
      teardown();
      return;
    }
    if (!state) setup();
    if (state.bar !== bar) {
      state.bar = bar;
      state.observer.disconnect();
      state.observer.observe(bar, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    // Float beside the conversation, not over a left sidebar or left-side view.
    const left = `${Math.round(Math.max(0, bar.closest(".thread-title-bar-container").getBoundingClientRect().left))}px`;
    if (state.orb.style.getPropertyValue("--amp-info-orb-left") !== left) {
      state.orb.style.setProperty("--amp-info-orb-left", left);
      state.card.style.setProperty("--amp-info-orb-left", left);
    }
    render();
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(refresh);
  }

  new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof Element && record.target.closest("[data-amp-info-orb], [data-amp-info-card]")))) schedule();
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-state"] });
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

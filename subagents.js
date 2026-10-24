(() => {
  const desktop = matchMedia("(min-width: 768px)");
  const agentSelector = "[data-transcript-subagent]";
  const eventSelector = '[data-transcript-automation-event="subagent"]';
  const detailSelector = "[data-transcript-subagent-prompt], [data-transcript-subagent-response], [data-transcript-subagent-error], [data-transcript-automation-event-markdown], [data-transcript-automation-event-text]";
  let enabled = false;
  let settings = {};
  let pending = false;
  let state;
  let sequence = 0;

  function text(node) {
    if (!node) return "";
    // Block boundaries remain readable even when the native source is hidden.
    const copy = node.cloneNode(true);
    copy.querySelectorAll("button, svg, script, style").forEach(e => e.remove());
    copy.querySelectorAll("p, div, pre, li, h1, h2, h3, h4, tr, br").forEach(e => e.append("\n"));
    return copy.textContent.replace(/\n{3,}/g, "\n\n").trim();
  }

  function write(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  function button(label, action) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.addEventListener("click", action);
    return node;
  }

  function close() {
    if (!state) return;
    closeReader();
    state.open = false;
    state.host.removeAttribute("data-amp-subagents-open");
    state.panel.hidden = true;
    state.toggle.setAttribute("aria-expanded", "false");
    for (const header of state.expanded) {
      if (header.isConnected && !header.closest("[data-amp-subagent-revealed]") && header.querySelector(".expandable-row-chevron.rotate-90")) header.click();
    }
    state.expanded.clear();
  }

  function teardown() {
    if (!state) return;
    close();
    state.sizing.disconnect();
    state.host.removeAttribute("data-amp-subagents-overlay");
    state.toggle.remove();
    state.panel.remove();
    state.reader.remove();
    for (const [source, reference] of state.inline) {
      source.removeAttribute("data-amp-subagent-inline");
      source.removeAttribute("data-amp-subagent-revealed");
      reference.remove();
    }
    state = undefined;
  }

  function select(key) {
    if (state.selected !== key) {
      state.reader.querySelector("[data-amp-subagents-reading]").scrollTop = 0;
    }
    state.selected = key;
    state.open = true;
    schedule();
  }

  function closeReader(restoreFocus = false) {
    if (!state) return;
    const control = state.sections[state.section];
    clearTimeout(state.previewTimer);
    clearTimeout(state.dismissTimer);
    state.section = null;
    state.pinned = false;
    state.reader.hidden = true;
    for (const control of Object.values(state.sections)) control.setAttribute("aria-expanded", "false");
    if (restoreFocus) {
      state.restoringFocus = true;
      control?.focus();
      state.restoringFocus = false;
    }
  }

  function readSection(section, pinned = false) {
    clearTimeout(state.previewTimer);
    clearTimeout(state.dismissTimer);
    if (state.section !== section) state.reader.querySelector("[data-amp-subagents-reading]").scrollTop = 0;
    state.section = section;
    state.pinned = pinned || state.pinned;
    state.reader.hidden = false;
    state.task.hidden = section !== "task";
    state.output.hidden = section !== "output";
    write(state.readerLabel, section === "task" ? "Task" : "Output");
    write(state.pin, state.pinned ? "Pinned" : "Pin open");
    state.pin.setAttribute("aria-pressed", String(state.pinned));
    for (const [key, control] of Object.entries(state.sections)) {
      control.setAttribute("aria-expanded", String(key === section));
    }
    schedule();
  }

  function deferReaderClose() {
    clearTimeout(state.previewTimer);
    clearTimeout(state.dismissTimer);
    state.dismissTimer = setTimeout(() => {
      if (!state || state.pinned || state.panel.matches(":hover") || state.reader.matches(":hover") ||
          Object.values(state.sections).includes(document.activeElement) || state.reader.contains(document.activeElement)) return;
      closeReader();
    }, 180);
  }

  function create(host, transcript) {
    const panel = document.createElement("aside");
    panel.id = `amp-subagents-${++sequence}`;
    panel.dataset.ampSubagentsUi = "panel";
    panel.setAttribute("aria-label", "Subagents");
    panel.hidden = true;
    const heading = document.createElement("header");
    const label = document.createElement("strong");
    label.textContent = "Subagents";
    const dismiss = button("×", () => { close(); state.toggle.focus(); });
    dismiss.setAttribute("aria-label", "Close subagents");
    heading.append(label, dismiss);
    const list = document.createElement("div");
    list.dataset.ampSubagentsList = "";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Choose a subagent");
    const detail = document.createElement("section");
    detail.dataset.ampSubagentsDetail = "";
    detail.setAttribute("aria-label", "Selected subagent");
    const title = document.createElement("h3");
    title.tabIndex = -1;
    const status = document.createElement("p");
    const notice = document.createElement("p");
    notice.dataset.ampSubagentsNotice = "";
    const sections = {};
    const sectionNav = document.createElement("div");
    sectionNav.dataset.ampSubagentsSections = "";
    const reader = document.createElement("section");
    reader.id = `${panel.id}-reader`;
    reader.dataset.ampSubagentsUi = "reader";
    reader.setAttribute("aria-label", "Subagent reader");
    reader.hidden = true;
    const readerHeader = document.createElement("header");
    const readerLabel = document.createElement("h4");
    readerLabel.tabIndex = -1;
    const readerTitle = document.createElement("h3");
    const pin = button("Pin open", () => {
      state.pinned = !state.pinned;
      write(pin, state.pinned ? "Pinned" : "Pin open");
      pin.setAttribute("aria-pressed", String(state.pinned));
    });
    pin.setAttribute("aria-pressed", "false");
    const dismissReader = button("Close", () => closeReader(true));
    dismissReader.setAttribute("aria-label", "Close reader");
    readerHeader.append(readerLabel, pin, dismissReader);
    for (const key of ["task", "output"]) {
      const control = button(key === "task" ? "Task" : "Output", () => {
        readSection(key, true);
        readerLabel.focus();
      });
      control.dataset.ampSubagentsSection = key;
      control.setAttribute("aria-controls", reader.id);
      control.setAttribute("aria-expanded", "false");
      control.addEventListener("pointerenter", event => {
        if (event.pointerType !== "mouse" || state.pinned) return;
        clearTimeout(state.dismissTimer);
        clearTimeout(state.previewTimer);
        state.previewTimer = setTimeout(() => readSection(key), 200);
      });
      control.addEventListener("focus", () => {
        clearTimeout(state.dismissTimer);
        if (!state.restoringFocus && !state.pinned) readSection(key);
      });
      control.addEventListener("keydown", event => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          readSection(key, true);
          readerLabel.focus();
        }
      });
      control.addEventListener("pointerleave", () => clearTimeout(state.previewTimer));
      sections[key] = control;
      sectionNav.append(control);
    }
    const hint = document.createElement("p");
    hint.textContent = "Hover to preview. Click to keep open.";
    const task = document.createElement("div");
    task.dataset.ampSubagentsTask = "";
    const output = document.createElement("div");
    output.dataset.ampSubagentsOutput = "";
    const original = button("View original ↗", () => {
      const item = state.items.get(state.selected);
      const source = item.event?.isConnected ? item.event : item.source;
      close();
      source?.setAttribute("data-amp-subagent-revealed", "");
      state.inline.get(source)?.setAttribute("aria-expanded", "true");
      source?.scrollIntoView({ block: "center" });
      const header = source?.querySelector("[data-transcript-expandable-row]");
      if (header) {
        if (!source.querySelector(detailSelector)) header.click();
        header.focus({ preventScroll: true });
      }
    });
    detail.append(title, status, sectionNav, hint, original);
    panel.append(heading, list, detail);
    const readerBody = document.createElement("div");
    readerBody.dataset.ampSubagentsReading = "";
    readerBody.append(readerTitle, notice, task, output);
    reader.append(readerHeader, readerBody);
    const escape = event => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.stopPropagation();
      if (state.section) {
        closeReader(true);
      } else {
        close();
        state.toggle.focus();
      }
    };
    for (const surface of [panel, reader]) {
      surface.addEventListener("keydown", escape);
      surface.addEventListener("pointerenter", () => clearTimeout(state.dismissTimer));
      surface.addEventListener("pointerleave", deferReaderClose);
      surface.addEventListener("focusin", () => clearTimeout(state.dismissTimer));
      surface.addEventListener("focusout", deferReaderClose);
    }
    const toggle = button("Subagents", () => {
      if (state.open) close();
      else { state.open = true; schedule(); }
    });
    toggle.dataset.ampSubagentsUi = "toggle";
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", "false");
    const sizing = new ResizeObserver(() => host.toggleAttribute("data-amp-subagents-overlay", host.clientWidth < 800));
    sizing.observe(host);
    return { host, thread: transcript.dataset.threadId, panel, toggle, list, title, status,
      reader, readerTitle, readerLabel, pin, sections, section: null, pinned: false,
      notice, task, output, original, sizing, items: new Map(), inline: new Map(), selected: null, open: false, expanded: new Set() };
  }

  function item(key, title) {
    if (!state.items.has(key)) {
      const entry = { key, title, status: "Activity", task: "", output: "" };
      entry.button = button("", () => select(key));
      entry.name = document.createElement("span");
      entry.summary = document.createElement("small");
      entry.button.append(entry.name, entry.summary);
      state.list.append(entry.button);
      state.items.set(key, entry);
    }
    return state.items.get(key);
  }

  function expand(source) {
    if (!source || source.querySelector(detailSelector)) return;
    const header = source.querySelector("[data-transcript-expandable-row]");
    if (!header || state.expanded.has(header) || header.querySelector(".expandable-row-chevron.rotate-90")) return;
    state.expanded.add(header);
    header.click();
  }

  function refresh() {
    pending = false;
    const transcript = document.querySelector(".thread-layout-panes [data-thread-transcript-scroll][data-thread-id]");
    const host = transcript?.closest(".thread-layout-panes");
    const toolbar = host?.querySelector(".thread-title-bar-container .app-title-bar");
    if (!host || !toolbar) { teardown(); return; }
    if (state && (state.host !== host || state.thread !== transcript.dataset.threadId)) teardown();
    const sources = [...transcript.querySelectorAll(agentSelector)];
    const events = [...transcript.querySelectorAll(eventSelector)];
    const results = new Map();
    for (const event of events) {
      const link = event.querySelector("a[data-transcript-automation-event-source]");
      const id = link?.getAttribute("href");
      if (!id?.startsWith("#tool:")) continue;
      const title = link.textContent.trim();
      if (!results.has(title)) results.set(title, new Set());
      results.get(title).add(id);
    }
    if (!sources.length && !events.length) { teardown(); return; }
    if (!state) state = create(host, transcript);
    if (enabled && desktop.matches) {
      if (!state.toggle.isConnected) toolbar.append(state.toggle);
      if (!state.panel.isConnected) host.append(state.panel, state.reader);
    } else {
      if (state.open) close();
      state.toggle.remove();
      state.panel.remove();
      state.reader.remove();
    }
    for (const entry of state.items.values()) { entry.source = null; entry.event = null; }

    for (const [index, source] of sources.entries()) {
      const row = source.closest("[data-transcript-message-lookup-id]");
      const siblings = row ? [...row.querySelectorAll(agentSelector)] : sources;
      const key = `call:${row?.id || row?.dataset.transcriptMessageLookupId || "loaded"}:${row ? siblings.indexOf(source) : index}`;
      const header = source.querySelector("[data-transcript-expandable-row]") || source.querySelector(":scope > div > div");
      const labels = [...(header?.querySelectorAll(":scope > div > span") || [])].map(e => e.textContent.trim()).filter(Boolean);
      const title = labels[1] || "Subagent";
      const entry = item(key, title);
      entry.title = title;
      entry.source = source;
      entry.invocation = true;
      const prompt = source.querySelector("[data-transcript-subagent-prompt]");
      const response = source.querySelector("[data-transcript-subagent-response]");
      const error = source.querySelector("[data-transcript-subagent-error]");
      if (prompt) entry.task = text(prompt);
      if (response || error) {
        entry.sourceOutput = text(error || response);
        entry.output = entry.sourceOutput;
      }
      if (source.querySelector('[data-transcript-tool-status="cancelled"]')) entry.status = "Cancelled";
      else if (error) entry.status = "Failed";
      else if (source.querySelector("[data-transcript-subagent-working]")) entry.status = "Running";
      else if (response) entry.status = "Finished";
      else if (/Delegated/.test(labels[0])) entry.status = "Delegated";
      else if (/finished/i.test(labels[0]) && entry.status !== "Failed") entry.status = "Finished";
    }

    for (const entry of state.items.values()) {
      if (entry.backgroundTitle && ([...state.items.values()].filter(e => e.invocation && e.title === entry.backgroundTitle).length !== 1 || results.get(entry.backgroundTitle)?.size > 1)) {
        entry.output = entry.sourceOutput || "";
        delete entry.backgroundTitle;
      }
    }
    for (const event of events) {
      const link = event.querySelector("a[data-transcript-automation-event-source]");
      if (!link?.getAttribute("href")?.startsWith("#tool:")) continue;
      const title = link.textContent.trim();
      const key = `result:${link.getAttribute("href")}`;
      const matches = [...state.items.values()].filter(e => e.invocation && e.title === title);
      // Amp does not expose invocation tool IDs here. Never guess between duplicate titles.
      const entry = matches.length === 1 && results.get(title).size === 1 ? matches[0] : item(key, `Result: ${title}`);
      if (entry.key !== key && state.items.has(key)) {
        const previous = state.items.get(key);
        previous.button.remove();
        state.items.delete(key);
        if (state.selected === key) state.selected = entry.key;
      }
      entry.event = event;
      if (entry.invocation) entry.backgroundTitle = title;
      entry.status = /failed/i.test(event.querySelector("[data-transcript-automation-event-label]")?.textContent || "") ? "Failed" : "Finished";
      const output = event.querySelector("[data-transcript-automation-event-markdown], [data-transcript-automation-event-text]");
      if (output) entry.output = text(output);
    }

    if (!state.items.has(state.selected)) state.selected = state.items.keys().next().value;
    write(state.toggle, `Subagents ${state.items.size}`);
    state.toggle.setAttribute("aria-expanded", String(state.open));
    state.panel.hidden = !state.open;
    host.toggleAttribute("data-amp-subagents-open", state.open);
    const activeSources = new Set();
    for (const entry of state.items.values()) {
      write(entry.name, entry.title);
      write(entry.summary, entry.status);
      const active = entry.status === "Running" || entry.status === "Delegated";
      entry.summary.toggleAttribute("data-amp-subagent-active", active);
      entry.button.setAttribute("aria-pressed", String(entry.key === state.selected));
      for (const source of [entry.source, entry.event]) {
        if (!source) continue;
        activeSources.add(source);
        let reference = state.inline.get(source);
        if (!reference) {
          reference = button("", () => {
            const revealed = source.toggleAttribute("data-amp-subagent-revealed");
            reference.setAttribute("aria-expanded", String(revealed));
            if (revealed) expand(source);
          });
          reference.dataset.ampSubagentsUi = "reference";
          reference.setAttribute("aria-expanded", "false");
          state.inline.set(source, reference);
        }
        if (reference.nextElementSibling !== source) source.before(reference);
        source.setAttribute("data-amp-subagent-inline", "");
        const kind = source === entry.event && !entry.title.startsWith("Result:") ? "Result: " : "";
        write(reference, `Subagent · ${kind}${entry.title} · ${entry.status}`);
        reference.toggleAttribute("data-amp-subagent-active", active);
      }
    }
    for (const [source, reference] of state.inline) {
      if (!activeSources.has(source)) {
        reference.remove();
        source.removeAttribute("data-amp-subagent-inline");
        source.removeAttribute("data-amp-subagent-revealed");
        state.inline.delete(source);
      }
    }
    if (!state.open) return;
    const selected = state.items.get(state.selected);
    expand(selected.source);
    expand(selected.event);
    write(state.title, selected.title);
    write(state.readerTitle, selected.title);
    write(state.status, selected.status);
    state.status.toggleAttribute("data-amp-subagent-active", selected.status === "Running" || selected.status === "Delegated");
    write(state.task, selected.task || "Task details are not currently rendered by Amp. Open the original activity to load them.");
    write(state.output, selected.output || "Output will appear here when Amp makes it available.");
    const connected = !!(selected.source || selected.event);
    write(state.notice, connected ? "" : "Showing the last visible content. Scroll the conversation to load this agent again.");
    state.notice.hidden = connected;
    state.original.disabled = !connected;
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(refresh);
  }

  new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      if (target?.closest("[data-amp-subagents-ui]")) return false;
      if (record.type === "childList" && [...record.addedNodes, ...record.removedNodes].length &&
        [...record.addedNodes, ...record.removedNodes].every(node => node instanceof Element && node.matches("[data-amp-subagents-ui]"))) return false;
      return true;
    })) schedule();
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["data-thread-id", "data-transcript-tool-status", "data-transcript-subagent-working"] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.subagentPanel) return;
    settings.subagentPanel = changes.subagentPanel.newValue;
    enabled = settings.subagentPanel !== false;
    schedule();
  });
  chrome.storage.local.get(["subagentPanel"]).then(initial => {
    settings = { ...initial, ...settings };
    enabled = settings.subagentPanel !== false;
    schedule();
  });
  desktop.addEventListener("change", schedule);
})();

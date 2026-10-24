(() => {
  const desktop = matchMedia("(min-width: 768px)");
  const agentSelector = "[data-transcript-subagent]";
  const eventSelector = '[data-transcript-automation-event="subagent"]';
  const detailSelector = "[data-transcript-subagent-prompt], [data-transcript-subagent-response], [data-transcript-subagent-error], [data-transcript-automation-event-markdown], [data-transcript-automation-event-text]";
  let enabled = false;
  let changed = false;
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
    state.open = false;
    state.host.removeAttribute("data-amp-subagents-open");
    state.panel.hidden = true;
    state.toggle.setAttribute("aria-expanded", "false");
    for (const header of state.expanded) {
      if (header.isConnected && header.querySelector(".expandable-row-chevron.rotate-90")) header.click();
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
    for (const item of state.items.values()) {
      for (const source of [item.source, item.event]) source?.removeAttribute("data-amp-subagent-inline");
      item.reference?.remove();
    }
    state = undefined;
  }

  function select(key) {
    state.selected = key;
    state.open = true;
    schedule();
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
    const taskLabel = document.createElement("h4");
    taskLabel.textContent = "Task";
    const task = document.createElement("div");
    task.dataset.ampSubagentsTask = "";
    const outputLabel = document.createElement("h4");
    outputLabel.textContent = "Output";
    const output = document.createElement("div");
    output.dataset.ampSubagentsOutput = "";
    const original = button("View original ↗", () => {
      const item = state.items.get(state.selected);
      const source = item.event?.isConnected ? item.event : item.source;
      close();
      source?.scrollIntoView({ block: "center" });
      const header = source?.querySelector("[data-transcript-expandable-row]");
      if (header) {
        if (!source.querySelector(detailSelector)) header.click();
        header.focus({ preventScroll: true });
      }
    });
    detail.append(title, status, notice, taskLabel, task, outputLabel, output, original);
    panel.append(heading, list, detail);
    panel.addEventListener("keydown", event => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.stopPropagation();
      close();
      state.toggle.focus();
    });
    const toggle = button("Subagents", () => {
      if (state.open) close();
      else { state.open = true; schedule(); }
    });
    toggle.dataset.ampSubagentsUi = "toggle";
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", "false");
    const sizing = new ResizeObserver(() => host.toggleAttribute("data-amp-subagents-overlay", host.clientWidth < 800));
    sizing.observe(host);
    host.append(panel);
    return { host, thread: transcript.dataset.threadId, panel, toggle, list, title, status,
      notice, task, output, original, sizing, items: new Map(), selected: null, open: false, expanded: new Set() };
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
    if (!enabled || !desktop.matches || !host || !toolbar) { teardown(); return; }
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
    if (!state.toggle.isConnected) toolbar.append(state.toggle);
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
      if (state.open && prompt) entry.task = text(prompt);
      if (state.open && (response || error)) {
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
        previous.reference?.remove();
        state.items.delete(key);
        if (state.selected === key) state.selected = entry.key;
      }
      entry.event = event;
      if (entry.invocation) entry.backgroundTitle = title;
      entry.status = /failed/i.test(event.querySelector("[data-transcript-automation-event-label]")?.textContent || "") ? "Failed" : "Finished";
      const output = event.querySelector("[data-transcript-automation-event-markdown], [data-transcript-automation-event-text]");
      if (state.open && output) entry.output = text(output);
    }

    if (!state.items.has(state.selected)) state.selected = state.items.keys().next().value;
    write(state.toggle, `Subagents ${state.items.size}`);
    state.toggle.setAttribute("aria-expanded", String(state.open));
    state.panel.hidden = !state.open;
    host.toggleAttribute("data-amp-subagents-open", state.open);
    for (const entry of state.items.values()) {
      write(entry.name, entry.title);
      write(entry.summary, entry.status);
      entry.button.setAttribute("aria-pressed", String(entry.key === state.selected));
      for (const source of [entry.source, entry.event]) source?.setAttribute("data-amp-subagent-inline", "");
      const source = entry.source || entry.event;
      if (entry.reference && entry.reference.previousElementSibling !== source) { entry.reference.remove(); entry.reference = null; }
      if (source && !entry.reference) {
        entry.reference = button("", () => { select(entry.key); state.title.focus(); });
        entry.reference.dataset.ampSubagentsUi = "reference";
        source.after(entry.reference);
      }
      if (entry.reference) write(entry.reference, `Subagent · ${entry.title} · ${entry.status} ↗`);
    }
    if (!state.open) return;
    const selected = state.items.get(state.selected);
    expand(selected.source);
    expand(selected.event);
    write(state.title, selected.title);
    write(state.status, selected.status);
    write(state.task, selected.task || selected.title);
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
    if (area !== "local" || !changes.enabled) return;
    changed = true;
    enabled = changes.enabled.newValue !== false;
    schedule();
  });
  chrome.storage.local.get("enabled").then(settings => {
    if (!changed) enabled = settings.enabled !== false;
    schedule();
  });
  desktop.addEventListener("change", schedule);
})();

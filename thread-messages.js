(() => {
  const desktop = matchMedia("(min-width: 768px)");
  const threadPattern = /^(?:https:\/\/ampcode\.com\/threads\/)?(T-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})(?:[?#].*)?$/i;
  let enabled = false;
  let changed = false;
  let state;
  let scheduled = false;
  let sequence = 0;

  function threadID(value) {
    return typeof value === "string" ? value.match(threadPattern)?.[1] : null;
  }

  function text(blocks) {
    return (blocks ?? []).filter(block => block.type === "text" && !block.hidden).map(block => block.text).join("\n\n");
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
    clearTimeout(state.poll);
    state.panel.hidden = true;
    state.toggle.setAttribute("aria-expanded", "false");
  }

  function teardown() {
    if (!state) return;
    clearTimeout(state.poll);
    state.abort?.abort();
    state.toggle.remove();
    state.panel.remove();
    state = undefined;
  }

  function create(host, toolbar, id) {
    const panel = document.createElement("aside");
    panel.id = `amp-thread-messages-${++sequence}`;
    panel.dataset.ampThreadMessagesUi = "panel";
    panel.setAttribute("aria-label", "Thread messages");
    panel.hidden = true;
    const heading = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = "Thread messages";
    const dismiss = button("Close", () => { close(); state.toggle.focus(); });
    heading.append(title, dismiss);
    const notice = document.createElement("p");
    notice.dataset.ampThreadMessagesNotice = "";
    notice.setAttribute("role", "status");
    const list = document.createElement("div");
    list.dataset.ampThreadMessagesList = "";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Choose a thread message");
    const detail = document.createElement("section");
    detail.setAttribute("aria-label", "Selected thread message");
    const status = document.createElement("p");
    const peer = document.createElement("a");
    peer.target = "_blank";
    peer.rel = "noopener noreferrer";
    const body = document.createElement("div");
    body.dataset.ampThreadMessagesBody = "";
    const error = document.createElement("p");
    error.dataset.ampThreadMessagesError = "";
    const attachments = document.createElement("p");
    const original = button("View original", () => {
      const entry = state.items.get(state.selected);
      const row = [...state.host.querySelectorAll("[data-transcript-message-lookup-id]")]
        .find(row => row.dataset.transcriptMessageLookupId === entry.messageID);
      if (!row) return;
      close();
      row.scrollIntoView({ block: "center" });
      row.tabIndex = -1;
      row.focus({ preventScroll: true });
    });
    detail.append(status, peer, body, error, attachments, original);
    panel.append(heading, notice, list, detail);
    const toggle = button("Thread messages", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) { refreshData(); dismiss.focus(); }
      else close();
    });
    toggle.dataset.ampThreadMessagesUi = "toggle";
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", "false");
    panel.addEventListener("keydown", event => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.stopPropagation();
      close();
      toggle.focus();
    });
    toolbar.append(toggle);
    host.append(panel);
    return { host, id, panel, toggle, notice, list, detail, status, peer, body, error, attachments, original,
      items: new Map(), selected: null, at: 0, loading: false, failed: false };
  }

  function collect(messages, items) {
    const results = new Map();
    for (const message of messages) {
      if (message.parentToolUseId !== undefined) continue;
      for (const block of message.content ?? []) {
        if (block.type === "tool_result") results.set(block.toolUseID, block.run);
      }
    }
    for (const message of messages) {
      if (message.parentToolUseId !== undefined) continue;
      const messageID = String(message.protocolMessageID ?? message.messageId);
      const source = threadID(message.meta?.fromExecutorThreadID);
      if (message.role === "user" && source && !message.meta?.fromPuck) {
        items.set(`incoming:${messageID}`, { messageID, peer: source, direction: "Incoming", status: "Received",
          body: text(message.content), attachments: (message.content ?? []).filter(b => ["image", "resource_link"].includes(b.type)).length });
      }
      for (const block of message.content ?? []) {
        if (message.role !== "assistant" || block.type !== "tool_use" || block.name !== "send_thread_message") continue;
        const peer = threadID(block.input?.thread);
        if (!peer) continue;
        const previous = items.get(`outgoing:${block.id}`);
        items.set(`outgoing:${block.id}`, { messageID, peer, direction: "Outgoing", callID: block.id,
          status: previous?.status ?? "Pending",
          body: typeof block.input.message === "string" ? block.input.message : "",
          error: previous?.error,
          attachments: Array.isArray(block.input.media_paths) ? block.input.media_paths.length : 0 });
      }
    }
    for (const entry of items.values()) {
      const run = results.get(entry.callID);
      if (run?.status === "done" || run?.status === "error") {
        entry.status = run.status === "done" ? "Sent" : "Failed";
        entry.error = run.status === "error" ? run.error : null;
      }
    }
  }

  function render() {
    if (!state) return;
    const s = state;
    write(s.toggle, `Thread messages${s.items.size ? ` ${s.items.size}` : ""}`);
    write(s.notice, s.failed ? "Could not refresh messages. Reopen the panel to retry." : s.loading && !s.items.size ? "Loading thread messages…" :
      "Messages from loaded page data only. Older history is not fetched.");
    for (const [key, entry] of s.items) {
      if (!entry.button) {
        entry.button = button("", () => {
          if (s.selected !== key) s.detail.scrollTop = 0;
          s.selected = key;
          render();
        });
        s.list.append(entry.button);
      }
      entry.button.dataset.delivery = entry.status.toLowerCase();
      entry.button.title = entry.peer;
      const preview = entry.body.replace(/\s+/g, " ");
      write(entry.button, `${entry.direction === "Incoming" ? "From" : "To"} thread …${entry.peer.slice(-8)}\n${entry.status} · ${preview.length > 60 ? `${preview.slice(0, 60).replace(/\s+\S*$/, "")}…` : preview || "No message text"}`);
      entry.button.setAttribute("aria-pressed", String(s.selected === key));
    }
    s.detail.hidden = !s.items.size;
    if (!s.items.size) {
      if (!s.loading && !s.failed) write(s.notice, "No thread messages in the loaded page data.");
      return;
    }
    if (!s.items.has(s.selected)) {
      s.selected = s.items.keys().next().value;
      s.items.get(s.selected).button.setAttribute("aria-pressed", "true");
    }
    const entry = s.items.get(s.selected);
    write(s.status, `${entry.direction} · ${entry.status}`);
    s.status.dataset.delivery = entry.status.toLowerCase();
    s.peer.href = `https://ampcode.com/threads/${entry.peer}`;
    write(s.peer, `${entry.direction === "Incoming" ? "From" : "To"} ${entry.peer}`);
    write(s.body, entry.body || "No message text. Open the original for prompt-only messages.");
    write(s.error, typeof entry.error === "string" ? entry.error : entry.error?.message ?? "");
    s.error.hidden = !s.error.textContent;
    write(s.attachments, entry.attachments ? `${entry.attachments} attachment${entry.attachments === 1 ? "" : "s"}. View original to inspect media.` : "");
    s.attachments.hidden = !entry.attachments;
    s.original.disabled = ![...s.host.querySelectorAll("[data-transcript-message-lookup-id]")]
      .some(row => row.dataset.transcriptMessageLookupId === entry.messageID);
  }

  async function refreshData() {
    const s = state;
    if (!s || s.loading || document.hidden) return;
    clearTimeout(s.poll);
    s.loading = true;
    s.abort = new AbortController();
    render();
    try {
      const response = await fetch(`/threads/${encodeURIComponent(s.id)}/__data`, {
        credentials: "same-origin", headers: { accept: "application/json" }, signal: s.abort.signal,
      });
      if (!response.ok) throw new Error("Thread data unavailable");
      const data = await response.json();
      if (state !== s) return;
      if (data.type !== "result" || data.thread?.id !== s.id) throw new Error("Unexpected thread data");
      // Preserve list controls across updates, but never correlate messages by text or title.
      const entries = new Map([...s.items].map(([key, entry]) => [key, { ...entry }]));
      collect(data.transcriptPage?.messages ?? data.thread.messages ?? [], entries);
      for (const [key, entry] of entries) {
        const previous = s.items.get(key);
        s.items.set(key, { ...entry, button: previous?.button });
      }
      s.failed = false;
    } catch (error) {
      if (state === s && error.name !== "AbortError") s.failed = true;
    } finally {
      if (state === s) {
        s.loading = false;
        s.at = Date.now();
        render();
        if (!s.panel.hidden) s.poll = setTimeout(() => {
          if (state === s) refreshData();
        }, 5000);
      }
    }
  }

  function refresh() {
    scheduled = false;
    const transcript = document.querySelector(".thread-layout-panes [data-thread-transcript-scroll][data-thread-id]");
    const host = transcript?.closest(".thread-layout-panes");
    const toolbar = host?.querySelector(".thread-title-bar-container .app-title-bar");
    if (!enabled || !desktop.matches || !toolbar) { teardown(); return; }
    if (state && (state.host !== host || state.id !== transcript.dataset.threadId)) teardown();
    if (!state) state = create(host, toolbar, transcript.dataset.threadId);
    if (state.toggle.parentElement !== toolbar) toolbar.append(state.toggle);
    if (!state.panel.hidden && (!state.at || Date.now() - state.at >= 5000)) refreshData();
    else render();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      return !target?.closest("[data-amp-thread-messages-ui]") &&
        !(record.type === "childList" && [...record.addedNodes, ...record.removedNodes].length &&
          [...record.addedNodes, ...record.removedNodes].every(node => node instanceof Element && node.matches("[data-amp-thread-messages-ui]")));
    })) schedule();
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-thread-id"] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.threadMessagesPanel) return;
    changed = true;
    enabled = changes.threadMessagesPanel.newValue !== false;
    schedule();
  });
  chrome.storage.local.get(["threadMessagesPanel"]).then(settings => {
    if (!changed) enabled = settings.threadMessagesPanel !== false;
    schedule();
  });
  desktop.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", schedule);
})();

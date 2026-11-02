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

  // Stroke icons on a 24-unit grid; inline SVG so page CSP cannot block them.
  const ICONS = {
    bubble: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
    chevronUp: "m18 15-6-6-6 6",
    chevronLeft: "m15 18-6-6 6-6",
    arrowDownLeft: "M17 7 7 17M17 17H7V7",
    arrowUpRight: "M7 7h10v10M7 17 17 7",
  };
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.dataset.ampThreadMessagesIcon = name;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICONS[name]);
    svg.append(path);
    return svg;
  }

  function when(value) {
    const date = new Date(value ?? NaN);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Short age for the list; the full local date and time goes in the title.
  function age(date) {
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function clock(date) {
    const today = new Date().toDateString() === date.toDateString();
    return date.toLocaleString([], today ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function stamp(node, date) {
    node.hidden = !date;
    if (!date) return;
    node.dateTime = date.toISOString();
    node.title = date.toLocaleString();
  }

  // The list and the message sit side by side in a sliding track, so the track
  // takes the height of the view being shown rather than the taller of the two.
  function fit() {
    const s = state;
    if (!s || s.panel.hidden) return;
    const content = (s.view === "message" ? s.detail : s.listView).firstElementChild;
    const height = `${content.offsetHeight}px`;
    if (s.track.style.height !== height) s.track.style.height = height;
  }

  function show(view) {
    const s = state;
    s.view = view;
    s.dock.dataset.view = view;
    s.listView.inert = view !== "list";
    s.detail.inert = view !== "message";
    fit();
  }

  function open() {
    const s = state;
    s.panel.hidden = false;
    s.toggle.setAttribute("aria-expanded", "true");
    show(s.view);
    refreshData();
  }

  function close() {
    if (!state) return;
    clearTimeout(state.poll);
    state.panel.hidden = true;
    state.dock.dataset.view = "collapsed";
    state.toggle.setAttribute("aria-expanded", "false");
  }

  function teardown() {
    if (!state) return;
    clearTimeout(state.poll);
    state.abort?.abort();
    state.dock.remove();
    state = undefined;
  }

  function create(host, id) {
    // A docked tab in the workspace's bottom-left corner. Opening it reveals the
    // conversation list; choosing an entry slides to that message.
    const dock = document.createElement("aside");
    dock.dataset.ampThreadMessagesUi = "dock";
    dock.dataset.view = "collapsed";
    dock.setAttribute("aria-label", "Thread messages");
    const panel = document.createElement("div");
    panel.id = `amp-thread-messages-${++sequence}`;
    panel.dataset.ampThreadMessagesUi = "panel";
    panel.hidden = true;
    const toggle = button("", () => (panel.hidden ? open() : close()));
    toggle.dataset.ampThreadMessagesUi = "toggle";
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", "false");
    const label = document.createElement("strong");
    label.textContent = "Messages";
    const count = document.createElement("span");
    count.dataset.ampThreadMessagesCount = "";
    count.hidden = true;
    toggle.append(icon("bubble"), label, count, icon("chevronUp"));
    const track = document.createElement("div");
    track.dataset.ampThreadMessagesTrack = "";
    // Each view scrolls its own content block; the block's height sizes the track.
    const listView = document.createElement("div");
    listView.dataset.ampThreadMessagesView = "list";
    const listContent = document.createElement("div");
    const notice = document.createElement("p");
    notice.dataset.ampThreadMessagesNotice = "";
    notice.setAttribute("role", "status");
    const list = document.createElement("div");
    list.dataset.ampThreadMessagesList = "";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Choose a thread message");
    const scope = document.createElement("p");
    scope.dataset.ampThreadMessagesScope = "";
    scope.textContent = "Only messages loaded on this page are shown.";
    listContent.append(notice, list, scope);
    listView.append(listContent);
    const detail = document.createElement("section");
    detail.dataset.ampThreadMessagesView = "message";
    detail.setAttribute("aria-label", "Selected thread message");
    const detailContent = document.createElement("div");
    const heading = document.createElement("header");
    const back = button("", () => {
      show("list");
      state.items.get(state.selected)?.button.focus();
    });
    back.dataset.ampThreadMessagesBack = "";
    back.setAttribute("aria-label", "Back to all messages");
    back.append(icon("chevronLeft"));
    const who = document.createElement("div");
    who.dataset.ampThreadMessagesPeer = "";
    const direction = document.createElement("span");
    const peer = document.createElement("a");
    peer.target = "_blank";
    peer.rel = "noopener noreferrer";
    who.append(direction, peer);
    const status = document.createElement("p");
    heading.append(back, who, status);
    const body = document.createElement("div");
    body.dataset.ampThreadMessagesBody = "";
    const error = document.createElement("p");
    error.dataset.ampThreadMessagesError = "";
    const meta = document.createElement("footer");
    const time = document.createElement("time");
    const attachments = document.createElement("span");
    attachments.dataset.ampThreadMessagesAttachments = "";
    const original = button("Show in transcript", () => {
      const entry = state.items.get(state.selected);
      const row = [...state.host.querySelectorAll("[data-transcript-message-lookup-id]")]
        .find(row => row.dataset.transcriptMessageLookupId === entry.messageID);
      if (!row) return;
      close();
      globalThis.ampRevealInTranscript(row);
    });
    original.dataset.ampThreadMessagesOriginal = "";
    meta.append(time, attachments, original);
    detailContent.append(heading, body, error, meta);
    detail.append(detailContent);
    track.append(listView, detail);
    panel.append(track);
    dock.append(toggle, panel);
    dock.addEventListener("keydown", event => {
      if (event.key !== "Escape" || event.defaultPrevented || panel.hidden) return;
      event.stopPropagation();
      close();
      toggle.focus();
    });
    host.append(dock);
    return { host, id, dock, panel, toggle, count, track, listView, notice, list, detail, back, direction, status, peer, body, error, time, attachments, original,
      view: "list", items: new Map(), selected: null, at: 0, loading: false, failed: false };
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
        items.set(`incoming:${messageID}`, { messageID, peer: source, direction: "Incoming", status: "Received", at: when(message.createdAt),
          body: text(message.content), attachments: (message.content ?? []).filter(b => ["image", "resource_link"].includes(b.type)).length });
      }
      for (const block of message.content ?? []) {
        if (message.role !== "assistant" || block.type !== "tool_use" || block.name !== "send_thread_message") continue;
        const peer = threadID(block.input?.thread);
        if (!peer) continue;
        const previous = items.get(`outgoing:${block.id}`);
        items.set(`outgoing:${block.id}`, { messageID, peer, direction: "Outgoing", callID: block.id, at: when(message.createdAt),
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
    write(s.count, String(s.items.size));
    s.count.hidden = !s.items.size;
    write(s.notice, s.failed ? "Couldn't load messages. Close and reopen to retry." : s.loading && !s.items.size ? "Loading messages…" : "");
    s.notice.hidden = !s.notice.textContent;
    for (const [key, entry] of s.items) {
      if (!entry.button) {
        entry.button = button("", () => {
          if (s.selected !== key) s.detail.scrollTop = 0;
          s.selected = key;
          render();
          show("message");
          s.back.focus();
        });
        const who = document.createElement("span");
        who.append("", document.createElement("code"));
        const mark = document.createElement("span");
        mark.append(icon(entry.direction === "Incoming" ? "arrowDownLeft" : "arrowUpRight"));
        entry.button.append(who, document.createElement("span"), document.createElement("time"), document.createElement("span"), mark);
        s.list.append(entry.button);
      }
      const [who, chip, time, preview] = entry.button.children;
      const incoming = entry.direction === "Incoming";
      entry.button.dataset.delivery = entry.status.toLowerCase();
      entry.button.dataset.direction = entry.direction.toLowerCase();
      entry.button.title = `${incoming ? "From" : "To"} thread ${entry.peer}`;
      if (who.firstChild.data !== (incoming ? "From " : "To ")) who.firstChild.data = incoming ? "From " : "To ";
      write(who.lastChild, `T-…${entry.peer.slice(-8)}`);
      // Incoming messages are always received; only sends have a delivery state worth a chip.
      write(chip, incoming ? "" : entry.status);
      chip.hidden = incoming;
      stamp(time, entry.at);
      if (entry.at) write(time, age(entry.at));
      const compact = entry.body.replace(/\s+/g, " ");
      write(preview, compact.length > 70 ? `${compact.slice(0, 70).replace(/\s+\S*$/, "")}…` : compact || "No message text");
      entry.button.setAttribute("aria-pressed", String(s.selected === key));
    }
    s.detail.hidden = !s.items.size;
    if (!s.items.size) {
      if (!s.loading && !s.failed) {
        write(s.notice, "No messages with other threads on this page.");
        s.notice.hidden = false;
      }
      if (s.view !== "list") show("list");
      fit();
      return;
    }
    if (!s.items.has(s.selected)) {
      s.selected = s.items.keys().next().value;
      s.items.get(s.selected).button.setAttribute("aria-pressed", "true");
    }
    const entry = s.items.get(s.selected);
    const incoming = entry.direction === "Incoming";
    s.detail.dataset.direction = entry.direction.toLowerCase();
    s.detail.dataset.delivery = entry.status.toLowerCase();
    write(s.direction, incoming ? "From thread" : "To thread");
    s.peer.href = `https://ampcode.com/threads/${entry.peer}`;
    write(s.peer, entry.peer);
    write(s.status, incoming ? "" : entry.status);
    s.status.hidden = incoming;
    s.status.dataset.delivery = entry.status.toLowerCase();
    write(s.body, entry.body || "No message text. Show it in the transcript to see what was sent.");
    write(s.error, typeof entry.error === "string" ? entry.error : entry.error?.message ?? "");
    s.error.hidden = !s.error.textContent;
    stamp(s.time, entry.at);
    if (entry.at) write(s.time, `${incoming ? "Received" : entry.status === "Pending" ? "Pending since" : entry.status} ${clock(entry.at)}`);
    write(s.attachments, entry.attachments ? `${entry.attachments} attachment${entry.attachments === 1 ? "" : "s"}` : "");
    s.attachments.hidden = !entry.attachments;
    s.original.disabled = ![...s.host.querySelectorAll("[data-transcript-message-lookup-id]")]
      .some(row => row.dataset.transcriptMessageLookupId === entry.messageID);
    fit();
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
    if (!enabled || !desktop.matches || !host) { teardown(); return; }
    if (state && (state.host !== host || state.id !== transcript.dataset.threadId)) teardown();
    if (!state) state = create(host, transcript.dataset.threadId);
    if (state.dock.parentElement !== host) host.append(state.dock);
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

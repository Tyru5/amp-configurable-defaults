(() => {
  // Amp only shows a thread's model and runner in hover cards and tooltips. Read
  // the same route data Amp's thread page loads, and mirror its derivation.
  const contextSelector = "[data-amp-composer-context]";
  const refreshAfter = 60_000;
  let enabled = false;
  let infoOrb = false;
  let showMessageTimestamps = false;
  let settings = {};
  let pending = false;
  const loaded = new Map();
  let contextSignature;
  let timestampRefresh;
  const timestampSelector = "[data-amp-message-timestamp]";
  const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const calendarDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
  const fullDate = new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short",
  });

  function feature(meta, prefix) {
    return meta?.features?.find(value => typeof value === "string" && value.startsWith(prefix))?.slice(prefix.length) ?? null;
  }

  function lastModel(messages) {
    for (let i = (messages?.length ?? 0) - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role === "assistant" && message.parentToolUseId === undefined && message.usage?.model) return message.usage.model;
    }
    return null;
  }

  function filePath(value) {
    try {
      if (value.startsWith("file:")) return decodeURIComponent(new URL(value).pathname);
    } catch {}
    return value;
  }

  function directory(env) {
    // Live threads store working directories as file URIs.
    if (env?.workingDirectory) return filePath(env.workingDirectory);
    const tree = env?.trees?.[0];
    if (!tree?.uri) return null;
    const path = filePath(tree.uri);
    const repo = tree.repository?.dir;
    return repo ? `${path.replace(/\/$/, "")}/${repo}` : path;
  }

  function runner(thread) {
    const type = thread.executorType ?? thread.meta?.executorType;
    const env = thread.env?.initial;
    if (type === "sandbox") return { label: "Executor", name: "Orb", directory: directory(env) };
    if (type !== "local-client") return null;
    // Amp hides generated runner IDs and falls back to the hostname.
    const id = env?.runnerID && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(env.runnerID) ? env.runnerID : null;
    const name = id ?? env?.hostname ?? null;
    const path = directory(env);
    return name || path ? { label: "Runner", name: name ?? "Local runner", directory: path } : null;
  }

  function derive(data) {
    const thread = data?.thread;
    if (!thread) return null;
    const custom = thread.meta?.customAgentDisplay;
    // Same precedence as Amp's mode tooltip: custom agent, explicit model
    // feature, then the latest top-level assistant reply.
    const model = custom?.model ?? feature(thread.meta, "model:") ??
      lastModel(data.transcriptPage?.messages) ?? lastModel(thread.messages) ?? null;
    const mode = custom?.label ?? thread.agentMode ?? thread.meta?.agentMode ?? null;
    const timestamps = new Map();
    for (const message of data.transcriptPage?.messages ?? thread.messages ?? []) {
      const id = message.protocolMessageID ?? message.messageId;
      if (id == null) continue;
      timestamps.set(String(id), null);
      if (message.parentToolUseId !== undefined || !["user", "assistant"].includes(message.role)) continue;
      const complete = message.role === "assistant" && message.state?.type === "complete";
      const finished = complete ? message.usage?.timestamp : null;
      const value = finished ?? message.createdAt;
      const date = value == null ? null : new Date(value);
      if (!date || !Number.isFinite(date.getTime())) continue;
      timestamps.set(String(id), { date, label: message.role === "user" ? "Sent" : finished ? "Finished" : "Started",
        streaming: message.role === "assistant" && !complete });
    }
    const chatTimestamps = new Map();
    for (const message of data.spaceChat ?? []) {
      if (message.messageId == null) continue;
      const date = message.createdAt == null ? null : new Date(message.createdAt);
      chatTimestamps.set(String(message.messageId), date && Number.isFinite(date.getTime()) ?
        { date, label: "Sent", streaming: false } : null);
    }
    // A generic external-agent usage marker does not identify the model.
    return { title: thread.title, model: model === "external-agent" ? null : model, mode,
      effort: feature(thread.meta, "effort:"), runner: runner(thread), timestamps, chatTimestamps };
  }

  async function load(id) {
    const response = await fetch(`/threads/${encodeURIComponent(id)}/__data`, {
      credentials: "same-origin", headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.type === "result" ? derive(data) : null;
  }

  // Amp's attachment trigger: a span holding the upload button and its hidden
  // file input, inside the composer's Attachments region.
  const triggerSelector = '[role="region"][aria-label="Attachments"] span:has(> input[type="file"][tabindex="-1"])';

  function renderTimestamps(view, context) {
    let needsRefresh = false;
    const chat = view.transcript.hasAttribute("data-thread-transcript-override");
    const timestamps = chat ? context?.chatTimestamps : context?.timestamps;
    for (const row of view.transcript.querySelectorAll('[data-transcript-message-lookup-id]')) {
      const message = chat ? row.matches('[data-transcript-message-role]') && row :
        row.querySelector(':scope > [data-transcript-entry-content] [data-transcript-message-role]');
      let time = row.querySelector(`:scope > ${timestampSelector}`);
      const stamp = message ? timestamps?.get(row.dataset.transcriptMessageLookupId) : null;
      if (!stamp) {
        time?.remove();
        if (message && !timestamps?.has(row.dataset.transcriptMessageLookupId)) needsRefresh = true;
        continue;
      }
      needsRefresh ||= stamp.streaming;
      if (!time) {
        time = document.createElement("time");
        time.setAttribute("data-amp-message-timestamp", "");
        row.prepend(time);
      }
      const iso = stamp.date.toISOString();
      const title = `${stamp.label} ${fullDate.format(stamp.date)}`;
      if (time.dateTime !== iso || time.title !== title) {
        time.dateTime = iso;
        time.textContent = `${calendarDate.format(stamp.date)} · ${clock.format(stamp.date)}`;
        time.title = title;
        time.setAttribute("aria-label", title);
      }
      time.dataset.side = message.dataset.transcriptMessageAlignment === "right" ? "right" : "left";
    }
    return needsRefresh;
  }

  function item(kind, value, title) {
    const node = document.createElement("span");
    node.dataset.ampComposerContextItem = kind;
    node.textContent = value;
    node.title = title;
    return node;
  }

  function render(view, context) {
    const trigger = view.composer?.querySelector(triggerSelector);
    if (!trigger || !context || (!context.model && !context.mode && !context.runner)) {
      view.composer?.querySelectorAll(contextSelector).forEach(node => node.remove());
      return;
    }
    let node = trigger.nextElementSibling?.matches(contextSelector) ? trigger.nextElementSibling : null;
    view.composer.querySelectorAll(contextSelector).forEach(other => { if (other !== node) other.remove(); });
    if (!node) {
      node = document.createElement("span");
      node.setAttribute("data-amp-composer-context", "");
      node.setAttribute("role", "note");
      node.setAttribute("aria-label", "Thread model and runner");
      trigger.after(node);
    }
    const { timestamps, chatTimestamps, ...display } = context;
    const key = JSON.stringify(display);
    if (node.dataset.ampComposerContextKey === key) return;
    node.dataset.ampComposerContextKey = key;
    const parts = [];
    const mode = [context.mode, context.effort && `${context.effort} effort`].filter(Boolean).join(", ");
    if (context.model) parts.push(item("model", context.model, `Model: ${context.model}${mode ? `\nMode: ${mode}` : ""}`));
    else if (context.mode) parts.push(item("mode", context.mode.startsWith("external-agent") ? "Model unavailable" : context.mode, `Mode: ${mode}`));
    if (context.effort) parts.push(item("effort", `${context.effort} effort`, `Configured effort: ${context.effort}`));
    if (context.runner) {
      const { label, name, directory } = context.runner;
      parts.push(item("runner", name, `${label}: ${name}${directory ? `\nDirectory: ${directory}` : ""}`));
    }
    node.replaceChildren(...parts);
  }

  function update() {
    pending = false;
    clearTimeout(timestampRefresh);
    const views = globalThis.ampThreadViews();
    const active = new Set(views.map(view => view.id));
    for (const id of loaded.keys()) if (!active.has(id)) loaded.delete(id);
    const composers = new Set(enabled ? views.map(view => view.composer) : []);
    document.querySelectorAll(contextSelector).forEach(node => {
      if (!composers.has(node.closest('[data-message-composer-root]'))) node.remove();
    });
    const transcripts = new Set(showMessageTimestamps ? views.map(view => view.transcript) : []);
    document.querySelectorAll(timestampSelector).forEach(node => {
      if (!transcripts.has(node.closest('[data-thread-transcript-scroll], [data-thread-transcript-override]'))) node.remove();
    });
    const contexts = new Map();
    let nextRefresh = Infinity;
    for (const view of views) {
      const id = view.id;
      let entry = loaded.get(id);
      const context = entry?.context ?? null;
      contexts.set(id, context);
      if (enabled) render(view, context);
      const missing = showMessageTimestamps && renderTimestamps(view, context);
      if (!enabled && !infoOrb && !showMessageTimestamps) continue;
      const interval = missing ? 5_000 : refreshAfter;
      const age = entry ? Date.now() - entry.at : Infinity;
      if (age < interval) {
        if (missing) nextRefresh = Math.min(nextRefresh, interval - age);
        continue;
      }
      if (entry?.loading || document.hidden) continue;
      if (!entry) {
        entry = { at: 0, context: null };
        loaded.set(id, entry);
      }
      entry.loading = true;
      const request = entry;
      load(id).catch(() => null).then(context => {
        if (loaded.get(id) !== request) return;
        request.loading = false;
        request.context = context ?? request.context;
        request.at = Date.now();
        schedule();
      });
    }
    globalThis.ampThreadContexts = contexts;
    const signature = JSON.stringify([...contexts].map(([id, context]) => [id, context?.title, context?.mode, context?.runner]));
    if (signature !== contextSignature) {
      contextSignature = signature;
      dispatchEvent(new Event("amp-thread-context-change"));
    }
    if (nextRefresh < Infinity && !document.hidden) timestampRefresh = setTimeout(schedule, nextRefresh);
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof Element && record.target.closest(`${contextSelector}, ${timestampSelector}`)))) schedule();
  }).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["data-thread-id", "data-transcript-message-lookup-id", "data-transcript-message-alignment", "class", "style", "hidden"] });
  document.addEventListener("visibilitychange", schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || (!changes.showComposerContext && !changes.infoOrb && !changes.showMessageTimestamps)) return;
    for (const key of ["showComposerContext", "infoOrb", "showMessageTimestamps"]) {
      if (changes[key]) settings[key] = changes[key].newValue;
    }
    enabled = settings.showComposerContext !== false;
    infoOrb = settings.infoOrb !== false;
    showMessageTimestamps = settings.showMessageTimestamps === true;
    schedule();
  });
  chrome.storage.local.get(["showComposerContext", "infoOrb", "showMessageTimestamps"]).then(initial => {
    settings = { ...initial, ...settings };
    enabled = settings.showComposerContext !== false;
    infoOrb = settings.infoOrb !== false;
    showMessageTimestamps = settings.showMessageTimestamps === true;
    schedule();
  });
})();

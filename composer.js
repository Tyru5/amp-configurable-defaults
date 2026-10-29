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
  let loaded = { id: null, at: 0, context: null };
  let loading = null;
  let runnerSignature;
  let timestampRefresh;
  const timestampSelector = "[data-amp-message-timestamp]";
  const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const calendarDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
  const fullDate = new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short",
  });

  function threadID() {
    const scroll = document.querySelector("[data-thread-transcript-scroll][data-thread-id]");
    return scroll?.dataset.threadId ?? location.pathname.match(/^\/threads\/(T-[\w-]+)/)?.[1] ?? null;
  }

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
    // A generic external-agent usage marker does not identify the model.
    return { model: model === "external-agent" ? null : model, mode, effort: feature(thread.meta, "effort:"), runner: runner(thread), timestamps };
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

  function uploadTrigger() {
    const composer = document.querySelector("[data-thread-composer-footer] [data-message-composer-root]") ??
      document.querySelector("[data-message-composer-root]");
    return composer?.querySelector(triggerSelector) ?? null;
  }

  function remove() {
    document.querySelectorAll(contextSelector).forEach(node => node.remove());
  }

  function renderTimestamps(context) {
    if (!showMessageTimestamps) {
      document.querySelectorAll(timestampSelector).forEach(node => node.remove());
      return false;
    }
    let needsRefresh = false;
    for (const row of document.querySelectorAll('[data-thread-transcript-scroll] [data-transcript-message-lookup-id]')) {
      const message = row.querySelector(':scope > [data-transcript-entry-content] [data-transcript-message-role]');
      let time = row.querySelector(`:scope > ${timestampSelector}`);
      const stamp = message ? context?.timestamps.get(row.dataset.transcriptMessageLookupId) : null;
      if (!stamp) {
        time?.remove();
        if (message && !context?.timestamps.has(row.dataset.transcriptMessageLookupId)) needsRefresh = true;
        continue;
      }
      needsRefresh ||= stamp.streaming;
      if (!time) {
        time = document.createElement("time");
        time.setAttribute("data-amp-message-timestamp", "");
        row.querySelector(':scope > [data-transcript-entry-content]').before(time);
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

  function render(context) {
    const trigger = uploadTrigger();
    if (!trigger || !context || (!context.model && !context.mode && !context.runner)) {
      remove();
      return;
    }
    let node = trigger.nextElementSibling?.matches(contextSelector) ? trigger.nextElementSibling : null;
    if (!node) {
      remove();
      node = document.createElement("span");
      node.setAttribute("data-amp-composer-context", "");
      node.setAttribute("role", "note");
      node.setAttribute("aria-label", "Thread model and runner");
      trigger.after(node);
    }
    const { timestamps, ...display } = context;
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
    // The displays share the same request and derivation, independently of
    // whether the composer label itself is enabled.
    const id = enabled || infoOrb || showMessageTimestamps ? threadID() : null;
    const context = id && loaded.id === id ? loaded.context : null;
    const runner = context?.runner ?? null;
    const signature = JSON.stringify([id, runner]);
    if (signature !== runnerSignature) {
      runnerSignature = signature;
      globalThis.ampThreadRunner = runner;
      dispatchEvent(new Event("amp-thread-runner-change"));
    }
    if (enabled) render(context);
    else remove();
    const missingTimestamps = renderTimestamps(context);
    if (!id) {
      return;
    }
    // New/streaming messages may not have reached the route response yet. Retry
    // while visible, throttled independently of DOM mutations during streaming.
    const interval = showMessageTimestamps && missingTimestamps ? 5_000 : refreshAfter;
    const age = Date.now() - loaded.at;
    const stale = loaded.id !== id || age >= interval;
    if (!stale && showMessageTimestamps && missingTimestamps && document.visibilityState !== "hidden") {
      timestampRefresh = setTimeout(schedule, interval - age);
    }
    if (!stale || loading?.id === id || document.visibilityState === "hidden") return;
    const request = { id };
    loading = request;
    load(id).catch(() => null).then(context => {
      if (loading !== request) return;
      loading = null;
      if (threadID() !== id) return;
      // A failed refresh keeps the last known values for the same thread.
      if (!context && loaded.id === id) context = loaded.context;
      loaded = { id, at: Date.now(), context };
      schedule();
    });
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof Element && record.target.closest(`${contextSelector}, ${timestampSelector}`)))) schedule();
  }).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["data-thread-id", "data-transcript-message-lookup-id", "data-transcript-message-alignment"] });
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

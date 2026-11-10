(() => {
  // Amp only shows a thread's model and runner in hover cards and tooltips. Read
  // the same route data Amp's thread page loads, and mirror its derivation.
  const contextSelector = "[data-amp-composer-context]";
  const refreshAfter = 60_000;
  let enabled = false;
  let infoOrb = false;
  let showTimestampDates = false;
  let settings = {};
  let pending = false;
  const loaded = new Map();
  let contextSignature;
  // Amp's own message timestamps (its Always Show Timestamps setting, or Alt held).
  const timestampSelector = "time[data-transcript-exact-timestamp]";
  const calendarDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

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
    // A generic external-agent usage marker does not identify the model.
    return { title: thread.title, model: model === "external-agent" ? null : model, mode,
      effort: feature(thread.meta, "effort:"), runner: runner(thread) };
  }

  async function load(id) {
    const data = await globalThis.ampThreadData(id, Date.now() - refreshAfter);
    return data?.type === "result" ? derive(data) : null;
  }

  // Amp's attachment trigger: a span holding the upload button and its hidden
  // file input, inside the composer's Attachments region.
  const triggerSelector = '[role="region"][aria-label="Attachments"] span:has(> input[type="file"][tabindex="-1"])';

  // Amp shows only HH:mm:ss above each message. Prefix the calendar date of that
  // time in the zone Amp displayed it in, derived from the ISO instant: Amp's
  // viewer time zone can differ from the browser's. Edit the existing text node
  // so Amp's own reference to it keeps receiving its updates.
  function renderTimestampDates() {
    for (const time of document.querySelectorAll(timestampSelector)) {
      const text = time.firstChild;
      const native = /^\d{2}:\d{2}:\d{2}$/.test(text?.data) ? text.data : time.dataset.ampNativeTime;
      if (!native) continue;
      if (!showTimestampDates) {
        if (time.dataset.ampNativeTime) {
          text.data = native;
          delete time.dataset.ampNativeTime;
        }
        continue;
      }
      const date = new Date(time.dateTime);
      if (!Number.isFinite(date.getTime())) continue;
      const [hours, minutes, seconds] = native.split(":").map(Number);
      const shift = (hours * 60 + minutes) * 60 + seconds - ((date.getUTCHours() * 60 + date.getUTCMinutes()) * 60 + date.getUTCSeconds());
      // The time of day leaves the zone offset ambiguous by a day; take the
      // candidate nearest the browser's offset.
      const local = -date.getTimezoneOffset() * 60;
      const offset = [shift - 86_400, shift, shift + 86_400].reduce((a, b) => Math.abs(b - local) < Math.abs(a - local) ? b : a);
      const value = `${calendarDate.format(new Date(date.getTime() + offset * 1000))} · ${native}`;
      time.dataset.ampNativeTime = native;
      if (text.data !== value) text.data = value;
    }
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
    const key = JSON.stringify(context);
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
    renderTimestampDates();
    const views = globalThis.ampThreadViews();
    const active = new Set(views.map(view => view.id));
    for (const id of loaded.keys()) if (!active.has(id)) loaded.delete(id);
    const composers = new Set(enabled ? views.map(view => view.composer) : []);
    document.querySelectorAll(contextSelector).forEach(node => {
      if (!composers.has(node.closest('[data-message-composer-root]'))) node.remove();
    });
    const contexts = new Map();
    for (const view of views) {
      const id = view.id;
      let entry = loaded.get(id);
      const context = entry?.context ?? null;
      contexts.set(id, context);
      if (enabled) render(view, context);
      if (!enabled && !infoOrb) continue;
      if (entry && Date.now() - entry.at < refreshAfter) continue;
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
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof Element && record.target.closest(contextSelector)))) schedule();
  }).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["data-thread-id", "data-transcript-message-lookup-id", "datetime", "class", "style", "hidden"] });
  document.addEventListener("visibilitychange", schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || (!changes.showComposerContext && !changes.infoOrb && !changes.showTimestampDates)) return;
    for (const key of ["showComposerContext", "infoOrb", "showTimestampDates"]) {
      if (changes[key]) settings[key] = changes[key].newValue;
    }
    enabled = settings.showComposerContext !== false;
    infoOrb = settings.infoOrb !== false;
    showTimestampDates = settings.showTimestampDates === true;
    schedule();
  });
  chrome.storage.local.get(["showComposerContext", "infoOrb", "showTimestampDates"]).then(initial => {
    settings = { ...initial, ...settings };
    enabled = settings.showComposerContext !== false;
    infoOrb = settings.infoOrb !== false;
    showTimestampDates = settings.showTimestampDates === true;
    schedule();
  });
})();

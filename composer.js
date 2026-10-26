(() => {
  // Amp only shows a thread's model and runner in hover cards and tooltips. Read
  // the same route data Amp's thread page loads, and mirror its derivation.
  const contextSelector = "[data-amp-composer-context]";
  const refreshAfter = 60_000;
  let enabled = false;
  let settings = {};
  let pending = false;
  let loaded = { id: null, at: 0, context: null };
  let loading = null;

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
    const mode = String(thread.agentMode ?? thread.meta?.agentMode ?? "");
    if (type === "sandbox") return { label: "Executor", name: mode.startsWith("external-agent") ? "External agent" : "Orb", directory: null };
    if (type !== "local-client") return null;
    const env = thread.env?.initial;
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
    return { model, mode, effort: feature(thread.meta, "effort:"), runner: runner(thread) };
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
    const key = JSON.stringify(context);
    if (node.dataset.ampComposerContextKey === key) return;
    node.dataset.ampComposerContextKey = key;
    const parts = [];
    const mode = [context.mode, context.effort && `${context.effort} effort`].filter(Boolean).join(", ");
    if (context.model) parts.push(item("model", context.model, `Model: ${context.model}${mode ? `\nMode: ${mode}` : ""}`));
    else if (mode) parts.push(item("mode", mode, `Mode: ${mode}`));
    if (context.runner) {
      const { label, name, directory } = context.runner;
      parts.push(item("runner", name, `${label}: ${name}${directory ? `\nDirectory: ${directory}` : ""}`));
    }
    node.replaceChildren(...parts);
  }

  function update() {
    pending = false;
    const id = enabled ? threadID() : null;
    if (!id) {
      remove();
      return;
    }
    if (loaded.id === id) render(loaded.context);
    else remove();
    const stale = loaded.id !== id || Date.now() - loaded.at > refreshAfter;
    if (!stale || loading?.id === id || document.visibilityState === "hidden") return;
    const request = { id };
    loading = request;
    load(id).catch(() => null).then(context => {
      if (loading === request) loading = null;
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
    if (records.some(record => !(record.target instanceof Element && record.target.closest(contextSelector)))) schedule();
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-thread-id"] });
  document.addEventListener("visibilitychange", schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.showComposerContext) return;
    settings.showComposerContext = changes.showComposerContext.newValue;
    enabled = settings.showComposerContext !== false;
    schedule();
  });
  chrome.storage.local.get(["showComposerContext"]).then(initial => {
    settings = { ...initial, ...settings };
    enabled = settings.showComposerContext !== false;
    schedule();
  });
})();

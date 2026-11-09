(() => {
  const desktop = matchMedia("(min-width: 768px)");
  const controllers = new Map();
  const settingsURL = "/settings/skills";
  let enabled = false;
  let changed = false;
  let scheduled = false;
  let sequence = 0;

  function node(tag, text, part) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (part) element.dataset.ampToolsUi = part;
    return element;
  }

  function button(text, action, part) {
    const element = node("button", text, part);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  }

  function write(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function skillInfo(result) {
    const text = result?.content?.[0]?.text;
    if (typeof text !== "string") return {};
    const baseDir = text.match(/(?:^|\n)Base directory for this skill: ([^\n]+)/)?.[1];
    // This is an excerpt, not invented description metadata. Never render tool
    // output as HTML, fetch a SKILL.md, or interpret instructions in the result.
    const excerpt = text.replace(/^<loaded_skill[^>]*>\s*/, "").split(/\n\s*\n/)
      .find(part => part.trim() && !/^\s*(?:#|<|Base directory for this skill:)/.test(part));
    return { baseDir, excerpt: excerpt?.trim().slice(0, 400) };
  }

  function controller() {
    let view;
    let state;

    function teardown() {
      if (!state) return;
      state.abort?.abort();
      clearTimeout(state.poll);
      clearTimeout(state.tipTimer);
      state.resize.disconnect();
      hideTip();
      state.dialog.close();
      for (const element of [state.rail, state.toggle, state.dialog, state.tip]) element.remove();
      state.composer.removeAttribute("data-amp-tools-collapsed");
      state = undefined;
    }

    function hideTip() {
      if (!state) return;
      clearTimeout(state.tipTimer);
      state.tipAnchor?.removeAttribute("aria-describedby");
      state.tipAnchor = null;
      if (state.tip.matches(":popover-open")) state.tip.hidePopover();
    }

    function describe(skill, target) {
      target.replaceChildren(node("strong", skill.name),
        node("p", skill.excerpt || "Instruction text isn't included in this history summary."),
        node("small", skill.excerpt ? "From the loaded skill instructions" : "Loaded in this thread"));
      if (skill.baseDir) target.append(node("small", skill.baseDir));
    }

    function link(skill, inDialog = false) {
      const anchor = node("a", skill.name);
      anchor.href = settingsURL;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.setAttribute("aria-label", `${skill.name}, open Skills settings in a new tab`);
      const show = () => {
        if (inDialog) {
          state.selected = skill.name;
          state.list.querySelectorAll("a").forEach(item => item.toggleAttribute("data-selected", item === anchor));
          describe(skill, state.detail);
          return;
        }
        hideTip();
        state.tipAnchor = anchor;
        describe(skill, state.tip);
        state.tip.append(node("small", "Click to open Skills settings in a new tab"));
        anchor.setAttribute("aria-describedby", state.tip.id);
        state.tip.showPopover();
        globalThis.ampPlacePopover(state.tip, anchor);
      };
      anchor.addEventListener("pointerenter", show);
      anchor.addEventListener("focus", show);
      if (!inDialog) {
        const leave = () => { state.tipTimer = setTimeout(hideTip, 120); };
        anchor.addEventListener("pointerleave", leave);
        anchor.addEventListener("blur", leave);
      }
      return anchor;
    }

    function open(event) {
      hideTip();
      render();
      state.opener = event.currentTarget;
      state.dialog.showModal();
      state.toggle.setAttribute("aria-expanded", "true");
    }

    function setup() {
      const prefix = `amp-tools-${++sequence}`;
      const toggle = button("Thread tools", open, "toggle");
      toggle.dataset.ampComposerControl = "tools";
      toggle.setAttribute("aria-haspopup", "dialog");
      toggle.setAttribute("aria-controls", prefix);
      toggle.setAttribute("aria-expanded", "false");
      toggle.prepend(globalThis.ampIcon("M4 7h16M4 17h16M8 4v6M16 14v6"));
      const dialog = node("dialog", "", "dialog");
      dialog.id = prefix;
      dialog.setAttribute("aria-labelledby", `${prefix}-title`);
      const heading = node("h2", "Thread tools");
      heading.id = `${prefix}-title`;
      const close = button("×", () => dialog.close());
      close.setAttribute("aria-label", "Close thread tools");
      close.autofocus = true;
      const header = node("header");
      header.append(heading, close);
      const context = node("p", "", "context");
      const actions = node("nav", "", "actions");
      actions.setAttribute("aria-label", "Open thread panels");
      const skills = node("section", "", "skills");
      const label = node("h3");
      const notice = node("p", "", "notice");
      notice.setAttribute("role", "status");
      const browser = node("div", "", "browser");
      const list = node("ul", "", "list");
      list.setAttribute("aria-label", "Skills used in this thread");
      const detail = node("section", "", "detail");
      detail.setAttribute("aria-label", "Skill information");
      browser.append(list, detail);
      skills.append(label, notice, browser);
      const footer = node("footer");
      const settings = node("a", "Open Skills settings");
      settings.href = settingsURL;
      settings.target = "_blank";
      settings.rel = "noopener";
      settings.setAttribute("aria-label", "Open Skills settings in a new tab");
      footer.append(node("span", "Reused skills appear once."), settings);
      dialog.append(header, context, actions, skills, footer);
      dialog.addEventListener("close", () => {
        toggle.setAttribute("aria-expanded", "false");
        if (!dialog.isConnected) return;
        if (state?.activating) { state.activating = false; return; }
        if (state?.opener?.checkVisibility()) state.opener.focus({ preventScroll: true });
        else if (toggle.checkVisibility()) toggle.focus({ preventScroll: true });
        else state?.rail.querySelector("button")?.focus({ preventScroll: true });
      });
      dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
      const rail = node("div", "", "rail");
      const tip = node("div", "", "tooltip");
      tip.id = `${prefix}-tip`;
      tip.popover = "manual";
      tip.setAttribute("role", "tooltip");
      tip.addEventListener("pointerenter", () => clearTimeout(state.tipTimer));
      tip.addEventListener("pointerleave", hideTip);
      const resize = new ResizeObserver(schedule);
      resize.observe(view.composer);
      resize.observe(view.toolbar.parentElement);
      state = { id: view.id, composer: view.composer, toolbar: view.toolbar, toggle, dialog, rail, tip,
        context, actions, skills, label, notice, list, detail, footer, resize,
        used: new Map(), calls: new Map(), at: 0, dirty: true, historyLoaded: false, failed: false, incomplete: false };
      view.host.append(dialog, tip);
    }

    function collect(pages, summaries) {
      const s = state;
      const messages = pages.flatMap(page => page.messages ?? []);
      // Calls and results can land on different pages. Scan calls first across
      // all pages and keep pending skill IDs for subsequent live refreshes.
      for (const message of messages) {
        if (message.parentToolUseId !== undefined) continue;
        for (const block of message.content ?? []) {
          if (block.type === "tool_use" && block.name === "skill" && typeof block.input?.name === "string") {
            s.calls.set(block.id, block.input.name);
          }
        }
      }
      for (const turn of [...summaries, ...pages.flatMap(page => page.collapsedTurns ?? [])]) {
        if (!Array.isArray(turn.sources?.skills)) { s.incomplete = true; continue; }
        for (const skill of turn.sources.skills) {
          if (typeof skill.name === "string" && !s.used.has(skill.name)) s.used.set(skill.name, { name: skill.name, baseDir: skill.baseDir });
        }
      }
      for (const message of messages) {
        if (message.parentToolUseId !== undefined) continue;
        for (const block of message.content ?? []) {
          const name = s.calls.get(block.toolUseID);
          if (block.type !== "tool_result" || block.run?.status !== "done" || !name) continue;
          s.used.set(name, { ...s.used.get(name), name, ...skillInfo(block.run.result) });
        }
      }
    }

    async function load() {
      const s = state;
      if (!s || !enabled || s.loading || document.hidden) return;
      clearTimeout(s.poll);
      s.poll = null;
      s.dirty = false;
      s.loading = true;
      s.abort = new AbortController();
      const pages = [];
      let summaries = [];
      const get = async url => {
        const response = await fetch(url, { credentials: "same-origin", headers: { accept: "application/json" }, signal: s.abort.signal });
        if (!response.ok) throw new Error(`Thread history: ${response.status}`);
        return response.json();
      };
      try {
        const data = await get(`/threads/${encodeURIComponent(s.id)}/__data`);
        if (state !== s) return;
        if (data.type !== "result" || !data.thread) throw new Error("Thread history unavailable");
        const first = data.transcriptPage ?? { messages: data.thread.messages ?? [] };
        pages.push(first);
        summaries = data.collapsedTurns ?? [];
        if (!s.historyLoaded) s.incomplete = false;
        for (const direction of ["Before", "After"]) {
          let page = first;
          const visited = new Set();
          while (page[`hasMore${direction}`]) {
            // After a hidden tab or a burst of activity, bridge any gap between
            // the newest page and the history already collected.
            if (direction === "Before" && s.historyLoaded && page.firstMessageIndex <= s.lastMessageIndex) break;
            const edge = direction === "Before" ? "first" : "last";
            const index = page[`${edge}MessageIndex`];
            const anchor = page[`${edge}MessageID`];
            if (index == null || !anchor || visited.has(anchor)) throw new Error("Incomplete history cursor");
            visited.add(anchor);
            const params = new URLSearchParams({ [direction.toLowerCase()]: String(index), anchorID: anchor, conversation: "1" });
            page = await get(`/api/threads/${encodeURIComponent(s.id)}/transcript-page?${params}`);
            if (state !== s) return;
            pages.push(page);
          }
        }
        s.lastMessageIndex = Math.max(...pages.map(page => page.lastMessageIndex ?? 0), s.lastMessageIndex ?? 0);
        s.historyLoaded = true;
        s.failed = false;
      } catch {
        if (state !== s || s.abort.signal.aborted) return;
        s.failed = true;
        // A stale anchor or failed page is retried from fresh route data, not
        // from the failed cursor. Keep the known skills and label them partial.
        s.historyLoaded = false;
      } finally {
        if (state === s) {
          collect(pages, summaries);
          s.loading = false;
          s.at = Date.now();
          schedule();
        }
      }
    }

    function render() {
      const s = state;
      const skills = [...s.used.values()].sort((a, b) => a.name.localeCompare(b.name));
      const partial = s.failed || s.incomplete;
      const count = `(${skills.length}${partial ? "+" : ""})`;
      const status = s.failed ? "Couldn't load all history. Showing known skills; retrying on the next thread update." :
        s.incomplete ? "Some older turns have no skill summary. This list may be incomplete." :
        !s.at ? "Loading skills…" : !skills.length ? "No skills used yet. Skills appear after Amp loads them." : "Loaded at least once in this thread.";
      const signature = JSON.stringify([enabled, skills, status]);
      if (s.signature !== signature) {
        s.signature = signature;
        const focused = document.activeElement;
        const focusRegion = s.list.contains(focused) ? s.list : s.rail.contains(focused) ? s.rail : null;
        hideTip();
        const label = button(`Skills ${count}`, open);
        label.setAttribute("aria-haspopup", "dialog");
        label.setAttribute("aria-controls", s.dialog.id);
        s.rail.replaceChildren(label, ...skills.map(skill => link(skill)));
        if (!skills.length) s.rail.append(node("span", status));
        write(s.label, `Skills ${count}`);
        write(s.notice, status);
        s.list.replaceChildren(...skills.map(skill => {
          const li = node("li");
          li.append(link(skill, true));
          return li;
        }));
        s.detail.replaceChildren();
        if (skills.length) describe(s.used.get(s.selected) ?? skills[0], s.detail);
        s.skills.hidden = !enabled;
        s.footer.hidden = !enabled;
        s.rail.hidden = !enabled;
        if (focusRegion) {
          const next = focused.tagName === "BUTTON" ? focusRegion.querySelector("button") :
            [...focusRegion.querySelectorAll("a")].find(anchor => anchor.textContent === focused.textContent);
          next?.focus({ preventScroll: true });
        }
      }
      const context = s.toolbar.querySelector("[data-amp-composer-context]");
      write(s.context, [...context?.children ?? []].map(item => item.textContent).join(" · "));
      if (s.context.hidden !== !s.context.textContent) s.context.hidden = !s.context.textContent;
      const controls = [...s.toolbar.querySelectorAll("[data-amp-composer-control]")].filter(control => control !== s.toggle && !control.hidden);
      if (s.controls?.length !== controls.length || controls.some((control, i) => control !== s.controls[i])) {
        s.controls = controls;
        s.actions.replaceChildren(...controls.map(control => {
          return button("", () => {
            s.activating = true;
            s.dialog.close();
            // These remain the original controls and panels, with their native
            // state, polling, and transcript navigation. Do not duplicate them.
            control.click();
            globalThis.ampComposerAnchor(control).focus({ preventScroll: true });
          });
        }));
      }
      controls.forEach((control, i) => {
        const names = { info: "Info", subagents: "Subagents", messages: "Messages" };
        write(s.actions.children[i], `${names[control.dataset.ampComposerControl]} ${control.textContent}`.trim());
      });
    }

    function layout() {
      const s = state;
      const focused = document.activeElement;
      const wasCollapsed = s.composer.hasAttribute("data-amp-tools-collapsed");
      // Measure actual rendered content at its natural width in the same frame.
      // No clones of Amp-owned nodes and no count/font-width heuristics.
      s.composer.removeAttribute("data-amp-tools-collapsed");
      s.composer.setAttribute("data-amp-tools-measure", "");
      const row = s.toolbar.parentElement;
      const hasControls = enabled || !!s.context.textContent || !!s.actions.childElementCount;
      const crowded = hasControls && (row.scrollWidth > row.clientWidth + 1 ||
        (enabled && s.rail.scrollWidth > s.rail.clientWidth + 1));
      s.composer.removeAttribute("data-amp-tools-measure");
      s.composer.toggleAttribute("data-amp-tools-collapsed", crowded);
      if (crowded !== wasCollapsed) {
        hideTip();
        if (crowded && (s.rail.contains(focused) || s.toolbar.contains(focused) && focused !== s.toggle &&
          focused.matches("[data-amp-composer-control]"))) s.toggle.focus({ preventScroll: true });
        else if (!crowded && focused === s.toggle) s.rail.querySelector("button")?.focus({ preventScroll: true });
      }
    }

    function refresh(next) {
      view = next;
      if (!desktop.matches || !view.toolbar || view.transcript.hasAttribute("data-thread-transcript-override")) { teardown(); return; }
      if (!enabled && !view.toolbar.querySelector('[data-amp-composer-context], [data-amp-composer-control]:not([data-amp-composer-control="tools"]):not([hidden])')) { teardown(); return; }
      if (state && (state.id !== view.id || state.composer !== view.composer || state.toolbar !== view.toolbar)) teardown();
      if (!state) setup();
      const row = view.toolbar.parentElement;
      if (row === view.composer) {
        if (state.rail.parentElement !== row) row.prepend(state.rail);
      } else if (state.rail.nextElementSibling !== row) row.before(state.rail);
      globalThis.ampMountComposerControl(view.toolbar, state.toggle);
      render();
      layout();
      if (enabled && state.dirty && !document.hidden && !state.loading) {
        const wait = 5000 - (Date.now() - state.at);
        if (wait <= 0) load();
        else if (!state.poll) state.poll = setTimeout(() => { state.poll = null; load(); }, wait);
      }
    }

    function transcriptChanged(target) {
      if (state && view.transcript.contains(target)) state.dirty = true;
    }

    function resumed() {
      if (state) state.dirty = true;
    }

    return { refresh, teardown, hideTip, transcriptChanged, resumed };
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      globalThis.ampSyncThreadViews(controllers, controller);
    });
  }

  new MutationObserver(records => {
    let relevant = false;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest("[data-amp-tools-ui]")) continue;
      const nodes = [...record.addedNodes, ...record.removedNodes];
      if (nodes.length && nodes.every(node => node instanceof Element && node.matches("[data-amp-tools-ui]"))) continue;
      relevant = true;
      if (!target?.closest("[data-amp-subagents-ui], [data-amp-tool-preview], [data-amp-message-timestamp]")) {
        for (const controller of controllers.values()) controller.transcriptChanged(target);
      }
    }
    if (relevant) schedule();
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["data-thread-id", "class", "style", "hidden"] });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") for (const controller of controllers.values()) controller.hideTip();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) for (const controller of controllers.values()) controller.resumed();
    schedule();
  });
  desktop.addEventListener("change", schedule);
  addEventListener("resize", schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.showComposerSkills) return;
    changed = true;
    enabled = changes.showComposerSkills.newValue !== false;
    for (const controller of controllers.values()) controller.teardown();
    schedule();
  });
  chrome.storage.local.get(["showComposerSkills"]).then(settings => {
    if (!changed) enabled = settings.showComposerSkills !== false;
    schedule();
  });
})();

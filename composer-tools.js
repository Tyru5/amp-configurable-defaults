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

  // The cursor Amp uses to expand a collapsed turn, from its thread page bundle.
  function turnRange(turn) {
    const { turnID, startIndex, endIndex, leadIndex } = turn;
    if (typeof turnID !== "string" || !turnID.startsWith("t:u:") ||
      ![startIndex, endIndex, leadIndex].every(Number.isInteger) || startIndex > endIndex) return undefined;
    return { anchorID: turnID.slice(4), startIndex, endIndex, leadIndex };
  }

  async function getJSON(url, signal) {
    const response = await fetch(url, { credentials: "same-origin", headers: { accept: "application/json" }, signal });
    if (!response.ok) throw new Error(`Thread history: ${response.status}`);
    return response.json();
  }

  function controller() {
    let view;
    let state;

    function teardown() {
      if (!state) return;
      dropBack();
      state.abort?.abort();
      state.summaryAbort.abort();
      clearTimeout(state.poll);
      clearTimeout(state.tipTimer);
      state.resize.disconnect();
      hideTip();
      for (const element of [state.rail, state.toggle, state.panel, state.tip]) element.remove();
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
      if (!skill.excerpt && state.turns.size && !state.summaries.has(skill.name)) summarize(skill.name);
      const text = skill.excerpt || {
        loading: "Loading an excerpt from this skill's instructions…",
        failed: "Couldn't read this skill's instructions. Look at it again to retry.",
      }[state.summaries.get(skill.name)] || "No excerpt in the main transcript. A subagent likely loaded this skill.";
      target.skillName = skill.name;
      target.replaceChildren(node("strong", skill.name), node("p", text),
        node("small", skill.excerpt ? "From the loaded skill instructions" : "Loaded in this thread"));
      if (skill.baseDir) target.append(node("small", skill.baseDir));
      if (target === state.tip) target.append(node("small", "Click to open Skills settings in a new tab"));
    }

    // Amp's collapsed turns carry only cursors, not which skills they loaded.
    // When someone looks at a skill without details, read collapsed turns the
    // way Amp expands one, newest first, until its result appears. Each turn
    // keeps its read position, so no message is requested twice, and reads run
    // one at a time.
    function summarize(name) {
      const s = state;
      s.summaries.set(name, "loading");
      s.reading = (s.reading ?? Promise.resolve()).then(async () => {
        const found = () => s.used.get(name)?.excerpt;
        try {
          for (const turn of [...s.turns.values()].sort((a, b) => b.startIndex - a.startIndex)) {
            // Skills usually load early in a turn: read its first messages, then
            // the rest in Amp's own chunk size.
            for (let size = turn.next === turn.startIndex ? 100 : 5000; turn.next <= turn.endIndex && !found(); size = 5000) {
              const end = Math.min(turn.endIndex, turn.next + size - 1);
              const params = new URLSearchParams({ start: String(turn.next), end: String(end), anchor: String(turn.leadIndex), anchorID: turn.anchorID });
              const page = await getJSON(`/api/threads/${encodeURIComponent(s.id)}/transcript-range?${params}`, s.summaryAbort.signal);
              if (state !== s) return;
              collect([page]);
              turn.next = end + 1;
            }
            if (found()) break;
          }
          s.summaries.set(name, "done");
        } catch {
          if (state !== s) return;
          s.summaries.set(name, "failed");
        }
        // Reading may also have found other skills' details; update whatever is shown.
        for (const target of [s.tip, s.detail]) {
          const skill = s.used.get(target.skillName);
          if (!skill || (target === s.tip && !s.tip.matches(":popover-open"))) continue;
          describe(skill, target);
          if (target === s.tip) globalThis.ampPlacePopover(s.tip, s.tipAnchor);
        }
      });
    }

    function link(skill, inPanel = false) {
      const anchor = node("a", skill.name);
      anchor.href = settingsURL;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.setAttribute("aria-label", `${skill.name}, open Skills settings in a new tab`);
      const show = () => {
        const current = state.used.get(skill.name) ?? skill;
        // Looking at a skill again retries a failed read.
        if (state.summaries.get(skill.name) === "failed") state.summaries.delete(skill.name);
        if (inPanel) {
          state.selected = skill.name;
          state.list.querySelectorAll("a").forEach(item => item.toggleAttribute("data-selected", item === anchor));
          describe(current, state.detail);
          return;
        }
        hideTip();
        state.tipAnchor = anchor;
        describe(current, state.tip);
        anchor.setAttribute("aria-describedby", state.tip.id);
        state.tip.showPopover();
        globalThis.ampPlacePopover(state.tip, anchor);
      };
      anchor.addEventListener("pointerenter", show);
      anchor.addEventListener("focus", show);
      if (!inPanel) {
        const leave = () => { state.tipTimer = setTimeout(hideTip, 120); };
        anchor.addEventListener("pointerleave", leave);
        anchor.addEventListener("blur", leave);
      }
      return anchor;
    }

    function isOpen() {
      return !!state?.panel.matches(":popover-open");
    }

    // The visible control that opened the panel, or whichever trigger the
    // current layout shows after a resize hid it.
    function anchor() {
      const s = state;
      return [s.opener, s.toggle, s.rail.querySelector("button")].find(control => control?.checkVisibility()) ?? s.toggle;
    }

    function close() {
      if (isOpen()) state.panel.hidePopover();
    }

    function invoker(control) {
      control.popoverTargetElement = state.panel;
      control.setAttribute("aria-controls", state.panel.id);
      control.setAttribute("aria-expanded", String(isOpen()));
      control.addEventListener("click", event => { state.opener = event.currentTarget; });
    }

    // The popover's own events drive the triggers' state, so the buttons,
    // Escape, and clicks elsewhere (light dismiss) open and close it the same way.
    // beforetoggle fires synchronously, so aria-expanded never lags the popover.
    function expanded(event) {
      const s = state;
      if (s?.panel !== event.target) return;
      for (const control of [s.toggle, s.rail.querySelector("button")]) control?.setAttribute("aria-expanded", String(event.newState === "open"));
    }

    function toggled(event) {
      const s = state;
      if (s?.panel !== event.target) return;
      if (event.newState === "open") {
        hideTip();
        render();
        globalThis.ampPlacePopover(s.panel, anchor());
      } else if (s.panel.contains(document.activeElement) || document.activeElement === document.body) {
        anchor().focus({ preventScroll: true });
      }
    }

    // A panel opened from this popover leads with a Back button that closes it
    // and reopens this popover on the action that opened it. The button leaves
    // once that panel closes by any route, so opening the panel from its own
    // control shows none.
    function offerBack(control) {
      const s = state;
      dropBack();
      const target = document.getElementById(control.getAttribute("aria-controls"));
      if (!target) return;
      const back = button("Back", () => {
        dropBack();
        if (control.getAttribute("aria-expanded") === "true") control.click();
        if (!isOpen()) s.panel.showPopover();
        s.actions.children[s.controls.indexOf(control)]?.focus({ preventScroll: true });
      }, "back");
      back.title = "Back to Thread tools";
      back.setAttribute("aria-label", "Back to Thread tools");
      back.prepend(globalThis.ampIcon("m15 18-6-6 6-6"));
      (target.querySelector("header") ?? target).prepend(back);
      const watch = new MutationObserver(records => {
        if (control.getAttribute("aria-expanded") === "false" && records.some(record => record.oldValue === "true")) dropBack();
      });
      watch.observe(control, { attributeFilter: ["aria-expanded"], attributeOldValue: true });
      s.back = { button: back, watch };
    }

    function dropBack() {
      if (!state?.back) return;
      state.back.watch.disconnect();
      state.back.button.remove();
      state.back = null;
    }

    function escape(event) {
      hideTip();
      if (isOpen() && !event.defaultPrevented) {
        event.preventDefault();
        close();
      }
    }

    function setup() {
      const prefix = `amp-tools-${++sequence}`;
      const toggle = node("button", "Thread tools", "toggle");
      toggle.type = "button";
      toggle.dataset.ampComposerControl = "tools";
      toggle.prepend(globalThis.ampIcon("M4 7h16M4 17h16M8 4v6M16 14v6"));
      // Opens upward from its trigger like the Info and Messages popovers,
      // floating over the thread instead of growing the composer.
      const panel = node("section", "", "panel");
      panel.id = prefix;
      panel.popover = "auto";
      panel.setAttribute("data-amp-composer-popover", "");
      panel.setAttribute("aria-labelledby", `${prefix}-title`);
      panel.addEventListener("beforetoggle", expanded);
      panel.addEventListener("toggle", toggled);
      const heading = node("h2", "Thread tools");
      heading.id = `${prefix}-title`;
      const dismiss = button("×", close);
      dismiss.setAttribute("aria-label", "Close thread tools");
      const header = node("header");
      header.append(heading, dismiss);
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
      panel.append(header, context, actions, skills, footer);
      const rail = node("div", "", "rail");
      const tip = node("div", "", "tooltip");
      tip.id = `${prefix}-tip`;
      tip.popover = "manual";
      tip.setAttribute("role", "tooltip");
      tip.addEventListener("pointerenter", () => clearTimeout(state.tipTimer));
      tip.addEventListener("pointerleave", hideTip);
      // Size changes are the only layout inputs not visible in the DOM text.
      const resize = new ResizeObserver(() => {
        if (state) state.needsLayout = true;
        schedule();
      });
      for (const element of [view.composer, view.toolbar, view.toolbar.parentElement, rail]) resize.observe(element);
      state = { id: view.id, composer: view.composer, toolbar: view.toolbar, toggle, panel, rail, tip,
        context, actions, skills, label, notice, list, detail, footer, resize,
        used: new Map(), calls: new Map(), turns: new Map(), summaries: new Map(), summaryAbort: new AbortController(), at: 0,
        first: Date.now() - 3000, last: Date.now() - 3000, needsLayout: true, historyLoaded: false, failed: false };
      invoker(toggle);
      view.host.append(panel, tip);
    }

    function collect(pages, turns = [], activated = []) {
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
      // Amp's list of the skills activated in this thread also names skills in
      // collapsed turns and ones subagents loaded; details are read on demand.
      for (const skill of activated) {
        if (typeof skill?.name === "string" && !s.used.has(skill.name)) s.used.set(skill.name, { name: skill.name });
      }
      for (const turn of [...turns, ...pages.flatMap(page => page.collapsedTurns ?? [])]) {
        const range = turnRange(turn);
        const known = s.turns.get(turn.turnID);
        if (known && range) Object.assign(known, range);
        else if (range) s.turns.set(turn.turnID, { ...range, next: range.startIndex });
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
      const since = s.first ?? 0;
      s.first = s.last = null;
      s.loading = true;
      s.abort = new AbortController();
      const pages = [];
      let turns = [];
      let activated = [];
      const get = url => getJSON(url, s.abort.signal);
      try {
        const data = await globalThis.ampThreadData(s.id, since);
        if (state !== s) return;
        if (data.type !== "result" || !data.thread) throw new Error("Thread history unavailable");
        // The thread page sends its cursors in transcriptPage and its visible
        // messages in thread.messages; later transcript pages carry both.
        const first = data.transcriptPage?.messages ? data.transcriptPage : { ...data.transcriptPage, messages: data.thread.messages ?? [] };
        pages.push(first);
        turns = data.collapsedTurns ?? [];
        // Amp omits the list until a thread activates a skill.
        if (Array.isArray(data.thread.activatedSkills)) activated = data.thread.activatedSkills;
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
            // History is never urgent: let Amp's own loading and rendering go first.
            await new Promise(resolve => requestIdleCallback(resolve, { timeout: 2000 }));
            if (state !== s) return;
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
          collect(pages, turns, activated);
          s.loading = false;
          s.at = Date.now();
          schedule();
        }
      }
    }

    function render() {
      const s = state;
      const skills = [...s.used.values()].sort((a, b) => a.name.localeCompare(b.name));
      const count = `(${skills.length}${s.failed ? "+" : ""})`;
      const status = s.failed ? "Couldn't load all history. Showing known skills; retrying on the next thread update." :
        !s.at ? "Loading skills…" : !skills.length ? "No skills used yet. Skills appear after Amp loads them." : "Loaded at least once in this thread.";
      // Only the names rebuild the links, so a skill's details arriving later
      // never closes the tooltip someone is reading.
      const signature = JSON.stringify([enabled, skills.map(skill => skill.name), status]);
      if (s.signature !== signature) {
        s.signature = signature;
        const focused = document.activeElement;
        const focusRegion = s.list.contains(focused) ? s.list : s.rail.contains(focused) ? s.rail : null;
        hideTip();
        const label = node("button", `Skills ${count}`);
        label.type = "button";
        invoker(label);
        s.rail.replaceChildren(label, ...skills.map(skill => link(skill)));
        if (!skills.length) s.rail.append(node("span", status));
        write(s.label, `Skills ${count}`);
        write(s.notice, status);
        s.list.replaceChildren(...skills.map(skill => {
          const li = node("li");
          li.append(link(skill, true));
          return li;
        }));
        s.skills.hidden = !enabled;
        s.footer.hidden = !enabled;
        s.rail.hidden = !enabled;
        if (focusRegion) {
          const next = focused.tagName === "BUTTON" ? focusRegion.querySelector("button") :
            [...focusRegion.querySelectorAll("a")].find(anchor => anchor.textContent === focused.textContent);
          next?.focus({ preventScroll: true });
        }
      }
      // Describe the selected skill only while the panel shows it.
      const shown = s.used.get(s.selected) ?? skills[0] ?? null;
      if (!shown) s.detail.replaceChildren();
      else if (isOpen() && s.shown !== shown) describe(shown, s.detail);
      if (!shown || isOpen()) s.shown = shown;
      const context = s.toolbar.querySelector("[data-amp-composer-context]");
      write(s.context, [...context?.children ?? []].map(item => item.textContent).join(" · "));
      if (s.context.hidden !== !s.context.textContent) s.context.hidden = !s.context.textContent;
      const controls = [...s.toolbar.querySelectorAll("[data-amp-composer-control]")].filter(control => control !== s.toggle && !control.hidden);
      if (s.controls?.length !== controls.length || controls.some((control, i) => control !== s.controls[i])) {
        s.controls = controls;
        s.actions.replaceChildren(...controls.map(control => {
          return button("", () => {
            const opening = control.getAttribute("aria-expanded") !== "true";
            close();
            // These remain the original controls and panels, with their native
            // state, polling, and transcript navigation. Do not duplicate them.
            control.click();
            globalThis.ampComposerAnchor(control).focus({ preventScroll: true });
            if (opening) offerBack(control);
            else dropBack();
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
      // Give skills their own row above Amp's whole bottom bar. Beside the
      // Attachments row they would sit in Amp's pointer-events: none control
      // wrapper and crowd its controls.
      let bar = view.toolbar;
      while (bar.parentElement !== view.composer) bar = bar.parentElement;
      if (state.rail.nextElementSibling !== bar) bar.before(state.rail);
      globalThis.ampMountComposerControl(view.toolbar, state.toggle);
      render();
      // Measuring forces a style and layout pass, so only measure when an input
      // changed: a size (needsLayout), the skill names, or the toolbar's controls.
      const s = state;
      const key = JSON.stringify([s.signature, s.toolbar.textContent, s.toolbar.childElementCount,
        s.actions.childElementCount, s.context.textContent]);
      if (s.needsLayout || s.layoutKey !== key) {
        s.needsLayout = false;
        s.layoutKey = key;
        layout();
      }
      if (isOpen()) globalThis.ampPlacePopover(s.panel, anchor());
      // Transcript changes reread the page once they settle, shared with the
      // other features through ampThreadData.
      if (enabled && s.first != null && !document.hidden && !s.loading) {
        const wait = globalThis.ampRefreshDelay(s.first, s.last);
        if (wait <= 0) load();
        else if (!s.poll) s.poll = setTimeout(() => { s.poll = null; schedule(); }, wait);
      }
    }

    function transcriptChanged(target) {
      if (!state || !view.transcript.contains(target)) return;
      state.first ??= Date.now();
      state.last = Date.now();
    }

    // A tab coming back reads changes it missed while hidden right away.
    function resumed() {
      if (!state) return;
      state.first ??= Date.now() - 3000;
      state.last = Math.min(state.last ?? 0, Date.now() - 3000);
    }

    return { refresh, teardown, escape, transcriptChanged, resumed };
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
    if (event.key === "Escape") for (const controller of controllers.values()) controller.escape(event);
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

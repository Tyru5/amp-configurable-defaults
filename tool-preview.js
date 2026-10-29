(() => {
  const rowSelector = ".transcript-entry-row";
  const headerSelector = ".expandable-row-header";
  const previewSelector = "[data-amp-tool-preview]";
  const limit = 5;
  const states = new Map();
  let thread;
  let pending = false;
  let sequence = 0;

  function restore(state) {
    state.preview?.remove();
    state.preview = null;
    for (const row of state.sources || []) row.removeAttribute("data-amp-tool-preview-source");
    state.sources = [];
  }

  function reveal(state) {
    state.expanded = true;
    restore(state);
    state.header.focus({ preventScroll: true });
  }

  function formatCommands(transcript) {
    for (const header of transcript.querySelectorAll(headerSelector)) {
      if (header.closest(previewSelector)) continue;
      // Amp's Bash label is a monospace span containing "$", the command,
      // and an optional workdir. Do not infer shell commands from prose.
      const label = header.querySelector(":scope > span.font-mono");
      if (label?.children[0]?.textContent !== "$" || !label.children[1]) continue;
      let block = header.querySelector(":scope > [data-amp-bash-block]");
      if (!block) {
        block = document.createElement("div");
        block.dataset.ampBashBlock = "";
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.className = "language-bash";
        pre.append(code);
        block.append(pre, document.createElement("small"));
        label.after(block);
        header.setAttribute("data-amp-bash-header", "");
      }
      const code = block.querySelector("code");
      const command = label.children[1].textContent;
      if (code.textContent !== command) code.textContent = command;
      const workdir = label.children[2]?.textContent || "";
      if (block.lastElementChild.textContent !== workdir) block.lastElementChild.textContent = workdir;
    }
  }

  function refresh() {
    pending = false;
    const transcript = document.querySelector("[data-thread-transcript-scroll][data-thread-id]");
    if (thread !== transcript?.dataset.threadId) {
      for (const state of states.values()) restore(state);
      states.clear();
      thread = transcript?.dataset.threadId;
    }
    if (!transcript) return;
    // Keep native labels mounted for Amp's streaming updates and event handlers.
    // The code blocks also travel with the inert five-call preview copies.
    formatCommands(transcript);

    // Amp's status sections are sibling transcript rows, not children of the
    // status header. Only the rows marked as nested by Amp belong to a section.
    for (const status of transcript.querySelectorAll("[data-transcript-status-row-id]")) {
      const row = status.closest(rowSelector);
      const header = status.closest(headerSelector);
      if (!row || !header || status.closest(previewSelector)) continue;
      const key = status.dataset.transcriptStatusRowId;
      let state = states.get(key);
      if (!state) {
        state = { expanded: false, sources: [] };
        states.set(key, state);
      }
      if (state.header !== header) {
        restore(state);
        state.header = header;
        state.row = row;
        // Open only the section, never individual output disclosures. Amp
        // mounts these rows lazily, so wait for its next render before reading.
        if (!header.querySelector(".expandable-row-chevron.rotate-90")) header.click();
        header.addEventListener("click", event => {
          if (!state.preview || event.target.closest("a, button, input, select, textarea")) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          reveal(state);
        }, true);
        header.addEventListener("keydown", event => {
          if (!state.preview || event.target !== header ||
              !["Enter", " "].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          reveal(state);
        }, true);
      }

      const sources = [];
      for (let next = row.nextElementSibling; next; next = next.nextElementSibling) {
        if (next.matches(previewSelector)) continue;
        if (!next.matches(`${rowSelector}.pl-5`) || next.querySelector("[data-transcript-status-row-id]")) break;
        sources.push(next);
      }
      if (state.expanded) continue;

      // A mounted group can contain several read/list calls. Count its leaf
      // headers, not its aggregate label or arbitrary lines of tool output.
      const calls = sources.flatMap(source => [...source.querySelectorAll(headerSelector)]
        .filter(call => !call.parentElement.querySelector(`:scope > ${headerSelector} ~ * ${headerSelector}`)));
      if (calls.length <= limit) {
        restore(state);
        continue;
      }

      if (!state.preview) {
        const preview = document.createElement("div");
        preview.dataset.ampToolPreview = "";
        const summaries = document.createElement("div");
        summaries.dataset.ampToolPreviewCalls = "";
        summaries.inert = true;
        summaries.setAttribute("aria-hidden", "true");
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-expanded", "false");
        button.addEventListener("click", () => reveal(state));
        preview.append(summaries, button);
        state.preview = preview;
      }
      const [summaries, button] = state.preview.children;
      const clones = calls.slice(0, limit).map(call => {
        const clone = call.cloneNode(true);
        clone.toggleAttribute("data-amp-tool-preview-expandable", call.hasAttribute("data-transcript-expandable-row"));
        // Tool labels inherit typography from different native wrappers.
        const style = getComputedStyle(call);
        clone.style.font = style.font;
        clone.style.color = style.color;
        for (const node of [clone, ...clone.querySelectorAll("*")]) {
          node.removeAttribute("id");
          node.removeAttribute("tabindex");
          node.removeAttribute("autofocus");
          // Amp's keyboard navigation must not discover these inert copies.
          for (const name of node.getAttributeNames()) {
            if (name.startsWith("data-transcript-")) node.removeAttribute(name);
          }
        }
        return clone;
      });
      if (summaries.innerHTML !== clones.map(clone => clone.outerHTML).join("")) summaries.replaceChildren(...clones);
      const label = `Show all ${calls.length} tool calls`;
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute("aria-label", `Show all ${calls.length} tool calls: ${status.textContent.trim()}`);
      for (const source of state.sources) {
        if (!sources.includes(source)) source.removeAttribute("data-amp-tool-preview-source");
      }
      state.sources = sources;
      for (const source of sources) {
        if (!source.id) source.id = `amp-tool-preview-source-${++sequence}`;
        source.setAttribute("data-amp-tool-preview-source", "");
      }
      button.setAttribute("aria-controls", sources.map(source => source.id).join(" "));
      if (state.preview.previousElementSibling !== row) row.after(state.preview);
    }
    for (const state of states.values()) {
      if (!state.row.isConnected) restore(state);
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(refresh);
  }

  new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      if (target?.closest(previewSelector)) return false;
      if (record.type === "childList" && [...record.addedNodes, ...record.removedNodes].length &&
          [...record.addedNodes, ...record.removedNodes].every(node => node instanceof Element && node.matches(previewSelector))) return false;
      return true;
    })) schedule();
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["data-thread-id", "data-transcript-status-row-id", "class"] });
  schedule();
})();

const toggles = {
  right: document.querySelector("#right"),
  resizeSidebar: document.querySelector("#resizeSidebar"),
  moveViews: document.querySelector("#moveViews"),
  indentThreads: document.querySelector("#indentThreads"),
  showHeaderToggle: document.querySelector("#showHeaderToggle"),
  subagentPanel: document.querySelector("#subagentPanel"),
  threadMessagesPanel: document.querySelector("#threadMessagesPanel"),
  showComposerContext: document.querySelector("#showComposerContext"),
  infoOrb: document.querySelector("#infoOrb"),
  showComposerSkills: document.querySelector("#showComposerSkills"),
  fadeToolCalls: document.querySelector("#fadeToolCalls"),
  showTimestampDates: document.querySelector("#showTimestampDates"),
};
const status = document.querySelector("#status");
const changed = new Set();
const checked = (key, value) => key === "showTimestampDates" ? value === true : value !== false;

const params = new URLSearchParams(location.search);
// The sidebar settings button shows the popup in a frame on Amp's page. The
// frame sets its size, and Escape here never reaches Amp, so ask it to close.
const inPanel = params.has("panel");
const closePanel = () => parent.postMessage("amp-settings-close", "https://ampcode.com");
if (inPanel) {
  document.documentElement.classList.add("panel");
  addEventListener("keydown", event => {
    if (event.key === "Escape") closePanel();
  });
}
if (params.has("popup")) {
  document.documentElement.classList.add("popup");
  const openOptions = document.querySelector("#open-options");
  openOptions.hidden = false;
  openOptions.addEventListener("click", async () => {
    try {
      await chrome.runtime.openOptionsPage();
      // window.close() does nothing in the sidebar panel's frame.
      if (inPanel) closePanel();
      else window.close();
    } catch {
      status.textContent = "Could not open settings. Please try again.";
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [key, toggle] of Object.entries(toggles)) {
    if (changes[key]) {
      changed.add(key);
      toggle.checked = checked(key, changes[key].newValue);
    }
  }
});

chrome.storage.local.get(Object.keys(toggles)).then(settings => {
  for (const [key, toggle] of Object.entries(toggles)) {
    if (!changed.has(key)) toggle.checked = checked(key, settings[key]);
    toggle.disabled = false;
  }
  status.textContent = "";
}).catch(() => {
  status.textContent = "Could not load settings. Reopen this page to try again.";
});

for (const [key, toggle] of Object.entries(toggles)) {
  toggle.addEventListener("change", async () => {
    const previous = !toggle.checked;
    changed.delete(key);
    toggle.disabled = true;
    try {
      await chrome.storage.local.set({ [key]: toggle.checked });
      status.textContent = "Saved.";
    } catch {
      // A newer change from another settings view wins over a failed save.
      if (!changed.has(key)) toggle.checked = previous;
      status.textContent = "Could not save. Please try again.";
    } finally {
      toggle.disabled = false;
    }
  });
}

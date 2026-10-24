const toggles = {
  right: document.querySelector("#right"),
  resizeSidebar: document.querySelector("#resizeSidebar"),
  moveViews: document.querySelector("#moveViews"),
  indentThreads: document.querySelector("#indentThreads"),
  showHeaderToggle: document.querySelector("#showHeaderToggle"),
  subagentPanel: document.querySelector("#subagentPanel"),
  hideSidebarFooter: document.querySelector("#hideSidebarFooter"),
};
const status = document.querySelector("#status");
const changed = new Set();
const checked = (key, value) => key === "hideSidebarFooter" ? value === true : value !== false;

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
      // A newer change from another Options tab wins over a failed save.
      if (!changed.has(key)) toggle.checked = previous;
      status.textContent = "Could not save. Please try again.";
    } finally {
      toggle.disabled = false;
    }
  });
}

const toggle = document.querySelector("#enabled");
const status = document.querySelector("#status");
let changed = false;

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) {
    changed = true;
    toggle.checked = changes.enabled.newValue !== false;
  }
});

chrome.storage.local.get("enabled").then(({ enabled = true }) => {
  if (!changed) toggle.checked = enabled;
  toggle.disabled = false;
  status.textContent = "";
}).catch(() => {
  status.textContent = "Could not load settings. Reopen this page to try again.";
});

toggle.addEventListener("change", async () => {
  toggle.disabled = true;
  try {
    await chrome.storage.local.set({ enabled: toggle.checked });
    status.textContent = "Saved.";
  } catch {
    toggle.checked = !toggle.checked;
    status.textContent = "Could not save. Please try again.";
  } finally {
    toggle.disabled = false;
  }
});

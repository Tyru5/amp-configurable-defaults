async function updateAction() {
  const { right = true, enabled = true } = await chrome.storage.local.get(["right", "enabled"]);
  await chrome.action.setBadgeText({ text: enabled ? (right ? "R" : "L") : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: "#303936" });
  await chrome.action.setTitle({
    title: enabled
      ? `Amp sidebar: ${right ? "right" : "left"}. Click to move ${right ? "left" : "right"}.`
      : "Amp sidebar: disabled. Open extension Options to enable.",
  });
}

chrome.action.onClicked.addListener(async () => {
  const { right = true, enabled = true } = await chrome.storage.local.get(["right", "enabled"]);
  if (!enabled) return;
  await chrome.storage.local.set({ right: !right });
  await updateAction();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.right || changes.enabled)) {
    updateAction();
  }
});

updateAction();

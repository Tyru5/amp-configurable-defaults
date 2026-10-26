async function updateAction() {
  const { right = true } = await chrome.storage.local.get(["right"]);
  await chrome.action.setBadgeText({ text: right ? "R" : "L" });
  await chrome.action.setBadgeBackgroundColor({ color: "#303936" });
  await chrome.action.setTitle({
    title: `Amp sidebar: ${right ? "right" : "left"}. Click to open settings.`,
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.right) {
    updateAction();
  }
});

updateAction();

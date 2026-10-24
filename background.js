async function updateAction() {
  const { right = true } = await chrome.storage.local.get(["right"]);
  await chrome.action.setBadgeText({ text: right ? "R" : "L" });
  await chrome.action.setBadgeBackgroundColor({ color: "#303936" });
  await chrome.action.setTitle({
    title: `Amp sidebar: ${right ? "right" : "left"}. Click to move ${right ? "left" : "right"}.`,
  });
}

chrome.action.onClicked.addListener(async () => {
  const { right = true } = await chrome.storage.local.get(["right"]);
  await chrome.storage.local.set({ right: !right });
  await updateAction();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.right) {
    updateAction();
  }
});

updateAction();

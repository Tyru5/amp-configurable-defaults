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

// Serialize rule updates so closing a loading pane cannot leave its rule behind.
let splitUpdates = Promise.resolve();
function updateSplitRule(tabID, url) {
  const update = splitUpdates.then(() => chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabID],
    addRules: url ? [{
      id: tabID,
      priority: 1,
      // Amp forbids framing in both headers. Never apply this exception to
      // ordinary navigations, other tabs, or URLs without our unique token.
      action: { type: "modifyHeaders", responseHeaders: [
        { header: "x-frame-options", operation: "remove" },
        { header: "content-security-policy", operation: "remove" },
      ] },
      condition: {
        tabIds: [tabID],
        initiatorDomains: ["ampcode.com"],
        resourceTypes: ["sub_frame"],
        urlFilter: `|${url}|`,
      },
    }] : [],
  }));
  splitUpdates = update.catch(() => {});
  return update;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!["amp-thread-split-open", "amp-thread-split-close"].includes(message?.type)) return;
  if (sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || sender.tab.id <= 0 ||
      !/^https:\/\/ampcode\.com\//.test(sender.url || "")) {
    respond({ error: "Invalid thread split request." });
    return;
  }
  let url = null;
  if (message.type === "amp-thread-split-open") {
    if (typeof message.threadID !== "string" || !/^T-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(message.threadID)) {
      respond({ error: "Invalid thread ID." });
      return;
    }
    url = `https://ampcode.com/threads/${message.threadID}?amp-thread-split=${crypto.randomUUID()}`;
  }
  updateSplitRule(sender.tab.id, url).then(
    () => respond({ ok: true, url }),
    () => respond({ error: "Could not enable the embedded thread. Check the extension's access to ampcode.com and try again." }),
  );
  return true;
});
chrome.tabs.onRemoved.addListener(tabID => { void updateSplitRule(tabID, null).catch(() => {}); });

updateAction();

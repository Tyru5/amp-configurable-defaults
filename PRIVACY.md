# Privacy policy

Effective October 27, 2026. Applies to amp configurable defaults version 1.2.0.

## What the extension does

amp configurable defaults changes the desktop sidebar layout and provides an optional
subagent reading panel and drag-to-split thread panes on `https://ampcode.com`. It is independent of Amp and
is not affiliated with or endorsed by Amp.

## Information stored on your device

The extension uses eleven preferences in `chrome.storage.local`:

- `right`: whether the sidebar should appear on the right.
- `rightWidth`: the selected right-sidebar width, or no custom width.
- `hideSidebarFooter`: whether to hide the desktop footer. Defaults to false.
- `resizeSidebar`: enable resizing and saved width in right-sidebar mode.
- `moveViews`: keep auxiliary views opposite navigation.
- `indentThreads`: indent child threads on either side.
- `showHeaderToggle`: show the sidebar placement switch in the sidebar header.
- `subagentPanel`: offer the subagent reading panel.
- `showComposerContext`: show the thread's model and runner in the composer.
- `infoOrb`: show the floating thread info orb beside the conversation.
- `showMessageTimestamps`: keep message times visible without holding Option/Alt. Defaults to false.

All boolean preferences except `hideSidebarFooter` and `showMessageTimestamps` default to true. Each feature
can be turned off independently in Options. Changing sidebar placement preserves
these choices and the saved width. Options remains reachable from the extension
toolbar menu. Older installs may retain an unused `enabled` preference; it is no
longer read or written.

These preferences remain in your local Chrome profile. The extension does not
use Chrome's sync storage or transmit these preferences to the developer.

## Access to the Amp page

The extension inspects sidebar DOM elements and their dimensions and listens to
sidebar resize gestures to apply the layout. It also reads subagent titles,
statuses, and content already rendered by Amp to provide compact inline summaries.
When a summary is expanded or the subagent panel is open, it expands
native subagent disclosures as needed and displays their rendered task prompts,
results, and errors (plain text in the reading sheet, native content inline).
When **Show model and runner in the composer**, **Show thread info orb**, or
**Always show message timestamps** is on, the extension requests
the open thread's page data from `https://ampcode.com/threads/<id>/__data`, the
same same-origin request Amp's thread page makes, using your existing Amp
session. It reads the thread's mode, model, executor type, runner name or
hostname, working directory, and message IDs and timestamp metadata from the
response. It keeps these values in memory for the current tab and displays them
in the enabled composer label, info card, or message timestamps. New and streaming
message times refresh at most once every five seconds while the tab is visible.
The response is not stored or sent anywhere else. Turning all three settings off
stops these requests.

When **Show thread info orb** is on, the extension reads the thread title,
executor, project, mode, and visibility already shown in Amp's title bar and
displays them in a card beside the conversation, along with the runner name and
working directory from the shared thread data request. It does not store them.

This reading panel keeps a temporary, in-memory view for the current thread,
including the last visible content when Amp unmounts an entry. It is discarded
on thread navigation or page reload. Disabling the panel keeps inline summaries. Task
prompts and output are never written to extension storage, browser storage,
files, or a server. Only the eleven preferences above are persisted.

Apart from message IDs, timestamps, completion state, and the model name recorded
on the latest assistant reply, the extension does not read ordinary conversation
message contents, composer drafts,
account details, passwords, authentication tokens, or browsing history. It
does not alter or submit thread data. Closing the panel collapses disclosures
it expanded, except those the user chose to reveal inline.
The optional footer setting hides the existing footer wrapper with CSS. It
does not read the account row or pinned shortcut contents. Uncheck **Hide sidebar
footer** in extension Options to restore it. Mobile footers are unchanged.

## Embedded-thread security exception

Dragging a sidebar thread to an edge opens the real Amp page in an iframe,
using your existing Amp session. Amp loads and handles the conversation and
composer normally, including any messages you choose to send. The extension
reads the frame's page title and layout, and hides duplicate navigation. It
does not copy or store that conversation or its drafts.

Amp normally blocks framing. The `declarativeNetRequestWithHostAccess`
permission and host access to `https://ampcode.com/*` allow a temporary rule
that removes `X-Frame-Options` and `Content-Security-Policy` response headers
for the exact tokenized thread URL, only as a subframe initiated by Amp in the
current tab. **This also removes CSP's script and resource restrictions inside
that frame.** Ordinary Amp navigations, other URLs, and other tabs retain their
policies. The rule is removed when the split closes, its tab closes, or a new
top-level Amp page loads. Rules are session-only, not persisted to disk.
This feature does not use the browser's built-in Split View.

## Collection and sharing

The extension does not collect or transmit personal information. It contains
no analytics, advertising, tracking, or external collection services. Network
activity includes the optional same-origin thread data request described above
and the embedded Amp page's normal requests.
It does not sell, share, or transfer user data to any third party. All code
implementing the extension is bundled locally. The embedded website loads Amp's
own application code, as it does when opened in an ordinary tab.

Amp and Chrome have their own privacy policies. This extension does not change
how those services handle your data.

## Removing preferences

Each feature can be turned off separately in the extension's Options without
deleting preferences. Sidebar placement does not disable other features.
Disabling the extension stops it from running on newly loaded pages. Refresh
open Amp tabs to remove its existing layout changes. Uninstalling the extension
removes its locally stored preferences from that Chrome profile.

## Contact and changes

For privacy questions, open an issue at
<https://github.com/Tyru5/amp-configurable-defaults/issues>. Do not include private thread
contents, credentials, or other sensitive information in a public issue.

This policy will be updated here if the extension's data practices change.

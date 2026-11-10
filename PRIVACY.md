# Privacy policy

Updated November 9, 2026 for the unreleased amp configurable defaults 1.4.2
source and package. The current public Chrome Web Store release is 1.4.1;
the [1.4.1 source policy](https://github.com/Tyru5/amp-configurable-defaults/blob/f91de7295a4509bf82db9c4032f2e5c64721ccf7/PRIVACY.md)
remains available. This page describes 1.4.2's behavior, not a claim of publication.

## What the extension does

amp configurable defaults changes the desktop sidebar layout and provides optional
subagent and thread message reading panels and drag-to-split thread panes on `https://ampcode.com`. It is independent of Amp and
is not affiliated with or endorsed by Amp.

## Information stored on your device

The extension uses thirteen preferences in `chrome.storage.local`:

- `right`: whether the sidebar should appear on the right.
- `rightWidth`: the selected right-sidebar width, or no custom width.
- `resizeSidebar`: enable resizing and saved width in right-sidebar mode.
- `moveViews`: keep auxiliary views opposite navigation.
- `indentThreads`: indent child threads on either side.
- `showHeaderToggle`: show the sidebar placement switch in the sidebar header.
- `subagentPanel`: offer the subagent reading panel.
- `threadMessagesPanel`: offer the read-only thread message control.
- `showComposerContext`: show the thread's model and runner in the composer.
- `infoOrb`: show the floating thread info orb beside the conversation.
- `showComposerSkills`: show skills successfully loaded in the thread.
- `fadeToolCalls`: show faded previews of longer tool-call sections and Bash commands.
- `expandToolSections`: open tool-call sections automatically when they appear.
- `showTimestampDates`: add the calendar date to the times Amp shows above messages. Defaults to false.

All boolean preferences except `showTimestampDates` default to true. Each feature
can be turned off independently in Options. Changing sidebar placement preserves
these choices and the saved width. Options remains reachable from the extension
toolbar menu. Older installs may retain unused `enabled` and `hideSidebarFooter`
preferences; they are no longer read or written.

These preferences remain in your local Chrome profile. The extension does not
use Chrome's sync storage or transmit these preferences to the developer.

## Access to the Amp page

The extension inspects sidebar DOM elements and their dimensions and listens to
sidebar resize gestures to apply the layout. It also reads subagent titles,
statuses, and content already rendered by Amp to provide compact inline summaries.
When a summary is expanded or the subagent panel is open, it expands
native subagent disclosures as needed and displays their rendered task prompts,
results, and errors. Reading sheets preserve Amp's rendered formatting and
render plain-text task prompts as Markdown; native content remains inline.
When **Show model and runner in the composer** or **Show thread info orb**
is on, the extension requests
the open thread's page data from `https://ampcode.com/threads/<id>/__data`, the
same same-origin request Amp's thread page makes, using your existing Amp
session. It reads the thread's title, mode, model, executor type, runner name or
hostname, and working directory from the
response. It keeps these values in memory for the current tab and displays them
in the enabled composer label or info card.
The response is not stored or sent anywhere else. Turning both settings off
stops their requests. All features share one in-memory copy of each thread's page
data, so a single request serves every enabled feature; it is discarded a minute
after it arrives or on reload.

**Show full dates in message timestamps** makes no request. It reads the
`datetime` of the timestamps Amp already renders above messages and prefixes
their calendar date in place.

In Spaces, each visible coordinator or worker conversation has separate
in-memory data and controls. The same requests apply to each visible
conversation. Parked and hidden conversations are excluded;
switching workers clears the previous worker's cached data and controls.

When **Show thread info orb** is on, the extension reads the thread title,
executor, project, mode, and visibility already shown in Amp's title bar and
displays them in a card beside the conversation, along with the runner name and
working directory from the shared thread data request. It does not store them.

This reading panel keeps a temporary, in-memory view for the current thread,
including the last visible content when Amp unmounts an entry. It is discarded
on thread navigation or page reload. Disabling the panel keeps inline summaries. Task
prompts and output are never written to extension storage, browser storage,
files, or a server. Only the thirteen preferences above are persisted.

When the thread message control is enabled on desktop, it requests the current
thread's same-origin page data using the existing Amp session, including while
closed, to decide whether it should appear. While the browser tab is
visible, checks run on thread load and once transcript changes have been quiet
for three seconds, at most every 30 seconds during a long reply. Opening its
popover also requests fresh data.
It reads incoming thread-message text
and sender thread IDs, outgoing `send_thread_message` arguments, matching tool
results and errors, and attachment counts. Hidden text blocks are excluded.
It displays plain text, delivery status, and links; it never sends messages.
Only the returned message page is read, without fetching older pages. After
the popover is first opened, it reads each other thread's page data once to
show that thread's title; nothing else from it is used or kept. While the popover is open and the tab visible, requests refresh every
five seconds. Closing it stops periodic polling, but transcript changes can
still trigger checks. Disabling its setting or using a viewport below 768px
removes the control and stops its requests.
Its temporary cache is discarded on thread navigation, reload, disabling the
setting, or switching to mobile. Message content never enters persistent storage.

When **Show skills used in the composer** is on, the extension requests the open
desktop thread's same-origin page data and follows its older or newer transcript
pages at `/api/threads/<id>/transcript-page`. It reads top-level `skill` tool calls,
their successful results, and collapsed-turn skill summaries. It displays each
skill name once, with an instruction excerpt and base directory when available.
For a skill known only from a collapsed turn's summary, hovering or selecting it
reads that turn from `/api/threads/<id>/transcript-range`, as Amp does when the turn
is expanded, at most once per skill while the thread is open; nothing else
requests it.
Other tools, failed loads, and nested subagent calls do not count. It never fetches
skill files or runs their instructions. Incomplete history is labeled as partial.
Live transcript changes refresh on the same quiet-period schedule while the tab
is visible; already-read history is reused, and older pages are read when the
browser is idle. Turning the setting off, navigating away,
or switching to mobile clears this in-memory cache and stops its requests.
Clicking a skill opens `https://ampcode.com/settings/skills` in a new tab.
When the composer is crowded, Thread tools groups extension controls into a
popover without changing Amp's composer or submitting its draft.

Apart from the thread communication described above, message IDs, timestamps,
skill calls and results, completion state, and the model name recorded on the latest assistant reply,
the extension does not read ordinary conversation
message contents, composer drafts,
account details, passwords, authentication tokens, or browsing history. It
does not alter or submit thread data. Closing the panel collapses disclosures
it expanded, except those the user chose to reveal inline.

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

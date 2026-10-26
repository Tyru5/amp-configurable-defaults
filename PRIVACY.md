# Privacy policy

Effective October 24, 2026. Applies to amp configurable defaults version 1.2.0.

## What the extension does

amp configurable defaults changes the desktop sidebar layout and provides an optional
subagent reading panel on `https://ampcode.com`. It is independent of Amp and
is not affiliated with or endorsed by Amp.

## Information stored on your device

The extension uses eight preferences in `chrome.storage.local`:

- `right`: whether the sidebar should appear on the right.
- `rightWidth`: the selected right-sidebar width, or no custom width.
- `hideSidebarFooter`: whether to hide the desktop footer. Defaults to false.
- `resizeSidebar`: enable resizing and saved width in right-sidebar mode.
- `moveViews`: keep auxiliary views opposite navigation.
- `indentThreads`: indent child threads on either side.
- `showHeaderToggle`: show the sidebar placement switch in the sidebar header.
- `subagentPanel`: offer the subagent reading panel.

All boolean preferences except `hideSidebarFooter` default to true. Each feature
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
It does not fetch additional thread data or
access Amp's APIs.

This reading panel keeps a temporary, in-memory view for the current thread,
including the last visible content when Amp unmounts an entry. It is discarded
on thread navigation or page reload. Disabling the panel keeps inline summaries. Task
prompts and output are never written to extension storage, browser storage,
files, or a server. Only the eight preferences above are persisted.

The extension does not read ordinary conversation messages, composer drafts,
account details, passwords, authentication tokens, or browsing history. It
does not alter or submit thread data. Closing the panel collapses disclosures
it expanded, except those the user chose to reveal inline.
The optional footer setting hides the existing footer wrapper with CSS. It
does not read the account row or pinned shortcut contents. Uncheck **Hide sidebar
footer** in extension Options to restore it. Mobile footers are unchanged.

## Collection and sharing

The extension does not collect or transmit personal information. It contains
no analytics, advertising, tracking, external services, or network requests.
It does not sell, share, or transfer user data to any third party. All code
runs locally and is bundled with the extension; no remote code is loaded.

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

# Privacy policy

Effective October 23, 2026. Applies to amp better defaults version 1.1.0.

## What the extension does

amp better defaults changes the desktop sidebar layout and provides an optional
subagent reading panel on `https://ampcode.com`. It is independent of Amp and
is not affiliated with or endorsed by Amp.

## Information stored on your device

The extension stores only nine preferences in `chrome.storage.local`:

- `enabled`: whether the extension's layout behavior is enabled.
- `right`: whether the sidebar should appear on the right.
- `rightWidth`: the selected right-sidebar width, or no custom width.
- `hideSidebarFooter`: whether to hide the desktop footer. Defaults to false.
- `resizeSidebar`: enable resizing and saved width in right-sidebar mode.
- `moveViews`: keep auxiliary views opposite navigation.
- `indentThreads`: indent child threads in right-sidebar mode.
- `showHeaderToggle`: show the extension's master switch in the sidebar header.
- `subagentPanel`: offer the subagent reading panel.

All boolean preferences except `hideSidebarFooter` default to true. Each feature
can be turned off independently in Options. The master switch preserves these
choices and the saved width. Header-switch visibility also applies while the
master switch is off; Options remains reachable from the extension toolbar menu.

These preferences remain in your local Chrome profile. The extension does not
use Chrome's sync storage or transmit these preferences to the developer.

## Access to the Amp page

The extension inspects sidebar DOM elements and their dimensions and listens to
sidebar resize gestures to apply the layout. It also reads subagent titles and
statuses already rendered by Amp. When the subagent panel is open, it expands
native subagent disclosures as needed and displays their rendered task prompts,
results, and errors as plain text. It does not fetch additional thread data or
access Amp's APIs.

This reading panel keeps a temporary, in-memory view for the current thread,
including the last visible content when Amp unmounts an entry. It is discarded
on thread navigation, page reload, or disabling the panel or extension behavior. Task
prompts and output are never written to extension storage, browser storage,
files, or a server. Only the nine preferences above are persisted.

The extension does not read ordinary conversation messages, composer drafts,
account details, passwords, authentication tokens, or browsing history. It
does not alter or submit thread data. Closing the panel restores inline
subagent rendering and the native disclosures it expanded.
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

Turning off **Enable extension behavior** in the extension's Options restores
Amp's native layout in open tabs immediately, without deleting preferences.
Disabling the extension stops it from running on newly loaded pages. Refresh
open Amp tabs to remove its existing layout changes. Uninstalling the extension
removes its locally stored preferences from that Chrome profile.

## Contact and changes

For privacy questions, open an issue at
<https://github.com/Tyru5/amp-sidebar-right/issues>. Do not include private thread
contents, credentials, or other sensitive information in a public issue.

This policy will be updated here if the extension's data practices change.

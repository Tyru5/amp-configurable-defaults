# Privacy policy

Effective October 23, 2026. Applies to Amp sidebar right version 1.0.0.

## What the extension does

Amp sidebar right changes the position and width of the desktop sidebar on
`https://ampcode.com`. It is independent of Amp and is not affiliated with or
endorsed by Amp.

## Information stored on your device

The extension stores only two preferences in `chrome.storage.local`:

- `right`: whether the sidebar should appear on the right.
- `rightWidth`: the selected right-sidebar width, or no custom width.

These preferences remain in your local Chrome profile. The extension does not
use Chrome's sync storage or transmit these preferences to the developer.

## Access to the Amp page

The extension inspects sidebar DOM elements and their dimensions and listens to
sidebar resize gestures to apply the layout. It does not read or store thread
contents, messages, drafts, account details, passwords, authentication tokens,
or browsing history. It does not alter or submit thread data.

## Collection and sharing

The extension does not collect or transmit personal information. It contains
no analytics, advertising, tracking, external services, or network requests.
It does not sell, share, or transfer user data to any third party. All code
runs locally and is bundled with the extension; no remote code is loaded.

Amp and Chrome have their own privacy policies. This extension does not change
how those services handle your data.

## Removing preferences

Disabling the extension stops it from running on newly loaded pages. Refresh
open Amp tabs to remove its existing layout changes. Uninstalling the extension
removes its locally stored preferences from that Chrome profile.

## Contact and changes

For privacy questions, open an issue at
<https://github.com/Tyru5/amp-sidebar-right/issues>. Do not include private thread
contents, credentials, or other sensitive information in a public issue.

This policy will be updated here if the extension's data practices change.

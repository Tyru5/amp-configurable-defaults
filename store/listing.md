# Chrome Web Store listing

Submission copy for version 1.0.0. This file is not a claim of store approval.

## Listing fields

- Name: Amp sidebar right
- Summary: Move Amp's desktop navigation sidebar to the right. Click the toolbar icon to switch sides.
- Language: English
- Suggested category: Workflow & Planning
- Homepage: https://github.com/Tyru5/amp-sidebar-right
- Support: https://github.com/Tyru5/amp-sidebar-right/issues
- Privacy policy: https://github.com/Tyru5/amp-sidebar-right/blob/main/PRIVACY.md

## Detailed description

Put Amp's navigation sidebar on the right side of your browser window.

Amp sidebar right changes the desktop layout on ampcode.com. It starts on the
right, and you can click its Chrome toolbar icon to switch back to the left.
Your choice applies across open Amp tabs and is remembered on this device.

Features:
- Switch between left and right sidebar positions with one click.
- Drag the right-sidebar divider to resize it.
- Double-click the divider to restore Amp's original width.
- Keep using Amp's existing sidebar collapse and expand controls.
- Leave mobile layouts below 768px unchanged.

After installing, pin the extension and refresh any open Amp tabs. The toolbar
badge shows R for right or L for left.

Privacy: only your sidebar-side and width preferences are stored locally.
No analytics, tracking, advertising, data collection, or network requests.
Source code is public under the MIT license.

Requires Amp in Chrome or a Chrome-installed PWA. This extension cannot change
the separate native Amp desktop application. It relies on Amp's page layout;
future Amp updates may require an extension update.

Independent project. Not affiliated with or endorsed by Amp.

## Privacy practices fields

Single purpose:
Allow users to position Amp's desktop navigation sidebar on the right or left,
with a locally saved width for the right-side layout.

Storage permission justification:
The storage permission saves the selected side and right-sidebar width in
chrome.storage.local. These two preferences apply to open Amp tabs and survive
browser restarts. No page contents or personal data are stored.

Host access justification:
The content script runs only on https://ampcode.com/* to change the app's
sidebar layout and handle its resize divider. It needs automatic access on
page load to restore the user's layout. It does not run on other sites or
access Amp APIs, messages, credentials, or browsing history.

Remote code:
No, I am not using remote code. All JavaScript and CSS are bundled in the ZIP.

Data usage:
No user data is collected or transmitted. Leave collection-category checkboxes
unchecked if these practices remain unchanged. The publisher must personally
review and certify Google's data-use declarations before submission.

## Images

- Extension icon: `icons/icon-128.png`, transparent 128 × 128 PNG.
- Small promotional tile: `store/promo-small.png`, opaque 440 × 280 PNG.
  This is a symbolic layout illustration, not an app screenshot.
- Required screenshot: capture the extension on a real, signed-in Amp page
  at 1280 × 800 or 640 × 400 image pixels. Use test content and remove any
  personal information before sharing. Do not upload fixture previews from
  `docs/previews/` as screenshots of live Amp.

## Reviewer notes

This extension has no account or payment flow. The target Amp app requires
an Amp account. The Chrome toolbar button toggles the layout; there is no
extension popup or in-page switch. Use Amp's own sidebar toggle to collapse
or reopen it. Drag the divider, or double-click it to reset width.

If the dashboard requests access instructions, provide the normal Amp sign-in
steps. Do not put personal credentials in this public repository. Resolve any
reviewer access requirements through the private developer dashboard.

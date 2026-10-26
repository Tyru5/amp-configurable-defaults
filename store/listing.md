# Chrome Web Store listing

Submission copy for version 1.2.0. This file is not a claim of store approval.

## Listing fields

- Name: amp configurable defaults
- Summary: Move Amp's desktop navigation sidebar to the right. Click the toolbar icon to customize your settings.
- Language: English
- Suggested category: Workflow & Planning
- Homepage: https://github.com/Tyru5/amp-configurable-defaults
- Support: https://github.com/Tyru5/amp-configurable-defaults/issues
- Privacy policy: https://github.com/Tyru5/amp-configurable-defaults/blob/main/PRIVACY.md

## Detailed description

Put Amp's navigation sidebar on the right side of your browser window.

amp configurable defaults changes the desktop layout on ampcode.com. It starts on the
right. Click its Chrome toolbar icon to open settings and choose either side.
Your choice applies across open Amp tabs and is remembered on this device.

Features:

- Switch between left and right sidebar positions with one click.
- Drag the right-sidebar divider to resize it.
- Double-click the divider to restore Amp's original width.
- Keep using Amp's existing sidebar collapse and expand controls.
- Indent child threads using Amp's existing hierarchy on either side.
- Keep Files, Changes, Terminal, Desktop, and Portal opposite navigation.
- Change sidebar placement without disabling other features.
- Optionally hide the whole desktop sidebar footer from Options, visible by default.
- Read subagent tasks and results in optional Task and Output reading sheets.
- Keep expandable inline subagent summaries, even with the panel disabled.
- Identify active subagents by pulsing dots, with reduced-motion support.
- Distinguish tool calls from prose with tinted disclosure rows.
- Keep mobile navigation native; inline summaries and tool styling remain available.

Every feature has its own Options checkbox: right-side placement, right-side
resizing, auxiliary-view placement, child-thread indentation, header-switch
visibility, subagent panel, and footer hiding. All default on except footer
hiding. Turning off resizing restores native width without erasing the saved
width. Collapse/expand stays native. Placement changes preserve every preference.

After installing, pin the extension and refresh any open Amp tabs. The toolbar
badge shows R for right or L for left.

Privacy: only your feature choices, sidebar side, and width are stored locally.
No analytics, tracking, advertising, data collection, or network requests.
Source code is public under the MIT license.

Requires Amp in Chrome or a Chrome-installed PWA. This extension cannot change
the separate native Amp desktop application. It relies on Amp's page layout;
future Amp updates may require an extension update.

Independent project. Not affiliated with or endorsed by Amp.

## Privacy practices fields

Single purpose:
Customize Amp's desktop reading layout: position navigation on either side,
resize the right sidebar, optionally hide its footer, and read subagent activity opposite it.

Storage permission justification:
The storage permission saves eight preferences in chrome.storage.local:
right, rightWidth, hideSidebarFooter, resizeSidebar, moveViews, indentThreads,
showHeaderToggle, and subagentPanel. They apply to open Amp tabs and survive
browser restarts. No page contents or personal data are persisted.

Host access justification:
The content script runs only on https://ampcode.com/* to change the app's
sidebar layout, handle its resize divider, and display rendered subagent
activity in an optional reading panel. It needs automatic access on page load
to restore the user's layout. Subagent prompts and results remain in memory
for the current thread; they are not saved or transmitted. It does not run on
other sites or access Amp APIs, ordinary messages, credentials, or browsing history.

Remote code:
No, I am not using remote code. All JavaScript and CSS are bundled in the ZIP.

Data usage:
No user data is collected or transmitted. Leave collection-category checkboxes
unchecked if these practices remain unchanged. The publisher must personally
review and certify Google's data-use declarations before submission.

## Images

- Extension icon: `icons/icon-128.png`, transparent 128 × 128 PNG.
- Small promotional tile: `store/promo-small.png`, opaque 440 × 280 PNG.
  Both use original window/sidebar/arrow artwork, without an Amp logo or
  wordmark. The promotional tile is artwork, not an app screenshot.
- Live screenshots: `store/screenshots/`, 1280 × 800 PNGs from signed-in Helium.
  Conversation content, task/output content, thread titles, and account details
  are hidden for privacy. See `screenshots/README.md` for the suggested five.
- `fixture-*.png` and `docs/previews/` are labeled compatibility demonstrations,
  not real Amp screenshots. Do not use them as live app store screenshots.

## Reviewer notes

This extension has no account or payment flow. The target Amp app requires
an Amp account. The Chrome toolbar button opens a settings popup with every
feature checkbox and an **Open settings in a tab** button. The
arrow icon in Amp's sidebar header also switches placement without disabling
other features. Use Amp's own sidebar toggle to collapse or reopen navigation. Drag
the divider, or double-click it to reset width. On a thread with subagent
activity, click Subagents in the conversation header to open its reading
panel. Hover or focus Task/Output to preview, click to pin, or choose View original
to reveal native content. Inline summaries remain available with the panel closed.
Right-click the extension toolbar icon and choose Options for **Hide sidebar
footer**. It hides bottom navigation, pinned shortcuts, and the account row on
desktop, independently of sidebar side. Uncheck it in Options to restore them.
Mobile footers are unchanged. No account or shortcut contents are read by this setting.
Options also controls each other feature independently. To test recovery, turn
off the header-switch setting while hiding the footer, then use the extension's
right-click Options menu to restore either. Feature choices remain editable
with right placement off. Left-side resizing stays native; indentation is independent.

If the dashboard requests access instructions, provide the normal Amp sign-in
steps. Do not put personal credentials in this public repository. Resolve any
reviewer access requirements through the private developer dashboard.

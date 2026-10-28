# Chrome Web Store listing

Submission copy for version 1.3.0. This file is not a claim of store approval.

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
- Drag a sidebar thread to either edge to open a live second conversation in the same page.
- Change sidebar placement without disabling other features.
- Optionally hide the whole desktop sidebar footer from Options, visible by default.
- Read subagent tasks and results in optional Task and Output reading sheets.
- Keep expandable inline subagent summaries, even with the panel disabled.
- Identify active subagents by pulsing dots, with reduced-motion support.
- Distinguish tool calls from prose with tinted disclosure rows.
- See the thread's model and runner (or Orb) next to the composer's upload button.
- Hover, focus, or pin a floating orb for the thread's title-bar details.
- Keep mobile navigation native; inline summaries and tool styling remain available.

Options has independent checkboxes for right-side placement, right-side
resizing, auxiliary-view placement, child-thread indentation, header-switch
visibility, subagent panel, composer model and runner, thread info orb, and
footer hiding. All default on except footer hiding. Turning off resizing restores native width without erasing the saved
width. Collapse/expand stays native. Placement changes preserve every preference.

After installing, pin the extension and refresh any open Amp tabs. The toolbar
badge shows R for right or L for left.

Privacy: only your feature choices, sidebar side, and width are stored locally.
No analytics, tracking, advertising, or data collection. The optional composer
label fetches the open thread's data from ampcode.com with your existing session,
keeps it in memory, and sends it nowhere else.
Source code is public under the MIT license.

Requires Amp in Chrome or a Chrome-installed PWA. This extension cannot change
the separate native Amp desktop application. It relies on Amp's page layout;
future Amp updates may require an extension update.

Independent project. Not affiliated with or endorsed by Amp.

## Privacy practices fields

Single purpose:
Customize Amp's desktop reading layout: position navigation on either side,
resize the right sidebar, optionally hide its footer, read subagent activity
opposite it, and show the open thread's model, runner, and title-bar details.

Storage permission justification:
The storage permission saves ten preferences in chrome.storage.local:
right, rightWidth, hideSidebarFooter, resizeSidebar, moveViews, indentThreads,
showHeaderToggle, subagentPanel, showComposerContext, and infoOrb. They apply to open Amp tabs and survive
browser restarts. No page contents or personal data are persisted.

Host access justification:
The content script runs only on https://ampcode.com/* to change the app's
sidebar layout, handle its resize divider, and display rendered subagent
activity in an optional reading panel. It needs automatic access on page load
to restore the user's layout. Subagent prompts and results remain in memory
for the current thread; they are not saved or transmitted. When the composer
label is on, it requests the open thread's page data from
https://ampcode.com/threads/<id>/__data, the same same-origin request Amp's
page makes, and keeps only the mode, model, executor, runner, and working
directory in memory. The info orb reads details already in Amp's title bar.
It does not run on other sites or read credentials or browsing history.

Declarative net request permission justification:
To embed a live Amp thread in the same page, a session-only rule removes
X-Frame-Options and Content-Security-Policy for one exact tokenized thread URL,
restricted to subframes initiated by ampcode.com in the requesting tab. This
also relaxes script/resource protections in that embedded document. Closing
the split or tab, or loading a new top-level Amp page, removes the rule.
No policies are changed for ordinary navigations or other URLs/tabs.

Remote code:
The extension's JavaScript and CSS are bundled in the ZIP. The embedded Amp
website loads its own application code. Review this iframe behavior and the
security exception against current store policy before certifying this field.

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
  They predate the composer label and info orb; the redacted live capture in
  `docs/assets/hero-live.webp` shows both but is not sized for the store.
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

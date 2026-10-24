# amp better defaults

A dependency-free Chrome Manifest V3 extension for `https://ampcode.com`.
The desktop sidebar starts on the right. Click the extension's toolbar button
to switch between right and left. The R/L badge shows the saved side. The
choice applies to all open Amp tabs and survives browser restarts.

Independent project, not affiliated with or endorsed by Amp. The code is MIT licensed.
The Chrome Web Store release is in preparation, not published or approved.

The [landing page](docs/index.html) explains the features and local installation.
Serve the repository with a static server and open `/docs/` to preview it.
The page has no build step, external fonts, or third-party scripts.
See [GitHub Pages deployment](#github-pages-deployment) to publish the existing
site directly from `docs/`. Hosting is not enabled by these files alone.

## Install locally

1. [Download the source ZIP](https://github.com/Tyru5/amp-sidebar-right/archive/refs/heads/main.zip),
   clone this repository, or build a packaged ZIP below.
   **Extract the ZIP** to a permanent folder. Do not select the ZIP in Chrome.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the extracted folder that directly
   contains `manifest.json`. You can also load this cloned repository folder.
5. Pin **amp better defaults** from Chrome's Extensions menu.
6. Refresh any Amp tabs that were already open.

Click the pinned icon to switch sides. Drag the divider to resize the right
sidebar, or double-click it to restore Amp's width. Left mode restores Amp's
native layout and resize behavior. Right-mode width is saved separately.
In right mode, auxiliary views such as Files, Changes, Terminal, Desktop, and
Portal open to the left of the conversation. Their dividers still resize in
the direction you drag. Left mode restores their native placement on the right.
Child thread rows are indented by 20px per level on either side, up to 64px,
using Amp's existing parent-child hierarchy without reordering threads.
The **right-sidebar arrow icon** in Amp's sidebar header switches placement,
just like the toolbar icon and **Move sidebar to the right** in **Options**.
These controls stay synchronized across open Amp tabs and preserve other feature
choices and your saved right-side width. There is no master feature switch.
The obsolete `enabled` preference from older versions is ignored.

Hovering or keyboard-focusing a thread in the right sidebar opens Amp's native
thread information card to its left. Amp still owns the content and dismissal.

Every extension feature has its own checkbox in **Options**:

| Setting | Default | When off |
| --- | --- | --- |
| Move sidebar to the right | On | Native left sidebar; also controlled by the toolbar icon |
| Resize and remember right-sidebar width | On | Native width, no right resize handle; saved width retained |
| Keep auxiliary views opposite the sidebar | On | Native view placement and divider input |
| Indent child threads | On | Native row spacing on either side |
| Show placement switch in sidebar header | On | No injected placement switch; use Options or the toolbar icon |
| Enable subagent reading panel | On | Native inline activity; removes any open panel |
| Hide sidebar footer | Off | Native footer visible |

Feature choices remain editable and active with either sidebar placement.
Custom resizing applies only in right mode; left-side resizing stays native.
Amp's existing collapse/expand controls remain available
and follow sidebar placement. The subagent panel works on either side, independently
of auxiliary-view placement, and starts closed after being re-enabled.

In **Options**, check **Hide sidebar footer** to hide the whole desktop bottom
section: Puck, Activity, Projects, the app grid, pinned shortcuts, and the
account row. The footer is visible by default in both left and right modes.
Thread lists and header controls stay available. Uncheck the option to restore
the footer. Options is always reachable by right-clicking the browser's extension
toolbar icon, even while the footer is hidden. Changing sidebar placement does
not change footer visibility. The choice applies across open Amp tabs and
survives browser restarts. Mobile below 768px keeps its native footer.
Subagent activity always has a compact inline summary. Click it to expand the
original Amp content, including when the optional panel is disabled or on mobile.
Running and delegated agents have a gently pulsing status dot; completed,
failed, and cancelled agents do not. Reduced motion keeps the active dot static.
Tool-call summaries and individual tool headers use tinted rows with a left
border to distinguish execution activity from assistant prose.
On desktop, the **Subagents** header button opens an agent list opposite
navigation. Hover or focus **Task** or **Output** to preview a wider reading
sheet; click to keep it open. Escape closes the sheet first, then the panel.
**View original** reveals the selected activity inline. Files and Changes remain
open alongside the list. Narrow desktop layouts use an overlay rather than
squeeze the conversation.

The panel reads only subagent content already rendered by Amp, and keeps its
view in memory for the current thread. It does not save or transmit prompts
or results. Unloaded history is not fetched; unavailable content is identified
as such. Background tasks remain labeled **Delegated** until Amp exposes a
completion. Results with duplicate task descriptions appear separately rather
than risk attaching them to the wrong agent.

Below 768px, navigation stays native and subagents use inline summaries only.
Disable or remove the extension, then refresh open Amp tabs to restore the
original page layout.

## GitHub Pages deployment

Publish the existing `docs/` site without a build step or custom workflow.
`docs/.nojekyll` disables Jekyll processing. Styles, scripts, images, and fonts
use relative paths, so they work under the repository's URL prefix.

After the landing-page branch and Pages preparation are merged and pushed to
`main`:

1. Open the repository's **Settings → Pages**.
2. Choose **Deploy from a branch**, then **main** and **/docs**. Click **Save**.
3. Wait for the Pages deployment in **Actions** to succeed.
4. Check <https://tyru5.github.io/amp-sidebar-right/>, including the layout
   switch, installation link, FAQ, and images.

Later pushes to `main` publish updates automatically. No PR previews are
configured. GitHub publishes `docs/`, not the extension source or `tests/`.

Preview and verify the publishing directory locally:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory docs
# In another terminal:
node tests/landing.mjs http://localhost:8766/
```

## Development preview

These are local compatibility fixtures based on Amp's published markup,
not screenshots of a signed-in Amp session and not Web Store listing images.

| Right sidebar | Left sidebar |
| --- | --- |
| ![Right sidebar in local fixture](docs/previews/right.png) | ![Left sidebar in local fixture](docs/previews/left.png) |

See the [feature screenshot catalog](store/screenshots/README.md) for
privacy-redacted live Helium captures and separately labeled fixture coverage.

## Scope and privacy

Only permission: `storage`, for feature choices, sidebar side,
and right-sidebar width on this device. The eight active keys are listed in the privacy policy.
The content script runs only on `https://ampcode.com/*`. No network requests,
analytics, dependencies, or changes to thread data. This is an independent
extension, not an official Amp extension.

See the full [privacy policy](PRIVACY.md).

Chrome extensions work on Amp in Chrome and Chrome-installed PWAs. They
cannot modify the separate native Amp desktop app shown in the reference image.
Use Amp in Chrome for this extension.

## Build and test

No npm dependencies or bundler are required. Use Node.js 22+ and Python 3.12+.

### Amp orbs

`.agents/setup` prepares Node.js 22+, Python 3.12+, and agent-browser with
Chrome for the browser fixture checks. It reuses installed tools and cached
Chrome downloads on repeated runs. No secrets or backing services are needed.
`.agents/resume` has no work to do because the extension needs no authentication
or service reconnection. Amp snapshots the installed tools for future orbs once
these scripts are on the project's default branch.

Run the checks below after setup. For browser checks in an orb, start the fixture
server as a supervised service rather than a foreground process:

```sh
amp orb service start fixture --command 'python3 -m http.server 8765 --bind 0.0.0.0' --port 8765 --portal
node tests/browser.mjs
amp orb service stop fixture
```

### Checks

```sh
node --check background.js
node --check content.js
node --check subagents.js
node --check options.js
node --test tests/background.test.mjs
node --test tests/options.test.mjs
python3 -m unittest discover -s tests -p '*_test.py'
python3 scripts/package.py
```

The build writes `dist/amp-better-defaults-1.2.0.zip` and a SHA-256 checksum.
The manifest is at the ZIP root as required by the Web Store. Only runtime
files, icons, and the license are included, never tests or developer previews.
GitHub Actions runs syntax, toolbar behavior, and packaging checks on pushes
and pull requests, then uploads the build artifact. CI does not test live Amp.

To run browser fixture checks, install `agent-browser` and its Chrome runtime,
then start a static server from this repository:

```sh
python3 -m http.server 8765
```

In another terminal in this repository:

```sh
node tests/browser.mjs
node tests/landing.mjs
```

The fixture's on-page toggle calls the actual service worker handler through
a mock Chrome API. It is not a control added to the live Amp page.
The landing-page checks cover its illustrative layout switch, keyboard access,
FAQ, installation link, asset loading, and responsive overflow. Its demo does
not change the extension's settings or access an Amp account.

## Compatibility and verification

Selectors were checked against Amp's publicly served app assets on 2026-10-23.
Amp's layout is not a public API, so a future site update may require adjusting
`sidebar.css` or the divider selector in `content.js`.

The footer selector was inspected in signed-in Helium on 2026-10-24:
`[data-slot="sidebar-container"] [data-slot="sidebar-footer"]` contains all
three footer rows. Hiding it uses desktop-only CSS without moving app nodes.

Automated browser verification uses a local fixture based on the current app
markup. It covers switching sides, storage changes, resizing, collapse/reopen,
dynamic shell replacement, footer visibility and cross-tab preferences, the
mobile breakpoint, independent feature opt-outs, and subagent selection,
streaming text, completion, duplicate descriptions, and inline restoration.
Hover checks reproduce Amp's native overflow-close guard and cover mouse and
keyboard previews, interactive content, changing card size, and side changes.
This hover fix was also verified in signed-in Helium on 2026-10-24. It uses
Amp's `data-sidebar-touch-preview` marker to bypass that guard for mouse and keyboard
previews, then repositions the native card. Touch input and mobile remain native.

The earlier extension build was also tested in a signed-in Helium session on
2026-10-24, including two real background subagents, their completed outputs,
both panel sides, Files coexistence, the narrow drawer, and the master switch.
Helium reported no extension manifest or runtime errors. Changes coexistence
is covered by the fixture suite; the live check does not cover every Amp view
or unloaded thread history. Recheck compatibility after Amp layout updates.

The 1.2.0 runtime was verified in signed-in Helium on 2026-10-24: independent
Options with left placement, centered settings, inline subagent expansion with
the panel disabled, both reading-sheet positions, narrow layouts, native thread
hover cards, and tool disclosures. Active-agent pulse transitions and reduced
motion were verified with fixtures, not a currently running live subagent.
The mobile fixture tests CSS breakpoints; it does not model Amp's native mobile
sidebar sheet.

## Chrome Web Store release

- [Submission checklist and remaining gates](store/RELEASE.md)
- [Listing copy, privacy declarations, and reviewer instructions](store/listing.md)
- [Privacy policy](PRIVACY.md)
- [440 × 280 promotional tile](store/promo-small.png)
- [Feature screenshots and suggested upload order](store/screenshots/README.md)

Live, privacy-redacted 1280 × 800 captures are included. Finish the publisher
account requirements and privacy certifications in the Web Store dashboard.
Do not substitute the supplemental fixture images for real app screenshots.

The original icon uses forest green, warm cream, and muted olive colors from
Amp's public app icon, without its logo or wordmark. `store/icon-master.png`
is the raster master for the four runtime icons and promotional tile.
The Amp name identifies the compatible service and remains its owner's property.

# Amp sidebar right

A dependency-free Chrome Manifest V3 extension for `https://ampcode.com`.
The desktop sidebar starts on the right. Click the extension's toolbar button
to switch between right and left. The R/L badge shows the saved side. The
choice applies to all open Amp tabs and survives browser restarts.

Independent project, not affiliated with or endorsed by Amp. MIT licensed.
The Chrome Web Store release is in preparation, not published or approved.

## Install locally

1. Download the versioned ZIP from a repository release, or build it below.
   **Extract the ZIP** to a permanent folder. Do not select the ZIP in Chrome.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the extracted folder that directly
   contains `manifest.json`. You can also load this cloned repository folder.
5. Pin **Amp sidebar right** from Chrome's Extensions menu.
6. Refresh any Amp tabs that were already open.

Click the pinned icon to switch sides. Drag the divider to resize the right
sidebar, or double-click it to restore Amp's width. Left mode restores Amp's
native layout and resize behavior. Right-mode width is saved separately.
Below 768px, Amp's mobile layout is unchanged.
Disable or remove the extension, then refresh open Amp tabs to restore the
original page layout.

## Development preview

These are local compatibility fixtures based on Amp's published markup,
not screenshots of a signed-in Amp session and not Web Store listing images.

| Right sidebar | Left sidebar |
| --- | --- |
| ![Right sidebar in local fixture](docs/previews/right.png) | ![Left sidebar in local fixture](docs/previews/left.png) |

## Scope and privacy

Only permission: `storage`, for the side and right-sidebar width on this device.
The content script runs only on `https://ampcode.com/*`. No network requests,
analytics, dependencies, or changes to thread data. This is an independent
extension, not an official Amp extension.

See the full [privacy policy](PRIVACY.md).

Chrome extensions work on Amp in Chrome and Chrome-installed PWAs. They
cannot modify the separate native Amp desktop app shown in the reference image.
Use Amp in Chrome for this extension.

## Build and test

No npm dependencies or bundler are required. Use Node.js 22+ and Python 3.12+.

```sh
node --check background.js
node --check content.js
node --test tests/background.test.mjs
python3 -m unittest discover -s tests -p '*_test.py'
python3 scripts/package.py
```

The build writes `dist/amp-sidebar-right-1.0.0.zip` and a SHA-256 checksum.
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
```

The fixture's on-page toggle calls the actual service worker handler through
a mock Chrome API. It is not a control added to the live Amp page.

## Compatibility and verification

Selectors were checked against Amp's publicly served app assets on 2026-10-23.
Amp's layout is not a public API, so a future site update may require adjusting
`sidebar.css` or the divider selector in `content.js`.

Browser verification uses a local fixture based on the current app markup, not
a signed-in Amp session. It covers switching sides, storage changes, resizing,
collapse/reopen, dynamic shell replacement, and the mobile breakpoint. A live,
signed-in Amp compatibility check is still required after installation.

Chrome also accepted the unpacked extension with no manifest or runtime errors,
and the content script activated on the real ampcode.com sign-in page. This
checks extension loading and host matching, not the signed-in app layout.

## Chrome Web Store release

- [Submission checklist and remaining gates](store/RELEASE.md)
- [Listing copy, privacy declarations, and reviewer instructions](store/listing.md)
- [Privacy policy](PRIVACY.md)
- [440 × 280 promotional tile](store/promo-small.png)

Before submission, verify the extension in a signed-in Amp session and capture
at least one real 1280 × 800 or 640 × 400 listing screenshot. Finish the publisher
account requirements and privacy certifications in the Web Store dashboard.
Do not substitute the development fixture previews for a real app screenshot.

# Version 1.4.2 submission checklist

## Release status

Public listing checked November 7, 2026:

- **Public release: 1.4.1**, updated November 6 on the
  [Chrome Web Store](https://chromewebstore.google.com/detail/amp-configurable-defaults/hpobhiphbifcjhplkegebmpiehkcpjod).
  This checks the listing's version/date, not the downloaded package bytes.
- **Next package: 1.4.2**, from `main`. It is not available from the public
  store listing. The private dashboard's submission/review state has not been checked.
- Use the Web Store listing for publication status, not the source version
  or an unpublished GitHub draft.

Building or testing the package does not upload, submit, or publish it.

## Spaces compatibility fixes in 1.4.2

- Associate each visible coordinator and worker with its own composer labels,
  info card, Messages control, Task/Subagents panel, and tool previews.
- Read coordinator timestamps from `spaceChat.createdAt`; preserve worker
  sent/started/finished timestamps and the existing thread-message filter.
- Mount controls in each worker's native tab strip. Clear stale controls/data
  when switching or hiding workers, and ignore delayed info-card callbacks
  after teardown.
- Keep the right navigation rail's border inward and its collapsed toggle
  beside the rail, with space reserved in legacy headers. Preserve the
  existing auxiliary reversal and divider handling.
- Add Spaces ownership, timestamp, teardown, and four-state nested-layout
  regression coverage. No permissions or defaults changed.

## Thread messages change in 1.4.2

- The thread message list stacks newest on top, oldest at the bottom, and new
  messages arrive above cached ones. With nothing chosen yet, the popover opens
  the newest message. Undated entries fall back to reverse transcript order.
- Added fixture checks for the newest-first order and for a later message
  landing on top. No permissions, defaults, or requests changed.

## Already released in 1.4.0 and 1.4.1

- Added a thread message control in the composer toolbar that lists incoming and outgoing thread
  messages by the other thread's title, with delivery status, relative times,
  attachment counts, and links.
  Its popover's list and message views resize to their content. The control stays
  hidden until messages exist. While the browser tab is visible, it checks the
  current thread on load and transcript changes, at most once every five
  seconds, even with the popover closed. While open, it also polls every five
  seconds. Options can disable it.
- Rendered subagent Task and Output sheets as formatted content (headings,
  lists, code, links, tables) instead of raw text.
- Added expandable first-five-row tool-call previews with Bash code blocks.
- Added optional persistent message dates and times.
- Added smooth scrolling and a temporary highlight when either reading panel
  reveals the original transcript entry, with reduced-motion support.
- Removed the **Hide sidebar footer** option. Amp's new sidebar layout moves
  navigation and the account menu to an icon rail and hides the footer itself.
- Added the marquee promotional tile and refreshed store artwork notes.

## Already released in 1.3.0

- Sidebar placement, remembered right-side width, auxiliary views opposite
  navigation, child-thread indentation, and native thread hover cards.
- Independent feature switches, subagent lists and Task/Output reading sheets,
  inline summaries, active-agent dots, tinted tool rows, and optional footer hiding.
- Renamed the extension to amp configurable defaults and added a compact toolbar
  settings popup alongside the full Options page.
- Added composer labels for the thread's model, runner or Orb, and explicit effort.
- Added a floating, pinnable thread info orb with runner and working-directory details.
- Added in-page thread split panes with drag-and-drop, keyboard shortcuts, and
  resizable dividers. Embedding uses a scoped, session-only framing/CSP exception.
- Fixed the manifest description length and added packaging validation for its
  132-character limit. This fix is already in the released baseline.

Supporting website work already present when 1.3.0 shipped:

- Added the landing page, theme choices, and privacy-redacted live screenshots.

## Prepared in this repository

- Manifest V3, storage and declarative net request permissions; host access limited to `https://ampcode.com/*`.
- Toolbar and extension icons at 16, 32, 48, and 128 pixels.
- 440 × 280 small and 1400 × 560 marquee promotional tiles, both opaque 24-bit PNGs.
- Public privacy policy, support URL, listing copy, and permission explanations.
- Reproducible upload ZIP with `manifest.json` at its root and SHA-256 checksum.
- Syntax, toolbar behavior, packaging, and local browser fixture checks.
- Signed-in Helium checks of independent Options, inline summaries, reading
  sheets on both sides, narrow layouts, thread hover cards, and tool disclosures.
- Fixture checks of active-agent pulses, terminal states, and reduced motion.
- Privacy-redacted live 1280 × 800 screenshots. See `screenshots/README.md`
  for historical coverage and supplemental images that are fixtures.

## Package verification on November 4, 2026

- Built `dist/amp-configurable-defaults-1.4.0.zip`, 50,266 bytes, from the
  runtime at [c8a5609](https://github.com/Tyru5/amp-configurable-defaults/commit/c8a5609ad9a79646c3c22d12ce3e4fd063d2d05c).
  This preparation changes documentation and test synchronization only, not
  packaged runtime files.
- SHA-256: `0a743734bea25a468e730b921935e23cd157285334e41e515f733dcb77ec8ec1`.
  The companion `.zip.sha256` file contains the same digest.
- ZIP integrity, root manifest version, and all 17 packaged files match source.
  The packaging tests confirm byte-for-byte reproducible builds.
- JavaScript syntax, 13 Node tests, and 2 Python packaging tests passed.
- Landing-page, main browser, and thread-message fixture suites passed.
  Desktop and mobile release labels, installation copy, and the expanded
  privacy FAQ were rendered and inspected.
- The split-pane suite passed five consecutive runs after adding condition-based
  waits for fixture readiness and the divider's horizontal orientation after
  resizing. Its layout, frame identity, draft preservation, and other assertions
  are unchanged. No fixed delays or runtime changes were needed.
- These checks use local fixtures, not signed-in Amp. The live release checks
  below remain open. No store upload or submission was performed in this preparation.

## Version 1.4.2 package verification

- The ZIP built from the current source, including the newest-first thread
  message list, is 52,699 bytes, with SHA-256
  `0ad885fd0b4f5a68d7e7e0bae1cab3c1873e727d7455f9a6ebea6e4fce69dd26`.
- Local checks cover 49 Spaces, 39 layout, 177 legacy browser, 37 Messages,
  11 split-pane, and 35 landing-page assertions, plus 13 Node tests and
  2 Python package tests. Syntax, whitespace, and reproducible packaging pass.
- Earlier authenticated Helium verification used a compatibility-only 1.4.1
  candidate. Earlier native Windows verification used the exact sidebar CSS
  with the installed runtime. Neither alone certifies this complete package
  on authenticated Amp. Keep the final live smoke-test gate below open until
  the exact 1.4.2 package is tested there.
- Repository delivery does not complete the Web Store submission gates.
  No Web Store upload, submission, privacy certification, or publication is
  performed by building or pushing the source.

## Before uploading

- [x] Fix the split-pane test's readiness waits and rerun the full release checks.
- [ ] Review the embedded-thread framing/CSP exception and iframe remote-code
      disclosures against current Web Store policy before submission.
- [ ] Smoke-test the final 1.4.2 ZIP on real, signed-in Amp. Earlier live checks
      in README.md do not replace testing this packaged release.
- [x] Capture real Amp screenshots at 1280 × 800, inspect redactions, and keep
      fixture previews separately identified. No private content is published.
- [ ] Refresh the historical screenshots for 1.4.2, including Messages and
      formatted reading sheets. Do not advertise the removed master switch.
- [ ] Repeat the final smoke test in current Google Chrome. Helium and fixture
      checks do not prove every Chrome/Amp layout combination. In particular,
      live Changes and Portal remain unchecked; Changes was disabled by Amp in
      the available release threads. Both are covered by fixture checks.
- [ ] Confirm permission to use the Amp-derived mark before submitting
      the extension icon and promo tile to the Web Store.
- [ ] Confirm access to the existing store item and resolve any account warnings.
- [ ] Review the existing privacy declarations against 1.4.2's message and
      timestamp access, and personally accept any required certifications.

## Build and upload

```sh
node --check background.js
node --check content.js
node --check thread-split.js
node --check subagents.js
node --check thread-messages.js
node --check composer.js
node --check info-orb.js
node --check tool-preview.js
node --check options.js
node --test tests/background.test.mjs
node --test tests/options.test.mjs
node tests/browser.mjs # with the fixture server running on port 8765
node tests/thread-messages.mjs # with the fixture server running on port 8765
node tests/spaces.mjs # with the same fixture server running
node tests/spaces-layout.mjs # with the same fixture server running
node tests/landing.mjs # with the same fixture server running
# For split-pane coverage, first open an owned agent-browser session:
# node tests/thread-split.mjs <session> http://localhost:8765/tests/fixture.html
python3 -m unittest discover -s tests -p '*_test.py'
python3 scripts/package.py
```

1. Open https://chrome.google.com/webstore/devconsole.
2. Select the existing **amp configurable defaults** item,
   `hpobhiphbifcjhplkegebmpiehkcpjod`, and upload
   `dist/amp-configurable-defaults-1.4.2.zip` as an update. Do not create a second
   listing. Unlike Chrome's **Load unpacked**, the store accepts the ZIP itself.
3. Copy the fields from `store/listing.md`. Upload the icon, `store/promo-small.png`
   and `store/promo-marquee.png` in their matching promotional tile fields, and
   refreshed real screenshots following `store/screenshots/README.md`. Never upload
   the `fixture-*.png` images as live app screenshots. Check the listing preview.
4. Review privacy practices and link the public privacy policy. Verify all URLs.
5. Preserve the existing countries and visibility unless intentionally changing
   them. Resolve any dashboard warnings.
6. Submit for review only after the live compatibility and screenshot checks
   above are complete. Prefer deferred/manual publishing if the dashboard offers
   it and you want to review approval before making the listing public.
7. After 1.4.2 is publicly available, verify the store version and downloaded
   package, then update the release status in this file, README, and landing page.

Sidebar placement is independent of other Options; there is no master switch.
The eleven local preferences are documented in the privacy policy and listing.
Existing defaults remain. Existing draft release screenshots have not been
replaced. Review individual opt-outs, cross-tab changes, and recovery with the
header switch hidden before submission. Fixture checks do not prove signed-in Amp or native mobile-sheet behavior.
Do not reuse a version number for a later store upload after it has been accepted;
increment `manifest.json` and rebuild for subsequent updates.

## Official references

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/publish

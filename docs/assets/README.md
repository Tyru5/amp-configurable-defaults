# Landing page assets

- `icon.png` is copied unchanged from `icons/icon-128.png`.
- `logo.png` is a tightly cropped transparent export of `store/icon-master.png`
  for the header and footer. Its integrated sliders represent configurable defaults.
- `right-sidebar.png` is copied unchanged from `store/screenshots/`. It is an
  earlier v1.1 live, signed-in Helium capture from October 24, 2026 at
  1280 × 800, with private content masked before capture. Its caption notes
  that v1.2 changes the header arrow to switch placement instead of all features.
  See `store/screenshots/README.md` for provenance and scope.
- `right-subagents.png` is copied unchanged from `store/screenshots/`. Like
  `right-sidebar.png`, it is an earlier v1.1 live, signed-in Helium capture from
  October 24, 2026 at 1280 × 800. It shows two actual finished subagents in the
  left panel, with right-side navigation. Conversation, thread names, account
  details, and task/output text are hidden for privacy. Its caption distinguishes
  this earlier panel from v1.2's separate Task and Output reading sheets.
  See `store/screenshots/README.md` for provenance and scope.
- `manrope.ttf` is the variable Manrope font from Google Fonts:
  <https://github.com/google/fonts/blob/main/ofl/manrope/Manrope%5Bwght%5D.ttf>.
  Its SIL Open Font License is included in `manrope-OFL.txt`. It is served
  locally; the page does not contact Google Fonts.
- `caveat.ttf` is the variable Caveat font used for the handwritten wordmark
  correction, from <https://github.com/google/fonts/blob/main/ofl/caveat/Caveat%5Bwght%5D.ttf>.
  Its SIL Open Font License is included in `caveat-OFL.txt`, and the font is
  also served locally.

- `hero-live.webp` is the landing hero and README image. It is a real,
  signed-in Amp session in Helium, captured October 26, 2026 at a 1681 × 1000
  viewport and 2× scale during the info-orb work, then resized to 2400 × 1428.
  It shows the right sidebar with child threads indented, the info orb pinned
  open, and the composer's `gpt-6.1-sol · Orb` label. The orb and its CSS were
  injected from this repository's `info-orb.js` and `sidebar.css`, because the
  installed build predated the orb. After capture, solid bars masked the
  conversation, a suggested reply, the thread name in the title bar and card,
  and every sidebar thread and project name except `amp-configurable-defaults`
  and `Floating info orb`. Nothing else was changed.
- `thread-context.webp` is a crop of the same redacted capture, showing the
  pinned info card and composer label, resized to 1600 × 931.
- `thread-split.webp` is a real, signed-in Amp capture in Helium, taken October
  27, 2026 at 1681 × 1000 and 2× scale, then resized to 2000 × 1190. The
  installed extension opened a second thread on the right with
  Alt+Shift+Right, without injected runtime code or fixture data. The native
  composers, split header, divider, and navigation are unchanged. Opaque
  post-capture masks cover both conversations, suggested replies, thread names,
  private project names, a file name, and model/runner details. Labels identify
  the masked conversations. The public `amp-configurable-defaults` project
  name remains visible. Keyboard resizing and double-click reset were checked
  in the same live session. No messages were sent.

## Current source previews, November 9, 2026

These three images show the real extension runtime at
[`59471a9`](https://github.com/Tyru5/amp-configurable-defaults/commit/59471a9)
against `tests/fixture.html`, **not signed-in Amp**. The landing page labels
them as local fixtures. They are not Web Store listing screenshots.

- `composer-skills-fixture.webp`, 1504 × 365, shows a 720px-wide composer
  with four successful skill loads and two completed subagents.
- `thread-tools-fixture.webp`, 972 × 854, shows that same composer narrowed
  to 380px with its Thread tools popover open above the button. It was
  recaptured after Thread tools became a popover, not at `59471a9`. The model, skill excerpts,
  draft text, and agent counts are synthetic. No thread messages are seeded,
  so the Messages control is absent.
- `tool-preview-fixture.webp`, 1696 × 651, shows the fixture's nine-call
  status section with its first-five preview. Calls are synthetic.

Capture method follows the Thread tools implementation's browser previews:

1. Serve the repository and open `/tests/fixture.html` with `agent-browser`.
   Use a 1200 × 900 viewport at 2× scale and clear fixture local storage.
2. Evaluate the `setup` payload from `tests/composer-tools.mjs`. Add an
   assistant record with `usage.model: 'claude-opus-5-5'` before navigation
   and two completed agents with `fixtureAgents.add`.
3. Give the fixture dark colors using its native CSS variables, hide its
   explanatory article, and use a flex-column agent pane with the composer
   footer at the bottom. Set the composer input's minimum height to 70px.
   For the Thread tools capture, also hide the transcript so only the composer
   and its popover show.
   This styles the stand-in page only; extension controls use the unmodified
   `sidebar.css` and runtime scripts.
4. Capture at 720px composer width, then at 380px after clicking
   `[data-amp-tools-ui="toggle"]` and waiting for its popover to open.
5. Navigate the fixture to a fresh thread and call
   `fixtureToolSection('landing')` for the faded tool preview.
6. Take viewport PNGs, then crop to the composer or transcript bounding box
   (for Thread tools, the composer and popover together) plus 16 CSS pixels
   of padding within the viewport, using 2× coordinates. Encode with
   ImageMagick `-quality 90` as WebP. No UI was composited or retouched;
   there was no private data to redact.

The older live captures remain historical evidence. In particular,
`hero-live.webp` and `thread-context.webp` show the former floating info orb,
not the current composer's Info control. The landing page no longer uses
`thread-context.webp` for current feature coverage.

No generated design concept is used as live-product evidence.

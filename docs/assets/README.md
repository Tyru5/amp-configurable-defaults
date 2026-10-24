# Landing page assets

- `icon.png` is copied unchanged from `icons/icon-128.png`.
- `right-sidebar.png` is copied unchanged from `store/screenshots/`. It is an
  earlier v1.1 live, signed-in Helium capture from October 24, 2026 at
  1280 × 800, with private content masked before capture. Its caption notes
  that v1.2 changes the header arrow to switch placement instead of all features.
  See `store/screenshots/README.md` for provenance and scope.
- `subagent-sheets.png` shows the v1.2 runtime on `tests/fixture.html`, not live
  Amp. At a 1280 × 800 viewport, clear fixture localStorage, reload, and add
  two finished agents with `fixtureAgents.add(id, title, task, 'finished', output)`.
  Open Subagents, focus Output, and press Enter to pin the sheet, then blur focus.
  Capture-only CSS matches the dark palette of the live image above it: background
  `#111111`, foreground `#dedede`, muted foreground `#999999`, accent `#252525`,
  input borders `#303030`, and conversation background `#0f1815`. Apply these
  variables to the runtime and corresponding colors to the fixture shell,
  buttons, links, and dividers. Hide the fixture's test-controls bar and use a
  full-height shell; replace the bar with the bottom-left green fixture label.
  These presentation overrides do not alter the extension's styles or behavior.
  Scroll to the top, capture at 2×, then resize to 1280 × 800 with ImageMagick.
  The capture itself and the landing caption explicitly label the dark-themed
  fixture and synthetic sample content, not a live Amp session.
- `manrope.ttf` is the variable Manrope font from Google Fonts:
  <https://github.com/google/fonts/blob/main/ofl/manrope/Manrope%5Bwght%5D.ttf>.
  Its SIL Open Font License is included in `manrope-OFL.txt`. It is served
  locally; the page does not contact Google Fonts.
- `caveat.ttf` is the variable Caveat font used for the handwritten wordmark
  correction, from <https://github.com/google/fonts/blob/main/ofl/caveat/Caveat%5Bwght%5D.ttf>.
  Its SIL Open Font License is included in `caveat-OFL.txt`, and the font is
  also served locally.

The hero's interactive preview is authored HTML and CSS with invented sample
content, explicitly labeled as an illustration. It is not a screenshot of Amp,
and its controls only change the preview. No generated design concept is used
as live-product evidence.

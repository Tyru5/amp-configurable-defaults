# Landing page assets

- `icon.png` is copied unchanged from `icons/icon-128.png`.
- `logo.png` is a tightly cropped transparent export of `store/icon-master.png`
  for the header and footer. Its integrated sliders represent configurable defaults.
- `manrope.ttf` is the variable Manrope font from Google Fonts:
  <https://github.com/google/fonts/blob/main/ofl/manrope/Manrope%5Bwght%5D.ttf>.
  Its SIL Open Font License is included in `manrope-OFL.txt`. It is served
  locally; the page does not contact Google Fonts.
- `caveat.ttf` is the variable Caveat font used for the handwritten wordmark
  correction, from <https://github.com/google/fonts/blob/main/ofl/caveat/Caveat%5Bwght%5D.ttf>.
  Its SIL Open Font License is included in `caveat-OFL.txt`, and the font is
  also served locally.

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

## Live 1.4.3 captures, November 11, 2026

These images are real, signed-in Amp in Helium on macOS, with the extension
as installed: version 1.4.3, loaded unpacked from a folder byte-identical to
[`b3d7749`](https://github.com/Tyru5/amp-configurable-defaults/commit/b3d7749),
default settings, sidebar on the right. No extension code or CSS was injected.
An Amp thread on the owner's Mac runner drove a new Helium tab over CDP with
`agent-browser`. Helium ignored viewport overrides, so pages laid out at its
window size, 1528 × 909 CSS pixels at 2.2× scale (3362 × 2000 image pixels).
Nothing was archived or sent; the archive confirmation was cancelled.

Redaction happened on the Mac before any image left it: opaque rectangles in
sampled background colors, with faint bars where text was, covering
conversation text, thread titles, the window title, project names other than
`amp-configurable-defaults`, sidebar project icons, the account avatar and
menu, transcript images, paths, hostnames, file names, suggested replies,
executor error details, and one company-internal skill name. Mask positions
came from the page's text layout, measured before and after each screenshot.
The extension's controls and the model names stay readable. In this repo, one
more mask removed a 1–2 px sliver of glyph tops above the Thread tools popover
in the hero (and the crop taken from it), repainting the popover border.
The unredacted originals were deleted on the Mac.

- `hero-live.webp`, 2400 × 1428 (resized from 3362 × 2000): the landing hero,
  the README image, and the features page's navigation image. Right sidebar
  with a child thread indented, the sidebar header's select, placement, and
  settings buttons, and the crowded composer's Thread tools popover with
  `gpt-6-astra · Orb`, Info, Skills (18), and an excerpt. That thread ran no
  subagents. Replaces the October 26 capture with the injected info orb.
- `thread-tools-live.webp`, 960 × 1240: the Thread tools popover, cropped
  from the redacted hero at `960x1240+520+760` in image pixels.
- `batch-archive-live.webp`, 610 × 2000: the sidebar cropped from the full
  viewport at `610x2000+2630+0`, in selection mode with three rows
  checked, group Select all and Clear, and the bar showing 3 selected, Select
  all, and Archive. `batch-archive-confirm-live.webp`, same size, shows the
  "Archive 3 Threads?" confirmation before it was cancelled; it is kept for
  reuse and is not on the pages.
- `composer-skills-live.webp`, 1580 × 470: an uncrowded composer with Skills
  (4), `claude-opus-5-5 · high effort · Orb`, Info, and Messages (7).
- `tool-calls-live.webp`, 1420 × 1010: an expanded tool-call section with
  Bash commands as code blocks, including a multi-line loop. The faded
  first-five preview was not captured: in current Amp, nested tool rows no
  longer match the `.transcript-entry-row.pl-5` selector in `tool-preview.js`,
  so 1.4.3 never inserts it.
- `subagents-live.webp`, 2000 × 1190: the Subagents panel listing two
  subagents run for this capture (reading the manifest and the icons folder).

### Feature card captures, November 11, 2026

A second round, from the same Helium profile, version, commit, window size, and
default settings, between 15:35 and 15:50 MST, illustrates the smaller cards
on the features page. Masking followed the same method. The pages show these
crops at their CSS-pixel size through a `2.2x` srcset, so they are not
upscaled. Extension settings the user had changed were set to defaults for
the shots and then restored; Amp's own settings were not touched.

- `indent-threads-live.webp`, 607 × 519: the right sidebar with one child
  thread indented under its parent. No two-level chain existed to capture.
- `thread-card-live.webp`, 1320 × 317: Amp's native hover card opened to the
  left of the right sidebar.
- `thread-messages-live.webp`, 770 × 266: the Messages panel from Thread
  tools, with one received message; sender and text masked.
- `model-runner-live.webp`, 836 × 97: `claude-opus-5-5 · high effort · Orb`,
  Info, and Messages (1). Nothing masked.
- `timestamp-dates-live.webp`, 764 × 140: a message with
  `Nov 11, 2026 · 15:16:42`, cropped at `764x140+1260+0` from a 2024 × 282
  capture. The date option was on, and Amp's Always Show Timestamps was
  already enabled.
- `activity-rows-live.webp`, 1408 × 735: tinted tool rows with left borders,
  including a live running row. Subagent summaries and the pulsing dot are
  not shown: every thread with subagents was archived, and the extension
  mounts nothing on read-only threads in Amp's current tab layout.

Not captured: **Keep tools opposite navigation**, because Amp's view layout is
set to tabs, so tools replace the transcript and there is no side pane to show
without changing Amp's settings; and **Keep Spaces conversations separate**,
because the account had no Spaces and none was created.

WebP exports used ImageMagick `-quality 90` for crops and `-resize 2000x
-quality 88` (`2400x -quality 90` for the hero) for full viewports.

No local fixture or generated design concept is used on the landing or
features pages. `docs/previews/` and `store/screenshots/fixture-*.png` remain
labeled compatibility fixtures for development only.

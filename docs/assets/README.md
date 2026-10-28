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

No generated design concept is used as live-product evidence.

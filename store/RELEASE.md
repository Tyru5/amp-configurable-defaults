# Version 1.3.0 submission checklist

## Changes since 1.2.0

- Renamed the extension to amp configurable defaults and added a compact toolbar
  settings popup alongside the full Options page.
- Added composer labels for the thread's model, runner or Orb, and explicit effort.
- Added a floating, pinnable thread info orb with runner and working-directory details.
- Added in-page thread split panes with drag-and-drop, keyboard shortcuts, and
  resizable dividers. Embedding uses a scoped, session-only framing/CSP exception.
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
  for coverage, suggested uploads, and supplemental images that are fixtures.

## Before uploading

- [ ] Review the embedded-thread framing/CSP exception and iframe remote-code
      disclosures against current Web Store policy before submission.
- [ ] Smoke-test the final 1.3.0 ZIP on real, signed-in Amp. Earlier live checks
      in README.md do not replace testing this packaged release.
- [x] Capture real Amp screenshots at 1280 × 800, inspect redactions, and keep
      fixture previews separately identified. No private content is published.
- [ ] Repeat the final smoke test in current Google Chrome. Helium and fixture
      checks do not prove every Chrome/Amp layout combination. In particular,
      live Changes and Portal remain unchecked; Changes was disabled by Amp in
      the available release threads. Both are covered by fixture checks.
- [ ] Confirm permission to use the new Amp-derived mark before submitting
      the extension icon and promo tile to the Web Store.
- [ ] Confirm the publisher's Chrome Web Store developer account, registration,
      required identity/contact verification, and 2-step verification are ready.
- [ ] Read and accept the developer agreement and privacy certifications yourself.

## Build and upload

```sh
node --check background.js
node --check content.js
node --check thread-split.js
node --check subagents.js
node --check composer.js
node --check info-orb.js
node --check options.js
node --test tests/background.test.mjs
node --test tests/options.test.mjs
python3 -m unittest discover -s tests -p '*_test.py'
python3 scripts/package.py
```

1. Open https://chrome.google.com/webstore/devconsole.
2. Add a new item and upload `dist/amp-configurable-defaults-1.3.0.zip` directly.
   Unlike Chrome's **Load unpacked**, the store accepts the ZIP itself.
3. Copy the fields from `store/listing.md`. Upload the icon, `store/promo-small.png`
   and `store/promo-marquee.png` in their matching promotional tile fields, and
   the suggested real screenshots in `store/screenshots/README.md`. Never upload
   the `fixture-*.png` images as live app screenshots. Check the listing preview.
4. Set privacy practices and link the public privacy policy. Verify all URLs.
5. Choose the countries and visibility you want. Resolve any dashboard warnings.
6. Submit for review only after the live compatibility and screenshot checks
   above are complete. Prefer deferred/manual publishing if the dashboard offers
   it and you want to review approval before making the listing public.

Store review, approval, and publication have not been performed by this project.
Sidebar placement is independent of other Options; there is no master switch.
The ten local preferences are documented in the privacy policy and listing.
Existing defaults remain, including footer hiding off. Existing draft release
screenshots have not been replaced. Review the footer states, individual opt-outs,
cross-tab changes, and recovery with both footer and header switch hidden before
submission. Fixture checks do not prove signed-in Amp or native mobile-sheet behavior.
Do not reuse a version number for a later store upload after it has been accepted;
increment `manifest.json` and rebuild for subsequent updates.

## Official references

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/publish

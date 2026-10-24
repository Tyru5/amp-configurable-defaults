# Version 1.0.0 submission checklist

## Prepared in this repository

- Manifest V3, host access limited to `https://ampcode.com/*`, storage only.
- Toolbar and extension icons at 16, 32, 48, and 128 pixels.
- Required 440 × 280 promotional tile.
- Public privacy policy, support URL, listing copy, and permission explanations.
- Reproducible upload ZIP with `manifest.json` at its root and SHA-256 checksum.
- Syntax, toolbar behavior, packaging, and local browser fixture checks.
- Signed-in Helium checks with two real subagents, both sides, Files, resizing,
  master disable/re-enable, and the extracted release ZIP.
- Privacy-redacted live 1280 × 800 screenshots. See `screenshots/README.md`
  for coverage, suggested uploads, and supplemental images that are fixtures.

## Before uploading

- [x] Test the extracted release on real, signed-in Amp in Helium.
- [x] Capture real Amp screenshots at 1280 × 800, inspect redactions, and keep
      fixture previews separately identified. No private content is published.
- [ ] Repeat the final smoke test in current Google Chrome. Helium and fixture
      checks do not prove every Chrome/Amp layout combination. In particular,
      live Changes and Portal remain unchecked; Changes was disabled by Amp in
      the available release threads. Both are covered by fixture checks.
- [x] Use original sidebar-and-arrow artwork for the extension icon and promo
      tile, without an Amp logo or wordmark.
- [ ] Confirm the publisher's Chrome Web Store developer account, registration,
      required identity/contact verification, and 2-step verification are ready.
- [ ] Read and accept the developer agreement and privacy certifications yourself.

## Build and upload

```sh
node --check background.js
node --check content.js
node --check subagents.js
node --check options.js
node --test tests/background.test.mjs
python3 -m unittest discover -s tests -p '*_test.py'
python3 scripts/package.py
```

1. Open https://chrome.google.com/webstore/devconsole.
2. Add a new item and upload `dist/amp-sidebar-right-1.0.0.zip` directly.
   Unlike Chrome's **Load unpacked**, the store accepts the ZIP itself.
3. Copy the fields from `store/listing.md`. Upload the icon, promo tile, and
   the suggested real screenshots in `store/screenshots/README.md`. Never upload
   the `fixture-*.png` images as live app screenshots. Check the listing preview.
4. Set privacy practices and link the public privacy policy. Verify all URLs.
5. Choose the countries and visibility you want. Resolve any dashboard warnings.
6. Submit for review only after the live compatibility and screenshot checks
   above are complete. Prefer deferred/manual publishing if the dashboard offers
   it and you want to review approval before making the listing public.

Store review, approval, and publication have not been performed by this project.
Do not reuse a version number for a later store upload after it has been accepted;
increment `manifest.json` and rebuild for subsequent updates.

## Official references

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/publish

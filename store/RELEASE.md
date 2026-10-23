# Version 1.0.0 submission checklist

## Prepared in this repository

- Manifest V3, host access limited to `https://ampcode.com/*`, storage only.
- Toolbar and extension icons at 16, 32, 48, and 128 pixels.
- Required 440 × 280 promotional tile.
- Public privacy policy, support URL, listing copy, and permission explanations.
- Reproducible upload ZIP with `manifest.json` at its root and SHA-256 checksum.
- Syntax, toolbar behavior, packaging, and local browser fixture checks.

## Before uploading

- [ ] Test version 1.0.0 on a real, signed-in Amp page in current Chrome.
      Check left/right switching, draft preservation, resize, collapse/reopen,
      navigation between threads, and a second tab. Check any Amp layout modes
      you use. Fixture tests do not prove live Amp compatibility.
- [ ] Capture at least one real Amp screenshot at 1280 × 800 or 640 × 400 image
      pixels with the extension active. The developer previews are not store
      screenshots. Do not include private thread contents or credentials.
- [ ] Confirm the publisher's Chrome Web Store developer account, registration,
      required identity/contact verification, and 2-step verification are ready.
- [ ] Read and accept the developer agreement and privacy certifications yourself.

## Build and upload

```sh
node --check background.js
node --check content.js
node --test tests/background.test.mjs
python3 -m unittest discover -s tests -p '*_test.py'
python3 scripts/package.py
```

1. Open https://chrome.google.com/webstore/devconsole.
2. Add a new item and upload `dist/amp-sidebar-right-1.0.0.zip` directly.
   Unlike Chrome's **Load unpacked**, the store accepts the ZIP itself.
3. Copy the fields from `store/listing.md`. Upload the icon, promo tile, and
   real signed-in screenshot. Check how every image renders in the listing.
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

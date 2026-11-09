#!/usr/bin/env python3
"""Serve the repository for local previews without changing published assets."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from urllib.parse import urlsplit


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if urlsplit(self.path).path in ("/docs/", "/docs/index.html"):
            # Manrope is already preloaded in HTML. Discover Caveat alongside it,
            # instead of waiting another network round trip for landing.css.
            self.send_header(
                "Link",
                '</docs/assets/caveat.ttf>; rel=preload; as=font; '
                'type="font/ttf"; crossorigin',
            )
        super().end_headers()


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    handler = partial(PreviewHandler, directory=str(root))
    with ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8765"))), handler) as server:
        server.serve_forever()

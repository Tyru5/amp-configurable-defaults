#!/usr/bin/env python3
"""Build a dependency-free Chrome Web Store ZIP with a root-level manifest."""

import hashlib
import json
from pathlib import Path
import struct
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent


def build(output_dir=None):
    manifest = json.loads((ROOT / "manifest.json").read_text())
    if manifest["manifest_version"] != 3:
        raise ValueError("Expected Manifest V3")
    if manifest["permissions"] != ["storage", "declarativeNetRequestWithHostAccess"]:
        raise ValueError("Review permissions and privacy disclosures before packaging")
    if manifest.get("host_permissions") != ["https://ampcode.com/*"]:
        raise ValueError("Thread embedding must be restricted to ampcode.com")
    if manifest["content_scripts"][0]["matches"] != ["https://ampcode.com/*"]:
        raise ValueError("Review host access and privacy disclosures before packaging")

    files = {"manifest.json", "LICENSE"}
    files.add(manifest["background"]["service_worker"])
    files.update(manifest["icons"].values())
    files.update(manifest["action"]["default_icon"].values())
    files.update({manifest["options_ui"]["page"], "options.js"})
    for script in manifest["content_scripts"]:
        files.update(script["js"])
        files.update(script["css"])

    for size, filename in manifest["icons"].items():
        image = (ROOT / filename).read_bytes()
        if image[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"{filename} is not a PNG")
        if struct.unpack(">II", image[16:24]) != (int(size), int(size)):
            raise ValueError(f"Wrong dimensions for {filename}")

    output_dir = Path(output_dir) if output_dir else ROOT / "dist"
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / f"amp-configurable-defaults-{manifest['version']}.zip"
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
        for filename in sorted(files):
            # Fixed metadata makes releases byte-for-byte reproducible.
            entry = ZipInfo(filename, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            bundle.writestr(entry, (ROOT / filename).read_bytes())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n")
    print(f"Built {archive.name}: {archive.stat().st_size} bytes, manifest at ZIP root")
    return archive


if __name__ == "__main__":
    build()

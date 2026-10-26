import importlib.util
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("package", ROOT / "scripts/package.py")
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTest(unittest.TestCase):
    def test_upload_has_root_manifest_and_only_runtime_files(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = package.build(directory)
            first_bytes = archive.read_bytes()
            with ZipFile(archive) as bundle:
                self.assertIsNone(bundle.testzip())
                self.assertEqual(bundle.read("manifest.json"), (ROOT / "manifest.json").read_bytes())
                self.assertEqual(set(bundle.namelist()), {
                    "manifest.json", "background.js", "content.js", "subagents.js", "composer.js", "sidebar.css", "LICENSE",
                    "options.html", "options.js",
                    "icons/icon-16.png", "icons/icon-32.png",
                    "icons/icon-48.png", "icons/icon-128.png",
                })
            self.assertEqual(first_bytes, package.build(directory).read_bytes())


if __name__ == "__main__":
    unittest.main()

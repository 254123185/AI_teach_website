from collections import Counter
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from solution import generate, make_pair


CONFIG = json.loads(Path(__file__).with_name("scenarios.json").read_text(encoding="utf-8"))


class DatasetTest(unittest.TestCase):
    def test_reproducibility_and_noise_bound(self):
        dark = CONFIG["scenarios"][0]
        reference, degraded = make_pair(16, 8, dark, 101)
        self.assertEqual(reference, [32] * 128)
        self.assertEqual(degraded[:4], [30, 35, 38, 25])
        self.assertTrue(all(24 <= value <= 40 for value in degraded))
        self.assertEqual(make_pair(16, 8, dark, 101)[1], degraded)
        self.assertNotEqual(make_pair(16, 8, dark, 102)[1], degraded)

    def test_texture_and_saturation(self):
        texture = CONFIG["scenarios"][1]
        highlight = CONFIG["scenarios"][2]
        self.assertEqual(make_pair(16, 8, texture, 201)[0][:4], [72, 104, 72, 104])
        reference, degraded = make_pair(16, 8, highlight, 301)
        self.assertEqual(max(reference), 248)
        self.assertEqual(degraded.count(255), 72)
        self.assertEqual(max(degraded), 255)

    def test_manifest_and_files(self):
        with TemporaryDirectory() as tmp:
            directory = Path(tmp)
            manifest = generate(CONFIG, directory)
            self.assertEqual(Counter(row["scenario"] for row in manifest), {
                "dark-flat": 2, "fine-texture": 2, "highlight-clipping": 1
            })
            self.assertEqual(len(list(directory.glob("*.pgm"))), 10)
            self.assertEqual(json.loads((directory / "manifest.json").read_text()), manifest)
            for row in manifest:
                data = (directory / row["input"]).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), row["input_sha256"])
                settings = next(s for s in CONFIG["scenarios"] if s["id"] == row["scenario"])
                self.assertEqual(row["reference_pattern"], settings["reference"])
                self.assertEqual(row["noise_bound"], settings["noise"])
                self.assertEqual(row["offset"], settings["offset"])

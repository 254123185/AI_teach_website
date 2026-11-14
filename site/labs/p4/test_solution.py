import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from scene import blend, spatial_weights
from solution import ROOT, experiment, write_experiment


class DenoiseFusionTest(unittest.TestCase):
    def setUp(self):
        self.protocol = json.loads((ROOT / "protocol.json").read_text(encoding="utf-8"))

    def test_spatial_weights_follow_declared_positions(self):
        scene = self.protocol["scene"]
        matrix = spatial_weights(scene["width"], scene["height"], self.protocol["spatial"])
        self.assertEqual(len(matrix), scene["height"])
        self.assertEqual(len(matrix[0]), scene["width"])
        self.assertEqual([matrix[0][12], matrix[0][58], matrix[0][110]], [85, 15, 8])
        self.assertTrue(all(row == matrix[0] for row in matrix))
        self.assertTrue(all(left >= right for left, right in zip(matrix[0], matrix[0][1:])))
        self.assertEqual(matrix[0][41], 85)
        self.assertEqual(matrix[0][50], 15)
        self.assertEqual(matrix[0][87], 15)
        self.assertEqual(matrix[0][96], 8)

    def test_both_results_use_the_same_frames(self):
        frames, metrics, gates = experiment(self.protocol)
        scene = self.protocol["scene"]
        dimensions = {(len(data), len(data[0])) for data in frames.values()}
        self.assertEqual(dimensions, {(scene["height"], scene["width"])})
        flat_map = [[50] * scene["width"] for _ in range(scene["height"])]
        self.assertEqual(frames["global"], blend(frames["weak"], frames["strong"], flat_map))
        self.assertEqual(frames["spatial"], blend(frames["weak"], frames["strong"], frames["weights"]))
        diagnostic_map = [[sum(frames["weights"][0])] * scene["width"] for _ in range(scene["height"])]
        self.assertEqual(frames["mean_matched"], blend(frames["weak"], frames["strong"],
                                                      diagnostic_map, 100 * scene["width"]))
        self.assertEqual(metrics["global"]["lamp_peak_value"], frames["global"][37][109])
        self.assertEqual(len(gates), 5)

    def test_published_bundle_is_reproducible_and_checksums_match(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            paths = [Path(first), Path(second)]
            for path in paths:
                write_experiment(path)
            self.assertEqual((paths[0] / "result.json").read_bytes(), (paths[1] / "result.json").read_bytes())
            self.assertEqual((paths[0] / "demo.html").read_bytes(), (paths[1] / "demo.html").read_bytes())
            manifest = json.loads((paths[0] / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual((paths[0] / "manifest.json").read_bytes(), (paths[1] / "manifest.json").read_bytes())
            self.assertTrue({"demo.html", "report.md", "result.json", "comparison.svg",
                             "roi-comparison.svg", "weak.pgm", "strong.pgm"} <= manifest["artifacts"].keys())
            for name, metadata in manifest["artifacts"].items():
                data = (paths[0] / name).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), metadata["sha256"])
                self.assertEqual(len(data), metadata["bytes"])


if __name__ == "__main__":
    unittest.main()

import json
from pathlib import Path
import unittest

from solution import shortlist


def fixture(name):
    return json.loads(Path(__file__).with_name(name + ".json").read_text(encoding="utf-8"))


class ResearchTriageTest(unittest.TestCase):
    def test_current_project(self):
        self.assertEqual(shortlist(fixture("brief"), fixture("papers")), [
            {"id": "ffdnet", "status": "try", "missing": [], "conflicts": []},
            {"id": "mertens", "status": "defer", "missing": ["multiscale_blender_hook"], "conflicts": []},
            {"id": "cbdnet", "status": "defer",
             "missing": ["raw_calibration", "paired_calibration_images", "training_slot"],
             "conflicts": []},
            {"id": "noise2void", "status": "defer", "missing": ["training_slot"],
             "conflicts": []},
        ])

    def test_conflict_still_matters_with_training(self):
        brief = fixture("brief")
        brief["available"].append("training_slot")
        brief["observations"].append("row_correlated_residual")
        [candidate] = shortlist(brief, [fixture("papers")[-1]])
        self.assertEqual(candidate["missing"], [])
        self.assertEqual(candidate["conflicts"], ["row_correlated_residual"])
        self.assertEqual(candidate["status"], "defer")

    def test_missing_interface_blocks_first_idea(self):
        brief = fixture("brief")
        brief["available"].remove("blend_weight_hook")
        [candidate] = shortlist(brief, fixture("papers")[:1])
        self.assertEqual(candidate["status"], "defer")
        self.assertEqual(candidate["missing"], ["blend_weight_hook"])

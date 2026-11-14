import json
from pathlib import Path
import unittest

from solution import apply_filter, compare


def fixtures():
    return json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8"))


class CompareTest(unittest.TestCase):
    def test_filters(self):
        values = [10, 30, 11, 30, 30]
        self.assertEqual(apply_filter(values, "baseline"), values)
        self.assertEqual(apply_filter(values, "mean3"), [17, 17, 24, 24, 30])
        self.assertEqual(apply_filter(values, "median3"), [10, 11, 30, 30, 30])
        self.assertEqual(apply_filter(values, "gated"), [10, 11, 30, 30, 30])
        self.assertEqual(values, [10, 30, 11, 30, 30])
        self.assertEqual(apply_filter([10, 30, 30], "gated"), [10, 30, 30])

    def test_grouped_metrics(self):
        result = compare(fixtures())
        self.assertAlmostEqual(result["dev"]["baseline"]["flat"], 70 / 18)
        self.assertAlmostEqual(result["dev"]["mean3"]["detail"], 138 / 22)
        self.assertAlmostEqual(result["dev"]["median3"]["detail"], 70 / 22)
        self.assertFalse(result["dev"]["median3"]["passes"])
        self.assertAlmostEqual(result["dev"]["gated"]["flat"], 5 / 18)
        self.assertTrue(result["dev"]["gated"]["passes"])
        self.assertEqual(result["selected"], "gated")
        self.assertEqual(set(result["holdout"]), {"gated", "baseline"})
        self.assertAlmostEqual(result["holdout"]["gated"]["flat"], 10 / 18)
        self.assertAlmostEqual(result["holdout"]["gated"]["detail"], 10 / 22)
        self.assertIs(result["advance"], True)

    def test_failed_holdout_does_not_change_selection(self):
        dataset = fixtures()
        detail = next(row for row in dataset["holdout"] if row["region"] == "detail")
        detail["reference"] = detail["noisy"] = [40, 40, 80, 40, 40]
        result = compare(dataset)
        self.assertEqual(result["selected"], "gated")
        self.assertIs(result["advance"], False)

    def test_no_development_candidate(self):
        dataset = fixtures()
        for row in dataset["dev"]:
            if row["region"] == "flat":
                row["noisy"] = [value + 8 for value in row["reference"]]
        result = compare(dataset)
        self.assertIsNone(result["selected"])
        self.assertEqual(set(result["holdout"]), {"baseline"})
        self.assertIs(result["advance"], False)

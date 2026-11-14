import csv
from pathlib import Path
import unittest

from solution import summarize


def runs():
    with Path(__file__).with_name("runs.csv").open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


class SelectionTest(unittest.TestCase):
    def test_summary(self):
        result = summarize(runs())
        self.assertEqual(set(result), {"small", "large"})
        self.assertAlmostEqual(result["small"]["accuracy"], 2 / 3)
        self.assertEqual(result["small"]["median_ttft_ms"], 120)
        self.assertAlmostEqual(result["small"]["cost"], 0.006)
        self.assertEqual(result["large"]["accuracy"], 1)
        self.assertEqual(result["large"]["median_ttft_ms"], 220)
        self.assertAlmostEqual(result["large"]["cost"], 0.024)

    def test_mismatched_and_duplicate_tasks(self):
        rows = runs()
        for broken in (rows[:-1], rows + rows[:1]):
            with self.assertRaises(ValueError):
                summarize(broken)

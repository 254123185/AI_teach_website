import unittest

from solution import read_csv, select, validate


class SearchTest(unittest.TestCase):
    def test_budget(self):
        candidates = read_csv("candidates.csv")
        self.assertEqual(select(candidates, 0)["selected"], "baseline")
        self.assertEqual(select(candidates, 5)["selected"], "local")
        chosen = select(candidates, 8)
        self.assertEqual(chosen, {"selected": "strong", "spent": 8,
                                 "tried": ["baseline", "light", "normalize", "local", "strong"]})
        with self.assertRaises(ValueError):
            select(candidates, -1)

    def test_holdout(self):
        chosen = select(read_csv("candidates.csv"), 8)
        report = validate(chosen, read_csv("holdout.csv"))
        self.assertEqual(report["selected"], "strong")
        self.assertAlmostEqual(report["holdout_f1"], 0.706)
        self.assertAlmostEqual(report["baseline_f1"], 0.710)
        self.assertIs(report["adopt"], False)

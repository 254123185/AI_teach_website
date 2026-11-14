import json
from pathlib import Path
import unittest

from solution import choose, softmax


class DecodeTest(unittest.TestCase):
    def test_reference_probabilities(self):
        actual = softmax([2, 1, 0])
        self.assertAlmostEqual(sum(actual), 1)
        for value, expected in zip(actual, [0.66524096, 0.24472847, 0.09003057], strict=True):
            self.assertAlmostEqual(value, expected)
        self.assertEqual(actual, softmax([1002, 1001, 1000]))

    def test_greedy(self):
        for case in json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8")):
            with self.subTest(case=case):
                self.assertEqual(choose(case["ids"], case["logits"]), case["expected"])

    def test_invalid(self):
        for logits in ([], [float("inf")], [float("nan")]):
            with self.assertRaises(ValueError):
                softmax(logits)
        with self.assertRaises(ValueError):
            choose([1], [1, 2])

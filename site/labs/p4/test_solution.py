import unittest

from solution import compare, read_activations


class QuantTest(unittest.TestCase):
    def test_bright_samples(self):
        values = read_activations()
        first, second = compare(values, 1), compare(values, 2)
        self.assertEqual(first["saturated"], 3)
        self.assertEqual(second["saturated"], 0)
        self.assertAlmostEqual(first["deployed"][-1], 1)
        self.assertAlmostEqual(second["deployed"][-1], 226 / 127)
        self.assertGreater(first["max_error"], second["max_error"] * 10)

    def test_invalid_range(self):
        with self.assertRaises(ValueError):
            compare([1], 0)

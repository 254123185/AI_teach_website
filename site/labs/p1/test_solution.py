import unittest

from solution import bilateral


class BilateralTest(unittest.TestCase):
    def test_constant(self):
        output, weights = bilateral([96] * 5, 2, 30)
        self.assertAlmostEqual(output, 96)
        self.assertAlmostEqual(sum(weights), 1)

    def test_edge(self):
        samples = [53, 59, 62, 190, 196]
        output, narrow = bilateral(samples, 2, 30)
        _, wide = bilateral(samples, 2, 120)
        self.assertAlmostEqual(output, 59.7129027575, places=5)
        self.assertLess(sum(narrow[3:]), sum(wide[3:]))

    def test_invalid(self):
        for center, scale in ((0, 0), (4, 30), (-1, 30)):
            with self.assertRaises(ValueError):
                bilateral([1, 2], center, scale)

import unittest

from solution import mae, read_pgm


class RegionTest(unittest.TestCase):
    def test_regions(self):
        reference = read_pgm("reference.pgm")
        for label, wall, texture in (("baseline", 6, 6), ("candidate", 1, 12)):
            image = read_pgm(f"{label}.pgm")
            self.assertEqual(mae(reference, image, (0, 0, 4, 2)), wall)
            self.assertEqual(mae(reference, image, (4, 0, 4, 2)), texture)

    def test_constraints(self):
        with self.assertRaises(ValueError):
            mae([[1, 2]], [[1]], (0, 0, 1, 1))
        for roi in ((1, 0, 1, 1), (-1, 0, 1, 1), (0, 0, 0, 1)):
            with self.assertRaises(ValueError):
                mae([[1]], [[1]], roi)

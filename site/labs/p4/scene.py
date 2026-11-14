from math import isqrt
from random import Random


def tea_shop(scene):
    """Create a clean grayscale reference and a noisy copy of the same scene."""
    width, height = scene["width"], scene["height"]
    lamp_x, lamp_y = scene["lamp_peak_xy"]
    rng = Random(scene["seed"])
    reference, noisy = [], []
    for y in range(height):
        clean_row, noisy_row = [], []
        for x in range(width):
            if x < 46:
                value = 31 + x // 14 + y // 32
                if (x + 2 * y) % 29 == 0:
                    value += 1
                noise_span = 22
            elif x < 92:
                # Alternating narrow wood slats and occasional vertical grooves.
                value = 77 + (18 if (x - 46) % 4 < 2 else -9)
                value += ((3 * x + y // 2) % 7) - 3
                if (x - 46) % 11 == 0:
                    value -= 13
                noise_span = 10
            else:
                # An amber lamp translated to grayscale. The emission core is signal.
                distance = isqrt((x - lamp_x) ** 2 + (y - lamp_y) ** 2)
                value = 51 + max(0, 54 - distance * 3)
                if (x - lamp_x) ** 2 + (y - lamp_y) ** 2 <= 17:
                    value += 126
                noise_span = 6
            # Add awning and sill outside measurement ROIs for visual orientation.
            if y < 10:
                value = 47 + 4 * (y % 4) + ((x // 8) % 2) * 8
            if y >= 69:
                value = 27 + y // 4 + 9 * (y % 3 == 0)
            if x in {45, 46, 91, 92} and 10 <= y < 69:
                value += 13
            delta = sum(rng.randint(-noise_span, noise_span) for _ in range(3)) // 2
            clean_row.append(value)
            noisy_row.append(min(255, max(0, value + delta)))
        reference.append(clean_row)
        noisy.append(noisy_row)
    return reference, noisy


def box_filter(frame, radius):
    height, width = len(frame), len(frame[0])
    y_indices = [[min(height - 1, max(0, y + offset)) for offset in range(-radius, radius + 1)]
                 for y in range(height)]
    x_indices = [[min(width - 1, max(0, x + offset)) for offset in range(-radius, radius + 1)]
                 for x in range(width)]
    area = (2 * radius + 1) ** 2
    return [[(sum(frame[yy][xx] for yy in ys for xx in xs) + area // 2) // area
             for xs in x_indices] for ys in y_indices]


def blend(weak, strong, weights, denominator=100):
    return [[(weak_value * (denominator - weight) + strong_value * weight + denominator // 2) // denominator
             for weak_value, strong_value, weight in zip(weak_row, strong_row, weight_row)]
            for weak_row, strong_row, weight_row in zip(weak, strong, weights)]


def spatial_weights(width, height, rule):
    """Produce strong-path weights from predeclared geometry and parameters only."""
    (start_a, end_a), (start_b, end_b) = rule["transition_x"]
    first, middle, last = (rule[key] for key in ("left_weight", "center_weight", "right_weight"))

    def interpolate(x, start, end, left, right):
        stride = end - start
        return ((end - x) * left + (x - start) * right + stride // 2) // stride

    def column(x):
        if x < start_a:
            return first
        if x < end_a:
            return interpolate(x, start_a, end_a, first, middle)
        if x < start_b:
            return middle
        if x < end_b:
            return interpolate(x, start_b, end_b, middle, last)
        return last

    row = [column(x) for x in range(width)]
    return [row[:] for _ in range(height)]


def crop(frame, box):
    x, y, width, height = box
    return [row[x:x + width] for row in frame[y:y + height]]

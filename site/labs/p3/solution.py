import json
from pathlib import Path


def read_pgm(name):
    magic, width, height, maximum, *pixels = Path(__file__).with_name(name).read_text().split()
    width, height = int(width), int(height)
    if magic != "P2" or maximum != "255" or len(pixels) != width * height:
        raise ValueError("任务包只读 8 位 P2 PGM，无注释")
    values = list(map(int, pixels))
    return [values[start:start + width] for start in range(0, len(values), width)]


def mae(reference, image, roi):
    raise NotImplementedError("计算相同 ROI 的逐像素 MAE")


if __name__ == "__main__":
    reference = read_pgm("reference.pgm")
    regions = {"wall": (0, 0, 4, 2), "texture": (4, 0, 4, 2)}
    report = {
        name: {key: mae(reference, read_pgm(f"{name}.pgm"), roi) for key, roi in regions.items()}
        for name in ("baseline", "candidate")
    }
    Path("roi-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

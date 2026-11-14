import json
from pathlib import Path


def bilateral(values, center, range_sigma, spatial_sigma=1.25):
    raise NotImplementedError("实现双边滤波与归一化")


if __name__ == "__main__":
    cases = json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8"))
    for name, samples in cases.items():
        print(name, bilateral(samples, 2, 30))

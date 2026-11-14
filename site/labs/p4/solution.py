import csv
import json
from pathlib import Path


def read_activations():
    with Path(__file__).with_name("activations.csv").open(encoding="utf-8", newline="") as source:
        return [float(row["activation"]) for row in csv.DictReader(source)]


def compare(values, limit):
    raise NotImplementedError("计算饱和计数和输出误差")


if __name__ == "__main__":
    activations = read_activations()
    report = {str(limit): compare(activations, limit) for limit in (1, 2)}
    Path("quant-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

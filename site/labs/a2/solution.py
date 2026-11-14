import csv
import json
from pathlib import Path


def summarize(rows):
    raise NotImplementedError("汇总配对任务结果")


if __name__ == "__main__":
    with Path(__file__).with_name("runs.csv").open(encoding="utf-8", newline="") as source:
        report = summarize(list(csv.DictReader(source)))
    print(json.dumps(report, indent=2))

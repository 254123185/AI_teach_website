import csv
import json
from pathlib import Path
import sys


def read_csv(name):
    with Path(__file__).with_name(name).open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def select(candidates, budget):
    raise NotImplementedError("仅用开发记录筛选并冻结候选")


def validate(selection, holdout):
    raise NotImplementedError("读取锁定候选与基线的独立分数")


if __name__ == "__main__":
    chosen = select(read_csv("candidates.csv"), int(sys.argv[1]))
    report = validate(chosen, read_csv("holdout.csv"))
    Path("result.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

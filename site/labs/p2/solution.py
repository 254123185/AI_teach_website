import json
from pathlib import Path


MODES = ("baseline", "mean3", "median3", "gated")
FLAT_MAX = 1.0
DETAIL_BUDGET = 0.5


def apply_filter(values, mode):
    """Return a new row of integers, using edge replication."""
    raise NotImplementedError("实现四种方案")


def compare(dataset):
    """Compute grouped pixel errors, lock the development choice, then check holdout."""
    raise NotImplementedError("计算分区 MAE，按门槛锁定并复验")


if __name__ == "__main__":
    dataset = json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8"))
    report = compare(dataset)
    Path("result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

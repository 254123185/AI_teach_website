import json
from pathlib import Path


def softmax(logits):
    raise NotImplementedError("实现稳定的 softmax")


def choose(ids, logits):
    raise NotImplementedError("返回贪心解码的 token ID")


if __name__ == "__main__":
    cases = json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8"))
    print(json.dumps([
        {"probabilities": softmax(case["logits"]), "id": choose(case["ids"], case["logits"])}
        for case in cases
    ], indent=2))

import json
from pathlib import Path


def shortlist(brief, papers):
    raise NotImplementedError("逐项记录可用性与前提冲突")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    brief = json.loads((root / "brief.json").read_text(encoding="utf-8"))
    papers = json.loads((root / "papers.json").read_text(encoding="utf-8"))
    result = json.dumps(shortlist(brief, papers), ensure_ascii=False, indent=2)
    (root / "shortlist.json").write_text(result + "\n", encoding="utf-8")
    print(result)

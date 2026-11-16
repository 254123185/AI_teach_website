"""Compare two version manifests without changing their sample IDs."""

import argparse
from collections import Counter
import json
from pathlib import Path


def compare(manifest):
    for side in ("base", "candidate"):
        items = manifest.get(side)
        if not isinstance(items, list) or any(
            not isinstance(item, str) or not item for item in items
        ):
            raise ValueError(f"{side} must be a list of nonempty strings")

    duplicates = {
        side: sorted(item for item, count in Counter(manifest[side]).items() if count > 1)
        for side in ("base", "candidate")
    }
    if any(duplicates.values()):
        return {"status": "error", "duplicates": duplicates}

    base = set(manifest["base"])
    candidate = set(manifest["candidate"])
    return {
        "status": "ok",
        "paired": sorted(base & candidate),
        "missing_candidate": sorted(base - candidate),
        "missing_base": sorted(candidate - base),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    try:
        data = json.loads(args.manifest.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("manifest must be a JSON object")
        result = compare(data)
    except (OSError, ValueError) as error:
        result = {"status": "error", "message": str(error)}

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())

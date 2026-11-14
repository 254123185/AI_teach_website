import hashlib
import json
from pathlib import Path


def make_pair(width, height, scenario, seed):
    raise NotImplementedError("按场景规格返回参考与退化像素")


def save_pgm(path, width, height, pixels):
    rows = [
        " ".join(map(str, pixels[start:start + width]))
        for start in range(0, width * height, width)
    ]
    data = f"P2\n{width} {height}\n255\n" + "\n".join(rows) + "\n"
    path.write_text(data, encoding="ascii", newline="\n")
    return hashlib.sha256(data.encode("ascii")).hexdigest()


def generate(config, destination):
    destination.mkdir(parents=True, exist_ok=True)
    width, height = config["width"], config["height"]
    manifest = []
    for scenario in config["scenarios"]:
        for seed in scenario["seeds"]:
            reference, corrupted = make_pair(width, height, scenario, seed)
            sample = f"{scenario['id']}-{seed}"
            reference_name = sample + "-reference.pgm"
            corrupted_name = sample + "-input.pgm"
            manifest.append({
                "scenario": scenario["id"],
                "seed": seed,
                "width": width,
                "height": height,
                "reference_pattern": scenario["reference"],
                "noise_bound": scenario["noise"],
                "offset": scenario["offset"],
                "reference": reference_name,
                "input": corrupted_name,
                "reference_sha256": save_pgm(destination / reference_name, width, height, reference),
                "input_sha256": save_pgm(destination / corrupted_name, width, height, corrupted),
                "saturated_pixels": corrupted.count(255),
            })
    (destination / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    return manifest


if __name__ == "__main__":
    config = json.loads(Path(__file__).with_name("scenarios.json").read_text(encoding="utf-8"))
    manifest = generate(config, Path("dataset"))
    print(f"{len(manifest)} records: dataset/manifest.json")

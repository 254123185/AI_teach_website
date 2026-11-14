import json
from pathlib import Path


def render_demo(samples):
    raise NotImplementedError("组装离线 A/B Demo")


if __name__ == "__main__":
    samples = json.loads(Path(__file__).with_name("samples.json").read_text(encoding="utf-8"))
    Path("demo.html").write_text(render_demo(samples), encoding="utf-8", newline="\n")
    print("demo.html")

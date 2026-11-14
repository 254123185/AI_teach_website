from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


root = Path(__file__).resolve().parent / "labs"
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for lab in sorted(root.iterdir()):
    if not lab.is_dir():
        continue
    shared = {"README.md": root / "README.md", "AGENTS.md": root / "AGENTS.md"}
    files = {**shared, **{file.name: file for file in lab.iterdir() if file.is_file()}}
    assert {"task.md", "solution.py", "test_solution.py"} <= files.keys(), lab.name
    with ZipFile(out / f"{lab.name}.zip", "w") as archive:
        for name, file in sorted(files.items()):
            entry = ZipInfo(f"{lab.name}/{name}")
            archive.writestr(entry, file.read_bytes(), compress_type=ZIP_DEFLATED)
    with ZipFile(out / f"{lab.name}.zip") as archive:
        assert archive.testzip() is None

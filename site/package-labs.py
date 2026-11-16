from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


root = Path(__file__).resolve().parent / "labs"
out = Path(sys.argv[1])
fusion_output = Path(sys.argv[2]) if len(sys.argv) > 2 else None
lesson_tasks = Path(sys.argv[3]) if len(sys.argv) > 3 else None
out.mkdir(parents=True, exist_ok=True)
for lab in sorted(root.iterdir()):
    if not lab.is_dir():
        continue
    shared = {"README.md": root / "README.md", "AGENTS.md": root / "AGENTS.md"}
    files = {**shared, **{file.name: file for file in lab.iterdir() if file.is_file()}}
    assert {"task.md", "solution.py", "test_solution.py"} <= files.keys(), lab.name
    if lab.name == "p4" and fusion_output:
        files.update({
            f"published/{file.relative_to(fusion_output).as_posix()}": file
            for file in fusion_output.rglob("*") if file.is_file()
        })
    with ZipFile(out / f"{lab.name}.zip", "w") as archive:
        for name, file in sorted(files.items()):
            entry = ZipInfo(f"{lab.name}/{name}")
            archive.writestr(entry, file.read_bytes(), compress_type=ZIP_DEFLATED)
    with ZipFile(out / f"{lab.name}.zip") as archive:
        assert archive.testzip() is None

if lesson_tasks:
    for task in sorted(lesson_tasks.glob("*.md")):
        name = task.stem
        files = {"task.md": task}
        assets = root.parent / "lesson-assets" / name
        if assets.is_dir():
            files.update({
                file.relative_to(assets).as_posix(): file
                for file in assets.rglob("*")
                if file.is_file() and "__pycache__" not in file.parts and file.suffix != ".pyc"
            })
        if name == "a3":
            images = root.parent / "static" / "visual-input"
            files.update({file.name: file for file in images.glob("*.png")})
            files.update({file: fusion_output / file for file in ("weak.png", "strong.png")})
        if name == "b9":
            images = root.parent / "static" / "visual-input"
            for file in ("low-light-wood-crop.png", "low-light-weak-wood-crop.png", "low-light-strong-wood-crop.png"):
                files[file] = images / file
        with ZipFile(out / f"{name}.zip", "w") as archive:
            for path, source in sorted(files.items()):
                archive.writestr(ZipInfo(f"{name}/{path}"), source.read_bytes(), compress_type=ZIP_DEFLATED)
        with ZipFile(out / f"{name}.zip") as archive:
            assert archive.testzip() is None

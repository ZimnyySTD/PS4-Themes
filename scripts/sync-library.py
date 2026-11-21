#!/usr/bin/env python3
"""Keep the library index in sync with the folders on disk.

- Every folder in collections/ that contains an info.json is a collection and is
  written to data/collections.json (alphabetical, so the order is stable).
- Inside each collection, every sub-folder that contains an info.json is a theme.
  Themes already listed in the collection's info.json keep their order; new theme
  folders are appended; entries whose folder no longer exists are removed.

So adding content = drop in a folder with an info.json. No registry editing needed.
Files are only rewritten when something actually changed.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
COLLECTIONS = ROOT / "collections"


def write_if_changed(path, data):
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")
        print(f"Updated {path.relative_to(ROOT)}")


slugs = sorted(
    p.name for p in COLLECTIONS.iterdir()
    if p.is_dir() and not p.name.startswith(".") and (p / "info.json").is_file()
)
(ROOT / "data").mkdir(exist_ok=True)
write_if_changed(ROOT / "data" / "collections.json", {"collections": slugs})

for slug in slugs:
    info_path = COLLECTIONS / slug / "info.json"
    info = json.loads(info_path.read_text(encoding="utf-8"))
    on_disk = sorted(
        p.name for p in (COLLECTIONS / slug).iterdir()
        if p.is_dir() and not p.name.startswith(".") and (p / "info.json").is_file()
    )
    listed = [t for t in info.get("themes", []) if t in on_disk]
    themes = listed + [t for t in on_disk if t not in listed]
    changed = False
    if info.get("themes") != themes:
        info["themes"] = themes
        changed = True
    if info.get("id") != slug:
        info["id"] = slug
        changed = True
    if changed:
        write_if_changed(info_path, info)

print(f"Synced {len(slugs)} collection(s).")

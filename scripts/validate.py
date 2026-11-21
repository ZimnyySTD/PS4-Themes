#!/usr/bin/env python3
"""Check that every JSON file is valid and every referenced file exists."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa
        errors.append(f"{path.relative_to(ROOT)}: invalid JSON ({e})")
        return None


for p in ROOT.rglob("*.json"):
    if ".git" not in p.parts:
        load(p)

registry = load(ROOT / "data" / "collections.json") or {}
slugs = registry if isinstance(registry, list) else registry.get("collections", [])
for slug in slugs:
    folder = ROOT / "collections" / slug
    info = load(folder / "info.json") if (folder / "info.json").is_file() else None
    if info is None:
        errors.append(f"collections/{slug}/info.json is missing")
        continue
    if info.get("cover") and not (folder / info["cover"]).is_file():
        errors.append(f"collections/{slug}: cover file '{info['cover']}' not found")
    for t in info.get("themes", []):
        tinfo_path = folder / t / "info.json"
        if not tinfo_path.is_file():
            errors.append(f"collections/{slug}/{t}/info.json is missing")
            continue
        tinfo = load(tinfo_path) or {}
        for key in ("preview", "download"):
            if tinfo.get(key) and not (folder / t / tinfo[key]).is_file():
                errors.append(f"collections/{slug}/{t}: {key} file '{tinfo[key]}' not found")

if errors:
    print("Problems found:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("Library JSON and referenced files are valid.")

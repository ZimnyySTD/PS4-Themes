#!/usr/bin/env python3
"""Generate collections/<slug>/collection.zip from each collection's listed themes."""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
COLLECTIONS = ROOT / "collections"
registry_path = ROOT / "data" / "collections.json"
registry = json.loads(registry_path.read_text(encoding="utf-8"))
slugs = registry if isinstance(registry, list) else registry.get("collections", [])

for slug in slugs:
    folder = COLLECTIONS / slug
    info_path = folder / "info.json"
    if not info_path.exists():
        raise SystemExit(f"Missing collection metadata: {info_path}")
    info = json.loads(info_path.read_text(encoding="utf-8"))
    archive_name = info.get("archive", "collection.zip")
    archive_path = folder / archive_name
    # Fixed timestamps + sorted order => identical output when content is unchanged,
    # so the workflow only commits when something really changed.
    def add(archive, path, name):
        zi = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        archive.writestr(zi, path.read_bytes())

    with zipfile.ZipFile(archive_path, "w") as archive:
        add(archive, info_path, "info.json")
        for theme_slug in info.get("themes", []):
            theme_dir = folder / theme_slug
            if not theme_dir.is_dir():
                raise SystemExit(f"Missing theme folder: {theme_dir}")
            for path in sorted(theme_dir.rglob("*")):
                if path.is_file():
                    add(archive, path, path.relative_to(folder).as_posix())
    print(f"Created {archive_path.relative_to(ROOT)}")

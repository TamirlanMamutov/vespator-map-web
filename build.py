"""Dependency-free static build. All writes are confined to MapWebPage/dist."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = ("index.html", "styles.css", "app.js", "campaign.js", "emblems.js",
         "terrain.js", "view3d.js", "config.js", "campaign_data.json", "icon.svg")
VENDOR_FILES = ("three.module.js", "three.core.js", "THREE-LICENSE.txt")


def ensure_not_symlink(path):
    if path.is_symlink():
        raise RuntimeError(f"Refusing to write through a symlink: {path.name}")


def build():
    destination = ROOT / "dist"
    ensure_not_symlink(destination)
    with (ROOT / "campaign_data.json").open(encoding="utf-8") as source:
        json.load(source)
    sources = [ROOT / name for name in FILES] + [ROOT / "vendor" / name for name in VENDOR_FILES]
    missing = [path.name for path in sources if not path.is_file()]
    if missing:
        raise RuntimeError(f"Required assets missing: {missing}")

    destination.mkdir(exist_ok=True)
    allowed = set(FILES) | {".nojekyll", "vendor"}
    unexpected = [entry.name for entry in destination.iterdir() if entry.name not in allowed]
    if unexpected:
        raise RuntimeError(f"Unexpected dist assets; remove them before publishing: {unexpected}")
    vendor = destination / "vendor"
    ensure_not_symlink(vendor)
    vendor.mkdir(exist_ok=True)
    unexpected_vendor = [entry.name for entry in vendor.iterdir() if entry.name not in VENDOR_FILES]
    if unexpected_vendor:
        raise RuntimeError(f"Unexpected vendor assets: {unexpected_vendor}")

    for name in FILES:
        target = destination / name
        ensure_not_symlink(target)
        shutil.copyfile(ROOT / name, target)
    for name in VENDOR_FILES:
        target = vendor / name
        ensure_not_symlink(target)
        shutil.copyfile(ROOT / "vendor" / name, target)
    marker = destination / ".nojekyll"
    ensure_not_symlink(marker)
    marker.touch()
    print(f"Built {len(FILES) + len(VENDOR_FILES)} campaign assets in dist/")


if __name__ == "__main__":
    build()

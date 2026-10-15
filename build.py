"""Dependency-free static build. All writes are confined to MapWebPage/dist."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = ("index.html", "styles.css", "app.js", "campaign.js", "emblems.js",
         "terrain.js", "view3d.js", "config.js", "uplink.js", "campaign_data.json", "icon.svg")
VENDOR_FILES = ("three.module.js", "three.core.js", "THREE-LICENSE.txt")
# Battle Reports archive, served at <site>/BattleReports/ (data and artwork are copied recursively).
REPORTS_DIR = "BattleReports"
REPORTS_FILES = ("index.html", "styles.css", "app.js", "reports.js", "uplink.js",
                 "images.js", "ai_helper.js", "config.js")
REPORTS_DATA = "data/battle_reports.json"
REPORTS_ASSETS = "assets"
ASSET_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def ensure_not_symlink(path):
    if path.is_symlink():
        raise RuntimeError(f"Refusing to write through a symlink: {path.name}")


def build_reports(destination):
    """Copy the Battle Reports app into dist/BattleReports, rebuilt from scratch each time."""
    source = ROOT / REPORTS_DIR
    with (source / REPORTS_DATA).open(encoding="utf-8") as data:
        if not isinstance(json.load(data), list):
            raise RuntimeError("BattleReports data must be a JSON array of reports")
    missing = [name for name in REPORTS_FILES if not (source / name).is_file()]
    if missing:
        raise RuntimeError(f"Battle Reports assets missing: {missing}")

    target_root = destination / REPORTS_DIR
    ensure_not_symlink(target_root)
    if target_root.exists():
        shutil.rmtree(target_root)
    copies = [(source / name, target_root / name) for name in REPORTS_FILES]
    copies.append((source / REPORTS_DATA, target_root / REPORTS_DATA))
    assets = source / REPORTS_ASSETS
    if assets.is_dir():
        for path in sorted(assets.rglob("*")):
            if path.is_symlink():
                raise RuntimeError(f"Refusing to publish a symlinked asset: {path.relative_to(ROOT)}")
            if path.is_file() and path.suffix.lower() in ASSET_SUFFIXES:
                copies.append((path, target_root / path.relative_to(source)))
    for origin, target in copies:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(origin, target)
    return len(copies)


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
    allowed = set(FILES) | {".nojekyll", "vendor", REPORTS_DIR}
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
    reports = build_reports(destination)
    print(f"Built {len(FILES) + len(VENDOR_FILES)} campaign assets and {reports} battle report files in dist/")


if __name__ == "__main__":
    build()

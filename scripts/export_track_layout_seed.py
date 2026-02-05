#!/usr/bin/env python3
import argparse
import csv
import json
import os
from typing import Any, Dict, List, Tuple, Optional


def to_slug(value: str) -> str:
    return (
        value.lower()
        .replace("&", "and")
        .replace("'", "")
        .replace(",", "")
        .replace(".", "")
        .strip()
        .replace(" ", "-")
        .replace("--", "-")
    )


def find_track_geometry_file(repo_root: str, year: int, race_name: str) -> Optional[str]:
    slug = to_slug(race_name).replace("-", "_")
    base = os.path.join(repo_root, "backend", "etl", "data", "track_geometry")
    candidates = [
        os.path.join(base, f"{slug}_{year}.json"),
        os.path.join(base, f"{slug}.json"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    # fallback: scan for prefix match
    if os.path.isdir(base):
        for fname in os.listdir(base):
            if fname.startswith(f"{slug}_") and fname.endswith(".json"):
                return os.path.join(base, fname)
    return None


def compute_bounds(points: List[Tuple[float, float]]) -> Dict[str, float]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return {"minX": float(min(xs)), "maxX": float(max(xs)), "minY": float(min(ys)), "maxY": float(max(ys))}


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a Blender track layout seed (layout.json + centerline.csv).")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True, help='Race name, e.g. "Australian Grand Prix"')
    parser.add_argument(
        "--out",
        type=str,
        default="",
        help="Output folder. Default: desktop/public/tracks/<year>/<race-slug>/",
    )
    args = parser.parse_args()

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    race_slug = to_slug(args.race)
    out_dir = args.out or os.path.join(repo_root, "desktop", "public", "tracks", str(args.year), race_slug)
    os.makedirs(out_dir, exist_ok=True)

    geometry_file = find_track_geometry_file(repo_root, args.year, args.race)
    if not geometry_file:
        raise SystemExit(f"Track geometry file not found for {args.year} / {args.race}")

    with open(geometry_file, "r") as f:
        geometry = json.load(f)

    centerline = geometry.get("centerline") or []
    if not isinstance(centerline, list) or len(centerline) < 2:
        raise SystemExit(f"No usable centerline found in {geometry_file}")

    points: List[Tuple[float, float]] = [(float(p[0]), float(p[1])) for p in centerline]
    bounds = compute_bounds(points)

    layout: Dict[str, Any] = {
        "version": 1,
        "image": "layout.png",
        "bounds": bounds,
        "corners": [],
    }

    layout_path = os.path.join(out_dir, "layout.json")
    with open(layout_path, "w") as f:
        json.dump(layout, f, indent=2)

    csv_path = os.path.join(out_dir, "centerline.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["x", "y"])
        writer.writerows(points)

    print("Wrote:", layout_path)
    print("Wrote:", csv_path)
    print("Next: render a Blender plate to layout.png and keep bounds aligned to the same coordinate system.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


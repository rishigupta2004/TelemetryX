#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Dict, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
GEOM_DIR = ROOT / "backend" / "etl" / "data" / "track_geometry"
OUT_DIR = ROOT / "backend" / "etl" / "data" / "track_geometry"
CATALOG_DIR = ROOT / "backend" / "etl" / "data" / "catalog"


def _normalize_key(value: str) -> str:
    if not value:
        return ""
    return value.replace("-", " ").replace("_", " ").strip().lower()


def _load_catalog_map() -> Dict[str, str]:
    mapping = {}
    if not CATALOG_DIR.exists():
        return mapping
    for path in sorted(CATALOG_DIR.glob("*_season.json")):
        try:
            data = json.loads(path.read_text())
        except Exception:
            continue
        races = data.get("races") or []
        keys = data.get("race_keys") or []
        for k, r in zip(keys, races):
            mapping[_normalize_key(str(r))] = str(k)
    return mapping


def _resample(points: List[List[float]], n: int = 200) -> List[Tuple[float, float]]:
    if len(points) < 2:
        return [(float(points[0][0]), float(points[0][1]))] * n if points else [(0.0, 0.0)] * n
    dists = [0.0]
    total = 0.0
    for i in range(1, len(points)):
        dx = points[i][0] - points[i - 1][0]
        dy = points[i][1] - points[i - 1][1]
        seg = math.hypot(dx, dy)
        total += seg
        dists.append(total)
    if total == 0:
        return [(float(points[0][0]), float(points[0][1]))] * n
    targets = [i * total / (n - 1) for i in range(n)]
    out = []
    j = 0
    for t in targets:
        while j < len(dists) - 2 and dists[j + 1] < t:
            j += 1
        t0, t1 = dists[j], dists[j + 1]
        if t1 == t0:
            out.append((float(points[j][0]), float(points[j][1])))
            continue
        ratio = (t - t0) / (t1 - t0)
        x = points[j][0] + ratio * (points[j + 1][0] - points[j][0])
        y = points[j][1] + ratio * (points[j + 1][1] - points[j][1])
        out.append((float(x), float(y)))
    return out


def _normalize(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    cx = sum(p[0] for p in points) / max(1, len(points))
    cy = sum(p[1] for p in points) / max(1, len(points))
    centered = [(p[0] - cx, p[1] - cy) for p in points]
    rms = math.sqrt(sum(p[0] ** 2 + p[1] ** 2 for p in centered) / max(1, len(centered)))
    if rms == 0:
        return centered
    return [(p[0] / rms, p[1] / rms) for p in centered]


def _kabsch_rms(a: List[Tuple[float, float]], b: List[Tuple[float, float]]) -> float:
    # Compute optimal rotation for B -> A
    if len(a) != len(b):
        return 1e9
    # 2x2 covariance
    sxx = sxy = syx = syy = 0.0
    for (ax, ay), (bx, by) in zip(a, b):
        sxx += bx * ax
        sxy += bx * ay
        syx += by * ax
        syy += by * ay
    # SVD for 2x2
    # Use analytic rotation angle
    det = sxx * syy - sxy * syx
    trace = sxx + syy
    if trace == 0 and det == 0:
        return 1e9
    angle = math.atan2(sxy - syx, trace)
    cos_r = math.cos(angle)
    sin_r = math.sin(angle)
    total = 0.0
    for (ax, ay), (bx, by) in zip(a, b):
        rx = bx * cos_r - by * sin_r
        ry = bx * sin_r + by * cos_r
        total += (ax - rx) ** 2 + (ay - ry) ** 2
    return math.sqrt(total / max(1, len(a)))


def _shape_distance(a: List[Tuple[float, float]], b: List[Tuple[float, float]]) -> float:
    d1 = _kabsch_rms(a, b)
    d2 = _kabsch_rms(a, list(reversed(b)))
    return min(d1, d2)


def _parse_name(path: Path) -> Tuple[str, int]:
    name = path.stem
    parts = name.rsplit("_", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0], int(parts[1])
    return name, 0


def main() -> int:
    threshold = float(os.getenv("LAYOUT_RMS_THRESHOLD", "0.03"))
    catalog_map = _load_catalog_map()
    layouts: Dict[str, Dict] = {}
    mapping: Dict[str, Dict[str, str]] = {}
    report_lines: List[str] = []

    by_track: Dict[str, List[Tuple[int, List[Tuple[float, float]]]]] = {}
    for path in sorted(GEOM_DIR.glob("*.json")):
        if path.name in {"circuits.parquet", "corners.parquet"}:
            continue
        try:
            data = json.loads(path.read_text())
        except Exception:
            continue
        if "centerline" not in data:
            continue
        base, year = _parse_name(path)
        pts = _normalize(_resample(data["centerline"], 200))
        by_track.setdefault(base, []).append((year, pts))

    for base, entries in sorted(by_track.items()):
        entries = sorted(entries, key=lambda x: x[0] or 0)
        clusters: List[Dict] = []
        for year, pts in entries:
            assigned = False
            for c in clusters:
                d = _shape_distance(c["proto"], pts)
                if d <= threshold:
                    c["years"].append(year)
                    c["members"].append(pts)
                    assigned = True
                    break
            if not assigned:
                clusters.append({"proto": pts, "years": [year], "members": [pts]})

        # Write mapping for each year
        for idx, c in enumerate(clusters, start=1):
            layout_id = f"{base}_v{idx}"
            layouts[layout_id] = {"track": base, "years": [y for y in c["years"] if y]}
            for y in c["years"]:
                if not y:
                    continue
                mapping.setdefault(str(y), {})[base] = layout_id
                # also map circuit key if known
                race_key = catalog_map.get(_normalize_key(base.replace("_", " ")))
                if race_key:
                    mapping.setdefault(str(y), {})[race_key] = layout_id

        years_groups = [sorted([y for y in c["years"] if y]) for c in clusters]
        report_lines.append(f"{base}: {years_groups}")

    out = OUT_DIR / "layout_map.json"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(mapping, indent=2))
    (OUT_DIR / "layout_report.txt").write_text("\n".join(report_lines))
    print(f"Wrote {out}")
    print(f"Wrote {OUT_DIR / 'layout_report.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

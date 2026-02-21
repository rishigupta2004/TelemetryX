#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Tuple
import re


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("/Users/rishigupta/Downloads/F1 Track_Source")
DEFAULT_OUT = ROOT / "backend" / "etl" / "data" / "track_geometry"
DEFAULT_CATALOG = ROOT / "backend" / "etl" / "data" / "catalog" / "2025_season.json"


def _normalize_key(value: str) -> str:
    if not value:
        return ""
    return (
        value.replace("-", " ")
        .replace("_", " ")
        .strip()
        .lower()
    )


def _slug_from_race(name: str) -> str:
    return _normalize_key(name).replace(" ", "_")


def _load_catalog_map(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    keys = data.get("race_keys") or []
    races = data.get("races") or []
    return {str(k): str(r) for k, r in zip(keys, races)}


def _convert_track(data: Dict, race_name: str, year: int) -> Dict:
    coords = (data.get("layout") or {}).get("path_coordinates") or []
    centerline = [[float(p["x"]), float(p["y"])] for p in coords if "x" in p and "y" in p]

    idx_by_dist: List[Tuple[float, int]] = []
    for i, p in enumerate(coords):
        idx_by_dist.append((float(p.get("distance", i)), i))
    idx_by_dist.sort()

    def idx_for_distance(dist: float) -> int:
        if not idx_by_dist:
            return 0
        best = min(idx_by_dist, key=lambda t: abs(t[0] - dist))
        return int(best[1])

    sectors = {}
    for s in data.get("sectors", []):
        try:
            sec_num = int(s.get("sector"))
        except Exception:
            continue
        end_d = float(s.get("end_distance", 0))
        sectors[f"sector{sec_num}"] = {
            "endIndex": idx_for_distance(end_d),
            "name": f"Sector {sec_num}",
            "color": ["#FF6464", "#64FF64", "#6464FF"][sec_num - 1] if 1 <= sec_num <= 3 else "#FFFFFF",
        }

    zones = []
    for z in data.get("drs_zones", []):
        try:
            start = float(z.get("activation_point", z.get("start_point", 0)))
            end = float(z.get("end_point", 0))
        except Exception:
            continue
        zones.append({"startIndex": idx_for_distance(start), "endIndex": idx_for_distance(end)})

    return {
        "name": race_name,
        "country": data.get("country", ""),
        "location": data.get("location", ""),
        "trackWidth": float((data.get("layout") or {}).get("track_width", 10)),
        "centerline": centerline,
        "sectors": sectors,
        "drsZones": zones,
    }


def main() -> int:
    src = Path(os.getenv("TRACK_SOURCE_DIR", str(DEFAULT_SOURCE)))
    out = Path(os.getenv("TRACK_OUT_DIR", str(DEFAULT_OUT)))
    catalog = Path(os.getenv("TRACK_CATALOG_FILE", str(DEFAULT_CATALOG)))
    out.mkdir(parents=True, exist_ok=True)

    key_map = _load_catalog_map(catalog)

    if not src.exists():
        print(f"Source not found: {src}")
        return 1

    json_files = [p for p in src.iterdir() if p.suffix.lower() == ".json"]
    if not json_files:
        print(f"No JSON files in {src}")
        return 0

    for path in json_files:
        try:
            data = json.loads(path.read_text())
        except Exception:
            print(f"Skip invalid JSON: {path.name}")
            continue
        race_name = data.get("race_name") or data.get("track_name") or ""
        circuit_key = str(data.get("circuit_key") or "")
        if circuit_key in key_map:
            race_name = key_map[circuit_key]
        if "grand prix" not in race_name.lower() and circuit_key:
            race_name = key_map.get(circuit_key, race_name)
        if not race_name:
            continue
        stem = path.stem
        is_versioned = re.search(r"_v\\d+$", stem) is not None
        if is_versioned:
            payload = _convert_track(data, race_name, int((data.get("lap_record") or {}).get("year") or 2025))
            out_file = out / f"{stem}.json"
            out_file.write_text(json.dumps(payload, indent=2))
            print(f"Wrote {out_file}")
        else:
            base_year = int((data.get("lap_record") or {}).get("year") or 2025)
            catalog_year = int((json.loads(catalog.read_text()).get("season") or base_year)) if catalog.exists() else base_year
            for year in sorted({base_year, catalog_year}):
                payload = _convert_track(data, race_name, year)
                slug = _slug_from_race(race_name)
                out_file = out / f"{slug}_{year}.json"
                out_file.write_text(json.dumps(payload, indent=2))
                print(f"Wrote {out_file}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

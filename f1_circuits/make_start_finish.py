#!/usr/bin/env python3
"""
make_start_finish.py
Creates ONLY start_finish{suffix}.geojson in each circuit's layers/ folder.
Does NOT touch corners, sectors, drs, or pit files.

Run from f1_circuits folder:
    cd ~/Downloads/f1_circuits
    python make_start_finish.py
"""

import json
from pathlib import Path

# folder, suffix  (must match your actual folder names)
CIRCUITS = [
    ("abu_dhabi",     "_v1"),
    ("abu_dhabi",     "_v2"),
    ("melbourne",     "_v1"),
    ("melbourne",     "_v2"),
    ("red_bull_ring", ""),
    ("baku",          ""),
    ("bahrain",       ""),
    ("sakhir",        ""),
    ("spa",           ""),
    ("silverstone",   ""),
    ("montreal",      ""),
    ("china",         ""),
    ("zandvoort",     ""),
    ("imola",         ""),
    ("hockenheim",    ""),
    ("hungaroring",   ""),
    ("monza",         ""),
    ("suzuka",        ""),
    ("jeddah",        ""),
    ("las_vegas",     ""),
    ("lusail",        ""),
    ("mexico_city",   ""),
    ("miami",         ""),
    ("monaco",        ""),
    ("mugello",       ""),
    ("nurburgring",   ""),
    ("paul_ricard",   ""),
    ("portimao",      ""),
    ("sochi",         ""),
    ("sao_paulo",     ""),
    ("singapore",     "_v1"),
    ("singapore",     "_v2"),
    ("barcelona",     "_v1"),
    ("barcelona",     "_v2"),
    ("istanbul",      ""),
    ("cota",          ""),
]

def make_geojson(folder, suffix):
    return {
        "type": "FeatureCollection",
        "_layer": "start_finish",
        "_note": (
            "Single Point. Place exactly on the painted start/finish line "
            "on the track centreline in QGIS. Not the pit exit, not the grid "
            "boxes — the actual line on the tarmac."
        ),
        "features": [
            {
                "type": "Feature",
                "id": "start_finish_line",
                "properties": {
                    "type": "start_finish_line",
                    "circuit_folder": folder,
                    "notes": "Place on painted start/finish line, centreline"
                },
                "geometry": {"type": "Point", "coordinates": []}
            }
        ]
    }


base = Path(".")
print(f"\n{'═'*55}")
print(f"  Start/Finish Layer Generator")
print(f"  {len(CIRCUITS)} circuits | {base.resolve()}")
print(f"{'═'*55}\n")

created = skipped = already = 0

for folder, suffix in CIRCUITS:
    circuit_dir = base / folder
    if not circuit_dir.exists():
        print(f"  ⚠  Not found: {folder}/ — skipping")
        skipped += 1
        continue

    layers_dir = circuit_dir / "layers"
    layers_dir.mkdir(parents=True, exist_ok=True)

    fname = f"start_finish{suffix}.geojson"
    path  = layers_dir / fname

    if path.exists():
        print(f"  —  Already exists: {folder}/layers/{fname} — skipping")
        already += 1
        continue

    geojson = make_geojson(folder, suffix)
    path.write_text(json.dumps(geojson, indent=2))
    print(f"  ✓  Created: {folder}/layers/{fname}")
    created += 1

print(f"\n{'═'*55}")
print(f"  Created: {created}  |  Already existed: {already}  |  Skipped: {skipped}")
print(f"{'═'*55}\n")

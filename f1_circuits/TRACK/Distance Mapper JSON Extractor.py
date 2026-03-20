"""
Distance Mapper + Schema Builder
=================================
Combines:
  1. Existing centerline JSON  (GPS + basic structure)
  2. Extracted PDF data        (pit lane, metadata)
  3. FIA annotation YAML       (DRS refs, marshal posts, corners, sectors)

→ Outputs a fully enriched track JSON (schema v3.0)
"""

import json
import sys
import re
from pathlib import Path
from dataclasses import asdict

# Local imports
sys.path.insert(0, str(Path(__file__).parent))
from centerline_engine import Centerline, centerline_from_json
from extract_pdf import extract_from_pdf, ExtractedPDFData

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


# ─────────────────────────────────────────────────────────────
# YAML loader fallback (if PyYAML not installed, use regex)
# ─────────────────────────────────────────────────────────────

def load_yaml(path: str) -> dict:
    if HAS_YAML:
        with open(path) as f:
            return yaml.safe_load(f)
    # Minimal YAML-ish parser for our specific annotation format
    # (Only handles the subset we use: dicts, lists, strings, ints, bools)
    import ast
    with open(path) as f:
        content = f.read()
    # Strip comments
    lines = [l for l in content.split('\n') if not l.strip().startswith('#') and l.strip()]
    # Re-join and use PyYAML-like parsing via json where possible
    # Fallback: return raw content for manual inspection
    return {"_raw": content, "_error": "PyYAML not available - install pyyaml"}


# ─────────────────────────────────────────────────────────────
# Corner distance estimator
# ─────────────────────────────────────────────────────────────

def estimate_corner_distances(
    centerline: Centerline,
    corners_raw: list[dict],  # from original JSON with "index" field
) -> dict[int, float]:
    """
    Build a map of {turn_number: cumulative_distance_m} using
    the centerline index stored in the existing JSON corners array.
    """
    result = {}
    for corner in corners_raw:
        turn_num = corner["number"]
        idx = corner["index"]
        dist = centerline.distance_at_index(idx)
        result[turn_num] = dist
    return result


# ─────────────────────────────────────────────────────────────
# Core builder
# ─────────────────────────────────────────────────────────────

def build_enriched_track(
    base_json_path: str,
    pdf_path: str,
    annotation_yaml_path: str,
    output_path: str,
) -> dict:
    print("\n" + "="*60)
    print("  FIA Track Pipeline — Bahrain 2025")
    print("="*60)

    # ── 1. Load base centerline JSON ────────────────────────────
    print("\n[1/5] Loading base centerline JSON...")
    with open(base_json_path) as f:
        base = json.load(f)

    centerline = centerline_from_json(base)
    print(f"      {centerline.n} centerline points loaded")

    # ── 2. Compute corner distances ─────────────────────────────
    print("\n[2/5] Computing corner distances from centerline indices...")
    corner_distances = estimate_corner_distances(centerline, base["corners"])

    corner_table = []
    for turn_num, dist_m in sorted(corner_distances.items()):
        idx = next(c["index"] for c in base["corners"] if c["number"] == turn_num)
        lon, lat = centerline.gps_at_index(idx)
        corner_table.append({
            "number": turn_num,
            "distance_from_start_m": round(dist_m, 1),
            "distance_from_start_km": round(dist_m / 1000, 4),
            "centerline_index": idx,
            "lon": lon,
            "lat": lat,
        })
        print(f"      T{turn_num:2d}  →  {dist_m/1000:.4f} km  (idx {idx:3d})  "
              f"[{lat:.6f}, {lon:.6f}]")

    # ── 3. Extract PDF data ─────────────────────────────────────
    print("\n[3/5] Extracting data from FIA PDF...")
    pdf_data = extract_from_pdf(pdf_path)
    print(f"      GP: {pdf_data.metadata.grand_prix_name} {pdf_data.metadata.year}")
    print(f"      Race Director: {pdf_data.metadata.race_director}")
    print(f"      Garages parsed: {len(pdf_data.pit_lane.garages)}")
    print(f"      ERS GPS: {pdf_data.ers_containment.gps_lat}, {pdf_data.ers_containment.gps_lon}")

    # ── 4. Load annotation YAML ─────────────────────────────────
    print("\n[4/5] Loading FIA annotation file...")
    ann = load_yaml(annotation_yaml_path)

    if "_error" in ann:
        print(f"      ⚠️  {ann['_error']}")
        print("         Using built-in Bahrain 2025 annotations instead...")
        ann = get_bahrain_2025_annotations()
    else:
        print(f"      Circuit: {ann['circuit']['name']}")
        print(f"      DRS zones: {len(ann['drs_zones'])}")
        print(f"      Marshal posts: {len(ann['marshal_posts'])}")

    # ── 5. Map all FIA references → GPS coordinates ─────────────
    print("\n[5/5] Mapping FIA distance references to GPS coordinates...")

    # Speed trap
    speed_trap_info = None
    if "speed_trap" in ann:
        st = ann["speed_trap"]
        resolved = centerline.resolve_fia_reference(st["reference"], corner_distances)
        speed_trap_info = {
            "fia_reference": st["reference"],
            **resolved
        }
        print(f"      Speed trap: {st['reference']} → km {resolved['distance_from_start_km']:.4f}")

    # Sector boundaries
    sector_start_finish_m = 0.0
    sectors_out = []
    for i, s in enumerate(ann["sectors"]):
        start_ref = s["start_reference"]
        end_ref = s["end_reference"]

        sf_resolved = {
            "reference": "start_finish",
            "distance_from_start_m": 0.0,
            "distance_from_start_km": 0.0,
            "centerline_index": 0,
            "lon": centerline.gps_at_index(0)[0],
            "lat": centerline.gps_at_index(0)[1],
        }

        start_resolved = sf_resolved if start_ref == "start_finish" else \
            centerline.resolve_fia_reference(start_ref, corner_distances)
        end_resolved = sf_resolved if end_ref == "start_finish" else \
            centerline.resolve_fia_reference(end_ref, corner_distances)

        sector_length_m = (end_resolved["distance_from_start_m"] -
                           start_resolved["distance_from_start_m"])
        if sector_length_m < 0:
            sector_length_m += centerline.total_length_m

        sectors_out.append({
            "number": s["number"],
            "start": start_resolved,
            "end": end_resolved,
            "length_m": round(sector_length_m, 1),
            "length_km": round(sector_length_m / 1000, 4),
        })
        print(f"      S{s['number']}: {start_ref}  →  {end_ref}  ({sector_length_m/1000:.3f} km)")

    # DRS zones
    drs_zones_out = []
    for dz in ann["drs_zones"]:
        det = centerline.resolve_fia_reference(dz["detection_reference"], corner_distances)
        act = centerline.resolve_fia_reference(dz["activation_reference"], corner_distances)

        # Zone length = from activation to end_turn (if given)
        zone_length_m = None
        if "end_turn" in dz and dz["end_turn"] in corner_distances:
            end_dist = corner_distances[dz["end_turn"]]
            zone_length_m = round(end_dist - act["distance_from_start_m"], 1)
            if zone_length_m < 0:
                zone_length_m += centerline.total_length_m

        drs_zones_out.append({
            "zone_number": dz["zone_number"],
            "straight": dz.get("straight", ""),
            "notes": dz.get("notes", ""),
            "detection": {
                "fia_reference": dz["detection_reference"],
                **det,
            },
            "activation": {
                "fia_reference": dz["activation_reference"],
                **act,
            },
            "approx_zone_length_m": zone_length_m,
        })
        print(f"      DRS {dz['zone_number']}: detect @ km {det['distance_from_start_km']:.4f}  "
              f"→  activate @ km {act['distance_from_start_km']:.4f}")

    # Corners (enriched with annotation data)
    corners_out = []
    ann_corners = {c["number"]: c for c in ann.get("corners", [])}
    for ct in corner_table:
        n = ct["number"]
        ann_c = ann_corners.get(n, {})
        corners_out.append({
            **ct,
            "name": f"Turn {n}",
            "type": ann_c.get("type", "unknown"),
            "direction": ann_c.get("direction", "unknown"),
            "sector": ann_c.get("sector", None),
            "sector_boundary": ann_c.get("sector_boundary", False),
        })

    # Marshal posts (with approximate GPS from nearest corner distance)
    marshal_posts_out = []
    for mp in ann.get("marshal_posts", []):
        # Marshal post IDs encode approx km distance: "M1.3" = ~1.3 km
        mp_id = mp["id"]
        dist_km_str = mp_id.replace("M", "")
        try:
            dist_km = float(dist_km_str)
            dist_m = dist_km * 1000
            lon, lat = centerline.gps_at_distance(dist_m)
            idx = centerline.index_at_distance(dist_m)
            marshal_posts_out.append({
                "id": mp_id,
                "estimated_distance_km": dist_km,
                "centerline_index": idx,
                "lon": lon,
                "lat": lat,
                "sector": mp.get("sector"),
                "near_turn": mp.get("near_turn"),
            })
        except ValueError:
            marshal_posts_out.append({"id": mp_id, "sector": mp.get("sector")})

    # Pit lane garages
    garages_out = []
    for g in pdf_data.pit_lane.garages:
        garages_out.append({
            "bay": g.bay,
            "team": g.team,
        })

    # ── 6. Assemble final schema ─────────────────────────────────
    enriched = {
        "_schema_version": "3.0",
        "_generated_by": "FIA Track Pipeline",
        "_sources": {
            "centerline": base.get("source", {}),
            "fia_document": {
                "title": "Event Notes - Circuit Map, Pit Lane, Quarantine Zone and Red Zones",
                "document_number": pdf_data.metadata.document_number,
                "date": pdf_data.metadata.document_date,
                "race_director": pdf_data.metadata.race_director,
                "event": f"{pdf_data.metadata.grand_prix_name} {pdf_data.metadata.year}",
                "dates": pdf_data.metadata.dates,
            }
        },

        "track": {
            "name": ann["circuit"]["name"],
            "location": ann["circuit"]["location"],
            "layout_id": base.get("layout_id"),
            "year": ann["circuit"]["year"],
            "lap_distance_km": ann["circuit"]["lap_distance_km"],
            "centerline_measured_km": round(centerline.total_length_km, 4),
            "direction": ann["circuit"]["direction"],
            "track_width_m": ann["circuit"]["track_width_m"],
            "number_of_corners": ann["circuit"]["number_of_corners"],
        },

        "centerline": {
            "point_count": centerline.n,
            "geojson": base["geojson"],
            "distance_table": centerline.export_distance_table(),
        },

        "sectors": sectors_out,
        "corners": corners_out,
        "drs_zones": drs_zones_out,
        "speed_trap": speed_trap_info,
        "marshal_posts": marshal_posts_out,

        "pit_lane": {
            "entry_centerline_index": base["pit_lane"]["entry_index"],
            "exit_centerline_index": base["pit_lane"]["exit_index"],
            "pole_side": pdf_data.pit_lane.pole_side,
            "fast_lane_present": pdf_data.pit_lane.fast_lane_present,
            "garages": garages_out,
        },

        "ers_containment_area": {
            "location": pdf_data.ers_containment.location_description,
            "gps_lat": pdf_data.ers_containment.gps_lat,
            "gps_lon": pdf_data.ers_containment.gps_lon,
            "contact": {
                "name": pdf_data.ers_containment.contact_name,
                "mobile": pdf_data.ers_containment.contact_mobile,
                "email": pdf_data.ers_containment.contact_email,
            }
        },

        "emergency_exits": ann.get("emergency_exits", []),
    }

    # Write output
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(enriched, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  ✓  Enriched JSON written to: {output_path}")
    print(f"  Corners:       {len(corners_out)}")
    print(f"  DRS zones:     {len(drs_zones_out)}")
    print(f"  Sectors:       {len(sectors_out)}")
    print(f"  Marshal posts: {len(marshal_posts_out)}")
    print(f"  Garages:       {len(garages_out)}")
    print(f"{'='*60}\n")

    return enriched


# ─────────────────────────────────────────────────────────────
# Built-in Bahrain annotations (used if PyYAML not available)
# ─────────────────────────────────────────────────────────────

def get_bahrain_2025_annotations() -> dict:
    return {
        "circuit": {
            "name": "Bahrain International Circuit",
            "location": "Sakhir, Bahrain",
            "layout_id": "bh-2002",
            "year": 2025,
            "lap_distance_km": 5.412,
            "direction": "clockwise",
            "track_width_m": 12,
            "number_of_corners": 15,
        },
        "speed_trap": {"reference": "158m before T1"},
        "sectors": [
            {"number": 1, "start_reference": "start_finish", "end_reference": "At T5"},
            {"number": 2, "start_reference": "At T5", "end_reference": "110m before T14"},
            {"number": 3, "start_reference": "110m before T14", "end_reference": "start_finish"},
        ],
        "drs_zones": [
            {
                "zone_number": 1,
                "detection_reference": "50m before T1",
                "activation_reference": "23m after T3",
                "end_turn": 4,
                "straight": "Back Straight",
                "notes": "Runs T3-T4 section",
            },
            {
                "zone_number": 2,
                "detection_reference": "10m before T9",
                "activation_reference": "50m after T10",
                "end_turn": 11,
                "straight": "Sector 2 straight",
                "notes": "Short DRS window T9-T10",
            },
            {
                "zone_number": 3,
                "detection_reference": "110m before T14",
                "activation_reference": "170m after T15",
                "end_turn": 1,
                "straight": "Main Straight",
                "notes": "Longest DRS zone, main straight",
            },
        ],
        "marshal_posts": [
            {"id": "M0.7", "sector": 1, "near_turn": None},
            {"id": "M1.1", "sector": 1, "near_turn": 1},
            {"id": "M1.3", "sector": 1, "near_turn": 1},
            {"id": "M2.0", "sector": 1, "near_turn": 2},
            {"id": "M3.0", "sector": 1, "near_turn": None},
            {"id": "M3.3", "sector": 1, "near_turn": None},
            {"id": "M3.5", "sector": 1, "near_turn": None},
            {"id": "M3.8", "sector": 1, "near_turn": 4},
            {"id": "M4.1", "sector": 1, "near_turn": 4},
            {"id": "M6.0", "sector": 2, "near_turn": 5},
            {"id": "M6.3", "sector": 2, "near_turn": 6},
            {"id": "M7.2", "sector": 2, "near_turn": 7},
            {"id": "M8.1", "sector": 2, "near_turn": 8},
            {"id": "M8.5", "sector": 2, "near_turn": None},
            {"id": "M8.7", "sector": 2, "near_turn": None},
            {"id": "M9.0", "sector": 2, "near_turn": 9},
            {"id": "M10.0", "sector": 2, "near_turn": None},
            {"id": "M10.2", "sector": 2, "near_turn": None},
            {"id": "M10.5", "sector": 2, "near_turn": 10},
            {"id": "M10.8", "sector": 2, "near_turn": None},
            {"id": "M11.4", "sector": 2, "near_turn": None},
            {"id": "M12.1", "sector": 2, "near_turn": None},
            {"id": "M12.5", "sector": 2, "near_turn": 12},
            {"id": "M13.0", "sector": 3, "near_turn": None},
            {"id": "M13.1", "sector": 3, "near_turn": 13},
            {"id": "M13.5", "sector": 3, "near_turn": None},
            {"id": "M13.6", "sector": 3, "near_turn": None},
            {"id": "M13.8", "sector": 3, "near_turn": None},
            {"id": "M13.9", "sector": 3, "near_turn": None},
            {"id": "M14.1", "sector": 3, "near_turn": 14},
            {"id": "M15.1", "sector": 3, "near_turn": 15},
            {"id": "M15.2", "sector": 3, "near_turn": 15},
        ],
        "corners": [
            {"number": 1,  "type": "medium",   "direction": "right", "sector": 1},
            {"number": 2,  "type": "tight",    "direction": "left",  "sector": 1},
            {"number": 3,  "type": "medium",   "direction": "right", "sector": 1},
            {"number": 4,  "type": "fast",     "direction": "right", "sector": 1},
            {"number": 5,  "type": "tight",    "direction": "left",  "sector": 1, "sector_boundary": True},
            {"number": 6,  "type": "tight",    "direction": "right", "sector": 2},
            {"number": 7,  "type": "medium",   "direction": "left",  "sector": 2},
            {"number": 8,  "type": "medium",   "direction": "right", "sector": 2},
            {"number": 9,  "type": "hairpin",  "direction": "left",  "sector": 2},
            {"number": 10, "type": "medium",   "direction": "right", "sector": 2},
            {"number": 11, "type": "medium",   "direction": "right", "sector": 2},
            {"number": 12, "type": "medium",   "direction": "left",  "sector": 2},
            {"number": 13, "type": "fast",     "direction": "right", "sector": 3},
            {"number": 14, "type": "tight",    "direction": "left",  "sector": 3},
            {"number": 15, "type": "tight",    "direction": "right", "sector": 3},
        ],
        "emergency_exits": [
            {"number": 1,  "near_turn": None, "side": "right"},
            {"number": 2,  "near_turn": 2,    "side": "right"},
            {"number": 3,  "near_turn": 3,    "side": "right"},
            {"number": 4,  "near_turn": 4,    "side": "right"},
            {"number": 5,  "near_turn": 5,    "side": "left"},
            {"number": 6,  "near_turn": 6,    "side": "right"},
            {"number": 7,  "near_turn": 7,    "side": "right"},
            {"number": 8,  "near_turn": 8,    "side": "left"},
            {"number": 9,  "near_turn": 9,    "side": "right"},
            {"number": 10, "near_turn": 10,   "side": "right", "type": "drive_in_refuge"},
            {"number": 11, "near_turn": 11,   "side": "left"},
            {"number": 12, "near_turn": 12,   "side": "right", "type": "drive_in_refuge"},
            {"number": 13, "near_turn": 13,   "side": "right", "type": "drive_in_refuge"},
            {"number": 14, "near_turn": 14,   "side": "right"},
            {"number": 15, "near_turn": 15,   "side": "left"},
        ],
    }


if __name__ == "__main__":
    result = build_enriched_track(
        base_json_path="/mnt/user-data/uploads/bahrain_grand_prix_2025.json",
        pdf_path="/mnt/user-data/uploads/2025_Bahrain_.pdf",
        annotation_yaml_path="/home/claude/fia_track_pipeline/annotations/bahrain_2025.yaml",
        output_path="/mnt/user-data/outputs/bahrain_2025_enriched.json",
    )

#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import shutil
import unicodedata
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from render_36_layout_pngs import (
    CIRCUITS_DIR,
    FORCE_CORNER_LOOP_LAYOUTS,
    FORCE_USE_ALL_LINES_LAYOUTS,
    PREFER_ALT_PATH_PAIRS,
    LayoutSpec,
    chaikin_closed,
    choose_main_component,
    collect_layouts,
    connected_components,
    dedupe_points,
    edge_key,
    euclid,
    extract_corner_anchors,
    extract_drs_lines,
    extract_line_buckets,
    extract_pit_line,
    extract_raceway_polygon_rings,
    extract_sector_points,
    find_layer_file,
    find_raw_file,
    flatten_lines,
    is_valid_coord,
    nearest_node,
    path_length,
    project_lonlat,
    quantize,
    read_geojson,
    route_main_loop,
    shortest_path,
    subgraph,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "backend" / "etl" / "data" / "track_geometry"
OLD_CANONICAL = ROOT / "backend" / "etl" / "data" / "track_geometry_canonical"
SILVER_DIR = ROOT / "backend" / "etl" / "data" / "silver"


OLD_FILE_TO_LAYOUT: Dict[str, str] = {
    "abu_dhabi_grand_prix_old.json": "abu_dhabi_v1",
    "abu_dhabi_grand_prix_new.json": "abu_dhabi_v2",
    "australian_grand_prix_old.json": "melbourne_v1",
    "australian_grand_prix_new.json": "melbourne_v2",
    "austrian_grand_prix.json": "red_bull_ring_v1",
    "styrian_grand_prix.json": "red_bull_ring_v1",
    "azerbaijan_grand_prix.json": "baku_v1",
    "bahrain_grand_prix.json": "bahrain_v1",
    "sakhir_grand_prix.json": "sakhir_v1",
    "belgian_grand_prix.json": "spa_v1",
    "brazilian_grand_prix.json": "sao_paulo_v1",
    "sao_paulo_grand_prix.json": "sao_paulo_v1",
    "british_grand_prix.json": "silverstone_v1",
    "70th_anniversary_grand_prix.json": "silverstone_v1",
    "anniversary_grand_prix.json": "silverstone_v1",
    "canadian_grand_prix.json": "montreal_v1",
    "chinese_grand_prix.json": "china_v1",
    "eifel_grand_prix.json": "nurburgring_v1",
    "emilia_romagna_grand_prix.json": "imola_v1",
    "french_grand_prix.json": "paul_ricard_v1",
    "german_grand_prix.json": "hockenheim_v1",
    "hungarian_grand_prix.json": "hungaroring_v1",
    "italian_grand_prix.json": "monza_v1",
    "japanese_grand_prix.json": "suzuka_v1",
    "las_vegas_grand_prix.json": "las_vegas_v1",
    "mexican_grand_prix.json": "mexico_city_v1",
    "miami_grand_prix.json": "miami_v1",
    "monaco_grand_prix.json": "monaco_v1",
    "portuguese_grand_prix.json": "portimao_v1",
    "qatar_grand_prix.json": "lusail_v1",
    "russian_grand_prix.json": "sochi_v1",
    "saudi_arabian_grand_prix.json": "jeddah_v1",
    "singapore_grand_prix_old.json": "singapore_v1",
    "singapore_grand_prix_new.json": "singapore_v2",
    "spanish_grand_prix_old.json": "barcelona_v1",
    "spanish_grand_prix_new.json": "barcelona_v2",
    "turkish_grand_prix.json": "istanbul_v1",
    "tuscan_grand_prix.json": "mugello_v1",
    "united_states_grand_prix.json": "cota_v1",
    "dutch_grand_prix.json": "zandvoort_v1",
}

RACE_TO_LAYOUT: Dict[str, str] = {
    "70th anniversary grand prix": "silverstone_v1",
    "abu dhabi grand prix": "abu_dhabi_v1",
    "anniversary grand prix": "silverstone_v1",
    "australian grand prix": "melbourne_v1",
    "austrian grand prix": "red_bull_ring_v1",
    "azerbaijan grand prix": "baku_v1",
    "bahrain grand prix": "bahrain_v1",
    "belgian grand prix": "spa_v1",
    "brazilian grand prix": "sao_paulo_v1",
    "british grand prix": "silverstone_v1",
    "canadian grand prix": "montreal_v1",
    "chinese grand prix": "china_v1",
    "dutch grand prix": "zandvoort_v1",
    "eifel grand prix": "nurburgring_v1",
    "emilia romagna grand prix": "imola_v1",
    "french grand prix": "paul_ricard_v1",
    "german grand prix": "hockenheim_v1",
    "hungarian grand prix": "hungaroring_v1",
    "italian grand prix": "monza_v1",
    "japanese grand prix": "suzuka_v1",
    "las vegas grand prix": "las_vegas_v1",
    "mexican grand prix": "mexico_city_v1",
    "mexico city grand prix": "mexico_city_v1",
    "miami grand prix": "miami_v1",
    "monaco grand prix": "monaco_v1",
    "portuguese grand prix": "portimao_v1",
    "qatar grand prix": "lusail_v1",
    "russian grand prix": "sochi_v1",
    "sakhir grand prix": "sakhir_v1",
    "sao paulo grand prix": "sao_paulo_v1",
    "saudi arabian grand prix": "jeddah_v1",
    "singapore grand prix": "singapore_v1",
    "spanish grand prix": "barcelona_v1",
    "styrian grand prix": "red_bull_ring_v1",
    "turkish grand prix": "istanbul_v1",
    "tuscan grand prix": "mugello_v1",
    "united states grand prix": "cota_v1",
}


def to_lon_lat(point_xy: Tuple[float, float], lon_scale: float) -> List[float]:
    return [point_xy[0] / lon_scale, point_xy[1]]


def normalize_key(value: str) -> str:
    value = (value or "").replace("-", " ").replace("_", " ").strip().lower()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = " ".join(value.split())
    return value


def iter_valid_coords_from_geometry(geometry: Optional[dict]) -> Iterable[Sequence[float]]:
    if not geometry:
        return
    coords = geometry.get("coordinates")
    if coords is None:
        return

    stack: List[object] = [coords]
    while stack:
        cur = stack.pop()
        if is_valid_coord(cur):
            yield cur  # type: ignore[misc]
            continue
        if isinstance(cur, (list, tuple)):
            for item in cur:
                stack.append(item)


def nearest_idx(poly: Sequence[Tuple[float, float]], point: Tuple[float, float]) -> int:
    best = 0
    best_d = float("inf")
    for i, p in enumerate(poly):
        d = (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2
        if d < best_d:
            best_d = d
            best = i
    return best


def cyc_dist(n: int, i0: int, i1: int) -> int:
    return (i1 - i0) % n


def parse_point_features(
    fc: Optional[dict],
    type_key: str,
    allowed_tokens: Sequence[str],
    lon_scale: float,
) -> Dict[int, Tuple[float, float]]:
    out: Dict[int, Tuple[float, float]] = {}
    if not fc:
        return out
    for feat in fc.get("features", []):
        geom = feat.get("geometry")
        if not geom or geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates")
        if not is_valid_coord(coords):
            continue
        props = feat.get("properties") or {}
        token_source = f"{props.get(type_key, '')} {props.get('type', '')} {props.get('feature_type', '')} {props.get('id', '')}".lower()
        if not any(tok in token_source for tok in allowed_tokens):
            continue
        zone_raw = props.get("zone")
        try:
            zone = int(zone_raw)
        except Exception:
            zone = 1
        out[zone] = project_lonlat(coords, lon_scale)
    return out


def extract_explicit_pit_points(pit_geo: Optional[dict], lon_scale: float) -> Tuple[Optional[Tuple[float, float]], Optional[Tuple[float, float]]]:
    pit_in: Optional[Tuple[float, float]] = None
    pit_out: Optional[Tuple[float, float]] = None
    if not pit_geo:
        return pit_in, pit_out

    for feat in pit_geo.get("features", []):
        geom = feat.get("geometry")
        if not geom or geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates")
        if not is_valid_coord(coords):
            continue
        props = feat.get("properties") or {}
        token = f"{props.get('id', '')} {props.get('type', '')} {props.get('notes', '')}".lower()
        pt = project_lonlat(coords, lon_scale)
        if "pit_entry" in token or "pit entry" in token or "pit in" in token:
            pit_in = pt
        if "pit_exit" in token or "pit exit" in token or "pit out" in token:
            pit_out = pt
    return pit_in, pit_out


def compute_loop(spec: LayoutSpec, raw_geo: dict, lon_scale: float, anchors: List[Tuple[int, Tuple[float, float]]]) -> List[Tuple[float, float]]:
    if spec.layout_id in FORCE_CORNER_LOOP_LAYOUTS and anchors:
        return chaikin_closed([pt for _, pt in anchors], rounds=3)

    loop: List[Tuple[float, float]] = []
    raceway_lines, all_lines = extract_line_buckets(raw_geo)
    if spec.layout_id in FORCE_USE_ALL_LINES_LAYOUTS:
        raw_lines = all_lines
    else:
        raw_lines = raceway_lines if raceway_lines else all_lines

    if anchors and len(raw_lines) < max(4, int(0.35 * len(anchors))):
        raw_lines = []

    lines_xy: List[List[Tuple[float, float]]] = []
    for line in raw_lines:
        valid = [p for p in line if is_valid_coord(p)]
        if len(valid) >= 2:
            lines_xy.append([project_lonlat(p, lon_scale) for p in valid])

    if lines_xy:
        nodes, adj = build_graph(lines_xy)
        if nodes:
            keep = choose_main_component(nodes, adj, anchors)
            nodes, adj = subgraph(nodes, adj, keep)
            loop = route_main_loop(spec.layout_id, nodes, adj, anchors)

    if len(loop) < 2:
        rings = extract_raceway_polygon_rings(raw_geo, lon_scale)
        if rings:
            loop = max(rings, key=lambda r: sum(euclid(r[i], r[i + 1]) for i in range(len(r) - 1)))

    if len(loop) < 2 and anchors:
        loop = chaikin_closed([pt for _, pt in anchors], rounds=3)

    loop = dedupe_points(loop)
    if loop and euclid(loop[0], loop[-1]) > 1e-9:
        loop.append(loop[0])
    return loop


def build_graph(lines_xy: List[List[Tuple[float, float]]]) -> Tuple[Dict[int, Tuple[float, float]], Dict[int, List[Tuple[int, float]]]]:
    node_map: Dict[Tuple[int, int], int] = {}
    nodes: Dict[int, Tuple[float, float]] = {}
    adj: Dict[int, List[Tuple[int, float]]] = {}

    def node_id(p: Tuple[float, float]) -> int:
        q = quantize(p)
        if q in node_map:
            return node_map[q]
        nid = len(node_map)
        node_map[q] = nid
        nodes[nid] = p
        adj[nid] = []
        return nid

    for line in lines_xy:
        for i in range(len(line) - 1):
            p0 = line[i]
            p1 = line[i + 1]
            w = euclid(p0, p1)
            if w <= 1e-12:
                continue
            n0 = node_id(p0)
            n1 = node_id(p1)
            adj[n0].append((n1, w))
            adj[n1].append((n0, w))

    return nodes, adj


def infer_layout_era(layout_id: str) -> str:
    if layout_id.endswith("_v2"):
        return "new"
    if layout_id in {"abu_dhabi_v1", "barcelona_v1", "singapore_v1", "melbourne_v1"}:
        return "old"
    return "single"


def build_layout_geometry(
    spec: LayoutSpec,
    metadata_by_layout: Dict[str, dict],
) -> dict:
    raw_geo = read_geojson(find_raw_file(spec))
    corners_geo = read_geojson(find_layer_file(spec, "corners")) if find_layer_file(spec, "corners") else None
    drs_geo = read_geojson(find_layer_file(spec, "drs")) if find_layer_file(spec, "drs") else None
    pit_geo = read_geojson(find_layer_file(spec, "pit")) if find_layer_file(spec, "pit") else None
    sectors_geo = read_geojson(find_layer_file(spec, "sectors")) if find_layer_file(spec, "sectors") else None

    all_coords: List[Sequence[float]] = []
    for feat in raw_geo.get("features", []):
        geom = feat.get("geometry")
        if not geom:
            continue
        all_coords.extend(iter_valid_coords_from_geometry(geom))
    if not all_coords and corners_geo:
        for feat in corners_geo.get("features", []):
            geom = feat.get("geometry")
            if not geom:
                continue
            all_coords.extend(iter_valid_coords_from_geometry(geom))
    if not all_coords:
        raise RuntimeError(f"No coordinates in raw source for {spec.layout_id}")

    mean_lat = sum(float(c[1]) for c in all_coords) / len(all_coords)
    lon_scale = math.cos(math.radians(mean_lat))
    anchors = extract_corner_anchors(corners_geo, lon_scale)
    loop = compute_loop(spec, raw_geo, lon_scale, anchors)
    if len(loop) < 3:
        raise RuntimeError(f"Could not build centerline loop for {spec.layout_id}")

    open_loop = loop[:-1] if euclid(loop[0], loop[-1]) <= 1e-9 else loop
    if len(open_loop) < 3:
        raise RuntimeError(f"Centerline too short for {spec.layout_id}")
    centerline = [to_lon_lat(p, lon_scale) for p in open_loop]
    centerline.append(centerline[0])

    open_len = len(open_loop)

    if anchors:
        c1_point = next((pt for num, pt in anchors if num == 1), anchors[0][1])
        c1_idx = nearest_idx(open_loop, c1_point)
        start_idx = (c1_idx - max(1, int(open_len * 0.015))) % open_len
    else:
        c1_idx = 0
        start_idx = 0

    corners = []
    for cnum, pt in anchors:
        idx = nearest_idx(open_loop, pt)
        corners.append(
            {
                "number": int(cnum),
                "name": f"Turn {int(cnum)}",
                "index": int(idx),
                "apex": to_lon_lat(pt, lon_scale),
                "angle": 90,
            }
        )
    corners.sort(key=lambda c: c["number"])

    sector_pts, speed_trap_pt = extract_sector_points(sectors_geo, lon_scale)
    s1_idx = nearest_idx(open_loop, sector_pts[1]) if 1 in sector_pts else int(round(open_len * 0.33))
    s2_idx = nearest_idx(open_loop, sector_pts[2]) if 2 in sector_pts else int(round(open_len * 0.66))
    if cyc_dist(open_len, start_idx, s2_idx) < cyc_dist(open_len, start_idx, s1_idx):
        s1_idx, s2_idx = s2_idx, s1_idx

    sectors = {
        "sector1": {"endIndex": int(s1_idx), "name": "Sector 1", "color": "#FF6464"},
        "sector2": {"endIndex": int(s2_idx), "name": "Sector 2", "color": "#64FF64"},
        "sector3": {"endIndex": int(open_len), "name": "Sector 3", "color": "#6464FF"},
    }

    sector_timing_points = [
        {"name": "S1", "index": int(s1_idx), "point": centerline[int(s1_idx)]},
        {"name": "S2", "index": int(s2_idx), "point": centerline[int(s2_idx)]},
    ]
    if speed_trap_pt is not None:
        trap_idx = nearest_idx(open_loop, speed_trap_pt)
        sector_timing_points.append({"name": "T", "index": int(trap_idx), "point": centerline[int(trap_idx)]})

    drs_lines = extract_drs_lines(drs_geo, lon_scale)
    drs_detection_pts = parse_point_features(drs_geo, "feature_type", ("detection",), lon_scale)
    drs_activation_pts = parse_point_features(drs_geo, "feature_type", ("activation",), lon_scale)
    all_drs_zones = set(drs_lines.keys()) | set(drs_detection_pts.keys()) | set(drs_activation_pts.keys())
    drs_zones = []
    drs_detection_points = []
    for zone in sorted(all_drs_zones):
        line = drs_lines.get(zone)
        if line and len(line) >= 2:
            start_idx_z = nearest_idx(open_loop, line[0])
            end_idx_z = nearest_idx(open_loop, line[-1])
            if cyc_dist(open_len, start_idx_z, end_idx_z) > open_len // 2:
                start_idx_z, end_idx_z = end_idx_z, start_idx_z
        elif zone in drs_activation_pts and zone in drs_detection_pts:
            start_idx_z = nearest_idx(open_loop, drs_activation_pts[zone])
            end_idx_z = nearest_idx(open_loop, drs_detection_pts[zone])
        else:
            continue

        detection_idx = None
        if zone in drs_detection_pts:
            detection_idx = nearest_idx(open_loop, drs_detection_pts[zone])
            drs_detection_points.append(
                {
                    "zone": int(zone),
                    "index": int(detection_idx),
                    "point": centerline[int(detection_idx)],
                }
            )
        drs_zones.append(
            {
                "zone_number": int(zone),
                "startIndex": int(start_idx_z),
                "endIndex": int(end_idx_z),
                "detectionIndex": int(detection_idx) if detection_idx is not None else None,
            }
        )

    pit_line = extract_pit_line(pit_geo, lon_scale)
    pit_line_lonlat = [to_lon_lat(p, lon_scale) for p in pit_line] if pit_line else []
    pit_in_pt, pit_out_pt = extract_explicit_pit_points(pit_geo, lon_scale)

    if pit_line and len(pit_line) >= 2:
        e0 = pit_line[0]
        e1 = pit_line[-1]
        if pit_in_pt is None and pit_out_pt is None:
            d0 = cyc_dist(open_len, start_idx, nearest_idx(open_loop, e0))
            d1 = cyc_dist(open_len, start_idx, nearest_idx(open_loop, e1))
            pit_out_pt, pit_in_pt = (e0, e1) if d0 <= d1 else (e1, e0)
        elif pit_in_pt is None:
            pit_in_pt = e0 if euclid(e0, pit_out_pt) > euclid(e1, pit_out_pt) else e1
        elif pit_out_pt is None:
            pit_out_pt = e0 if euclid(e0, pit_in_pt) > euclid(e1, pit_in_pt) else e1

    pit_entry_idx = nearest_idx(open_loop, pit_in_pt) if pit_in_pt is not None else None
    pit_exit_idx = nearest_idx(open_loop, pit_out_pt) if pit_out_pt is not None else None

    meta = metadata_by_layout.get(spec.layout_id, {})
    default_name = spec.layout_id.replace("_", " ").title()
    geo = {
        "name": meta.get("name", default_name),
        "country": meta.get("country", ""),
        "centerline": centerline,
        "corners": corners,
        "drsZones": drs_zones,
        "startPosition": centerline[start_idx],
        "startPositionIndex": int(start_idx),
        "start_finish": {"index": int(start_idx)},
        "pitEntry": centerline[pit_entry_idx] if pit_entry_idx is not None else None,
        "pitExit": centerline[pit_exit_idx] if pit_exit_idx is not None else None,
        "trackWidth": 12,
        "sectors": sectors,
        "geojson": {"layout_id": spec.layout_id},
        "source": "temp_track/f1_circuits",
        "pitLaneCenterline": pit_line_lonlat,
        "drsDetectionPoints": drs_detection_points,
        "marshalPanels": [],
        "sectorTimingPoints": sector_timing_points,
        "layoutYear": meta.get("layoutYear"),
        "layout_id": spec.layout_id,
        "pit_lane": {
            "entryIndex": int(pit_entry_idx) if pit_entry_idx is not None else None,
            "exitIndex": int(pit_exit_idx) if pit_exit_idx is not None else None,
            "centerline": pit_line_lonlat,
        },
        "pitLane": {
            "entryIndex": int(pit_entry_idx) if pit_entry_idx is not None else None,
            "exitIndex": int(pit_exit_idx) if pit_exit_idx is not None else None,
            "centerline": pit_line_lonlat,
        },
        "layoutEra": meta.get("layoutEra", infer_layout_era(spec.layout_id)),
    }
    return geo


def load_metadata_by_layout() -> Dict[str, dict]:
    metadata: Dict[str, dict] = {}
    if not OLD_CANONICAL.exists():
        if DEFAULT_OUT.exists():
            for p in DEFAULT_OUT.glob("*_v*.json"):
                try:
                    d = json.loads(p.read_text(encoding="utf-8"))
                except Exception:
                    continue
                lid = d.get("layout_id") or p.stem
                metadata[str(lid)] = {
                    "name": d.get("name"),
                    "country": d.get("country"),
                    "layoutYear": d.get("layoutYear"),
                    "layoutEra": d.get("layoutEra"),
                }
        return metadata

    by_layout_oldfile: Dict[str, str] = {}
    for old_file, layout_id in OLD_FILE_TO_LAYOUT.items():
        if layout_id not in by_layout_oldfile:
            by_layout_oldfile[layout_id] = old_file
    for layout_id, old_file in by_layout_oldfile.items():
        p = OLD_CANONICAL / old_file
        if not p.exists():
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        metadata[layout_id] = {
            "name": d.get("name"),
            "country": d.get("country"),
            "layoutYear": d.get("layoutYear"),
            "layoutEra": d.get("layoutEra"),
        }
    return metadata


def build_routing_from_silver() -> dict:
    routes: List[dict] = []
    if not SILVER_DIR.exists():
        raise RuntimeError(f"Missing silver directory: {SILVER_DIR}")

    for ydir in sorted([p for p in SILVER_DIR.iterdir() if p.is_dir()], key=lambda p: int(p.name)):
        year = int(ydir.name)
        for race_dir in sorted([p for p in ydir.iterdir() if p.is_dir()], key=lambda p: p.name):
            race_name = race_dir.name
            norm = normalize_key(race_name)
            layout_id = RACE_TO_LAYOUT.get(norm)

            # Handle post-2021 layout switches.
            if norm == "abu dhabi grand prix" and year >= 2021:
                layout_id = "abu_dhabi_v2"
            if norm == "singapore grand prix" and year >= 2023:
                layout_id = "singapore_v2"
            if norm == "spanish grand prix" and year >= 2023:
                layout_id = "barcelona_v2"
            if norm == "australian grand prix" and year >= 2022:
                layout_id = "melbourne_v2"

            if not layout_id:
                raise RuntimeError(f"No layout mapping for race '{race_name}' ({year})")

            routes.append(
                {
                    "race_key": race_name,
                    "year_from": year,
                    "year_to": year,
                    "file": f"{layout_id}.json",
                    "layout_id": layout_id,
                }
            )

    return {"routes": routes}


def build_layout_index(layout_ids: Sequence[str]) -> dict:
    layouts = []
    for lid in sorted(layout_ids):
        if lid.endswith("_v2"):
            version = "new"
        elif lid in {"abu_dhabi_v1", "barcelona_v1", "singapore_v1", "melbourne_v1"}:
            version = "old"
        else:
            version = "single"
        layouts.append(
            {
                "layout_id": lid,
                "file": f"{lid}.json",
                "track_key": lid.rsplit("_v", 1)[0],
                "version": version,
            }
        )
    return {"layouts": layouts}


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    out_dir = DEFAULT_OUT
    specs = collect_layouts(CIRCUITS_DIR)
    metadata = load_metadata_by_layout()

    tmp_dir = out_dir.with_name(f"{out_dir.name}_tmp")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    generated_layouts: List[str] = []
    for spec in specs:
        geo = build_layout_geometry(spec, metadata)
        write_json(tmp_dir / f"{spec.layout_id}.json", geo)
        generated_layouts.append(spec.layout_id)

    write_json(tmp_dir / "layout_index.json", build_layout_index(generated_layouts))
    write_json(tmp_dir / "session_routing_2018_2025.json", build_routing_from_silver())

    if out_dir.exists():
        shutil.rmtree(out_dir)
    tmp_dir.rename(out_dir)

    print(f"Generated {len(generated_layouts)} layouts at {out_dir}")


if __name__ == "__main__":
    main()

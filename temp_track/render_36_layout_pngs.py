#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
import shutil
from collections import defaultdict
from dataclasses import dataclass
from heapq import heappop, heappush
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle

ROOT = Path(__file__).resolve().parent
CIRCUITS_DIR = ROOT / "f1_circuits"
OUT_DIR = ROOT / "layout_pngs_36"
TMP_OUT_DIR = ROOT / "layout_pngs_36_tmp"

# Force this specific variant behavior requested by user feedback.
PREFER_ALT_PATH_PAIRS: Dict[str, set[Tuple[int, int]]] = {
    "barcelona_v2": {(13, 14)},
    "singapore_v1": {(23, 1)},
    "singapore_v2": {(19, 1)},
}

FORCE_USE_ALL_LINES_LAYOUTS = {
    "baku_v1",
    "las_vegas_v1",
    "monaco_v1",
    "singapore_v2",
}

FORCE_CORNER_LOOP_LAYOUTS = {
    "abu_dhabi_v1",
    "singapore_v1",
    "singapore_v2",
    "las_vegas_v1",
}


@dataclass
class LayoutSpec:
    layout_id: str
    circuit: str
    version: int


def read_geojson(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def project_lonlat(point: Sequence[float], lon_scale: float) -> Tuple[float, float]:
    lon, lat = float(point[0]), float(point[1])
    return lon * lon_scale, lat


def is_valid_coord(point: object) -> bool:
    if not isinstance(point, (list, tuple)):
        return False
    if len(point) < 2:
        return False
    try:
        float(point[0])
        float(point[1])
    except Exception:
        return False
    return True


def flatten_lines(geometry: dict) -> List[List[List[float]]]:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords:
        return []
    if gtype == "LineString":
        return [coords]
    if gtype == "MultiLineString":
        return list(coords)
    return []


def quantize(point: Tuple[float, float], scale: float = 1_000_000.0) -> Tuple[int, int]:
    return int(round(point[0] * scale)), int(round(point[1] * scale))


def edge_key(a: int, b: int) -> Tuple[int, int]:
    return (a, b) if a < b else (b, a)


def euclid(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


def shortest_path(
    adj: Dict[int, List[Tuple[int, float]]],
    start: int,
    goal: int,
    blocked: Optional[set[Tuple[int, int]]] = None,
) -> Optional[List[int]]:
    if start == goal:
        return [start]

    blocked = blocked or set()
    dist: Dict[int, float] = {start: 0.0}
    prev: Dict[int, int] = {}
    pq: List[Tuple[float, int]] = [(0.0, start)]

    while pq:
        d, u = heappop(pq)
        if d != dist.get(u):
            continue
        if u == goal:
            break
        for v, w in adj.get(u, []):
            if edge_key(u, v) in blocked:
                continue
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                prev[v] = u
                heappush(pq, (nd, v))

    if goal not in dist:
        return None

    path = [goal]
    cur = goal
    while cur != start:
        cur = prev[cur]
        path.append(cur)
    path.reverse()
    return path


def path_length(path: Sequence[int], nodes: Dict[int, Tuple[float, float]]) -> float:
    total = 0.0
    for i in range(len(path) - 1):
        total += euclid(nodes[path[i]], nodes[path[i + 1]])
    return total


def nearest_node(point: Tuple[float, float], node_ids: Iterable[int], nodes: Dict[int, Tuple[float, float]]) -> Tuple[int, float]:
    best_id = -1
    best_d = float("inf")
    px, py = point
    for nid in node_ids:
        nx, ny = nodes[nid]
        d = (nx - px) * (nx - px) + (ny - py) * (ny - py)
        if d < best_d:
            best_d = d
            best_id = nid
    return best_id, math.sqrt(best_d)


def connected_components(adj: Dict[int, List[Tuple[int, float]]]) -> List[List[int]]:
    seen = set()
    comps: List[List[int]] = []
    for node in adj.keys():
        if node in seen:
            continue
        stack = [node]
        seen.add(node)
        comp = []
        while stack:
            u = stack.pop()
            comp.append(u)
            for v, _ in adj.get(u, []):
                if v not in seen:
                    seen.add(v)
                    stack.append(v)
        comps.append(comp)
    return comps


def dedupe_points(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    if not points:
        return points
    out = [points[0]]
    for p in points[1:]:
        if euclid(p, out[-1]) > 1e-9:
            out.append(p)
    return out


def collect_layouts(root: Path) -> List[LayoutSpec]:
    layouts: List[LayoutSpec] = []
    for circuit_dir in sorted([p for p in root.iterdir() if p.is_dir()]):
        raw_dir = circuit_dir / "raw"
        if not raw_dir.exists():
            continue

        raw_geo = sorted(raw_dir.glob("*.geojson"))
        versions = sorted(
            {
                int(m.group(1))
                for p in raw_geo
                for m in [re.search(r"_v(\d+)\.geojson$", p.name)]
                if m
            }
        )

        if versions:
            for v in versions:
                layouts.append(LayoutSpec(f"{circuit_dir.name}_v{v}", circuit_dir.name, v))
        elif raw_geo:
            layouts.append(LayoutSpec(f"{circuit_dir.name}_v1", circuit_dir.name, 1))

    # Explicitly add Barcelona v1 (uses v2 raw centerline but v1 metadata layers).
    if not any(x.layout_id == "barcelona_v1" for x in layouts):
        bar = root / "barcelona"
        if (bar / "layers" / "corners_v1.geojson").exists():
            layouts.append(LayoutSpec("barcelona_v1", "barcelona", 1))

    layouts.sort(key=lambda x: x.layout_id)
    return layouts


def find_raw_file(spec: LayoutSpec) -> Path:
    raw_dir = CIRCUITS_DIR / spec.circuit / "raw"
    preferred = raw_dir / f"{spec.circuit}_v{spec.version}.geojson"
    if preferred.exists():
        return preferred

    # Requested fallback: barcelona_v1 should use v2 centerline.
    if spec.layout_id == "barcelona_v1":
        p = raw_dir / "barcelona_v2.geojson"
        if p.exists():
            return p

    generic = raw_dir / f"{spec.circuit}.geojson"
    if generic.exists():
        return generic

    any_geo = sorted(raw_dir.glob("*.geojson"))
    if not any_geo:
        raise FileNotFoundError(f"No raw geometry for {spec.layout_id}")
    return any_geo[0]


def find_layer_file(spec: LayoutSpec, layer_name: str) -> Optional[Path]:
    layers = CIRCUITS_DIR / spec.circuit / "layers"
    if not layers.exists():
        return None

    with_version = layers / f"{layer_name}_v{spec.version}.geojson"
    if with_version.exists():
        return with_version

    generic = layers / f"{layer_name}.geojson"
    if generic.exists():
        return generic

    return None


def extract_line_buckets(raw_geojson: dict) -> Tuple[List[List[List[float]]], List[List[List[float]]]]:
    raceway_lines: List[List[List[float]]] = []
    all_lines: List[List[List[float]]] = []

    for feat in raw_geojson.get("features", []):
        geom = feat.get("geometry")
        if not geom:
            continue
        prop = feat.get("properties") or {}
        lines = flatten_lines(geom)
        for line in lines:
            if len(line) < 2:
                continue
            all_lines.append(line)
            if str(prop.get("highway", "")).lower() == "raceway":
                raceway_lines.append(line)

    return raceway_lines, all_lines


def extract_main_track_lines(raw_geojson: dict) -> List[List[List[float]]]:
    raceway_lines, all_lines = extract_line_buckets(raw_geojson)
    return raceway_lines if raceway_lines else all_lines


def extract_raceway_polygon_rings(raw_geojson: dict, lon_scale: float) -> List[List[Tuple[float, float]]]:
    rings: List[List[Tuple[float, float]]] = []
    for feat in raw_geojson.get("features", []):
        geom = feat.get("geometry")
        if not geom:
            continue
        pr = feat.get("properties") or {}
        if str(pr.get("area:highway", "")).lower() != "raceway":
            continue

        gtype = geom.get("type")
        coords = geom.get("coordinates")
        if not isinstance(coords, list):
            continue

        if gtype == "Polygon":
            polys = [coords]
        elif gtype == "MultiPolygon":
            polys = coords
        else:
            polys = []

        for poly in polys:
            if not isinstance(poly, list) or not poly:
                continue
            outer = poly[0]
            if not isinstance(outer, list):
                continue
            valid = [project_lonlat(p, lon_scale) for p in outer if is_valid_coord(p)]
            if len(valid) < 4:
                continue
            valid = dedupe_points(valid)
            if euclid(valid[0], valid[-1]) > 1e-9:
                valid.append(valid[0])
            rings.append(valid)

    return rings


def extract_corner_anchors(corners_geo: Optional[dict], lon_scale: float) -> List[Tuple[int, Tuple[float, float]]]:
    if not corners_geo:
        return []

    buckets: Dict[int, List[Tuple[float, float]]] = defaultdict(list)
    for feat in corners_geo.get("features", []):
        geom = feat.get("geometry")
        if not geom or geom.get("type") != "Point":
            continue
        pr = feat.get("properties") or {}
        cn = pr.get("corner_number")
        if cn is None:
            continue
        coords = geom.get("coordinates")
        if not is_valid_coord(coords):
            continue
        try:
            cnum = int(cn)
        except Exception:
            continue
        buckets[cnum].append(project_lonlat(coords, lon_scale))

    anchors = []
    for cnum in sorted(buckets.keys()):
        pts = buckets[cnum]
        x = sum(p[0] for p in pts) / len(pts)
        y = sum(p[1] for p in pts) / len(pts)
        anchors.append((cnum, (x, y)))
    return anchors


def build_graph(lines_xy: List[List[Tuple[float, float]]]) -> Tuple[Dict[int, Tuple[float, float]], Dict[int, List[Tuple[int, float]]]]:
    node_map: Dict[Tuple[int, int], int] = {}
    nodes: Dict[int, Tuple[float, float]] = {}
    adj: Dict[int, List[Tuple[int, float]]] = defaultdict(list)

    def get_node_id(p: Tuple[float, float]) -> int:
        q = quantize(p)
        if q in node_map:
            return node_map[q]
        nid = len(node_map)
        node_map[q] = nid
        nodes[nid] = p
        return nid

    for line in lines_xy:
        for i in range(len(line) - 1):
            p0 = line[i]
            p1 = line[i + 1]
            w = euclid(p0, p1)
            if w <= 1e-12:
                continue
            n0 = get_node_id(p0)
            n1 = get_node_id(p1)
            adj[n0].append((n1, w))
            adj[n1].append((n0, w))

    return nodes, adj


def choose_main_component(
    nodes: Dict[int, Tuple[float, float]],
    adj: Dict[int, List[Tuple[int, float]]],
    anchors: List[Tuple[int, Tuple[float, float]]],
) -> List[int]:
    comps = connected_components(adj)
    if not comps:
        return []
    if len(comps) == 1:
        return comps[0]

    # Choose component capturing most corner anchors.
    mapped_counts = defaultdict(int)
    for _, apt in anchors:
        nid, _ = nearest_node(apt, nodes.keys(), nodes)
        for idx, comp in enumerate(comps):
            # Fast membership by set for this anchor check.
            # Small graphs, so this is acceptable.
            if nid in comp:
                mapped_counts[idx] += 1
                break

    if mapped_counts:
        best_idx = max(mapped_counts.items(), key=lambda kv: (kv[1], len(comps[kv[0]])))[0]
        return comps[best_idx]

    # Fallback: largest component.
    return max(comps, key=len)


def subgraph(
    nodes: Dict[int, Tuple[float, float]],
    adj: Dict[int, List[Tuple[int, float]]],
    keep: List[int],
) -> Tuple[Dict[int, Tuple[float, float]], Dict[int, List[Tuple[int, float]]]]:
    keep_set = set(keep)
    n2 = {k: v for k, v in nodes.items() if k in keep_set}
    a2: Dict[int, List[Tuple[int, float]]] = defaultdict(list)
    for k in keep_set:
        for v, w in adj.get(k, []):
            if v in keep_set:
                a2[k].append((v, w))
    return n2, a2


def route_main_loop(
    layout_id: str,
    nodes: Dict[int, Tuple[float, float]],
    adj: Dict[int, List[Tuple[int, float]]],
    anchors: List[Tuple[int, Tuple[float, float]]],
) -> List[Tuple[float, float]]:
    if len(anchors) < 2:
        # Fallback: stitch all edges from largest component in arbitrary traversal.
        # This is only for malformed layers.
        if not nodes:
            return []
        start = next(iter(nodes))
        path_nodes = [start]
        seen = set([start])
        cur = start
        for _ in range(len(nodes) * 2):
            nxt = None
            for v, _ in adj.get(cur, []):
                if v not in seen:
                    nxt = v
                    break
            if nxt is None:
                break
            path_nodes.append(nxt)
            seen.add(nxt)
            cur = nxt
        return [nodes[n] for n in path_nodes]

    anchor_nodes: List[Tuple[int, int]] = []
    node_ids = list(nodes.keys())
    for cnum, apt in anchors:
        nid, _ = nearest_node(apt, node_ids, nodes)
        anchor_nodes.append((cnum, nid))

    segment_paths: List[List[int]] = []
    used_edges: set[Tuple[int, int]] = set()
    alt_pairs = PREFER_ALT_PATH_PAIRS.get(layout_id, set())

    anchor_points = [pt for _, pt in anchors]
    if anchor_points:
        ax = [p[0] for p in anchor_points]
        ay = [p[1] for p in anchor_points]
        diag = math.hypot(max(ax) - min(ax), max(ay) - min(ay))
    else:
        diag = 1.0
    near_thr = max(diag * 0.05, 1e-6)

    def score_candidate(path: List[int], seg_idx: int) -> float:
        if not path:
            return float("inf")
        plen = path_length(path, nodes)
        reused = 0
        for j in range(len(path) - 1):
            if edge_key(path[j], path[j + 1]) in used_edges:
                reused += 1

        i_prev = (seg_idx - 1) % len(anchor_nodes)
        i_cur = seg_idx
        i_next = (seg_idx + 1) % len(anchor_nodes)
        excluded = {i_prev, i_cur, i_next}
        forbidden = [anchor_points[k] for k in range(len(anchor_points)) if k not in excluded]
        near_hits = 0
        if forbidden:
            for nid in path:
                p = nodes[nid]
                for fp in forbidden:
                    if euclid(p, fp) < near_thr:
                        near_hits += 1
                        break

        return plen + reused * near_thr * 20.0 + near_hits * near_thr * 10.0

    for i in range(len(anchor_nodes)):
        c1, n1 = anchor_nodes[i]
        c2, n2 = anchor_nodes[(i + 1) % len(anchor_nodes)]

        p1 = shortest_path(adj, n1, n2)
        if not p1:
            continue

        chosen = p1
        pair_key = (c1, c2)
        blocked = {edge_key(p1[j], p1[j + 1]) for j in range(len(p1) - 1)}
        p2 = shortest_path(adj, n1, n2, blocked=blocked)

        if pair_key in alt_pairs and p2:
            l1 = path_length(p1, nodes)
            l2 = path_length(p2, nodes)
            if l2 <= l1 * 2.2:
                chosen = p2
        elif p2:
            s1 = score_candidate(p1, i)
            s2 = score_candidate(p2, i)
            l1 = path_length(p1, nodes)
            l2 = path_length(p2, nodes)
            if s2 < s1 and l2 <= l1 * 2.5:
                chosen = p2

        segment_paths.append(chosen)
        for j in range(len(chosen) - 1):
            used_edges.add(edge_key(chosen[j], chosen[j + 1]))

    if not segment_paths:
        return []

    seq_nodes: List[int] = []
    for seg in segment_paths:
        if not seq_nodes:
            seq_nodes.extend(seg)
        else:
            seq_nodes.extend(seg[1:] if seq_nodes[-1] == seg[0] else seg)

    points = dedupe_points([nodes[nid] for nid in seq_nodes])
    if points and euclid(points[0], points[-1]) > 1e-9:
        points.append(points[0])
    return points


def chaikin_closed(points: List[Tuple[float, float]], rounds: int = 3) -> List[Tuple[float, float]]:
    if len(points) < 3:
        out = list(points)
        if out and euclid(out[0], out[-1]) > 1e-9:
            out.append(out[0])
        return out

    pts = list(points)
    if euclid(pts[0], pts[-1]) <= 1e-9:
        pts = pts[:-1]

    for _ in range(rounds):
        n = len(pts)
        new_pts: List[Tuple[float, float]] = []
        for i in range(n):
            p0 = pts[i]
            p1 = pts[(i + 1) % n]
            q = (0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1])
            r = (0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1])
            new_pts.extend([q, r])
        pts = new_pts

    pts.append(pts[0])
    return pts


def find_nearest_index(poly: List[Tuple[float, float]], point: Tuple[float, float]) -> int:
    best_i = 0
    best_d = float("inf")
    for i, p in enumerate(poly):
        d = (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def cyc_range_points(poly: List[Tuple[float, float]], i0: int, i1: int) -> List[Tuple[float, float]]:
    if not poly:
        return []
    n = len(poly)
    i0 %= n
    i1 %= n
    if i0 <= i1:
        return poly[i0 : i1 + 1]
    return poly[i0:] + poly[: i1 + 1]


def cyc_dist(n: int, i0: int, i1: int) -> int:
    return (i1 - i0) % n


def draw_track_base(ax, poly: List[Tuple[float, float]]) -> None:
    if len(poly) < 2:
        return
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    ax.plot(xs, ys, color="#9aa3b2", lw=14, solid_capstyle="round", solid_joinstyle="round", zorder=2)
    ax.plot(xs, ys, color="#2a303b", lw=10, solid_capstyle="round", solid_joinstyle="round", zorder=3)
    ax.plot(xs, ys, color="#c7ced8", lw=4, solid_capstyle="round", solid_joinstyle="round", zorder=4)


def draw_start_finish(ax, poly: List[Tuple[float, float]], idx: int, diag: float) -> None:
    if len(poly) < 3:
        return
    n = len(poly)
    p = poly[idx % n]
    p_prev = poly[(idx - 1) % n]
    p_next = poly[(idx + 1) % n]

    tx = p_next[0] - p_prev[0]
    ty = p_next[1] - p_prev[1]
    tnorm = math.hypot(tx, ty)
    if tnorm <= 1e-12:
        return
    tx, ty = tx / tnorm, ty / tnorm
    nx, ny = -ty, tx

    half = max(diag * 0.022, 0.0006)
    a = (p[0] + nx * half, p[1] + ny * half)
    b = (p[0] - nx * half, p[1] - ny * half)

    ax.plot([a[0], b[0]], [a[1], b[1]], color="#f4f7fb", lw=5.0, zorder=9)
    ax.plot([a[0], b[0]], [a[1], b[1]], color="#05070a", lw=2.1, dashes=(2.0, 2.0), zorder=10)


def draw_corners(
    ax,
    anchors: List[Tuple[int, Tuple[float, float]]],
    centroid: Tuple[float, float],
    diag: float,
) -> None:
    if not anchors:
        return

    r = max(diag * 0.012, 0.00035)
    offset = max(diag * 0.03, 0.0008)

    for cnum, pt in anchors:
        dx = pt[0] - centroid[0]
        dy = pt[1] - centroid[1]
        norm = math.hypot(dx, dy)
        if norm <= 1e-12:
            dx, dy = 1.0, 0.0
            norm = 1.0
        ux, uy = dx / norm, dy / norm
        lp = (pt[0] + ux * offset, pt[1] + uy * offset)

        ax.plot([pt[0], lp[0]], [pt[1], lp[1]], color="#8b919d", lw=1.2, alpha=0.9, zorder=11)
        circ = Circle(lp, r, facecolor="#2b2f37", edgecolor="#1a1d23", lw=1.0, zorder=12)
        ax.add_patch(circ)
        ax.text(lp[0], lp[1], str(cnum), color="#dfe5ee", fontsize=10, ha="center", va="center", zorder=13)


def extract_pit_line(pit_geo: Optional[dict], lon_scale: float) -> Optional[List[Tuple[float, float]]]:
    if not pit_geo:
        return None
    best = None
    best_len = -1.0
    for feat in pit_geo.get("features", []):
        geom = feat.get("geometry")
        if not geom:
            continue
        pr = feat.get("properties") or {}
        ftype = str(pr.get("type", "")).lower()
        lines = flatten_lines(geom)
        for line in lines:
            valid = [p for p in line if is_valid_coord(p)]
            if len(valid) < 2:
                continue
            pts = [project_lonlat(p, lon_scale) for p in valid]
            total = sum(euclid(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
            if ftype in {"pit_lane", "pit lane"}:
                total *= 1.3
            if total > best_len:
                best_len = total
                best = pts
    return best


def extract_drs_lines(drs_geo: Optional[dict], lon_scale: float) -> Dict[int, List[Tuple[float, float]]]:
    if not drs_geo:
        return {}
    by_zone: Dict[int, List[Tuple[float, float]]] = {}
    by_zone_len: Dict[int, float] = {}
    next_zone = 1

    for feat in drs_geo.get("features", []):
        geom = feat.get("geometry")
        if not geom:
            continue
        lines = flatten_lines(geom)
        if not lines:
            continue

        pr = feat.get("properties") or {}
        ftype_raw = pr.get("feature_type")
        kind_raw = pr.get("type")
        ftype = ftype_raw.lower() if isinstance(ftype_raw, str) else ""
        kind = kind_raw.lower() if isinstance(kind_raw, str) else ""
        if ftype and ftype != "zone_line" and "drs" not in kind:
            continue

        zone = pr.get("zone")
        try:
            zone_i = int(zone)
        except Exception:
            zone_i = next_zone
            next_zone += 1

        # Keep longest line per zone when duplicates exist.
        for line in lines:
            valid = [p for p in line if is_valid_coord(p)]
            if len(valid) < 2:
                continue
            pts = [project_lonlat(p, lon_scale) for p in valid]
            if len(pts) < 2:
                continue
            total = sum(euclid(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
            if total > by_zone_len.get(zone_i, -1.0):
                by_zone_len[zone_i] = total
                by_zone[zone_i] = pts

    return by_zone


def extract_sector_points(
    sectors_geo: Optional[dict],
    lon_scale: float,
) -> Tuple[Dict[int, Tuple[float, float]], Optional[Tuple[float, float]]]:
    if not sectors_geo:
        return {}, None

    sector_points: Dict[int, Tuple[float, float]] = {}
    speed_trap = None

    for feat in sectors_geo.get("features", []):
        geom = feat.get("geometry")
        if not geom or geom.get("type") != "Point":
            continue
        pr = feat.get("properties") or {}

        sector_raw = str(pr.get("sector") or "")
        sid_raw = str(pr.get("id") or "")
        txt = f"{sector_raw} {sid_raw}".lower()

        coords = geom.get("coordinates")
        if not is_valid_coord(coords):
            continue
        pt = project_lonlat(coords, lon_scale)

        if "speed" in txt and "trap" in txt:
            speed_trap = pt
            continue

        m = re.search(r"sector\s*(\d)", sector_raw.lower())
        if not m:
            m = re.search(r"^(\d)$", sid_raw.strip())
        if m:
            sector_points[int(m.group(1))] = pt

    return sector_points, speed_trap


def draw_sector_styling(
    ax,
    poly: List[Tuple[float, float]],
    start_idx: int,
    sector_points: Dict[int, Tuple[float, float]],
    diag: float,
) -> None:
    if len(poly) < 5:
        return

    sector_colors = {1: "#ff2e2e", 2: "#18b7ff", 3: "#ffd11a"}

    s1 = sector_points.get(1)
    s2 = sector_points.get(2)
    if s1 and s2:
        n = len(poly)
        i1 = find_nearest_index(poly, s1)
        i2 = find_nearest_index(poly, s2)

        d1 = cyc_dist(n, start_idx, i1)
        d2 = cyc_dist(n, start_idx, i2)
        if d2 < d1:
            i1, i2 = i2, i1

        segments = [
            (start_idx, i1, 1),
            (i1, i2, 2),
            (i2, start_idx, 3),
        ]

        for a, b, sid in segments:
            pts = cyc_range_points(poly, a, b)
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            ax.plot(xs, ys, color=sector_colors[sid], lw=2.2, alpha=0.9, zorder=5)

            mid = pts[len(pts) // 2]
            ax.text(
                mid[0],
                mid[1],
                f"SECTOR {sid}",
                color=sector_colors[sid],
                fontsize=9,
                fontweight="bold",
                ha="center",
                va="center",
                zorder=14,
                bbox=dict(facecolor="#00000088", edgecolor="none", pad=1.5),
            )

    # Ensure explicit sector labels appear at metadata points.
    for sid, pt in sector_points.items():
        col = sector_colors.get(sid, "#dfe5ee")
        ax.scatter([pt[0]], [pt[1]], s=20, color=col, zorder=14)
        ax.text(
            pt[0],
            pt[1],
            f"S{sid}",
            color=col,
            fontsize=10,
            fontweight="bold",
            ha="left",
            va="bottom",
            zorder=15,
        )


def render_layout(spec: LayoutSpec, out_png: Path) -> None:
    raw_path = find_raw_file(spec)
    raw_geo = read_geojson(raw_path)

    # Projection scale for longitude based on track latitude.
    all_coords = []
    for feat in raw_geo.get("features", []):
        geom = feat.get("geometry")
        if not geom:
            continue
        if geom.get("type") == "Point" and is_valid_coord(geom.get("coordinates")):
            all_coords.append(geom.get("coordinates"))
        for line in flatten_lines(geom):
            all_coords.extend([p for p in line if is_valid_coord(p)])

    corners_geo = read_geojson(find_layer_file(spec, "corners")) if find_layer_file(spec, "corners") else None
    drs_geo = read_geojson(find_layer_file(spec, "drs")) if find_layer_file(spec, "drs") else None
    pit_geo = read_geojson(find_layer_file(spec, "pit")) if find_layer_file(spec, "pit") else None
    sectors_geo = read_geojson(find_layer_file(spec, "sectors")) if find_layer_file(spec, "sectors") else None

    if not all_coords and corners_geo:
        for feat in corners_geo.get("features", []):
            geom = feat.get("geometry")
            if geom and geom.get("type") == "Point" and is_valid_coord(geom.get("coordinates")):
                all_coords.append(geom.get("coordinates"))

    if not all_coords:
        raise RuntimeError(f"No coordinates found for {spec.layout_id}")

    mean_lat = sum(float(c[1]) for c in all_coords) / len(all_coords)
    lon_scale = math.cos(math.radians(mean_lat))

    anchors = extract_corner_anchors(corners_geo, lon_scale)

    if spec.layout_id in FORCE_CORNER_LOOP_LAYOUTS and anchors:
        loop = chaikin_closed([pt for _, pt in anchors], rounds=3)
        raw_lines = []
    else:
        loop: List[Tuple[float, float]] = []

        raceway_lines, all_lines = extract_line_buckets(raw_geo)
        if spec.layout_id in FORCE_USE_ALL_LINES_LAYOUTS:
            raw_lines = all_lines
        else:
            raw_lines = raceway_lines if raceway_lines else all_lines

        # Sparse line subsets can produce wrong branch selection; force robust fallback.
        if anchors and len(raw_lines) < max(4, int(0.35 * len(anchors))):
            raw_lines = []

        lines_xy = []
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

        # Polygon-only/malformed raw fallback: synthesize centerline from ordered corners.
        if len(loop) < 2 and anchors:
            corner_poly = [pt for _, pt in anchors]
            loop = chaikin_closed(corner_poly, rounds=3)

    if len(loop) < 2:
        raise RuntimeError(f"Failed to build loop for {spec.layout_id}")

    xs = [p[0] for p in loop]
    ys = [p[1] for p in loop]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = max(max_x - min_x, 1e-9)
    span_y = max(max_y - min_y, 1e-9)
    diag = math.hypot(span_x, span_y)

    fig = plt.figure(figsize=(12, 8), facecolor="#000000")
    ax = fig.add_subplot(111)
    ax.set_facecolor("#000000")

    draw_track_base(ax, loop)

    centroid = (sum(xs) / len(xs), sum(ys) / len(ys))

    start_idx = 0
    if anchors:
        c1 = next((pt for num, pt in anchors if num == 1), anchors[0][1])
        start_idx = find_nearest_index(loop, c1)

    pit_line = extract_pit_line(pit_geo, lon_scale)
    if pit_line and len(pit_line) >= 2:
        px = [p[0] for p in pit_line]
        py = [p[1] for p in pit_line]
        ax.plot(px, py, color="#f6a623", lw=3.0, solid_capstyle="round", zorder=6)

        p0, p1 = pit_line[0], pit_line[-1]
        i0 = find_nearest_index(loop, p0)
        i1 = find_nearest_index(loop, p1)
        d0 = cyc_dist(len(loop), start_idx, i0)
        d1 = cyc_dist(len(loop), start_idx, i1)
        pit_out, pit_in = (p0, p1) if d0 < d1 else (p1, p0)

        ax.scatter([pit_in[0], pit_out[0]], [pit_in[1], pit_out[1]], s=30, color="#ffb01f", zorder=16)
        ax.text(pit_in[0], pit_in[1], " PIT IN", color="#ffb01f", fontsize=10, fontweight="bold", zorder=16)
        ax.text(pit_out[0], pit_out[1], " PIT OUT", color="#ffb01f", fontsize=10, fontweight="bold", zorder=16)

    sector_points, speed_trap = extract_sector_points(sectors_geo, lon_scale)
    draw_sector_styling(ax, loop, start_idx, sector_points, diag=diag)

    drs_lines = extract_drs_lines(drs_geo, lon_scale)
    for zone in sorted(drs_lines.keys()):
        pts = drs_lines[zone]
        if len(pts) < 2:
            continue
        zx = [p[0] for p in pts]
        zy = [p[1] for p in pts]
        ax.plot(zx, zy, color="#35da82", lw=3.0, dashes=(4, 2), zorder=7)

        mid = pts[len(pts) // 2]
        ax.text(
            mid[0],
            mid[1],
            f"DRS {zone}",
            color="#35da82",
            fontsize=9,
            fontweight="bold",
            ha="center",
            va="center",
            zorder=17,
            bbox=dict(facecolor="#00000088", edgecolor="none", pad=1.0),
        )

    if speed_trap:
        ax.scatter([speed_trap[0]], [speed_trap[1]], marker="s", s=70, color="#cf40ff", zorder=18)
        ax.text(
            speed_trap[0],
            speed_trap[1],
            " SPEED TRAP",
            color="#cf40ff",
            fontsize=9,
            fontweight="bold",
            zorder=18,
        )

    draw_start_finish(ax, loop, start_idx, diag)
    draw_corners(ax, anchors, centroid, diag)

    # Title line kept concise for quick visual QA.
    ax.text(
        0.5,
        0.985,
        f"{spec.layout_id}  (track + pit + sectors + drs + corners + speed trap)",
        transform=ax.transAxes,
        ha="center",
        va="top",
        color="#c8cdd6",
        fontsize=14,
        zorder=30,
    )

    # Framing.
    pad_x = span_x * 0.12
    pad_y = span_y * 0.12
    ax.set_xlim(min_x - pad_x, max_x + pad_x)
    ax.set_ylim(min_y - pad_y, max_y + pad_y)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")

    out_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_png, dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)


def main() -> None:
    specs = collect_layouts(CIRCUITS_DIR)

    if TMP_OUT_DIR.exists():
        shutil.rmtree(TMP_OUT_DIR)
    TMP_OUT_DIR.mkdir(parents=True, exist_ok=True)

    failures: List[Tuple[str, str]] = []
    for spec in specs:
        out_png = TMP_OUT_DIR / f"{spec.layout_id}.png"
        try:
            render_layout(spec, out_png)
            print(f"ok: {spec.layout_id}")
        except Exception as exc:
            failures.append((spec.layout_id, str(exc)))
            print(f"fail: {spec.layout_id}: {exc}")

    if failures:
        print("\nRender failures:")
        for lid, err in failures:
            print(f" - {lid}: {err}")
        raise SystemExit(1)

    # Swap only after full success.
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    TMP_OUT_DIR.rename(OUT_DIR)

    print(f"\nRendered layouts: {len(specs)}")
    print(f"Output folder: {OUT_DIR}")


if __name__ == "__main__":
    main()

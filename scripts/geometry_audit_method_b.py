#!/usr/bin/env python3
"\"\"\"Method B: geometry-first audit for canonical FIA track layouts.\"\""

import json
import math
import os
import statistics
import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple, Union

CANON_DIR = Path(os.environ.get("TRACK_GEOMETRY_DIR", "backend/etl/data/track_geometry"))
OUTPUT_FILE = Path(os.environ.get("GEOMETRY_AUDIT_OUT", "tmp_geometry_report_method_b.json"))
ROUTING_FILE = CANON_DIR / "session_routing_2018_2025.json"
DEGENERACY_RATIO = 0.55
DEGENERACY_LENGTH = 3_000.0
VARIANT_PAIRS = [
    ("abu_dhabi_v1", "abu_dhabi_v2"),
    ("australia_v1", "australia_v2"),
    ("spain_v1", "spain_v2"),
    ("singapore_v1", "singapore_v2"),
    ("bahrain_gp_v1", "bahrain_outer_v1"),
]


def _load_layout_files() -> List[Path]:
    files = []
    for path in sorted(CANON_DIR.glob("*.json")):
        if path.name in {"session_routing_2018_2025.json", "layout_index.json"}:
            continue
        files.append(path)
    return files


def _compute_segment_lengths(centerline: Sequence[Sequence[float]]) -> Tuple[List[float], float]:
    n = len(centerline)
    if n < 2:
        return [], 0.0
    segments = []
    for i in range(n):
        a = centerline[i]
        b = centerline[(i + 1) % n]
        segments.append(math.hypot(b[0] - a[0], b[1] - a[1]))
    total = sum(segments)
    return segments, total


def _positions_from_segments(segments: List[float]) -> List[float]:
    positions = [0.0]
    for length in segments[:-1]:
        positions.append(positions[-1] + length)
    return positions


def _arc_length(positions: List[float], total: float, start: int, end: int) -> float:
    if start == end:
        return 0.0
    start_pos = positions[start]
    end_pos = positions[end]
    if end_pos >= start_pos:
        return end_pos - start_pos
    return (total - start_pos) + end_pos


def _curvature_scores(points: Sequence[Sequence[float]]) -> List[float]:
    n = len(points)
    if n == 0:
        return []
    base = [0.0] * n
    for i in range(n):
        prev = points[(i - 1) % n]
        curr = points[i]
        nxt = points[(i + 1) % n]
        angle1 = math.atan2(curr[1] - prev[1], curr[0] - prev[0])
        angle2 = math.atan2(nxt[1] - curr[1], nxt[0] - curr[0])
        delta = math.degrees(angle2 - angle1)
        while delta > 180:
            delta -= 360
        while delta < -180:
            delta += 360
        base[i] = abs(delta)
    smooth = []
    for i in range(n):
        smooth.append(
            (
                base[(i - 2) % n]
                + 2 * base[(i - 1) % n]
                + 3 * base[i]
                + 2 * base[(i + 1) % n]
                + base[(i + 2) % n]
            )
            / 9.0
        )
    return smooth


def _zone_value(zone: Dict[str, Union[int, float]], keys: Sequence[str]) -> Union[int, float, None]:
    for key in keys:
        if key in zone:
            return zone[key]
    return None


def _normalize_index(value: Union[int, float, None], estimate: int) -> int:
    if isinstance(value, float):
        return int(round(value))
    if isinstance(value, int):
        return value
    return estimate


def _intervals_from_arc(start: float, length: float, track_length: float) -> List[Tuple[float, float]]:
    if length <= 0 or track_length <= 0:
        return []
    end = start + length
    if end <= track_length:
        return [(start, end)]
    return [(start, track_length), (0.0, end - track_length)]


def _overlaps(intervals_a: List[Tuple[float, float]], intervals_b: List[Tuple[float, float]]) -> bool:
    for a_start, a_end in intervals_a:
        for b_start, b_end in intervals_b:
            if a_start < b_end and b_start < a_end:
                return True
    return False


def analyze_layout(path: Path) -> Tuple[Dict, Dict]:
    payload = json.loads(path.read_text())
    centerline = payload.get("centerline", [])
    n_points = len(centerline)
    spacing_segments, track_length = _compute_segment_lengths(centerline)
    positions = _positions_from_segments(spacing_segments)
    if len(positions) < n_points:
        positions.append(positions[-1] + spacing_segments[-1] if spacing_segments else 0)
    curvatures = _curvature_scores(centerline)

    corners = payload.get("corners", [])
    corner_indices = [c.get("index", 0) for c in corners]
    corner_spans = []
    sorted_indices = sorted(set(corner_indices))
    if sorted_indices:
        for i, idx in enumerate(sorted_indices):
            next_idx = sorted_indices[(i + 1) % len(sorted_indices)]
            corner_spans.append(_arc_length(positions, track_length, idx, next_idx))
    span_min = min((s for s in corner_spans if s > 0), default=0.0)
    span_max = max(corner_spans, default=0.0)
    span_ratio = span_max / span_min if span_min > 0 else float("inf")

    def percentile(score: float) -> float:
        if not curvatures:
            return 0.0
        less = sum(1 for s in curvatures if s <= score)
        return less / len(curvatures)

    corner_percentiles = [percentile(curvatures[idx]) for idx in corner_indices]

    sectors_raw = payload.get("sectors", {})
    sectors_list = []
    for key in sorted(sectors_raw.keys()):
        sector = sectors_raw[key]
        start = int(sector.get("startIndex", 0))
        end = int(sector.get("endIndex", 0))
        length = _arc_length(positions, track_length, start, end)
        sectors_list.append(
            {
                "name": sector.get("name", key),
                "start": start,
                "end": end,
                "length": length,
                "ratio": length / track_length if track_length else 0.0,
            }
        )

    drs_zones = []
    drs_intervals = {}
    degeneracy_alerts = []
    order_alerts = []
    for zone in payload.get("drs_zones", []) or payload.get("drsZones", []):
        zone_number = zone.get("zone_number") or zone.get("zoneNumber") or 0
        detection_index = _normalize_index(
            _zone_value(zone, ("detection_index", "detectionIndex", "detection")), 0
        )
        activation_index = _normalize_index(
            _zone_value(zone, ("activation_index", "activationIndex", "activation")), 0
        )
        end_index = _normalize_index(
            _zone_value(zone, ("end_index", "endIndex", "end")), detection_index
        )
        detection_to_activation = _arc_length(positions, track_length, detection_index, activation_index)
        activation_to_end = _arc_length(positions, track_length, activation_index, end_index)
        zone_length = detection_to_activation + activation_to_end
        drs_zones.append(
            {
                "zone": int(zone_number),
                "detection": detection_index,
                "activation": activation_index,
                "end": end_index,
                "detection_activation_length": detection_to_activation,
                "activation_end_length": activation_to_end,
            }
        )
        intervals = _intervals_from_arc(positions[detection_index], zone_length, track_length)
        if intervals:
            drs_intervals[int(zone_number)] = intervals
        threshold = max(track_length * DEGENERACY_RATIO, DEGENERACY_LENGTH)
        if zone_length >= threshold:
            degeneracy_alerts.append((int(zone_number), zone_length, threshold))
        if detection_to_activation <= 0 or activation_to_end <= 0:
            order_alerts.append(
                {
                    "zone": int(zone_number),
                    "detection_to_activation": detection_to_activation,
                    "activation_to_end": activation_to_end,
                }
            )

    overlaps = []
    interval_items = list(drs_intervals.items())
    for i, (zone_a, intervals_a) in enumerate(interval_items):
        for zone_b, intervals_b in interval_items[i + 1 :]:
            if _overlaps(intervals_a, intervals_b):
                overlaps.append([zone_a, zone_b])

    hex_report = {
        "corner_count": len(corner_indices),
        "pixel_count": n_points,
        "track_length": track_length,
        "spacing_max": max(spacing_segments) if spacing_segments else 0.0,
        "spacing_min": min(spacing_segments) if spacing_segments else 0.0,
        "spacing_mean": statistics.mean(spacing_segments) if spacing_segments else 0.0,
        "curvature_max": max(curvatures) if curvatures else 0.0,
        "curvature_median": statistics.median(curvatures) if curvatures else 0.0,
        "corner_spans": corner_spans,
        "corner_span_ratio": span_ratio,
        "corner_curvature_percentiles": corner_percentiles,
        "sectors": [
            {"name": sec["name"], "start": sec["start"], "end": sec["end"], "length": sec["length"]}
            for sec in sectors_list
        ],
        "sector_total_length": sum(sec["length"] for sec in sectors_list),
        "sector_lengths": sectors_list,
        "drs_zone_count": len(drs_zones),
        "drs_stats": drs_zones,
        "drs_overlaps": overlaps,
        "degenerate_zones": [dz[0] for dz in degeneracy_alerts],
        "degeneracy_details": degeneracy_alerts,
        "detection_activation_alerts": order_alerts,
    }
    meta = {
        "degeneracy_alerts": degeneracy_alerts,
        "order_alerts": order_alerts,
        "drs_intervals": drs_intervals,
    }
    return hex_report, meta


def main() -> None:
    layout_files = _load_layout_files()
    layouts = {}
    deg_alerts = []
    order_alerts = []
    drs_interval_index = {}

    for path in layout_files:
        layout_id = path.stem
        report, meta = analyze_layout(path)
        layouts[layout_id] = report
        deg_alerts.extend([(layout_id, zone, length, threshold) for zone, length, threshold in meta["degeneracy_alerts"]])
        order_alerts.extend([(layout_id, alert) for alert in meta["order_alerts"]])
        drs_interval_index[layout_id] = meta["drs_intervals"]

    variants = []
    for head, tail in VARIANT_PAIRS:
        if head in layouts and tail in layouts:
            head_meta = layouts[head]
            tail_meta = layouts[tail]
            variants.append(
                {
                    "pair": f"{head} vs {tail}",
                    "track_length_diff": tail_meta["track_length"] - head_meta["track_length"],
                    "corner_count_diff": tail_meta["corner_count"] - head_meta["corner_count"],
                    "drs_zone_diff": tail_meta["drs_zone_count"] - head_meta["drs_zone_count"],
                    "point_count_diff": tail_meta["pixel_count"] - head_meta["pixel_count"],
                }
            )

    routing = json.loads(ROUTING_FILE.read_text())
    route_layouts = {route["layout_id"] for route in routing.get("routes", [])}
    canonical_layouts = set(layouts.keys())
    coverage = {
        "route_count": routing.get("route_count", len(route_layouts)),
        "missing_layout_refs": sorted(canonical_layouts - route_layouts),
        "extra_routes": sorted(route_layouts - canonical_layouts),
    }

    output = {
        "layouts": layouts,
        "variants": variants,
        "degeneracy_alerts": deg_alerts,
        "order_alerts": order_alerts,
        "coverage": coverage,
    }
    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print("Geometry audit (Method B) written to", OUTPUT_FILE)
    if deg_alerts:
        print(f"DEGENERATE ZONES: {len(deg_alerts)} detected (zone length >= {DEGENERACY_LENGTH} or {DEGENERACY_RATIO*100:.0f}% of lap).")
    if order_alerts:
        print(f"ORDER ALERTS: {len(order_alerts)} DRS detection/activation ordering anomalies.")


if __name__ == "__main__":
    main()
    payload = json.loads(OUTPUT_FILE.read_text())
    has_degeneracy = bool(payload.get("degeneracy_alerts"))
    has_order_alerts = bool(payload.get("order_alerts"))
    has_coverage_gaps = bool((payload.get("coverage") or {}).get("missing_layout_refs")) or bool((payload.get("coverage") or {}).get("extra_routes"))
    raise SystemExit(1 if (has_degeneracy or has_order_alerts or has_coverage_gaps) else 0)

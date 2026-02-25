#!/usr/bin/env python3
"""Method A FIA-reference consistency audit for canonical track geometries."""

from __future__ import annotations

import json
import math
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

CANONICAL_DIR = Path(os.environ.get('TRACK_GEOMETRY_DIR', 'backend/etl/data/track_geometry'))
SKIP_FILES = {'layout_index.json', 'session_routing_2018_2025.json'}

REF_WARN_M = 30.0
REF_FAIL_M = 150.0
TRACKLEN_WARN_PCT = 1.0
TRACKLEN_FAIL_PCT = 2.0
DRS_MAX_RATIO = 0.55
DRS_MAX_LENGTH_M = 3000.0
PIT_MIN_LENGTH_M = 15.0
MIN_CORNER_GAP_M = 5.0


@dataclass
class LayoutAudit:
    layout: str
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metrics: Dict[str, float] = field(default_factory=dict)


def _haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return 2 * 6_371_000.0 * math.asin(math.sqrt(a))


def _circular_gap(from_m: float, to_m: float, total_m: float) -> float:
    diff = (to_m - from_m) % total_m
    if diff <= 0.0:
        diff = total_m if total_m > 0 else 0.0
    return diff


class Centerline:
    def __init__(self, coords: List[List[float]]):
        self.coords = coords
        self.n = len(coords)
        self.cumulative: List[float] = [0.0]
        for i in range(self.n - 1):
            lon1, lat1 = coords[i]
            lon2, lat2 = coords[i + 1]
            d = _haversine_m(lon1, lat1, lon2, lat2)
            self.cumulative.append(self.cumulative[-1] + d)
        self.total_m = self.cumulative[-1]
        self.total_km = self.total_m / 1000.0 if self.total_m else 0.0

    def distance_at_index(self, idx: int) -> float:
        idx = idx % self.n if self.n else 0
        return self.cumulative[idx]

    def index_at_distance(self, distance_m: float) -> int:
        if not self.n:
            return 0
        target = distance_m % self.total_m if self.total_m else 0.0
        lo, hi = 0, self.n - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if self.cumulative[mid] < target:
                lo = mid + 1
            else:
                hi = mid
        if lo > 0 and abs(self.cumulative[lo - 1] - target) < abs(self.cumulative[lo] - target):
            return lo - 1
        return lo


def _parse_reference(reference: Optional[str], turn_dist: Dict[int, float], total_m: float) -> Optional[float]:
    if not reference:
        return None
    at_match = re.search(r'At\s*T\s*(\d+)', reference, re.I)
    if at_match:
        return turn_dist.get(int(at_match.group(1)))
    dist_match = re.search(r'(\d+(?:\.\d+)?)m\s*(before|after)\s*T\s*(\d+)', reference, re.I)
    if dist_match:
        offset = float(dist_match.group(1))
        direction = dist_match.group(2).lower()
        turn = int(dist_match.group(3))
        base = turn_dist.get(turn)
        if base is None:
            return None
        dist = base - offset if direction == 'before' else base + offset
        return dist % total_m if total_m else dist
    return None


def _extract_coords(data: Dict) -> Optional[List[List[float]]]:
    coords = (data.get('geojson') or {}).get('coordinates')
    if coords:
        return [[float(c[0]), float(c[1])] for c in coords]
    centerline = data.get('centerline')
    if centerline:
        return [[float(c[0]), float(c[1])] for c in centerline]
    return None


def _check_track_length(result: LayoutAudit, data: Dict, centerline: Centerline) -> None:
    declared = data.get('trackLength') or data.get('lap_distance_km')
    if declared is None:
        result.warnings.append('trackLength_missing')
        return
    declared_km = float(declared)
    measured_km = centerline.total_km
    if declared_km <= 0:
        result.failures.append('trackLength_bad_value')
        return
    diff_pct = abs(measured_km - declared_km) / declared_km * 100
    result.metrics['track_length_diff_pct'] = diff_pct
    if diff_pct > TRACKLEN_FAIL_PCT:
        result.failures.append(f'trackLength_mismatch:{diff_pct:.2f}%')
    elif diff_pct > TRACKLEN_WARN_PCT:
        result.warnings.append(f'trackLength_delta:{diff_pct:.2f}%')


def _check_sector_refs(result: LayoutAudit, data: Dict, centerline: Centerline, turn_dist: Dict[int, float]) -> None:
    refs = data.get('_fia_sector_refs') or {}
    sectors = data.get('sectors') or {}
    total = centerline.total_m
    for ref_key, sector_key in (('s1_end', 'sector1'), ('s2_end', 'sector2')):
        ref_value = refs.get(ref_key)
        sector = sectors.get(sector_key)
        if not ref_value:
            result.warnings.append(f'{ref_key}_missing')
            continue
        if not sector or 'endIndex' not in sector:
            result.failures.append(f'{sector_key}_missing_end')
            continue
        ref_dist = _parse_reference(ref_value, turn_dist, total)
        if ref_dist is None:
            result.warnings.append(f'{ref_key}_unresolved')
            continue
        actual_idx = int(sector['endIndex'])
        actual_dist = centerline.distance_at_index(actual_idx)
        delta = abs((actual_dist - ref_dist) % total)
        delta = min(delta, total - delta) if total else delta
        result.metrics[f'{ref_key}_diff_m'] = delta
        if delta >= REF_FAIL_M:
            result.failures.append(f'{ref_key}_mismatch:{delta:.1f}m')
        elif delta >= REF_WARN_M:
            result.warnings.append(f'{ref_key}_drift:{delta:.1f}m')


def _check_drs_zones(result: LayoutAudit, data: Dict, centerline: Centerline) -> None:
    drs_zones = data.get('drsZones') or data.get('drs_zones') or []
    if not drs_zones:
        result.warnings.append('drs_missing')
        return
    total = centerline.total_m
    max_ratio = 0.0
    longest = 0.0
    for zone in drs_zones:
        try:
            det = int(zone.get('detectionIndex'))
            start = int(zone.get('startIndex'))
            end = int(zone.get('endIndex'))
        except (TypeError, ValueError):
            result.failures.append('drs_index_type')
            continue
        if not centerline.n:
            continue
        dist_det = centerline.distance_at_index(det)
        dist_start = centerline.distance_at_index(start)
        dist_end = centerline.distance_at_index(end)
        gap_detection = _circular_gap(dist_det, dist_start, total)
        zone_length = _circular_gap(dist_start, dist_end, total)
        if gap_detection <= 0.0:
            result.failures.append('drs_detection_after_start')
        if zone_length <= 0.0:
            result.failures.append('drs_end_before_start')
            continue
        longest = max(longest, zone_length)
        max_ratio = max(max_ratio, zone_length / total if total else 0)
        if zone_length > DRS_MAX_LENGTH_M or zone_length / total > DRS_MAX_RATIO:
            result.failures.append(f'drs_zone_too_long:{zone_length:.0f}m')
        if gap_detection <= 0.0:
            result.warnings.append('drs_detection_sequence')
    result.metrics['drs_longest_m'] = longest
    result.metrics['drs_max_ratio'] = max_ratio


def _check_corner_continuity(result: LayoutAudit, data: Dict, centerline: Centerline) -> None:
    corners = data.get('corners') or []
    if not corners:
        result.failures.append('corners_missing')
        return
    numbered = [c for c in corners if isinstance(c.get('number'), int) and isinstance(c.get('index'), int)]
    numbers = sorted({c['number'] for c in numbered})
    if numbers != list(range(1, len(numbers) + 1)):
        result.failures.append('corner_numbers_nonseq')
    indices = [c['index'] for c in numbered]
    if len(indices) != len(set(indices)):
        result.failures.append('corner_index_duplicates')
    total = centerline.total_m
    prev_dist = None
    min_gap = float('inf')
    for number in numbers:
        idx = next((c['index'] for c in numbered if c['number'] == number), None)
        if idx is None:
            continue
        dist = centerline.distance_at_index(idx)
        if prev_dist is not None:
            gap = _circular_gap(prev_dist, dist, total)
            min_gap = min(min_gap, gap)
            if gap < MIN_CORNER_GAP_M:
                result.warnings.append(f'corner_gap_small:{number}')
        prev_dist = dist
    if min_gap < float('inf'):
        result.metrics['min_corner_gap_m'] = min_gap


def _check_start_and_pit(result: LayoutAudit, data: Dict, centerline: Centerline) -> None:
    n = centerline.n
    total = centerline.total_m
    start_idx = data.get('startPositionIndex')
    if start_idx is None:
        start_idx = (data.get('start_finish') or {}).get('index')
    if start_idx is None:
        result.warnings.append('start_index_missing')
    else:
        try:
            start_idx = int(start_idx)
        except (TypeError, ValueError):
            result.failures.append('start_index_invalid')
        else:
            if n and not (0 <= start_idx < n):
                result.failures.append('start_index_out_of_bounds')
            if n:
                result.metrics['start_distance_m'] = centerline.distance_at_index(start_idx)
    pit = data.get('pitLane') or data.get('pit_lane') or {}
    entry = pit.get('entryIndex') if isinstance(pit, dict) and 'entryIndex' in pit else pit.get('entry_index')
    exit_idx = pit.get('exitIndex') if isinstance(pit, dict) and 'exitIndex' in pit else pit.get('exit_index')
    if entry is None or exit_idx is None:
        result.warnings.append('pit_index_missing')
        return
    try:
        entry = int(entry)
        exit_idx = int(exit_idx)
    except (TypeError, ValueError):
        result.failures.append('pit_index_invalid')
        return
    if not n:
        return
    entry = entry % n
    exit_idx = exit_idx % n
    if entry == exit_idx:
        result.failures.append('pit_entry_exit_same')
        return
    gap = _circular_gap(centerline.distance_at_index(entry), centerline.distance_at_index(exit_idx), total)
    result.metrics['pit_length_m'] = gap
    if gap < PIT_MIN_LENGTH_M:
        result.failures.append(f'pit_length_short:{gap:.1f}m')


def run_audit() -> List[LayoutAudit]:
    results: List[LayoutAudit] = []
    for path in sorted(CANONICAL_DIR.glob('*.json')):
        if path.name in SKIP_FILES:
            continue
        layout_id = path.stem
        result = LayoutAudit(layout=layout_id)
        try:
            with path.open() as fh:
                data = json.load(fh)
        except Exception as exc:
            result.failures.append(f'json_load_error:{exc}')
            results.append(result)
            continue
        coords = _extract_coords(data)
        if not coords:
            result.failures.append('coords_missing')
            results.append(result)
            continue
        centerline = Centerline(coords)
        if centerline.n < 2 or centerline.total_m <= 0:
            result.failures.append('centerline_invalid')
            results.append(result)
            continue
        corners = data.get('corners') or []
        turn_dist: Dict[int, float] = {}
        for corner in corners:
            number = corner.get('number')
            index = corner.get('index')
            if isinstance(number, int) and isinstance(index, int):
                turn_dist[number] = centerline.distance_at_index(index)
        result.metrics['corner_count'] = len(corners)
        _check_track_length(result, data, centerline)
        _check_sector_refs(result, data, centerline, turn_dist)
        _check_drs_zones(result, data, centerline)
        _check_corner_continuity(result, data, centerline)
        _check_start_and_pit(result, data, centerline)
        results.append(result)
    return results


def _print_report(results: List[LayoutAudit]) -> None:
    total = len(results)
    failures = [res for res in results if res.failures]
    warnings = [res for res in results if res.warnings and not res.failures]
    clean = total - len(failures) - len(warnings)
    print('\nMethod A FIA Reference Consistency Audit\n' + '=' * 56)
    for res in results:
        if not res.failures and not res.warnings:
            continue
        print(f'\n{res.layout}\n  Failures: {res.failures or []}\n  Warnings: {res.warnings or []}')
        if res.metrics:
            metrics = ', '.join(f'{k}={v:.2f}' for k, v in sorted(res.metrics.items()))
            print(f'  Metrics: {metrics}')
    print('\nSummary:')
    print(f'  total={total} pass={clean} warnings={len(warnings)} failures={len(failures)}')
    confidence = 'High' if len(failures) == 0 else 'Medium'
    print(f'  confidence={confidence}')


if __name__ == '__main__':
    report = run_audit()
    _print_report(report)
    has_failures = any(r.failures for r in report)
    raise SystemExit(1 if has_failures else 0)

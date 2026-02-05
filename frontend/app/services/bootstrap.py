"""Backend -> store bootstrap (best-effort).

Goal: keep QML dumb and keep this file short.
"""

from __future__ import annotations

import math
from bisect import bisect_left
import threading
from typing import Any, Dict, List, Optional, Tuple

from app.services.api.telemetryx_backend import TelemetryXBackend


def _pick_latest_year(seasons: List[Dict[str, Any]]) -> Optional[int]:
    years = sorted([s.get("year") for s in seasons if isinstance(s.get("year"), int)], reverse=True)
    return years[0] if years else None


def _pick_race(races: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not races:
        return None
    preferred = "Bahrain Grand Prix"
    hit = next((r for r in races if r.get("name") == preferred), None)
    return hit or races[0]


def _pick_session_code(race_obj: Dict[str, Any]) -> str:
    sessions = race_obj.get("sessions") or []
    if "R" in sessions:
        return "R"
    return sessions[0] if sessions else "R"


def _code_from_name(name: str, fallback: str) -> str:
    parts = [p for p in (name or "").split() if p]
    if parts:
        return parts[-1][:3].upper()
    return fallback


def _race_slug(name: str) -> str:
    return str(name or "").replace(" ", "-")

def _team_color(team_name: str) -> str:
    key = str(team_name or "").lower().strip()
    if not key:
        return ""
    if "red bull" in key:
        return "#3671C6"
    if "mercedes" in key:
        return "#27F4D2"
    if "mclaren" in key:
        return "#FF8700"
    if "ferrari" in key:
        return "#E8002D"
    if "alpine" in key:
        return "#0093CC"
    if "aston martin" in key:
        return "#229971"
    if "williams" in key:
        return "#64C4FF"
    if "haas" in key:
        return "#B6BABD"
    if "alfa romeo" in key:
        return "#C92D2D"
    if "sauber" in key or "kick" in key or "stake" in key:
        return "#00E701"
    if "alpha tauri" in key or "racing bulls" in key or "visa cash app" in key or key == "rb":
        return "#5E8FAA"
    if "renault" in key:
        return "#FFCE00"
    return ""


def _parse_lap_time_seconds(s: str) -> float:
    """Parse 'M:SS.mmm' or 'SS.mmm' into seconds."""
    txt = (s or "").strip()
    if not txt:
        return 0.0
    try:
        if ":" in txt:
            m, rest = txt.split(":", 1)
            return float(m) * 60.0 + float(rest)
        return float(txt)
    except Exception:
        return 0.0


def _fit_positions_to_track(
    positions: List[Dict[str, Any]],
    track_points: List[Dict[str, float]],
) -> List[Dict[str, Any]]:
    """Scale/translate backend XY positions into the track-geometry coordinate space.

    Today, `positions.parquet` XY and `track_geometry/*.json` centerlines are in different scales.
    We map positions into the geometry bounds so cars stay on the drawn track.
    """
    if not positions or not track_points:
        return positions

    pts = [
        (float(p.get("x") or 0.0), float(p.get("y") or 0.0), float(p.get("timestamp") or i))
        for i, p in enumerate(positions)
        if p.get("x") is not None
    ]
    gpts = [(float(p.get("x") or 0.0), float(p.get("y") or 0.0)) for p in track_points]
    if not pts or not gpts:
        return positions

    def _mean(points):
        sx = sum(p[0] for p in points)
        sy = sum(p[1] for p in points)
        n = max(1, len(points))
        return sx / n, sy / n

    # If positions already appear in the same coordinate space as the track, keep them as-is.
    try:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        gx = [p[0] for p in gpts]
        gy = [p[1] for p in gpts]
        span_x = (max(xs) - min(xs)) or 1.0
        span_y = (max(ys) - min(ys)) or 1.0
        g_span_x = (max(gx) - min(gx)) or 1.0
        g_span_y = (max(gy) - min(gy)) or 1.0
        ratio_x = g_span_x / span_x
        ratio_y = g_span_y / span_y
        if 0.5 <= ratio_x <= 2.0 and 0.5 <= ratio_y <= 2.0:
            cx, cy = _mean([(p[0], p[1]) for p in pts])
            cgx, cgy = _mean(gpts)
            if abs(cx - cgx) <= g_span_x * 0.2 and abs(cy - cgy) <= g_span_y * 0.2:
                return positions
    except Exception:
        pass

    # Sample for scoring (keep fast).
    step_p = max(1, len(pts) // 400)
    step_g = max(1, len(gpts) // 400)
    pts_s = pts[::step_p]
    gpts_s = gpts[::step_g]

    def _pca_angle(points):
        cx, cy = _mean(points)
        cxx = cyy = cxy = 0.0
        for x, y in points:
            dx = x - cx
            dy = y - cy
            cxx += dx * dx
            cyy += dy * dy
            cxy += dx * dy
        if len(points) < 3:
            return 0.0
        return 0.5 * math.atan2(2 * cxy, (cxx - cyy))

    def _rms(points):
        cx, cy = _mean(points)
        return math.sqrt(sum((x - cx) ** 2 + (y - cy) ** 2 for x, y in points) / max(1, len(points)))

    angle_g = _pca_angle(gpts_s)
    rms_g = _rms(gpts_s)
    cgx, cgy = _mean(gpts_s)

    def _direction_score(transform_fn):
        if len(pts_s) < 3 or len(gpts_s) < 3:
            return 0.0
        pts_sorted = sorted(pts_s, key=lambda p: p[2])
        idxs = []
        for x, y, _t in pts_sorted:
            tx, ty = transform_fn(x, y)
            best_idx = 0
            best_d = None
            for gi, (gx, gy) in enumerate(gpts_s):
                d = (tx - gx) ** 2 + (ty - gy) ** 2
                if best_d is None or d < best_d:
                    best_d = d
                    best_idx = gi
            idxs.append(best_idx)
        n = float(len(gpts_s))
        if n <= 1:
            return 0.0
        total = 0.0
        for i in range(1, len(idxs)):
            delta = ((idxs[i] - idxs[i - 1] + n / 2.0) % n) - (n / 2.0)
            total += delta
        return total / max(1, len(idxs) - 1)

    def _score(transform_fn):
        total = 0.0
        for x, y, _t in pts_s:
            tx, ty = transform_fn(x, y)
            best = None
            for gx, gy in gpts_s:
                d = (tx - gx) ** 2 + (ty - gy) ** 2
                if best is None or d < best:
                    best = d
            total += best or 0.0
        score = total / max(1, len(pts_s))
        dir_score = _direction_score(transform_fn)
        if dir_score < 0:
            score *= 1.2
        return score

    candidates = []

    for fx, fy in [(1.0, 1.0), (-1.0, 1.0), (1.0, -1.0), (-1.0, -1.0)]:
        def _mk_transform(fx=fx, fy=fy):
            # Apply flip, rotate to match principal axis, then scale + translate.
            flipped = [(fx * x, fy * y) for x, y, _t in pts_s]
            angle_p = _pca_angle(flipped)
            rot = angle_g - angle_p
            cos_r = math.cos(rot)
            sin_r = math.sin(rot)
            rms_p = _rms(flipped) or 1.0
            scale = rms_g / rms_p if rms_p > 0 else 1.0
            cx, cy = _mean(flipped)

            def _xf(x, y):
                x = fx * x - cx
                y = fy * y - cy
                xr = x * cos_r - y * sin_r
                yr = x * sin_r + y * cos_r
                return xr * scale + cgx, yr * scale + cgy

            return _xf

        xf = _mk_transform()
        score = _score(xf)
        dir_score = _direction_score(xf)
        candidates.append((score, dir_score, xf))

    if not candidates:
        return positions

    # Prefer transforms that preserve lap direction (positive direction score).
    best_score = min(candidates, key=lambda c: c[0])[0]
    positives = [c for c in candidates if c[1] >= 0 and c[0] <= best_score * 1.2]
    if positives:
        best = min(positives, key=lambda c: c[0])[2]
    else:
        best = min(candidates, key=lambda c: c[0])[2]

    out: List[Dict[str, Any]] = []
    for p in positions:
        try:
            x = float(p.get("x") or 0.0)
            y = float(p.get("y") or 0.0)
        except Exception:
            out.append(p)
            continue
        nx, ny = best(x, y)
        out.append({**p, "x": nx, "y": ny})
    return out


def _densify_track_points(points: List[Dict[str, float]], target: int = 800) -> List[Dict[str, float]]:
    if not points or len(points) < 2 or target <= len(points):
        return points
    # Ensure distances are present/monotonic.
    has_dist = all("distance" in p for p in points)
    distances: List[float] = []
    total = 0.0
    for i, p in enumerate(points):
        if has_dist:
            d = float(p.get("distance") or 0.0)
        else:
            if i > 0:
                dx = float(p["x"]) - float(points[i - 1]["x"])
                dy = float(p["y"]) - float(points[i - 1]["y"])
                total += (dx * dx + dy * dy) ** 0.5
            d = total
        distances.append(d)
    total = distances[-1] if distances else 0.0
    if total <= 0:
        return points
    avg = total / float(max(1, target - 1))
    out: List[Dict[str, float]] = [points[0].copy()]
    out[0]["distance"] = distances[0]
    for i in range(1, len(points)):
        x0, y0 = float(points[i - 1]["x"]), float(points[i - 1]["y"])
        x1, y1 = float(points[i]["x"]), float(points[i]["y"])
        d0, d1 = distances[i - 1], distances[i]
        dx = x1 - x0
        dy = y1 - y0
        seg = (dx * dx + dy * dy) ** 0.5
        n = max(1, int(round(seg / avg)))
        for j in range(1, n + 1):
            t = j / float(n)
            out.append(
                {
                    "x": x0 + dx * t,
                    "y": y0 + dy * t,
                    "distance": d0 + (d1 - d0) * t,
                }
            )
    return out


def _track_points_from_geom(geom: Dict[str, Any]) -> List[Dict[str, float]]:
    layout = geom.get("layout") if isinstance(geom, dict) else None
    coords = (layout or {}).get("path_coordinates") if isinstance(layout, dict) else None
    if isinstance(coords, list) and coords:
        out = []
        last = 0.0
        for i, p in enumerate(coords):
            if not isinstance(p, dict):
                continue
            x = float(p.get("x") or 0.0)
            y = float(p.get("y") or 0.0)
            dist = p.get("distance")
            if dist is None and i > 0:
                dx = x - float(coords[i - 1].get("x") or 0.0)
                dy = y - float(coords[i - 1].get("y") or 0.0)
                last += (dx * dx + dy * dy) ** 0.5
                dist = last
            elif dist is None:
                dist = 0.0
            out.append({"x": x, "y": y, "distance": float(dist)})
        return out
    centerline = geom.get("centerline") if isinstance(geom, dict) else None
    if isinstance(centerline, list):
        return [{"x": float(p[0]), "y": float(p[1])} for p in centerline if p and len(p) >= 2]
    return []


def _index_by_driver_number(rows: List[Dict[str, Any]]) -> Tuple[Dict[int, List[Dict[str, Any]]], Optional[Tuple[float, float]]]:
    by_num: Dict[int, List[Dict[str, Any]]] = {}
    times: List[float] = []
    for r in rows or []:
        try:
            num = int(r.get("driverNumber") or r.get("driver_number") or 0)
        except Exception:
            continue
        try:
            ts = float(r.get("timestamp") or 0)
        except Exception:
            ts = 0.0
        if num not in by_num:
            by_num[num] = []
        by_num[num].append({**r, "timestamp": ts})
        times.append(ts)
    for num in by_num:
        by_num[num] = sorted(by_num[num], key=lambda x: float(x.get("timestamp") or 0))
    if not times:
        return by_num, None
    return by_num, (float(min(times)), float(max(times)))


def _build_index(by_num: Dict[int, List[Dict[str, Any]]]) -> Dict[int, Tuple[List[float], List[Dict[str, Any]]]]:
    out: Dict[int, Tuple[List[float], List[Dict[str, Any]]]] = {}
    for num, rows in by_num.items():
        ts = [float(r.get("timestamp") or 0) for r in rows]
        out[int(num)] = (ts, rows)
    return out


def _index_by_timestamp(rows: List[Dict[str, Any]]) -> Tuple[List[float], List[Dict[str, Any]], Optional[Tuple[float, float]]]:
    if not rows:
        return [], [], None
    pairs = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        try:
            ts = float(r.get("timestamp") or 0)
        except Exception:
            ts = 0.0
        pairs.append((ts, {**r, "timestamp": ts}))
    if not pairs:
        return [], [], None
    pairs.sort(key=lambda p: float(p[0]))
    times = [float(t) for t, _ in pairs]
    return times, [r for _, r in pairs], (float(times[0]), float(times[-1]))


def fetch_session_bundle(
    year: int,
    race_name: str,
    session_code: str,
    backend: Optional[TelemetryXBackend] = None,
) -> Dict[str, Any]:
    """Fetch + map backend payloads into a plain dict (safe to compute off the UI thread)."""
    owned = backend is None
    backend = backend or TelemetryXBackend()
    try:
        payload = backend.session_viz(year, race_name, session_code)
        meta = payload.get("metadata", {}) if isinstance(payload, dict) else {}

        # Sidebar drivers
        drivers = payload.get("drivers") or []
        seen = set()
        driver_items = []
        for d in drivers:
            full_name = str(d.get("driverName") or "")
            num = str(d.get("driverNumber") or "")
            team_color = str(d.get("teamColor") or "") or _team_color(str(d.get("teamName") or ""))
            code = _code_from_name(full_name, num or "DRV")
            while code in seen:
                code = f"{code}{num}" if num else f"{code}X"
            seen.add(code)
            driver_items.append(
                {
                    "number": num,
                    "code": code,
                    "name": (full_name.split()[-1] if full_name else code),
                    "team": str(d.get("teamName") or ""),
                    "teamColor": team_color,
                }
            )

        # Timing tower rows
        laps = payload.get("laps") or []
        rows = []
        for lap in laps:
            pos = int(lap.get("position") or 0)
            drv_name = str(lap.get("driverName") or "")
            drv_num = str(lap.get("driverNumber") or "")
            lap_time = str(lap.get("lapTimeFormatted") or "")
            match = next((x for x in driver_items if x.get("number") == drv_num), None)
            team_color = (match.get("teamColor") if match else "") or _team_color(
                str((match or {}).get("team") or lap.get("teamName") or "")
            )
            sectors = [lap.get("sector1"), lap.get("sector2"), lap.get("sector3")]
            rows.append(
                {
                    "position": pos,
                    "code": (match.get("code") if match else _code_from_name(drv_name, drv_num)),
                    "name": (drv_name.split()[-1] if drv_name else drv_num),
                    "teamColor": team_color,
                    "gap": lap.get("gap"),
                    "interval": lap.get("interval"),
                    "lastLap": lap_time,
                    "lastLapSeconds": _parse_lap_time_seconds(lap_time),
                    "sectors": [s for s in sectors if s is not None],
                    "isLeader": pos == 1,
                    "lastLapStatus": "",
                }
            )
        timing_rows = sorted(rows, key=lambda r: r.get("position") or 999)

        # Track data (geometry + positions index)
        geom = payload.get("trackGeometry") or {}
        track_points = _track_points_from_geom(geom)
        track_points = _densify_track_points(track_points)
        distances = [float(p.get("distance") or 0.0) for p in track_points]
        total_dist = distances[-1] if distances else float(len(track_points) - 1)
        track_auto_rotate = True
        try:
            layout = geom.get("layout") if isinstance(geom, dict) else None
            if isinstance(layout, dict) and layout.get("path_coordinates"):
                track_auto_rotate = False
        except Exception:
            track_auto_rotate = True

        def _idx_for_distance(d: float) -> int:
            if not distances:
                return 0
            idx = bisect_left(distances, float(d))
            if idx >= len(distances):
                idx = len(distances) - 1
            return max(0, idx)

        sector_marks: List[Dict[str, Any]] = []
        drs_zones: List[Dict[str, Any]] = []
        corner_marks: List[Dict[str, Any]] = []
        try:
            sectors = geom.get("sectors") if isinstance(geom, dict) else None
            if isinstance(sectors, dict) and track_points:
                ends = [float(s.get("endIndex") or 0) for s in sectors.values() if s.get("endIndex") is not None]
                max_end = max(ends) if ends else 0.0
                for s in sectors.values():
                    end_idx = s.get("endIndex")
                    if end_idx is None or max_end <= 0:
                        continue
                    idx = int((float(end_idx) / max_end) * (len(track_points) - 1))
                    idx = max(0, min(len(track_points) - 1, idx))
                    p = track_points[idx]
                    sector_marks.append(
                        {
                            "x": float(p.get("x") or 0.0),
                            "y": float(p.get("y") or 0.0),
                            "color": str(s.get("color") or ""),
                            "label": str(s.get("name") or ""),
                        }
                    )
            elif isinstance(sectors, list) and track_points:
                total = float(total_dist or 0.0)
                total = total if total > 0 else float(len(track_points) - 1)
                for s in sectors:
                    end_dist = s.get("end_distance")
                    if end_dist is None:
                        continue
                    idx = _idx_for_distance(float(end_dist))
                    p = track_points[idx]
                    sector_marks.append(
                        {
                            "x": float(p.get("x") or 0.0),
                            "y": float(p.get("y") or 0.0),
                            "color": "",
                            "label": f"S{s.get('sector')}",
                        }
                    )
        except Exception:
            sector_marks = []
        try:
            zones = geom.get("drsZones") if isinstance(geom, dict) else None
            if not zones:
                zones = geom.get("drs_zones") if isinstance(geom, dict) else None
            if isinstance(zones, list) and track_points:
                total = float(total_dist or 0.0)
                total = total if total > 0 else float(len(track_points) - 1)
                for z in zones:
                    if isinstance(z, dict):
                        start_val = z.get("startIndex")
                        end_val = z.get("endIndex")
                        if start_val is None or end_val is None:
                            start_val = z.get("activation_point")
                            end_val = z.get("end_point")
                        if start_val is None or end_val is None:
                            continue
                        s_idx = _idx_for_distance(float(start_val))
                        e_idx = _idx_for_distance(float(end_val))
                        if e_idx >= s_idx:
                            pts = track_points[s_idx : e_idx + 1]
                        else:
                            pts = track_points[s_idx:] + track_points[: e_idx + 1]
                        drs_zones.append({"points": pts})
        except Exception:
            drs_zones = []
        try:
            corners = geom.get("corners") if isinstance(geom, dict) else None
            if isinstance(corners, list) and track_points:
                total = float(total_dist or 0.0)
                total = total if total > 0 else float(len(track_points) - 1)
                for c in corners:
                    if not isinstance(c, dict):
                        continue
                    cx = c.get("x")
                    cy = c.get("y")
                    if cx is None or cy is None:
                        dist = c.get("distance")
                        if dist is None:
                            continue
                        idx = _idx_for_distance(float(dist))
                        p = track_points[idx]
                        cx = p.get("x")
                        cy = p.get("y")
                    corner_marks.append(
                        {
                            "x": float(cx or 0.0),
                            "y": float(cy or 0.0),
                            "number": int(c.get("number") or 0),
                        }
                    )
        except Exception:
            corner_marks = []

        positions = payload.get("positions") or []
        if isinstance(positions, list):
            positions = _fit_positions_to_track(positions, track_points)
        by_num, bounds = _index_by_driver_number(positions if isinstance(positions, list) else [])
        positions_index = _build_index(by_num)

        # Race control + weather
        race_control = payload.get("raceControl") or []
        weather_rows = payload.get("weather") or []
        weather_times, weather_series, weather_bounds = _index_by_timestamp(
            [r for r in (weather_rows or []) if isinstance(r, dict)]
        )

        # Initial car dots: take earliest position per driver so the map isn't blank at t=0.
        cars = []
        for num, rows_pos in by_num.items():
            if not rows_pos:
                continue
            first = rows_pos[0]
            match = next((x for x in driver_items if x.get("number") == str(num)), None)
            cars.append(
                {
                    "code": (match.get("code") if match else str(num)),
                    "x": float(first.get("x") or 0),
                    "y": float(first.get("y") or 0),
                    "teamColor": (match.get("teamColor") if match else ""),
                    "isSelected": False,
                }
            )

        # Feature slice: tyre stints
        tyre_stints: List[Dict[str, Any]] = []
        try:
            raw = backend.tyre_features(year, race_name, session_code)
            for r in raw:
                num = str(r.get("driver_number") or "")
                match = next((x for x in driver_items if x.get("number") == num), None)
                tyre_stints.append(
                    {
                        "code": (match.get("code") if match else _code_from_name(str(r.get("driver_name") or ""), num)),
                        "compound": str(r.get("tyre_compound") or ""),
                        "stintNumber": int(r.get("stint_number") or 0),
                        "firstLap": int(r.get("first_lap") or 0),
                        "lastLap": int(r.get("last_lap") or 0),
                        "laps": int(r.get("tyre_laps_in_stint") or 0),
                        "tyreAgeStart": int(r.get("tyre_age_at_stint_start") or 0),
                        "tyreAgeEnd": int(r.get("tyre_age_at_stint_end") or 0),
                    }
                )
        except Exception:
            tyre_stints = []

        features_summary: Dict[str, Any] = {}
        try:
            features_summary = backend.session_features(year, race_name, session_code)
        except Exception:
            features_summary = {}

        return {
            "year": int(year),
            "race_name": str(meta.get("raceName", race_name) or race_name),
            "race_slug": _race_slug(race_name),
            "session_code": str(session_code),
            "session_name": f"{year} {meta.get('raceName', race_name)} {session_code}",
            "circuit_name": str(meta.get("raceName", race_name)),
            "session_type": str(meta.get("sessionType", session_code)),
            "total_laps": int(meta.get("totalLaps", 0) or 0),
            "duration_seconds": int(meta.get("duration", 0) or 0),
            "driver_items": driver_items,
            "timing_rows": timing_rows,
            "track_points": track_points,
            "track_auto_rotate": track_auto_rotate,
            "track_sector_marks": sector_marks,
            "track_drs_zones": drs_zones,
            "track_corners": corner_marks,
            "positions_by_driver_number": by_num,
            "positions_index": positions_index,
            "positions_time_bounds": bounds,
            "track_cars": cars,
            "tyre_stints": sorted(tyre_stints, key=lambda s: (s.get("stintNumber") or 0)),
            "features_summary": features_summary,
            "race_control": [r for r in (race_control or []) if isinstance(r, dict)],
            "weather_index": (weather_times, weather_series),
            "weather_time_bounds": weather_bounds,
        }
    finally:
        if owned:
            backend.close()


def apply_session_bundle(root_store: Any, bundle: Dict[str, Any]) -> None:
    """Apply a fetched bundle onto stores (should run on the Qt/UI thread)."""
    root_store.session.load_state = "loading"

    root_store.session.season = int(bundle.get("year") or 0)
    root_store.session.race_name = str(bundle.get("race_name") or "")
    root_store.session.race_slug = str(bundle.get("race_slug") or "")
    root_store.session.session = str(bundle.get("session_code") or "")
    root_store.session.session_name = str(bundle.get("session_name") or "")
    root_store.session.circuit_name = str(bundle.get("circuit_name") or "")
    root_store.session.session_type = str(bundle.get("session_type") or "")
    root_store.session.total_laps = int(bundle.get("total_laps") or 0)
    root_store.session.duration_seconds = int(bundle.get("duration_seconds") or 0)

    driver_items = bundle.get("driver_items") or []
    root_store.driver.all_drivers = driver_items

    # Defaults (keep existing selection if still valid)
    codes = {str(d.get("code") or "") for d in driver_items}
    if driver_items:
        if not root_store.driver.primary_driver or root_store.driver.primary_driver not in codes:
            root_store.driver.select_primary_driver(str(driver_items[0].get("code") or ""))
        if root_store.driver.compare_driver and root_store.driver.compare_driver not in codes:
            root_store.driver.select_compare_driver("")

    root_store.session.timing_rows = bundle.get("timing_rows") or []
    root_store.session.track_points = bundle.get("track_points") or []
    root_store.session.track_auto_rotate = bool(bundle.get("track_auto_rotate", True))
    root_store.session.track_sector_marks = bundle.get("track_sector_marks") or []
    root_store.session.track_drs_zones = bundle.get("track_drs_zones") or []
    root_store.session.track_corners = bundle.get("track_corners") or []

    root_store.session._positions_by_driver_number = bundle.get("positions_by_driver_number") or {}
    root_store.session._positions_index = bundle.get("positions_index") or {}
    root_store.session._positions_time_bounds = bundle.get("positions_time_bounds")

    root_store.session.track_cars = bundle.get("track_cars") or []
    root_store.session.tyre_stints = bundle.get("tyre_stints") or []
    root_store.session.features_summary = bundle.get("features_summary") or {}
    root_store.session.features_data = []
    root_store.session.features_active_type = ""
    root_store.session.race_control = bundle.get("race_control") or []
    root_store.session.race_control_live = []
    root_store.session.driver_summary = {}

    # Reset derived views for the new session.
    root_store.session.telemetry_snapshot = {}
    root_store.session.telemetry_window = {}
    root_store.session.telemetry_lap_catalog = {}
    root_store.session.telemetry_segments = []
    root_store.session.telemetry_primary_segment = ""
    root_store.session.telemetry_compare_segment = ""
    root_store.session.telemetry_primary_lap = None
    root_store.session.telemetry_compare_lap = None
    root_store.session.telemetry_compare_enabled = False
    root_store.session.telemetry_lap_mode_available = False
    root_store.session.telemetry_lap_mode = False
    root_store.session.telemetry_lap_duration = 0.0
    root_store.session.telemetry_track_cars = []
    root_store.session.telemetry_dominance_zones = []
    root_store.session.telemetry_delta = 0.0
    root_store.session.telemetry_delta_distance = 0.0
    root_store.session.weather_snapshot = {}
    root_store.session.driver_lap_history = {}
    root_store.session._telemetry_by_driver_number = {}
    root_store.session._telemetry_index = {}
    root_store.session._telemetry_time_bounds = None
    root_store.session._weather_index = bundle.get("weather_index")
    root_store.session._weather_time_bounds = bundle.get("weather_time_bounds")
    root_store.session.track_rotation_deg = 0.0

    root_store.session.load_state = "ready"


def _load_telemetry_async(root_store: Any, year: int, race_name: str, session_code: str) -> None:
    """Load raw telemetry in a background thread (best-effort)."""

    def _run() -> None:
        backend = TelemetryXBackend()
        try:
            # Fetch just the currently selected drivers at high rate for charts.
            code_to_num: Dict[str, int] = {}
            for d in getattr(root_store.driver, "all_drivers", []) or []:
                code = str(d.get("code") or "")
                try:
                    code_to_num[code] = int(d.get("number") or 0)
                except Exception:
                    continue
            selected = []
            for code in [getattr(root_store.driver, "primary_driver", ""), getattr(root_store.driver, "compare_driver", "")]:
                num = code_to_num.get(str(code or ""))
                if num:
                    selected.append(int(num))

            payload = backend.session_telemetry(year, race_name, session_code, driver_numbers=selected or None, hz=10.0)
            # Backend returns either:
            # - {driverName: [rows...], ...}
            # - {"telemetry": {driverName: [rows...]}, "telemetryUnavailableReason": "..."} when unavailable
            if isinstance(payload, dict) and "telemetry" in payload:
                tel = payload.get("telemetry")
            else:
                tel = payload
            if not isinstance(tel, dict):
                return

            # Convert backend's name-keyed dict into driver_number keyed rows.
            all_rows: List[Dict[str, Any]] = []
            for _name, rows in tel.items():
                if isinstance(rows, list):
                    all_rows.extend(rows)

            by_num, bounds = _index_by_driver_number(all_rows)
            root_store.session._telemetry_by_driver_number = by_num
            root_store.session._telemetry_index = _build_index(by_num)
            root_store.session._telemetry_time_bounds = bounds

            # Nudge the playback sync so charts populate even while paused.
            try:
                from PySide6.QtCore import QCoreApplication, QTimer
                from app.core.playback.clock_manager import get_clock_manager

                if QCoreApplication.instance() is not None:
                    clock = get_clock_manager()
                    QTimer.singleShot(0, lambda: clock.seek(float(clock.current_time)))
            except Exception:
                pass
        finally:
            backend.close()

    threading.Thread(target=_run, daemon=True).start()


def _load_lap_history_async(root_store: Any, year: int, race_name: str, session_code: str) -> None:
    """Load full lap history for the session in the background."""

    def _median(values: List[float]) -> float:
        vals = sorted([float(v) for v in values if v is not None and float(v) > 0])
        if not vals:
            return 0.0
        mid = len(vals) // 2
        if len(vals) % 2:
            return float(vals[mid])
        return float(vals[mid - 1] + vals[mid]) / 2.0

    def _derive_segments(history: Dict[str, List[Dict[str, Any]]], code: str) -> List[Dict[str, Any]]:
        times: List[float] = []
        laps_times: List[float] = []
        for laps in history.values():
            for lap in laps:
                t = lap.get("lapStartSeconds")
                if t is None:
                    t = lap.get("lapEndSeconds")
                if t is not None:
                    times.append(float(t))
                lt = lap.get("lapTimeSeconds")
                if lt is not None:
                    laps_times.append(float(lt))
        if not times:
            return []
        times = sorted(times)
        gaps = [(times[i + 1] - times[i], i) for i in range(len(times) - 1)]
        med = _median(laps_times)
        threshold = max(120.0, min(600.0, (med or 90.0) * 2.5))
        splits = [idx for gap, idx in sorted(gaps, reverse=True) if gap >= threshold][:2]
        split_times = sorted([times[i + 1] for i in splits])
        if code == "S":
            labels = ["SQ1", "SQ2", "SQ3"]
        else:
            labels = ["Q1", "Q2", "Q3"]
        segments: List[Dict[str, Any]] = []
        start = times[0]
        for i, t in enumerate(split_times):
            segments.append({"label": labels[min(i, len(labels) - 1)], "start": start, "end": t})
            start = t
        segments.append({"label": labels[min(len(segments), len(labels) - 1)], "start": start, "end": times[-1] + 1.0})
        return segments

    def _run() -> None:
        backend = TelemetryXBackend()
        try:
            laps = backend.session_laps(year, race_name, session_code)
            if not isinstance(laps, list):
                return
            code_by_num: Dict[str, str] = {}
            for d in getattr(root_store.driver, "all_drivers", []) or []:
                code_by_num[str(d.get("number") or "")] = str(d.get("code") or "")

            history: Dict[str, List[Dict[str, Any]]] = {}
            for lap in laps:
                if not isinstance(lap, dict):
                    continue
                num = str(lap.get("driverNumber") or "")
                code = code_by_num.get(num) or _code_from_name(str(lap.get("driverName") or ""), num or "DRV")
                lap_time_s = lap.get("lapTime") or lap.get("lapTimeSeconds")
                if lap_time_s is None and lap.get("lapTimeFormatted"):
                    lap_time_s = _parse_lap_time_seconds(str(lap.get("lapTimeFormatted") or ""))
                record = {
                    "lapNumber": int(lap.get("lapNumber") or 0),
                    "lapTime": lap.get("lapTimeFormatted") or "",
                    "lapTimeSeconds": lap_time_s,
                    "lapStartSeconds": lap.get("lapStartSeconds") or lap.get("lapStartTime"),
                    "lapEndSeconds": lap.get("lapEndSeconds") or lap.get("sessionTimeSeconds") or lap.get("session_time_seconds"),
                    "position": lap.get("position"),
                    "tyreCompound": lap.get("tyreCompound"),
                    "isValid": lap.get("isValid"),
                    "sector1": lap.get("sector1"),
                    "sector2": lap.get("sector2"),
                    "sector3": lap.get("sector3"),
                }
                history.setdefault(code, []).append(record)

            for code, rows in history.items():
                rows.sort(key=lambda r: r.get("lapNumber") or 0)

            root_store.session.driver_lap_history = history
            # Build telemetry lap catalog for qualifying/sprint sessions.
            segments = []
            if str(session_code or "").upper() in {"Q", "S"}:
                segments = _derive_segments(history, str(session_code or "").upper())
            segment_labels = [s.get("label") for s in segments if s.get("label")] if segments else []
            catalog: Dict[str, Any] = {}
            for code, laps in history.items():
                driver_laps: List[Dict[str, Any]] = []
                for lap in laps:
                    lt = lap.get("lapTimeSeconds")
                    if lt is None:
                        lt = _parse_lap_time_seconds(lap.get("lapTime") or "")
                    start = lap.get("lapStartSeconds")
                    end = lap.get("lapEndSeconds")
                    if start is None and end is not None and lt:
                        start = float(end) - float(lt)
                    if end is None and start is not None and lt:
                        end = float(start) + float(lt)
                    seg = ""
                    if segment_labels and start is not None:
                        for s in segments:
                            if float(start) >= float(s.get("start") or 0) and float(start) < float(s.get("end") or 0):
                                seg = str(s.get("label") or "")
                                break
                        if not seg and segments:
                            seg = str(segments[-1].get("label") or "")
                    record = {
                        "lapNumber": int(lap.get("lapNumber") or 0),
                        "lapTime": lap.get("lapTime") or "",
                        "lapTimeSeconds": float(lt) if lt is not None else None,
                        "lapStartSeconds": float(start) if start is not None else None,
                        "lapEndSeconds": float(end) if end is not None else None,
                        "segment": seg,
                        "isValid": lap.get("isValid"),
                    }
                    driver_laps.append(record)
                driver_laps.sort(key=lambda r: (r.get("lapTimeSeconds") is None, r.get("lapTimeSeconds") or 9e9))
                seg_map = {}
                if segment_labels:
                    for label in segment_labels:
                        seg_map[label] = [r for r in driver_laps if r.get("segment") == label]
                catalog[code] = {"laps": driver_laps, "segments": seg_map}

            root_store.session.telemetry_lap_catalog = catalog
            root_store.session.telemetry_segments = segment_labels
            root_store.session.telemetry_compare_enabled = False

            primary_code = root_store.driver.primary_driver or ""
            best = None
            if primary_code and primary_code in catalog and catalog[primary_code].get("laps"):
                best = catalog[primary_code]["laps"][0]
            if best:
                root_store.session.telemetry_primary_lap = best
                root_store.session.telemetry_primary_segment = str(best.get("segment") or (segment_labels[0] if segment_labels else ""))
                root_store.session.telemetry_lap_duration = float(best.get("lapTimeSeconds") or 0.0)
            else:
                root_store.session.telemetry_primary_lap = None
                root_store.session.telemetry_primary_segment = segment_labels[0] if segment_labels else ""
                root_store.session.telemetry_lap_duration = 0.0
            root_store.session.telemetry_compare_lap = None
            root_store.session.telemetry_compare_segment = segment_labels[0] if segment_labels else ""
            available = bool(segment_labels) and str(session_code or "").upper() in {"Q", "S"}
            root_store.session.telemetry_lap_mode_available = available
            root_store.session.telemetry_lap_mode = available
            # Update duration from lap bounds if we have them.
            try:
                from app.services.playback_sync import _build_lap_index

                idx = _build_lap_index(history)
                bounds = idx.get("bounds") if isinstance(idx, dict) else None
                if bounds and bounds[1] and float(bounds[1]) > 0:
                    root_store.session.duration_seconds = int(max(root_store.session.duration_seconds, float(bounds[1])))
            except Exception:
                pass
            # Nudge playback to refresh timing tower even if paused.
            try:
                from PySide6.QtCore import QCoreApplication, QTimer
                from app.core.playback.clock_manager import get_clock_manager

                if QCoreApplication.instance() is not None:
                    clock = get_clock_manager()
                    QTimer.singleShot(0, lambda: clock.seek(float(clock.current_time)))
            except Exception:
                pass
        finally:
            backend.close()

    threading.Thread(target=_run, daemon=True).start()


def load_session_into_store(
    root_store: Any,
    year: int,
    race_name: str,
    session_code: str,
    backend: Optional[TelemetryXBackend] = None,
) -> None:
    """Load one session into stores (drivers + session + minimal view models)."""
    bundle = fetch_session_bundle(int(year), str(race_name), str(session_code), backend=backend)
    apply_session_bundle(root_store, bundle)
    _load_telemetry_async(root_store, int(year), str(race_name), str(session_code))
    _load_lap_history_async(root_store, int(year), str(race_name), str(session_code))


def bootstrap_store_from_backend(root_store: Any) -> None:
    """Populate a default session so the UI shows real data immediately."""
    backend = TelemetryXBackend()
    try:
        year = _pick_latest_year(backend.seasons())
        if not year:
            return
        races = backend.races_for_year(year)
        race_obj = _pick_race(races)
        if not race_obj:
            return
        race_name = str(race_obj.get("name") or "")
        session_code = _pick_session_code(race_obj)

        # Store which sessions exist for this race (used for R/Q/S/SS buttons)
        try:
            root_store.session.available_sessions = [str(s) for s in (race_obj.get("sessions") or [])]
        except Exception:
            root_store.session.available_sessions = []

        load_session_into_store(root_store, year, race_name, session_code, backend=backend)
    finally:
        backend.close()


def fetch_default_session_bundle() -> Optional[Dict[str, Any]]:
    """Fetch the default session selection + mapped bundle (safe off the UI thread)."""
    backend = TelemetryXBackend()
    try:
        year = _pick_latest_year(backend.seasons())
        if not year:
            return None
        races = backend.races_for_year(year)
        race_obj = _pick_race(races)
        if not race_obj:
            return None
        race_name = str(race_obj.get("name") or "")
        session_code = _pick_session_code(race_obj)
        available = [str(s) for s in (race_obj.get("sessions") or [])]
        bundle = fetch_session_bundle(year, race_name, session_code, backend=backend)
        return {"available_sessions": available, "bundle": bundle}
    finally:
        backend.close()

"""Sync playback clock -> track/telemetry view models (minimal)."""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from math import ceil
from typing import Any, Dict, List, Optional, Tuple

from PySide6.QtCore import QObject, Slot


def _bounds(times: List[float]) -> Optional[Tuple[float, float]]:
    if not times:
        return None
    return float(times[0]), float(times[-1])


def _pick_nearest_index(sorted_times: List[float], t: float) -> int:
    if not sorted_times:
        return -1
    i = bisect_left(sorted_times, t)
    if i <= 0:
        return 0
    if i >= len(sorted_times):
        return len(sorted_times) - 1
    before = sorted_times[i - 1]
    after = sorted_times[i]
    return i - 1 if abs(t - before) <= abs(after - t) else i


def _interpolate_position(
    times: List[float], rows: List[Dict[str, Any]], t: float
) -> Optional[Dict[str, Any]]:
    if not times or not rows:
        return None
    i = bisect_left(times, t)
    if i <= 0:
        return rows[0]
    if i >= len(times):
        return rows[-1]
    t0, t1 = times[i - 1], times[i]
    r0, r1 = rows[i - 1], rows[i]
    if t1 == t0:
        return r0
    w = (float(t) - float(t0)) / (float(t1) - float(t0))
    try:
        x0, y0 = float(r0.get("x") or 0), float(r0.get("y") or 0)
        x1, y1 = float(r1.get("x") or 0), float(r1.get("y") or 0)
        return {**r0, "x": x0 + (x1 - x0) * w, "y": y0 + (y1 - y0) * w}
    except Exception:
        return r0


def _snap_to_track(x: float, y: float, track_points: List[Dict[str, Any]]) -> Tuple[float, float]:
    if not track_points or len(track_points) < 2:
        return x, y
    best_x, best_y = x, y
    best_d = None
    count = len(track_points)
    for i in range(count):
        p0 = track_points[i]
        p1 = track_points[(i + 1) % count]
        try:
            x0 = float(p0.get("x") or 0.0)
            y0 = float(p0.get("y") or 0.0)
            x1 = float(p1.get("x") or 0.0)
            y1 = float(p1.get("y") or 0.0)
        except Exception:
            continue
        dx = x1 - x0
        dy = y1 - y0
        seg_len2 = dx * dx + dy * dy
        if seg_len2 <= 1e-9:
            continue
        t = ((x - x0) * dx + (y - y0) * dy) / seg_len2
        if t < 0.0:
            t = 0.0
        elif t > 1.0:
            t = 1.0
        px = x0 + dx * t
        py = y0 + dy * t
        d = (x - px) ** 2 + (y - py) ** 2
        if best_d is None or d < best_d:
            best_d = d
            best_x, best_y = px, py
    return best_x, best_y


def _to_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        return float(v)
    except Exception:
        return default


def _parse_lap_time_seconds(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        pass
    try:
        s = str(value)
        if ":" in s:
            m, rest = s.split(":", 1)
            return float(m) * 60.0 + float(rest)
        return float(s)
    except Exception:
        return None


def _lap_bounds(lap: Optional[Dict[str, Any]]) -> Optional[Tuple[float, float]]:
    if not lap:
        return None
    start = lap.get("lapStartSeconds")
    end = lap.get("lapEndSeconds")
    lt = lap.get("lapTimeSeconds")
    if lt is None:
        lt = _parse_lap_time_seconds(lap.get("lapTime"))
    try:
        if start is None and end is not None and lt:
            start = float(end) - float(lt)
        if end is None and start is not None and lt:
            end = float(start) + float(lt)
    except Exception:
        pass
    if start is None or end is None:
        return None
    return float(start), float(end)


def _build_distance_series(times: List[float], rows: List[Dict[str, Any]]) -> Tuple[List[float], List[float]]:
    if not times or not rows:
        return [], []
    dist = 0.0
    out_dist: List[float] = []
    out_time: List[float] = []
    prev_t = float(times[0])
    for t, r in zip(times, rows):
        tt = float(t)
        dt = max(0.0, tt - prev_t)
        speed = _to_float(r.get("speed"))
        dist += (speed * 1000.0 / 3600.0) * dt
        out_dist.append(dist)
        out_time.append(tt)
        prev_t = tt
    total = out_dist[-1] if out_dist else 0.0
    if total <= 0:
        return [], []
    frac = [d / total for d in out_dist]
    return frac, out_time


def _time_at_fraction(fracs: List[float], times: List[float], f: float) -> Optional[float]:
    if not fracs or not times:
        return None
    if f <= fracs[0]:
        return times[0]
    if f >= fracs[-1]:
        return times[-1]
    i = bisect_left(fracs, f)
    if i <= 0:
        return times[0]
    if i >= len(fracs):
        return times[-1]
    f0, f1 = fracs[i - 1], fracs[i]
    t0, t1 = times[i - 1], times[i]
    if f1 == f0:
        return t0
    w = (f - f0) / (f1 - f0)
    return float(t0 + (t1 - t0) * w)


def _build_lap_index(history: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    index: Dict[str, Any] = {"drivers": {}}
    min_start: Optional[float] = None
    max_end: Optional[float] = None
    for code, laps in (history or {}).items():
        if not laps:
            continue
        ordered = sorted(laps, key=lambda r: r.get("lapNumber") or 0)
        starts: List[float] = []
        entries: List[Dict[str, Any]] = []
        t = 0.0
        for lap in ordered:
            lt = lap.get("lapTimeSeconds")
            if lt is None:
                lt = _parse_lap_time_seconds(lap.get("lapTime"))
            if lt is None:
                continue
            start = lap.get("lapStartSeconds")
            end = lap.get("lapEndSeconds")
            if start is None and end is not None:
                start = float(end) - float(lt)
            if end is None and start is not None:
                end = float(start) + float(lt)
            if start is None:
                start = t
            if end is None:
                end = float(start) + float(lt)
            entries.append(
                {
                    "lapNumber": lap.get("lapNumber") or 0,
                    "start": float(start),
                    "end": float(end),
                    "lapTime": lap.get("lapTime") or "",
                    "lapTimeSeconds": float(lt),
                    "sectors": [lap.get("sector1"), lap.get("sector2"), lap.get("sector3")],
                }
            )
            starts.append(float(start))
            t = float(end)
            if min_start is None or float(start) < min_start:
                min_start = float(start)
            if max_end is None or float(end) > max_end:
                max_end = float(end)
        if entries:
            index["drivers"][code] = {"starts": starts, "laps": entries, "total": t}
    if min_start is not None and max_end is not None:
        index["bounds"] = (float(min_start), float(max_end))
    return index


def _slice_window(
    times: List[float],
    rows: List[Dict[str, Any]],
    t0: float,
    t1: float,
    max_points: int,
) -> Tuple[List[float], List[Dict[str, Any]]]:
    if not times or not rows or t1 <= t0:
        return [], []
    left = bisect_left(times, t0)
    right = bisect_right(times, t1)
    if right <= left:
        return [], []
    t_slice = times[left:right]
    r_slice = rows[left:right]
    if max_points > 0 and len(t_slice) > max_points:
        step = int(ceil(len(t_slice) / float(max_points)))
        t_slice = t_slice[::step]
        r_slice = r_slice[::step]
    return t_slice, r_slice


class PlaybackSync(QObject):
    """Keeps SessionStore trackCars + telemetrySnapshot updated based on clock time."""

    def __init__(self, root_store: Any, parent: Optional[QObject] = None):
        super().__init__(parent)
        self._root_store = root_store
        self._last_window_update_s: float = -1.0
        self._last_timing_update_s: float = -1.0

    def _progress_to_time(self, progress: float, bounds: Optional[Tuple[float, float]]) -> Optional[float]:
        if not bounds:
            return None
        lo, hi = bounds
        return lo + (hi - lo) * max(0.0, min(1.0, float(progress)))

    def _driver_code_to_number(self) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for d in getattr(self._root_store.driver, "all_drivers", []) or []:
            code = str(d.get("code") or "")
            num = d.get("number")
            try:
                out[code] = int(num)
            except Exception:
                continue
        return out

    def _driver_number_to_meta(self) -> Dict[int, Dict[str, str]]:
        out: Dict[int, Dict[str, str]] = {}
        for d in getattr(self._root_store.driver, "all_drivers", []) or []:
            try:
                num = int(d.get("number") or 0)
            except Exception:
                continue
            out[num] = {
                "code": str(d.get("code") or ""),
                "teamColor": str(d.get("teamColor") or ""),
            }
        return out

    @Slot(float)
    def on_time_changed(self, current_time_s: float) -> None:
        if not self._root_store:
            return
        session = self._root_store.session
        duration_s = float(getattr(session, "duration_seconds", 0) or 0)
        if duration_s <= 0:
            return

        lap_mode = bool(getattr(session, "telemetry_lap_mode", False))
        primary_lap = getattr(session, "telemetry_primary_lap", None) if lap_mode else None
        compare_enabled = bool(getattr(session, "telemetry_compare_enabled", False))
        compare_lap = getattr(session, "telemetry_compare_lap", None) if lap_mode and compare_enabled else None
        lap_bounds = _lap_bounds(primary_lap) if lap_mode else None
        lap_duration = 0.0
        if lap_bounds:
            lap_duration = max(0.1, float(lap_bounds[1] - lap_bounds[0]))

        if lap_mode and lap_duration > 0:
            progress = max(0.0, min(1.0, float(current_time_s) / lap_duration))
        else:
            progress = float(current_time_s) / duration_s
        pos_index = getattr(session, "_positions_index", {}) or {}
        tel_index = getattr(session, "_telemetry_index", {}) or {}

        pos_bounds = getattr(session, "_positions_time_bounds", None)
        tel_bounds = getattr(session, "_telemetry_time_bounds", None)

        # Lap history index (for session time bounds + timing tower)
        history = getattr(session, "driver_lap_history", {}) or {}
        lap_index = None
        if history:
            if getattr(session, "_lap_index_src", None) is not history:
                session._lap_index = _build_lap_index(history)
                session._lap_index_src = history
            lap_index = getattr(session, "_lap_index", {}) or {}

        # Choose a session-time bounds source (lap history → positions → telemetry)
        session_bounds = None
        if isinstance(lap_index, dict):
            session_bounds = lap_index.get("bounds")
        if not session_bounds:
            session_bounds = pos_bounds or tel_bounds
        if lap_mode and lap_bounds:
            t_session = float(lap_bounds[0] + progress * lap_duration)
        else:
            t_session = self._progress_to_time(progress, session_bounds)

        # Telemetry snapshot for primary/compare (align to session time)
        t_tel = None
        if tel_bounds:
            if t_session is not None:
                t_tel = max(float(tel_bounds[0]), min(float(tel_bounds[1]), float(t_session)))
            else:
                t_tel = self._progress_to_time(progress, tel_bounds)
        code_to_num = self._driver_code_to_number()
        primary = self._root_store.driver.primary_driver or ""
        compare = self._root_store.driver.compare_driver or ""
        snap: Dict[str, Any] = {"time": float(t_session or current_time_s), "primary": None, "compare": None}
        t_tel_primary = t_tel
        t_tel_compare = t_tel
        if lap_mode and compare_lap:
            c_bounds = _lap_bounds(compare_lap)
            if c_bounds:
                c_duration = max(0.1, float(c_bounds[1] - c_bounds[0]))
                t_tel_compare = float(c_bounds[0] + progress * c_duration)
                if tel_bounds:
                    t_tel_compare = max(float(tel_bounds[0]), min(float(tel_bounds[1]), float(t_tel_compare)))

        if t_tel_primary is not None and tel_index:
            for key, code in [("primary", primary), ("compare", compare)]:
                if key == "compare" and (not compare_enabled or not compare):
                    continue
                if not code:
                    continue
                num = code_to_num.get(code)
                if not num or num not in tel_index:
                    continue
                times, rows = tel_index[num]
                t_sel = t_tel_primary if key == "primary" else t_tel_compare
                if t_sel is None:
                    continue
                idx = _pick_nearest_index(times, t_sel)
                if idx < 0:
                    continue
                r = rows[idx]
                snap[key] = {
                    "code": code,
                    "speed": r.get("speed"),
                    "throttle": r.get("throttle"),
                    "brake": r.get("brake"),
                    "gear": r.get("gear"),
                    "rpm": r.get("rpm"),
                    "drs": r.get("drs"),
                }
        session.telemetry_snapshot = snap

        # Features live snapshot (best-effort, keyed by active feature type)
        active = getattr(session, "features_active_type", "") or ""
        data = getattr(session, "features_data", []) or []
        live: Dict[str, Any] = {}
        if active and isinstance(data, list) and data:
            if active in {"lap", "tyre", "race_context", "traffic", "points", "position", "overtakes"}:
                # Use nearest lap to current time
                lap_index = None
                if history:
                    lap_index = getattr(session, "_lap_index", None)
                lap_no = None
                if lap_index and isinstance(lap_index, dict) and t_session is not None:
                    primary = self._root_store.driver.primary_driver or ""
                    info = lap_index.get("drivers", {}).get(primary)
                    if info:
                        starts = info.get("starts") or []
                        laps = info.get("laps") or []
                        i = bisect_right(starts, float(t_session)) - 1
                        if i < 0:
                            i = 0
                        if i >= len(laps):
                            i = len(laps) - 1
                        lap_no = (laps[i] or {}).get("lapNumber")
                if lap_no is not None:
                    driver = self._root_store.driver.primary_driver or ""
                    driver_name = ""
                    for d in getattr(self._root_store.driver, "all_drivers", []) or []:
                        if str(d.get("code") or "") == driver:
                            driver_name = str(d.get("name") or "")
                            break
                    for row in data:
                        if not isinstance(row, dict):
                            continue
                        if row.get("lap_number") != lap_no and row.get("lapNumber") != lap_no:
                            continue
                        if driver_name and row.get("driver_name") and str(row.get("driver_name")).upper() != driver_name.upper():
                            continue
                        live = row
                        break
            elif active == "comparison":
                driver = self._root_store.driver.primary_driver or ""
                compare = self._root_store.driver.compare_driver or ""
                if driver and compare:
                    for row in data:
                        if not isinstance(row, dict):
                            continue
                        d1 = str(row.get("driver_1") or row.get("driver1") or "")
                        d2 = str(row.get("driver_2") or row.get("driver2") or "")
                        if (d1 == driver and d2 == compare) or (d1 == compare and d2 == driver):
                            live = row
                            break
        session.features_live = live

        # Absolute session timestamp (aligns telemetry/positions/laps/race control)
        if t_session is not None and pos_bounds is not None:
            t_pos = max(float(pos_bounds[0]), min(float(pos_bounds[1]), float(t_session)))
        else:
            t_pos = self._progress_to_time(progress, pos_bounds)

        # Track cars (use absolute session timestamp when available)
        meta_by_num = self._driver_number_to_meta()
        cars: List[Dict[str, Any]] = []
        track_points = getattr(session, "track_points", []) or []
        if t_pos is not None and pos_index:
            for num, pack in pos_index.items():
                times, rows = pack
                r = _interpolate_position(times, rows, float(t_pos))
                if not r:
                    continue
                m = meta_by_num.get(int(num), {"code": str(num), "teamColor": ""})
                code = m["code"] or str(num)
                x = float(r.get("x") or 0)
                y = float(r.get("y") or 0)
                if track_points:
                    x, y = _snap_to_track(x, y, track_points)
                cars.append(
                    {
                        "code": code,
                        "x": x,
                        "y": y,
                        "teamColor": m["teamColor"],
                        "isSelected": code == (self._root_store.driver.primary_driver or ""),
                    }
                )
        session.track_cars = cars

        # Telemetry track overlay (primary + compare only, lap-synced)
        telemetry_cars: List[Dict[str, Any]] = []
        if lap_mode and t_session is not None:
            if primary:
                num = code_to_num.get(primary)
                if num and num in pos_index:
                    times, rows = pos_index[num]
                    r = _interpolate_position(times, rows, float(t_session))
                    if r:
                        x = float(r.get("x") or 0)
                        y = float(r.get("y") or 0)
                        if track_points:
                            x, y = _snap_to_track(x, y, track_points)
                        meta = meta_by_num.get(int(num), {})
                        telemetry_cars.append(
                            {"code": primary, "x": x, "y": y, "teamColor": meta.get("teamColor") or "", "isSelected": True}
                        )
            if compare_enabled and compare and compare_lap:
                cb = _lap_bounds(compare_lap)
                if cb:
                    c_duration = max(0.1, float(cb[1] - cb[0]))
                    t_cmp = float(cb[0] + progress * c_duration)
                    num = code_to_num.get(compare)
                    if num and num in pos_index:
                        times, rows = pos_index[num]
                        r = _interpolate_position(times, rows, float(t_cmp))
                        if r:
                            x = float(r.get("x") or 0)
                            y = float(r.get("y") or 0)
                            if track_points:
                                x, y = _snap_to_track(x, y, track_points)
                            meta = meta_by_num.get(int(num), {})
                            telemetry_cars.append(
                                {"code": compare, "x": x, "y": y, "teamColor": meta.get("teamColor") or "", "isSelected": False}
                            )
        session.telemetry_track_cars = telemetry_cars

        # Track dominance zones (lap compare)
        if compare_enabled and compare and lap_mode and lap_bounds and compare_lap and tel_index and track_points:
            cache_key = (
                primary,
                compare,
                int((primary_lap or {}).get("lapNumber") or 0),
                int((compare_lap or {}).get("lapNumber") or 0),
            )
            if getattr(session, "_dominance_cache_key", None) != cache_key:
                session._dominance_cache_key = cache_key
                zones: List[Dict[str, Any]] = []
                try:
                    cb = _lap_bounds(compare_lap)
                    if cb:
                        p_num = code_to_num.get(primary)
                        c_num = code_to_num.get(compare)
                        if p_num and c_num and p_num in tel_index and c_num in tel_index:
                            p_times, p_rows = tel_index[p_num]
                            c_times, c_rows = tel_index[c_num]
                            p_t, p_r = _slice_window(p_times, p_rows, lap_bounds[0], lap_bounds[1], max_points=0)
                            c_t, c_r = _slice_window(c_times, c_rows, cb[0], cb[1], max_points=0)
                            p_frac, p_time = _build_distance_series(p_t, p_r)
                            c_frac, c_time = _build_distance_series(c_t, c_r)
                            if p_frac and c_frac:
                                total_dist = float(track_points[-1].get("distance") or 0.0) if track_points else 0.0
                                if total_dist <= 0:
                                    total_dist = float(len(track_points) - 1) if track_points else 1.0
                                prev = None
                                start_dist = 0.0
                                for pt in track_points:
                                    f = (float(pt.get("distance") or 0.0) / total_dist) if total_dist else 0.0
                                    tp = _time_at_fraction(p_frac, p_time, f)
                                    tc = _time_at_fraction(c_frac, c_time, f)
                                    if tp is None or tc is None:
                                        continue
                                    leader = primary if tp <= tc else compare
                                    if prev is None:
                                        prev = leader
                                        start_dist = float(pt.get("distance") or 0.0)
                                    elif leader != prev:
                                        zones.append(
                                            {
                                                "startDistance": start_dist,
                                                "endDistance": float(pt.get("distance") or 0.0),
                                                "driver": prev,
                                            }
                                        )
                                        prev = leader
                                        start_dist = float(pt.get("distance") or 0.0)
                                if prev is not None:
                                    zones.append(
                                        {
                                            "startDistance": start_dist,
                                            "endDistance": float(track_points[-1].get("distance") or 0.0),
                                            "driver": prev,
                                        }
                                    )
                except Exception:
                    zones = []
                # attach colors
                for z in zones:
                    code = z.get("driver")
                    color = ""
                    for d in getattr(self._root_store.driver, "all_drivers", []) or []:
                        if str(d.get("code") or "") == code:
                            color = str(d.get("teamColor") or "")
                            break
                    z["color"] = color
                session.telemetry_dominance_zones = zones
            # Delta at current progress
            try:
                cb = _lap_bounds(compare_lap)
                if cb:
                    p_num = code_to_num.get(primary)
                    c_num = code_to_num.get(compare)
                    if p_num and c_num and p_num in tel_index and c_num in tel_index:
                        p_times, p_rows = tel_index[p_num]
                        c_times, c_rows = tel_index[c_num]
                        p_t, p_r = _slice_window(p_times, p_rows, lap_bounds[0], lap_bounds[1], max_points=0)
                        c_t, c_r = _slice_window(c_times, c_rows, cb[0], cb[1], max_points=0)
                        p_frac, p_time = _build_distance_series(p_t, p_r)
                        c_frac, c_time = _build_distance_series(c_t, c_r)
                        if p_frac and c_frac:
                            f = progress
                            tp = _time_at_fraction(p_frac, p_time, f)
                            tc = _time_at_fraction(c_frac, c_time, f)
                            if tp is not None and tc is not None:
                                session.telemetry_delta = float(tc - tp)
                                if track_points:
                                    total_dist = float(track_points[-1].get("distance") or 0.0)
                                    if total_dist <= 0:
                                        total_dist = float(len(track_points) - 1)
                                    session.telemetry_delta_distance = float(max(0.0, min(1.0, progress)) * total_dist)
            except Exception:
                pass
        else:
            session.telemetry_delta_distance = 0.0

        # Weather snapshot (nearest point on the weather time series)
        weather_pack = getattr(session, "_weather_index", None)
        bounds_weather = getattr(session, "_weather_time_bounds", None)
        t_wx = self._progress_to_time(progress, bounds_weather) if bounds_weather else None
        if t_wx is not None and weather_pack and isinstance(weather_pack, tuple) and len(weather_pack) == 2:
            times_w, rows_w = weather_pack
            if isinstance(times_w, list) and isinstance(rows_w, list) and times_w and rows_w:
                idx = _pick_nearest_index(times_w, float(t_wx))
                if 0 <= idx < len(rows_w):
                    session.weather_snapshot = rows_w[idx]
                else:
                    session.weather_snapshot = {}
            else:
                session.weather_snapshot = {}
        else:
            session.weather_snapshot = {}

        # Race control live feed (show only events up to current session time)
        if t_session is not None:
            rc = getattr(session, "race_control", []) or []
            if rc:
                session.race_control_live = [r for r in rc if (r.get("timestamp") or 0) <= float(t_session)]
            else:
                session.race_control_live = []

        # Timing tower (live positions + gaps) derived from lap history
        if history:
            if t_session is not None:
                if abs(float(t_session) - self._last_timing_update_s) >= (1.0 / 60.0):
                    self._last_timing_update_s = float(t_session)
                    lap_index = lap_index or {}
                    drivers_meta = {
                        str(d.get("code") or ""): d for d in getattr(self._root_store.driver, "all_drivers", []) or []
                    }
                    progress_rows = []
                    for code, info in lap_index.get("drivers", {}).items():
                        starts = info.get("starts") or []
                        laps = info.get("laps") or []
                        if not starts or not laps:
                            continue
                        i = bisect_right(starts, float(t_session)) - 1
                        if i < 0:
                            i = 0
                        if i >= len(laps):
                            i = len(laps) - 1
                        lap = laps[i]
                        lt = float(lap.get("lapTimeSeconds") or 0.0)
                        prog = 0.0 if lt <= 0 else max(0.0, min(1.0, (float(t_session) - lap["start"]) / lt))
                        abs_time = float(lap["start"]) + prog * (lt if lt > 0 else 1.0)
                        progress_rows.append(
                            {
                                "code": code,
                                "lapIndex": i,
                                "progress": prog,
                                "absTime": abs_time,
                                "lap": lap,
                            }
                        )

                    progress_rows.sort(key=lambda r: (r["lapIndex"], r["progress"]), reverse=True)
                    if progress_rows:
                        leader = progress_rows[0]
                        leader_lap = leader["lapIndex"]
                        leader_time = leader["absTime"]
                        rows = []
                        prev = None
                        for idx, r in enumerate(progress_rows):
                            code = r["code"]
                            meta = drivers_meta.get(code, {})
                            lap_idx = r["lapIndex"]
                            last_completed = None
                            if lap_idx > 0 and lap_idx - 1 < len(info := lap_index["drivers"][code]["laps"]):
                                last_completed = info[lap_idx - 1]
                            gap_type = "lap" if lap_idx < leader_lap else "gap"
                            gap_val = None if gap_type == "lap" else max(0.0, r["absTime"] - leader_time)
                            interval_type = "interval"
                            interval_val = None
                            if prev:
                                if lap_idx < prev["lapIndex"]:
                                    interval_type = "lap"
                                else:
                                    interval_val = max(0.0, r["absTime"] - prev["absTime"])
                            prev = r
                            rows.append(
                                {
                                    "position": idx + 1,
                                    "code": code,
                                    "name": meta.get("name") or code,
                                    "teamColor": meta.get("teamColor") or "",
                                    "gap": gap_val,
                                    "gapType": gap_type,
                                    "interval": interval_val,
                                    "intervalType": interval_type,
                                    "lastLap": (last_completed or {}).get("lapTime") or "",
                                    "lastLapSeconds": (last_completed or {}).get("lapTimeSeconds") or 0.0,
                                    "sectors": (last_completed or {}).get("sectors") or [],
                                    "isLeader": idx == 0,
                                    "lastLapStatus": "",
                                }
                            )
                        session.timing_rows = rows

        # Telemetry window (10s sliding window, preloaded; downsampled for UI)
        # Throttle window updates to ~10Hz to keep UI smooth.
        if self._last_window_update_s >= 0 and abs(float(current_time_s) - self._last_window_update_s) < 0.1:
            return
        self._last_window_update_s = float(current_time_s)

        bounds_tel = getattr(session, "_telemetry_time_bounds", None)
        if t_tel is None or not bounds_tel or not tel_index:
            session.telemetry_window = {}
            return

        if lap_mode and lap_bounds:
            t_lo, t_hi = lap_bounds
        else:
            t_lo, t_hi = bounds_tel
        desired_window_s = 10.0
        max_window_s = max(0.1, float(t_hi) - float(t_lo))
        window_s = min(desired_window_s, max_window_s)
        half = window_s / 2.0
        t_center = float(t_tel_primary or t_tel)
        t0 = max(float(t_lo), t_center - half)
        t1 = min(float(t_hi), t_center + half)
        # Keep scale stable when clamped at edges
        if (t1 - t0) < window_s:
            if t0 <= float(t_lo) + 1e-9:
                t1 = min(float(t_hi), t0 + window_s)
            elif t1 >= float(t_hi) - 1e-9:
                t0 = max(float(t_lo), t1 - window_s)

        def series_for(code: str) -> Optional[Dict[str, Any]]:
            if not code:
                return None
            num = code_to_num.get(code)
            if not num or num not in tel_index:
                return None
            times, rows = tel_index[num]
            t0_use, t1_use = t0, t1
            if lap_mode and compare_lap and code == compare:
                cb = _lap_bounds(compare_lap)
                if cb:
                    c_duration = max(0.1, float(cb[1] - cb[0]))
                    rel0 = (float(t0) - float(lap_bounds[0])) / max(0.1, lap_duration) if lap_bounds else 0.0
                    rel1 = (float(t1) - float(lap_bounds[0])) / max(0.1, lap_duration) if lap_bounds else 1.0
                    t0_use = float(cb[0] + rel0 * c_duration)
                    t1_use = float(cb[0] + rel1 * c_duration)
            t_slice, r_slice = _slice_window(times, rows, t0_use, t1_use, max_points=220)
            if not t_slice:
                return {"code": code, "t": [], "speed": [], "throttle": [], "brake": [], "gear": []}
            if lap_mode and compare_lap and code == compare and t1_use != t0_use:
                t_rel = [((float(t) - float(t0_use)) / (float(t1_use) - float(t0_use))) * (float(t1) - float(t0)) for t in t_slice]
            else:
                t_rel = [float(t) - float(t0) for t in t_slice]
            return {
                "code": code,
                "t": t_rel,
                "speed": [_to_float(r.get("speed")) for r in r_slice],
                "throttle": [_to_float(r.get("throttle")) for r in r_slice],
                "brake": [_to_float(r.get("brake")) for r in r_slice],
                "gear": [_to_float(r.get("gear")) for r in r_slice],
            }

        session.telemetry_window = {
            "windowS": float(t1 - t0),
            "t0": float(t0),
            "t1": float(t1),
            "primary": series_for(primary),
            "compare": (series_for(compare) if compare_enabled else None),
        }

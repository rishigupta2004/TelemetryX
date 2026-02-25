#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple


QML_ERROR_RE = re.compile(r"(ReferenceError|TypeError|recursive rearrange|QML .*Error)", re.IGNORECASE)


def _load_events(log_path: Path) -> tuple[List[Dict[str, Any]], int]:
    events: List[Dict[str, Any]] = []
    qml_errors = 0
    with log_path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if QML_ERROR_RE.search(line):
                qml_errors += 1
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                item = json.loads(line)
            except Exception:
                continue
            if isinstance(item, dict) and "event" in item:
                events.append(item)
    return events, qml_errors


def _pct(num: float, den: float) -> float:
    if den <= 0:
        return 0.0
    return (num / den) * 100.0


def _nearest_dt_p95(pos_samples: Sequence[Dict[str, Any]], warmup_seconds: float) -> Tuple[float, int]:
    values: List[float] = []
    for e in pos_samples:
        if e.get("nearest_dt") is None:
            continue
        try:
            t = float(e.get("t") or 0.0)
            if t < warmup_seconds:
                continue
            values.append(float(e.get("nearest_dt")))
        except Exception:
            continue
    values.sort()
    if not values:
        return 0.0, 0
    idx = int((len(values) - 1) * 0.95)
    idx = max(0, min(idx, len(values) - 1))
    return values[idx], len(values)


def _check(name: str, passed: bool, detail: str, *, skipped: bool = False) -> Dict[str, Any]:
    status = "skip" if skipped else ("pass" if passed else "fail")
    return {
        "name": name,
        "status": status,
        "passed": bool(passed),
        "detail": detail,
    }


def analyze_log(log_path: Path, args: argparse.Namespace) -> Dict[str, Any]:
    events, qml_errors = _load_events(log_path)
    tower_ticks = [e for e in events if e.get("event") == "tower_tick"]
    tower_rows = [e for e in events if e.get("event") == "tower_row"]
    pos_samples = [e for e in events if e.get("event") == "pos_sample"]

    total_ticks = len(tower_ticks)
    non_empty_ticks = sum(1 for e in tower_ticks if int(e.get("rows") or 0) > 0)
    non_empty_pct = _pct(non_empty_ticks, total_ticks)
    lap_index_driver_count_max = max((int(e.get("lap_index_driver_count") or 0) for e in tower_ticks), default=0)
    history_driver_count_max = max((int(e.get("history_driver_count") or 0) for e in tower_ticks), default=0)

    total_rows_from_ticks = sum(int(e.get("rows") or 0) for e in tower_ticks)
    fallback_gap_rows = sum(int(e.get("fallback_gap_rows") or 0) for e in tower_ticks)
    fallback_interval_rows = sum(int(e.get("fallback_interval_rows") or 0) for e in tower_ticks)
    missing_sector_rows = sum(int(e.get("missing_sector_rows") or 0) for e in tower_ticks)
    lap_regressions = sum(int(e.get("lap_regressions") or 0) for e in tower_ticks)

    if total_rows_from_ticks == 0 and tower_rows:
        total_rows_from_ticks = len(tower_rows)
        fallback_gap_rows = sum(1 for e in tower_rows if e.get("gap_source") == "distance_fallback")
        fallback_interval_rows = sum(1 for e in tower_rows if e.get("interval_source") == "distance_fallback")
        missing_sector_rows = sum(1 for e in tower_rows if int(e.get("sectors_len") or 0) < 3)

    fallback_gap_pct = _pct(fallback_gap_rows, total_rows_from_ticks)
    fallback_interval_pct = _pct(fallback_interval_rows, total_rows_from_ticks)
    missing_sector_pct = _pct(missing_sector_rows, total_rows_from_ticks)
    leader_position_violations = sum(
        1
        for e in tower_ticks
        if int(e.get("rows") or 0) > 0
        and e.get("leader_position") is not None
        and int(e.get("leader_position") or 0) != 1
    )

    max_t = 0.0
    max_lap = 0
    for e in tower_ticks:
        try:
            max_t = max(max_t, float(e.get("t") or 0.0))
        except Exception:
            pass
        try:
            max_lap = max(max_lap, int(e.get("lap") or 0))
        except Exception:
            pass
    if max_lap <= 0:
        for e in tower_rows:
            try:
                max_lap = max(max_lap, int(e.get("lap") or 0))
            except Exception:
                pass

    p95_nearest_dt, nearest_count = _nearest_dt_p95(pos_samples, float(args.warmup_seconds))

    sector_gate_active = bool((max_t >= float(args.min_seconds_for_sector_gate)) and (max_lap >= int(args.min_lap_for_sector_gate)))
    lap_progress_data_ready = bool(lap_index_driver_count_max > 0 or history_driver_count_max > 0)
    lap_progress_gate_active = bool(max_t >= float(args.min_seconds_for_lap_progression_gate) and lap_progress_data_ready)
    pos_gate_active = nearest_count > 0

    checks: List[Dict[str, Any]] = []
    checks.append(
        _check(
            "tower_tick_count_min",
            total_ticks >= int(args.min_tower_ticks),
            f"{total_ticks} >= {int(args.min_tower_ticks)}",
        )
    )
    checks.append(
        _check(
            "pos_sample_count_min",
            len(pos_samples) >= int(args.min_pos_samples),
            f"{len(pos_samples)} >= {int(args.min_pos_samples)}",
        )
    )
    checks.append(
        _check(
            "tower_ticks_present",
            total_ticks > 0,
            f"{total_ticks} > 0",
        )
    )
    if total_ticks > 0:
        checks.append(
            _check(
                "non_empty_ticks_pct",
                non_empty_pct >= args.min_non_empty_pct,
                f"{non_empty_pct:.2f}% >= {args.min_non_empty_pct:.2f}%",
            )
        )
    else:
        checks.append(
            _check(
                "non_empty_ticks_pct",
                True,
                "SKIP (no tower_tick events found)",
                skipped=True,
            )
        )

    checks.extend(
        [
            _check("fallback_gap_pct", fallback_gap_pct <= args.max_fallback_gap_pct, f"{fallback_gap_pct:.2f}% <= {args.max_fallback_gap_pct:.2f}%"),
            _check(
                "fallback_interval_pct",
                fallback_interval_pct <= args.max_fallback_interval_pct,
                f"{fallback_interval_pct:.2f}% <= {args.max_fallback_interval_pct:.2f}%",
            ),
        ]
    )

    if sector_gate_active:
        checks.append(
            _check(
                "missing_sector_pct",
                missing_sector_pct <= args.max_missing_sector_pct,
                f"{missing_sector_pct:.2f}% <= {args.max_missing_sector_pct:.2f}%",
            )
        )
    else:
        checks.append(
            _check(
                "missing_sector_pct",
                True,
                (
                    "SKIP "
                    f"(max_t={max_t:.2f}s, max_lap={max_lap}; "
                    f"need t>={args.min_seconds_for_sector_gate:.0f}s and lap>={args.min_lap_for_sector_gate})"
                ),
                skipped=True,
            )
        )

    checks.extend(
        [
            _check("lap_regressions", lap_regressions == 0, f"{lap_regressions} == 0"),
            _check("leader_position_consistency", leader_position_violations == 0, f"{leader_position_violations} == 0"),
            _check("qml_errors", qml_errors == 0, f"{qml_errors} == 0"),
        ]
    )

    if lap_progress_gate_active:
        checks.append(
            _check(
                "lap_progression_min_lap",
                max_lap >= int(args.min_lap_for_progression_gate),
                f"max_lap={max_lap} >= {int(args.min_lap_for_progression_gate)}",
            )
        )
    else:
        if max_t < float(args.min_seconds_for_lap_progression_gate):
            skip_detail = f"SKIP (max_t={max_t:.2f}s < gate_t={float(args.min_seconds_for_lap_progression_gate):.0f}s)"
        else:
            skip_detail = (
                "SKIP "
                f"(lap history/index unavailable; "
                f"lap_index_driver_count_max={lap_index_driver_count_max}, "
                f"history_driver_count_max={history_driver_count_max})"
            )
        checks.append(
            _check(
                "lap_progression_min_lap",
                True,
                skip_detail,
                skipped=True,
            )
        )

    if pos_gate_active:
        checks.append(
            _check(
                "pos_nearest_dt_p95",
                p95_nearest_dt <= args.max_pos_nearest_dt_p95,
                f"{p95_nearest_dt:.3f}s <= {args.max_pos_nearest_dt_p95:.3f}s",
            )
        )
    else:
        checks.append(
            _check(
                "pos_nearest_dt_p95",
                True,
                f"SKIP (no pos_sample at/after warmup={args.warmup_seconds:.1f}s)",
                skipped=True,
            )
        )

    failed = sum(1 for c in checks if c["status"] == "fail")
    passed = sum(1 for c in checks if c["status"] == "pass")
    skipped = sum(1 for c in checks if c["status"] == "skip")

    metrics = {
        "tower_ticks": int(total_ticks),
        "tower_rows": int(len(tower_rows)),
        "pos_samples": int(len(pos_samples)),
        "rows_total": int(total_rows_from_ticks),
        "qml_errors": int(qml_errors),
        "max_t": float(max_t),
        "max_lap": int(max_lap),
        "lap_index_driver_count_max": int(lap_index_driver_count_max),
        "history_driver_count_max": int(history_driver_count_max),
        "non_empty_ticks_pct": float(non_empty_pct),
        "fallback_gap_pct": float(fallback_gap_pct),
        "fallback_interval_pct": float(fallback_interval_pct),
        "missing_sector_pct": float(missing_sector_pct),
        "lap_regressions": int(lap_regressions),
        "leader_position_violations": int(leader_position_violations),
        "pos_nearest_dt_p95": float(p95_nearest_dt),
        "pos_nearest_dt_count": int(nearest_count),
    }

    return {
        "tool": "smoke_timing_tower",
        "log_file": str(log_path),
        "overall": "pass" if failed == 0 else "fail",
        "failed_checks": int(failed),
        "passed_checks": int(passed),
        "skipped_checks": int(skipped),
        "strict_requested": bool(args.strict),
        "checks": checks,
        "metrics": metrics,
        "thresholds": {
            "min_tower_ticks": int(args.min_tower_ticks),
            "min_pos_samples": int(args.min_pos_samples),
            "min_non_empty_pct": float(args.min_non_empty_pct),
            "max_fallback_gap_pct": float(args.max_fallback_gap_pct),
            "max_fallback_interval_pct": float(args.max_fallback_interval_pct),
            "max_missing_sector_pct": float(args.max_missing_sector_pct),
            "max_pos_nearest_dt_p95": float(args.max_pos_nearest_dt_p95),
            "warmup_seconds": float(args.warmup_seconds),
            "min_seconds_for_sector_gate": float(args.min_seconds_for_sector_gate),
            "min_lap_for_sector_gate": int(args.min_lap_for_sector_gate),
            "min_seconds_for_lap_progression_gate": float(args.min_seconds_for_lap_progression_gate),
            "min_lap_for_progression_gate": int(args.min_lap_for_progression_gate),
        },
    }


def _print_human_summary(summary: Dict[str, Any]) -> None:
    metrics = summary["metrics"]
    print("Timing Tower Smoke Summary")
    print(f"log_file={summary['log_file']}")
    print(
        f"tower_ticks={metrics['tower_ticks']} "
        f"tower_rows={metrics['tower_rows']} "
        f"pos_samples={metrics['pos_samples']}"
    )
    print(f"rows_total={metrics['rows_total']} qml_errors={metrics['qml_errors']}")
    print(f"max_t={metrics['max_t']:.2f}s max_lap={metrics['max_lap']}")
    print(
        "lap_index_driver_count_max="
        f"{metrics['lap_index_driver_count_max']} "
        f"history_driver_count_max={metrics['history_driver_count_max']}"
    )
    print(f"non_empty_ticks_pct={metrics['non_empty_ticks_pct']:.2f}")
    print(f"fallback_gap_pct={metrics['fallback_gap_pct']:.2f}")
    print(f"fallback_interval_pct={metrics['fallback_interval_pct']:.2f}")
    print(f"missing_sector_pct={metrics['missing_sector_pct']:.2f}")
    print(f"lap_regressions={metrics['lap_regressions']}")
    print(f"leader_position_violations={metrics['leader_position_violations']}")
    print(f"pos_nearest_dt_p95={metrics['pos_nearest_dt_p95']:.3f}")
    print("")
    print("Gate Results")
    for check in summary["checks"]:
        status = str(check["status"]).upper()
        print(f"{status} {check['name']}: {check['detail']}")


def main() -> int:
    p = argparse.ArgumentParser(description="Analyze Timing Tower smoke logs and apply pass/fail gates.")
    p.add_argument("--min-tower-ticks", type=int, default=100, help="Minimum tower_tick events required for stability confidence.")
    p.add_argument("--min-pos-samples", type=int, default=100, help="Minimum pos_sample events required for mapping stability confidence.")
    p.add_argument("log_file", type=Path)
    p.add_argument("--min-non-empty-pct", type=float, default=99.0)
    p.add_argument("--max-fallback-gap-pct", type=float, default=10.0)
    p.add_argument("--max-fallback-interval-pct", type=float, default=10.0)
    p.add_argument("--max-missing-sector-pct", type=float, default=20.0)
    p.add_argument("--max-pos-nearest-dt-p95", type=float, default=0.25)
    p.add_argument("--warmup-seconds", type=float, default=30.0, help="Ignore earliest seconds for position nearest_dt gate.")
    p.add_argument("--min-seconds-for-sector-gate", type=float, default=120.0, help="Require at least this runtime before enforcing missing sector gate.")
    p.add_argument("--min-lap-for-sector-gate", type=int, default=2, help="Require at least this lap before enforcing missing sector gate.")
    p.add_argument("--min-seconds-for-lap-progression-gate", type=float, default=120.0, help="Require at least this runtime before enforcing min lap progression gate.")
    p.add_argument("--min-lap-for-progression-gate", type=int, default=2, help="Require at least this leader/max lap for long playback runs.")
    p.add_argument("--summary-json-out", type=Path, default=None, help="Optional path to write machine-readable summary JSON.")
    p.add_argument("--strict", action="store_true", help="Exit non-zero when any gate fails.")
    args = p.parse_args()

    summary = analyze_log(args.log_file, args)
    _print_human_summary(summary)
    summary_json = json.dumps(summary, separators=(",", ":"), sort_keys=True)
    print(f"SMOKE_SUMMARY_JSON {summary_json}")

    if args.summary_json_out is not None:
        args.summary_json_out.write_text(summary_json + "\n", encoding="utf-8")

    if args.strict and int(summary["failed_checks"]) > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

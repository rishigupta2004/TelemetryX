#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

DEFAULT_QML_PATTERNS: Tuple[str, ...] = (
    r"ReferenceError",
    r"TypeError",
    r"recursive rearrange",
    r"Binding loop detected",
    r"Unable to assign",
    r"Cannot assign",
    r"QML .*Error",
)
KNOWN_WINDOW_STATUSES = {"stale", "empty", "ok", "invalid"}


def _compile_qml_regex(extra_patterns: Sequence[str]) -> re.Pattern[str]:
    patterns = list(DEFAULT_QML_PATTERNS)
    patterns.extend([p for p in extra_patterns if p])
    return re.compile("(" + "|".join(patterns) + ")", re.IGNORECASE)


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _to_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def _to_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        s = value.strip().lower()
        if s in {"1", "true", "yes", "y", "on"}:
            return True
        if s in {"0", "false", "no", "n", "off"}:
            return False
    return None


def _load_events(log_path: Path, qml_re: re.Pattern[str]) -> Tuple[List[Dict[str, Any]], int]:
    events: List[Dict[str, Any]] = []
    qml_errors = 0
    with log_path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if qml_re.search(line):
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


def _extract_window_statuses(events: Iterable[Dict[str, Any]]) -> List[str]:
    out: List[str] = []
    for e in events:
        candidates: List[Any] = []
        if e.get("event") == "tick_end":
            candidates.append(e.get("telemetry_status"))
        candidates.extend(
            [
                e.get("telemetry_status"),
                e.get("telemetry_window_status"),
                e.get("window_status"),
                e.get("status"),
            ]
        )
        for c in candidates:
            if c is None:
                continue
            s = str(c).strip().lower()
            if not s:
                continue
            out.append(s)
            break
    return out


def _extract_series_sample_count(event: Dict[str, Any], key: str) -> Optional[int]:
    direct_keys = [
        f"{key}_sample_count",
        f"{key}_samples",
        f"{key}SampleCount",
        f"{key}Samples",
    ]
    for dk in direct_keys:
        v = _to_int(event.get(dk))
        if v is not None:
            return v

    container = event.get(key)
    if isinstance(container, dict):
        v = _to_int(container.get("sampleCount"))
        if v is not None:
            return v
    telemetry_window = event.get("telemetry_window")
    if isinstance(telemetry_window, dict):
        series = telemetry_window.get(key)
        if isinstance(series, dict):
            v = _to_int(series.get("sampleCount"))
            if v is not None:
                return v
    return None


def _extract_direct_int(event: Dict[str, Any], *keys: str) -> Optional[int]:
    for k in keys:
        v = _to_int(event.get(k))
        if v is not None:
            return v
    return None


def _extract_compare_observations(events: Iterable[Dict[str, Any]]) -> List[Dict[str, Optional[Any]]]:
    out: List[Dict[str, Optional[Any]]] = []
    for e in events:
        enabled = _to_bool(e.get("compare_enabled"))
        if enabled is None:
            enabled = _to_bool(e.get("compareEnabled"))

        valid = _to_bool(e.get("compare_valid"))
        if valid is None:
            valid = _to_bool(e.get("compare_ready"))
        if valid is None:
            valid = _to_bool(e.get("compare_ok"))

        sample_count = _extract_series_sample_count(e, "compare")

        compare = e.get("compare")
        if isinstance(compare, dict):
            if enabled is None:
                enabled = True
            if valid is None:
                if sample_count is not None:
                    valid = sample_count >= 2
                else:
                    maybe_valid = _to_bool(compare.get("valid"))
                    if maybe_valid is not None:
                        valid = maybe_valid

        if enabled is None and valid is None and sample_count is None:
            continue

        out.append({"enabled": enabled, "valid": valid, "sample_count": sample_count})
    return out


def _check(name: str, passed: bool, detail: str, *, skipped: bool = False) -> Dict[str, Any]:
    return {
        "name": name,
        "status": "skip" if skipped else ("pass" if passed else "fail"),
        "passed": bool(passed),
        "detail": detail,
    }


def _compress_transitions(transitions: List[str]) -> Dict[str, Any]:
    counts: Dict[str, int] = {}
    for t in transitions:
        k = str(t or "")
        counts[k] = int(counts.get(k, 0)) + 1
    return {
        "first_5": list(transitions[:5]),
        "last_3": list(transitions[-3:]) if transitions else [],
        "counts": counts,
        "total": int(len(transitions)),
    }


def analyze_log(log_path: Path, args: argparse.Namespace) -> Dict[str, Any]:
    qml_re = _compile_qml_regex(args.qml_error_pattern or [])
    events, qml_errors = _load_events(log_path, qml_re)

    tick_start_count = sum(1 for e in events if e.get("event") == "tick_start")
    tick_end_count = sum(1 for e in events if e.get("event") == "tick_end")

    statuses = _extract_window_statuses(events)
    unknown_statuses = sorted({s for s in statuses if s not in KNOWN_WINDOW_STATUSES})
    transitions = [f"{a}->{b}" for a, b in zip(statuses, statuses[1:])]
    ok_regressions = sum(1 for a, b in zip(statuses, statuses[1:]) if a == "ok" and b in {"stale", "invalid"})

    primary_samples: List[int] = []
    primary_signal_counts: List[int] = []
    primary_nonzero_speed_counts: List[int] = []
    for e in events:
        c = _extract_series_sample_count(e, "primary")
        if c is not None:
            primary_samples.append(c)
        sig = _extract_direct_int(e, "primary_signal_count", "primarySignalCount")
        if sig is not None:
            primary_signal_counts.append(sig)
        nspd = _extract_direct_int(e, "primary_nonzero_speed_count", "primaryNonzeroSpeedCount")
        if nspd is not None:
            primary_nonzero_speed_counts.append(nspd)

    compare_obs = _extract_compare_observations(events)
    compare_enabled_obs = [o for o in compare_obs if o.get("enabled") is True]
    compare_valid_known = [o for o in compare_enabled_obs if o.get("valid") is not None]
    compare_sample_known = [o for o in compare_enabled_obs if o.get("sample_count") is not None]
    min_primary_signal_count = int(getattr(args, "min_primary_signal_count", 5))
    min_primary_nonzero_speed_count = int(getattr(args, "min_primary_nonzero_speed_count", 2))

    checks: List[Dict[str, Any]] = []
    checks.append(_check("window_status_events_present", len(statuses) > 0, f"{len(statuses)} > 0"))
    checks.append(_check("window_status_values_known", len(unknown_statuses) == 0, f"unknown={unknown_statuses}"))
    checks.append(
        _check(
            "window_status_ok_regressions",
            ok_regressions <= int(args.max_ok_regressions),
            f"{ok_regressions} <= {int(args.max_ok_regressions)}",
        )
    )

    if bool(args.require_ok_status):
        checks.append(_check("window_status_seen_ok", "ok" in statuses, f"ok_present={('ok' in statuses)}"))

    if primary_samples:
        checks.append(
            _check(
                "primary_sample_count_min",
                min(primary_samples) >= int(args.min_primary_samples),
                f"min={min(primary_samples)} >= {int(args.min_primary_samples)}",
            )
        )
    else:
        checks.append(
            _check(
                "primary_sample_count_min",
                True,
                "SKIP (no primary sampleCount fields found)",
                skipped=True,
            )
        )

    if primary_signal_counts:
        max_sig = max(primary_signal_counts)
        checks.append(
            _check(
                "primary_signal_count_min",
                max_sig >= min_primary_signal_count,
                f"max={max_sig} >= {min_primary_signal_count}",
            )
        )
    else:
        checks.append(
            _check(
                "primary_signal_count_min",
                True,
                "SKIP (no primary signal count fields found)",
                skipped=True,
            )
        )

    if primary_nonzero_speed_counts:
        max_nz_speed = max(primary_nonzero_speed_counts)
        alt_signal_ok = False
        if primary_signal_counts:
            try:
                alt_signal_ok = max(primary_signal_counts) >= min_primary_signal_count
            except Exception:
                alt_signal_ok = False
        speed_gate_pass = (max_nz_speed >= min_primary_nonzero_speed_count) or alt_signal_ok
        detail = f"max={max_nz_speed} >= {min_primary_nonzero_speed_count}"
        if max_nz_speed < min_primary_nonzero_speed_count and alt_signal_ok:
            detail = (
                f"{detail} (waived: primary_signal_count_max="
                f"{max(primary_signal_counts)} >= {min_primary_signal_count})"
            )
        checks.append(
            _check(
                "primary_nonzero_speed_count_min",
                speed_gate_pass,
                detail,
            )
        )
    else:
        checks.append(
            _check(
                "primary_nonzero_speed_count_min",
                True,
                "SKIP (no primary nonzero speed count fields found)",
                skipped=True,
            )
        )

    if compare_enabled_obs:
        if compare_valid_known:
            invalid_cnt = sum(1 for o in compare_valid_known if o.get("valid") is False)
            checks.append(
                _check(
                    "compare_valid_when_enabled",
                    invalid_cnt == 0,
                    f"invalid={invalid_cnt} == 0",
                )
            )
        else:
            checks.append(
                _check(
                    "compare_valid_when_enabled",
                    True,
                    "SKIP (compare enabled but no compare valid/ready fields found)",
                    skipped=True,
                )
            )

        if compare_sample_known:
            min_compare = min(int(o["sample_count"]) for o in compare_sample_known if o.get("sample_count") is not None)
            checks.append(
                _check(
                    "compare_sample_count_min_when_enabled",
                    min_compare >= int(args.min_compare_samples),
                    f"min={min_compare} >= {int(args.min_compare_samples)}",
                )
            )
        else:
            checks.append(
                _check(
                    "compare_sample_count_min_when_enabled",
                    True,
                    "SKIP (compare enabled but no compare sampleCount fields found)",
                    skipped=True,
                )
            )
    else:
        checks.append(
            _check(
                "compare_valid_when_enabled",
                True,
                "SKIP (no compare-enabled observations found)",
                skipped=True,
            )
        )
        checks.append(
            _check(
                "compare_sample_count_min_when_enabled",
                True,
                "SKIP (no compare-enabled observations found)",
                skipped=True,
            )
        )

    checks.append(_check("qml_errors", qml_errors == 0, f"{qml_errors} == 0"))

    failed = sum(1 for c in checks if c["status"] == "fail")
    passed = sum(1 for c in checks if c["status"] == "pass")
    skipped = sum(1 for c in checks if c["status"] == "skip")

    metrics = {
        "event_count": int(len(events)),
        "tick_start_count": int(tick_start_count),
        "tick_end_count": int(tick_end_count),
        "window_status_count": int(len(statuses)),
        "window_status_seen": sorted({s for s in statuses}),
        "unknown_window_statuses": unknown_statuses,
        "window_status_transitions_compressed": _compress_transitions(transitions),
        "window_status_ok_regressions": int(ok_regressions),
        "primary_sample_count_observed": int(len(primary_samples)),
        "primary_sample_count_min": int(min(primary_samples)) if primary_samples else None,
        "primary_signal_count_observed": int(len(primary_signal_counts)),
        "primary_signal_count_max": int(max(primary_signal_counts)) if primary_signal_counts else None,
        "primary_nonzero_speed_count_observed": int(len(primary_nonzero_speed_counts)),
        "primary_nonzero_speed_count_max": int(max(primary_nonzero_speed_counts)) if primary_nonzero_speed_counts else None,
        "compare_enabled_observations": int(len(compare_enabled_obs)),
        "compare_valid_known_observations": int(len(compare_valid_known)),
        "compare_sample_known_observations": int(len(compare_sample_known)),
        "qml_errors": int(qml_errors),
    }
    if bool(getattr(args, "verbose_transitions", False)):
        metrics["window_status_transitions"] = transitions

    return {
        "tool": "smoke_telemetry_binding",
        "log_file": str(log_path),
        "overall": "pass" if failed == 0 else "fail",
        "failed_checks": int(failed),
        "passed_checks": int(passed),
        "skipped_checks": int(skipped),
        "strict_requested": bool(args.strict),
        "checks": checks,
        "metrics": metrics,
        "thresholds": {
            "min_primary_samples": int(args.min_primary_samples),
            "min_compare_samples": int(args.min_compare_samples),
            "max_ok_regressions": int(args.max_ok_regressions),
            "min_primary_signal_count": int(min_primary_signal_count),
            "min_primary_nonzero_speed_count": int(min_primary_nonzero_speed_count),
            "require_ok_status": bool(args.require_ok_status),
            "qml_error_patterns": list(DEFAULT_QML_PATTERNS) + list(args.qml_error_pattern or []),
        },
    }


def _print_human_summary(summary: Dict[str, Any]) -> None:
    metrics = summary["metrics"]
    print("Telemetry Binding Smoke Summary")
    print(f"log_file={summary['log_file']}")
    print(
        f"events={metrics['event_count']} "
        f"tick_start={metrics['tick_start_count']} "
        f"tick_end={metrics['tick_end_count']}"
    )
    print(
        f"window_status_count={metrics['window_status_count']} "
        f"seen={','.join(metrics['window_status_seen']) if metrics['window_status_seen'] else '-'}"
    )
    print(f"window_status_ok_regressions={metrics['window_status_ok_regressions']}")
    print(f"primary_sample_count_observed={metrics['primary_sample_count_observed']}")
    print(f"primary_signal_count_observed={metrics['primary_signal_count_observed']}")
    print(f"primary_nonzero_speed_count_observed={metrics['primary_nonzero_speed_count_observed']}")
    print(f"compare_enabled_observations={metrics['compare_enabled_observations']}")
    print(f"qml_errors={metrics['qml_errors']}")
    print("")
    print("Gate Results")
    for check in summary["checks"]:
        print(f"{str(check['status']).upper()} {check['name']}: {check['detail']}")


def main() -> int:
    p = argparse.ArgumentParser(description="Analyze telemetry binding smoke logs and apply pass/fail gates.")
    p.add_argument("log_file", type=Path)
    p.add_argument("--min-primary-samples", type=int, default=2)
    p.add_argument("--min-primary-signal-count", type=int, default=5)
    p.add_argument("--min-primary-nonzero-speed-count", type=int, default=2)
    p.add_argument("--min-compare-samples", type=int, default=2)
    p.add_argument("--max-ok-regressions", type=int, default=0)
    p.add_argument("--require-ok-status", action="store_true", help="Require telemetry window status sequence to include at least one 'ok'.")
    p.add_argument(
        "--qml-error-pattern",
        action="append",
        default=[],
        help="Additional regex pattern treated as QML/runtime binding error.",
    )
    p.add_argument("--summary-json-out", type=Path, default=None, help="Optional path to write machine-readable summary JSON.")
    p.add_argument(
        "--verbose-transitions",
        action="store_true",
        default=False,
        help="Include full window_status_transitions list in metrics.",
    )
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

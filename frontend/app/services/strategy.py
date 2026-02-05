"""Tiny ML integration for Strategy view."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from app.services.api.telemetryx_backend import TelemetryXBackend


def _find_position(session_store: Any, driver_code: str) -> Optional[int]:
    for row in session_store.timing_rows or []:
        if str(row.get("code") or "") == driver_code:
            try:
                return int(row.get("position") or 0) or None
            except Exception:
                return None
    return None


def _find_latest_stint(session_store: Any, driver_code: str) -> Optional[Dict[str, Any]]:
    stints = [s for s in (session_store.tyre_stints or []) if str(s.get("code") or "") == driver_code]
    if not stints:
        return None
    stints = sorted(stints, key=lambda s: int(s.get("stintNumber") or 0))
    return stints[-1]


def _default_inputs(position_before_pit: int) -> Tuple[int, int, int, str]:
    return position_before_pit, 10, 15, "MEDIUM"


def predict_undercut_into_store(session_store: Any, attacker_code: str, defender_code: str) -> None:
    """Compute simple undercut probability for attacker (vs generic field)."""
    pos = _find_position(session_store, attacker_code) or 12
    stint = _find_latest_stint(session_store, attacker_code)

    if stint:
        tyre_age = int(stint.get("tyreAgeEnd") or stint.get("tyreAgeStart") or 10)
        stint_len = int(stint.get("laps") or 15)
        compound = str(stint.get("compound") or "MEDIUM")
        position_before_pit = pos
    else:
        position_before_pit, tyre_age, stint_len, compound = _default_inputs(pos)

    backend = TelemetryXBackend()
    try:
        pred = backend.undercut_predict(
            position_before_pit=position_before_pit,
            tyre_age=tyre_age,
            stint_length=stint_len,
            compound=compound,
            pit_lap=int(session_store.total_laps * 0.4) if getattr(session_store, "total_laps", 0) else 15,
            race_name=str(getattr(session_store, "circuit_name", "") or "Bahrain Grand Prix"),
        )
        session_store.undercut_prediction = {
            "attacker": attacker_code,
            "defender": defender_code,
            "inputs": {
                "position_before_pit": position_before_pit,
                "tyre_age": tyre_age,
                "stint_length": stint_len,
                "compound": compound,
            },
            "result": pred,
        }
    finally:
        backend.close()


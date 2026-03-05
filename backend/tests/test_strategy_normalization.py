"""Test strategy recommendation normalisers and position edge cases."""

from __future__ import annotations

from typing import Any, Dict

import pytest

from api.routers.models import (
    _normalize_strategy_item,
    _normalize_strategy_payload,
    _to_float,
    _to_int,
)


# ── _to_float ────────────────────────────────────────────────────

class TestToFloat:
    def test_none_returns_default(self):
        assert _to_float(None) == 0.0
        assert _to_float(None, 99.0) == 99.0

    def test_valid_number(self):
        assert _to_float(3.14) == 3.14
        assert _to_float("2.5") == 2.5

    def test_invalid_falls_back(self):
        assert _to_float("not_a_number") == 0.0
        assert _to_float({}, 42.0) == 42.0

    def test_nan_returns_nan(self):
        import math
        result = _to_float(float("nan"))
        assert math.isnan(result)


# ── _to_int ──────────────────────────────────────────────────────

class TestToInt:
    def test_none_returns_default(self):
        assert _to_int(None) == 0
        assert _to_int(None, 5) == 5

    def test_valid_number(self):
        assert _to_int(42) == 42
        assert _to_int("7") == 7
        assert _to_int(3.9) == 3  # truncated

    def test_invalid_falls_back(self):
        assert _to_int("nope") == 0
        assert _to_int([], 10) == 10


# ── _normalize_strategy_item ─────────────────────────────────────

class TestNormalizeStrategyItem:
    def test_empty_dict_uses_fallback(self):
        result = _normalize_strategy_item({}, "Fallback Name")
        assert result["strategy"] == "Fallback Name"
        assert result["avg_finish_position"] == 20.0
        assert result["avg_points"] == 0.0

    def test_non_dict_uses_fallback(self):
        result = _normalize_strategy_item("bad", "Fallback")
        assert result["strategy"] == "Fallback"

    def test_valid_item_is_normalized(self):
        raw = {
            "strategy": "S-M-H",
            "avg_finish_position": 3.5,
            "avg_points": 12.0,
            "podium_probability": 0.45,
            "avg_pit_stops": 2,
            "compounds": ["SOFT", "MEDIUM", "HARD"],
            "pit_laps": [15, 35],
        }
        result = _normalize_strategy_item(raw, "unused")
        assert result["strategy"] == "S-M-H"
        assert result["avg_finish_position"] == 3.5
        assert result["avg_points"] == 12.0
        assert result["podium_probability"] == 0.45
        assert result["compounds"] == ["SOFT", "MEDIUM", "HARD"]
        assert result["pit_laps"] == [15, 35]

    def test_missing_optional_fields(self):
        result = _normalize_strategy_item({"strategy": "M-H"}, "ignored")
        assert result["compounds"] is None
        assert result["pit_laps"] is None


# ── _normalize_strategy_payload ──────────────────────────────────

class TestNormalizeStrategyPayload:
    def test_empty_payload_produces_valid_shape(self):
        result = _normalize_strategy_payload({}, 2024, "Bahrain GP")
        assert result["year"] == 2024
        assert result["race_name"] == "Bahrain GP"
        assert result["n_simulations"] == 0
        assert isinstance(result["best_strategy"], dict)
        assert isinstance(result["all_strategies"], dict)

    def test_non_dict_payload_falls_back(self):
        result = _normalize_strategy_payload("garbage", 2023, "Monaco GP")
        assert result["year"] == 2023
        assert result["race_name"] == "Monaco GP"

    def test_best_strategy_derived_from_all_when_missing(self):
        payload: Dict[str, Any] = {
            "all_strategies": {
                "S-M": {"strategy": "S-M", "avg_points": 8.0},
                "M-H": {"strategy": "M-H", "avg_points": 15.0},
            }
        }
        result = _normalize_strategy_payload(payload, 2024, "Testing GP")
        # best_strategy should be the one with highest avg_points
        assert result["best_strategy"]["strategy"] == "M-H"
        assert result["best_strategy"]["avg_points"] == 15.0

    def test_best_strategy_included_in_all(self):
        payload: Dict[str, Any] = {
            "best_strategy": {"strategy": "Solo-Best", "avg_points": 20.0},
            "all_strategies": {
                "S-M": {"strategy": "S-M", "avg_points": 8.0},
            },
        }
        result = _normalize_strategy_payload(payload, 2024, "Test GP")
        # best_strategy should be added to all_strategies if not present
        assert "Solo-Best" in result["all_strategies"]
        assert "S-M" in result["all_strategies"]

    def test_year_and_race_from_payload_override_defaults(self):
        payload: Dict[str, Any] = {
            "year": 2025,
            "race_name": "Custom Race",
            "n_simulations": 5000,
        }
        result = _normalize_strategy_payload(payload, 2024, "Fallback GP")
        assert result["year"] == 2025
        assert result["race_name"] == "Custom Race"
        assert result["n_simulations"] == 5000

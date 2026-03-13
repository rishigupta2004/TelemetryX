from __future__ import annotations

from pathlib import Path


def main() -> None:
    root = Path("backend/etl/data")
    required_layers = ["bronze", "silver", "gold", "features"]
    for layer in required_layers:
        if not (root / layer).exists():
            raise SystemExit(f"Missing required layer: {layer}")

    silver = root / "silver"
    sessions = 0
    laps_missing = 0
    telemetry_missing = 0
    for year in [d for d in silver.iterdir() if d.is_dir() and d.name.isdigit()]:
        for race in [d for d in year.iterdir() if d.is_dir()]:
            for session in [d for d in race.iterdir() if d.is_dir()]:
                sessions += 1
                if not (session / "laps.parquet").exists():
                    laps_missing += 1
                if not (session / "telemetry.parquet").exists():
                    telemetry_missing += 1

    print(f"silver_sessions={sessions}")
    print(f"laps_missing={laps_missing}")
    print(f"telemetry_missing={telemetry_missing}")

    if laps_missing > 0:
        raise SystemExit(
            "Silver integrity check failed: laps.parquet missing in one or more sessions"
        )


if __name__ == "__main__":
    main()

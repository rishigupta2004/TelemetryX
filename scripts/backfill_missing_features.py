"""Backfill missing feature files for a given year."""

import argparse
import sys
from pathlib import Path
ROOT = Path(__file__).parent.parent
sys.path.append(str(ROOT))

from features import (
    run_lap,
    run_tyre,
    run_telemetry,
    run_race_context,
    run_comparison,
    run_position,
    run_overtakes,
    run_traffic,
    run_points,
)


FEATURE_RUNNERS = {
    "lap": run_lap,
    "tyre": run_tyre,
    "telemetry": run_telemetry,
    "race_context": run_race_context,
    "comparison": run_comparison,
    "position": run_position,
    "overtakes": run_overtakes,
    "traffic": run_traffic,
    "points": run_points,
}

SESSIONS = ["Q", "R", "S", "SS"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing features by running generators directly")
    parser.add_argument("--year", type=int, required=True)
    args = parser.parse_args()

    year = args.year
    silver_root = Path("backend/etl/data/silver") / str(year)
    features_root = Path("backend/etl/data/features") / str(year)

    for race_dir in sorted([d for d in silver_root.iterdir() if d.is_dir()]):
        race = race_dir.name
        for session in SESSIONS:
            sdir = race_dir / session
            if not sdir.exists():
                continue
            for feature, runner in FEATURE_RUNNERS.items():
                fname = f"{feature}_features.parquet"
                fpath = features_root / race / session / fname
                if fpath.exists():
                    continue
                try:
                    runner(year, race, session)
                except Exception as exc:
                    print(f"{race} {session} {feature}: {exc}")


if __name__ == "__main__":
    main()

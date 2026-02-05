"""ML reporting and presentations."""

from pathlib import Path
import json
import pandas as pd
from typing import Dict, Optional

from ml.clustering import train_clustering
from ml.strategy import optimize_strategy, optimize_strategy_year, strategy_results_to_frame

DATA_PATH = Path(__file__).parent.parent / "backend" / "etl" / "data"
FEATURES_PATH = DATA_PATH / "features"
SILVER_PATH = DATA_PATH / "silver"
OUTPUTS_PATH = FEATURES_PATH / "presentations" / "ml"


def _scope_name(year: Optional[int], race: Optional[str]) -> str:
    if year and race:
        return f"{year}_{race.replace(' ', '_')}"
    if year:
        return f"{year}"
    return "all"


def _available_races(year: int) -> list:
    year_dir = SILVER_PATH / str(year)
    if not year_dir.exists():
        return []
    return [d.name for d in year_dir.iterdir() if d.is_dir()]


def generate_clustering_reports(
    year: Optional[int] = None,
    race: Optional[str] = None,
    session: str = "R",
    clusters: int = 4,
    scope: str = "both",
) -> Dict:
    out_dir = OUTPUTS_PATH / "driver_clustering"
    out_dir.mkdir(parents=True, exist_ok=True)
    outputs = {}

    if scope in {"race", "both"}:
        if year and race:
            races = [race]
        elif year:
            races = _available_races(year)
        else:
            races = []
        for r in races:
            df, metrics = train_clustering(clusters, year, race=r, session=session, verbose=False)
            if df.empty:
                continue
            scope_name = _scope_name(year, r)
            df.to_parquet(out_dir / f"clusters_{scope_name}.parquet", index=False)
            df.to_csv(out_dir / f"clusters_{scope_name}.csv", index=False)
            with open(out_dir / f"metrics_{scope_name}.json", "w") as f:
                json.dump(metrics, f, indent=2)
            outputs[f"race_{scope_name}"] = str(out_dir / f"clusters_{scope_name}.parquet")

    if scope in {"year", "both"} and year:
        df, metrics = train_clustering(clusters, year, race=None, session=session, verbose=False)
        if not df.empty:
            scope_name = _scope_name(year, None)
            df.to_parquet(out_dir / f"clusters_{scope_name}.parquet", index=False)
            df.to_csv(out_dir / f"clusters_{scope_name}.csv", index=False)
            with open(out_dir / f"metrics_{scope_name}.json", "w") as f:
                json.dump(metrics, f, indent=2)
            outputs[f"year_{scope_name}"] = str(out_dir / f"clusters_{scope_name}.parquet")

    return outputs


def generate_strategy_reports(
    year: Optional[int] = None,
    race: Optional[str] = None,
    n_simulations: int = 100,
    scope: str = "both",
) -> Dict:
    out_dir = OUTPUTS_PATH / "strategy"
    out_dir.mkdir(parents=True, exist_ok=True)
    outputs = {}

    if scope in {"race", "both"} and year:
        races = [race] if race else _available_races(year)
        for r in races:
            result = optimize_strategy(year, r, n_simulations, verbose=False)
            scope_name = _scope_name(year, r)
            out_json = out_dir / f"strategy_{scope_name}.json"
            with open(out_json, "w") as f:
                json.dump(result, f, indent=2, default=str)
            table = strategy_results_to_frame(result.get("all_strategies", {}))
            if not table.empty:
                table = table.sort_values("avg_points", ascending=False).head(10)
                table.to_csv(out_dir / f"strategy_{scope_name}.csv", index=False)
            outputs[f"race_{scope_name}"] = str(out_json)

    if scope in {"year", "both"} and year:
        results = optimize_strategy_year(year, n_simulations, verbose=False)
        if results:
            summary_rows = []
            for race_name, result in results.items():
                best = result.get("best_strategy", {})
                summary_rows.append({
                    "year": year,
                    "race_name": race_name,
                    "strategy": best.get("strategy"),
                    "avg_finish_position": best.get("avg_finish_position"),
                    "avg_points": best.get("avg_points"),
                    "podium_probability": best.get("podium_probability"),
                    "points_probability": best.get("points_probability"),
                })
            summary = pd.DataFrame(summary_rows)
            scope_name = _scope_name(year, None)
            summary.to_parquet(out_dir / f"strategy_year_{scope_name}.parquet", index=False)
            summary.to_csv(out_dir / f"strategy_year_{scope_name}.csv", index=False)
            outputs[f"year_{scope_name}"] = str(out_dir / f"strategy_year_{scope_name}.parquet")

    return outputs


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate ML presentations")
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--race", type=str, default=None)
    parser.add_argument("--clusters", type=int, default=4)
    parser.add_argument("--simulations", type=int, default=100)
    parser.add_argument("--scope", type=str, default="both", choices=["race", "year", "both"])
    args = parser.parse_args()

    generate_clustering_reports(year=args.year, race=args.race, clusters=args.clusters, scope=args.scope)
    generate_strategy_reports(year=args.year, race=args.race, n_simulations=args.simulations, scope=args.scope)

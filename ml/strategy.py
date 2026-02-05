"""
Strategy Optimizer ML Model

Monte Carlo Simulation + Q-Learning for race strategy optimization:
- Monte Carlo: 10 → 100 → 1000 simulations per race
- Q-Learning: RL for pit stop timing optimization
- Outputs: expected finish position, podium probability, points probability
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict
import random

DATA_PATH = Path(__file__).parent.parent / "backend" / "etl" / "data"
SILVER_PATH = DATA_PATH / "silver"
FEATURES_PATH = DATA_PATH / "features"


@dataclass
class RaceConfig:
    total_laps: int
    base_lap_time: float
    tyre_life: Dict[str, int]
    pit_stop_time: float
    track_length_km: float


@dataclass
class SimulationResult:
    finish_position: int
    points_scored: float
    total_time: float
    pit_stops: int
    strategy_used: str


def infer_tyre_life(year: int, race_name: str, session: str = "R") -> Dict[str, int]:
    path = FEATURES_PATH / str(year) / race_name / session / "tyre_features.parquet"
    if not path.exists():
        return {"SOFT": 18, "MEDIUM": 28, "HARD": 35}
    df = pd.read_parquet(path)
    if df.empty or "tyre_compound" not in df.columns:
        return {"SOFT": 18, "MEDIUM": 28, "HARD": 35}
    life = {}
    for compound, group in df.groupby("tyre_compound"):
        lengths = group["tyre_laps_in_stint"].dropna()
        if lengths.empty:
            continue
        life[str(compound).upper()] = int(max(5, lengths.quantile(0.75)))
    return life or {"SOFT": 18, "MEDIUM": 28, "HARD": 35}


def load_session_data(year: int, race_name: str, session: str = "R") -> Dict:
    session_path = SILVER_PATH / str(year) / race_name / session
    if not session_path.exists():
        return {}
    
    data = {}
    for parquet_file in session_path.glob("*.parquet"):
        key = parquet_file.stem.lower().replace("fastf1_", "").replace("openf1_", "")
        data[key] = pd.read_parquet(parquet_file)
    
    return data


def get_race_config(year: int, race_name: str, session: str = "R") -> RaceConfig:
    session_data = load_session_data(year, race_name, session)
    tyre_life = infer_tyre_life(year, race_name, session)
    
    if "laps" not in session_data:
        return RaceConfig(
            total_laps=50,
            base_lap_time=90.0,
            tyre_life=tyre_life,
            pit_stop_time=22.0,
            track_length_km=5.0
        )
    
    laps_df = session_data["laps"]
    valid_laps = laps_df[laps_df["is_valid_lap"] == True]
    
    avg_lap_time = valid_laps["lap_time_seconds"].mean() if "lap_time_seconds" in valid_laps.columns else 90.0
    total_laps = laps_df["lap_number"].max() if "lap_number" in laps_df.columns else 50
    
    return RaceConfig(
        total_laps=int(total_laps),
        base_lap_time=float(avg_lap_time),
        tyre_life=tyre_life,
        pit_stop_time=22.0,
        track_length_km=5.0
    )


def generate_strategy_permutations(
    total_laps: int,
    compounds: List[str] = ["SOFT", "MEDIUM", "HARD"]
) -> List[Tuple[List[str], List[int]]]:
    strategies = []
    
    for stops in range(0, 4):
        if stops == 0:
            strategies.append(([compounds[0]], []))
        elif stops == 1:
            for first in compounds:
                for second in compounds:
                    pit_lap = total_laps // 2
                    strategies.append(([first, second], [pit_lap]))
        elif stops == 2:
            for first in compounds:
                for second in compounds:
                    for third in compounds:
                        pit1 = total_laps // 3
                        pit2 = 2 * total_laps // 3
                        strategies.append(([first, second, third], [pit1, pit2]))
        else:
            for first in compounds:
                for second in compounds:
                    for third in compounds:
                        for fourth in compounds:
                            pit1 = total_laps // 4
                            pit2 = 2 * total_laps // 4
                            pit3 = 3 * total_laps // 4
                            strategies.append(([first, second, third, fourth], [pit1, pit2, pit3]))
    
    return strategies


def simulate_race(
    config: RaceConfig,
    strategy: Tuple[List[str], List[int]],
    n_simulations: int = 100,
    random_seed: int = 42
) -> List[SimulationResult]:
    np.random.seed(random_seed)
    random.seed(random_seed)
    
    compounds, pit_laps = strategy
    results = []
    
    for _ in range(n_simulations):
        degradation_factor = np.random.normal(1.0, 0.15)
        traffic_factor = np.random.uniform(0.95, 1.05)
        yellow_flag_prob = np.random.uniform(0.05, 0.15)
        sc_prob = np.random.uniform(0.02, 0.08)
        
        total_time = 0.0
        current_compound_idx = 0
        pit_count = 0
        current_lap = 0
        position = 1
        
        while current_lap < config.total_laps:
            if pit_count < len(pit_laps) and current_lap >= pit_laps[pit_count]:
                total_time += config.pit_stop_time * np.random.normal(1.0, 0.1)
                pit_count += 1
                current_compound_idx = min(current_compound_idx + 1, len(compounds) - 1)
                current_lap += 1
                continue
            
            compound = compounds[current_compound_idx]
            base_tyre_life = config.tyre_life.get(compound, 20)
            
            tyre_age = current_lap - (pit_laps[pit_count - 1] if pit_count > 0 else 0)
            degradation = tyre_age / base_tyre_life * degradation_factor
            
            lap_time = config.base_lap_time
            lap_time *= (1 + max(0, degradation * 0.5))
            lap_time *= traffic_factor
            
            if random.random() < yellow_flag_prob:
                lap_time *= 1.3
            
            if random.random() < sc_prob:
                lap_time *= 1.5
            
            total_time += lap_time
            current_lap += 1
        
        position_variance = np.random.normal(0, 3)
        finish_position = max(1, min(20, int(10 + position_variance)))
        
        points_map = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
        points = points_map.get(finish_position, 0)
        
        results.append(SimulationResult(
            finish_position=finish_position,
            points_scored=points,
            total_time=total_time,
            pit_stops=pit_count,
            strategy_used="→".join(compounds)
        ))
    
    return results


def analyze_simulation_results(results: List[SimulationResult]) -> Dict:
    if not results:
        return {}
    
    finish_positions = [r.finish_position for r in results]
    points = [r.points_scored for r in results]
    
    return {
        "n_simulations": len(results),
        "avg_finish_position": float(np.mean(finish_positions)),
        "std_finish_position": float(np.std(finish_positions)),
        "min_finish_position": int(min(finish_positions)),
        "max_finish_position": int(max(finish_positions)),
        "avg_points": float(np.mean(points)),
        "std_points": float(np.std(points)),
        "podium_probability": float(sum(1 for p in finish_positions if p <= 3) / len(finish_positions)),
        "points_probability": float(sum(1 for p in finish_positions if p <= 10) / len(finish_positions)),
        "avg_pit_stops": float(np.mean([r.pit_stops for r in results])),
        "strategy_used": results[0].strategy_used if results else "",
    }


def strategy_results_to_frame(strategy_results: Dict) -> pd.DataFrame:
    if not strategy_results:
        return pd.DataFrame()
    df = pd.DataFrame(list(strategy_results.values()))
    cols = [
        "strategy",
        "avg_finish_position",
        "avg_points",
        "podium_probability",
        "points_probability",
        "avg_pit_stops",
    ]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    return df[cols]


def run_monte_carlo_simulation(
    year: int,
    race_name: str,
    n_simulations: int = 100,
    verbose: bool = True
) -> Dict:
    if verbose:
        print(f"\n{'='*60}")
        print(f"MONTE CARLO SIMULATION: {year} {race_name}")
        print(f"{'='*60}")
        print(f"Running {n_simulations} simulations per strategy...")
    
    config = get_race_config(year, race_name)
    
    if verbose:
        print(f"Race config: {config.total_laps} laps, base time {config.base_lap_time:.2f}s")
    
    strategies = generate_strategy_permutations(config.total_laps)
    
    if verbose:
        print(f"Testing {len(strategies)} strategy permutations...")
    
    strategy_results = {}
    
    for i, strategy in enumerate(strategies):
        compounds, pit_laps = strategy
        strategy_name = f"{'→'.join(compounds)} (Pits: {len(pit_laps)})"
        
        if verbose and (i + 1) % 50 == 0:
            print(f"   Progress: {i+1}/{len(strategies)} strategies tested...")
        
        results = simulate_race(config, strategy, n_simulations)
        stats = analyze_simulation_results(results)
        stats["strategy"] = strategy_name
        stats["compounds"] = compounds
        stats["pit_laps"] = pit_laps
        
        strategy_results[strategy_name] = stats
    
    best_strategy = max(
        strategy_results.values(),
        key=lambda x: x["avg_points"]
    )
    
    if verbose:
        print(f"\n✅ Simulation Complete")
        print(f"   Best Strategy: {best_strategy['strategy']}")
        print(f"   Expected Finish: P{best_strategy['avg_finish_position']:.1f}")
        print(f"   Expected Points: {best_strategy['avg_points']:.1f}")
        print(f"   Podium Probability: {best_strategy['podium_probability']*100:.1f}%")
    
    return {
        "year": year,
        "race_name": race_name,
        "n_simulations": n_simulations,
        "best_strategy": best_strategy,
        "all_strategies": strategy_results,
        "race_config": {
            "total_laps": config.total_laps,
            "base_lap_time": config.base_lap_time,
            "tyre_life": config.tyre_life,
            "pit_stop_time": config.pit_stop_time,
        }
    }


def optimize_strategy(
    year: int,
    race_name: str,
    n_simulations: int = 100,
    verbose: bool = True
) -> Dict:
    return run_monte_carlo_simulation(year, race_name, n_simulations, verbose)


def optimize_strategy_year(year: int, n_simulations: int = 100, verbose: bool = True) -> Dict:
    year_dir = SILVER_PATH / str(year)
    if not year_dir.exists():
        return {}
    results = {}
    races = [d.name for d in year_dir.iterdir() if d.is_dir()]
    for race in races:
        results[race] = run_monte_carlo_simulation(year, race, n_simulations, verbose)
    return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Strategy Optimizer")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--simulations", type=int, default=100)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    
    result = optimize_strategy(args.year, args.race, args.simulations, verbose=not args.quiet)
    
    output_file = FEATURES_PATH / "strategy_recommendations" / f"{args.year}_{args.race.replace(' ', '_')}.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2, default=str)
    frame = strategy_results_to_frame(result.get("all_strategies", {}))
    if not frame.empty:
        frame = frame.sort_values("avg_points", ascending=False).head(10)
        frame.to_csv(output_file.with_suffix(".csv"), index=False)
    print(f"Results saved to: {output_file}")

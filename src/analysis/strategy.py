"""Monte Carlo Strategy Simulator."""
import numpy as np
import polars as pl
from dataclasses import dataclass


@dataclass
class StrategyResult:
    expected_position: float
    position_std: float
    podium_probability: float
    points_probability: float
    best_case: int
    worst_case: int
    simulations: list


def simulate_strategy(
    laps: pl.DataFrame,
    driver: str,
    pit_laps: list[int],
    compounds: list[str],
    n_simulations: int = 500
) -> StrategyResult:
    """
    Monte Carlo simulation of a pit strategy.
    
    Args:
        laps: Race lap data
        driver: Driver code
        pit_laps: List of lap numbers for pit stops
        compounds: List of tire compounds for each stint
        n_simulations: Number of simulations to run
    """
    # Get baseline pace from actual race
    driver_laps = laps.filter(pl.col("Driver") == driver)
    if driver_laps.is_empty():
        raise ValueError(f"No data for driver {driver}")
    
    # Calculate base lap time (median excluding outliers)
    lap_times = driver_laps.filter(pl.col("LapTime").is_not_null())
    times_ns = [lt for lt in lap_times["LapTime"].to_list() if lt]
    if hasattr(times_ns[0], 'total_seconds'):
        base_times = [t.total_seconds() for t in times_ns]
    else:
        base_times = [t / 1e9 for t in times_ns]
    
    base_pace = np.median(base_times)
    pace_std = np.std(base_times) * 0.5  # Reduce variance for simulation
    
    # Compound time deltas (simplified model)
    compound_delta = {"SOFT": -0.5, "MEDIUM": 0, "HARD": 0.3}
    
    # Pit stop time loss (seconds)
    pit_loss = 22.0
    
    total_laps = int(driver_laps["LapNumber"].max())
    start_position = int(driver_laps.filter(pl.col("LapNumber") == 1)["Position"].to_list()[0])
    
    results = []
    
    for _ in range(n_simulations):
        total_time = 0
        position = start_position
        current_stint = 0
        tyre_age = 0
        
        for lap in range(1, total_laps + 1):
            # Check for pit stop
            if lap in pit_laps:
                total_time += pit_loss
                current_stint += 1
                tyre_age = 0
                # Position loss from pit (random 1-3 places)
                position += np.random.randint(1, 4)
            
            # Get compound for current stint
            compound = compounds[min(current_stint, len(compounds) - 1)]
            
            # Calculate lap time
            lap_time = base_pace
            lap_time += compound_delta.get(compound, 0)
            lap_time += tyre_age * 0.02  # Degradation
            lap_time += np.random.normal(0, pace_std)  # Random variance
            
            # Safety car simulation (5% chance)
            if np.random.random() < 0.05:
                lap_time += 20  # SC lap is slower
                # Position shuffle
                position += np.random.randint(-2, 3)
            
            total_time += lap_time
            tyre_age += 1
            
            # Position changes based on pace
            if np.random.random() < 0.1:  # 10% chance of position change per lap
                position += np.random.choice([-1, 1])
        
        # Clamp position to valid range
        position = max(1, min(20, position))
        results.append(position)
    
    positions = np.array(results)
    
    return StrategyResult(
        expected_position=float(np.mean(positions)),
        position_std=float(np.std(positions)),
        podium_probability=float(np.sum(positions <= 3) / n_simulations),
        points_probability=float(np.sum(positions <= 10) / n_simulations),
        best_case=int(np.min(positions)),
        worst_case=int(np.max(positions)),
        simulations=results
    )


def compare_strategies(
    laps: pl.DataFrame,
    driver: str,
    strategies: list[dict],
    n_simulations: int = 500
) -> list[dict]:
    """
    Compare multiple strategies.
    
    Args:
        strategies: List of {"name": str, "pit_laps": list, "compounds": list}
    """
    results = []
    for strat in strategies:
        result = simulate_strategy(
            laps, driver,
            strat["pit_laps"],
            strat["compounds"],
            n_simulations
        )
        results.append({
            "name": strat["name"],
            "expected_position": result.expected_position,
            "podium_prob": result.podium_probability,
            "points_prob": result.points_probability,
        })
    
    return sorted(results, key=lambda x: x["expected_position"])

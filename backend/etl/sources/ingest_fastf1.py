import fastf1
import pandas as pd
import os
import argparse
from pathlib import Path
from typing import List, Optional, Dict


def get_available_data_types() -> List[str]:
    """Return list of available data types from FastF1."""
    return ['laps', 'race_control', 'weather', 'telemetry', 'position', 'stints']


def ingest_fastf1(year, race, session_type="R", types: Optional[List[str]] = None, cache_dir=None):
    """
    Download data from FastF1 API.
    
    Args:
        year: F1 season year
        race: Race name
        session_type: Session type (R, Q, FP1, FP2, FP3, S, SS)
        types: Optional list of specific data types to download
               Options: ['laps', 'race_control', 'weather', 'telemetry', 'position', 'stints']
        cache_dir: Cache directory path
    
    Returns:
        dict of DataFrames or None if failed
    """
    if cache_dir is None:
        cache_dir = os.path.expanduser("~/.cache/fastf1")
    
    Path(cache_dir).mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)
    
    if types is None:
        types = get_available_data_types()
    
    try:
        session = fastf1.get_session(year, race, session_type)
        session.load()
    except Exception as e:
        print(f"  Failed to load session: {e}")
        return None
    
    result = {}
    
    # laps - always available
    if 'laps' in types:
        laps = session.laps
        if laps is not None and not laps.empty:
            result['laps'] = laps
    
    # weather - always available after load
    if 'weather' in types:
        weather = session.weather_data
        if weather is not None and not weather.empty:
            result['weather'] = weather
    
    # race_control - available after load
    if 'race_control' in types:
        rc = session.race_control_messages
        if rc is not None and not rc.empty:
            result['race_control'] = rc
    
    # telemetry (car_data) - available after load
    if 'telemetry' in types:
        car_data = getattr(session, 'car_data', None)
        if car_data is not None and car_data:
            # Combine all driver car data into single DataFrame
            all_telemetry = []
            for drv_num, drv_data in car_data.items():
                if drv_data is not None and not drv_data.empty:
                    drv_data = drv_data.copy()
                    drv_data['driver_number'] = drv_num
                    all_telemetry.append(drv_data)
            if all_telemetry:
                result['telemetry'] = pd.concat(all_telemetry, ignore_index=True)
    
    # position data - available after load
    if 'position' in types:
        pos_data = getattr(session, 'pos_data', None)
        if pos_data is not None and pos_data:
            # Combine all driver position data into single DataFrame
            all_positions = []
            for drv_num, drv_data in pos_data.items():
                if drv_data is not None and not drv_data.empty:
                    drv_data = drv_data.copy()
                    drv_data['driver_number'] = drv_num
                    all_positions.append(drv_data)
            if all_positions:
                result['position'] = pd.concat(all_positions, ignore_index=True)
    
    # tyre stints - available after load
    if 'stints' in types:
        stints = getattr(session, 'stints', None)
        if stints is not None and not stints.empty:
            result['stints'] = stints
    
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download FastF1 data")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--race", type=str, required=True)
    parser.add_argument("--session", type=str, default="R")
    parser.add_argument("--types", nargs="+", 
                        choices=['laps', 'race_control', 'weather', 'telemetry', 'position', 'stints'],
                        help="Specific data types to download")
    
    args = parser.parse_args()
    
    data = ingest_fastf1(args.year, args.race, args.session, args.types)
    if data:
        print(f"Downloaded: {list(data.keys())}")
        for key, df in data.items():
            print(f"  {key}: {len(df)} rows")
    else:
        print("Failed to download data")

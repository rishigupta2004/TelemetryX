#!/usr/bin/env python3
"""Generate telemetry features for all sessions."""

from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from features.telemetry import build_telemetry_features
from features.utils import save_features

DATA_PATH = Path(__file__).parent.parent / "backend" / "etl" / "data"
SILVER_PATH = DATA_PATH / "silver"
FEATURES_PATH = DATA_PATH / "features"

def main():
    processed = 0
    
    for year_dir in sorted(SILVER_PATH.iterdir()):
        if not year_dir.name.isdigit():
            continue
        year = int(year_dir.name)
        if year < 2018 or year > 2025:
            continue
        
        for race_dir in sorted(year_dir.iterdir()):
            if not race_dir.is_dir():
                continue
            race = race_dir.name
            
            for session_dir in sorted(race_dir.iterdir()):
                if not session_dir.is_dir():
                    continue
                session = session_dir.name
                
                # Check if telemetry exists in silver
                tel_file = session_dir / "telemetry.parquet"
                if not tel_file.exists():
                    continue
                
                # Check if feature already exists
                out_dir = FEATURES_PATH / str(year) / race / session
                out_file = out_dir / "telemetry_features.parquet"
                if out_file.exists():
                    continue
                
                try:
                    print(f"Generating: {year} {race} {session}")
                    df = build_telemetry_features(year, race, session)
                    if not df.empty:
                        save_features(df, year, race, session, "telemetry_features")
                        processed += 1
                    else:
                        print(f"  ⚠️  Empty result")
                except Exception as e:
                    print(f"  ❌ Error: {e}")
    
    print(f"\nDone. Generated {processed} telemetry feature files.")

if __name__ == "__main__":
    main()

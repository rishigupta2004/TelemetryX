"""
Telemetry Backfill Script

Ingest telemetry from OpenF1 API and save to Bronze layer.
This ensures telemetry data flows through Bronze → Silver → Gold pipeline.

Usage:
    python backfill_telemetry.py --year 2024 --race "Bahrain Grand Prix" --session R
    python backfill_telemetry.py --year 2024 --race "Bahrain Grand Prix" --session all
    python backfill_telemetry.py --year all --dry-run  # Check what's missing
    python backfill_telemetry.py --year all  # Ingest all missing telemetry

Note: This is a TEMPORARY backfill script. The main ETL pipeline (ingest_unified.py)
should be updated to include telemetry in Bronze layer for new data ingestion.
"""

import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
import requests
from typing import Optional, Dict, List
import argparse
import time

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

BRONZE_DIR = Path(__file__).parent / "data" / "bronze"


class OpenF1Client:
    """Lightweight OpenF1 client for telemetry only."""
    
    BASE_URL = "https://api.openf1.org/v1"
    
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"Accept": "application/json"})
        self.rate_limit_delay = 0.5  # Respect API rate limits
    
    def _get(self, endpoint: str, params: dict = None) -> Optional[dict]:
        """Make GET request to OpenF1 API."""
        try:
            time.sleep(self.rate_limit_delay)
            r = self.s.get(f"{self.BASE_URL}/{endpoint}", params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"    API error: {e}")
            return None
    
    def get_meetings(self, year: int = None) -> List[dict]:
        """Get all meetings for a year."""
        params = {}
        if year:
            params["year"] = year
        return self._get("meetings", params) or []
    
    def get_sessions(self, meeting_key: int = None, year: int = None) -> List[dict]:
        """Get sessions for a meeting."""
        params = {}
        if meeting_key:
            params["meeting_key"] = meeting_key
        if year:
            params["year"] = year
        return self._get("sessions", params) or []
    
    def get_telemetry(self, session_key: int, driver: int = None) -> List[dict]:
        """Get telemetry data for a session."""
        params = {"session_key": session_key}
        if driver:
            params["driver_number"] = driver
        return self._get("telemetry", params) or []


# Session type mapping (CLI arg → OpenF1 session_type)
SESSION_TYPE_MAP = {
    "Q": "Qualifying",
    "R": "Race",
    "S": "Sprint",
    "SS": "Sprint Qualifying",
    "FP1": "Practice 1",
    "FP2": "Practice 2",
    "FP3": "Practice 3",
}

# Reverse mapping for display
SESSION_TYPE_REVERSE = {v: k for k, v in SESSION_TYPE_MAP.items()}


def find_session_key(client: OpenF1Client, year: int, race_name: str, session_type: str = "R") -> Optional[int]:
    """Find session_key for a specific race and session type."""
    # Convert CLI session type to OpenF1 session type
    openf1_session_type = SESSION_TYPE_MAP.get(session_type.upper(), session_type)
    
    meetings = client.get_meetings(year)
    race_lower = race_name.lower().replace("grand prix", "").replace("  ", " ").strip()
    
    for m in meetings:
        meeting_key = m.get("meeting_key")
        meeting_name = m.get("meeting_name", "").lower().replace("grand prix", "").replace("  ", " ").strip()
        
        # Match race name
        if race_lower not in meeting_name and meeting_name not in race_lower:
            continue
        
        # Find matching session type
        sessions = client.get_sessions(meeting_key=meeting_key)
        for s in sessions:
            s_type = s.get("session_type", "")
            # Exact match for OpenF1 session type
            if s_type == openf1_session_type:
                print(f"    Found: {s_type} (session_key={s.get('session_key')})")
                return s.get("session_key")
        
        # If specific session not found, try partial match
        for s in sessions:
            s_type = s.get("session_type", "")
            if session_type.upper() in s_type.upper():
                print(f"    Partial match: {s_type} (session_key={s.get('session_key')})")
                return s.get("session_key")
        
        # If still not found, return first session
        if sessions:
            print(f"    Warning: No {session_type} session found, using {sessions[0].get('session_type')}")
            return sessions[0].get("session_key")
    
    return None


def get_all_races_for_year(year: int) -> List[str]:
    """Get list of all races for a year from Bronze directory."""
    year_dir = BRONZE_DIR / str(year)
    if not year_dir.exists():
        return []
    return sorted([d.name for d in year_dir.iterdir() if d.is_dir()])


def check_telemetry_exists(year: int, race: str, session: str) -> bool:
    """Check if telemetry already exists in Bronze."""
    telemetry_path = BRONZE_DIR / str(year) / race / session / "openf1" / "telemetry_3d.parquet"
    return telemetry_path.exists()


def save_telemetry_to_bronze(data: List[dict], year: int, race: str, session: str) -> int:
    """Save telemetry data to Bronze layer."""
    if not data:
        return 0
    
    df = pd.DataFrame(data)
    
    # Create output directory
    output_dir = BRONZE_DIR / str(year) / race / session / "openf1"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save telemetry
    telemetry_path = output_dir / "telemetry_3d.parquet"
    df.to_parquet(telemetry_path, index=False)
    
    return len(df)


def ingest_telemetry(year: int, race: str, session: str, dry_run: bool = False) -> Dict:
    """Ingest telemetry for a single race/session."""
    result = {
        "year": year,
        "race": race,
        "session": session,
        "status": "pending",
        "records": 0,
        "error": None
    }
    
    # Check if already exists
    if check_telemetry_exists(year, race, session):
        print(f"  ⏭️  Skipping (exists): {year} {race} {session}")
        result["status"] = "skipped"
        return result
    
    if dry_run:
        print(f"  🔍 Would fetch: {year} {race} {session}")
        result["status"] = "dry_run"
        return result
    
    # Fetch from OpenF1
    print(f"  📡 Fetching: {year} {race} {session}")
    client = OpenF1Client()
    session_key = find_session_key(client, year, race, session)
    
    if not session_key:
        print(f"    ⚠️  No session found for {year} {race} {session}")
        result["status"] = "not_found"
        return result
    
    # Fetch telemetry
    telemetry_data = client.get_telemetry(session_key)
    
    if not telemetry_data:
        print(f"    ⚠️  No telemetry data returned")
        result["status"] = "empty"
        return result
    
    # Save to Bronze
    records = save_telemetry_to_bronze(telemetry_data, year, race, session)
    print(f"    ✅ Saved {records} telemetry records")
    result["status"] = "success"
    result["records"] = records
    
    return result


def get_available_sessions() -> List[str]:
    """Get list of session types to process."""
    return ["Q", "R", "S", "SS"]


def run_for_year(year: int, sessions: List[str] = None, dry_run: bool = False) -> List[Dict]:
    """Process all races for a specific year."""
    if sessions is None:
        sessions = get_available_sessions()
    
    results = []
    races = get_all_races_for_year(year)
    
    print(f"\n{'='*60}")
    print(f"YEAR: {year} ({len(races)} races)")
    print(f"{'='*60}")
    
    for race in races:
        print(f"\n  Race: {race}")
        for session in sessions:
            result = ingest_telemetry(year, race, session, dry_run)
            results.append(result)
    
    return results


def summarize_results(results: List[Dict]) -> None:
    """Print summary of backfill results."""
    total = len(results)
    success = sum(1 for r in results if r["status"] == "success")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    failed = sum(1 for r in results if r["status"] in ["not_found", "empty", "error"])
    dry_run = sum(1 for r in results if r["status"] == "dry_run")
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total:    {total}")
    print(f"  Success:  {success}")
    print(f"  Skipped:  {skipped}")
    print(f"  Failed:   {failed}")
    print(f"  Dry Run:  {dry_run}")
    
    if failed > 0:
        print(f"\n  Failed items:")
        for r in results:
            if r["status"] in ["not_found", "empty", "error"]:
                print(f"    - {r['year']} {r['race']} {r['session']}: {r['status']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill telemetry data to Bronze layer")
    parser.add_argument("--year", type=int, required=True, help="Year to process (e.g., 2024)")
    parser.add_argument("--race", type=str, default=None, help="Specific race name (optional)")
    parser.add_argument("--session", type=str, default="R", help="Session type: Q, R, S, SS, or all")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--list-races", action="store_true", help="List available races for the year")
    
    args = parser.parse_args()
    
    # Handle session types
    if args.session.lower() == "all":
        sessions = get_available_sessions()
    else:
        sessions = [args.session.upper()]
    
    # List races and exit
    if args.list_races:
        races = get_all_races_for_year(args.year)
        print(f"Races for {args.year}:")
        for race in races:
            print(f"  - {race}")
        sys.exit(0)
    
    # Handle specific race
    if args.race:
        results = []
        print(f"\n{'='*60}")
        print(f"SINGLE RACE: {args.year} {args.race} {','.join(sessions)}")
        print(f"{'='*60}")
        for session in sessions:
            result = ingest_telemetry(args.year, args.race, session, args.dry_run)
            results.append(result)
    else:
        # Process all races for year
        results = run_for_year(args.year, sessions, args.dry_run)
    
    # Print summary
    if not args.dry_run:
        summarize_results(results)
    else:
        print(f"\n[DRY RUN] No changes made")

"""FastF1 data ingestion - fetch F1 session data."""
import fastf1
from pathlib import Path

# Cache directory
CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))


def fetch_session(year: int, round_num: int, session: str = "R"):
    """Fetch F1 session. session: 'R'=Race, 'Q'=Quali, 'FP1/2/3'."""
    event = fastf1.get_session(year, round_num, session)
    event.load()
    return event


def get_laps(session) -> "polars.DataFrame":
    """Get all laps from session as Polars DataFrame."""
    import polars as pl
    df = session.laps.reset_index()
    return pl.from_pandas(df)


def get_telemetry(session, driver: str, lap_num: int = None):
    """Get telemetry for a driver. If lap_num=None, gets fastest lap."""
    driver_laps = session.laps.pick_driver(driver)
    if lap_num:
        lap = driver_laps[driver_laps["LapNumber"] == lap_num].iloc[0]
    else:
        lap = driver_laps.pick_fastest()
    return lap.get_telemetry()


def get_drivers(session) -> list:
    """Get list of driver codes in session."""
    return list(session.laps["Driver"].unique())


def get_session_info(session) -> dict:
    """Get session metadata."""
    return {
        "year": session.event.year,
        "round": session.event.RoundNumber,
        "name": session.event.EventName,
        "session": session.name,
        "date": str(session.date),
    }

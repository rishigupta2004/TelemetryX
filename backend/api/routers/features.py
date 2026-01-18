from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
import pandas as pd
import os

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURES_DIR = os.path.join(BASE_DIR, "etl", "data", "features")


def find_features_path(year: int, race_name: str, session: str) -> Optional[str]:
    """Find path to feature files for a race session."""
    path = os.path.join(FEATURES_DIR, str(year), race_name, session)
    if os.path.exists(path):
        return path
    return None


def get_available_races(year: int) -> List[str]:
    """Get list of available races for a year."""
    year_path = os.path.join(FEATURES_DIR, str(year))
    if not os.path.exists(year_path):
        return []
    return sorted([d for d in os.listdir(year_path) if os.path.isdir(os.path.join(year_path, d))])


def get_available_sessions(year: int, race_name: str) -> List[str]:
    """Get available sessions for a race."""
    race_path = os.path.join(FEATURES_DIR, str(year), race_name)
    if not os.path.exists(race_path):
        return []
    return sorted([d for d in os.listdir(race_path) if os.path.isdir(os.path.join(race_path, d))])


@router.get("/features/summary")
async def get_features_summary() -> Dict[str, Any]:
    """Get summary of all available features."""
    try:
        total_features = 0
        by_year = {}
        
        for year_dir in os.listdir(FEATURES_DIR):
            if not year_dir.isdigit():
                continue
            year = int(year_dir)
            year_path = os.path.join(FEATURES_DIR, year_dir)
            
            n_races = 0
            n_sessions = 0
            n_files = 0
            
            for race_dir in os.listdir(year_path):
                race_path = os.path.join(year_path, race_dir)
                if not os.path.isdir(race_path):
                    continue
                n_races += 1
                
                for session_dir in os.listdir(race_path):
                    session_path = os.path.join(race_path, session_dir)
                    if not os.path.isdir(session_path):
                        continue
                    n_sessions += 1
                    n_files += len([f for f in os.listdir(session_path) if f.endswith(".parquet")])
            
            by_year[year] = {
                "n_races": n_races,
                "n_sessions": n_sessions,
                "n_feature_files": n_files,
            }
            total_features += n_files
        
        return {
            "total_feature_files": total_features,
            "by_year": by_year,
            "feature_types": ["lap", "tyre", "telemetry", "race_context", "comparison", "position", "overtakes", "traffic", "points"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{year}")
async def list_races(year: int) -> Dict[str, Any]:
    """List all available races for a year."""
    races = get_available_races(year)
    return {
        "year": year,
        "n_races": len(races),
        "races": races,
    }


@router.get("/features/{year}/{race}")
async def list_sessions(year: int, race: str) -> Dict[str, Any]:
    """List all available sessions for a race."""
    race_name = race.replace("-", " ")
    sessions = get_available_sessions(year, race_name)
    return {
        "year": year,
        "race": race_name,
        "n_sessions": len(sessions),
        "sessions": sessions,
    }


@router.get("/features/{year}/{race}/{session}")
async def get_session_features(
    year: int,
    race: str,
    session: str,
    feature_type: Optional[str] = None
) -> Dict[str, Any]:
    """Get feature data for a race session."""
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")
    
    try:
        feature_files = [f for f in os.listdir(session_path) if f.endswith(".parquet")]
        
        if feature_type:
            feature_files = [f for f in feature_files if feature_type.lower() in f.lower()]
        
        features = {}
        for fname in feature_files:
            fpath = os.path.join(session_path, fname)
            df = pd.read_parquet(fpath)
            fname_key = fname.replace("_features.parquet", "")
            features[fname_key] = {
                "n_rows": len(df),
                "columns": list(df.columns),
                "sample": df.head(2).to_dict(orient="records") if len(df) > 0 else [],
            }
        
        return {
            "year": year,
            "race": race_name,
            "session": session,
            "n_features": len(features),
            "features": features,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{year}/{race}/{session}/lap")
async def get_lap_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get lap features for a race session."""
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")
    
    lap_file = os.path.join(session_path, "lap_features.parquet")
    if not os.path.exists(lap_file):
        raise HTTPException(status_code=404, detail="Lap features not found")
    
    try:
        df = pd.read_parquet(lap_file)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{year}/{race}/{session}/tyre")
async def get_tyre_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get tyre features for a race session."""
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")
    
    tyre_file = os.path.join(session_path, "tyre_features.parquet")
    if not os.path.exists(tyre_file):
        raise HTTPException(status_code=404, detail="Tyre features not found")
    
    try:
        df = pd.read_parquet(tyre_file)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{year}/{race}/{session}/comparison")
async def get_comparison_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get comparison features (head-to-head) for a race session."""
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")
    
    comp_file = os.path.join(session_path, "comparison_features.parquet")
    if not os.path.exists(comp_file):
        raise HTTPException(status_code=404, detail="Comparison features not found")
    
    try:
        df = pd.read_parquet(comp_file)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{year}/{race}/{session}/telemetry")
async def get_telemetry_features(year: int, race: str, session: str) -> List[Dict[str, Any]]:
    """Get telemetry features for a race session."""
    race_name = race.replace("-", " ")
    session_path = find_features_path(year, race_name, session)
    
    if not session_path:
        raise HTTPException(status_code=404, detail=f"No features found for {year} {race_name} {session}")
    
    tel_file = os.path.join(session_path, "telemetry_features.parquet")
    if not os.path.exists(tel_file):
        raise HTTPException(status_code=404, detail="Telemetry features not found")
    
    try:
        df = pd.read_parquet(tel_file)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

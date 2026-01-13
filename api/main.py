"""FastAPI endpoints for Telemetry X."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.storage.parquet_store import load_laps, BRONZE_DIR
from src.analysis.queries import get_driver_laps, compare_drivers, get_stint_summary, get_fastest_laps
from src.models.tire_deg import load_model, predict_lap_time, predict_degradation_curve

app = FastAPI(
    title="Telemetry X API",
    description="F1 Post-Race Analysis API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Models ---
class PredictionRequest(BaseModel):
    compound: str
    tyre_life: int
    stint: int = 1


class ComparisonRequest(BaseModel):
    year: int
    round: int
    driver1: str
    driver2: str


# --- Endpoints ---
@app.get("/")
def root():
    return {"status": "ok", "service": "Telemetry X API"}


@app.get("/sessions")
def list_sessions():
    """List available sessions."""
    sessions = []
    if BRONZE_DIR.exists():
        for year_dir in sorted(BRONZE_DIR.iterdir(), reverse=True):
            if year_dir.is_dir() and year_dir.name.isdigit():
                for round_dir in year_dir.iterdir():
                    if round_dir.is_dir():
                        round_num = int(round_dir.name.split("_")[1])
                        sessions.append({"year": int(year_dir.name), "round": round_num})
    return {"sessions": sessions}


@app.get("/laps/{year}/{round}")
def get_laps(year: int, round: int, driver: str = None):
    """Get lap data for a session."""
    try:
        laps = load_laps(year, round)
        if driver:
            laps = laps.filter(laps["Driver"] == driver)
        return {"count": laps.shape[0], "laps": laps.head(100).to_dicts()}
    except Exception as e:
        raise HTTPException(404, f"Session not found: {e}")


@app.get("/drivers/{year}/{round}")
def get_drivers(year: int, round: int):
    """Get list of drivers in a session."""
    try:
        laps = load_laps(year, round)
        drivers = laps["Driver"].unique().to_list()
        return {"drivers": sorted(drivers)}
    except Exception as e:
        raise HTTPException(404, f"Session not found: {e}")


@app.get("/fastest/{year}/{round}")
def fastest_laps(year: int, round: int):
    """Get fastest lap per driver."""
    try:
        fastest = get_fastest_laps(year, round)
        return {"fastest_laps": fastest.to_dicts()}
    except Exception as e:
        raise HTTPException(404, str(e))


@app.get("/stints/{year}/{round}/{driver}")
def stint_summary(year: int, round: int, driver: str):
    """Get stint summary for a driver."""
    try:
        stints = get_stint_summary(year, round, driver)
        return {"driver": driver, "stints": stints.to_dicts()}
    except Exception as e:
        raise HTTPException(404, str(e))


@app.post("/predict/laptime")
def predict_laptime(req: PredictionRequest):
    """Predict lap time based on tire conditions."""
    try:
        model, encoder = load_model()
        prediction = predict_lap_time(model, encoder, req.tyre_life, req.compound, req.stint)
        return {
            "compound": req.compound,
            "tyre_life": req.tyre_life,
            "stint": req.stint,
            "predicted_laptime_seconds": round(prediction, 2)
        }
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}")


@app.post("/predict/degradation")
def predict_degradation(req: PredictionRequest, max_laps: int = 20):
    """Predict degradation curve for a compound."""
    try:
        model, encoder = load_model()
        curve = predict_degradation_curve(model, encoder, req.compound, req.stint, max_laps)
        return {
            "compound": req.compound,
            "stint": req.stint,
            "curve": curve
        }
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

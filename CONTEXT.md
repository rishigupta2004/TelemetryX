# Telemetry X - Development Context

## Current Status
- **Phase**: Tier 1 Complete - Local Analytics MVP
- **Last Updated**: 2026-01-13
- **Next Action**: Tier 2 planning or enhance Tier 1 features

## Tier 1: Local Analytics - COMPLETE

### Phase 0: Project Setup
- [x] Git initialized
- [x] .gitignore, requirements.txt, README.md
- [x] Folder structure (src/, app/, data/, tests/)
- [x] Dependencies installed (fastf1, polars, duckdb, plotly, streamlit, xgboost)

### Phase 1: Data Ingestion
- [x] FastF1 client (`src/ingestion/fastf1_client.py`)
- [x] Functions: fetch_session, get_laps, get_telemetry, get_drivers

### Phase 2: Data Storage
- [x] Parquet storage (`src/storage/parquet_store.py`)
- [x] DuckDB queries
- [x] Medallion architecture (bronze layer)

### Phase 3: Basic Analytics
- [x] Query functions (`src/analysis/queries.py`)
- [x] get_driver_laps, compare_drivers, get_stint_summary, get_fastest_laps

### Phase 4: Visualizations
- [x] Plotly charts (`src/viz/charts.py`)
- [x] Lap times, telemetry comparison, stint summary, position chart

### Phase 5: Streamlit Dashboard
- [x] MVP dashboard (`app/main.py`)
- [x] Tabs: Lap Times, Telemetry, Strategy, Race
- [x] Run: `streamlit run app/main.py`

### Phase 6: ML Model
- [x] Tire degradation predictor (`src/models/tire_deg.py`)
- [x] XGBoost regression model
- [x] predict_degradation_curve function

## Pending (Tier 2)
- [ ] MLflow experiment tracking
- [ ] FastAPI endpoints
- [ ] More races data ingestion
- [ ] Strategy simulator
- [ ] Enhanced visualizations

## Configuration
- **Test Race**: Abu Dhabi 2024 (Round 24)
- **Data Scope**: 2018-2024 seasons
- **Python**: 3.12.2

## Data Available
- Abu Dhabi 2024: 1035 laps, 20 drivers
- VER/NOR telemetry saved

## Commits
| Hash | Phase | Description |
|------|-------|-------------|
| 11c5c3c | 0 | Project setup |
| e691279 | 1 | FastF1 data ingestion |
| bdc885d | 2 | Parquet + DuckDB storage |
| 2cca5fa | 3 | Analytics queries |
| 81a16fa | 4 | Plotly visualizations |
| 9d2e375 | 5 | Streamlit dashboard |
| 25e8e89 | 6 | Tire degradation ML model |

## How to Run
```bash
cd /Users/rishigupta/Documents/TelemetryX

# Run dashboard
streamlit run app/main.py

# Fetch more data
python -c "from src.ingestion.fastf1_client import fetch_session; fetch_session(2024, 1, 'R')"

# Train ML model
python -c "
from src.storage.parquet_store import load_laps
from src.models.tire_deg import prepare_training_data, train_model, save_model
laps = load_laps(2024, 24)
X, y, enc = prepare_training_data(laps)
model = train_model(X, y)
save_model(model, enc)
"
```

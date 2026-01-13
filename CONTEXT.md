# Telemetry X - Development Context

## Current Status
- **Phase**: Tier 2 In Progress - Team Collaboration
- **Last Updated**: 2026-01-13
- **Next Action**: Enhanced visualizations, more features

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

## Tier 2: Team Collaboration - IN PROGRESS

### T2-Phase 1: MLflow Tracking
- [x] MLflow integration (`src/mlops/tracking.py`)
- [x] Experiment tracking, model logging
- [x] Run: `mlflow ui` to view experiments

### T2-Phase 2: FastAPI Endpoints
- [x] REST API (`api/main.py`)
- [x] Endpoints: /sessions, /laps, /drivers, /predict
- [x] Run: `uvicorn api.main:app --reload`

### T2-Phase 3: More Races
- [x] Bahrain 2024: 1129 laps
- [x] Monaco 2024: 1111 laps
- [x] British GP 2024: 1310 laps
- [x] Abu Dhabi 2024: 1035 laps

### T2-Phase 4: Strategy Simulator
- [x] Monte Carlo simulation (`src/analysis/strategy.py`)
- [x] simulate_strategy, compare_strategies functions

### T2-Phase 5: Enhanced Visualizations
- [ ] Track maps
- [ ] Animated race replay
- [ ] 3D telemetry

## Configuration
- **Data Scope**: 2024 season (4 races loaded)
- **Python**: 3.12.2
- **MLflow**: file://mlruns

## Data Available
| Race | Laps | Drivers |
|------|------|---------|
| Bahrain 2024 (R1) | 1129 | 20 |
| Monaco 2024 (R6) | 1111 | 20 |
| British 2024 (R10) | 1310 | 20 |
| Abu Dhabi 2024 (R24) | 1035 | 20 |

## Commits
| Hash | Phase | Description |
|------|-------|-------------|
| 11c5c3c | T1-0 | Project setup |
| e691279 | T1-1 | FastF1 data ingestion |
| bdc885d | T1-2 | Parquet + DuckDB storage |
| 2cca5fa | T1-3 | Analytics queries |
| 81a16fa | T1-4 | Plotly visualizations |
| 9d2e375 | T1-5 | Streamlit dashboard |
| 25e8e89 | T1-6 | Tire degradation ML model |
| 14470c7 | T2-1/2 | MLflow + FastAPI |
| fabb9d8 | T2-3/4 | More races + Strategy Simulator |

## How to Run

```bash
cd /Users/rishigupta/Documents/TelemetryX

# Streamlit Dashboard
streamlit run app/main.py

# FastAPI Server
uvicorn api.main:app --reload --port 8000
# Then visit: http://localhost:8000/docs

# MLflow UI
mlflow ui --backend-store-uri file://mlruns
# Then visit: http://localhost:5000

# Strategy Simulation
python -c "
from src.storage.parquet_store import load_laps
from src.analysis.strategy import simulate_strategy
laps = load_laps(2024, 24)
result = simulate_strategy(laps, 'VER', [29], ['MEDIUM', 'HARD'])
print(f'Expected: P{result.expected_position:.1f}')
"
```

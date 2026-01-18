# F1 ETL Pipeline

Unified ETL pipeline for F1 data with Bronze/Silver/Gold architecture.

## Requirements

```bash
pip install fastf1 pandas pyarrow requests
```

## Data Sources

| Source | Priority | Data Types |
|--------|----------|------------|
| OpenF1 | 1st | 3D coordinates, 3.7Hz telemetry, team radio, overtakes |
| FastF1 | 2nd | Tyre data, weather, race control, laps |
| TracingInsights | 3rd | GitHub backup |

## Directory Structure

```
etl/
├── sources/
│   ├── ingest_fastf1.py   # FastF1 API ingestion
│   ├── ingest_openf1.py   # OpenF1 HTTP API ingestion
│   └── ing_tracing.py     # TracingInsights GitHub ingestion
├── data/
│   ├── bronze/            # Raw data from sources
│   ├── silver/            # Transformed/standardized data
│   └── gold/              # Aggregated analytics
├── ingest_unified.py      # Bronze ingestion orchestrator
├── process_silver.py      # Silver transformation
├── process_gold.py        # Gold aggregation
└── run_etl.py             # Pipeline runner
```

## Usage

```bash
# Full pipeline
python run_etl.py --year 2023 --race "Bahrain" --session R --round 1

# Qualifying only
python run_etl.py --year 2023 --race "Monaco" --session Q --round 6

# Force re-download
python run_etl.py --year 2023 --race "Silverstone" --session R --force
```

## Output Tables

### Bronze
- `openf1/telemetry_3d.parquet` - 3D position data
- `openf1/team_radio.parquet` - Team radio
- `openf1/overtakes.parquet` - Overtake events
- `fastf1/laps.parquet` - Lap times
- `fastf1/weather.parquet` - Weather data
- `fastf1/race_control.parquet` - Race control messages

### Silver
- `laps.parquet` - Standardized lap times
- `telemetry.parquet` - Unified telemetry
- `weather.parquet` - Standardized weather
- `race_control.parquet` - Standardized RC messages

### Gold
- `driver_standings.parquet` - Driver positions
- `constructor_standings.parquet` - Team standings
- `fastest_laps.parquet` - Fastest lap per driver
- `track_map.parquet` - 3D track coordinates

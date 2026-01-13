# Telemetry X

Post-race F1 deep-dive analysis platform.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run Streamlit app
streamlit run app/main.py
```

## Project Structure

```
src/
├── ingestion/     # FastF1 data fetching
├── storage/       # Parquet + DuckDB storage
├── analysis/      # Queries and analytics
├── viz/           # Plotly visualizations
└── models/        # ML models

app/               # Streamlit dashboard
data/              # Local data storage
```

## Data Source

Uses [FastF1](https://github.com/theOehrly/Fast-F1) for F1 telemetry data (2018-present).

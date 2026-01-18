# TelemetryX | F1 Strategy Dashboard

Professional Formula 1 playback and analysis platform featuring high-fidelity telemetry visualization, real-time strategy tools, and machine learning insights.

## Architecture V1.0

- **Backend:** Python FastAPI (REST + WebSocket), DuckDB, FastF1
- **Frontend:** React 18, TypeScript, Vite, Tailwind, Recharts, Deck.gl
- **Data:** Parquet-based silver/gold architecture with DuckDB query layer

## Getting Started

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

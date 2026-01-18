# TelemetryX Project Context

## Overview
TelemetryX is a professional-grade F1 telemetry dashboard designed for strategy analysis and historical playback.

## Architecture
- **Backend (`backend/`):** FastAPI application serving telemetry, laps, and analysis data. Uses DuckDB for high-performance querying of Parquet data.
- **Frontend (`frontend/`):** React/Vite application with a dark-mode UI. Features 3D track visualization (Deck.gl) and interactive charts.
- **Features (`features/`):** Standalone Python modules for feature engineering (tyre deg, lap quality, etc.).
- **ML (`ml/`):** Machine learning models for clustering and strategy prediction.

## Roadmap
1.  **Foundation:** V1.0 Architecture Migration (Completed)
2.  **Telemetry:** High-fidelity stacked traces (Speed/RPM/Throttle/Brake)
3.  **HUD:** Graphical driver dashboard (Gauges/Bars)
4.  **Strategy:** Race trace and gap analysis
5.  **Race Control:** Live message feed

## Current State
Migrated from monolithic structure to clear Backend/Frontend separation.

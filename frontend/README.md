# TelemetryX Desktop

Professional-grade F1 telemetry command center built with PySide6 and QML.

## Overview

TelemetryX Desktop is a high-performance desktop application for analyzing Formula 1 telemetry data. It provides real-time and post-race analysis capabilities with broadcast-quality visuals.

## Architecture

Built following the architecture defined in `Frontend_ArchitectureOverview.md`:

- **Framework**: PySide6 (Qt 6)
- **UI Layer**: QML + Qt Quick
- **Charts**: PyQtGraph + Custom OpenGL
- **State**: Custom Reactive Store
- **Data**: httpx + DuckDB
- **Packaging**: PyInstaller

## Directory Structure

```
frontend/
├── app/                      # Python application code
│   ├── core/                # Core infrastructure
│   │   ├── store/           # Reactive state management
│   │   ├── commands/        # Command pattern + undo/redo
│   │   ├── playback/        # Playback engine
│   │   └── bridge/          # QML ↔ Python bridge
│   ├── services/            # Services layer
│   │   ├── api/             # HTTP/WebSocket clients
│   │   ├── cache/           # Memory + disk caching
│   │   └── sync/            # Offline sync
│   ├── models/              # Pydantic data models
│   ├── rendering/           # Rendering components
│   │   ├── charts/          # PyQtGraph charts
│   │   ├── track/           # Track map rendering
│   │   └── video/           # Video player
│   ├── exports/             # Export functionality
│   └── plugins/             # Plugin system
├── ui/                      # QML user interface
│   ├── qml/                 # QML files
│   │   ├── components/      # Component library
│   │   │   ├── atoms/       # Primitive components
│   │   │   ├── molecules/   # Combined components
│   │   │   ├── organisms/   # Section components
│   │   │   └── templates/   # Layout templates
│   │   ├── views/           # Main views
│   │   └── popouts/         # Popout windows
│   └── assets/              # Static assets
│       ├── icons/           # Icon files
│       ├── fonts/           # Custom fonts
│       └── images/          # Image assets
├── tests/                   # Test suite
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── ui/                  # UI tests
├── plugins/                 # User-installed plugins
└── scripts/                 # Build and dev scripts
```

## Development

### Setup

```bash
cd frontend
pip install -e ".[dev]"
```

### Run Development Mode

```bash
# Option A: console script (after `pip install -e ".[dev]"`)
telemetryx

# Option B: module (no console script needed)
python -m app.main
```

### Build

```bash
python scripts/build.py
```

## License

MIT

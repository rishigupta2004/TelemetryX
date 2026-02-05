"""Main application entry point"""

import os
import sys
import structlog
from pathlib import Path

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import QUrl, Qt
from PySide6.QtQml import QQmlApplicationEngine, QQmlComponent
from PySide6.QtQuickControls2 import QQuickStyle

from app.core.store.root_store import get_store
from app.core.bridge.store_bridge import RootBridge
from app.core.playback.clock_manager import PlaybackStoreBridge, get_clock_manager
from app.services.playback_sync import PlaybackSync

# Optional: load repo `.env` for local dev convenience (no hard dependency).
try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    pass

# Initialize structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


class TelemetryXApplication:
    """Main application class"""

    def __init__(self):
        # Use a non-native Qt Quick Controls style so our QML customizations (e.g., Button background)
        # work consistently across platforms.
        if not os.environ.get("QT_QUICK_CONTROLS_STYLE"):
            QQuickStyle.setStyle("Basic")

        # Enable High DPI support
        QApplication.setHighDpiScaleFactorRoundingPolicy(
            Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
        )

        self.app = QApplication(sys.argv)
        self.app.setApplicationName("TelemetryX Desktop")
        self.app.setApplicationVersion("0.1.0")
        self.app.setOrganizationName("TelemetryX")

        self.engine = None
        self.root_bridge = None
        self.theme = None

        log.info("TelemetryX Desktop starting", version="0.1.0")

    def initialize_qml_engine(self) -> QQmlApplicationEngine:
        """Initialize QML engine and load main interface"""
        engine = QQmlApplicationEngine()

        # Add import path for QML modules
        qml_path = Path(__file__).parent.parent / "ui" / "qml"
        engine.addImportPath(str(qml_path))
        log.info("QML import path added", path=str(qml_path))

        # Create Theme singleton instance and expose to QML as global `theme`
        theme_file = qml_path / "Theme.qml"
        if not theme_file.exists():
            log.error("Theme QML file not found", path=str(theme_file))
            raise FileNotFoundError(f"Theme QML file not found: {theme_file}")

        theme_component = QQmlComponent(engine, QUrl.fromLocalFile(str(theme_file)))
        if theme_component.isError():
            for err in theme_component.errors():
                log.error("Theme component error", error=str(err))
            raise RuntimeError("Failed to compile Theme.qml")

        theme_object = theme_component.create()
        if theme_object is None:
            for err in theme_component.errors():
                log.error("Theme instantiation error", error=str(err))
            raise RuntimeError("Failed to instantiate Theme.qml")

        self.theme = theme_object
        engine.rootContext().setContextProperty("theme", theme_object)

        # Get root store
        root_store = get_store()

        # Default: show a welcome overlay (can be disabled with TELEMETRYX_SHOW_WELCOME=0)
        if os.getenv("TELEMETRYX_SHOW_WELCOME", "1") == "1":
            try:
                root_store.ui.open_modal("welcome")
            except Exception:
                pass

        # Create root bridge and expose to QML
        self.root_bridge = RootBridge(root_store)
        engine.rootContext().setContextProperty("rootStore", self.root_bridge)

        autoload_default = os.getenv("TELEMETRYX_AUTOLOAD_DEFAULT", "1") == "1"

        # Prefer warming the backend once on startup. Catalog loading is triggered after bootstrap
        # (quietly) to avoid double warm-ups competing on first run.
        if autoload_default:
            try:
                self.root_bridge.bootstrapFromBackend()
            except Exception as e:
                log.warning("Backend bootstrap failed to start", error=str(e))
        else:
            try:
                self.root_bridge.refreshCatalog()
            except Exception as e:
                log.warning("Catalog preload failed to start", error=str(e))

        # Playback: expose a tiny bridge and keep store view-models in sync with time.
        try:
            clock = get_clock_manager()
            total_time = float(getattr(root_store.session, "duration_seconds", 0) or 5400)
            total_laps = int(getattr(root_store.session, "total_laps", 0) or 57)
            clock.initialize(total_time, total_laps)

            playback = PlaybackStoreBridge(clock)
            engine.rootContext().setContextProperty("playback", playback)

            self._playback_sync = PlaybackSync(root_store)
            clock.timeChanged.connect(self._playback_sync.on_time_changed)
            self._playback_sync.on_time_changed(0.0)
        except Exception as e:
            log.warning("Playback init failed", error=str(e))

        # Load main QML file
        qml_file = qml_path / "main.qml"
        if qml_file.exists():
            engine.load(QUrl.fromLocalFile(str(qml_file)))
            log.info("QML interface loaded")
        else:
            log.error("Main QML file not found", path=str(qml_file))
            raise FileNotFoundError(f"Main QML file not found: {qml_file}")

        return engine

    def run(self) -> int:
        """Main application loop"""
        try:
            # Initialize QML engine
            self.engine = self.initialize_qml_engine()

            if not self.engine.rootObjects():
                log.error("Failed to load QML interface - no root objects")
                return 1

            log.info("Application started successfully")

            # Execute event loop
            return self.app.exec()

        except Exception as e:
            log.error("Application startup failed", error=str(e))
            return 1
        finally:
            if self.root_bridge:
                self.root_bridge.cleanup()
            log.info("Application shutdown")


def main():
    """Application entry point"""
    app = TelemetryXApplication()
    return app.run()


if __name__ == "__main__":
    sys.exit(main())

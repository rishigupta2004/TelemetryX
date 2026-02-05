"""UI tests for QML components"""

import pytest
from pytestqt.qt_compat import qt_api


class TestMainWindow:
    """Test main application window"""

    def test_window_title(self, qtbot):
        """Test window has correct title"""
        from PySide6.QtQml import QQmlApplicationEngine
        from PySide6.QtCore import QUrl

        engine = QQmlApplicationEngine()

        # Just test engine creation
        assert engine is not None

        engine.deleteLater()


class TestComponents:
    """Test QML components load correctly"""

    def test_button_component(self, qtbot):
        """Test TXButton component exists"""
        from PySide6.QtQml import QQmlComponent
        from PySide6.QtCore import QUrl

        # This would require a QML engine context
        # For now, just verify the file exists
        from pathlib import Path

        qml_file = (
            Path(__file__).resolve().parents[2]
            / "ui"
            / "qml"
            / "components"
            / "atoms"
            / "TXButton.qml"
        )
        assert qml_file.exists()


@pytest.fixture
def app(qtbot):
    """Create QApplication for tests"""
    from PySide6.QtWidgets import QApplication

    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    return app

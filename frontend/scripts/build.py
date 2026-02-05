"""Build script for PyInstaller packaging"""

import os
import sys
import shutil
from pathlib import Path
import PyInstaller.__main__

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
FRONTEND_DIR = PROJECT_ROOT / "app"
QML_DIR = PROJECT_ROOT / "ui" / "qml"
BUILD_DIR = PROJECT_ROOT / "build"
DIST_DIR = PROJECT_ROOT / "dist"


def clean_build():
    """Clean previous build artifacts"""
    print("Cleaning build directory...")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    print("Clean complete")


def collect_qml_files():
    """Collect all QML files for bundling"""
    qml_files = []
    for qml_file in QML_DIR.rglob("*.qml"):
        # Calculate relative path for PyInstaller
        rel_path = qml_file.relative_to(QML_DIR)
        qml_files.append((str(qml_file), str(rel_path.parent)))
    return qml_files


def build():
    """Build executable with PyInstaller"""
    print("Starting PyInstaller build...")

    # Clean first
    clean_build()

    # Main entry point
    main_script = FRONTEND_DIR / "main.py"

    # PyInstaller arguments
    args = [
        str(main_script),
        "--name=TelemetryX",
        "--onefile",  # Single executable file
        "--windowed",  # GUI application (no console)
        f"--distpath={DIST_DIR}",
        f"--workpath={BUILD_DIR}",
        "--clean",
        "--noconfirm",
        # Add data files
        f"--add-data={QML_DIR}:ui/qml",
        # Icon (if available)
        # "--icon=assets/icon.ico",
        # Hidden imports
        "--hidden-import=PySide6.QtQml",
        "--hidden-import=PySide6.QtQuick",
        "--hidden-import=PySide6.QtWidgets",
        "--hidden-import=httpx",
        "--hidden-import=duckdb",
        "--hidden-import=qasync",
    ]

    # Collect QML files
    for src, dst in collect_qml_files():
        args.append(f"--add-data={src}:{dst}")

    print(f"Running PyInstaller with {len(args)} arguments...")

    # Run PyInstaller
    PyInstaller.__main__.run(args)

    print(f"Build complete! Executable at: {DIST_DIR}/TelemetryX")


if __name__ == "__main__":
    build()

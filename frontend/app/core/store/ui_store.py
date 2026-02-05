"""UIStore - UI chrome state management

Per Frontend_ArchitectureOverview.md Part 2, Section 2.2:
Responsibilities: UI chrome state
Key Observables: activeView, sidebarOpen, theme, workspaceLayout
"""

from typing import Optional, List, Dict, Any
from .base import Store, Observable


class UIStore(Store):
    """Manages UI state and layout"""

    def __init__(self):
        super().__init__()

        # View state
        self._active_view = self._create_observable("activeView", "timing")  # type: Observable[str]
        # Views: timing, telemetry, track, compare, strategy, features, settings

        # Sidebar state
        self._sidebar_open = self._create_observable("sidebarOpen", True)  # type: Observable[bool]

        # Theme
        self._theme = self._create_observable("theme", "dark")  # type: Observable[str]
        # Themes: dark, light, highContrast

        # Workspace layout
        self._workspace_layout = self._create_observable(
            "workspaceLayout", self._get_default_layout()
        )  # type: Observable[Dict[str, Any]]

        # Command palette
        self._command_palette_open = self._create_observable("commandPaletteOpen", False)  # type: Observable[bool]

        # Modal state
        self._active_modal = self._create_observable("activeModal", None)  # type: Observable[Optional[str]]

    def _get_default_layout(self) -> Dict[str, Any]:
        """Get default workspace layout"""
        return {
            "timing": {"panels": ["timing_tower", "track_map"], "split": "horizontal"},
            "telemetry": {"panels": ["telemetry_charts", "track_map", "delta_chart"]},
            "track": {"panels": ["track_map_full"]},
            "compare": {"panels": ["lap_comparison", "driver_stats", "delta_breakdown"]},
            "strategy": {"panels": ["stint_timeline", "undercut_predictor", "pit_table"]},
            "features": {"panels": ["features_summary"]},
        }

    # Properties
    @property
    def active_view(self) -> str:
        return self._active_view.value

    @active_view.setter
    def active_view(self, value: str) -> None:
        self._active_view.value = value

    @property
    def sidebar_open(self) -> bool:
        return self._sidebar_open.value

    @sidebar_open.setter
    def sidebar_open(self, value: bool) -> None:
        self._sidebar_open.value = value

    @property
    def theme(self) -> str:
        return self._theme.value

    @theme.setter
    def theme(self, value: str) -> None:
        self._theme.value = value

    @property
    def workspace_layout(self) -> Dict[str, Any]:
        return self._workspace_layout.value

    @workspace_layout.setter
    def workspace_layout(self, value: Dict[str, Any]) -> None:
        self._workspace_layout.value = value

    @property
    def command_palette_open(self) -> bool:
        return self._command_palette_open.value

    @command_palette_open.setter
    def command_palette_open(self, value: bool) -> None:
        self._command_palette_open.value = value

    @property
    def active_modal(self) -> Optional[str]:
        return self._active_modal.value

    @active_modal.setter
    def active_modal(self, value: Optional[str]) -> None:
        self._active_modal.value = value

    # Methods
    def toggle_sidebar(self) -> None:
        """Toggle sidebar visibility"""
        self.sidebar_open = not self.sidebar_open

    def switch_view(self, view: str) -> None:
        """Switch to a different view"""
        valid_views = ["timing", "telemetry", "track", "compare", "strategy", "features", "settings"]
        if view in valid_views:
            self.active_view = view

    def set_theme(self, theme: str) -> None:
        """Set the application theme"""
        valid_themes = ["dark", "light", "highContrast"]
        if theme in valid_themes:
            self.theme = theme

    def open_command_palette(self) -> None:
        """Open the command palette"""
        self.command_palette_open = True

    def close_command_palette(self) -> None:
        """Close the command palette"""
        self.command_palette_open = False

    def open_modal(self, modal_id: str) -> None:
        """Open a modal dialog"""
        self.active_modal = modal_id

    def close_modal(self) -> None:
        """Close the active modal"""
        self.active_modal = None

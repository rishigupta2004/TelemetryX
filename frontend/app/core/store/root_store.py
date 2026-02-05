"""Root store - Composition of all stores"""

from typing import Optional, List, Any
from .base import Store
from .session_store import SessionStore
from .ui_store import UIStore
from .driver_store import DriverStore


class RootStore:
    """Root store that composes all domain stores"""

    def __init__(self):
        # Domain stores
        self.session = SessionStore()
        self.ui = UIStore()
        self.driver = DriverStore()

        # TODO: Add additional stores as needed
        # self.telemetry = TelemetryStore()
        # self.playback = PlaybackStore()
        # self.timing = TimingStore()
        # self.track = TrackStore()
        # self.strategy = StrategyStore()

    def initialize(self) -> None:
        """Initialize all stores and set up cross-store subscriptions"""

        # Set up middleware for logging
        def log_middleware(store_name: str, old_value: Any, new_value: Any) -> None:
            import structlog

            log = structlog.get_logger()
            log.debug(f"State change", store=store_name, old=old_value, new=new_value)

        # Apply middleware to all stores
        stores: List[Store] = [self.session, self.ui, self.driver]
        for store in stores:
            store.add_middleware(log_middleware)

    def dispose(self) -> None:
        """Clean up all stores"""
        pass  # TODO: Dispose effects and subscriptions


# Global singleton instance
_root_store: Optional[RootStore] = None


def get_store() -> RootStore:
    """Get the root store singleton"""
    global _root_store
    if _root_store is None:
        _root_store = RootStore()
        _root_store.initialize()
    return _root_store


def reset_store() -> None:
    """Reset the root store (for testing)"""
    global _root_store
    if _root_store:
        _root_store.dispose()
    _root_store = None

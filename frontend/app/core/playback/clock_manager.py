"""Playback Engine - Clock Manager, Seek Handler, Rate Control

Implements Playback Engine from Frontend_ArchitectureOverview.md Part 2, Section 2
"""

from typing import Callable, Optional, List
from dataclasses import dataclass
from enum import Enum
import asyncio
import structlog
from PySide6.QtCore import QObject, Property, Signal, QTimer, Slot

log = structlog.get_logger()


class PlaybackMode(Enum):
    """Playback mode"""

    STOPPED = "stopped"
    PLAYING = "playing"
    PAUSED = "paused"
    SCRUBBING = "scrubbing"


class PlaybackRate(Enum):
    """Playback speed rates"""

    SLOWER = 0.25
    SLOW = 0.5
    NORMAL = 1.0
    FAST = 2.0
    FASTER = 4.0


@dataclass
class ClockState:
    """Current clock state"""

    current_time: float = 0.0
    total_time: float = 0.0
    current_lap: int = 0
    total_laps: int = 0
    is_playing: bool = False
    rate: float = 1.0


class ClockManager(QObject):
    """Central playback clock manager

    Emits Qt signals for QML integration
    """

    # Qt Signals
    timeChanged = Signal(float)  # Current time in seconds
    lapChanged = Signal(int)  # Current lap number
    stateChanged = Signal(str)  # Playing, Paused, Stopped
    rateChanged = Signal(float)  # Playback rate
    finished = Signal()  # Playback finished

    def __init__(self, parent=None):
        super().__init__(parent)
        self._state = ClockState()
        self._mode = PlaybackMode.STOPPED
        self._tick_interval_ms = 16  # ~60Hz update
        self._callbacks: List[Callable[[float], None]] = []
        self._timer: Optional[QTimer] = None

        log.info("ClockManager initialized")

    def initialize(self, total_time: float, total_laps: int) -> None:
        """Initialize clock with session duration"""
        # Reset any prior timer/state (e.g., when switching sessions).
        if self._timer is not None:
            try:
                self._timer.stop()
            except Exception:
                pass
            try:
                self._timer.deleteLater()
            except Exception:
                pass
            self._timer = None

        self._mode = PlaybackMode.STOPPED
        self._state.is_playing = False
        self._state.total_time = total_time
        self._state.total_laps = total_laps
        self._state.current_time = 0.0
        self._state.current_lap = 1

        # Setup Qt timer for tick updates
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._on_tick)

        log.info("Clock initialized", total_time=total_time, total_laps=total_laps)

    def _on_tick(self) -> None:
        """Called on each timer tick"""
        if self._mode != PlaybackMode.PLAYING:
            return

        # Advance time
        delta_ms = self._tick_interval_ms * self._state.rate
        self._state.current_time += delta_ms / 1000.0

        # Check bounds
        if self._state.current_time >= self._state.total_time:
            self._state.current_time = self._state.total_time
            self.stop()
            self.finished.emit()
            return

        # Update lap
        lap_progress = self._state.current_time / self._state.total_time
        self._state.current_lap = int(lap_progress * self._state.total_laps) + 1

        # Emit signals
        self.timeChanged.emit(self._state.current_time)
        self.lapChanged.emit(self._state.current_lap)

        # Notify callbacks
        for callback in self._callbacks:
            try:
                callback(self._state.current_time)
            except Exception as e:
                log.error("Callback error", error=str(e))

    def play(self) -> None:
        """Start playback"""
        if self._mode == PlaybackMode.PLAYING:
            return

        self._mode = PlaybackMode.PLAYING
        self._state.is_playing = True

        if self._timer:
            self._timer.start(self._tick_interval_ms)

        self.stateChanged.emit("playing")
        log.debug("Playback started")

    def pause(self) -> None:
        """Pause playback"""
        if self._mode != PlaybackMode.PLAYING:
            return

        self._mode = PlaybackMode.PAUSED
        self._state.is_playing = False

        if self._timer:
            self._timer.stop()

        self.stateChanged.emit("paused")
        log.debug("Playback paused")

    def stop(self) -> None:
        """Stop playback"""
        self._mode = PlaybackMode.STOPPED
        self._state.is_playing = False

        if self._timer:
            self._timer.stop()

        self.stateChanged.emit("stopped")
        log.debug("Playback stopped")

    def seek(self, time_seconds: float) -> None:
        """Seek to specific time"""
        old_time = self._state.current_time
        self._state.current_time = max(0.0, min(time_seconds, self._state.total_time))

        # Update lap based on new time
        if self._state.total_time > 0:
            lap_progress = self._state.current_time / self._state.total_time
            self._state.current_lap = int(lap_progress * self._state.total_laps) + 1
        else:
            self._state.current_lap = 1

        self.timeChanged.emit(self._state.current_time)
        self.lapChanged.emit(self._state.current_lap)

        log.debug("Seek", from_time=old_time, to_time=self._state.current_time)

    def seek_to_lap(self, lap_number: int) -> None:
        """Seek to specific lap"""
        lap_progress = (lap_number - 1) / self._state.total_laps
        target_time = lap_progress * self._state.total_time
        self.seek(target_time)

    def set_rate(self, rate: float) -> None:
        """Set playback rate"""
        self._state.rate = rate
        self.rateChanged.emit(rate)
        log.debug("Rate changed", rate=rate)

    def step_forward(self, seconds: float = 10.0) -> None:
        """Step forward by seconds"""
        self.seek(self._state.current_time + seconds)

    def step_backward(self, seconds: float = 10.0) -> None:
        """Step backward by seconds"""
        self.seek(self._state.current_time - seconds)

    def toggle_play_pause(self) -> None:
        """Toggle between play and pause"""
        if self._mode == PlaybackMode.PLAYING:
            self.pause()
        else:
            self.play()

    def subscribe(self, callback: Callable[[float], None]) -> None:
        """Subscribe to time updates"""
        self._callbacks.append(callback)

    def unsubscribe(self, callback: Callable[[float], None]) -> None:
        """Unsubscribe from time updates"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    @property
    def current_time(self) -> float:
        return self._state.current_time

    @property
    def current_lap(self) -> int:
        return self._state.current_lap

    @property
    def is_playing(self) -> bool:
        return self._mode == PlaybackMode.PLAYING

    @property
    def progress(self) -> float:
        """Playback progress (0.0 to 1.0)"""
        if self._state.total_time == 0:
            return 0.0
        return self._state.current_time / self._state.total_time

    @property
    def total_time(self) -> float:
        return self._state.total_time


class PlaybackStoreBridge(QObject):
    """Bridge for exposing playback to QML"""

    timeChanged = Signal(float)
    lapChanged = Signal(int)
    isPlayingChanged = Signal(bool)
    rateChanged = Signal(float)
    progressChanged = Signal(float)

    def __init__(self, clock_manager: ClockManager, parent=None):
        super().__init__(parent)
        self._clock = clock_manager

        # Connect signals
        self._clock.timeChanged.connect(self.timeChanged)
        self._clock.timeChanged.connect(lambda _t: self.progressChanged.emit(self.progress))
        self._clock.lapChanged.connect(self.lapChanged)
        self._clock.stateChanged.connect(self._on_state_changed)
        self._clock.rateChanged.connect(self.rateChanged)

    def _on_state_changed(self, state: str) -> None:
        self.isPlayingChanged.emit(state == "playing")

    def get_currentTime(self) -> float:
        return float(self._clock.current_time)

    currentTime = Property(float, get_currentTime, notify=timeChanged)

    def get_currentLap(self) -> int:
        return int(self._clock.current_lap)

    currentLap = Property(int, get_currentLap, notify=lapChanged)

    def get_isPlaying(self) -> bool:
        return bool(self._clock.is_playing)

    isPlaying = Property(bool, get_isPlaying, notify=isPlayingChanged)

    def get_progress(self) -> float:
        return float(self._clock.progress)

    progress = Property(float, get_progress, notify=progressChanged)

    def get_rate(self) -> float:
        return float(getattr(self._clock, "_state").rate) if hasattr(self._clock, "_state") else 1.0

    rate = Property(float, get_rate, notify=rateChanged)

    # Slots for QML
    @Slot()
    def togglePlayPause(self) -> None:
        self._clock.toggle_play_pause()

    @Slot()
    def play(self) -> None:
        self._clock.play()

    @Slot()
    def pause(self) -> None:
        self._clock.pause()

    @Slot()
    def stop(self) -> None:
        self._clock.stop()

    @Slot()
    def start(self) -> None:
        self._clock.seek(0.0)

    @Slot()
    def end(self) -> None:
        self._clock.seek(self._clock.total_time)

    @Slot()
    def stepForward(self) -> None:
        self._clock.step_forward()

    @Slot()
    def stepBack(self) -> None:
        self._clock.step_backward()

    @Slot(float)
    def seek(self, time_seconds: float) -> None:
        self._clock.seek(float(time_seconds))

    @Slot(float)
    def setRate(self, rate: float) -> None:
        self._clock.set_rate(float(rate))


# Singleton
_clock_manager: Optional[ClockManager] = None


def get_clock_manager() -> ClockManager:
    """Get clock manager singleton"""
    global _clock_manager
    if _clock_manager is None:
        _clock_manager = ClockManager()
    return _clock_manager


def reset_clock_manager() -> None:
    """Reset clock manager (for testing)"""
    global _clock_manager
    _clock_manager = None

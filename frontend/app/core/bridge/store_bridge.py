"""QML Bridge Layer - QObject + Signals/Slots

Implements the cross-layer communication from Frontend_ArchitectureOverview.md Part 2, Section 5.1:
Pattern 4: CROSS-LAYER (QML ↔ Python)

- QML property read → Python @Property
- QML property notify ← Python Signal
- QML method call → Python @Slot
- QML signal ← Python emit()
"""

from typing import Any, Optional, Callable
import threading
from PySide6.QtCore import QObject, Signal, Property, Slot, QTimer
from PySide6.QtQml import QmlElement, QmlSingleton
import structlog

log = structlog.get_logger()


class StoreBridge(QObject):
    """Base bridge class for exposing store properties to QML

    Pattern: Python Store → QObject Properties → QML Bindings
    """

    # Signal emitted when any property changes
    propertyChanged = Signal(str, arguments=["propertyName"])

    def __init__(self, parent: Optional[QObject] = None):
        super().__init__(parent)
        self._store = None
        self._unsubscribers: list[Callable[[], None]] = []

    def bind_store(self, store: Any) -> None:
        """Bind to a store instance"""
        self._store = store
        self._setup_subscriptions()

    def _setup_subscriptions(self) -> None:
        """Override to set up store subscriptions"""
        pass

    def _notify_property_changed(self, property_name: str) -> None:
        """Notify QML of property change"""
        self.propertyChanged.emit(property_name)

    def cleanup(self) -> None:
        """Clean up subscriptions"""
        for unsub in self._unsubscribers:
            unsub()
        self._unsubscribers.clear()


class SessionBridge(StoreBridge):
    """Bridge for SessionStore

    Exposes:
    - season, race, session (int/str)
    - loadState (str)
    - sessionName, circuitName, sessionType (str)
    """

    # Signals for property changes
    seasonChanged = Signal(int)
    raceChanged = Signal(int)
    sessionChanged = Signal(str)
    loadStateChanged = Signal(str)
    sessionNameChanged = Signal(str)
    circuitNameChanged = Signal(str)
    sessionTypeChanged = Signal(str)
    timingRowsChanged = Signal(list)
    tyreStintsChanged = Signal(list)
    undercutPredictionChanged = Signal("QVariant")
    trackPointsChanged = Signal(list)
    trackSectorMarksChanged = Signal(list)
    trackDrsZonesChanged = Signal(list)
    trackCornersChanged = Signal(list)
    trackCarsChanged = Signal(list)
    telemetrySnapshotChanged = Signal("QVariant")
    telemetryWindowChanged = Signal("QVariant")
    telemetryLapCatalogChanged = Signal("QVariant")
    telemetrySegmentsChanged = Signal(list)
    telemetryPrimarySegmentChanged = Signal(str)
    telemetryCompareSegmentChanged = Signal(str)
    telemetryPrimaryLapChanged = Signal("QVariant")
    telemetryCompareLapChanged = Signal("QVariant")
    telemetryCompareEnabledChanged = Signal(bool)
    telemetryLapModeAvailableChanged = Signal(bool)
    telemetryLapModeChanged = Signal(bool)
    telemetryDeltaDistanceChanged = Signal(float)
    telemetryLapDurationChanged = Signal(float)
    telemetryTrackCarsChanged = Signal(list)
    telemetryDominanceZonesChanged = Signal(list)
    telemetryDeltaChanged = Signal(float)
    trackRotationDegChanged = Signal(float)
    trackAutoRotateChanged = Signal(bool)
    weatherSnapshotChanged = Signal("QVariant")
    raceControlChanged = Signal(list)
    raceControlLiveChanged = Signal(list)
    driverLapHistoryChanged = Signal("QVariant")
    driverSummaryChanged = Signal("QVariant")
    featuresSummaryChanged = Signal("QVariant")
    featuresDataChanged = Signal("QVariant")
    featuresActiveTypeChanged = Signal(str)
    featuresLiveChanged = Signal("QVariant")
    backendStatusChanged = Signal(str)
    raceNameChanged = Signal(str)
    raceSlugChanged = Signal(str)
    availableSessionsChanged = Signal(list)
    durationSecondsChanged = Signal(int)
    catalogYearsChanged = Signal(list)
    catalogRacesChanged = Signal(list)
    catalogSelectedYearChanged = Signal(int)
    catalogSelectedRaceChanged = Signal(str)
    catalogAvailableSessionsChanged = Signal(list)

    def __init__(self, parent: Optional[QObject] = None):
        super().__init__(parent)

    def bind_store(self, store: Any) -> None:
        super().bind_store(store)
        # Emit initial values
        if self._store:
            self.seasonChanged.emit(self.season)
            self.raceChanged.emit(self.race)
            self.sessionChanged.emit(self.session)
            self.loadStateChanged.emit(self.loadState)

    def _setup_subscriptions(self) -> None:
        """Subscribe to store changes and emit signals"""
        if not self._store:
            return

        # Subscribe to each observable
        self._unsubscribers.append(
            self._store._season.subscribe(lambda old, new: self.seasonChanged.emit(new or 0))
        )
        self._unsubscribers.append(
            self._store._race.subscribe(lambda old, new: self.raceChanged.emit(new or 0))
        )
        self._unsubscribers.append(
            self._store._session.subscribe(lambda old, new: self.sessionChanged.emit(new or ""))
        )
        self._unsubscribers.append(
            self._store._load_state.subscribe(lambda old, new: self.loadStateChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._session_name.subscribe(lambda old, new: self.sessionNameChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._circuit_name.subscribe(lambda old, new: self.circuitNameChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._session_type.subscribe(lambda old, new: self.sessionTypeChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._timing_rows.subscribe(lambda old, new: self.timingRowsChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._tyre_stints.subscribe(lambda old, new: self.tyreStintsChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._undercut_prediction.subscribe(
                lambda old, new: self.undercutPredictionChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._track_points.subscribe(lambda old, new: self.trackPointsChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._track_sector_marks.subscribe(
                lambda old, new: self.trackSectorMarksChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._track_drs_zones.subscribe(
                lambda old, new: self.trackDrsZonesChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._track_corners.subscribe(
                lambda old, new: self.trackCornersChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._track_cars.subscribe(lambda old, new: self.trackCarsChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._telemetry_snapshot.subscribe(
                lambda old, new: self.telemetrySnapshotChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_window.subscribe(lambda old, new: self.telemetryWindowChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._telemetry_lap_catalog.subscribe(
                lambda old, new: self.telemetryLapCatalogChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_segments.subscribe(
                lambda old, new: self.telemetrySegmentsChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_primary_segment.subscribe(
                lambda old, new: self.telemetryPrimarySegmentChanged.emit(str(new or ""))
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_compare_segment.subscribe(
                lambda old, new: self.telemetryCompareSegmentChanged.emit(str(new or ""))
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_primary_lap.subscribe(
                lambda old, new: self.telemetryPrimaryLapChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_compare_lap.subscribe(
                lambda old, new: self.telemetryCompareLapChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_compare_enabled.subscribe(
                lambda old, new: self.telemetryCompareEnabledChanged.emit(bool(new))
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_lap_mode_available.subscribe(
                lambda old, new: self.telemetryLapModeAvailableChanged.emit(bool(new))
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_lap_mode.subscribe(
                lambda old, new: self.telemetryLapModeChanged.emit(bool(new))
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_delta_distance.subscribe(
                lambda old, new: self.telemetryDeltaDistanceChanged.emit(float(new or 0.0))
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_lap_duration.subscribe(
                lambda old, new: self.telemetryLapDurationChanged.emit(float(new or 0.0))
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_track_cars.subscribe(
                lambda old, new: self.telemetryTrackCarsChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_dominance_zones.subscribe(
                lambda old, new: self.telemetryDominanceZonesChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._telemetry_delta.subscribe(
                lambda old, new: self.telemetryDeltaChanged.emit(float(new or 0.0))
            )
        )
        self._unsubscribers.append(
            self._store._track_rotation_deg.subscribe(
                lambda old, new: self.trackRotationDegChanged.emit(float(new or 0.0))
            )
        )
        self._unsubscribers.append(
            self._store._track_auto_rotate.subscribe(
                lambda old, new: self.trackAutoRotateChanged.emit(bool(new))
            )
        )
        self._unsubscribers.append(
            self._store._weather_snapshot.subscribe(lambda old, new: self.weatherSnapshotChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._race_control.subscribe(lambda old, new: self.raceControlChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._race_control_live.subscribe(lambda old, new: self.raceControlLiveChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._driver_lap_history.subscribe(
                lambda old, new: self.driverLapHistoryChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._driver_summary.subscribe(
                lambda old, new: self.driverSummaryChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._features_summary.subscribe(
                lambda old, new: self.featuresSummaryChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._features_live.subscribe(
                lambda old, new: self.featuresLiveChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._features_data.subscribe(
                lambda old, new: self.featuresDataChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._features_active_type.subscribe(
                lambda old, new: self.featuresActiveTypeChanged.emit(str(new or ""))
            )
        )
        self._unsubscribers.append(
            self._store._backend_status.subscribe(lambda old, new: self.backendStatusChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._race_name.subscribe(lambda old, new: self.raceNameChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._race_slug.subscribe(lambda old, new: self.raceSlugChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._available_sessions.subscribe(
                lambda old, new: self.availableSessionsChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._duration_s.subscribe(lambda old, new: self.durationSecondsChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._catalog_years.subscribe(lambda old, new: self.catalogYearsChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._catalog_races.subscribe(lambda old, new: self.catalogRacesChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._catalog_selected_year.subscribe(
                lambda old, new: self.catalogSelectedYearChanged.emit(int(new or 0))
            )
        )
        self._unsubscribers.append(
            self._store._catalog_selected_race.subscribe(
                lambda old, new: self.catalogSelectedRaceChanged.emit(str(new or ""))
            )
        )
        self._unsubscribers.append(
            self._store._catalog_available_sessions.subscribe(
                lambda old, new: self.catalogAvailableSessionsChanged.emit(new)
            )
        )

    # QML Properties
    def get_season(self) -> int:
        if self._store:
            return self._store.season or 0
        return 0

    def set_season(self, value: int) -> None:
        if self._store:
            self._store.season = value if value > 0 else None

    season = Property(int, get_season, set_season, notify=seasonChanged)

    def get_race(self) -> int:
        if self._store:
            return self._store.race or 0
        return 0

    def set_race(self, value: int) -> None:
        if self._store:
            self._store.race = value if value > 0 else None

    race = Property(int, get_race, set_race, notify=raceChanged)

    def get_session(self) -> str:
        if self._store:
            return self._store.session or ""
        return ""

    def set_session(self, value: str) -> None:
        if self._store:
            self._store.session = value if value else None

    session = Property(str, get_session, set_session, notify=sessionChanged)

    def get_loadState(self) -> str:
        if self._store:
            return self._store.load_state
        return "idle"

    loadState = Property(str, get_loadState, notify=loadStateChanged)

    def get_sessionName(self) -> str:
        if self._store:
            return self._store.session_name
        return ""

    sessionName = Property(str, get_sessionName, notify=sessionNameChanged)

    def get_circuitName(self) -> str:
        if self._store:
            return self._store.circuit_name
        return ""

    circuitName = Property(str, get_circuitName, notify=circuitNameChanged)

    def get_sessionType(self) -> str:
        if self._store:
            return self._store.session_type
        return ""

    sessionType = Property(str, get_sessionType, notify=sessionTypeChanged)

    def get_timingRows(self) -> list:
        if self._store:
            return self._store.timing_rows
        return []

    timingRows = Property(list, get_timingRows, notify=timingRowsChanged)

    def get_tyreStints(self) -> list:
        if self._store:
            return self._store.tyre_stints
        return []

    tyreStints = Property(list, get_tyreStints, notify=tyreStintsChanged)

    def get_trackPoints(self) -> list:
        if self._store:
            return self._store.track_points
        return []

    trackPoints = Property(list, get_trackPoints, notify=trackPointsChanged)

    def get_trackSectorMarks(self) -> list:
        if self._store:
            return self._store.track_sector_marks
        return []

    trackSectorMarks = Property(list, get_trackSectorMarks, notify=trackSectorMarksChanged)

    def get_trackDrsZones(self) -> list:
        if self._store:
            return self._store.track_drs_zones
        return []

    trackDrsZones = Property(list, get_trackDrsZones, notify=trackDrsZonesChanged)

    def get_trackCorners(self) -> list:
        if self._store:
            return self._store.track_corners
        return []

    trackCorners = Property(list, get_trackCorners, notify=trackCornersChanged)

    def get_trackCars(self) -> list:
        if self._store:
            return self._store.track_cars
        return []

    trackCars = Property(list, get_trackCars, notify=trackCarsChanged)

    def get_telemetrySnapshot(self):
        if self._store:
            return self._store.telemetry_snapshot
        return {}

    telemetrySnapshot = Property("QVariant", get_telemetrySnapshot, notify=telemetrySnapshotChanged)

    def get_telemetryWindow(self):
        if self._store:
            return self._store.telemetry_window
        return {}

    telemetryWindow = Property("QVariant", get_telemetryWindow, notify=telemetryWindowChanged)

    def get_telemetryLapCatalog(self):
        if self._store:
            return self._store.telemetry_lap_catalog
        return {}

    telemetryLapCatalog = Property(
        "QVariant", get_telemetryLapCatalog, notify=telemetryLapCatalogChanged
    )

    def get_telemetrySegments(self):
        if self._store:
            return self._store.telemetry_segments
        return []

    telemetrySegments = Property(list, get_telemetrySegments, notify=telemetrySegmentsChanged)

    def get_telemetryPrimarySegment(self):
        if self._store:
            return self._store.telemetry_primary_segment
        return ""

    telemetryPrimarySegment = Property(
        str, get_telemetryPrimarySegment, notify=telemetryPrimarySegmentChanged
    )

    def get_telemetryCompareSegment(self):
        if self._store:
            return self._store.telemetry_compare_segment
        return ""

    telemetryCompareSegment = Property(
        str, get_telemetryCompareSegment, notify=telemetryCompareSegmentChanged
    )

    def get_telemetryPrimaryLap(self):
        if self._store:
            return self._store.telemetry_primary_lap
        return None

    telemetryPrimaryLap = Property(
        "QVariant", get_telemetryPrimaryLap, notify=telemetryPrimaryLapChanged
    )

    def get_telemetryCompareLap(self):
        if self._store:
            return self._store.telemetry_compare_lap
        return None

    telemetryCompareLap = Property(
        "QVariant", get_telemetryCompareLap, notify=telemetryCompareLapChanged
    )

    def get_telemetryCompareEnabled(self):
        if self._store:
            return self._store.telemetry_compare_enabled
        return False

    telemetryCompareEnabled = Property(
        bool, get_telemetryCompareEnabled, notify=telemetryCompareEnabledChanged
    )

    def get_telemetryLapModeAvailable(self):
        if self._store:
            return self._store.telemetry_lap_mode_available
        return False

    telemetryLapModeAvailable = Property(
        bool, get_telemetryLapModeAvailable, notify=telemetryLapModeAvailableChanged
    )

    def get_telemetryLapMode(self):
        if self._store:
            return self._store.telemetry_lap_mode
        return False

    telemetryLapMode = Property(bool, get_telemetryLapMode, notify=telemetryLapModeChanged)

    def get_telemetryLapDuration(self):
        if self._store:
            return self._store.telemetry_lap_duration
        return 0.0

    telemetryLapDuration = Property(
        float, get_telemetryLapDuration, notify=telemetryLapDurationChanged
    )

    def get_telemetryTrackCars(self):
        if self._store:
            return self._store.telemetry_track_cars
        return []

    telemetryTrackCars = Property(list, get_telemetryTrackCars, notify=telemetryTrackCarsChanged)

    def get_telemetryDominanceZones(self):
        if self._store:
            return self._store.telemetry_dominance_zones
        return []

    telemetryDominanceZones = Property(
        list, get_telemetryDominanceZones, notify=telemetryDominanceZonesChanged
    )

    def get_telemetryDelta(self):
        if self._store:
            return self._store.telemetry_delta
        return 0.0

    telemetryDelta = Property(float, get_telemetryDelta, notify=telemetryDeltaChanged)

    def get_telemetryDeltaDistance(self):
        if self._store:
            return self._store.telemetry_delta_distance
        return 0.0

    telemetryDeltaDistance = Property(
        float, get_telemetryDeltaDistance, notify=telemetryDeltaDistanceChanged
    )

    def get_trackRotationDeg(self):
        if self._store:
            return self._store.track_rotation_deg
        return 0.0

    trackRotationDeg = Property(float, get_trackRotationDeg, notify=trackRotationDegChanged)

    def get_trackAutoRotate(self):
        if self._store:
            return bool(self._store.track_auto_rotate)
        return True

    trackAutoRotate = Property(bool, get_trackAutoRotate, notify=trackAutoRotateChanged)

    def get_weatherSnapshot(self):
        if self._store:
            return self._store.weather_snapshot
        return {}

    weatherSnapshot = Property("QVariant", get_weatherSnapshot, notify=weatherSnapshotChanged)

    def get_raceControl(self) -> list:
        if self._store:
            return self._store.race_control
        return []

    raceControl = Property(list, get_raceControl, notify=raceControlChanged)

    def get_raceControlLive(self) -> list:
        if self._store:
            return self._store.race_control_live
        return []

    raceControlLive = Property(list, get_raceControlLive, notify=raceControlLiveChanged)

    def get_driverLapHistory(self):
        if self._store:
            return self._store.driver_lap_history
        return {}

    driverLapHistory = Property("QVariant", get_driverLapHistory, notify=driverLapHistoryChanged)

    def get_driverSummary(self):
        if self._store:
            return self._store.driver_summary
        return {}

    driverSummary = Property("QVariant", get_driverSummary, notify=driverSummaryChanged)

    def get_featuresSummary(self):
        if self._store:
            return self._store.features_summary
        return {}

    featuresSummary = Property("QVariant", get_featuresSummary, notify=featuresSummaryChanged)

    def get_featuresData(self):
        if self._store:
            return self._store.features_data
        return []

    featuresData = Property("QVariant", get_featuresData, notify=featuresDataChanged)

    def get_featuresLive(self):
        if self._store:
            return self._store.features_live
        return {}

    featuresLive = Property("QVariant", get_featuresLive, notify=featuresLiveChanged)

    def get_featuresActiveType(self) -> str:
        if self._store:
            return self._store.features_active_type
        return ""

    featuresActiveType = Property(str, get_featuresActiveType, notify=featuresActiveTypeChanged)

    def get_backendStatus(self) -> str:
        if self._store:
            return str(getattr(self._store, "backend_status", "") or "")
        return ""

    backendStatus = Property(str, get_backendStatus, notify=backendStatusChanged)

    def get_raceName(self) -> str:
        if self._store:
            return self._store.race_name
        return ""

    raceName = Property(str, get_raceName, notify=raceNameChanged)

    def get_raceSlug(self) -> str:
        if self._store:
            return self._store.race_slug
        return ""

    raceSlug = Property(str, get_raceSlug, notify=raceSlugChanged)

    def get_availableSessions(self) -> list:
        if self._store:
            return self._store.available_sessions
        return []

    availableSessions = Property(list, get_availableSessions, notify=availableSessionsChanged)

    def get_catalogYears(self) -> list:
        if self._store:
            return self._store.catalog_years
        return []

    catalogYears = Property(list, get_catalogYears, notify=catalogYearsChanged)

    def get_catalogRaces(self) -> list:
        if self._store:
            return self._store.catalog_races
        return []

    catalogRaces = Property(list, get_catalogRaces, notify=catalogRacesChanged)

    def get_catalogSelectedYear(self) -> int:
        if self._store:
            return int(self._store.catalog_selected_year or 0)
        return 0

    catalogSelectedYear = Property(int, get_catalogSelectedYear, notify=catalogSelectedYearChanged)

    def get_catalogSelectedRace(self) -> str:
        if self._store:
            return str(self._store.catalog_selected_race or "")
        return ""

    catalogSelectedRace = Property(str, get_catalogSelectedRace, notify=catalogSelectedRaceChanged)

    def get_catalogAvailableSessions(self) -> list:
        if self._store:
            return self._store.catalog_available_sessions
        return []

    catalogAvailableSessions = Property(
        list, get_catalogAvailableSessions, notify=catalogAvailableSessionsChanged
    )

    def get_durationSeconds(self) -> int:
        if self._store:
            return int(self._store.duration_seconds or 0)
        return 0

    durationSeconds = Property(int, get_durationSeconds, notify=durationSecondsChanged)

    def get_undercutPrediction(self):
        if self._store:
            return self._store.undercut_prediction
        return None

    undercutPrediction = Property("QVariant", get_undercutPrediction, notify=undercutPredictionChanged)

    # QML Slots
    @Slot(int, int, str)
    def selectSession(self, season: int, race: int, session: str) -> None:
        """Select a session from QML"""
        if self._store:
            log.info("Selecting session from QML", season=season, race=race, session=session)
            self._store.select_session(season, race, session)

    @Slot()
    def clearSession(self) -> None:
        """Clear current session from QML"""
        if self._store:
            self._store.clear_session()

    @Slot(str, str)
    def predictUndercut(self, attackerCode: str, defenderCode: str) -> None:
        """Run a minimal undercut prediction via backend ML."""
        if not self._store:
            return
        # The actual implementation lives in `app.services.bootstrap` to keep this bridge small.
        try:
            from app.services.strategy import predict_undercut_into_store

            predict_undercut_into_store(self._store, attackerCode, defenderCode)
        except Exception:
            self._store.undercut_prediction = {"error": "Undercut prediction failed"}


class UIBridge(StoreBridge):
    """Bridge for UIStore

    Exposes:
    - activeView (str)
    - sidebarOpen (bool)
    - theme (str)
    - commandPaletteOpen (bool)
    - activeModal (str)
    """

    # Signals
    activeViewChanged = Signal(str)
    sidebarOpenChanged = Signal(bool)
    themeChanged = Signal(str)
    commandPaletteOpenChanged = Signal(bool)
    activeModalChanged = Signal(str)

    def __init__(self, parent: Optional[QObject] = None):
        super().__init__(parent)

    def bind_store(self, store: Any) -> None:
        super().bind_store(store)
        # Emit initial values
        if self._store:
            self.activeViewChanged.emit(self.activeView)
            self.sidebarOpenChanged.emit(self.sidebarOpen)
            self.themeChanged.emit(self.theme)
            self.activeModalChanged.emit(self.activeModal)

    def _setup_subscriptions(self) -> None:
        """Subscribe to UI store changes"""
        if not self._store:
            return

        self._unsubscribers.append(
            self._store._active_view.subscribe(lambda old, new: self.activeViewChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._sidebar_open.subscribe(lambda old, new: self.sidebarOpenChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._theme.subscribe(lambda old, new: self.themeChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._command_palette_open.subscribe(
                lambda old, new: self.commandPaletteOpenChanged.emit(new)
            )
        )
        self._unsubscribers.append(
            self._store._active_modal.subscribe(lambda old, new: self.activeModalChanged.emit(new or ""))
        )

    # Properties
    def get_activeView(self) -> str:
        if self._store:
            return self._store.active_view
        return "timing"

    def set_activeView(self, value: str) -> None:
        if self._store:
            self._store.active_view = value

    activeView = Property(str, get_activeView, set_activeView, notify=activeViewChanged)

    def get_sidebarOpen(self) -> bool:
        if self._store:
            return self._store.sidebar_open
        return True

    def set_sidebarOpen(self, value: bool) -> None:
        if self._store:
            self._store.sidebar_open = value

    sidebarOpen = Property(bool, get_sidebarOpen, set_sidebarOpen, notify=sidebarOpenChanged)

    def get_theme(self) -> str:
        if self._store:
            return self._store.theme
        return "dark"

    def set_theme(self, value: str) -> None:
        if self._store:
            self._store.set_theme(value)

    theme = Property(str, get_theme, set_theme, notify=themeChanged)

    def get_commandPaletteOpen(self) -> bool:
        if self._store:
            return self._store.command_palette_open
        return False

    def set_commandPaletteOpen(self, value: bool) -> None:
        if self._store:
            self._store.command_palette_open = value

    commandPaletteOpen = Property(
        bool, get_commandPaletteOpen, set_commandPaletteOpen, notify=commandPaletteOpenChanged
    )

    def get_activeModal(self) -> str:
        if self._store:
            return self._store.active_modal or ""
        return ""

    activeModal = Property(str, get_activeModal, notify=activeModalChanged)

    # Slots
    @Slot()
    def toggleSidebar(self) -> None:
        """Toggle sidebar from QML"""
        if self._store:
            self._store.toggle_sidebar()

    @Slot(str)
    def switchView(self, view: str) -> None:
        """Switch view from QML"""
        if self._store:
            self._store.switch_view(view)

    @Slot()
    def openCommandPalette(self) -> None:
        """Open command palette from QML"""
        if self._store:
            self._store.open_command_palette()

    @Slot()
    def closeCommandPalette(self) -> None:
        """Close command palette from QML"""
        if self._store:
            self._store.close_command_palette()

    @Slot(str)
    def openModal(self, modal_id: str) -> None:
        if self._store:
            self._store.open_modal(modal_id)

    @Slot()
    def closeModal(self) -> None:
        if self._store:
            self._store.close_modal()


class DriverBridge(StoreBridge):
    """Bridge for DriverStore

    Exposes:
    - primaryDriver (str)
    - compareDriver (str)
    - allDrivers (list)
    - pinnedDrivers (list)
    """

    # Signals
    primaryDriverChanged = Signal(str)
    compareDriverChanged = Signal(str)
    allDriversChanged = Signal(list)
    pinnedDriversChanged = Signal(list)

    def __init__(self, parent: Optional[QObject] = None):
        super().__init__(parent)

    def _setup_subscriptions(self) -> None:
        """Subscribe to driver store changes"""
        if not self._store:
            return

        self._unsubscribers.append(
            self._store._primary_driver.subscribe(
                lambda old, new: self.primaryDriverChanged.emit(new or "")
            )
        )
        self._unsubscribers.append(
            self._store._compare_driver.subscribe(
                lambda old, new: self.compareDriverChanged.emit(new or "")
            )
        )
        self._unsubscribers.append(
            self._store._all_drivers.subscribe(lambda old, new: self.allDriversChanged.emit(new))
        )
        self._unsubscribers.append(
            self._store._pinned_drivers.subscribe(
                lambda old, new: self.pinnedDriversChanged.emit(new)
            )
        )

    # Properties
    def get_primaryDriver(self) -> str:
        if self._store:
            return self._store.primary_driver or ""
        return ""

    def set_primaryDriver(self, value: str) -> None:
        if self._store:
            self._store.select_primary_driver(value)

    primaryDriver = Property(str, get_primaryDriver, set_primaryDriver, notify=primaryDriverChanged)

    def get_compareDriver(self) -> str:
        if self._store:
            return self._store.compare_driver or ""
        return ""

    def set_compareDriver(self, value: str) -> None:
        if self._store:
            self._store.select_compare_driver(value if value else None)

    compareDriver = Property(str, get_compareDriver, set_compareDriver, notify=compareDriverChanged)

    def get_allDrivers(self) -> list:
        if self._store:
            return self._store.all_drivers
        return []

    allDrivers = Property(list, get_allDrivers, notify=allDriversChanged)

    def get_pinnedDrivers(self) -> list:
        if self._store:
            return self._store.pinned_drivers
        return []

    pinnedDrivers = Property(list, get_pinnedDrivers, notify=pinnedDriversChanged)

    # Slots
    @Slot(str)
    def selectPrimaryDriver(self, driver_code: str) -> None:
        """Select primary driver from QML"""
        if self._store:
            self._store.select_primary_driver(driver_code)

    @Slot(str)
    def selectCompareDriver(self, driver_code: str) -> None:
        """Select/clear compare driver from QML"""
        if self._store:
            self._store.select_compare_driver(driver_code if driver_code else None)

    @Slot(str)
    def toggleCompareDriver(self, driver_code: str) -> None:
        """Toggle compare driver from QML"""
        if self._store:
            self._store.toggle_compare_driver(driver_code)

    @Slot(str, result="QVariant")
    def getDriverByCode(self, driver_code: str):
        """Get driver metadata by code for QML bindings."""
        if not self._store or not driver_code:
            return None
        return self._store.get_driver_by_code(driver_code)

    @Slot(str)
    def togglePin(self, driver_code: str) -> None:
        """Toggle driver pin from QML"""
        if self._store:
            self._store.toggle_pin(driver_code)

    @Slot()
    def clearFilters(self) -> None:
        """Clear all filters from QML"""
        if self._store:
            self._store.clear_filters()


class RootBridge(QObject):
    """Root bridge that exposes all store bridges to QML

    Registered as context property: rootStore
    """

    _invoke = Signal(object)

    def __init__(self, root_store: Any, parent: Optional[QObject] = None):
        super().__init__(parent)

        self._root_store = root_store
        self._load_token = 0
        self._catalog_token = 0
        self._features_token = 0

        # Create bridges
        self._session = SessionBridge(self)
        self._ui = UIBridge(self)
        self._driver = DriverBridge(self)

        # Bind to stores
        self._session.bind_store(root_store.session)
        self._ui.bind_store(root_store.ui)
        self._driver.bind_store(root_store.driver)

        # Ensure background threads can safely schedule UI-store updates on the Qt main thread.
        self._invoke.connect(self._run_on_ui_thread)

        log.info("RootBridge initialized", bridges=["session", "ui", "driver"])

    @Slot(object)
    def _run_on_ui_thread(self, fn: object) -> None:
        try:
            if callable(fn):
                fn()
        except Exception as e:
            log.warning("UI-thread invoke failed", error=str(e))

    @Property(QObject, constant=True)
    def session(self) -> QObject:
        """Session store bridge"""
        return self._session

    @Property(QObject, constant=True)
    def ui(self) -> QObject:
        """UI store bridge"""
        return self._ui

    @Property(QObject, constant=True)
    def driver(self) -> QObject:
        """Driver store bridge"""
        return self._driver

    @Slot(str)
    def loadSession(self, session_code: str) -> None:
        """Reload the current race/year with a different session code (R/Q/S/SS)."""
        if not self._root_store:
            return
        year = getattr(self._root_store.session, "season", None)
        race_name = getattr(self._root_store.session, "race_name", "") or getattr(
            self._root_store.session, "circuit_name", ""
        )
        if not year or not race_name:
            # If nothing loaded yet, just bootstrap.
            self.bootstrapFromBackend()
            return

        token = self._load_token = self._load_token + 1
        self._root_store.session.backend_status = f"Loading {session_code}…"
        self._root_store.session.load_state = "loading"

        def _work():
            try:
                from app.services.bootstrap import fetch_session_bundle

                return fetch_session_bundle(int(year), str(race_name), str(session_code))
            except Exception as e:
                return e

        def _apply(result):
            if token != self._load_token:
                return
            if isinstance(result, Exception):
                self._root_store.session.backend_status = f"Load failed: {result}"
                return
            try:
                from app.services.bootstrap import apply_session_bundle, _load_telemetry_async
                from app.core.playback.clock_manager import get_clock_manager

                apply_session_bundle(self._root_store, result)
                _load_telemetry_async(self._root_store, int(year), str(race_name), str(session_code))
                self.loadDriverSummary()

                clock = get_clock_manager()
                total_time = float(getattr(self._root_store.session, "duration_seconds", 0) or 5400)
                total_laps = int(getattr(self._root_store.session, "total_laps", 0) or 57)
                clock.initialize(total_time, total_laps)
                clock.stop()
                clock.seek(0.0)
                self._root_store.session.backend_status = "Backend connected"
            except Exception as e:
                self._root_store.session.backend_status = f"Load failed: {e}"

        def _runner():
            res = _work()
            self._invoke.emit(lambda res=res: _apply(res))

        threading.Thread(target=_runner, daemon=True).start()

    @Slot(str)
    def loadFeatureData(self, feature_type: str) -> None:
        if not self._root_store:
            return
        year = getattr(self._root_store.session, "season", None)
        race_name = getattr(self._root_store.session, "race_name", "") or ""
        session_code = getattr(self._root_store.session, "session", "") or ""
        if not year or not race_name or not session_code:
            return
        ftype = str(feature_type or "")
        token = self._features_token = self._features_token + 1
        self._root_store.session.features_active_type = ftype
        self._root_store.session.backend_status = f"Loading features: {ftype}…"

        def _work():
            try:
                from app.services.api.telemetryx_backend import TelemetryXBackend

                backend = TelemetryXBackend()
                try:
                    rows = backend.feature_dataset(int(year), str(race_name), str(session_code), ftype)
                    return rows
                finally:
                    backend.close()
            except Exception as e:
                return e

        def _apply(result):
            if token != self._features_token:
                return
            if isinstance(result, Exception):
                self._root_store.session.backend_status = f"Feature load failed: {result}"
                self._root_store.session.features_data = []
                return
            rows = result if isinstance(result, list) else []
            self._root_store.session.features_data = rows[:200]
            self._root_store.session.backend_status = "Backend connected"

        def _runner():
            res = _work()
            self._invoke.emit(lambda res=res: _apply(res))

        threading.Thread(target=_runner, daemon=True).start()

    @Slot()
    def loadDriverSummary(self) -> None:
        if not self._root_store:
            return
        year = getattr(self._root_store.session, "season", None)
        race_name = getattr(self._root_store.session, "race_name", "") or ""
        session_code = getattr(self._root_store.session, "session", "") or ""
        driver = getattr(self._root_store.driver, "primary_driver", "") or ""
        compare = getattr(self._root_store.driver, "compare_driver", "") or ""
        if not year or not race_name or not session_code or not driver:
            self._root_store.session.driver_summary = {}
            return
        token = self._features_token = self._features_token + 1

        def _work():
            try:
                from app.services.api.telemetryx_backend import TelemetryXBackend

                backend = TelemetryXBackend()
                try:
                    return backend.driver_summary(int(year), str(race_name), str(session_code), str(driver), str(compare))
                finally:
                    backend.close()
            except Exception as e:
                return e

        def _apply(result):
            if token != self._features_token:
                return
            if isinstance(result, Exception):
                self._root_store.session.driver_summary = {}
                return
            self._root_store.session.driver_summary = result if isinstance(result, dict) else {}

        def _runner():
            res = _work()
            self._invoke.emit(lambda res=res: _apply(res))

        threading.Thread(target=_runner, daemon=True).start()

    @Slot()
    def reloadTelemetry(self) -> None:
        """Reload telemetry for currently selected drivers (async)."""
        if not self._root_store:
            return
        year = getattr(self._root_store.session, "season", None)
        race_name = getattr(self._root_store.session, "race_name", "") or ""
        session_code = getattr(self._root_store.session, "session", "") or ""
        if not year or not race_name or not session_code:
            return
        try:
            from app.services.bootstrap import _load_telemetry_async

            _load_telemetry_async(self._root_store, int(year), str(race_name), str(session_code))
        except Exception:
            return

    def _apply_lap_clock(self, enabled: bool) -> None:
        try:
            from app.core.playback.clock_manager import get_clock_manager

            clock = get_clock_manager()
            if enabled:
                duration = float(getattr(self._root_store.session, "telemetry_lap_duration", 0.0) or 0.0)
                if duration <= 0:
                    return
                clock.initialize(duration, 1)
            else:
                total_time = float(getattr(self._root_store.session, "duration_seconds", 0) or 5400)
                total_laps = int(getattr(self._root_store.session, "total_laps", 0) or 57)
                clock.initialize(total_time, total_laps)
            clock.stop()
            clock.seek(0.0)
        except Exception:
            return

    @Slot(bool)
    def setTelemetryLapMode(self, enabled: bool) -> None:
        if not self._root_store:
            return
        allow = bool(getattr(self._root_store.session, "telemetry_lap_mode_available", False))
        enabled = bool(enabled) and allow
        self._root_store.session.telemetry_lap_mode = enabled
        self._apply_lap_clock(enabled)

    @Slot(bool)
    def setTelemetryCompareEnabled(self, enabled: bool) -> None:
        if not self._root_store:
            return
        allow = bool(getattr(self._root_store.session, "telemetry_lap_mode_available", False))
        enabled = bool(enabled) and allow
        self._root_store.session.telemetry_compare_enabled = enabled
        if not enabled:
            self._root_store.driver.select_compare_driver("")
        elif enabled and not getattr(self._root_store.driver, "compare_driver", ""):
            # Pick the first non-primary driver as compare if available.
            primary = getattr(self._root_store.driver, "primary_driver", "") or ""
            for d in getattr(self._root_store.driver, "all_drivers", []) or []:
                code = str(d.get("code") or "")
                if code and code != primary:
                    self._root_store.driver.select_compare_driver(code)
                    break

    @Slot(str)
    def selectTelemetryPrimarySegment(self, segment: str) -> None:
        if not self._root_store:
            return
        seg = str(segment or "")
        self._root_store.session.telemetry_primary_segment = seg
        code = getattr(self._root_store.driver, "primary_driver", "") or ""
        catalog = getattr(self._root_store.session, "telemetry_lap_catalog", {}) or {}
        laps = ((catalog.get(code) or {}).get("segments") or {}).get(seg) or []
        if laps:
            lap = sorted(laps, key=lambda r: float(r.get("lapTimeSeconds") or 9e9))[0]
            self._root_store.session.telemetry_primary_lap = lap
            self._root_store.session.telemetry_lap_duration = float(lap.get("lapTimeSeconds") or 0.0)
            if getattr(self._root_store.session, "telemetry_lap_mode", False):
                self._apply_lap_clock(True)

    @Slot(str)
    def selectTelemetryCompareSegment(self, segment: str) -> None:
        if not self._root_store:
            return
        seg = str(segment or "")
        self._root_store.session.telemetry_compare_segment = seg
        code = getattr(self._root_store.driver, "compare_driver", "") or ""
        catalog = getattr(self._root_store.session, "telemetry_lap_catalog", {}) or {}
        laps = ((catalog.get(code) or {}).get("segments") or {}).get(seg) or []
        if laps:
            lap = sorted(laps, key=lambda r: float(r.get("lapTimeSeconds") or 9e9))[0]
            self._root_store.session.telemetry_compare_lap = lap

    @Slot(int)
    def selectTelemetryPrimaryLap(self, lap_number: int) -> None:
        if not self._root_store:
            return
        code = getattr(self._root_store.driver, "primary_driver", "") or ""
        seg = getattr(self._root_store.session, "telemetry_primary_segment", "") or ""
        catalog = getattr(self._root_store.session, "telemetry_lap_catalog", {}) or {}
        laps = ((catalog.get(code) or {}).get("segments") or {}).get(seg) or (catalog.get(code) or {}).get("laps") or []
        target = None
        for lap in laps:
            if int(lap.get("lapNumber") or 0) == int(lap_number):
                target = lap
                break
        if target:
            self._root_store.session.telemetry_primary_lap = target
            self._root_store.session.telemetry_primary_segment = str(target.get("segment") or seg)
            self._root_store.session.telemetry_lap_duration = float(target.get("lapTimeSeconds") or 0.0)
            if getattr(self._root_store.session, "telemetry_lap_mode", False):
                self._apply_lap_clock(True)

    @Slot(int)
    def selectTelemetryCompareLap(self, lap_number: int) -> None:
        if not self._root_store:
            return
        code = getattr(self._root_store.driver, "compare_driver", "") or ""
        seg = getattr(self._root_store.session, "telemetry_compare_segment", "") or ""
        catalog = getattr(self._root_store.session, "telemetry_lap_catalog", {}) or {}
        laps = ((catalog.get(code) or {}).get("segments") or {}).get(seg) or (catalog.get(code) or {}).get("laps") or []
        target = None
        for lap in laps:
            if int(lap.get("lapNumber") or 0) == int(lap_number):
                target = lap
                break
        if target:
            self._root_store.session.telemetry_compare_lap = target
            self._root_store.session.telemetry_compare_segment = str(target.get("segment") or seg)

    @Slot(float)
    def setTrackRotationDeg(self, degrees: float) -> None:
        if not self._root_store:
            return
        try:
            self._root_store.session.track_rotation_deg = float(degrees or 0.0)
        except Exception:
            self._root_store.session.track_rotation_deg = 0.0

    @Slot()
    def refreshCatalog(self) -> None:
        """Fetch Year → Race → Session catalog from backend (async)."""
        self._refresh_catalog(set_status=True)

    def _refresh_catalog(self, set_status: bool) -> None:
        """Internal catalog refresh with optional status updates."""
        if not self._root_store:
            return
        token = self._catalog_token = self._catalog_token + 1
        if set_status:
            self._root_store.session.backend_status = "Loading catalog…"

        def _work():
            try:
                from app.services.api.telemetryx_backend import TelemetryXBackend

                backend = TelemetryXBackend()
                try:
                    seasons = backend.seasons()
                    years = sorted(
                        {int(s.get("year")) for s in (seasons or []) if isinstance(s, dict) and s.get("year")},
                        reverse=True,
                    )
                    selected = int(getattr(self._root_store.session, "catalog_selected_year", 0) or 0)
                    if selected <= 0 and years:
                        selected = int(years[0])
                    races = backend.races_for_year(selected) if selected > 0 else []
                    return {"years": years, "selected_year": selected, "races": races}
                finally:
                    backend.close()
            except Exception as e:
                return e

        def _apply(result):
            if token != self._catalog_token:
                return
            if isinstance(result, Exception):
                self._root_store.session.backend_status = f"Catalog load failed: {result}"
                return

            self._root_store.session.catalog_years = result.get("years") or []
            self._root_store.session.catalog_selected_year = int(result.get("selected_year") or 0)
            races = [r for r in (result.get("races") or []) if isinstance(r, dict)]
            self._root_store.session.catalog_races = races

            # Keep prior selection if possible.
            selected_race = str(getattr(self._root_store.session, "catalog_selected_race", "") or "")
            if not selected_race:
                selected_race = str(getattr(self._root_store.session, "race_name", "") or "")
            if not selected_race and races:
                selected_race = str(races[0].get("name") or races[0].get("race_name") or "")

            self.selectCatalogRace(selected_race)
            if set_status:
                self._root_store.session.backend_status = "Catalog ready"

        def _runner():
            res = _work()
            self._invoke.emit(lambda res=res: _apply(res))

        threading.Thread(target=_runner, daemon=True).start()

    @Slot(int)
    def selectCatalogYear(self, year: int) -> None:
        """Set catalog year and load races for it (async)."""
        if not self._root_store:
            return
        year = int(year or 0)
        if year <= 0:
            return
        token = self._catalog_token = self._catalog_token + 1
        self._root_store.session.catalog_selected_year = year
        self._root_store.session.backend_status = f"Loading {year} races…"

        def _work():
            try:
                from app.services.api.telemetryx_backend import TelemetryXBackend

                backend = TelemetryXBackend()
                try:
                    return backend.races_for_year(year)
                finally:
                    backend.close()
            except Exception as e:
                return e

        def _apply(result):
            if token != self._catalog_token:
                return
            if isinstance(result, Exception):
                self._root_store.session.backend_status = f"Catalog load failed: {result}"
                return
            races = [r for r in (result or []) if isinstance(r, dict)]
            self._root_store.session.catalog_races = races
            selected_race = str(races[0].get("name") or races[0].get("race_name") or "") if races else ""
            self.selectCatalogRace(selected_race)
            self._root_store.session.backend_status = "Catalog ready"

        def _runner():
            res = _work()
            self._invoke.emit(lambda res=res: _apply(res))

        threading.Thread(target=_runner, daemon=True).start()

    @Slot(str)
    def selectCatalogRace(self, race_name: str) -> None:
        """Set catalog race and derive available session types from the loaded catalog."""
        if not self._root_store:
            return
        race_name = str(race_name or "")
        self._root_store.session.catalog_selected_race = race_name
        sessions = []
        for r in getattr(self._root_store.session, "catalog_races", []) or []:
            name = str(r.get("name") or r.get("race_name") or "")
            if name == race_name:
                sessions = r.get("sessions") or []
                break
        self._root_store.session.catalog_available_sessions = [str(s) for s in sessions]

    @Slot(int, str, str)
    def loadRaceSession(self, year: int, race_name: str, session_code: str) -> None:
        """Load an arbitrary Year/Race/Session into the store (async)."""
        if not self._root_store:
            return
        year = int(year or 0)
        race_name = str(race_name or "")
        session_code = str(session_code or "")
        if year <= 0 or not race_name or not session_code:
            self._root_store.session.backend_status = "Pick a season, race, and session."
            return

        token = self._load_token = self._load_token + 1
        self._root_store.session.backend_status = f"Loading {year} {race_name} {session_code}…"
        self._root_store.session.load_state = "loading"

        def _work():
            try:
                from app.services.bootstrap import fetch_session_bundle

                return fetch_session_bundle(int(year), str(race_name), str(session_code))
            except Exception as e:
                return e

        def _apply(result):
            if token != self._load_token:
                return
            if isinstance(result, Exception):
                self._root_store.session.backend_status = f"Load failed: {result}"
                self._root_store.session.load_state = "stale"
                return
            try:
                from app.services.bootstrap import apply_session_bundle, _load_telemetry_async
                from app.core.playback.clock_manager import get_clock_manager

                apply_session_bundle(self._root_store, result)
                # Keep the loaded race's session buttons in sync with the picker.
                if self._root_store.session.catalog_available_sessions:
                    self._root_store.session.available_sessions = list(
                        self._root_store.session.catalog_available_sessions
                    )

                _load_telemetry_async(self._root_store, int(year), str(race_name), str(session_code))

                clock = get_clock_manager()
                total_time = float(getattr(self._root_store.session, "duration_seconds", 0) or 5400)
                total_laps = int(getattr(self._root_store.session, "total_laps", 0) or 57)
                clock.initialize(total_time, total_laps)
                clock.stop()
                clock.seek(0.0)
                self._root_store.session.backend_status = "Backend connected"
                # After the first successful warm-up, populate the session picker catalog quietly.
                if not self._root_store.session.catalog_years:
                    try:
                        self._refresh_catalog(set_status=False)
                    except Exception:
                        pass
                try:
                    self._root_store.ui.close_modal()
                except Exception:
                    pass
            except Exception as e:
                self._root_store.session.backend_status = f"Load failed: {e}"
                self._root_store.session.load_state = "stale"

        def _runner():
            res = _work()
            self._invoke.emit(lambda res=res: _apply(res))

        threading.Thread(target=_runner, daemon=True).start()

    @Slot()
    def bootstrapFromBackend(self) -> None:
        """Start (best-effort) backend and load a default session into the store."""
        if not self._root_store:
            return
        token = self._load_token = self._load_token + 1
        self._root_store.session.backend_status = "Starting backend…"
        self._root_store.session.load_state = "loading"

        def _work():
            try:
                from app.services.backend_runner import ensure_backend_running
                from app.services.bootstrap import fetch_default_session_bundle

                if not ensure_backend_running():
                    return RuntimeError(
                        "Backend not reachable. Install backend deps (`pip install -r requirements.txt`) "
                        "or start it manually."
                    )
                payload = fetch_default_session_bundle()
                if not payload:
                    return RuntimeError("No sessions available from backend.")
                return payload
            except Exception as e:
                return e

        def _apply(result):
            if token != self._load_token:
                return
            if isinstance(result, Exception):
                self._root_store.session.backend_status = f"{result}"
                self._root_store.session.load_state = "stale"
                return
            try:
                from app.services.bootstrap import apply_session_bundle, _load_telemetry_async
                from app.core.playback.clock_manager import get_clock_manager

                self._root_store.session.available_sessions = result.get("available_sessions") or []
                bundle = result.get("bundle") or {}
                apply_session_bundle(self._root_store, bundle)
                _load_telemetry_async(
                    self._root_store,
                    int(bundle.get("year") or 0),
                    str(bundle.get("race_name") or ""),
                    str(bundle.get("session_code") or ""),
                )

                clock = get_clock_manager()
                total_time = float(getattr(self._root_store.session, "duration_seconds", 0) or 5400)
                total_laps = int(getattr(self._root_store.session, "total_laps", 0) or 57)
                clock.initialize(total_time, total_laps)
                clock.stop()
                clock.seek(0.0)
                self._root_store.session.backend_status = "Backend connected"
                # Populate the session picker catalog after the first backend warm-up.
                if not self._root_store.session.catalog_years:
                    try:
                        self._refresh_catalog(set_status=False)
                    except Exception:
                        pass
                try:
                    self._root_store.ui.close_modal()
                except Exception:
                    pass
            except Exception as e:
                self._root_store.session.backend_status = f"Backend bootstrap failed: {e}"
                self._root_store.session.load_state = "stale"

        def _runner():
            res = _work()
            self._invoke.emit(lambda res=res: _apply(res))

        threading.Thread(target=_runner, daemon=True).start()

    def cleanup(self) -> None:
        """Clean up all bridges"""
        self._session.cleanup()
        self._ui.cleanup()
        self._driver.cleanup()

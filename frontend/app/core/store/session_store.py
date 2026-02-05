"""SessionStore - Current session context management

Per Frontend_ArchitectureOverview.md Part 2, Section 2.2:
Responsibilities: Current session context
Key Observables: season, race, session, loadState
"""

from typing import Any, Dict, List, Optional
from .base import Store, Observable


class SessionStore(Store):
    """Manages current F1 session selection and state"""

    def __init__(self):
        super().__init__()

        # Session identifiers
        self._season = self._create_observable("season", None)  # type: Observable[Optional[int]]
        self._race = self._create_observable("race", None)  # type: Observable[Optional[int]]
        self._session = self._create_observable("session", None)  # type: Observable[Optional[str]]
        self._race_name = self._create_observable("raceName", "")  # type: Observable[str]
        self._race_slug = self._create_observable("raceSlug", "")  # type: Observable[str]
        self._available_sessions = self._create_observable("availableSessions", [])  # type: Observable[List[str]]

        # Catalog (Year → Race → Session) for the session picker UI.
        self._catalog_years = self._create_observable("catalogYears", [])  # type: Observable[List[int]]
        self._catalog_races = self._create_observable("catalogRaces", [])  # type: Observable[List[Dict[str, Any]]]
        self._catalog_selected_year = self._create_observable("catalogSelectedYear", 0)  # type: Observable[int]
        self._catalog_selected_race = self._create_observable("catalogSelectedRace", "")  # type: Observable[str]
        self._catalog_available_sessions = self._create_observable(
            "catalogAvailableSessions", []
        )  # type: Observable[List[str]]

        # Loading state
        self._load_state = self._create_observable("loadState", "idle")  # type: Observable[str]
        # States: idle, loading, ready, error, stale

        # Session metadata
        self._session_name = self._create_observable("sessionName", "")  # type: Observable[str]
        self._circuit_name = self._create_observable("circuitName", "")  # type: Observable[str]
        self._session_type = self._create_observable("sessionType", "")  # type: Observable[str]
        self._date = self._create_observable("date", "")  # type: Observable[str]
        self._total_laps = self._create_observable("totalLaps", 0)  # type: Observable[int]
        self._duration_s = self._create_observable("durationSeconds", 0)  # type: Observable[int]
        # View models (kept minimal; move to dedicated stores later if needed)
        self._timing_rows = self._create_observable("timingRows", [])  # type: Observable[list]
        self._tyre_stints = self._create_observable("tyreStints", [])  # type: Observable[list]
        self._undercut_prediction = self._create_observable("undercutPrediction", None)  # type: Observable[Optional[dict]]
        self._track_points = self._create_observable("trackPoints", [])  # type: Observable[list]
        self._track_sector_marks = self._create_observable("trackSectorMarks", [])  # type: Observable[list]
        self._track_drs_zones = self._create_observable("trackDrsZones", [])  # type: Observable[list]
        self._track_corners = self._create_observable("trackCorners", [])  # type: Observable[list]
        self._track_cars = self._create_observable("trackCars", [])  # type: Observable[list]
        self._telemetry_snapshot = self._create_observable("telemetrySnapshot", {})  # type: Observable[Dict[str, Any]]
        self._telemetry_window = self._create_observable("telemetryWindow", {})  # type: Observable[Dict[str, Any]]
        self._telemetry_lap_catalog = self._create_observable("telemetryLapCatalog", {})  # type: Observable[Dict[str, Any]]
        self._telemetry_segments = self._create_observable("telemetrySegments", [])  # type: Observable[List[str]]
        self._telemetry_primary_segment = self._create_observable("telemetryPrimarySegment", "")  # type: Observable[str]
        self._telemetry_compare_segment = self._create_observable("telemetryCompareSegment", "")  # type: Observable[str]
        self._telemetry_primary_lap = self._create_observable("telemetryPrimaryLap", None)  # type: Observable[Optional[Dict[str, Any]]]
        self._telemetry_compare_lap = self._create_observable("telemetryCompareLap", None)  # type: Observable[Optional[Dict[str, Any]]]
        self._telemetry_compare_enabled = self._create_observable("telemetryCompareEnabled", False)  # type: Observable[bool]
        self._telemetry_lap_mode_available = self._create_observable("telemetryLapModeAvailable", False)  # type: Observable[bool]
        self._telemetry_lap_mode = self._create_observable("telemetryLapMode", False)  # type: Observable[bool]
        self._telemetry_lap_duration = self._create_observable("telemetryLapDuration", 0.0)  # type: Observable[float]
        self._telemetry_track_cars = self._create_observable("telemetryTrackCars", [])  # type: Observable[list]
        self._telemetry_dominance_zones = self._create_observable("telemetryDominanceZones", [])  # type: Observable[list]
        self._telemetry_delta = self._create_observable("telemetryDelta", 0.0)  # type: Observable[float]
        self._telemetry_delta_distance = self._create_observable("telemetryDeltaDistance", 0.0)  # type: Observable[float]
        self._track_rotation_deg = self._create_observable("trackRotationDeg", 0.0)  # type: Observable[float]
        self._track_auto_rotate = self._create_observable("trackAutoRotate", True)  # type: Observable[bool]
        self._weather_snapshot = self._create_observable("weatherSnapshot", {})  # type: Observable[Dict[str, Any]]
        self._race_control = self._create_observable("raceControl", [])  # type: Observable[list]
        self._race_control_live = self._create_observable("raceControlLive", [])  # type: Observable[list]
        self._driver_lap_history = self._create_observable("driverLapHistory", {})  # type: Observable[Dict[str, Any]]
        self._driver_summary = self._create_observable("driverSummary", {})  # type: Observable[Dict[str, Any]]
        self._features_live = self._create_observable("featuresLive", {})  # type: Observable[Dict[str, Any]]
        self._features_summary = self._create_observable("featuresSummary", {})  # type: Observable[Dict[str, Any]]
        self._features_data = self._create_observable("featuresData", [])  # type: Observable[List[Dict[str, Any]]]
        self._features_active_type = self._create_observable("featuresActiveType", "")  # type: Observable[str]
        self._backend_status = self._create_observable("backendStatus", "")  # type: Observable[str]

        # Non-reactive caches used by playback sync.
        self._positions_by_driver_number: Dict[int, List[Dict[str, Any]]] = {}
        self._telemetry_by_driver_number: Dict[int, List[Dict[str, Any]]] = {}
        self._positions_index: Dict[int, tuple[List[float], List[Dict[str, Any]]]] = {}
        self._telemetry_index: Dict[int, tuple[List[float], List[Dict[str, Any]]]] = {}
        self._positions_time_bounds: Optional[tuple[float, float]] = None
        self._telemetry_time_bounds: Optional[tuple[float, float]] = None
        self._weather_index: Optional[tuple[List[float], List[Dict[str, Any]]]] = None
        self._weather_time_bounds: Optional[tuple[float, float]] = None

    # Properties
    @property
    def season(self) -> Optional[int]:
        return self._season.value

    @season.setter
    def season(self, value: Optional[int]) -> None:
        self._season.value = value

    @property
    def race(self) -> Optional[int]:
        return self._race.value

    @race.setter
    def race(self, value: Optional[int]) -> None:
        self._race.value = value

    @property
    def session(self) -> Optional[str]:
        return self._session.value

    @session.setter
    def session(self, value: Optional[str]) -> None:
        self._session.value = value

    @property
    def race_name(self) -> str:
        return self._race_name.value

    @race_name.setter
    def race_name(self, value: str) -> None:
        self._race_name.value = value or ""

    @property
    def race_slug(self) -> str:
        return self._race_slug.value

    @race_slug.setter
    def race_slug(self, value: str) -> None:
        self._race_slug.value = value or ""

    @property
    def available_sessions(self) -> List[str]:
        return self._available_sessions.value

    @available_sessions.setter
    def available_sessions(self, value: List[str]) -> None:
        self._available_sessions.value = value or []

    @property
    def catalog_years(self) -> List[int]:
        return self._catalog_years.value

    @catalog_years.setter
    def catalog_years(self, value: List[int]) -> None:
        self._catalog_years.value = [int(v) for v in (value or []) if int(v) > 0]

    @property
    def catalog_races(self) -> List[Dict[str, Any]]:
        return self._catalog_races.value

    @catalog_races.setter
    def catalog_races(self, value: List[Dict[str, Any]]) -> None:
        self._catalog_races.value = value or []

    @property
    def catalog_selected_year(self) -> int:
        return int(self._catalog_selected_year.value or 0)

    @catalog_selected_year.setter
    def catalog_selected_year(self, value: int) -> None:
        self._catalog_selected_year.value = int(value or 0)

    @property
    def catalog_selected_race(self) -> str:
        return str(self._catalog_selected_race.value or "")

    @catalog_selected_race.setter
    def catalog_selected_race(self, value: str) -> None:
        self._catalog_selected_race.value = str(value or "")

    @property
    def catalog_available_sessions(self) -> List[str]:
        return self._catalog_available_sessions.value

    @catalog_available_sessions.setter
    def catalog_available_sessions(self, value: List[str]) -> None:
        self._catalog_available_sessions.value = [str(v) for v in (value or [])]

    @property
    def load_state(self) -> str:
        return self._load_state.value

    @load_state.setter
    def load_state(self, value: str) -> None:
        self._load_state.value = value

    # Session metadata properties
    @property
    def session_name(self) -> str:
        return self._session_name.value

    @session_name.setter
    def session_name(self, value: str) -> None:
        self._session_name.value = value

    @property
    def circuit_name(self) -> str:
        return self._circuit_name.value

    @circuit_name.setter
    def circuit_name(self, value: str) -> None:
        self._circuit_name.value = value

    @property
    def session_type(self) -> str:
        return self._session_type.value

    @session_type.setter
    def session_type(self, value: str) -> None:
        self._session_type.value = value

    @property
    def date(self) -> str:
        return self._date.value

    @date.setter
    def date(self, value: str) -> None:
        self._date.value = value

    @property
    def total_laps(self) -> int:
        return self._total_laps.value

    @total_laps.setter
    def total_laps(self, value: int) -> None:
        self._total_laps.value = value

    @property
    def duration_seconds(self) -> int:
        return self._duration_s.value

    @duration_seconds.setter
    def duration_seconds(self, value: int) -> None:
        self._duration_s.value = int(value or 0)

    @property
    def timing_rows(self) -> list:
        return self._timing_rows.value

    @timing_rows.setter
    def timing_rows(self, value: list) -> None:
        self._timing_rows.value = value

    @property
    def tyre_stints(self) -> list:
        return self._tyre_stints.value

    @tyre_stints.setter
    def tyre_stints(self, value: list) -> None:
        self._tyre_stints.value = value

    @property
    def undercut_prediction(self) -> Optional[dict]:
        return self._undercut_prediction.value

    @undercut_prediction.setter
    def undercut_prediction(self, value: Optional[dict]) -> None:
        self._undercut_prediction.value = value

    @property
    def track_points(self) -> list:
        return self._track_points.value

    @track_points.setter
    def track_points(self, value: list) -> None:
        self._track_points.value = value or []

    @property
    def track_sector_marks(self) -> list:
        return self._track_sector_marks.value

    @track_sector_marks.setter
    def track_sector_marks(self, value: list) -> None:
        self._track_sector_marks.value = value or []

    @property
    def track_drs_zones(self) -> list:
        return self._track_drs_zones.value

    @track_drs_zones.setter
    def track_drs_zones(self, value: list) -> None:
        self._track_drs_zones.value = value or []

    @property
    def track_corners(self) -> list:
        return self._track_corners.value

    @track_corners.setter
    def track_corners(self, value: list) -> None:
        self._track_corners.value = value or []

    @property
    def track_cars(self) -> list:
        return self._track_cars.value

    @track_cars.setter
    def track_cars(self, value: list) -> None:
        self._track_cars.value = value or []

    @property
    def telemetry_snapshot(self) -> Dict[str, Any]:
        return self._telemetry_snapshot.value

    @telemetry_snapshot.setter
    def telemetry_snapshot(self, value: Dict[str, Any]) -> None:
        self._telemetry_snapshot.value = value or {}

    @property
    def telemetry_window(self) -> Dict[str, Any]:
        return self._telemetry_window.value

    @telemetry_window.setter
    def telemetry_window(self, value: Dict[str, Any]) -> None:
        self._telemetry_window.value = value or {}

    @property
    def telemetry_lap_catalog(self) -> Dict[str, Any]:
        return self._telemetry_lap_catalog.value

    @telemetry_lap_catalog.setter
    def telemetry_lap_catalog(self, value: Dict[str, Any]) -> None:
        self._telemetry_lap_catalog.value = value or {}

    @property
    def telemetry_segments(self) -> List[str]:
        return self._telemetry_segments.value

    @telemetry_segments.setter
    def telemetry_segments(self, value: List[str]) -> None:
        self._telemetry_segments.value = [str(v) for v in (value or [])]

    @property
    def telemetry_primary_segment(self) -> str:
        return str(self._telemetry_primary_segment.value or "")

    @telemetry_primary_segment.setter
    def telemetry_primary_segment(self, value: str) -> None:
        self._telemetry_primary_segment.value = str(value or "")

    @property
    def telemetry_compare_segment(self) -> str:
        return str(self._telemetry_compare_segment.value or "")

    @telemetry_compare_segment.setter
    def telemetry_compare_segment(self, value: str) -> None:
        self._telemetry_compare_segment.value = str(value or "")

    @property
    def telemetry_primary_lap(self) -> Optional[Dict[str, Any]]:
        return self._telemetry_primary_lap.value

    @telemetry_primary_lap.setter
    def telemetry_primary_lap(self, value: Optional[Dict[str, Any]]) -> None:
        self._telemetry_primary_lap.value = value

    @property
    def telemetry_compare_lap(self) -> Optional[Dict[str, Any]]:
        return self._telemetry_compare_lap.value

    @telemetry_compare_lap.setter
    def telemetry_compare_lap(self, value: Optional[Dict[str, Any]]) -> None:
        self._telemetry_compare_lap.value = value

    @property
    def telemetry_compare_enabled(self) -> bool:
        return bool(self._telemetry_compare_enabled.value)

    @telemetry_compare_enabled.setter
    def telemetry_compare_enabled(self, value: bool) -> None:
        self._telemetry_compare_enabled.value = bool(value)

    @property
    def telemetry_lap_mode_available(self) -> bool:
        return bool(self._telemetry_lap_mode_available.value)

    @telemetry_lap_mode_available.setter
    def telemetry_lap_mode_available(self, value: bool) -> None:
        self._telemetry_lap_mode_available.value = bool(value)

    @property
    def telemetry_lap_mode(self) -> bool:
        return bool(self._telemetry_lap_mode.value)

    @telemetry_lap_mode.setter
    def telemetry_lap_mode(self, value: bool) -> None:
        self._telemetry_lap_mode.value = bool(value)

    @property
    def telemetry_lap_duration(self) -> float:
        try:
            return float(self._telemetry_lap_duration.value or 0.0)
        except Exception:
            return 0.0

    @telemetry_lap_duration.setter
    def telemetry_lap_duration(self, value: float) -> None:
        try:
            self._telemetry_lap_duration.value = float(value or 0.0)
        except Exception:
            self._telemetry_lap_duration.value = 0.0

    @property
    def telemetry_track_cars(self) -> List[Dict[str, Any]]:
        return self._telemetry_track_cars.value

    @telemetry_track_cars.setter
    def telemetry_track_cars(self, value: List[Dict[str, Any]]) -> None:
        self._telemetry_track_cars.value = value or []

    @property
    def telemetry_dominance_zones(self) -> List[Dict[str, Any]]:
        return self._telemetry_dominance_zones.value

    @telemetry_dominance_zones.setter
    def telemetry_dominance_zones(self, value: List[Dict[str, Any]]) -> None:
        self._telemetry_dominance_zones.value = value or []

    @property
    def telemetry_delta(self) -> float:
        try:
            return float(self._telemetry_delta.value or 0.0)
        except Exception:
            return 0.0

    @telemetry_delta.setter
    def telemetry_delta(self, value: float) -> None:
        try:
            self._telemetry_delta.value = float(value or 0.0)
        except Exception:
            self._telemetry_delta.value = 0.0

    @property
    def telemetry_delta_distance(self) -> float:
        try:
            return float(self._telemetry_delta_distance.value or 0.0)
        except Exception:
            return 0.0

    @telemetry_delta_distance.setter
    def telemetry_delta_distance(self, value: float) -> None:
        try:
            self._telemetry_delta_distance.value = float(value or 0.0)
        except Exception:
            self._telemetry_delta_distance.value = 0.0

    @property
    def track_rotation_deg(self) -> float:
        try:
            return float(self._track_rotation_deg.value or 0.0)
        except Exception:
            return 0.0

    @track_rotation_deg.setter
    def track_rotation_deg(self, value: float) -> None:
        try:
            self._track_rotation_deg.value = float(value or 0.0)
        except Exception:
            self._track_rotation_deg.value = 0.0

    @property
    def track_auto_rotate(self) -> bool:
        try:
            return bool(self._track_auto_rotate.value)
        except Exception:
            return True

    @track_auto_rotate.setter
    def track_auto_rotate(self, value: bool) -> None:
        self._track_auto_rotate.value = bool(value)

    @property
    def weather_snapshot(self) -> Dict[str, Any]:
        return self._weather_snapshot.value

    @weather_snapshot.setter
    def weather_snapshot(self, value: Dict[str, Any]) -> None:
        self._weather_snapshot.value = value or {}

    @property
    def race_control(self) -> list:
        return self._race_control.value

    @race_control.setter
    def race_control(self, value: list) -> None:
        self._race_control.value = value or []

    @property
    def race_control_live(self) -> list:
        return self._race_control_live.value

    @race_control_live.setter
    def race_control_live(self, value: list) -> None:
        self._race_control_live.value = value or []

    @property
    def driver_lap_history(self) -> Dict[str, Any]:
        return self._driver_lap_history.value

    @driver_lap_history.setter
    def driver_lap_history(self, value: Dict[str, Any]) -> None:
        self._driver_lap_history.value = value or {}

    @property
    def driver_summary(self) -> Dict[str, Any]:
        return self._driver_summary.value

    @driver_summary.setter
    def driver_summary(self, value: Dict[str, Any]) -> None:
        self._driver_summary.value = value or {}

    @property
    def features_summary(self) -> Dict[str, Any]:
        return self._features_summary.value

    @features_summary.setter
    def features_summary(self, value: Dict[str, Any]) -> None:
        self._features_summary.value = value or {}

    @property
    def features_data(self) -> List[Dict[str, Any]]:
        return self._features_data.value

    @features_data.setter
    def features_data(self, value: List[Dict[str, Any]]) -> None:
        self._features_data.value = value or []

    @property
    def features_active_type(self) -> str:
        return str(self._features_active_type.value or "")

    @features_active_type.setter
    def features_active_type(self, value: str) -> None:
        self._features_active_type.value = str(value or "")

    @property
    def features_live(self) -> Dict[str, Any]:
        return self._features_live.value

    @features_live.setter
    def features_live(self, value: Dict[str, Any]) -> None:
        self._features_live.value = value or {}

    @property
    def backend_status(self) -> str:
        return self._backend_status.value

    @backend_status.setter
    def backend_status(self, value: str) -> None:
        self._backend_status.value = value or ""

    # Methods
    def select_session(self, season: int, race: int, session: str) -> None:
        """Select a new session"""
        self.load_state = "loading"
        self.season = season
        self.race = race
        self.session = session
        # TODO: Fetch session metadata from API

    def clear_session(self) -> None:
        """Clear current session"""
        self.season = None
        self.race = None
        self.session = None
        self.session_name = ""
        self.circuit_name = ""
        self.session_type = ""
        self.date = ""
        self.total_laps = 0
        self.duration_seconds = 0
        self.available_sessions = []
        self.race_name = ""
        self.race_slug = ""
        self.timing_rows = []
        self.tyre_stints = []
        self.undercut_prediction = None
        self.track_points = []
        self.track_sector_marks = []
        self.track_drs_zones = []
        self.track_corners = []
        self.track_cars = []
        self.track_rotation_deg = 0.0
        self.track_auto_rotate = True
        self.telemetry_snapshot = {}
        self.telemetry_window = {}
        self.weather_snapshot = {}
        self.race_control = []
        self.race_control_live = []
        self.driver_lap_history = {}
        self.driver_summary = {}
        self.features_live = {}
        self.features_summary = {}
        self.features_data = []
        self.features_active_type = ""
        self.backend_status = ""
        self.load_state = "idle"

        self._positions_by_driver_number = {}
        self._telemetry_by_driver_number = {}
        self._positions_index = {}
        self._telemetry_index = {}
        self._positions_time_bounds = None
        self._telemetry_time_bounds = None
        self._weather_index = None
        self._weather_time_bounds = None

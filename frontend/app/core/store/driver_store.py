"""DriverStore - Driver selection and filtering management

Per Frontend_ArchitectureOverview.md Part 2, Section 2.2:
Responsibilities: Driver selection/filtering
Key Observables: primaryDriver, compareDriver, filters, pinnedDrivers
"""

from typing import Optional, List, Dict, Any
from .base import Store, Observable


class DriverStore(Store):
    """Manages driver selection and filtering"""

    def __init__(self):
        super().__init__()

        # Selected drivers
        self._primary_driver = self._create_observable("primaryDriver", None)  # type: Observable[Optional[str]]
        self._compare_driver = self._create_observable("compareDriver", None)  # type: Observable[Optional[str]]

        # Driver list
        self._all_drivers = self._create_observable("allDrivers", [])  # type: Observable[List[Dict[str, Any]]]
        # Format: [{"number": "1", "code": "VER", "name": "Max Verstappen", "team": "Red Bull"}, ...]

        # Filters
        self._filters = self._create_observable(
            "filters", {"team": None, "position": None, "search": ""}
        )  # type: Observable[Dict[str, Any]]

        # Pinned drivers
        self._pinned_drivers = self._create_observable("pinnedDrivers", [])  # type: Observable[List[str]]

    # Properties
    @property
    def primary_driver(self) -> Optional[str]:
        return self._primary_driver.value

    @primary_driver.setter
    def primary_driver(self, value: Optional[str]) -> None:
        self._primary_driver.value = value

    @property
    def compare_driver(self) -> Optional[str]:
        return self._compare_driver.value

    @compare_driver.setter
    def compare_driver(self, value: Optional[str]) -> None:
        self._compare_driver.value = value

    @property
    def all_drivers(self) -> List[Dict[str, Any]]:
        return self._all_drivers.value

    @all_drivers.setter
    def all_drivers(self, value: List[Dict[str, Any]]) -> None:
        self._all_drivers.value = value

    @property
    def filters(self) -> Dict[str, Any]:
        return self._filters.value

    @filters.setter
    def filters(self, value: Dict[str, Any]) -> None:
        self._filters.value = value

    @property
    def pinned_drivers(self) -> List[str]:
        return self._pinned_drivers.value

    @pinned_drivers.setter
    def pinned_drivers(self, value: List[str]) -> None:
        self._pinned_drivers.value = value

    # Computed properties
    @property
    def filtered_drivers(self) -> List[Dict[str, Any]]:
        """Get drivers filtered by current filters"""
        drivers = self.all_drivers
        filters = self.filters

        if filters.get("team"):
            drivers = [d for d in drivers if d.get("team") == filters["team"]]

        if filters.get("search"):
            search = filters["search"].lower()
            drivers = [
                d
                for d in drivers
                if search in d.get("name", "").lower() or search in d.get("code", "").lower()
            ]

        return drivers

    @property
    def selected_drivers(self) -> List[str]:
        """Get list of selected driver codes"""
        selected = []
        if self.primary_driver:
            selected.append(self.primary_driver)
        if self.compare_driver:
            selected.append(self.compare_driver)
        return selected

    # Methods
    def select_primary_driver(self, driver_code: str) -> None:
        """Select primary driver"""
        if driver_code != self.compare_driver:
            self.primary_driver = driver_code

    def select_compare_driver(self, driver_code: Optional[str]) -> None:
        """Select compare driver (None to clear)"""
        if driver_code != self.primary_driver:
            self.compare_driver = driver_code

    def toggle_compare_driver(self, driver_code: str) -> None:
        """Toggle compare driver selection"""
        if self.compare_driver == driver_code:
            self.compare_driver = None
        elif driver_code != self.primary_driver:
            self.compare_driver = driver_code

    def set_team_filter(self, team: Optional[str]) -> None:
        """Set team filter"""
        current = self.filters.copy()
        current["team"] = team
        self.filters = current

    def set_search_filter(self, search: str) -> None:
        """Set search filter"""
        current = self.filters.copy()
        current["search"] = search
        self.filters = current

    def clear_filters(self) -> None:
        """Clear all filters"""
        self.filters = {"team": None, "position": None, "search": ""}

    def pin_driver(self, driver_code: str) -> None:
        """Pin a driver to the top of the list"""
        pinned = self.pinned_drivers.copy()
        if driver_code not in pinned:
            pinned.append(driver_code)
            self.pinned_drivers = pinned

    def unpin_driver(self, driver_code: str) -> None:
        """Unpin a driver"""
        pinned = self.pinned_drivers.copy()
        if driver_code in pinned:
            pinned.remove(driver_code)
            self.pinned_drivers = pinned

    def toggle_pin(self, driver_code: str) -> None:
        """Toggle driver pin status"""
        if driver_code in self.pinned_drivers:
            self.unpin_driver(driver_code)
        else:
            self.pin_driver(driver_code)

    def get_driver_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Get driver info by code"""
        for driver in self.all_drivers:
            if driver.get("code") == code:
                return driver
        return None

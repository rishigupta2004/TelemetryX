"""Base reactive store infrastructure

Implements the reactive state management pattern from Frontend_ArchitectureOverview.md Part 2, Section 2.1
"""

from __future__ import annotations

import weakref
from typing import Any, Callable, Generic, TypeVar, Optional, List, Dict, Set
from dataclasses import dataclass, field
from functools import wraps

T = TypeVar("T")


class Observable(Generic[T]):
    """Observable value that notifies subscribers on change"""

    def __init__(self, initial_value: T):
        self._value = initial_value
        self._subscribers: Set[Callable[[T, T], None]] = set()
        self._is_computing = False

    @property
    def value(self) -> T:
        """Get current value - tracks dependencies when called within computed"""
        if Observable._current_computed is not None:
            Observable._current_computed._add_dependency(self)
        return self._value

    @value.setter
    def value(self, new_value: T) -> None:
        """Set new value and notify subscribers"""
        if self._value != new_value:
            old_value = self._value
            self._value = new_value
            self._notify(old_value, new_value)

    def _notify(self, old_value: T, new_value: T) -> None:
        """Notify all subscribers of value change"""
        for subscriber in list(self._subscribers):
            subscriber(old_value, new_value)

    def subscribe(self, callback: Callable[[T, T], None]) -> Callable[[], None]:
        """Subscribe to changes, returns unsubscribe function"""
        self._subscribers.add(callback)
        return lambda: self._subscribers.discard(callback)

    # Context for tracking computed dependencies
    _current_computed: Optional[Computed] = None


class Computed(Generic[T]):
    """Computed value that auto-updates when dependencies change"""

    def __init__(self, compute_fn: Callable[[], T]):
        self._compute_fn = compute_fn
        self._value: Optional[T] = None
        self._is_dirty = True
        self._dependencies: Set[Observable] = set()
        self._subscribers: Set[Callable[[T, T], None]] = set()
        self._unsubscribers: List[Callable[[], None]] = []

    @property
    def value(self) -> T:
        """Get computed value, recalculate if dirty"""
        if self._is_dirty:
            self._recompute()
        return self._value  # type: ignore

    def _recompute(self) -> None:
        """Recompute value and update dependencies"""
        # Clear old dependencies
        for unsub in self._unsubscribers:
            unsub()
        self._unsubscribers.clear()
        self._dependencies.clear()

        # Track dependencies during computation
        old_value = self._value
        Observable._current_computed = self
        try:
            self._value = self._compute_fn()
        finally:
            Observable._current_computed = None

        # Subscribe to all dependencies
        for dep in self._dependencies:
            unsub = dep.subscribe(lambda old, new, dep=dep: self._on_dependency_change())
            self._unsubscribers.append(unsub)

        self._is_dirty = False

        # Notify if value changed
        if old_value != self._value:
            for subscriber in list(self._subscribers):
                subscriber(old_value, self._value)

    def _add_dependency(self, observable: Observable) -> None:
        """Track an observable as a dependency"""
        self._dependencies.add(observable)

    def _on_dependency_change(self) -> None:
        """Mark computed as dirty when dependency changes.

        If there are subscribers, recompute eagerly so the UI/tests observe updates
        without needing to read `.value` manually.
        """
        self._is_dirty = True
        if self._subscribers:
            self._recompute()

    def subscribe(self, callback: Callable[[T, T], None]) -> Callable[[], None]:
        """Subscribe to changes"""
        # Ensure dependencies are tracked so future changes can trigger updates.
        if self._is_dirty:
            self._recompute()
        self._subscribers.add(callback)
        return lambda: self._subscribers.discard(callback)


class Effect:
    """Side effect that runs when dependencies change"""

    def __init__(self, effect_fn: Callable[[], None]):
        self._effect_fn = effect_fn
        self._dependencies: Set[Observable] = set()
        self._unsubscribers: List[Callable[[], None]] = []
        self._is_active = True

        # Run immediately on creation
        self._run()

    def _run(self) -> None:
        """Run effect and track dependencies"""
        if not self._is_active:
            return

        # Clear old dependencies
        for unsub in self._unsubscribers:
            unsub()
        self._unsubscribers.clear()
        self._dependencies.clear()

        # Track dependencies during execution
        Observable._current_computed = self  # Hack: reuse computed tracking
        try:
            self._effect_fn()
        finally:
            Observable._current_computed = None

        # Subscribe to all dependencies
        for dep in self._dependencies:
            unsub = dep.subscribe(lambda old, new, dep=dep: self._run())
            self._unsubscribers.append(unsub)

    def _add_dependency(self, observable: Observable) -> None:
        """Track an observable as a dependency"""
        self._dependencies.add(observable)

    def dispose(self) -> None:
        """Stop effect and clean up subscriptions"""
        self._is_active = False
        for unsub in self._unsubscribers:
            unsub()
        self._unsubscribers.clear()


# Make Effect work with Observable._current_computed tracking
Effect._add_dependency = lambda self, obs: self._dependencies.add(obs)


def computed(compute_fn: Callable[[], T]) -> Computed[T]:
    """Decorator to create a computed value"""
    return Computed(compute_fn)


def effect(effect_fn: Callable[[], None]) -> Effect:
    """Decorator to create an effect"""
    return Effect(effect_fn)


class Store:
    """Base store class with reactive state management"""

    def __init__(self):
        self._observables: Dict[str, Observable] = {}
        self._middleware: List[Callable[[str, Any, Any], None]] = []

    def _create_observable(self, name: str, initial_value: Any) -> Observable:
        """Create a named observable"""
        obs = Observable(initial_value)
        self._observables[name] = obs
        return obs

    def _get_observable(self, name: str) -> Optional[Observable]:
        """Get an observable by name"""
        return self._observables.get(name)

    def subscribe(self, name: str, callback: Callable[[Any, Any], None]) -> Callable[[], None]:
        """Subscribe to a specific observable"""
        obs = self._get_observable(name)
        if obs:
            return obs.subscribe(callback)
        return lambda: None

    def add_middleware(self, middleware: Callable[[str, Any, Any], None]) -> None:
        """Add middleware to track state changes"""
        self._middleware.append(middleware)

        # Apply middleware to existing observables
        for name, obs in self._observables.items():
            original_notify = obs._notify

            def create_wrapped_notify(obs_name, orig_notify):
                def wrapped(old, new):
                    for mw in self._middleware:
                        try:
                            mw(obs_name, old, new)
                        except Exception:
                            pass
                    orig_notify(old, new)

                return wrapped

            obs._notify = create_wrapped_notify(name, original_notify)

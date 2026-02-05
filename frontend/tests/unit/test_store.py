"""Unit tests for reactive store"""

import pytest
from app.core.store import Observable, Computed, Effect, Store


class TestObservable:
    """Test Observable class"""

    def test_initial_value(self):
        obs = Observable(42)
        assert obs.value == 42

    def test_value_change(self):
        obs = Observable(0)
        obs.value = 10
        assert obs.value == 10

    def test_subscription(self):
        obs = Observable(0)
        changes = []

        def on_change(old, new):
            changes.append((old, new))

        unsub = obs.subscribe(on_change)
        obs.value = 5
        obs.value = 10

        assert len(changes) == 2
        assert changes[0] == (0, 5)
        assert changes[1] == (5, 10)

        # Unsubscribe
        unsub()
        obs.value = 15
        assert len(changes) == 2  # No new change


class TestComputed:
    """Test Computed class"""

    def test_computed_value(self):
        obs = Observable(5)
        comp = Computed(lambda: obs.value * 2)

        assert comp.value == 10

    def test_computed_reactivity(self):
        obs = Observable(5)
        comp = Computed(lambda: obs.value * 2)

        assert comp.value == 10

        obs.value = 7
        assert comp.value == 14

    def test_computed_subscription(self):
        obs = Observable(5)
        comp = Computed(lambda: obs.value * 2)

        changes = []
        comp.subscribe(lambda old, new: changes.append((old, new)))

        obs.value = 7
        assert len(changes) == 1
        assert changes[0] == (10, 14)


class TestEffect:
    """Test Effect class"""

    def test_effect_runs_on_creation(self):
        runs = []
        obs = Observable(5)

        effect = Effect(lambda: runs.append(obs.value))

        assert len(runs) == 1
        assert runs[0] == 5

        effect.dispose()

    def test_effect_runs_on_dependency_change(self):
        runs = []
        obs = Observable(5)

        effect = Effect(lambda: runs.append(obs.value))

        obs.value = 10
        assert len(runs) == 2
        assert runs[1] == 10

        effect.dispose()


class TestStore:
    """Test Store base class"""

    def test_create_observable(self):
        store = Store()
        store._create_observable("test", 42)

        obs = store._get_observable("test")
        assert obs is not None
        assert obs.value == 42

    def test_middleware(self):
        store = Store()
        store._create_observable("test", 0)

        changes = []

        def log_middleware(name, old, new):
            changes.append((name, old, new))

        store.add_middleware(log_middleware)

        obs = store._get_observable("test")
        if obs is not None:
            obs.value = 5

        assert len(changes) == 1
        assert changes[0] == ("test", 0, 5)

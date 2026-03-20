from api.utils import normalize_track_geometry_start_position


def test_normalize_track_geometry_start_position_prefers_start_finish_index():
    payload = {
        "centerline": [[10.0, 20.0], [11.0, 21.0], [12.0, 22.0]],
        "start_finish": {"index": 2},
        "startPositionIndex": 0,
        "startPosition": [99.0, 99.0],
    }

    out = normalize_track_geometry_start_position(payload)

    assert out["startPositionIndex"] == 2
    assert out["start_finish"]["index"] == 2
    assert out["startPosition"] == [12.0, 22.0]


def test_normalize_track_geometry_start_position_falls_back_to_start_position_index():
    payload = {
        "centerline": [[100.0, -10.0], [101.0, -11.0], [102.0, -12.0]],
        "startPositionIndex": 1,
    }

    out = normalize_track_geometry_start_position(payload)

    assert out["startPositionIndex"] == 1
    assert out["start_finish"]["index"] == 1
    assert out["startPosition"] == [101.0, -11.0]


def test_normalize_track_geometry_start_position_clamps_out_of_range_index():
    payload = {
        "centerline": [[1.0, 1.0], [2.0, 2.0]],
        "start_finish": {"index": 99},
    }

    out = normalize_track_geometry_start_position(payload)

    assert out["startPositionIndex"] == 1
    assert out["start_finish"]["index"] == 1
    assert out["startPosition"] == [2.0, 2.0]

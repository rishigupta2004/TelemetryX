"""
Centerline Engine
=================
Takes a GeoJSON LineString centerline and computes:
- Cumulative arc-length at every point
- Interpolated GPS coordinate for any distance along the track
- Index of the centerline point closest to any given distance
- Full mapping of FIA text references ("50m before T1") → GPS coords
"""

import json
import math
import numpy as np
from typing import Optional


# ─────────────────────────────────────────────────────────────
# Haversine / geodetic helpers
# ─────────────────────────────────────────────────────────────

EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Distance in metres between two (lon, lat) points."""
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def interpolate_along_geodesic(
    lon1: float, lat1: float,
    lon2: float, lat2: float,
    fraction: float          # 0.0 = start, 1.0 = end
) -> tuple[float, float]:
    """Linear interpolation in (lon, lat) space – accurate for short segments (<10 km)."""
    return (
        lon1 + fraction * (lon2 - lon1),
        lat1 + fraction * (lat2 - lat1),
    )


# ─────────────────────────────────────────────────────────────
# Core class
# ─────────────────────────────────────────────────────────────

class Centerline:
    """
    Wraps a GeoJSON LineString of (lon, lat) pairs and provides
    distance-based queries.
    """

    def __init__(self, coordinates: list[list[float]], lap_distance_km: float = None):
        """
        Parameters
        ----------
        coordinates   : list of [lon, lat] from the GeoJSON
        lap_distance_km : known lap distance (used for validation only)
        """
        self.coords = coordinates          # [[lon, lat], ...]
        self.n = len(coordinates)

        # Compute segment lengths and cumulative distances
        self.seg_lengths_m: list[float] = []   # length of each segment i→i+1
        self.cumulative_m: list[float] = [0.0] # cumulative distance at each point

        for i in range(self.n - 1):
            lon1, lat1 = coordinates[i]
            lon2, lat2 = coordinates[i + 1]
            d = haversine_m(lon1, lat1, lon2, lat2)
            self.seg_lengths_m.append(d)
            self.cumulative_m.append(self.cumulative_m[-1] + d)

        self.total_length_m = self.cumulative_m[-1]
        self.total_length_km = self.total_length_m / 1000.0

        if lap_distance_km:
            error_pct = abs(self.total_length_km - lap_distance_km) / lap_distance_km * 100
            if error_pct > 2.0:
                print(f"  ⚠️  Centerline length {self.total_length_km:.3f} km "
                      f"vs FIA stated {lap_distance_km:.3f} km "
                      f"({error_pct:.1f}% error)")
            else:
                print(f"  ✓  Centerline length {self.total_length_km:.3f} km "
                      f"(FIA: {lap_distance_km:.3f} km, error {error_pct:.2f}%)")

    # ── Query methods ─────────────────────────────────────────

    def distance_at_index(self, idx: int) -> float:
        """Cumulative distance in metres at centerline point idx."""
        return self.cumulative_m[idx]

    def index_at_distance(self, distance_m: float) -> int:
        """Index of the closest centerline point to a given cumulative distance."""
        distance_m = distance_m % self.total_length_m   # handle wrap-around
        # Binary search
        lo, hi = 0, self.n - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if self.cumulative_m[mid] < distance_m:
                lo = mid + 1
            else:
                hi = mid
        # Pick closest of lo-1 and lo
        if lo > 0:
            d_prev = abs(self.cumulative_m[lo - 1] - distance_m)
            d_curr = abs(self.cumulative_m[lo] - distance_m)
            return lo - 1 if d_prev < d_curr else lo
        return lo

    def gps_at_distance(self, distance_m: float) -> tuple[float, float]:
        """
        Interpolated (lon, lat) at exactly distance_m along the track.
        Returns (lon, lat).
        """
        distance_m = distance_m % self.total_length_m
        # Find the segment
        for i in range(self.n - 1):
            if self.cumulative_m[i] <= distance_m <= self.cumulative_m[i + 1]:
                seg_len = self.seg_lengths_m[i]
                if seg_len < 1e-9:
                    return tuple(self.coords[i])
                fraction = (distance_m - self.cumulative_m[i]) / seg_len
                lon, lat = interpolate_along_geodesic(
                    *self.coords[i], *self.coords[i + 1], fraction
                )
                return round(lon, 7), round(lat, 7)
        # Fallback: last point
        return tuple(self.coords[-1])

    def gps_at_index(self, idx: int) -> tuple[float, float]:
        return tuple(self.coords[idx])

    # ── FIA distance reference resolver ───────────────────────

    def resolve_fia_reference(
        self,
        reference: str,
        corner_distances_m: dict[int, float]   # {turn_number: distance_m_along_track}
    ) -> dict:
        """
        Parse an FIA text reference like:
          "50m before T1"
          "23m after T3"
          "158m before T1"
          "At T5"
          "110m before T14"
        and return {distance_m, index, lon, lat, reference}.

        Parameters
        ----------
        reference : the FIA text string
        corner_distances_m : mapping of turn number → cumulative distance (m)
        """
        ref = reference.strip()

        # Pattern: "At T<N>"
        m_at = re.search(r'At\s+T(\d+)', ref, re.IGNORECASE)
        if m_at:
            turn = int(m_at.group(1))
            dist = corner_distances_m[turn]
            return self._build_ref_result(dist, ref)

        # Pattern: "<N>m before T<M>" or "<N>m after T<M>"
        m_dist = re.search(r'(\d+)m?\s+(before|after)\s+T(\d+)', ref, re.IGNORECASE)
        if m_dist:
            offset_m = float(m_dist.group(1))
            direction = m_dist.group(2).lower()
            turn = int(m_dist.group(3))
            corner_d = corner_distances_m[turn]
            if direction == 'before':
                dist = corner_d - offset_m
            else:
                dist = corner_d + offset_m
            dist = dist % self.total_length_m
            return self._build_ref_result(dist, ref)

        raise ValueError(f"Cannot parse FIA reference: '{reference}'")

    def _build_ref_result(self, distance_m: float, reference: str) -> dict:
        idx = self.index_at_distance(distance_m)
        lon, lat = self.gps_at_distance(distance_m)
        return {
            "reference": reference,
            "distance_from_start_m": round(distance_m, 1),
            "distance_from_start_km": round(distance_m / 1000, 4),
            "centerline_index": idx,
            "lon": lon,
            "lat": lat,
        }

    # ── Export helpers ─────────────────────────────────────────

    def export_distance_table(self) -> list[dict]:
        """Full table of (index, cumulative_m, lon, lat) for every centerline point."""
        return [
            {
                "index": i,
                "cumulative_m": round(self.cumulative_m[i], 2),
                "cumulative_km": round(self.cumulative_m[i] / 1000, 4),
                "lon": self.coords[i][0],
                "lat": self.coords[i][1],
            }
            for i in range(self.n)
        ]


import re  # needed for resolve_fia_reference


# ─────────────────────────────────────────────────────────────
# Factory: build from JSON source
# ─────────────────────────────────────────────────────────────

def centerline_from_json(track_json: dict) -> Centerline:
    """Build a Centerline from the existing track JSON structure."""
    coords = track_json["geojson"]["coordinates"]   # [[lon, lat], ...]
    lap_km = track_json.get("lap_distance_km")
    return Centerline(coords, lap_distance_km=lap_km)


if __name__ == "__main__":
    import sys, json

    json_path = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads/bahrain_grand_prix_2025.json"
    with open(json_path) as f:
        data = json.load(f)

    print("Building centerline...")
    cl = centerline_from_json(data)

    print("\nDistance table (first 10 points):")
    table = cl.export_distance_table()
    for row in table[:10]:
        print(f"  idx={row['index']:3d}  {row['cumulative_km']:.4f} km  "
              f"({row['lat']:.6f}, {row['lon']:.6f})")

    print(f"\nTotal: {cl.total_length_km:.4f} km across {cl.n} points")

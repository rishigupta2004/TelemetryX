import argparse
import json
import math
from pathlib import Path
import unicodedata
from difflib import SequenceMatcher
import pandas as pd


ROOT = Path(__file__).parent.parent
TRACK_DIR = ROOT / "backend" / "etl" / "data" / "track_geometry"


TRACK_ID_MAP = {
    "abu_dhabi_grand_prix": "ae-2009",
    "australian_grand_prix": "au-1953",
    "austrian_grand_prix": "at-1969",
    "azerbaijan_grand_prix": "az-2016",
    "bahrain_grand_prix": "bh-2002",
    "belgian_grand_prix": "be-1925",
    "brazilian_grand_prix": "br-1940",
    "british_grand_prix": "gb-1948",
    "canadian_grand_prix": "ca-1978",
    "chinese_grand_prix": "cn-2004",
    "dutch_grand_prix": "nl-1948",
    "emilia_romagna_grand_prix": "it-1953",
    "french_grand_prix": "fr-1969",
    "german_grand_prix": "de-1932",
    "hungarian_grand_prix": "hu-1986",
    "italian_grand_prix": "it-1922",
    "japanese_grand_prix": "jp-1962",
    "las_vegas_grand_prix": "us-2023",
    "mexico_city_grand_prix": "mx-1962",
    "mexican_grand_prix": "mx-1962",
    "miami_grand_prix": "us-2022",
    "monaco_grand_prix": "mc-1929",
    "portuguese_grand_prix": "pt-2008",
    "qatar_grand_prix": "qa-2004",
    "russian_grand_prix": "ru-2014",
    "saudi_arabian_grand_prix": "sa-2021",
    "sao_paulo_grand_prix": "br-1940",
    "são_paulo_grand_prix": "br-1940",
    "sakhir_grand_prix": "bh-2002",
    "singapore_grand_prix": "sg-2008",
    "spanish_grand_prix": "es-1991",
    "styrian_grand_prix": "at-1969",
    "turkish_grand_prix": "tr-2005",
    "tuscan_grand_prix": "it-1914",
    "united_states_grand_prix": "us-2012",
    "70th_anniversary_grand_prix": "gb-1948",
    "anniversary_grand_prix": "gb-1948",
    "eifel_grand_prix": "de-1927",
}


def normalize_key(value: str) -> str:
    if value is None:
        return ""
    text = value.replace("-", " ").replace("_", " ").strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = " ".join(text.split()).lower()
    return text


def to_slug(value: str) -> str:
    return normalize_key(value).replace(" ", "_")


def load_locations(repo: Path) -> list:
    loc_path = repo / "f1-locations.json"
    if not loc_path.exists():
        loc_path = repo / "f1-locations.geojson"
    if loc_path.suffix == ".json":
        return json.loads(loc_path.read_text())
    return []


def choose_id(name: str, locations: list) -> str | None:
    slug = to_slug(name)
    if slug in TRACK_ID_MAP:
        return TRACK_ID_MAP[slug]
    best = None
    best_score = 0.0
    for item in locations:
        cand = f"{item.get('name','')} {item.get('location','')}"
        score = SequenceMatcher(None, normalize_key(name), normalize_key(cand)).ratio()
        if score > best_score:
            best_score = score
            best = item.get("id")
    if best_score >= 0.4:
        return best
    return None


def load_geojson(repo: Path, circuit_id: str) -> dict | None:
    geo_path = repo / "circuits" / f"{circuit_id}.geojson"
    if not geo_path.exists():
        return None
    data = json.loads(geo_path.read_text())
    if not data.get("features"):
        return None
    return data["features"][0]


def project_to_meters(coords: list) -> list:
    if not coords:
        return []
    lon0, lat0 = coords[0][0], coords[0][1]
    lat0_rad = math.radians(lat0)
    r = 6371000.0
    projected = []
    for point in coords:
        lon, lat = point[0], point[1]
        x = math.radians(lon - lon0) * math.cos(lat0_rad) * r
        y = math.radians(lat - lat0) * r
        projected.append([round(x, 3), round(y, 3)])
    return projected


def ensure_optional_fields(track: dict) -> None:
    track.setdefault("pitLaneCenterline", [])
    track.setdefault("drsDetectionPoints", [])
    track.setdefault("marshalPanels", [])
    track.setdefault("sectorTimingPoints", [])


def upgrade_track_file(track_file: Path, repo: Path, locations: list) -> bool:
    raw = json.loads(track_file.read_text())
    race_name = raw.get("name", track_file.stem.replace("_", " "))
    circuit_id = choose_id(race_name, locations)
    if not circuit_id:
        return False
    feature = load_geojson(repo, circuit_id)
    if not feature:
        return False
    coords = feature.get("geometry", {}).get("coordinates", [])
    if not coords:
        return False
    centerline = project_to_meters(coords)

    raw["centerline"] = centerline
    raw["geojson"] = {
        "type": "LineString",
        "coordinates": [[float(c[0]), float(c[1])] for c in coords],
    }
    raw["source"] = {
        "geometry": "bacinger/f1-circuits",
        "geometryId": circuit_id,
        "geometryName": feature.get("properties", {}).get("Name"),
        "geometryLocation": feature.get("properties", {}).get("Location"),
    }
    ensure_optional_fields(raw)

    track_file.write_text(json.dumps(raw, indent=2))
    return True


def create_year_versions(years: list[int]) -> None:
    circuits_path = TRACK_DIR / "circuits.parquet"
    if not circuits_path.exists():
        return
    df = pd.read_parquet(circuits_path)
    df = df[df["year"].isin(years)]

    race_to_file = {to_slug(p.stem): p for p in TRACK_DIR.glob("*.json") if p.name not in {"circuits_3d.json"} and p.stem not in {"circuits", "corners"}}
    for _, row in df.iterrows():
        race_name = row["circuit_name"]
        slug = to_slug(race_name)
        base_file = race_to_file.get(slug)
        if not base_file:
            continue
        year = int(row["year"])
        target = TRACK_DIR / f"{slug}_{year}.json"
        if target.exists():
            continue
        data = json.loads(base_file.read_text())
        data["layoutYear"] = year
        if isinstance(data.get("source"), dict):
            data["source"]["layoutYear"] = year
        target.write_text(json.dumps(data, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Upgrade track geometry using bacinger/f1-circuits")
    parser.add_argument("--repo", type=str, required=True, help="Path to bacinger/f1-circuits repo")
    parser.add_argument("--years", type=str, default="2018-2025", help="Year range for versioned layouts")
    args = parser.parse_args()

    repo = Path(args.repo)
    if not repo.exists():
        raise SystemExit(f"Repo not found: {repo}")

    locations = load_locations(repo)
    upgraded = 0
    skipped = []
    for track_file in TRACK_DIR.glob("*.json"):
        if track_file.name in {"circuits_3d.json"}:
            continue
        if track_file.stem in {"circuits", "corners"}:
            continue
        if upgrade_track_file(track_file, repo, locations):
            upgraded += 1
        else:
            skipped.append(track_file.name)

    years = []
    if "-" in args.years:
        start, end = map(int, args.years.split("-"))
        years = list(range(start, end + 1))
    else:
        years = [int(args.years)]
    create_year_versions(years)

    print(f"Upgraded {upgraded} tracks")
    if skipped:
        print(f"Skipped: {skipped}")


if __name__ == "__main__":
    main()

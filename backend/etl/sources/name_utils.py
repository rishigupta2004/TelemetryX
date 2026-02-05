import unicodedata
from typing import List, Optional


def _strip_accents(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def normalize_key(value: str) -> str:
    if not value:
        return ""
    value = _strip_accents(value).lower()
    value = value.replace("grand prix", "")
    value = value.replace("gp", "")
    return " ".join(value.split()).strip()


def canonicalize_race_name(year: int, race_name: str) -> str:
    """Map TelemetryX race names to official source naming."""
    name = (race_name or "").strip()

    if year == 2020 and name == "Anniversary Grand Prix":
        return "70th Anniversary Grand Prix"

    if year >= 2021:
        if name == "Brazilian Grand Prix":
            return "São Paulo Grand Prix"
        if name == "Mexican Grand Prix":
            return "Mexico City Grand Prix"

    return name


def race_name_candidates(year: int, race_name: str) -> List[str]:
    """Generate possible race name variants for matching."""
    candidates = []
    canonical = canonicalize_race_name(year, race_name)
    if canonical:
        candidates.append(canonical)
    if race_name and race_name not in candidates:
        candidates.append(race_name)

    # Known aliases that may appear in external sources
    alias_map = {
        "Brazilian Grand Prix": ["São Paulo Grand Prix"],
        "São Paulo Grand Prix": ["Brazilian Grand Prix"],
        "Mexican Grand Prix": ["Mexico City Grand Prix"],
        "Mexico City Grand Prix": ["Mexican Grand Prix"],
        "Anniversary Grand Prix": ["70th Anniversary Grand Prix"],
        "70th Anniversary Grand Prix": ["Anniversary Grand Prix"],
    }

    for key, aliases in alias_map.items():
        if race_name == key:
            for alias in aliases:
                if alias not in candidates:
                    candidates.append(alias)

    return candidates


def match_race_name(year: int, race_name: str, options: List[str]) -> Optional[str]:
    """Match a race name to a list of available options."""
    if not options:
        return None

    target_keys = [normalize_key(c) for c in race_name_candidates(year, race_name)]

    for opt in options:
        opt_key = normalize_key(opt)
        if opt_key in target_keys:
            return opt

    # Fallback: token overlap
    best = None
    best_score = 0
    for opt in options:
        opt_key = normalize_key(opt)
        opt_tokens = set(opt_key.split())
        for target in target_keys:
            tgt_tokens = set(target.split())
            score = len(opt_tokens & tgt_tokens)
            if score > best_score:
                best_score = score
                best = opt

    return best

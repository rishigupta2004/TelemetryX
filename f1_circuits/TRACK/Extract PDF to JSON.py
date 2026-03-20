"""
FIA PDF Extractor
=================
Extracts all structured data from FIA event notes PDFs.
Handles both text-based pages and structured image-page data
that is manually described via YAML annotation files.
"""

import json
import re
import pdfplumber
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional


# ─────────────────────────────────────────────
# Data structures for extracted PDF data
# ─────────────────────────────────────────────

@dataclass
class PitLaneGarage:
    bay: int
    team: str
    car_numbers: list[int] = field(default_factory=list)


@dataclass
class PitLaneData:
    garages: list[PitLaneGarage] = field(default_factory=list)
    sc1_line_bay: Optional[int] = None
    sc2_line_bay: Optional[int] = None
    pit_lane_starts_bay: Optional[int] = None
    pit_lane_ends_bay: Optional[int] = None
    pole_side: Optional[str] = None   # "LHS" or "RHS"
    fast_lane_present: bool = True
    safety_car_bay: Optional[int] = None
    medical_car_bay: Optional[int] = None
    collection_point_bay: Optional[int] = None


@dataclass
class EventMetadata:
    grand_prix_name: str = ""
    year: int = 0
    dates: str = ""
    circuit_name: str = ""
    circuit_location: str = ""
    document_number: int = 0
    document_date: str = ""
    race_director: str = ""


@dataclass
class ERSContainmentArea:
    location_description: str = ""
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    contact_name: str = ""
    contact_mobile: str = ""
    contact_email: str = ""


@dataclass
class ExtractedPDFData:
    metadata: EventMetadata = field(default_factory=EventMetadata)
    pit_lane: PitLaneData = field(default_factory=PitLaneData)
    ers_containment: ERSContainmentArea = field(default_factory=ERSContainmentArea)
    raw_pages: dict = field(default_factory=dict)


# ─────────────────────────────────────────────
# Pit lane parser
# ─────────────────────────────────────────────

TEAM_ALIASES = {
    "RAB": "Racing Bulls", "RACING BULLS": "Racing Bulls",
    "RED BULL": "Red Bull", "REDBULL": "Red Bull",
    "MERCEDES": "Mercedes", "FERRARI": "Ferrari",
    "MCLAREN": "McLaren", "ALPINE": "Alpine",
    "ASTON MARTIN": "Aston Martin", "ASTON": "Aston Martin",
    "WILLIAMS": "Williams", "HAAS": "Haas",
    "SAUBER": "Sauber", "FOM": "FOM", "FIA": "FIA",
}


def _normalize_team(name: str) -> str:
    name = name.strip().upper()
    for alias, canonical in TEAM_ALIASES.items():
        if alias in name:
            return canonical
    return name.title()


def parse_pit_lane(text: str) -> PitLaneData:
    """Parse pit lane drawing text into structured data."""
    pit = PitLaneData()

    # Extract all bay numbers and their associated team names
    # Pattern: "TEAM\n<bay_num>" or "<bay_num>\nTEAM"
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Build a flat list of tokens
    tokens = []
    for line in lines:
        # Split on whitespace, keep multi-word team names together
        tokens.extend(line.split())

    # Find bay number sequences (consecutive integers)
    bay_numbers = []
    for t in tokens:
        try:
            n = int(t)
            if 0 <= n <= 40:
                bay_numbers.append(n)
        except ValueError:
            pass

    # Extract teams via regex patterns for team blocks
    team_pattern = re.compile(
        r'((?:RACING BULLS|ASTON MARTIN|RED BULL|'
        r'MCLAREN|MERCEDES|FERRARI|WILLIAMS|'
        r'ALPINE|SAUBER|HAAS|RAB|FOM|FIA))',
        re.IGNORECASE
    )
    team_matches = team_pattern.findall(text)
    teams = [_normalize_team(t) for t in team_matches]

    # Map major team blocks (from the structured pit lane text)
    # Parse the summary line at bottom: "SAUBER  WILLIAMS  RAB  HAAS  ALPINE  ASTON  MERCEDES  RED BULL  FERRARI  MCLAREN"
    summary_match = re.search(
        r'SAUBER.*?MCLAREN',
        text.replace('\n', ' '),
        re.IGNORECASE | re.DOTALL
    )

    # Extract specific markers
    if 'SC1' in text or 'SC2' in text:
        sc1_match = re.search(r'SC1.*?(\d+)', text.replace('\n', ' '))
        sc2_match = re.search(r'SC2.*?(\d+)', text.replace('\n', ' '))

    pit.pole_side = "LHS" if "Pole LHS" in text else "RHS" if "Pole RHS" in text else None

    # Build garage list from the full text
    # The pit lane text has format: bay_numbers in sequence with team names
    # We parse by finding numbered sequence rows
    garage_pattern = re.compile(
        r'(\d+)\s+((?:RACING BULLS?|ASTON MARTIN|RED BULL|'
        r'MCLAREN|MERCEDES|FERRARI|WILLIAMS|'
        r'ALPINE|SAUBER|HAAS|RAB|FOM|FIA)\b)',
        re.IGNORECASE
    )

    seen_bays = set()
    for match in garage_pattern.finditer(text):
        bay = int(match.group(1))
        team = _normalize_team(match.group(2))
        if bay not in seen_bays and 0 <= bay <= 40:
            pit.garages.append(PitLaneGarage(bay=bay, team=team))
            seen_bays.add(bay)

    pit.garages.sort(key=lambda g: g.bay)
    return pit


# ─────────────────────────────────────────────
# GPS coordinate extractor
# ─────────────────────────────────────────────

def parse_gps(text: str) -> tuple[Optional[float], Optional[float]]:
    """Extract GPS coordinates from text like '26°01'28.3"N 50°30'42.6"E'"""
    pattern = re.compile(
        r'(\d+)°(\d+)\'([\d.]+)"([NS])\s+(\d+)°(\d+)\'([\d.]+)"([EW])'
    )
    m = pattern.search(text)
    if not m:
        return None, None

    def dms_to_dd(deg, min_, sec, hemi):
        dd = float(deg) + float(min_) / 60 + float(sec) / 3600
        if hemi in ('S', 'W'):
            dd = -dd
        return round(dd, 6)

    lat = dms_to_dd(m.group(1), m.group(2), m.group(3), m.group(4))
    lon = dms_to_dd(m.group(5), m.group(6), m.group(7), m.group(8))
    return lat, lon


# ─────────────────────────────────────────────
# Main extractor
# ─────────────────────────────────────────────

def extract_from_pdf(pdf_path: str) -> ExtractedPDFData:
    """Main entry point: extract all data from an FIA event notes PDF."""
    result = ExtractedPDFData()
    path = Path(pdf_path)

    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            result.raw_pages[i + 1] = text

            # ── Page 1: Event metadata ──────────────────────────
            if i == 0:
                # Grand Prix name
                gp_match = re.search(r'(\d{4})\s+(.+?GRAND PRIX)', text, re.IGNORECASE)
                if gp_match:
                    result.metadata.year = int(gp_match.group(1))
                    result.metadata.grand_prix_name = gp_match.group(2).strip()

                # Dates
                date_match = re.search(r'(\d+\s*-\s*\d+\s+\w+\s+\d{4})', text)
                if date_match:
                    result.metadata.dates = date_match.group(1)

                # Document number
                doc_match = re.search(r'Document\s+(\d+)', text)
                if doc_match:
                    result.metadata.document_number = int(doc_match.group(1))

                # Document date
                doc_date = re.search(r'Date\s+(\d+\s+\w+\s+\d{4})', text)
                if doc_date:
                    result.metadata.document_date = doc_date.group(1)

                # Race director
                director_match = re.search(r'\n([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n\s*The FIA', text)
                if director_match:
                    result.metadata.race_director = director_match.group(1)

            # ── Page 3: Pit lane drawing ─────────────────────────
            elif i == 2 and ('PIT LANE' in text.upper() or 'GARAGE' in text.upper()):
                result.pit_lane = parse_pit_lane(text)

            # ── Page 5: ERS Battery containment ─────────────────
            elif 'ERS Battery' in text or 'Containment Area' in text:
                lat, lon = parse_gps(text)
                result.ers_containment.gps_lat = lat
                result.ers_containment.gps_lon = lon

                loc_match = re.search(r"Location.*?:\s*(.+?)(?:\n|$)", text)
                if loc_match:
                    result.ers_containment.location_description = loc_match.group(1).strip()

                # Contact info
                mobile_match = re.search(r'Mobile:\s*(\+[\d-]+)', text)
                email_match = re.search(r'Email:\s*([\w.@]+)', text)
                name_match = re.search(r'\n([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\nMobile', text)

                if mobile_match:
                    result.ers_containment.contact_mobile = mobile_match.group(1)
                if email_match:
                    result.ers_containment.contact_email = email_match.group(1)
                if name_match:
                    result.ers_containment.contact_name = name_match.group(1)

    return result


if __name__ == "__main__":
    import sys
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads/2025_Bahrain_.pdf"
    data = extract_from_pdf(pdf_path)
    print(json.dumps(asdict(data), indent=2))

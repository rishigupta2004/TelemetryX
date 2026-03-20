"""
Vision Annotator
================
Renders image-only PDF pages (circuit maps) and calls the Claude API
with vision to extract all FIA distance references automatically.

Outputs: annotations/<circuit_slug>.yaml
"""

import json
import base64
import re
import sys
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

try:
    import fitz  # PyMuPDF — best PDF renderer
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    from pdf2image import convert_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False

import urllib.request
import urllib.error
import http.client


# ─────────────────────────────────────────────────────────────
# Claude API vision call
# ─────────────────────────────────────────────────────────────

VISION_SYSTEM_PROMPT = """You are an expert at reading FIA Formula 1 circuit maps.
You will be given an image of an official FIA circuit map page from an event notes document.

Extract ALL of the following information and return ONLY valid JSON — no markdown, no explanation:

{
  "circuit": {
    "name": "<full circuit name>",
    "location": "<city, country>",
    "lap_distance_km": <float>,
    "direction": "<clockwise or counterclockwise>",
    "track_width_m": <int, usually 12-15>,
    "number_of_corners": <int>
  },
  "speed_trap": {
    "reference": "<e.g. 158m before T1>"
  },
  "sectors": [
    {"number": 1, "start_reference": "start_finish", "end_reference": "<e.g. At T5>"},
    {"number": 2, "start_reference": "<e.g. At T5>", "end_reference": "<e.g. At T10>"},
    {"number": 3, "start_reference": "<e.g. At T10>", "end_reference": "start_finish"}
  ],
  "drs_zones": [
    {
      "zone_number": 1,
      "detection_reference": "<exact text from legend e.g. 50m before T1>",
      "activation_reference": "<exact text from legend e.g. 23m after T3>",
      "end_turn": <int>,
      "straight": "<name of straight if known>",
      "notes": "<any relevant notes>"
    }
  ],
  "corners": [
    {"number": 1, "type": "<tight|medium|fast|hairpin|chicane>", "direction": "<left|right>", "sector": <int>}
  ],
  "extraction_confidence": "<high|medium|low>",
  "manual_review_needed": <true|false>,
  "review_notes": "<any issues or uncertainties>"
}

IMPORTANT RULES:
- DRS references MUST match the legend exactly as written on the map
  (e.g. "50m before T1", "23m after T3", "At T5")  
- If the legend says "Detection 1 = 50m before T1", write "50m before T1"
- Sector boundaries: find where S1/S2/S2/S3 labels appear on the track
- If you cannot read something clearly, set manual_review_needed: true
- Return ONLY the JSON object, nothing else
"""


def pdf_page_to_base64(pdf_path: str, page_num: int = 1, dpi: int = 200) -> Optional[str]:
    """
    Render a PDF page to a base64-encoded PNG.
    Tries PyMuPDF first, then pdf2image.
    page_num is 0-indexed.
    """
    pdf_path = str(pdf_path)

    if HAS_FITZ:
        doc = fitz.open(pdf_path)
        if page_num >= len(doc):
            return None
        page = doc[page_num]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        doc.close()
        return base64.b64encode(img_bytes).decode("utf-8")

    if HAS_PDF2IMAGE:
        images = convert_from_path(pdf_path, dpi=dpi, first_page=page_num+1, last_page=page_num+1)
        if not images:
            return None
        import io
        buf = io.BytesIO()
        images[0].save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    raise RuntimeError("Neither PyMuPDF (fitz) nor pdf2image is available. "
                       "Install with: pip install pymupdf pdf2image")


def find_circuit_map_page(pdf_path: str) -> int:
    """
    Find which page contains the circuit map (usually page 2, index 1).
    Returns 0-indexed page number.
    """
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = (page.extract_text() or "").lower()
                # Circuit map pages are usually image-only or contain "circuit map"
                if "circuit map" in text or "centreline" in text or "centerline" in text:
                    return i
                # Image-only pages with no text are likely the map
                if not text.strip() and i > 0:
                    return i
    except Exception:
        pass
    return 1  # Default: page 2 (index 1)


def call_claude_vision(image_b64: str, api_key: str = None) -> dict:
    """
    Call Claude API with a circuit map image and return extracted annotation data.
    """
    # API key from env or parameter
    key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")

    payload = json.dumps({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 2000,
        "system": VISION_SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64,
                        }
                    },
                    {
                        "type": "text",
                        "text": "Please extract all circuit map information from this FIA document page. Return only the JSON."
                    }
                ]
            }
        ]
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Claude API error {e.code}: {e.read().decode()}")

    # Extract text content
    text = ""
    for block in body.get("content", []):
        if block.get("type") == "text":
            text += block["text"]

    # Parse JSON from response
    text = text.strip()
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    return json.loads(text)


# ─────────────────────────────────────────────────────────────
# YAML writer
# ─────────────────────────────────────────────────────────────

def dict_to_yaml(d: dict, indent: int = 0) -> str:
    """Simple dict-to-YAML serializer (no dependency needed)."""
    lines = []
    pad = "  " * indent
    for key, val in d.items():
        if isinstance(val, dict):
            lines.append(f"{pad}{key}:")
            lines.append(dict_to_yaml(val, indent + 1))
        elif isinstance(val, list):
            lines.append(f"{pad}{key}:")
            for item in val:
                if isinstance(item, dict):
                    first = True
                    for k, v in item.items():
                        prefix = f"{pad}  - " if first else f"{pad}    "
                        first = False
                        if isinstance(v, str):
                            lines.append(f'{prefix}{k}: "{v}"')
                        elif v is None:
                            lines.append(f"{prefix}{k}: null")
                        else:
                            lines.append(f"{prefix}{k}: {v}")
                else:
                    lines.append(f"{pad}  - {item}")
        elif isinstance(val, str):
            lines.append(f'{pad}{key}: "{val}"')
        elif val is None:
            lines.append(f"{pad}{key}: null")
        else:
            lines.append(f"{pad}{key}: {val}")
    return "\n".join(lines)


def annotation_to_yaml(data: dict, pdf_path: str) -> str:
    """Convert Claude vision output to annotation YAML format."""
    header = f"""# ─────────────────────────────────────────────────────────────────
# FIA ANNOTATION FILE — Auto-generated by vision_annotator.py
# Source PDF: {Path(pdf_path).name}
# Confidence: {data.get('extraction_confidence', 'unknown')}
# Manual review needed: {data.get('manual_review_needed', False)}
# Review notes: {data.get('review_notes', 'none')}
# ─────────────────────────────────────────────────────────────────
# ⚠️  Always verify DRS references against the original PDF image
# ─────────────────────────────────────────────────────────────────

"""
    body = dict_to_yaml({
        "circuit": data.get("circuit", {}),
        "speed_trap": data.get("speed_trap", {}),
        "sectors": data.get("sectors", []),
        "drs_zones": data.get("drs_zones", []),
        "corners": data.get("corners", []),
    })
    return header + body


# ─────────────────────────────────────────────────────────────
# Main function
# ─────────────────────────────────────────────────────────────

def annotate_pdf(
    pdf_path: str,
    output_dir: str = "annotations",
    circuit_slug: str = None,
    api_key: str = None,
    force: bool = False,
) -> tuple[str, dict]:
    """
    Full pipeline: PDF → circuit map image → Claude vision → annotation YAML.

    Returns (yaml_path, extracted_data)
    """
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    slug = circuit_slug or pdf_path.stem.lower().replace(" ", "_").replace("-", "_")
    slug = re.sub(r"[^a-z0-9_]", "", slug)
    yaml_path = output_dir / f"{slug}.yaml"

    if yaml_path.exists() and not force:
        print(f"  ⏭  Annotation already exists: {yaml_path} (use --force to overwrite)")
        # Load and return existing
        with open(yaml_path) as f:
            return str(yaml_path), {"_loaded_from_cache": True}

    print(f"  📄 Finding circuit map page in {pdf_path.name}...")
    map_page_idx = find_circuit_map_page(str(pdf_path))
    print(f"     Circuit map → page {map_page_idx + 1}")

    print(f"  🖼  Rendering page {map_page_idx + 1} to image...")
    image_b64 = pdf_page_to_base64(str(pdf_path), page_num=map_page_idx, dpi=200)
    if not image_b64:
        raise RuntimeError(f"Could not render page {map_page_idx + 1} from {pdf_path.name}")

    print(f"  🤖 Calling Claude vision API...")
    extracted = call_claude_vision(image_b64, api_key=api_key)

    print(f"  ✓  Extracted: {len(extracted.get('drs_zones', []))} DRS zones, "
          f"{len(extracted.get('corners', []))} corners, "
          f"confidence={extracted.get('extraction_confidence', '?')}")

    if extracted.get("manual_review_needed"):
        print(f"  ⚠️  Manual review needed: {extracted.get('review_notes', '')}")

    yaml_content = annotation_to_yaml(extracted, str(pdf_path))
    with open(yaml_path, "w") as f:
        f.write(yaml_content)
    print(f"  💾 Saved annotation: {yaml_path}")

    return str(yaml_path), extracted


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", help="Path to FIA PDF")
    parser.add_argument("--output-dir", default="annotations")
    parser.add_argument("--slug", default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    yaml_path, data = annotate_pdf(
        pdf_path=args.pdf,
        output_dir=args.output_dir,
        circuit_slug=args.slug,
        force=args.force,
    )
    print(f"\nDone → {yaml_path}")

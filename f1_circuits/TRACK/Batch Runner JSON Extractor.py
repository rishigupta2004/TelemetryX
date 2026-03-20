"""
Batch Runner
============
Processes ALL FIA PDFs in the pdfs/ folder automatically.

Usage:
  python3 batch_runner.py                        # process all new PDFs
  python3 batch_runner.py --pdf "path/to.pdf"   # process one PDF
  python3 batch_runner.py --remap-only           # re-run mapping on existing annotations
  python3 batch_runner.py --force                # reprocess everything

Pipeline per PDF:
  1. extract_pdf.py     → metadata, pit lane, ERS
  2. vision_annotator.py → reads circuit map image → generates annotation YAML
  3. distance_mapper.py  → maps FIA references to GPS → enriched JSON
"""

import argparse
import json
import re
import sys
import os
import time
import traceback
from pathlib import Path
from datetime import datetime

# ── Local imports ──────────────────────────────────────────────
PIPELINE_DIR = Path(__file__).parent
sys.path.insert(0, str(PIPELINE_DIR))

from extract_pdf import extract_from_pdf
from centerline_engine import centerline_from_json
from distance_mapper import build_enriched_track, get_bahrain_2025_annotations
from vision_annotator import annotate_pdf


# ─────────────────────────────────────────────────────────────
# Circuit name → base JSON matcher
# ─────────────────────────────────────────────────────────────

# Known mappings from common PDF name patterns to circuit slugs
# Add more as you process additional circuits
KNOWN_CIRCUITS = {
    "bahrain":        "bh-2002",
    "sakhir":         "bh-2002",
    "abu dhabi":      "ae-2021",
    "yas marina":     "ae-2021",
    "australia":      "au-2021",
    "albert park":    "au-2021",
    "austrian":       "at-2016",
    "red bull ring":  "at-2016",
    "azerbaijan":     "az-2016",
    "baku":           "az-2016",
    "belgian":        "be-2022",
    "spa":            "be-2022",
    "british":        "gb-2010",
    "silverstone":    "gb-2010",
    "canadian":       "ca-2002",
    "montreal":       "ca-2002",
    "dutch":          "nl-2021",
    "zandvoort":      "nl-2021",
    "german":         "de-2018",
    "hockenheim":     "de-2018",
    "hungarian":      "hu-1986",
    "hungaroring":    "hu-1986",
    "italian":        "it-1999",
    "monza":          "it-1999",
    "japanese":       "jp-1987",
    "suzuka":         "jp-1987",
    "las vegas":      "us-lv-2023",
    "miami":          "us-mi-2022",
    "monaco":         "mc-1929",
    "portuguese":     "pt-2020",
    "algarve":        "pt-2020",
    "portimao":       "pt-2020",
    "qatar":          "qa-2021",
    "losail":         "qa-2021",
    "russian":        "ru-2014",
    "sochi":          "ru-2014",
    "saudi":          "sa-2021",
    "jeddah":         "sa-2021",
    "singapore":      "sg-2008",
    "marina bay":     "sg-2008",
    "são paulo":      "br-2000",
    "sao paulo":      "br-2000",
    "interlagos":     "br-2000",
    "spanish":        "es-1999",
    "barcelona":      "es-1999",
    "turkish":        "tr-2005",
    "istanbul":       "tr-2005",
    "tuscan":         "it-mug-2020",
    "mugello":        "it-mug-2020",
    "united states":  "us-2012",
    "austin":         "us-2012",
    "cota":           "us-2012",
    "french":         "fr-2018",
    "paul ricard":    "fr-2018",
    "eifel":          "de-nr-2020",
    "nurburgring":    "de-nr-2020",
    "emilia":         "it-im-2020",
    "imola":          "it-im-2020",
    "styrian":        "at-2016",
    "70th anniversary": "gb-2010",
}


def match_circuit(pdf_name: str, base_json_dir: Path) -> Optional[Path]:
    """Find the best matching base JSON for a given PDF filename."""
    name_lower = pdf_name.lower()

    # Try known circuit name matches
    for keyword, layout_id in KNOWN_CIRCUITS.items():
        if keyword in name_lower:
            # Look for a JSON with this layout_id or keyword in name
            for json_file in base_json_dir.glob("*.json"):
                content = json_file.read_text()
                if layout_id in content or keyword in json_file.name.lower():
                    return json_file

    # Fallback: fuzzy filename match
    for json_file in base_json_dir.glob("*.json"):
        json_words = set(re.split(r'[_\- ]+', json_file.stem.lower()))
        pdf_words = set(re.split(r'[_\- ]+', name_lower))
        overlap = json_words & pdf_words - {"grand", "prix", "gp", "map", "2025", "2024", "2023"}
        if len(overlap) >= 2:
            return json_file

    return None


from typing import Optional


# ─────────────────────────────────────────────────────────────
# Slug generator
# ─────────────────────────────────────────────────────────────

def pdf_to_slug(pdf_path: Path) -> str:
    name = pdf_path.stem
    # Remove common suffixes
    name = re.sub(r'[-_ ]*(map|v\d+|ev.*one).*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[^a-zA-Z0-9 ]', ' ', name)
    name = re.sub(r'\s+', '_', name.strip()).lower()
    return name


# ─────────────────────────────────────────────────────────────
# Logger
# ─────────────────────────────────────────────────────────────

class Logger:
    def __init__(self, log_path: Path):
        self.log_path = log_path
        self.entries = []

    def log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line)
        self.entries.append(line)
        with open(self.log_path, "a") as f:
            f.write(line + "\n")


# ─────────────────────────────────────────────────────────────
# Single PDF processor
# ─────────────────────────────────────────────────────────────

def process_pdf(
    pdf_path: Path,
    base_json_dir: Path,
    annotation_dir: Path,
    output_dir: Path,
    logger: Logger,
    force: bool = False,
    remap_only: bool = False,
    api_key: str = None,
) -> dict:
    """
    Process one PDF through the full pipeline.
    Returns a result dict with status and details.
    """
    slug = pdf_to_slug(pdf_path)
    output_path = output_dir / f"{slug}_enriched.json"

    logger.log(f"\n{'─'*55}")
    logger.log(f"📂 {pdf_path.name}")
    logger.log(f"   Slug: {slug}")

    # Skip if already done
    if output_path.exists() and not force:
        logger.log(f"   ⏭  Already processed → {output_path.name}")
        return {"status": "skipped", "pdf": pdf_path.name, "output": str(output_path)}

    # ── Find base JSON ─────────────────────────────────────────
    base_json = match_circuit(pdf_path.name, base_json_dir)
    if not base_json:
        logger.log(f"   ❌ No base JSON found — adding to missing_base_jsons.txt")
        with open(PIPELINE_DIR / "missing_base_jsons.txt", "a") as f:
            f.write(f"{pdf_path.name}\n")
        return {"status": "no_base_json", "pdf": pdf_path.name}

    logger.log(f"   📐 Base JSON: {base_json.name}")

    # ── Step 1: Vision annotation ──────────────────────────────
    annotation_yaml = annotation_dir / f"{slug}.yaml"

    if not remap_only:
        logger.log(f"   🤖 Running vision annotator...")
        try:
            yaml_path, vision_data = annotate_pdf(
                pdf_path=str(pdf_path),
                output_dir=str(annotation_dir),
                circuit_slug=slug,
                api_key=api_key,
                force=force,
            )
            annotation_yaml = Path(yaml_path)

            if vision_data.get("manual_review_needed"):
                logger.log(f"   ⚠️  Manual review flagged: {vision_data.get('review_notes', '')}")

        except Exception as e:
            logger.log(f"   ❌ Vision annotation failed: {e}")
            logger.log(f"      Traceback: {traceback.format_exc()}")
            return {"status": "vision_failed", "pdf": pdf_path.name, "error": str(e)}

    if not annotation_yaml.exists():
        logger.log(f"   ❌ No annotation YAML found at {annotation_yaml}")
        return {"status": "no_annotation", "pdf": pdf_path.name}

    # ── Step 2: Distance mapping → enriched JSON ───────────────
    logger.log(f"   🗺  Running distance mapper...")
    try:
        result = build_enriched_track(
            base_json_path=str(base_json),
            pdf_path=str(pdf_path),
            annotation_yaml_path=str(annotation_yaml),
            output_path=str(output_path),
        )
        logger.log(f"   ✅ Success → {output_path.name}")
        return {
            "status": "success",
            "pdf": pdf_path.name,
            "output": str(output_path),
            "corners": len(result.get("corners", [])),
            "drs_zones": len(result.get("drs_zones", [])),
        }

    except Exception as e:
        logger.log(f"   ❌ Mapping failed: {e}")
        logger.log(f"      Traceback: {traceback.format_exc()}")
        return {"status": "mapping_failed", "pdf": pdf_path.name, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# Batch runner
# ─────────────────────────────────────────────────────────────

def run_batch(
    pdf_dir: str = "pdfs",
    base_json_dir: str = "base_jsons",
    annotation_dir: str = "annotations",
    output_dir: str = "output",
    single_pdf: str = None,
    force: bool = False,
    remap_only: bool = False,
    api_key: str = None,
):
    # Setup dirs
    pdf_dir = PIPELINE_DIR / pdf_dir
    base_json_dir = PIPELINE_DIR / base_json_dir
    annotation_dir = PIPELINE_DIR / annotation_dir
    output_dir = PIPELINE_DIR / output_dir

    for d in [pdf_dir, base_json_dir, annotation_dir, output_dir]:
        d.mkdir(parents=True, exist_ok=True)

    log_path = PIPELINE_DIR / "pipeline.log"
    logger = Logger(log_path)

    logger.log("=" * 55)
    logger.log("  FIA Track Pipeline — Batch Runner")
    logger.log(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.log("=" * 55)

    # Collect PDFs to process
    if single_pdf:
        pdfs = [Path(single_pdf)]
    else:
        pdfs = sorted(pdf_dir.glob("*.pdf")) + sorted(pdf_dir.glob("*.PDF"))

    if not pdfs:
        logger.log(f"\n⚠️  No PDFs found in {pdf_dir}")
        logger.log(f"   Drop your FIA PDFs into: {pdf_dir}")
        return

    logger.log(f"\n Found {len(pdfs)} PDF(s) to process\n")

    # Process each PDF
    results = []
    for pdf_path in pdfs:
        result = process_pdf(
            pdf_path=pdf_path,
            base_json_dir=base_json_dir,
            annotation_dir=annotation_dir,
            output_dir=output_dir,
            logger=logger,
            force=force,
            remap_only=remap_only,
            api_key=api_key,
        )
        results.append(result)
        time.sleep(0.5)  # Be nice to the API

    # ── Summary report ─────────────────────────────────────────
    logger.log(f"\n{'='*55}")
    logger.log("  SUMMARY")
    logger.log(f"{'='*55}")

    status_counts = {}
    for r in results:
        s = r["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    total = len(results)
    success = status_counts.get("success", 0)
    skipped = status_counts.get("skipped", 0)
    failed = total - success - skipped

    logger.log(f"  Total:    {total}")
    logger.log(f"  ✅ Success:  {success}")
    logger.log(f"  ⏭  Skipped:  {skipped}")
    logger.log(f"  ❌ Failed:   {failed}")

    if failed > 0:
        logger.log("\n  Failed PDFs:")
        for r in results:
            if r["status"] not in ("success", "skipped"):
                logger.log(f"    • {r['pdf']} ({r['status']})")
                if "error" in r:
                    logger.log(f"      Error: {r['error'][:100]}")

    logger.log(f"\n  Output dir: {output_dir}")
    logger.log(f"  Log file:   {log_path}")
    logger.log(f"{'='*55}\n")

    # Save JSON summary
    summary_path = output_dir / "batch_summary.json"
    with open(summary_path, "w") as f:
        json.dump({
            "run_at": datetime.now().isoformat(),
            "total": total,
            "success": success,
            "skipped": skipped,
            "failed": failed,
            "results": results,
        }, f, indent=2)
    logger.log(f"  Summary JSON: {summary_path}")


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="FIA Track Pipeline — Batch Processor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all PDFs in pdfs/ folder:
  python3 batch_runner.py

  # Process a single PDF:
  python3 batch_runner.py --pdf "pdfs/2025 Bahrain .pdf"

  # Re-run mapping only (skip vision, use existing annotation YAMLs):
  python3 batch_runner.py --remap-only

  # Reprocess everything from scratch:
  python3 batch_runner.py --force
        """
    )
    parser.add_argument("--pdf", help="Process a single PDF file")
    parser.add_argument("--pdf-dir", default="pdfs", help="Folder containing PDFs")
    parser.add_argument("--base-json-dir", default="base_jsons", help="Folder with base circuit JSONs")
    parser.add_argument("--annotation-dir", default="annotations", help="Folder for annotation YAMLs")
    parser.add_argument("--output-dir", default="output", help="Folder for enriched JSONs")
    parser.add_argument("--force", action="store_true", help="Reprocess even if output exists")
    parser.add_argument("--remap-only", action="store_true", help="Skip vision, re-run mapping only")
    parser.add_argument("--api-key", default=None, help="Anthropic API key (or set ANTHROPIC_API_KEY env var)")

    args = parser.parse_args()

    run_batch(
        pdf_dir=args.pdf_dir,
        base_json_dir=args.base_json_dir,
        annotation_dir=args.annotation_dir,
        output_dir=args.output_dir,
        single_pdf=args.pdf,
        force=args.force,
        remap_only=args.remap_only,
        api_key=args.api_key,
    )

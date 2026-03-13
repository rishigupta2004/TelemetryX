from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

SCRIPT_DIR = str(Path(__file__).resolve().parent)
if SCRIPT_DIR in sys.path:
    sys.path.remove(SCRIPT_DIR)

import duckdb  # type: ignore


def _safe_count(path: Path) -> int:
    conn = duckdb.connect()
    try:
        return int(
            conn.execute(
                "SELECT COUNT(*) FROM read_parquet(?)", [str(path)]
            ).fetchone()[0]
            or 0
        )
    except Exception:
        return -1
    finally:
        conn.close()


def _safe_schema(path: Path) -> List[str]:
    conn = duckdb.connect()
    try:
        rows = conn.execute(
            "DESCRIBE SELECT * FROM read_parquet(?)", [str(path)]
        ).fetchall()
        return [str(r[0]) for r in rows]
    except Exception:
        return []
    finally:
        conn.close()


def _hash(values: List[str]) -> str:
    return hashlib.sha1("|".join(values).encode("utf-8")).hexdigest()


def build_manifest(data_root: Path) -> Dict[str, Any]:
    layers = ["bronze", "silver", "gold", "features"]
    output: Dict[str, Any] = {"data_root": str(data_root), "layers": {}}

    for layer in layers:
        layer_dir = data_root / layer
        if not layer_dir.exists():
            output["layers"][layer] = {"exists": False, "files": []}
            continue
        files: List[Dict[str, Any]] = []
        for path in sorted(layer_dir.rglob("*.parquet")):
            schema = _safe_schema(path)
            files.append(
                {
                    "path": str(path.relative_to(data_root)),
                    "size_bytes": int(path.stat().st_size),
                    "rows": _safe_count(path),
                    "schema_hash": _hash(schema),
                    "schema_columns": schema,
                }
            )
        output["layers"][layer] = {
            "exists": True,
            "file_count": len(files),
            "total_size_bytes": sum(x["size_bytes"] for x in files),
            "files": files,
        }
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Build medallion manifest")
    parser.add_argument("--data-root", default="backend/etl/data")
    parser.add_argument(
        "--out", default="backend/etl/data/analysis/medallion_manifest.json"
    )
    args = parser.parse_args()

    data_root = Path(args.data_root)
    manifest = build_manifest(data_root)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Manifest written: {out}")


if __name__ == "__main__":
    main()

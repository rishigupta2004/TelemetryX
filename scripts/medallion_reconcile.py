from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict


def _index(manifest: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    idx: Dict[str, Dict[str, Any]] = {}
    for layer_name, layer in (manifest.get("layers") or {}).items():
        for f in layer.get("files", []):
            idx[f"{layer_name}:{f.get('path')}"] = f
    return idx


def reconcile(before: Dict[str, Any], after: Dict[str, Any]) -> Dict[str, Any]:
    bidx = _index(before)
    aidx = _index(after)
    added = sorted([k for k in aidx.keys() if k not in bidx])
    removed = sorted([k for k in bidx.keys() if k not in aidx])
    changed = []
    for key in sorted(set(bidx.keys()) & set(aidx.keys())):
        b = bidx[key]
        a = aidx[key]
        if b.get("rows") != a.get("rows") or b.get("schema_hash") != a.get(
            "schema_hash"
        ):
            changed.append(
                {
                    "key": key,
                    "rows_before": b.get("rows"),
                    "rows_after": a.get("rows"),
                    "schema_before": b.get("schema_hash"),
                    "schema_after": a.get("schema_hash"),
                }
            )
    return {
        "added_files": added,
        "removed_files": removed,
        "changed_files": changed,
        "removed_count": len(removed),
        "changed_count": len(changed),
        "added_count": len(added),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconcile medallion manifests")
    parser.add_argument("--before", required=True)
    parser.add_argument("--after", required=True)
    parser.add_argument(
        "--out", default="backend/etl/data/analysis/medallion_reconcile.json"
    )
    args = parser.parse_args()

    before = json.loads(Path(args.before).read_text(encoding="utf-8"))
    after = json.loads(Path(args.after).read_text(encoding="utf-8"))
    report = reconcile(before, after)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Reconcile report written: {out}")
    if report["removed_count"] > 0:
        raise SystemExit("Detected removed medallion files; aborting")


if __name__ == "__main__":
    main()

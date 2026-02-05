"""Audit feature coverage against silver data."""

from pathlib import Path
import argparse
import pandas as pd


FEATURES = [
    "lap",
    "tyre",
    "telemetry",
    "race_context",
    "comparison",
    "position",
    "overtakes",
    "traffic",
    "points",
]

SESSIONS = ["Q", "R", "S", "SS"]


def audit_year(year: int) -> pd.DataFrame:
    silver_root = Path("backend/etl/data/silver") / str(year)
    features_root = Path("backend/etl/data/features") / str(year)
    rows = []
    for race_dir in sorted([d for d in silver_root.iterdir() if d.is_dir()]):
        for session in SESSIONS:
            sdir = race_dir / session
            if not sdir.exists():
                continue
            row = {"year": year, "race_name": race_dir.name, "session": session}
            for feature in FEATURES:
                fpath = features_root / race_dir.name / session / f"{feature}_features.parquet"
                row[f"{feature}_exists"] = fpath.exists()
                if fpath.exists():
                    try:
                        row[f"{feature}_rows"] = len(pd.read_parquet(fpath))
                    except Exception:
                        row[f"{feature}_rows"] = None
                else:
                    row[f"{feature}_rows"] = 0
            rows.append(row)
    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame) -> pd.DataFrame:
    summary = []
    for feature in FEATURES:
        exists_col = f"{feature}_exists"
        rows_col = f"{feature}_rows"
        if exists_col not in df.columns:
            continue
        summary.append({
            "feature": feature,
            "missing_sessions": int((df[exists_col] == False).sum()),
            "empty_sessions": int(((df[exists_col] == True) & (df[rows_col] == 0)).sum()),
        })
    return pd.DataFrame(summary)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit feature coverage against silver data")
    parser.add_argument("--year", type=int, default=None)
    args = parser.parse_args()

    years = [args.year] if args.year else sorted([int(p.name) for p in Path("backend/etl/data/silver").iterdir() if p.is_dir()])
    out_dir = Path("backend/etl/data/analysis")
    out_dir.mkdir(parents=True, exist_ok=True)

    for year in years:
        df = audit_year(year)
        out_csv = out_dir / f"feature_coverage_{year}.csv"
        df.to_csv(out_csv, index=False)
        summary = summarize(df)
        summary.to_csv(out_dir / f"feature_coverage_{year}_summary.csv", index=False)
        print(f"{year}: coverage rows={len(df)} summary rows={len(summary)}")


if __name__ == "__main__":
    main()

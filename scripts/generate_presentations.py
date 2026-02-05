"""Generate presentations for features and ML outputs."""

import argparse
from features.reporting import generate_reports as generate_feature_reports
from ml.reporting import generate_clustering_reports, generate_strategy_reports


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate feature and ML presentations")
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--race", type=str, default=None)
    parser.add_argument("--session", type=str, default=None)
    parser.add_argument("--features", type=str, default="")
    parser.add_argument("--clusters", type=int, default=4)
    parser.add_argument("--simulations", type=int, default=100)
    parser.add_argument("--scope", type=str, default="both", choices=["race", "year", "both"])
    args = parser.parse_args()

    feature_list = [f.strip() for f in args.features.split(",") if f.strip()] if args.features else None
    generate_feature_reports(features=feature_list, year=args.year, race=args.race, session=args.session)
    generate_clustering_reports(year=args.year, race=args.race, session=args.session or "R", clusters=args.clusters, scope=args.scope)
    generate_strategy_reports(year=args.year, race=args.race, n_simulations=args.simulations, scope=args.scope)


if __name__ == "__main__":
    main()

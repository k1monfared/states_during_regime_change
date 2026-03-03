#!/usr/bin/env python3
"""
Test: raw-value/score coverage alignment.

For every country × indicator × year where a raw_value exists in the raw data,
there should be a corresponding 0–100 score in combined.json.

Exits 0 if all checks pass, 1 if any gaps are found.

Usage:
    python data/scripts/test_score_coverage.py
    python data/scripts/test_score_coverage.py --country iraq
    python data/scripts/test_score_coverage.py --verbose
"""

import argparse
import json
import sys
from pathlib import Path


def get_project_root():
    return Path(__file__).resolve().parent.parent.parent


def main():
    parser = argparse.ArgumentParser(description="Check raw_value ↔ combined score coverage.")
    parser.add_argument("--country", help="Test only this country ID")
    parser.add_argument("--verbose", action="store_true", help="Print every gap, not just summary")
    args = parser.parse_args()

    root = get_project_root()
    raw_dir = root / "docs" / "data" / "raw"
    combined_path = root / "docs" / "data" / "combined.json"

    # Load combined scores
    with open(combined_path) as f:
        combined = json.load(f)

    raw_files = sorted(raw_dir.glob("*.json"))
    if args.country:
        raw_files = [f for f in raw_files if f.stem == args.country]
        if not raw_files:
            print(f"ERROR: no raw file found for country '{args.country}'")
            sys.exit(1)

    gaps = []       # (country, dim, ind, year) where raw_value exists but score is missing
    present = 0     # years with both raw_value AND score
    raw_only = 0    # years where raw_value exists but score is absent
    score_without_raw = 0  # informational: years with score but no raw_value

    for raw_file in raw_files:
        country = raw_file.stem
        with open(raw_file) as f:
            raw_data = json.load(f)

        combined_country = combined.get(country, {})

        for dim, indicators in raw_data.items():
            if not isinstance(indicators, dict):
                continue
            for ind, year_entries in indicators.items():
                if not isinstance(year_entries, dict):
                    continue
                for year_str, entry in year_entries.items():
                    if not isinstance(entry, dict):
                        continue
                    has_raw = entry.get("raw_value") is not None
                    combined_year = combined_country.get(year_str, {})
                    combined_score = combined_year.get(dim, {}).get(ind)
                    has_score = combined_score is not None

                    if has_raw and has_score:
                        present += 1
                    elif has_raw and not has_score:
                        raw_only += 1
                        gaps.append((country, dim, ind, year_str))
                        if args.verbose:
                            print(f"  GAP  {country:20s} {dim}/{ind} {year_str}  raw={entry['raw_value']}")
                    elif not has_raw and has_score:
                        score_without_raw += 1

    # ── Summary ─────────────────────────────────────────────────────────────────
    print(f"\nRaw-value / score coverage check")
    print(f"  Countries checked: {len(raw_files)}")
    print(f"  Years with both raw_value AND score : {present}")
    print(f"  Years with raw_value but NO score   : {raw_only}")
    print(f"  Years with score but no raw_value   : {score_without_raw}")

    if gaps:
        print(f"\nFAIL — {len(gaps)} gap(s) found")
        if not args.verbose:
            # Show first 20
            for country, dim, ind, year in gaps[:20]:
                print(f"  {country:20s} {dim}/{ind} {year}")
            if len(gaps) > 20:
                print(f"  … and {len(gaps) - 20} more (run with --verbose to see all)")
        sys.exit(1)
    else:
        print("\nPASS — every raw_value has a corresponding score.")
        sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
verify.py — CLI tool for marking canonical series observations as human-verified.

Usage:
    python3 verify.py --series WB_SP.POP.TOTL --country iraq --year 2003 [--note "Cross-checked"]
    python3 verify.py --unverify --series WB_SP.POP.TOTL --country iraq --year 2003
    python3 verify.py --list --country iraq
    python3 verify.py --list --series WB_SP.POP.TOTL
    python3 verify.py --stats
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
VERIFICATION_FILE = ROOT / "data" / "verification.json"


# ── Helpers ────────────────────────────────────────────────────────────────────

def load_verification():
    if VERIFICATION_FILE.exists():
        with open(VERIFICATION_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_verification(data):
    with open(VERIFICATION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def make_key(series_id, country_id, year):
    return f"{series_id}/{country_id}/{year}"


# ── Commands ────────────────────────────────────────────────────────────────────

def cmd_verify(args, data):
    """Mark one observation as verified."""
    key = make_key(args.series, args.country, str(args.year))
    entry = {
        "verified": True,
        "verified_by": "human",
        "verified_date": str(date.today()),
        "note": args.note or "",
    }
    data[key] = entry
    save_verification(data)
    print(f"Verified: {key}")
    if args.note:
        print(f"  Note: {args.note}")


def cmd_unverify(args, data):
    """Remove verification for one observation."""
    key = make_key(args.series, args.country, str(args.year))
    if key in data:
        del data[key]
        save_verification(data)
        print(f"Unverified: {key}")
    else:
        print(f"Not found: {key}")


def cmd_list(args, data):
    """List verification records for a country or series."""
    filtered = {}
    for key, entry in data.items():
        parts = key.split("/", 2)
        if len(parts) != 3:
            continue
        sid, cid, year = parts

        if args.country and cid != args.country:
            continue
        if args.series and sid != args.series:
            continue
        filtered[key] = entry

    if not filtered:
        print("No verification records found for given filters.")
        return

    print(f"\nVerification records ({len(filtered)}):")
    print("-" * 70)
    for key, entry in sorted(filtered.items()):
        verified_str = "+" if entry.get("verified") else "-"
        date_str = entry.get("verified_date", "unknown")
        note_str = f"  [{entry['note']}]" if entry.get("note") else ""
        print(f"  {verified_str} {key} ({date_str}){note_str}")


def cmd_stats(data):
    """Print verification statistics."""
    total = len(data)
    verified = sum(1 for e in data.values() if e.get("verified"))

    by_series = {}
    by_country = {}
    for key, entry in data.items():
        parts = key.split("/", 2)
        if len(parts) != 3:
            continue
        sid, cid, _ = parts
        by_series[sid] = by_series.get(sid, 0) + 1
        by_country[cid] = by_country.get(cid, 0) + 1

    print(f"\nVerification Statistics")
    print("-" * 40)
    print(f"  Total records: {total}")
    print(f"  Verified:      {verified}")
    print(f"  Series with verifications:   {len(by_series)}")
    print(f"  Countries with verifications: {len(by_country)}")

    if by_country:
        print("\n  Top countries:")
        for cid, cnt in sorted(by_country.items(), key=lambda x: -x[1])[:10]:
            print(f"    {cid}: {cnt} verifications")

    if by_series:
        print("\n  Top series:")
        for sid, cnt in sorted(by_series.items(), key=lambda x: -x[1])[:10]:
            print(f"    {sid}: {cnt} verifications")


def cmd_bulk_verify(args, data):
    """Mark all available observations for a country as verified."""
    import csv
    import yaml

    DATA_CANONICAL = ROOT / "data" / "canonical"
    DATA_CONFIG = ROOT / "data" / "config"

    registry_path = DATA_CANONICAL / "registry.yaml"
    with open(registry_path, encoding="utf-8") as f:
        registry = yaml.safe_load(f)

    count = 0
    today = str(date.today())

    for series_id, reg_meta in registry.get("series", {}).items():
        if args.series and series_id != args.series:
            continue
        canonical_file = reg_meta.get("canonical_file", "")
        if not canonical_file:
            continue
        csv_path = ROOT / canonical_file
        if not csv_path.exists():
            continue

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cid = row.get("country_id", "")
                year = row.get("year", "")
                status = row.get("status", "")
                if status != "available":
                    continue
                if args.country and cid != args.country:
                    continue
                key = make_key(series_id, cid, year)
                if key not in data:  # Don't overwrite existing
                    data[key] = {
                        "verified": True,
                        "verified_by": "bulk",
                        "verified_date": today,
                        "note": args.note or "",
                    }
                    count += 1

    save_verification(data)
    print(f"Bulk verified {count} observations")


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CLI verification tool for canonical series")

    # Mutually exclusive commands
    cmd_group = parser.add_mutually_exclusive_group()
    cmd_group.add_argument("--unverify", action="store_true", help="Remove verification")
    cmd_group.add_argument("--list", action="store_true", help="List verifications")
    cmd_group.add_argument("--stats", action="store_true", help="Show statistics")
    cmd_group.add_argument("--bulk", action="store_true", help="Bulk verify available observations")

    # Filters
    parser.add_argument("--series", help="Series ID (e.g. WB_SP.POP.TOTL)")
    parser.add_argument("--country", help="Country ID (e.g. iraq)")
    parser.add_argument("--year", type=int, help="Year (e.g. 2003)")
    parser.add_argument("--note", help="Optional note for verification record")

    args = parser.parse_args()

    data = load_verification()

    if args.stats:
        cmd_stats(data)
        return

    if args.list:
        cmd_list(args, data)
        return

    if args.bulk:
        cmd_bulk_verify(args, data)
        return

    if args.unverify:
        if not all([args.series, args.country, args.year]):
            print("ERROR: --unverify requires --series, --country, and --year", file=sys.stderr)
            sys.exit(1)
        cmd_unverify(args, data)
        return

    # Default: verify
    if not all([args.series, args.country, args.year]):
        print("ERROR: verification requires --series, --country, and --year", file=sys.stderr)
        print("Use --help for usage information.")
        sys.exit(1)
    cmd_verify(args, data)


if __name__ == "__main__":
    main()

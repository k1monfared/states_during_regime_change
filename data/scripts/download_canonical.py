#!/usr/bin/env python3
"""
download_canonical.py — Bulk downloader for canonical series from WB, ILO, UCDP, UNHCR.

Usage:
    python3 download_canonical.py --source worldbank --priority 1
    python3 download_canonical.py --source ilo
    python3 download_canonical.py --series WB_SP.POP.TOTL
    python3 download_canonical.py --all
    python3 download_canonical.py --dry-run --source worldbank --priority 1

Flags:
    --source     worldbank | ilo | ucdp | acled | unhcr | vdem | imf | all
    --priority   1 | 2 | 3  (filter by priority level, default: all)
    --series     specific series ID (e.g. WB_SP.POP.TOTL)
    --countries  comma-separated country IDs (default: all 40)
    --force      re-download even if CSV exists
    --dry-run    show what would be downloaded without downloading
    --status     show download status summary
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

import yaml

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

# ── Paths ──────────────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
DATA_CONFIG = ROOT / "data" / "config"
DATA_CANONICAL = ROOT / "data" / "canonical"
DATA_CANONICAL_STATUS = DATA_CANONICAL / "status"

DATA_CANONICAL_STATUS.mkdir(parents=True, exist_ok=True)

# ── Load configs ──────────────────────────────────────────────────────────────────

def load_countries():
    with open(DATA_CONFIG / "countries.yaml", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    # Build iso3 mapping from country_id
    # World Bank uses ISO3 codes. We need a mapping.
    ISO3_MAP = {
        "iraq": "IRQ", "libya": "LBY", "egypt": "EGY", "syria": "SYR",
        "yemen": "YEM", "tunisia": "TUN", "afghanistan": "AFG", "iran": "IRN",
        "algeria": "DZA", "drc": "COD", "sierra_leone": "SLE", "liberia": "LBR",
        "cote_divoire": "CIV", "car": "CAF", "mali": "MLI", "sudan": "SDN",
        "burkina_faso": "BFA", "ethiopia": "ETH", "south_sudan": "SSD",
        "south_africa": "ZAF", "ghana": "GHA", "senegal": "SEN", "kenya": "KEN",
        "gambia": "GMB", "malawi": "MWI", "serbia": "SRB", "georgia": "GEO",
        "kyrgyzstan": "KGZ", "ukraine": "UKR", "armenia": "ARM", "croatia": "HRV",
        "slovakia": "SVK", "indonesia": "IDN", "nepal": "NPL", "myanmar": "MMR",
        "east_timor": "TLS", "malaysia": "MYS", "venezuela": "VEN", "peru": "PER",
        "mexico": "MEX",
    }
    result = {}
    for country_id, meta in raw.items():
        iso3 = ISO3_MAP.get(country_id)
        if iso3:
            result[country_id] = {"iso3": iso3, "display_name": meta.get("display_name", country_id)}
    return result


def load_fundamental_metrics():
    with open(DATA_CONFIG / "fundamental_metrics.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_registry():
    registry_path = DATA_CANONICAL / "registry.yaml"
    with open(registry_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_registry(registry):
    registry_path = DATA_CANONICAL / "registry.yaml"
    registry["meta"]["last_updated"] = str(date.today())
    with open(registry_path, "w", encoding="utf-8") as f:
        yaml.dump(registry, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


# ── Status log helpers ───────────────────────────────────────────────────────────

def load_series_status(series_id):
    status_path = DATA_CANONICAL_STATUS / f"{series_id}.yaml"
    if status_path.exists():
        with open(status_path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def save_series_status(series_id, status):
    status_path = DATA_CANONICAL_STATUS / f"{series_id}.yaml"
    with open(status_path, "w", encoding="utf-8") as f:
        yaml.dump(status, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


# ── CSV helpers ────────────────────────────────────────────────────────────────────

CSV_HEADER = ["iso3", "country_id", "year", "value", "status", "download_date", "notes"]


def read_csv(csv_path):
    """Returns dict: {(iso3, year): row}"""
    if not csv_path.exists():
        return {}
    result = {}
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row["iso3"], row["year"])
            result[key] = row
    return result


def write_csv(csv_path, rows):
    """rows: list of dicts with CSV_HEADER keys"""
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADER)
        writer.writeheader()
        writer.writerows(rows)


# ── World Bank downloader ────────────────────────────────────────────────────────

WB_BASE = "https://api.worldbank.org/v2/country/{iso3s}/indicator/{code}"


def download_worldbank(series_id, wb_code, countries, csv_path, force=False):
    """Download a WB indicator for all countries. Returns (rows, status_info)."""
    today = str(date.today())
    existing = read_csv(csv_path) if not force else {}

    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}
    all_iso3s = [v["iso3"] for v in countries.values()]

    # Batch: WB API supports up to ~200 countries in one call
    iso3_batch = ";".join(all_iso3s)
    url = WB_BASE.format(iso3s=iso3_batch, code=wb_code)
    params = {"format": "json", "per_page": "20000", "mrv": "66"}

    try:
        resp = requests.get(url, params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  ERROR downloading {series_id}: {e}", file=sys.stderr)
        return [], {"error": str(e), "last_attempt": today}

    if not data or len(data) < 2 or not data[1]:
        return [], {"error": "Empty response from WB API", "last_attempt": today}

    # Parse WB response
    records = data[1]
    rows_by_key = {}

    for rec in records:
        iso3 = rec.get("countryiso3code", "")
        if not iso3 or iso3 not in iso3_to_id:
            continue
        country_id = iso3_to_id[iso3]
        year = str(rec.get("date", ""))
        val = rec.get("value")

        key = (iso3, year)
        status = "available" if val is not None else "source_gap"
        value_str = str(val) if val is not None else ""

        rows_by_key[key] = {
            "iso3": iso3,
            "country_id": country_id,
            "year": year,
            "value": value_str,
            "status": status,
            "download_date": today,
            "notes": "",
        }

    # Merge with existing (prefer new download)
    for key, row in existing.items():
        if key not in rows_by_key:
            rows_by_key[key] = row

    # Check which countries have no data at all
    countries_with_data = set(r["country_id"] for r in rows_by_key.values() if r["status"] == "available")
    countries_not_in_source = [
        cid for cid in countries if cid not in set(r["country_id"] for r in rows_by_key.values())
    ]

    rows = sorted(rows_by_key.values(), key=lambda r: (r["iso3"], r["year"]))

    status_info = {
        "series_id": series_id,
        "last_download": today,
        "countries_attempted": len(countries),
        "countries_available": len(countries_with_data),
        "countries_not_in_source": countries_not_in_source,
        "download_errors": [],
        "plan": {},
    }

    return rows, status_info


# ── UNHCR downloader ───────────────────────────────────────────────────────────────

UNHCR_ENDPOINTS = {
    "REF_ORIGIN": "https://data.unhcr.org/population/get/asylum-seekers?yearFrom=1990&yearTo=2024&coo_all=1&download=true",
    "REF_ASYLUM": "https://data.unhcr.org/population/get/refugees?yearFrom=1990&yearTo=2024&coa_all=1&download=true",
    "IDP_TOTAL": "https://data.unhcr.org/population/get/idps?yearFrom=1990&yearTo=2024&coo_all=1&download=true",
}


def download_unhcr(series_id, sub_code, countries, csv_path, force=False):
    """Placeholder: UNHCR API requires authentication for bulk. Returns stub rows."""
    today = str(date.today())
    print(f"  NOTE: UNHCR {sub_code} requires manual download from data.unhcr.org/api/v4/", file=sys.stderr)
    print(f"  Generating stub status entry for {series_id}", file=sys.stderr)

    status_info = {
        "series_id": series_id,
        "last_download": None,
        "countries_attempted": 0,
        "countries_available": 0,
        "countries_not_in_source": [],
        "download_errors": ["UNHCR requires authenticated API access or manual CSV download"],
        "plan": {
            "all": "Download manually from https://data.unhcr.org/en/dataviz/index and save to " + str(csv_path)
        },
    }
    return [], status_info


# ── Main dispatch ──────────────────────────────────────────────────────────────────

def get_series_to_download(args, metrics, registry):
    """Returns list of (series_id, series_meta) tuples to process."""
    series_list = []

    if args.series:
        # Single series by ID
        for sid in args.series.split(","):
            sid = sid.strip()
            if sid in registry["series"]:
                series_list.append((sid, registry["series"][sid]))
            else:
                print(f"WARNING: Series {sid} not found in registry", file=sys.stderr)
        return series_list

    # Collect from fundamental_metrics catalog
    for cat_id, cat in metrics.get("categories", {}).items():
        for series_id, series_meta in cat.get("series", {}).items():
            src = series_meta.get("source", "")
            priority = series_meta.get("priority", 3)

            # Filter by source
            if args.source and args.source != "all":
                src_map = {
                    "worldbank": "world_bank",
                    "ilo": "ilo",
                    "ucdp": "ucdp",
                    "acled": "acled",
                    "unhcr": "unhcr",
                    "vdem": "vdem",
                    "imf": "imf",
                }
                expected_src = src_map.get(args.source, args.source)
                if src != expected_src:
                    continue

            # Filter by priority
            if args.priority and priority > args.priority:
                continue

            if series_id in registry["series"]:
                series_list.append((series_id, registry["series"][series_id]))

    return series_list


def print_status(registry, metrics):
    """Print download status summary."""
    total = len(registry["series"])
    downloaded = sum(1 for s in registry["series"].values() if s.get("downloaded"))
    print(f"\nCanonical Series Status: {downloaded}/{total} downloaded")
    print("-" * 60)

    by_source = {}
    for sid, meta in registry["series"].items():
        src = meta.get("source", "unknown")
        if src not in by_source:
            by_source[src] = {"total": 0, "downloaded": 0}
        by_source[src]["total"] += 1
        if meta.get("downloaded"):
            by_source[src]["downloaded"] += 1

    for src, counts in sorted(by_source.items()):
        pct = counts["downloaded"] / counts["total"] * 100 if counts["total"] else 0
        d = counts["downloaded"]
        t = counts["total"]
        print(f"  {src:20s}: {d:3d}/{t:3d} ({pct:.0f}%)")


def main():
    parser = argparse.ArgumentParser(description="Download canonical series data")
    parser.add_argument("--source", help="Source to download: worldbank|ilo|ucdp|acled|unhcr|vdem|imf|all")
    parser.add_argument("--priority", type=int, choices=[1, 2, 3], help="Max priority level to download")
    parser.add_argument("--series", help="Specific series ID(s), comma-separated")
    parser.add_argument("--countries", help="Comma-separated country IDs (default: all)")
    parser.add_argument("--force", action="store_true", help="Re-download even if CSV exists")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be downloaded")
    parser.add_argument("--status", action="store_true", help="Show download status and exit")
    parser.add_argument("--all", action="store_true", help="Download all series")

    args = parser.parse_args()

    if not args.source and not args.series and not args.all and not args.status:
        parser.print_help()
        sys.exit(0)

    countries = load_countries()
    metrics = load_fundamental_metrics()
    registry = load_registry()

    if args.status:
        print_status(registry, metrics)
        return

    # Filter countries if specified
    if args.countries:
        requested = set(args.countries.split(","))
        countries = {k: v for k, v in countries.items() if k in requested}
        if not countries:
            print(f"ERROR: No valid country IDs in: {args.countries}", file=sys.stderr)
            sys.exit(1)

    # Set source for --all
    if args.all:
        args.source = "all"

    series_to_download = get_series_to_download(args, metrics, registry)

    if not series_to_download:
        print("No series matched the given filters.")
        return

    print(f"\nSeries to download: {len(series_to_download)}")
    for sid, _ in series_to_download:
        print(f"  {sid}")

    if args.dry_run:
        print("\n[dry-run] No files written.")
        return

    # Download each series
    downloaded_count = 0
    error_count = 0

    for series_id, reg_meta in series_to_download:
        # Find the series in fundamental_metrics
        series_meta = None
        for cat in metrics.get("categories", {}).values():
            if series_id in cat.get("series", {}):
                series_meta = cat["series"][series_id]
                break

        if not series_meta:
            print(f"  WARNING: {series_id} not found in fundamental_metrics.yaml", file=sys.stderr)
            continue

        source = series_meta.get("source", "")
        csv_path = ROOT / reg_meta["canonical_file"]

        # Skip if already downloaded and not forcing
        if not args.force and csv_path.exists():
            print(f"  SKIP {series_id} (already downloaded, use --force to re-download)")
            continue

        print(f"  Downloading {series_id} ({source})...")

        rows = []
        status_info = {}

        if source == "world_bank":
            wb_code = series_meta.get("source_code", series_id.replace("WB_", ""))
            rows, status_info = download_worldbank(
                series_id, wb_code, countries, csv_path, force=args.force
            )
        elif source == "unhcr":
            sub_code = series_meta.get("source_code", "")
            rows, status_info = download_unhcr(series_id, sub_code, countries, csv_path, force=args.force)
        else:
            src_note = f"  NOTE: Source '{source}' requires manual download. See fundamental_metrics.yaml for URL."
            print(src_note)
            url_val = series_meta.get("url", "see fundamental_metrics.yaml")
            status_info = {
                "series_id": series_id,
                "last_download": None,
                "download_errors": [f"Source '{source}' not yet automated. Download manually."],
                "plan": {"all": f"Download from {url_val}"},
            }

        # Write CSV if we have rows
        if rows:
            write_csv(csv_path, rows)
            available = sum(1 for r in rows if r["status"] == "available")
            print(f"    -> {csv_path.name}: {len(rows)} rows, {available} available")
            downloaded_count += 1

            # Update registry
            registry["series"][series_id]["downloaded"] = True
            registry["series"][series_id]["last_download"] = str(date.today())
        else:
            if status_info.get("download_errors"):
                error_count += 1
            else:
                print(f"    -> No data rows returned for {series_id}")

        # Save status log
        save_series_status(series_id, status_info)

        # Small delay to avoid rate limiting
        time.sleep(0.3)

    # Save updated registry
    save_registry(registry)

    print(f"\nDone. Downloaded: {downloaded_count}, Errors/manual: {error_count}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
build_coverage.py — Generate coverage.json and per-country fundamental JSON files.

Reads all canonical CSVs → generates:
  docs/data/coverage.json          — full coverage matrix (country × series × year)
  docs/data/fundamental.json       — flat value lookup: country → series → year → value
  docs/data/raw/<country>_fundamental.json — per-country fundamental series detail

Usage:
    python3 build_coverage.py
    python3 build_coverage.py --country iraq
    python3 build_coverage.py --summary  (print coverage summary only)
"""

import argparse
import csv
import json
import os
import sys
from datetime import date
from pathlib import Path

import yaml

# ── Paths ──────────────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
DATA_CONFIG = ROOT / "data" / "config"
DATA_CANONICAL = ROOT / "data" / "canonical"
DATA_CANONICAL_STATUS = DATA_CANONICAL / "status"
DOCS_DATA = ROOT / "docs" / "data"
DOCS_DATA_RAW = DOCS_DATA / "raw"
VERIFICATION_FILE = ROOT / "data" / "verification.json"

DOCS_DATA.mkdir(parents=True, exist_ok=True)
DOCS_DATA_RAW.mkdir(parents=True, exist_ok=True)


# ── Loaders ──────────────────────────────────────────────────────────────────────────

def load_countries():
    with open(DATA_CONFIG / "countries.yaml", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
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
    for cid, meta in raw.items():
        result[cid] = {
            "display_name": meta.get("display_name", cid),
            "iso3": ISO3_MAP.get(cid, ""),
        }
    return result


def load_registry():
    with open(DATA_CANONICAL / "registry.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_fundamental_metrics():
    with open(DATA_CONFIG / "fundamental_metrics.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_verification():
    if VERIFICATION_FILE.exists():
        with open(VERIFICATION_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


# ── Coverage builder ───────────────────────────────────────────────────────────────

def build_series_info(metrics):
    """Build flat dict: series_id → {name, category, unit}"""
    info = {}
    for cat_id, cat in metrics.get("categories", {}).items():
        for sid, smeta in cat.get("series", {}).items():
            info[sid] = {
                "name": smeta.get("name", sid),
                "category": cat_id,
                "unit": smeta.get("unit", ""),
                "priority": smeta.get("priority", 3),
                "used_by": smeta.get("used_by", []),
            }
    return info


def read_canonical_csv(csv_path):
    """Returns list of row dicts from a canonical CSV."""
    if not csv_path.exists():
        return []
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def build_coverage(countries, registry, series_info, verification, country_filter=None):
    """
    Returns:
        coverage: {series_id: {country_id: {year: {status, value, verified}}}}
        summary: {country_id: {total_obs, available, source_gap, ...}}
        fundamental: {country_id: {series_id: {year: value}}}
    """
    coverage = {}
    summary = {}
    fundamental = {}

    # Initialize
    all_countries = list(countries.keys()) if not country_filter else [country_filter]

    for cid in all_countries:
        summary[cid] = {
            "total_obs": 0,
            "available": 0,
            "source_gap": 0,
            "not_in_source": 0,
            "download_error": 0,
            "estimated": 0,
            "pre_coverage": 0,
            "coverage_pct": 0.0,
        }
        fundamental[cid] = {}

    for series_id, reg_meta in registry.get("series", {}).items():
        if series_id not in series_info:
            continue

        canonical_file = reg_meta.get("canonical_file", "")
        csv_path = ROOT / canonical_file if canonical_file else None

        rows = read_canonical_csv(csv_path) if csv_path else []

        if series_id not in coverage:
            coverage[series_id] = {}

        for row in rows:
            cid = row.get("country_id", "")
            if not cid or (country_filter and cid != country_filter):
                continue
            if cid not in countries:
                continue

            year = row.get("year", "")
            status = row.get("status", "source_gap")
            value_str = row.get("value", "")
            dl_date = row.get("download_date", "")

            # Parse value
            value = None
            if value_str and value_str.strip():
                try:
                    value = float(value_str)
                except ValueError:
                    pass

            # Check verification
            vkey = f"{series_id}/{cid}/{year}"
            verified = verification.get(vkey, {}).get("verified", False)

            # Build coverage entry
            if cid not in coverage[series_id]:
                coverage[series_id][cid] = {}
            coverage[series_id][cid][year] = {
                "status": status,
                "value": value,
                "verified": verified,
                "download_date": dl_date,
            }

            # Update summary
            if cid in summary:
                summary[cid]["total_obs"] += 1
                if status in summary[cid]:
                    summary[cid][status] += 1

            # Build fundamental lookup (only available values)
            if status == "available" and value is not None:
                if cid in fundamental:
                    if series_id not in fundamental[cid]:
                        fundamental[cid][series_id] = {}
                    fundamental[cid][series_id][year] = value

    # Compute coverage percentages
    for cid in all_countries:
        s = summary[cid]
        if s["total_obs"] > 0:
            s["coverage_pct"] = round(s["available"] / s["total_obs"] * 100, 1)

    return coverage, summary, fundamental


def build_coverage_json(coverage, summary, series_info, generated_date):
    """Build the full coverage.json structure."""
    # Count total observations
    total_obs = sum(s["total_obs"] for s in summary.values())
    total_available = sum(s["available"] for s in summary.values())
    total_verified = 0
    for sid_cov in coverage.values():
        for cid_cov in sid_cov.values():
            for yr_data in cid_cov.values():
                if yr_data.get("verified"):
                    total_verified += 1

    coverage_pct = round(total_available / total_obs * 100, 1) if total_obs > 0 else 0.0
    verified_pct = round(total_verified / max(total_available, 1) * 100, 1)

    return {
        "meta": {
            "generated": generated_date,
            "series_count": len(series_info),
            "countries": 40,
            "total_obs": total_obs,
            "total_available": total_available,
            "total_verified": total_verified,
            "coverage_pct": coverage_pct,
            "verified_pct": verified_pct,
        },
        "series": {
            sid: {
                "name": info["name"],
                "category": info["category"],
                "unit": info["unit"],
                "priority": info["priority"],
                "used_by": info["used_by"],
                "coverage": coverage.get(sid, {}),
            }
            for sid, info in series_info.items()
        },
        "summary": summary,
    }


def main():
    parser = argparse.ArgumentParser(description="Build coverage index and fundamental data files")
    parser.add_argument("--country", help="Only process this country ID")
    parser.add_argument("--summary", action="store_true", help="Print summary and exit")
    args = parser.parse_args()

    print("Loading config...")
    countries = load_countries()
    registry = load_registry()
    metrics = load_fundamental_metrics()
    verification = load_verification()
    series_info = build_series_info(metrics)

    today = str(date.today())

    print(f"Building coverage ({len(series_info)} series, {len(countries)} countries)...")
    coverage, summary, fundamental = build_coverage(
        countries, registry, series_info, verification,
        country_filter=args.country
    )

    if args.summary:
        # Print summary only
        print(f"\nCoverage Summary ({today})")
        print("-" * 60)
        for cid, s in sorted(summary.items(), key=lambda x: -x[1]["coverage_pct"]):
            name = countries[cid]["display_name"]
            print(f"  {name:35s}: {s['available']:4d}/{s['total_obs']:4d} ({s['coverage_pct']:.1f}%)")
        return

    # Write coverage.json
    print("Writing coverage.json...")
    coverage_data = build_coverage_json(coverage, summary, series_info, today)
    out_path = DOCS_DATA / "coverage.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(coverage_data, f, separators=(",", ":"), ensure_ascii=False)
    size_kb = out_path.stat().st_size / 1024
    print(f"  -> {out_path} ({size_kb:.0f} KB)")

    # Write fundamental.json (flat value lookup)
    print("Writing fundamental.json...")
    out_path = DOCS_DATA / "fundamental.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fundamental, f, separators=(",", ":"), ensure_ascii=False)
    size_kb = out_path.stat().st_size / 1024
    print(f"  -> {out_path} ({size_kb:.0f} KB)")

    # Write per-country fundamental JSON files
    print("Writing per-country fundamental files...")
    ok = 0
    for cid, cov_data in fundamental.items():
        if not cov_data:
            continue
        out_path = DOCS_DATA_RAW / f"{cid}_fundamental.json"
        country_meta = countries[cid]
        output = {
            "country_id": cid,
            "display_name": country_meta["display_name"],
            "generated": today,
            "series": {},
        }
        for sid, years in cov_data.items():
            info = series_info.get(sid, {})
            output["series"][sid] = {
                "name": info.get("name", sid),
                "category": info.get("category", ""),
                "unit": info.get("unit", ""),
                "values": years,
            }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, separators=(",", ":"), ensure_ascii=False)
        ok += 1
    print(f"  -> {ok} country fundamental files written")

    # Print brief summary
    total_avail = coverage_data["meta"]["total_available"]
    total_obs = coverage_data["meta"]["total_obs"]
    cov_pct = coverage_data["meta"]["coverage_pct"]
    print(f"\nCoverage: {total_avail}/{total_obs} ({cov_pct}%) observations available")
    print("Done.")


if __name__ == "__main__":
    main()

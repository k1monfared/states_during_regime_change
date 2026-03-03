#!/usr/bin/env python3
"""
export_web.py — Convert raw YAML/CSV data to browser-ready JSON files in docs/data/

Outputs:
  docs/data/combined.json     — indexed: country → year → dimension → indicator → score
  docs/data/countries.json    — metadata + precomputed groups + year arrays
  docs/data/indicators.json   — flat ordered list of all plottable metrics
  docs/data/definitions.json  — source definitions for all 20 indicators
  docs/data/raw/<country>.json — per-country qualitative data
"""

import csv
import json
import os
import sys
from pathlib import Path

import yaml

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = ROOT / "data" / "raw"
DATA_CONFIG = ROOT / "data" / "config"
DATA_DERIVED = ROOT / "data" / "derived"
DOCS_DATA = ROOT / "docs" / "data"
DOCS_DATA_RAW = DOCS_DATA / "raw"

DOCS_DATA.mkdir(parents=True, exist_ok=True)
DOCS_DATA_RAW.mkdir(parents=True, exist_ok=True)


# ── 1. combined.json ───────────────────────────────────────────────────────────

def build_combined():
    """
    Read data/derived/combined.csv and restructure as:
      { country: { year: { dimension: { indicator: score, _score: ... }, _composite: ... } } }
    """
    csv_path = DATA_DERIVED / "combined.csv"
    result = {}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            country = row["country"]
            year = row["year"]
            dimension = row["dimension"]
            indicator = row["indicator"]
            score_str = row["score"]

            # Parse score (may be empty)
            score = None
            if score_str and score_str.strip():
                try:
                    score = float(score_str)
                except ValueError:
                    score = None

            # Build nested dict
            if country not in result:
                result[country] = {}
            if year not in result[country]:
                result[country][year] = {}

            if dimension == "_composite" and indicator == "_composite_score":
                result[country][year]["_composite"] = score
            elif indicator == "_dimension_score":
                if dimension not in result[country][year]:
                    result[country][year][dimension] = {}
                result[country][year][dimension]["_score"] = score
            else:
                if dimension not in result[country][year]:
                    result[country][year][dimension] = {}
                result[country][year][dimension][indicator] = score
                # Store metadata for overlay computations
                if "_meta" not in result[country][year][dimension]:
                    result[country][year][dimension]["_meta"] = {}
                result[country][year][dimension]["_meta"][indicator] = {
                    "st": row["source_type"],   # "qualitative" | "quantitative" | ""
                    "ds": row["data_status"],   # "complete" | "partial" | "unavailable" | "missing"
                }

    return result


# ── 2. countries.json ──────────────────────────────────────────────────────────

def build_countries(combined):
    """
    Read data/config/countries.yaml, add year arrays from combined data,
    and precompute groups.
    """
    countries_yaml_path = DATA_CONFIG / "countries.yaml"
    with open(countries_yaml_path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    result = {}
    by_region = {}
    by_category = {}

    for country_id, meta in raw.items():
        # Year array: sorted list of years present in combined data
        years = sorted([int(y) for y in combined.get(country_id, {}).keys()])

        entry = {
            "display_name": meta.get("display_name", country_id),
            "region": meta.get("region", "unknown"),
            "category": meta.get("category", "unknown"),
            "regime_change_years": meta.get("regime_change_years", []),
            "notes": meta.get("notes", ""),
            "years": years,
        }

        # Optional time_range override
        if "time_range" in meta:
            entry["time_range"] = meta["time_range"]

        result[country_id] = entry

        # Accumulate groups
        region = entry["region"]
        if region not in by_region:
            by_region[region] = []
        by_region[region].append(country_id)

        category = entry["category"]
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(country_id)

    result["_groups"] = {
        "by_region": by_region,
        "by_category": by_category,
    }

    return result


# ── 3. indicators.json ─────────────────────────────────────────────────────────

DIMENSION_ORDER = ["political", "economic", "international", "transparency", "population_mobility", "social"]
DIMENSION_LABELS = {
    "political": "Political",
    "economic": "Economic",
    "international": "International",
    "transparency": "Transparency",
    "population_mobility": "Population Mobility",
    "social": "Social & Human Dev.",
}
INDICATOR_LABELS = {
    "territorial_control": "Territorial Control",
    "political_violence": "Political Violence",
    "institutional_functioning": "Institutional Functioning",
    "civil_liberties": "Civil Liberties",
    "elite_cohesion": "Elite Cohesion",
    "military_expenditure": "Military Expenditure",
    "political_stability": "Political Stability",
    "government_effectiveness": "Gov't Effectiveness",
    "gdp_per_capita": "GDP per Capita",
    "inflation": "Inflation",
    "unemployment": "Unemployment",
    "trade_openness": "Trade Openness",
    "fiscal_health": "Fiscal Health",
    "natural_resource_rents": "Resource Rents",
    "youth_unemployment": "Youth Unemployment",
    "gini": "Inequality (Gini)",
    "neet_rate": "NEET Rate",
    "gini_adjusted_gdp_per_capita": "Adj. GDP/Capita (Gini)",
    "sanctions": "Sanctions",
    "diplomatic_integration": "Diplomatic Integration",
    "foreign_military": "Foreign Military",
    "fdi": "FDI",
    "refugee_flows": "Refugee Flows",
    "budget_transparency": "Budget Transparency",
    "press_freedom": "Press Freedom",
    "statistical_transparency": "Statistical Transparency",
    "legal_transparency": "Legal Transparency",
    "extractive_transparency": "Extractive Transparency",
    "control_of_corruption": "Control of Corruption",
    "net_migration": "Net Migration",
    "remittances": "Remittances",
    "life_expectancy": "Life Expectancy",
    "infant_mortality": "Infant Mortality",
    "internet_users": "Internet Users",
    "health_expenditure": "Health Expenditure",
    "education_expenditure": "Education Expenditure",
    "poverty_rate": "Poverty Rate ($2.15/day)",
    "hdi": "Human Dev. Index (HDI)",
    "gini_adjusted_gdp_per_capita_ppp": "Adj. GDP/Capita PPP (Gini)",
    "export_diversification": "Export Diversification",
    "non_resource_export_share": "Non-Resource Exports",
}


def build_indicators():
    """
    Build flat ordered list: composite → dimension scores → individual indicators.
    """
    indicators_yaml_path = DATA_CONFIG / "indicators.yaml"
    with open(indicators_yaml_path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    entries = [
        {"id": "composite", "label": "Composite Score", "type": "composite"},
    ]

    for dim in DIMENSION_ORDER:
        entries.append({
            "id": dim,
            "label": DIMENSION_LABELS[dim],
            "type": "dimension",
            "dimension": dim,
        })
        if dim in raw:
            for indicator_id in raw[dim].keys():
                label = INDICATOR_LABELS.get(indicator_id, indicator_id.replace("_", " ").title())
                indicator_meta = raw[dim][indicator_id]
                entry = {
                    "id": f"{dim}/{indicator_id}",
                    "label": label,
                    "type": "indicator",
                    "dimension": dim,
                    "description": indicator_meta.get("description", ""),
                    "unit": indicator_meta.get("unit", ""),
                }
                entries.append(entry)

    return entries


# ── 4. definitions.json ────────────────────────────────────────────────────────

def build_definitions():
    """
    Read data/config/source_definitions.yaml and produce a flat dict keyed by
    "dimension/indicator_id" for easy lookup in the browser.
    """
    defs_path = DATA_CONFIG / "source_definitions.yaml"
    with open(defs_path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    result = {}
    for dimension, indicators in raw.items():
        for indicator_id, defn in indicators.items():
            key = f"{dimension}/{indicator_id}"
            entry = dict(defn)
            entry["id"] = key
            entry["dimension"] = dimension
            result[key] = entry

    return result


# ── 5. raw/<country>.json ──────────────────────────────────────────────────────

def build_country_raw(country_id):
    """
    Read all YAML files for a country and combine into structured JSON.
    Returns dict or None if country directory not found.
    """
    country_dir = DATA_RAW / country_id
    if not country_dir.exists():
        return None

    result = {}

    for dimension_dir in sorted(country_dir.iterdir()):
        if not dimension_dir.is_dir():
            continue
        dimension_name = dimension_dir.name
        result[dimension_name] = {}

        for yaml_file in sorted(dimension_dir.glob("*.yaml")):
            indicator_name = yaml_file.stem
            try:
                with open(yaml_file, encoding="utf-8") as f:
                    data = yaml.safe_load(f)
            except Exception as e:
                print(f"  Warning: could not read {yaml_file}: {e}", file=sys.stderr)
                continue

            if data is None:
                continue

            years_data = data.get("years", {})
            if not years_data:
                continue

            indicator_entry = {}
            for year, year_data in years_data.items():
                if year_data is None:
                    continue

                year_str = str(year)
                entry = {
                    "status": year_data.get("data_status", "unknown"),
                }

                # Qualitative data
                qual = year_data.get("qualitative", {})
                if qual:
                    if qual.get("assessment"):
                        entry["assessment"] = qual["assessment"].strip()
                    if qual.get("confidence"):
                        entry["confidence"] = qual["confidence"]
                    if qual.get("features"):
                        entry["features"] = qual["features"]
                    sources = qual.get("sources", [])
                    if sources:
                        entry["sources"] = [
                            {
                                "citation": s.get("citation", ""),
                                "type": s.get("type", ""),
                            }
                            for s in sources
                            if s
                        ]

                # Quantitative value (for reference)
                quant = year_data.get("quantitative", {})
                if quant and quant.get("value") is not None:
                    entry["raw_value"] = quant["value"]
                    entry["unit"] = quant.get("unit", "")

                indicator_entry[year_str] = entry

            result[dimension_name][indicator_name] = indicator_entry

    return result


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("Building combined.json...")
    combined = build_combined()
    out_path = DOCS_DATA / "combined.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(combined, f, separators=(",", ":"))
    size_kb = out_path.stat().st_size / 1024
    country_count = len(combined)
    print(f"  → {out_path} ({size_kb:.0f} KB, {country_count} countries)")

    print("Building countries.json...")
    countries = build_countries(combined)
    out_path = DOCS_DATA / "countries.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(countries, f, indent=2, ensure_ascii=False)
    print(f"  → {out_path}")

    print("Building indicators.json...")
    indicators = build_indicators()
    out_path = DOCS_DATA / "indicators.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(indicators, f, indent=2)
    print(f"  → {out_path} ({len(indicators)} entries)")

    print("Building definitions.json...")
    definitions = build_definitions()
    out_path = DOCS_DATA / "definitions.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(definitions, f, indent=2, ensure_ascii=False)
    print(f"  → {out_path} ({len(definitions)} indicator definitions)")

    print("Building per-country raw JSON files...")
    country_ids = [k for k in countries.keys() if not k.startswith("_")]
    ok = 0
    skip = 0
    for country_id in sorted(country_ids):
        raw_data = build_country_raw(country_id)
        if raw_data is None:
            print(f"  Skipping {country_id} (no raw dir)", file=sys.stderr)
            skip += 1
            continue
        out_path = DOCS_DATA_RAW / f"{country_id}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, separators=(",", ":"), ensure_ascii=False)
        ok += 1

    print(f"  → {ok} country files written, {skip} skipped")
    print("Done.")


if __name__ == "__main__":
    main()

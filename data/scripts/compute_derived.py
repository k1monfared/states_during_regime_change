#!/usr/bin/env python3
"""
compute_derived.py — Auto-fill calculated_value in YAML files from canonical series.

For each indicator YAML with formula + components referencing canonical series
where all components are available in canonical CSVs:
1. Read component values from canonical CSVs
2. Evaluate formula
3. Write quantitative.calculated_value to YAML
4. If value is null: also set value + value_source: calculated

Usage:
    python3 compute_derived.py
    python3 compute_derived.py --country iraq
    python3 compute_derived.py --dry-run
    python3 compute_derived.py --country iraq --indicator economic/unemployment
"""

import argparse
import csv
import sys
from pathlib import Path

import yaml

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = ROOT / "data" / "raw"
DATA_CONFIG = ROOT / "data" / "config"
DATA_CANONICAL = ROOT / "data" / "canonical"

# ── Loaders ────────────────────────────────────────────────────────────────────

def load_countries():
    with open(DATA_CONFIG / "countries.yaml", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return list(raw.keys())


def load_registry():
    with open(DATA_CANONICAL / "registry.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_canonical_values(series_id, registry):
    """
    Load all available values from a canonical CSV.
    Returns dict: {country_id: {year: float}}
    """
    if series_id not in registry.get("series", {}):
        return {}
    canonical_file = registry["series"][series_id].get("canonical_file", "")
    if not canonical_file:
        return {}
    csv_path = ROOT / canonical_file
    if not csv_path.exists():
        return {}

    result = {}
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cid = row.get("country_id", "")
            year = row.get("year", "")
            status = row.get("status", "")
            val_str = row.get("value", "")
            if status != "available" or not val_str:
                continue
            try:
                val = float(val_str)
            except ValueError:
                continue
            if cid not in result:
                result[cid] = {}
            result[cid][year] = val
    return result


# ── Formula evaluators ─────────────────────────────────────────────────────────

KNOWN_FORMULAS = {
    "unemployment_rate": lambda v: (v["unemployed"] / v["labor_force"] * 100)
        if v.get("labor_force") and v["labor_force"] > 0 else None,

    "trade_openness": lambda v: ((v["exports"] + v["imports"]) / v["gdp"] * 100)
        if v.get("gdp") and v["gdp"] > 0 else None,

    "gdp_per_capita": lambda v: v["gdp_usd"] / v["population"]
        if v.get("population") and v["population"] > 0 else None,

    "gini_adjusted_gdp_per_capita": lambda v: v["gdp_pc"] * (1 - v["gini"] / 100)
        if v.get("gdp_pc") is not None and v.get("gini") is not None else None,

    "gini_adjusted_gdp_per_capita_ppp": lambda v: v["gdp_pc_ppp"] * (1 - v["gini"] / 100)
        if v.get("gdp_pc_ppp") is not None and v.get("gini") is not None else None,

    "refugee_flows_per_1000": lambda v: v["refugees_origin"] / v["population"] * 1000
        if v.get("population") and v["population"] > 0 else None,

    "natural_resource_rents": lambda v: (
        (v.get("oil_rents") or 0) +
        (v.get("gas_rents") or 0) +
        (v.get("coal_rents") or 0) +
        (v.get("mineral_rents") or 0) +
        (v.get("forest_rents") or 0)
    ),
}

# Map from indicator slug → formula name + component series IDs
INDICATOR_FORMULAS = {
    "unemployment": {
        "formula": "unemployment_rate",
        "components": {
            "unemployed": "ILO_UNE_TUNE_SEX_AGE_NB",
            "labor_force": "ILO_EAP_TEAP_SEX_AGE_NB",
        },
        "fallback_components": {
            "unemployed": None,  # use rate directly if no count
            "labor_force": "WB_SL.TLF.TOTL.IN",
        },
    },
    "trade_openness": {
        "formula": "trade_openness",
        "components": {
            "exports": "WB_NE.EXP.GNFS.CD",
            "imports": "WB_NE.IMP.GNFS.CD",
            "gdp": "WB_NY.GDP.MKTP.CD",
        },
    },
    "gdp_per_capita": {
        "formula": "gdp_per_capita",
        "components": {
            "gdp_usd": "WB_NY.GDP.MKTP.CD",
            "population": "WB_SP.POP.TOTL",
        },
    },
    "gini_adjusted_gdp_per_capita": {
        "formula": "gini_adjusted_gdp_per_capita",
        "components": {
            "gdp_pc": "WB_NY.GDP.PCAP.CD",
            "gini": "WB_SI.POV.GINI",
        },
    },
    "gini_adjusted_gdp_per_capita_ppp": {
        "formula": "gini_adjusted_gdp_per_capita_ppp",
        "components": {
            "gdp_pc_ppp": "WB_NY.GDP.PCAP.PP.CD",
            "gini": "WB_SI.POV.GINI",
        },
    },
    "refugee_flows": {
        "formula": "refugee_flows_per_1000",
        "components": {
            "refugees_origin": "UNHCR_REF_ORIGIN",
            "population": "WB_SP.POP.TOTL",
        },
    },
    "natural_resource_rents": {
        "formula": "natural_resource_rents",
        "components": {
            "oil_rents": "WB_NY.GDP.PETR.RT.ZS",
            "gas_rents": "WB_NY.GDP.NGAS.RT.ZS",
            "coal_rents": "WB_NY.GDP.COAL.RT.ZS",
            "mineral_rents": "WB_NY.GDP.MINR.RT.ZS",
            "forest_rents": "WB_NY.GDP.FRST.RT.ZS",
        },
    },
}


def compute_value(formula_name, var_dict):
    """Evaluate a known formula given a dict of variable values."""
    fn = KNOWN_FORMULAS.get(formula_name)
    if not fn:
        return None
    try:
        result = fn(var_dict)
        if result is None:
            return None
        return round(float(result), 6)
    except (ZeroDivisionError, TypeError, ValueError):
        return None


def get_component_values(country_id, year_str, components, canonical_cache):
    """
    Build var_dict from component series for a given country/year.
    Returns dict {var_name: value} — missing vars are absent from dict.
    """
    var_dict = {}
    for var_name, series_id in components.items():
        if not series_id:
            continue
        vals = canonical_cache.get(series_id, {}).get(country_id, {})
        val = vals.get(year_str)
        if val is not None:
            var_dict[var_name] = val
    return var_dict


# ── YAML processing ────────────────────────────────────────────────────────────

def process_indicator_yaml(yaml_path, country_id, indicator_slug, canonical_cache, dry_run=False):
    """
    Read a YAML file, compute calculated_value for each year if components available.
    Returns (years_updated, years_filled) counts.
    """
    indicator_formula_meta = INDICATOR_FORMULAS.get(indicator_slug)
    if not indicator_formula_meta:
        return 0, 0  # No formula for this indicator

    with open(yaml_path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not data or "years" not in data:
        return 0, 0

    formula_name = indicator_formula_meta["formula"]
    components = indicator_formula_meta["components"]

    years_updated = 0
    years_filled = 0
    modified = False

    for year, year_data in data["years"].items():
        if year_data is None:
            continue

        year_str = str(year)
        quant = year_data.get("quantitative", {}) or {}

        # Get component values
        var_dict = get_component_values(country_id, year_str, components, canonical_cache)

        if not var_dict:
            continue

        # Check if all required components are present (allow partial for rents)
        required = [k for k, v in components.items() if v]  # non-null series IDs
        if formula_name != "natural_resource_rents":
            # For non-rents formulas, need all components
            if not all(k in var_dict for k in required):
                continue

        # Compute
        calc_value = compute_value(formula_name, var_dict)
        if calc_value is None:
            continue

        old_calc = quant.get("calculated_value")
        if old_calc == calc_value:
            continue  # No change

        if not dry_run:
            if "quantitative" not in year_data or year_data["quantitative"] is None:
                year_data["quantitative"] = {}
            year_data["quantitative"]["calculated_value"] = calc_value

            # If no downloaded value exists, fill in
            if quant.get("value") is None and quant.get("value_source") != "downloaded":
                year_data["quantitative"]["value"] = calc_value
                year_data["quantitative"]["value_source"] = "calculated"
                years_filled += 1

            modified = True
        years_updated += 1

    if modified and not dry_run:
        with open(yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True,
                      sort_keys=False, width=120)

    return years_updated, years_filled


def main():
    parser = argparse.ArgumentParser(description="Auto-fill calculated_value in YAML files from canonical series")
    parser.add_argument("--country", help="Only process this country ID")
    parser.add_argument("--indicator", help="Only process this indicator (e.g. economic/unemployment)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be computed")
    args = parser.parse_args()

    print("Loading registry and canonical data...")
    countries = load_countries()
    if args.country:
        if args.country not in countries:
            print(f"ERROR: Country '{args.country}' not found", file=sys.stderr)
            sys.exit(1)
        countries = [args.country]

    registry = load_registry()

    # Pre-load all canonical CSVs needed
    needed_series = set()
    for imeta in INDICATOR_FORMULAS.values():
        for sid in imeta["components"].values():
            if sid:
                needed_series.add(sid)

    print(f"Loading {len(needed_series)} canonical series...")
    canonical_cache = {}
    for sid in needed_series:
        canonical_cache[sid] = load_canonical_values(sid, registry)
        count = sum(len(years) for years in canonical_cache[sid].values())
        if count > 0:
            print(f"  {sid}: {count} data points")

    def _find_dimensions_for(slug):
        """Find which dimensions contain this indicator slug."""
        dims = []
        for cid in countries[:1]:  # Sample first country
            country_dir = DATA_RAW / cid
            if not country_dir.exists():
                continue
            for dim_dir in country_dir.iterdir():
                if not dim_dir.is_dir():
                    continue
                yaml_file = dim_dir / f"{slug}.yaml"
                if yaml_file.exists():
                    dims.append(dim_dir.name)
        return dims or []

    # Determine which indicators to process
    if args.indicator:
        # e.g. "economic/unemployment" → dimension=economic, slug=unemployment
        parts = args.indicator.split("/", 1)
        if len(parts) != 2:
            print(f"ERROR: indicator should be 'dimension/slug', got: {args.indicator}", file=sys.stderr)
            sys.exit(1)
        indicators_to_process = [(parts[0], parts[1])]
    else:
        indicators_to_process = [(dim, slug) for slug in INDICATOR_FORMULAS for dim in _find_dimensions_for(slug)]

    # Process each country × indicator
    total_updated = 0
    total_filled = 0

    for country_id in countries:
        country_dir = DATA_RAW / country_id
        if not country_dir.exists():
            continue

        for indicator_slug in INDICATOR_FORMULAS.keys():
            # Find YAML file
            yaml_path = None
            for dim_dir in country_dir.iterdir():
                if not dim_dir.is_dir():
                    continue
                candidate = dim_dir / f"{indicator_slug}.yaml"
                if candidate.exists():
                    yaml_path = candidate
                    break

            if not yaml_path:
                continue

            updated, filled = process_indicator_yaml(
                yaml_path, country_id, indicator_slug, canonical_cache, dry_run=args.dry_run
            )

            if updated > 0 or filled > 0:
                prefix = "[dry-run] " if args.dry_run else ""
                print(f"  {prefix}{country_id}/{indicator_slug}: {updated} years computed, {filled} values filled")
                total_updated += updated
                total_filled += filled

    prefix = "[dry-run] " if args.dry_run else ""
    print(f"\n{prefix}Total: {total_updated} calculated_values computed, {total_filled} missing values filled")
    print("Done.")


if __name__ == "__main__":
    main()

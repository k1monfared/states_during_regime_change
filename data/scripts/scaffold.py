#!/usr/bin/env python3
"""
Scaffold script: generates template YAML files for all countries/dimensions/indicators.

Reads config/countries.yaml and config/indicators.yaml, then creates:
  data/raw/<country>/<dimension>/<indicator>.yaml

Each file is pre-populated with:
  - Header (indicator, country, dimension)
  - Year entries for the country's time_range, each with data_status: missing

Only creates files that don't already exist (safe for incremental use).

Usage:
    python data/scripts/scaffold.py
    python data/scripts/scaffold.py --country iraq    # scaffold a single country
    python data/scripts/scaffold.py --dry-run         # show what would be created
"""

import argparse
import os
import sys
from pathlib import Path

import yaml


def get_project_root():
    """Find the project root (parent of data/)."""
    script_dir = Path(__file__).resolve().parent
    # scripts/ is inside data/, so go up two levels
    return script_dir.parent.parent


def load_config(project_root):
    """Load countries and indicators config files."""
    config_dir = project_root / "data" / "config"

    with open(config_dir / "countries.yaml", "r") as f:
        countries = yaml.safe_load(f)

    with open(config_dir / "indicators.yaml", "r") as f:
        indicators = yaml.safe_load(f)

    return countries, indicators


def generate_year_template(year):
    """Generate a single year's template entry."""
    return {
        "data_status": "missing",
        "quantitative": {
            "value": None,
            "unit": None,
            "source": {
                "citation": None,
                "url": None,
                "access_date": None,
            },
            "reliability": None,
        },
        "qualitative": {
            "assessment": None,
            "features": [],
            "sources": [],
            "confidence": None,
            "notes": None,
        },
    }


def generate_file_content(country_id, dimension, indicator, country_config, indicator_config):
    """Generate the full YAML content for one indicator file."""
    data = {
        "indicator": indicator,
        "country": country_id,
        "dimension": dimension,
        "years": {},
    }

    start_year, end_year = country_config["time_range"]
    for year in range(start_year, end_year + 1):
        data["years"][year] = generate_year_template(year)

    # Set the unit from indicator config
    unit = indicator_config.get("unit", "qualitative_scale")
    for year in data["years"]:
        data["years"][year]["quantitative"]["unit"] = unit

    return data


def yaml_represent_none(dumper, data):
    """Represent None as 'null' in YAML output."""
    return dumper.represent_scalar("tag:yaml.org,2002:null", "null")


def setup_yaml_dumper():
    """Configure YAML dumper for clean output."""
    dumper = yaml.SafeDumper
    dumper.add_representer(type(None), yaml_represent_none)
    return dumper


def scaffold_country(country_id, country_config, indicators, raw_dir, dry_run=False):
    """Create all template files for a single country."""
    created = 0
    skipped = 0

    for dimension, dimension_indicators in indicators.items():
        country_dim_dir = raw_dir / country_id / dimension

        for indicator, indicator_config in dimension_indicators.items():
            file_path = country_dim_dir / f"{indicator}.yaml"

            if file_path.exists():
                skipped += 1
                continue

            if dry_run:
                print(f"  Would create: {file_path}")
                created += 1
                continue

            # Create directory if needed
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Generate and write content
            content = generate_file_content(
                country_id, dimension, indicator, country_config, indicator_config
            )

            dumper = setup_yaml_dumper()
            with open(file_path, "w") as f:
                yaml.dump(
                    content,
                    f,
                    Dumper=dumper,
                    default_flow_style=False,
                    sort_keys=False,
                    allow_unicode=True,
                    width=120,
                )

            created += 1

    return created, skipped


def main():
    parser = argparse.ArgumentParser(description="Scaffold raw data template files")
    parser.add_argument("--country", type=str, help="Scaffold only this country (by ID)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without writing")
    args = parser.parse_args()

    project_root = get_project_root()
    countries, indicators = load_config(project_root)
    raw_dir = project_root / "data" / "raw"

    if args.country:
        if args.country not in countries:
            print(f"Error: country '{args.country}' not found in config/countries.yaml")
            print(f"Available: {', '.join(sorted(countries.keys()))}")
            sys.exit(1)
        target_countries = {args.country: countries[args.country]}
    else:
        target_countries = countries

    total_created = 0
    total_skipped = 0

    for country_id, country_config in target_countries.items():
        if not args.dry_run:
            print(f"Scaffolding {country_config['display_name']}...", end=" ")

        created, skipped = scaffold_country(
            country_id, country_config, indicators, raw_dir, dry_run=args.dry_run
        )

        if not args.dry_run:
            print(f"created {created}, skipped {skipped} (already exist)")

        total_created += created
        total_skipped += skipped

    print(f"\nDone. Created: {total_created}, Skipped: {total_skipped}, Total expected: {len(target_countries) * 20}")


if __name__ == "__main__":
    main()

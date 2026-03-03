#!/usr/bin/env python3
"""
migrate_schema_v2.py — Additive, idempotent schema migration for all raw YAML files.

Adds the following fields to every year entry that has a non-empty `quantitative:` block:
  - quantitative.value_source  (str: "downloaded" if value is not null, else null)
  - quantitative.series_id     (null — to be filled by data collection)
  - quantitative.calculated_value (null — to be filled when formula is computed)
  - quantitative.discrepancy   (null — to be filled when both values exist)
  For each component in quantitative.components:
  - component.series_id        (null)
  - component.canonical_file   (null)

All existing data is preserved unchanged. Fields already present are not overwritten.

Usage:
    python3 data/scripts/migrate_schema_v2.py                  # dry-run on all countries
    python3 data/scripts/migrate_schema_v2.py --dry-run        # explicit dry-run
    python3 data/scripts/migrate_schema_v2.py --apply          # write changes
    python3 data/scripts/migrate_schema_v2.py --country iraq   # single country (dry-run)
    python3 data/scripts/migrate_schema_v2.py --country iraq --apply
    python3 data/scripts/migrate_schema_v2.py --all            # all countries (dry-run)
    python3 data/scripts/migrate_schema_v2.py --all --apply    # write all
"""

import argparse
import sys
from io import StringIO
from pathlib import Path

try:
    from ruamel.yaml import YAML
    from ruamel.yaml.comments import CommentedMap
except ImportError:
    print("ERROR: ruamel.yaml is required. Install with: pip install ruamel.yaml", file=sys.stderr)
    sys.exit(1)


def get_project_root():
    return Path(__file__).resolve().parents[2]


def get_raw_dir(project_root):
    return project_root / "data" / "raw"


def get_countries(raw_dir):
    """Return sorted list of country IDs (subdirectory names in data/raw/)."""
    return sorted(d.name for d in raw_dir.iterdir() if d.is_dir())


def migrate_quantitative_block(quant: CommentedMap) -> bool:
    """Mutate the quantitative block in-place. Returns True if any change was made."""
    changed = False
    value = quant.get("value")

    # Add value_source if absent
    if "value_source" not in quant:
        quant["value_source"] = "downloaded" if value is not None else None
        changed = True

    # Add series_id if absent
    if "series_id" not in quant:
        quant["series_id"] = None
        changed = True

    # Add calculated_value if absent
    if "calculated_value" not in quant:
        quant["calculated_value"] = None
        changed = True

    # Add discrepancy if absent
    if "discrepancy" not in quant:
        quant["discrepancy"] = None
        changed = True

    # Add series_id + canonical_file to each component
    components = quant.get("components")
    if components and isinstance(components, dict):
        for comp_name, comp in components.items():
            if not isinstance(comp, dict):
                continue
            if "series_id" not in comp:
                comp["series_id"] = None
                changed = True
            if "canonical_file" not in comp:
                comp["canonical_file"] = None
                changed = True

    return changed


def migrate_file(file_path: Path, apply: bool, yaml: YAML) -> tuple[int, int]:
    """
    Migrate a single YAML file.
    Returns (years_checked, years_changed).
    """
    with open(file_path, "r", encoding="utf-8") as f:
        data = yaml.load(f)

    if not data or not isinstance(data, dict):
        return 0, 0

    years_data = data.get("years")
    if not years_data or not isinstance(years_data, dict):
        return 0, 0

    years_checked = 0
    years_changed = 0

    for year_key, year_entry in years_data.items():
        if not isinstance(year_entry, dict):
            continue
        quant = year_entry.get("quantitative")
        if quant is None or not isinstance(quant, dict):
            continue

        years_checked += 1
        changed = migrate_quantitative_block(quant)
        if changed:
            years_changed += 1

    if years_changed > 0 and apply:
        buf = StringIO()
        yaml.dump(data, buf)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(buf.getvalue())

    return years_checked, years_changed


def migrate_country(country_id: str, raw_dir: Path, apply: bool, yaml: YAML, verbose: bool = False):
    """Migrate all YAML files for a single country."""
    country_dir = raw_dir / country_id
    if not country_dir.exists():
        print(f"ERROR: Country directory not found: {country_dir}", file=sys.stderr)
        return

    yaml_files = sorted(country_dir.rglob("*.yaml"))
    # Exclude shared/ base_variables which don't use the same structure
    yaml_files = [f for f in yaml_files if "shared" not in f.parts]

    total_files = 0
    total_checked = 0
    total_changed = 0
    changed_files = []

    for yaml_file in yaml_files:
        checked, changed = migrate_file(yaml_file, apply=apply, yaml=yaml)
        total_files += 1
        total_checked += checked
        total_changed += changed
        if changed > 0:
            changed_files.append((yaml_file, changed))
            if verbose:
                rel = yaml_file.relative_to(raw_dir.parent.parent)
                print(f"  {'WRITE' if apply else 'WOULD CHANGE'}: {rel} ({changed} year entries)")

    mode = "Applied" if apply else "Dry-run"
    print(
        f"  [{mode}] {country_id}: {total_files} files, "
        f"{total_checked} year-entries checked, "
        f"{total_changed} year-entries changed "
        f"({len(changed_files)} files affected)"
    )

    return total_files, total_checked, total_changed


def main():
    parser = argparse.ArgumentParser(
        description="Migrate raw YAML files to schema v2 (additive, idempotent)."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--country", metavar="COUNTRY_ID",
                       help="Migrate a single country (e.g. iraq)")
    group.add_argument("--all", action="store_true",
                       help="Migrate all countries")

    parser.add_argument("--apply", action="store_true",
                        help="Write changes to disk (default: dry-run)")
    parser.add_argument("--dry-run", action="store_true", dest="dry_run",
                        help="Explicitly request dry-run (no writes, default)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Show each affected file")
    args = parser.parse_args()

    apply = args.apply and not args.dry_run

    if not args.country and not args.all:
        # Default: dry-run all
        args.all = True
        apply = False

    project_root = get_project_root()
    raw_dir = get_raw_dir(project_root)

    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.width = 4096  # avoid line wrapping
    yaml.best_sequence_indent = 2
    yaml.best_map_flow_style = False
    yaml.allow_duplicate_keys = True

    mode_label = "DRY-RUN" if not apply else "APPLYING CHANGES"
    print(f"Schema v2 migration — {mode_label}")
    print(f"Raw data dir: {raw_dir}")
    print()

    if args.country:
        countries = [args.country]
    else:
        countries = get_countries(raw_dir)

    grand_files = 0
    grand_checked = 0
    grand_changed = 0

    for country_id in countries:
        result = migrate_country(country_id, raw_dir, apply=apply, yaml=yaml, verbose=args.verbose)
        if result:
            grand_files += result[0]
            grand_checked += result[1]
            grand_changed += result[2]

    print()
    print(f"TOTAL: {grand_files} files, {grand_checked} year-entries checked, "
          f"{grand_changed} year-entries {'modified' if apply else 'would be modified'}")

    if not apply:
        print()
        print("No files written (dry-run). Add --apply to write changes.")


if __name__ == "__main__":
    main()

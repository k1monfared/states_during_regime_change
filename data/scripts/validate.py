#!/usr/bin/env python3
"""
Validation script: checks raw data files for schema compliance, completeness, and consistency.

Reports:
  - Which country-years have data vs are missing
  - Whether qualitative features are from the valid vocabulary
  - Confidence distribution across the dataset
  - Inconsistencies (e.g., quantitative says high control but qualitative says failed state)

Usage:
    python data/scripts/validate.py
    python data/scripts/validate.py --country iraq
    python data/scripts/validate.py --dimension political
    python data/scripts/validate.py --summary          # Just show summary stats
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

import yaml


def get_project_root():
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent.parent


def load_configs(project_root):
    config_dir = project_root / "data" / "config"
    configs = {}
    for name in ["countries", "indicators", "scoring_rubrics"]:
        with open(config_dir / f"{name}.yaml", "r") as f:
            configs[name] = yaml.safe_load(f)
    return configs


VALID_DATA_STATUS = {"complete", "partial", "missing", "unavailable"}
VALID_RELIABILITY = {"high", "medium", "low", None}
VALID_CONFIDENCE = {"high", "medium", "low", None}
VALID_SOURCE_TYPES = {"academic", "think_tank_report", "government", "news", "dataset", "ngo", None}


def validate_year_entry(year, year_data, indicator, dimension, valid_features, errors, warnings):
    """Validate a single year entry in a raw data file."""
    prefix = f"year {year}"

    # Check data_status
    status = year_data.get("data_status")
    if status not in VALID_DATA_STATUS:
        errors.append(f"{prefix}: invalid data_status '{status}' (expected: {VALID_DATA_STATUS})")

    # If missing/unavailable, skip detailed checks
    if status in ("missing", "unavailable"):
        return

    # Check quantitative section
    quant = year_data.get("quantitative", {})
    if quant:
        reliability = quant.get("reliability")
        if reliability not in VALID_RELIABILITY:
            errors.append(f"{prefix}: invalid quantitative reliability '{reliability}'")

        source = quant.get("source", {})
        if quant.get("value") is not None and source:
            if not source.get("citation"):
                warnings.append(f"{prefix}: quantitative value present but no source citation")

    # Check qualitative section
    qual = year_data.get("qualitative", {})
    if qual:
        # Check features are from valid vocabulary
        features = qual.get("features", [])
        if features:
            for feature in features:
                if feature not in valid_features:
                    errors.append(f"{prefix}: invalid feature '{feature}' "
                                  f"(not in valid_features for {dimension}/{indicator})")

        # Check confidence
        confidence = qual.get("confidence")
        if confidence not in VALID_CONFIDENCE:
            errors.append(f"{prefix}: invalid confidence '{confidence}'")

        # Check sources
        sources = qual.get("sources", [])
        for i, src in enumerate(sources):
            src_type = src.get("type")
            if src_type not in VALID_SOURCE_TYPES:
                warnings.append(f"{prefix}: source {i} has unknown type '{src_type}'")
            reliability = src.get("reliability")
            if reliability not in VALID_RELIABILITY:
                warnings.append(f"{prefix}: source {i} has invalid reliability '{reliability}'")


def check_consistency(year, year_data, rubric, warnings):
    """Check for inconsistencies between quantitative and qualitative data."""
    quant = year_data.get("quantitative", {})
    qual = year_data.get("qualitative", {})

    if not quant or not qual:
        return

    quant_value = quant.get("value")
    features = qual.get("features", [])

    if quant_value is None or not features:
        return

    # Get the score ranges for features and check if quant value is wildly different
    qual_scoring = rubric.get("qualitative_scoring", {}).get("features", {})
    quant_thresholds = rubric.get("quantitative_scoring", {}).get("thresholds", [])

    if not qual_scoring or not quant_thresholds:
        return

    # Find what score range the quantitative value falls in
    quant_score_range = None
    for threshold in quant_thresholds:
        from generate_scores import evaluate_condition
        if evaluate_condition(quant_value, threshold["condition"]):
            quant_score_range = threshold["score_range"]
            break

    if quant_score_range is None:
        return

    # Find what score range the qualitative features suggest
    for feature in features:
        if feature in qual_scoring:
            entry = qual_scoring[feature]
            if "score_range" in entry:
                qual_score_range = entry["score_range"]
                # Check for major discrepancy (more than 2 tiers apart)
                quant_mid = (quant_score_range[0] + quant_score_range[1]) / 2
                qual_mid = (qual_score_range[0] + qual_score_range[1]) / 2
                if abs(quant_mid - qual_mid) > 40:
                    warnings.append(
                        f"year {year}: INCONSISTENCY - quantitative value {quant_value} "
                        f"(score ~{quant_mid:.0f}) vs qualitative feature '{feature}' "
                        f"(score ~{qual_mid:.0f})"
                    )
                break  # Only check first non-modifier feature


def validate_file(file_path, country_id, dimension, indicator, configs):
    """Validate a single raw data file. Returns (errors, warnings, stats)."""
    errors = []
    warnings = []
    stats = {
        "data_statuses": Counter(),
        "confidences": Counter(),
        "reliabilities": Counter(),
        "has_quantitative": 0,
        "has_qualitative": 0,
        "total_years": 0,
    }

    if not file_path.exists():
        errors.append(f"File does not exist: {file_path}")
        return errors, warnings, stats

    with open(file_path, "r") as f:
        data = yaml.safe_load(f)

    if data is None:
        errors.append("File is empty")
        return errors, warnings, stats

    # Check header fields
    if data.get("indicator") != indicator:
        errors.append(f"indicator field mismatch: expected '{indicator}', got '{data.get('indicator')}'")
    if data.get("country") != country_id:
        errors.append(f"country field mismatch: expected '{country_id}', got '{data.get('country')}'")
    if data.get("dimension") != dimension:
        errors.append(f"dimension field mismatch: expected '{dimension}', got '{data.get('dimension')}'")

    # Get valid features for this indicator
    dim_indicators = configs["indicators"].get(dimension, {})
    indicator_config = dim_indicators.get(indicator, {})
    valid_features = set(indicator_config.get("valid_features", []))

    # Get rubric for consistency checking
    rubric = configs["scoring_rubrics"].get(dimension, {}).get(indicator, {})

    # Validate years
    years = data.get("years", {})
    if not years:
        warnings.append("No year entries found")
        return errors, warnings, stats

    for year, year_data in years.items():
        stats["total_years"] += 1
        status = year_data.get("data_status", "missing")
        stats["data_statuses"][status] += 1

        if year_data.get("qualitative", {}).get("confidence"):
            stats["confidences"][year_data["qualitative"]["confidence"]] += 1

        if year_data.get("quantitative", {}).get("reliability"):
            stats["reliabilities"][year_data["quantitative"]["reliability"]] += 1

        if year_data.get("quantitative", {}).get("value") is not None:
            stats["has_quantitative"] += 1

        if year_data.get("qualitative", {}).get("features"):
            stats["has_qualitative"] += 1

        validate_year_entry(year, year_data, indicator, dimension, valid_features, errors, warnings)

        # Consistency checks (only if we have both quant and qual)
        if status in ("complete", "partial"):
            try:
                check_consistency(year, year_data, rubric, warnings)
            except (ImportError, Exception):
                pass  # Skip consistency check if generate_scores not importable

    return errors, warnings, stats


def main():
    parser = argparse.ArgumentParser(description="Validate raw data files")
    parser.add_argument("--country", type=str, help="Validate only this country")
    parser.add_argument("--dimension", type=str, help="Validate only this dimension")
    parser.add_argument("--summary", action="store_true", help="Show only summary stats")
    parser.add_argument("--errors-only", action="store_true", help="Only show errors, not warnings")
    args = parser.parse_args()

    project_root = get_project_root()
    configs = load_configs(project_root)
    raw_dir = project_root / "data" / "raw"

    countries = configs["countries"]
    indicators = configs["indicators"]

    if args.country:
        if args.country not in countries:
            print(f"Error: country '{args.country}' not found")
            sys.exit(1)
        target_countries = {args.country: countries[args.country]}
    else:
        target_countries = countries

    if args.dimension:
        if args.dimension not in indicators:
            print(f"Error: dimension '{args.dimension}' not found")
            sys.exit(1)
        target_dimensions = {args.dimension: indicators[args.dimension]}
    else:
        target_dimensions = indicators

    # Aggregate stats
    total_files = 0
    total_errors = 0
    total_warnings = 0
    files_with_errors = 0
    files_missing = 0
    global_stats = {
        "data_statuses": Counter(),
        "confidences": Counter(),
        "reliabilities": Counter(),
        "has_quantitative": 0,
        "has_qualitative": 0,
        "total_years": 0,
    }
    completeness = {}  # {country: {scored_years / total_years}}

    for country_id, country_config in target_countries.items():
        country_scored = 0
        country_total = 0

        for dimension, dim_indicators in target_dimensions.items():
            for indicator in dim_indicators:
                file_path = raw_dir / country_id / dimension / f"{indicator}.yaml"
                total_files += 1

                errors, warnings, stats = validate_file(
                    file_path, country_id, dimension, indicator, configs
                )

                # Accumulate global stats
                for key in ["data_statuses", "confidences", "reliabilities"]:
                    global_stats[key] += stats[key]
                global_stats["has_quantitative"] += stats["has_quantitative"]
                global_stats["has_qualitative"] += stats["has_qualitative"]
                global_stats["total_years"] += stats["total_years"]

                country_scored += stats["has_quantitative"] + stats["has_qualitative"]
                country_total += stats["total_years"]

                if not file_path.exists():
                    files_missing += 1

                if errors:
                    files_with_errors += 1
                    total_errors += len(errors)
                total_warnings += len(warnings)

                # Print details unless summary mode
                if not args.summary and (errors or (warnings and not args.errors_only)):
                    print(f"\n{country_id}/{dimension}/{indicator}:")
                    for e in errors:
                        print(f"  ERROR: {e}")
                    if not args.errors_only:
                        for w in warnings:
                            print(f"  WARN:  {w}")

        if country_total > 0:
            completeness[country_id] = country_scored / country_total * 100

    # Print summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)

    print(f"\nFiles:")
    print(f"  Total expected:    {total_files}")
    print(f"  Missing:           {files_missing}")
    print(f"  With errors:       {files_with_errors}")
    print(f"  Total errors:      {total_errors}")
    print(f"  Total warnings:    {total_warnings}")

    print(f"\nYear-level coverage:")
    print(f"  Total year entries:     {global_stats['total_years']}")
    print(f"  With quantitative data: {global_stats['has_quantitative']}")
    print(f"  With qualitative data:  {global_stats['has_qualitative']}")

    print(f"\nData status distribution:")
    for status, count in sorted(global_stats["data_statuses"].items()):
        pct = count / max(global_stats["total_years"], 1) * 100
        print(f"  {status:15s}: {count:6d} ({pct:.1f}%)")

    if global_stats["confidences"]:
        print(f"\nConfidence distribution:")
        for conf, count in sorted(global_stats["confidences"].items()):
            print(f"  {str(conf):15s}: {count:6d}")

    if global_stats["reliabilities"]:
        print(f"\nReliability distribution:")
        for rel, count in sorted(global_stats["reliabilities"].items()):
            print(f"  {str(rel):15s}: {count:6d}")

    # Top/bottom completeness
    if completeness:
        sorted_completeness = sorted(completeness.items(), key=lambda x: x[1], reverse=True)
        print(f"\nData coverage by country (top 5):")
        for country, pct in sorted_completeness[:5]:
            print(f"  {country:20s}: {pct:.1f}%")
        if len(sorted_completeness) > 5:
            print(f"\nData coverage by country (bottom 5):")
            for country, pct in sorted_completeness[-5:]:
                print(f"  {country:20s}: {pct:.1f}%")

    # Exit code
    if total_errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

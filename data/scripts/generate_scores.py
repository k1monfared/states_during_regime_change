#!/usr/bin/env python3
"""
Score generation pipeline: raw YAML data + config -> derived scores.

Reads:
  - data/raw/<country>/<dimension>/<indicator>.yaml (raw data)
  - data/config/scoring_rubrics.yaml (how to convert raw -> scores)
  - data/config/aggregation.yaml (how to combine scores)
  - data/config/countries.yaml (country metadata)
  - data/config/indicators.yaml (indicator definitions)

Outputs:
  - data/derived/scores/<country>.csv (per-country scores)
  - data/derived/combined.csv (all countries combined)

Usage:
    python data/scripts/generate_scores.py
    python data/scripts/generate_scores.py --country iraq
    python data/scripts/generate_scores.py --verbose
"""

import argparse
import csv
import math
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import yaml

# Configuration
YEARS_BEFORE_REGIME_CHANGE = 15
CURRENT_YEAR = datetime.now().year


def get_time_range(country_config):
    """Calculate time range for a country.

    If time_range is specified in config, use it.
    Otherwise, calculate as: (earliest_regime_change - 15, current_year)
    """
    if "time_range" in country_config:
        return country_config["time_range"]

    regime_years = country_config.get("regime_change_years", [])
    if not regime_years:
        return [2000, CURRENT_YEAR]

    start_year = min(regime_years) - YEARS_BEFORE_REGIME_CHANGE
    return [start_year, CURRENT_YEAR]


def get_project_root():
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent.parent


def load_configs(project_root):
    config_dir = project_root / "data" / "config"
    configs = {}
    for name in ["countries", "indicators", "scoring_rubrics", "aggregation"]:
        with open(config_dir / f"{name}.yaml", "r") as f:
            configs[name] = yaml.safe_load(f)
    return configs


def load_raw_file(file_path):
    """Load a single raw YAML data file. Returns None if file doesn't exist."""
    if not file_path.exists():
        return None
    with open(file_path, "r") as f:
        return yaml.safe_load(f)


def evaluate_condition(value, condition):
    """Evaluate a threshold condition string against a value.

    Supports: ">= N", "> N", "<= N", "< N", "== N"
    """
    if value is None:
        return False

    condition = condition.strip()
    match = re.match(r"(>=|>|<=|<|==)\s*(-?[\d.]+)", condition)
    if not match:
        return False

    op, threshold = match.groups()
    threshold = float(threshold)
    value = float(value)

    if op == ">=":
        return value >= threshold
    elif op == ">":
        return value > threshold
    elif op == "<=":
        return value <= threshold
    elif op == "<":
        return value < threshold
    elif op == "==":
        return value == threshold
    return False


def apply_input_transform(value, transform_name, peak_value=None):
    """Apply input transform to a raw value before threshold scoring.

    Supported transforms:
      freedom_house_invert  — Freedom House CL 1-7: (8 - value) / 7 * 100
      percent_of_peak       — (value / peak_value) * 100 (requires peak_value)
      rsf_invert            — RSF press freedom: 100 - value
      wjp_multiply_100      — WJP rule-of-law 0-1 scale: value * 100
    """
    if transform_name is None or value is None:
        return value
    try:
        value = float(value)
    except (ValueError, TypeError):
        return None

    if transform_name == "freedom_house_invert":
        return (8.0 - value) / 7.0 * 100.0
    elif transform_name == "percent_of_peak":
        if peak_value is None or float(peak_value) == 0:
            return None
        return (value / float(peak_value)) * 100.0
    elif transform_name == "rsf_invert":
        return 100.0 - value
    elif transform_name == "wjp_multiply_100":
        return value * 100.0
    return value


def score_quantitative(value, rubric, peak_value=None):
    """Apply quantitative scoring rubric to a value. Returns (score, source_type) or (None, None)."""
    if value is None:
        return None, None

    scoring = rubric.get("quantitative_scoring", {})
    scoring_type = scoring.get("type")

    if scoring_type == "none" or scoring_type is None:
        return None, None

    # Apply input transform before threshold comparison
    transform = scoring.get("input_transform")
    transformed = apply_input_transform(value, transform, peak_value=peak_value)
    if transformed is None:
        return None, None

    thresholds = scoring.get("thresholds", [])

    for threshold in thresholds:
        condition = threshold["condition"]
        if evaluate_condition(transformed, condition):
            score_range = threshold["score_range"]
            # Use midpoint of range as the score
            score = (score_range[0] + score_range[1]) / 2.0
            return score, "quantitative"

    # If no threshold matched, use the last one (lowest)
    if thresholds:
        last_range = thresholds[-1]["score_range"]
        return (last_range[0] + last_range[1]) / 2.0, "quantitative"

    return None, None


def score_qualitative(features, rubric):
    """Apply qualitative scoring rubric to feature tags. Returns (score, source_type) or (None, None)."""
    if not features:
        return None, None

    scoring = rubric.get("qualitative_scoring", {})
    feature_scores = scoring.get("features", {})
    multi_rule = scoring.get("multi_feature_rule", "minimum")

    scores = []
    modifiers = []

    for feature in features:
        if feature in feature_scores:
            entry = feature_scores[feature]
            if "modifier" in entry:
                modifiers.append(entry["modifier"])
            elif "default_score" in entry:
                scores.append(entry["default_score"])

    if not scores:
        return None, None

    # Apply multi-feature rule
    if multi_rule == "minimum":
        base_score = min(scores)
    elif multi_rule == "average":
        base_score = sum(scores) / len(scores)
    elif multi_rule == "first":
        base_score = scores[0]
    else:
        base_score = min(scores)

    # Apply modifiers
    final_score = base_score + sum(modifiers)
    final_score = max(0, min(100, final_score))  # Clamp to 0-100

    return final_score, "qualitative"


def combine_scores(quant_score, qual_score, combination_rule):
    """Combine quantitative and qualitative scores according to rule."""
    if combination_rule == "quantitative_preferred":
        if quant_score is not None:
            return quant_score, "quantitative"
        elif qual_score is not None:
            return qual_score, "qualitative"
        return None, None

    elif combination_rule == "qualitative_preferred":
        if qual_score is not None:
            return qual_score, "qualitative"
        elif quant_score is not None:
            return quant_score, "quantitative"
        return None, None

    elif combination_rule == "quantitative_only":
        return quant_score, "quantitative" if quant_score is not None else (None, None)

    elif combination_rule == "qualitative_only":
        return qual_score, "qualitative" if qual_score is not None else (None, None)

    elif combination_rule == "average":
        if quant_score is not None and qual_score is not None:
            return (quant_score + qual_score) / 2.0, "average"
        elif quant_score is not None:
            return quant_score, "quantitative"
        elif qual_score is not None:
            return qual_score, "qualitative"
        return None, None

    # Default fallback
    if quant_score is not None:
        return quant_score, "quantitative"
    elif qual_score is not None:
        return qual_score, "qualitative"
    return None, None


def score_indicator_year(year_data, rubric, peak_value=None):
    """Score a single indicator for a single year.

    Returns dict with: score, source_type, data_status
    peak_value: pre-computed series peak for percent_of_peak transform (may be None)
    """
    if year_data is None:
        return {"score": None, "source_type": None, "data_status": "missing"}

    data_status = year_data.get("data_status", "missing")

    if data_status in ("missing", "unavailable"):
        return {"score": None, "source_type": None, "data_status": data_status}

    # Get quantitative value
    quant_data = year_data.get("quantitative", {})
    quant_value = quant_data.get("value") if quant_data else None

    # Warn on significant/critical discrepancy between downloaded and calculated values
    if quant_data:
        discrepancy = quant_data.get("discrepancy")
        if discrepancy and isinstance(discrepancy, dict):
            flag = discrepancy.get("flag")
            if flag in ("significant", "critical"):
                note = discrepancy.get("note", "")
                print(
                    f"WARNING: discrepancy flag={flag} "
                    f"downloaded={discrepancy.get('downloaded_value')} "
                    f"calculated={discrepancy.get('calculated_value')} "
                    f"({discrepancy.get('magnitude_pct', '?')}%) "
                    f"note={note!r}",
                    file=sys.stderr,
                )

    # Get qualitative features
    qual_data = year_data.get("qualitative", {})
    features = qual_data.get("features", []) if qual_data else []

    # Score both
    quant_score, _ = score_quantitative(quant_value, rubric, peak_value=peak_value)
    qual_score, _ = score_qualitative(features, rubric)

    # Combine
    combination_rule = rubric.get("combination_rule", "quantitative_preferred")
    final_score, source_type = combine_scores(quant_score, qual_score, combination_rule)

    return {
        "score": round(final_score, 1) if final_score is not None else None,
        "source_type": source_type,
        "data_status": data_status,
    }


def aggregate_dimension(indicator_scores, dim_config, country_id):
    """Aggregate indicator scores into a dimension score.

    indicator_scores: dict of {indicator_name: score_or_None}
    dim_config: the dimension's aggregation config
    country_id: for checking not_applicable_indicators
    """
    function = dim_config.get("function", "weighted_average")
    weights = dim_config.get("weights", {})
    missing_handling = dim_config.get("missing_data_handling", "skip_and_renormalize")
    not_applicable = dim_config.get("not_applicable_indicators", {})

    # Determine which indicators are applicable
    applicable_indicators = set(weights.keys())
    for ind, na_info in not_applicable.items():
        if country_id in na_info.get("countries", []):
            applicable_indicators.discard(ind)

    available = {}
    for indicator in applicable_indicators:
        score = indicator_scores.get(indicator)
        if score is not None:
            available[indicator] = score

    # Handle missing data
    if missing_handling == "exclude_year":
        if set(available.keys()) != applicable_indicators:
            return None
    elif missing_handling == "use_zero":
        for ind in applicable_indicators:
            if ind not in available:
                available[ind] = 0.0
    elif missing_handling == "use_floor":
        for ind in applicable_indicators:
            if ind not in available:
                available[ind] = 5.0
    elif isinstance(missing_handling, dict) and "use_value" in missing_handling:
        fill_value = float(missing_handling["use_value"])
        for ind in applicable_indicators:
            if ind not in available:
                available[ind] = fill_value

    if not available:
        return None

    # Apply aggregation function
    if function == "weighted_average":
        total_weight = sum(weights.get(ind, 1.0) for ind in available)
        if total_weight == 0:
            return None
        weighted_sum = sum(score * weights.get(ind, 1.0) for ind, score in available.items())
        return round(weighted_sum / total_weight, 1)

    elif function == "geometric_mean":
        scores = list(available.values())
        # Geometric mean requires all positive
        positive = [s for s in scores if s > 0]
        if not positive:
            return 0.0
        product = 1.0
        for s in positive:
            product *= s
        return round(product ** (1.0 / len(positive)), 1)

    elif function == "minimum":
        return round(min(available.values()), 1)

    elif function == "harmonic_mean":
        scores = [s for s in available.values() if s > 0]
        if not scores:
            return 0.0
        return round(len(scores) / sum(1.0 / s for s in scores), 1)

    return None


def aggregate_composite(dimension_scores, composite_config):
    """Aggregate dimension scores into a single composite score."""
    available = {dim: score for dim, score in dimension_scores.items() if score is not None}

    if not available:
        return None

    function = composite_config.get("function", "weighted_average")
    weights = composite_config.get("weights", {})

    if function == "weighted_average":
        total_weight = sum(weights.get(dim, 1.0) for dim in available)
        if total_weight == 0:
            return None
        weighted_sum = sum(score * weights.get(dim, 1.0) for dim, score in available.items())
        return round(weighted_sum / total_weight, 1)

    return None


def compute_series_peaks(country_id, rubrics, aggregation, raw_dir):
    """Pre-compute peak quantitative values for indicators that use percent_of_peak transform.

    Returns dict of (dimension, indicator) -> peak_value.
    Only populates entries where input_transform == "percent_of_peak" and data exists.
    """
    peaks = {}
    for dimension in aggregation["dimensions"].keys():
        dim_rubrics = rubrics.get(dimension, {})
        dim_agg = aggregation["dimensions"].get(dimension, {})
        for indicator in dim_agg.get("sub_indicators", []):
            indicator_rubric = dim_rubrics.get(indicator, {})
            scoring = indicator_rubric.get("quantitative_scoring", {})
            if scoring.get("input_transform") != "percent_of_peak":
                continue
            raw_file = raw_dir / country_id / dimension / f"{indicator}.yaml"
            raw_data = load_raw_file(raw_file)
            if not raw_data or "years" not in raw_data:
                continue
            peak = None
            for year_data in raw_data["years"].values():
                if year_data is None:
                    continue
                quant_data = year_data.get("quantitative", {})
                val = quant_data.get("value") if quant_data else None
                if val is not None:
                    try:
                        val = float(val)
                        if peak is None or val > peak:
                            peak = val
                    except (ValueError, TypeError):
                        pass
            if peak is not None:
                peaks[(dimension, indicator)] = peak
    return peaks


def process_country(country_id, country_config, configs, raw_dir, verbose=False):
    """Process all indicators for a country, return list of score records."""
    rubrics = configs["scoring_rubrics"]
    aggregation = configs["aggregation"]
    records = []

    start_year, end_year = get_time_range(country_config)

    # Pre-compute series peaks for percent_of_peak indicators
    series_peaks = compute_series_peaks(country_id, rubrics, aggregation, raw_dir)
    if verbose and series_peaks:
        for (dim, ind), peak in series_peaks.items():
            print(f"  {country_id}: peak {dim}/{ind} = {peak}")

    for year in range(start_year, end_year + 1):
        dimension_scores = {}

        for dimension in aggregation["dimensions"].keys():
            dim_rubrics = rubrics.get(dimension, {})
            dim_agg = aggregation["dimensions"].get(dimension, {})
            indicator_scores = {}

            for indicator in dim_agg.get("sub_indicators", []):
                # Load raw data file
                raw_file = raw_dir / country_id / dimension / f"{indicator}.yaml"
                raw_data = load_raw_file(raw_file)

                # Get year data
                year_data = None
                if raw_data and "years" in raw_data:
                    year_data = raw_data["years"].get(year)

                # Get rubric for this indicator
                indicator_rubric = dim_rubrics.get(indicator, {})

                # Score it (pass pre-computed series peak for percent_of_peak transform)
                peak_value = series_peaks.get((dimension, indicator))
                result = score_indicator_year(year_data, indicator_rubric, peak_value=peak_value)
                indicator_scores[indicator] = result["score"]

                # Record individual indicator score
                records.append({
                    "country": country_id,
                    "year": year,
                    "dimension": dimension,
                    "indicator": indicator,
                    "score": result["score"],
                    "source_type": result["source_type"],
                    "data_status": result["data_status"],
                })

                if verbose and result["score"] is not None:
                    print(f"  {country_id}/{year}/{dimension}/{indicator}: "
                          f"{result['score']} ({result['source_type']})")

            # Aggregate dimension
            dim_score = aggregate_dimension(indicator_scores, dim_agg, country_id)
            dimension_scores[dimension] = dim_score

            # Record dimension score
            records.append({
                "country": country_id,
                "year": year,
                "dimension": dimension,
                "indicator": "_dimension_score",
                "score": dim_score,
                "source_type": "aggregated",
                "data_status": "derived",
            })

        # Aggregate composite
        composite_score = aggregate_composite(dimension_scores, aggregation["composite"])
        records.append({
            "country": country_id,
            "year": year,
            "dimension": "_composite",
            "indicator": "_composite_score",
            "score": composite_score,
            "source_type": "aggregated",
            "data_status": "derived",
        })

    return records


def write_country_csv(records, output_path):
    """Write per-country CSV file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = ["country", "year", "dimension", "indicator", "score", "source_type", "data_status"]

    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            writer.writerow(record)


def write_combined_csv(all_records, output_path):
    """Write combined CSV with all countries."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = ["country", "year", "dimension", "indicator", "score", "source_type", "data_status"]

    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for record in all_records:
            writer.writerow(record)


def main():
    parser = argparse.ArgumentParser(description="Generate scores from raw data")
    parser.add_argument("--country", type=str, help="Process only this country")
    parser.add_argument("--verbose", action="store_true", help="Print scoring details")
    parser.add_argument("--only-scored", action="store_true",
                        help="Only output rows where score is not None")
    args = parser.parse_args()

    project_root = get_project_root()
    configs = load_configs(project_root)
    raw_dir = project_root / "data" / "raw"
    derived_dir = project_root / "data" / "derived"

    countries = configs["countries"]

    if args.country:
        if args.country not in countries:
            print(f"Error: country '{args.country}' not found in config/countries.yaml")
            sys.exit(1)
        target_countries = {args.country: countries[args.country]}
    else:
        target_countries = countries

    all_records = []
    scored_countries = 0

    for country_id, country_config in target_countries.items():
        if args.verbose:
            print(f"\nProcessing {country_config['display_name']}...")

        records = process_country(country_id, country_config, configs, raw_dir, verbose=args.verbose)

        # Filter if requested
        if args.only_scored:
            records = [r for r in records if r["score"] is not None]

        if records:
            # Write per-country CSV
            country_csv = derived_dir / "scores" / f"{country_id}.csv"
            write_country_csv(records, country_csv)
            scored_countries += 1

        all_records.extend(records)

    # Write combined CSV
    if args.only_scored:
        all_records = [r for r in all_records if r["score"] is not None]

    combined_csv = derived_dir / "combined.csv"
    write_combined_csv(all_records, combined_csv)

    # Summary
    scored_records = [r for r in all_records if r["score"] is not None]
    total_indicators = [r for r in all_records
                        if r["indicator"] not in ("_dimension_score", "_composite_score")]
    scored_indicators = [r for r in scored_records
                         if r["indicator"] not in ("_dimension_score", "_composite_score")]

    print(f"\nScore generation complete.")
    print(f"  Countries processed: {scored_countries}")
    print(f"  Total indicator-year entries: {len(total_indicators)}")
    print(f"  Scored indicator-year entries: {len(scored_indicators)}")
    print(f"  Coverage: {len(scored_indicators) / max(len(total_indicators), 1) * 100:.1f}%")
    print(f"  Output: {combined_csv}")


if __name__ == "__main__":
    main()

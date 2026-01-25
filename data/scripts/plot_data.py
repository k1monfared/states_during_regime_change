#!/usr/bin/env python3
"""
Plotting script for regime change trajectory analysis.

Creates visualizations from derived score data. Supports multiple plot types,
country/region filtering, dimension/indicator selection, and overlay vs separate modes.

Usage:
    # Single country, all dimensions
    python3 data/scripts/plot_data.py --countries iraq

    # Multiple countries overlaid
    python3 data/scripts/plot_data.py --countries iraq,libya,syria --overlay

    # Region comparison
    python3 data/scripts/plot_data.py --region mena --overlay

    # Specific dimension with indicators
    python3 data/scripts/plot_data.py --countries tunisia,egypt --dimension political --show-indicators

    # Align to regime change year
    python3 data/scripts/plot_data.py --region africa_peaceful --overlay --align-regime-change

    # Heatmap view
    python3 data/scripts/plot_data.py --region mena --plot-type heatmap

    # Save to file
    python3 data/scripts/plot_data.py --countries iraq --output plots/iraq_trajectory.png
"""

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

import yaml

# Optional imports - graceful degradation if not installed
try:
    import matplotlib.pyplot as plt
    import matplotlib.cm as cm
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


def get_project_root():
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent.parent


def load_countries_config(project_root):
    with open(project_root / "data" / "config" / "countries.yaml") as f:
        return yaml.safe_load(f)


def load_scores(project_root, countries=None):
    """Load score data from combined.csv or per-country CSVs.

    Returns dict: {country: {year: {dimension: {indicator: score}}}}
    """
    combined_path = project_root / "data" / "derived" / "combined.csv"

    if not combined_path.exists():
        print("Error: No score data found. Run generate_scores.py first.")
        sys.exit(1)

    data = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))

    with open(combined_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            country = row["country"]
            if countries and country not in countries:
                continue

            year = int(row["year"])
            dimension = row["dimension"]
            indicator = row["indicator"]
            score = row["score"]

            if score:
                data[country][year][dimension][indicator] = float(score)

    return data


def get_countries_for_region(countries_config, region):
    """Get list of country IDs for a region."""
    return [cid for cid, cfg in countries_config.items() if cfg.get("region") == region]


def get_countries_for_category(countries_config, category):
    """Get list of country IDs for a category."""
    return [cid for cid, cfg in countries_config.items() if cfg.get("category") == category]


def get_available_regions(countries_config):
    """Get list of unique regions."""
    return sorted(set(cfg.get("region") for cfg in countries_config.values() if cfg.get("region")))


def get_available_categories(countries_config):
    """Get list of unique categories."""
    return sorted(set(cfg.get("category") for cfg in countries_config.values() if cfg.get("category")))


def get_regime_change_year(countries_config, country_id):
    """Get the primary regime change year for a country."""
    cfg = countries_config.get(country_id, {})
    years = cfg.get("regime_change_years", [])
    return years[0] if years else None


def extract_dimension_scores(data, dimension="_composite"):
    """Extract dimension scores across years for each country.

    Returns: {country: [(year, score), ...]}
    """
    result = {}
    for country, years_data in data.items():
        scores = []
        for year in sorted(years_data.keys()):
            dim_data = years_data[year].get(dimension, {})
            if dimension == "_composite":
                score = dim_data.get("_composite_score")
            else:
                score = dim_data.get("_dimension_score")
            if score is not None:
                scores.append((year, score))
        if scores:
            result[country] = scores
    return result


def extract_indicator_scores(data, dimension, indicator):
    """Extract a specific indicator's scores across years for each country.

    Returns: {country: [(year, score), ...]}
    """
    result = {}
    for country, years_data in data.items():
        scores = []
        for year in sorted(years_data.keys()):
            dim_data = years_data[year].get(dimension, {})
            score = dim_data.get(indicator)
            if score is not None:
                scores.append((year, score))
        if scores:
            result[country] = scores
    return result


def plot_time_series_overlay(scores_by_country, countries_config, title, ylabel="Score (0-100)",
                              align_regime_change=False, regime_change_years=None):
    """Plot multiple countries on the same axes."""
    fig, ax = plt.subplots(figsize=(12, 6))

    colors = cm.tab10.colors

    for i, (country, scores) in enumerate(sorted(scores_by_country.items())):
        if not scores:
            continue

        years, values = zip(*scores)

        if align_regime_change and regime_change_years and country in regime_change_years:
            rc_year = regime_change_years[country]
            years = [y - rc_year for y in years]
            xlabel = "Years relative to regime change"
        else:
            xlabel = "Year"

        display_name = countries_config.get(country, {}).get("display_name", country)
        color = colors[i % len(colors)]

        ax.plot(years, values, marker='o', markersize=4, label=display_name, color=color, linewidth=2)

        # Add regime change marker if not aligned
        if not align_regime_change and regime_change_years and country in regime_change_years:
            rc_year = regime_change_years[country]
            if min(years) <= rc_year <= max(years):
                ax.axvline(x=rc_year, color=color, linestyle='--', alpha=0.5, linewidth=1)

    if align_regime_change:
        ax.axvline(x=0, color='red', linestyle='--', alpha=0.7, linewidth=2, label='Regime change')
        ax.set_xlabel("Years relative to regime change")
    else:
        ax.set_xlabel("Year")

    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.set_ylim(0, 100)
    ax.legend(loc='best', fontsize=8)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    return fig


def plot_time_series_separate(scores_by_country, countries_config, title_prefix, ylabel="Score (0-100)",
                               regime_change_years=None):
    """Create small multiples - one subplot per country."""
    n_countries = len(scores_by_country)
    if n_countries == 0:
        return None

    cols = min(3, n_countries)
    rows = (n_countries + cols - 1) // cols

    fig, axes = plt.subplots(rows, cols, figsize=(5*cols, 4*rows), squeeze=False)
    axes = axes.flatten()

    for i, (country, scores) in enumerate(sorted(scores_by_country.items())):
        ax = axes[i]

        if not scores:
            ax.set_visible(False)
            continue

        years, values = zip(*scores)
        display_name = countries_config.get(country, {}).get("display_name", country)

        ax.plot(years, values, marker='o', markersize=4, linewidth=2, color='steelblue')

        # Regime change marker
        if regime_change_years and country in regime_change_years:
            rc_year = regime_change_years[country]
            if min(years) <= rc_year <= max(years):
                ax.axvline(x=rc_year, color='red', linestyle='--', alpha=0.7, linewidth=2)

        ax.set_title(display_name, fontsize=10)
        ax.set_ylim(0, 100)
        ax.grid(True, alpha=0.3)
        ax.tick_params(labelsize=8)

    # Hide unused subplots
    for i in range(len(scores_by_country), len(axes)):
        axes[i].set_visible(False)

    fig.suptitle(title_prefix, fontsize=12, fontweight='bold')
    fig.supxlabel("Year")
    fig.supylabel(ylabel)
    plt.tight_layout()
    return fig


def plot_dimensions_single_country(data, country, countries_config, regime_change_years=None):
    """Plot all 4 dimensions for a single country on one chart."""
    fig, ax = plt.subplots(figsize=(12, 6))

    dimensions = ["political", "economic", "international", "transparency"]
    colors = {"political": "red", "economic": "green", "international": "blue", "transparency": "purple"}

    years_data = data.get(country, {})
    if not years_data:
        return None

    for dim in dimensions:
        scores = []
        for year in sorted(years_data.keys()):
            dim_data = years_data[year].get(dim, {})
            score = dim_data.get("_dimension_score")
            if score is not None:
                scores.append((year, score))

        if scores:
            years, values = zip(*scores)
            ax.plot(years, values, marker='o', markersize=4, label=dim.capitalize(),
                   color=colors[dim], linewidth=2)

    # Regime change marker
    if regime_change_years and country in regime_change_years:
        rc_year = regime_change_years[country]
        ax.axvline(x=rc_year, color='black', linestyle='--', alpha=0.7, linewidth=2, label='Regime change')

    display_name = countries_config.get(country, {}).get("display_name", country)
    ax.set_title(f"{display_name} - All Dimensions")
    ax.set_xlabel("Year")
    ax.set_ylabel("Score (0-100)")
    ax.set_ylim(0, 100)
    ax.legend(loc='best')
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    return fig


def plot_indicators_single_country(data, country, dimension, countries_config, regime_change_years=None):
    """Plot all indicators within a dimension for a single country."""
    fig, ax = plt.subplots(figsize=(12, 6))

    indicators = {
        "political": ["territorial_control", "political_violence", "institutional_functioning",
                      "civil_liberties", "elite_cohesion"],
        "economic": ["gdp_per_capita", "inflation", "unemployment", "trade_openness", "fiscal_health"],
        "international": ["sanctions", "diplomatic_integration", "foreign_military", "fdi", "refugee_flows"],
        "transparency": ["budget_transparency", "press_freedom", "statistical_transparency",
                         "legal_transparency", "extractive_transparency"]
    }

    dim_indicators = indicators.get(dimension, [])
    colors = cm.tab10.colors

    years_data = data.get(country, {})
    if not years_data:
        return None

    for i, ind in enumerate(dim_indicators):
        scores = []
        for year in sorted(years_data.keys()):
            dim_data = years_data[year].get(dimension, {})
            score = dim_data.get(ind)
            if score is not None:
                scores.append((year, score))

        if scores:
            years, values = zip(*scores)
            label = ind.replace("_", " ").title()
            ax.plot(years, values, marker='o', markersize=4, label=label,
                   color=colors[i % len(colors)], linewidth=2)

    # Regime change marker
    if regime_change_years and country in regime_change_years:
        rc_year = regime_change_years[country]
        ax.axvline(x=rc_year, color='black', linestyle='--', alpha=0.7, linewidth=2, label='Regime change')

    display_name = countries_config.get(country, {}).get("display_name", country)
    ax.set_title(f"{display_name} - {dimension.capitalize()} Indicators")
    ax.set_xlabel("Year")
    ax.set_ylabel("Score (0-100)")
    ax.set_ylim(0, 100)
    ax.legend(loc='best', fontsize=8)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    return fig


def plot_heatmap(scores_by_country, countries_config, title, regime_change_years=None):
    """Create a heatmap with countries as rows and years as columns."""
    if not HAS_NUMPY:
        print("Error: numpy required for heatmap. Install with: pip install numpy")
        return None

    # Get all years across all countries
    all_years = set()
    for scores in scores_by_country.values():
        all_years.update(year for year, _ in scores)

    if not all_years:
        return None

    years = sorted(all_years)
    countries = sorted(scores_by_country.keys())

    # Build matrix
    matrix = np.full((len(countries), len(years)), np.nan)
    for i, country in enumerate(countries):
        scores_dict = dict(scores_by_country[country])
        for j, year in enumerate(years):
            if year in scores_dict:
                matrix[i, j] = scores_dict[year]

    fig, ax = plt.subplots(figsize=(max(12, len(years)*0.5), max(6, len(countries)*0.4)))

    im = ax.imshow(matrix, aspect='auto', cmap='RdYlGn', vmin=0, vmax=100)

    # Labels
    display_names = [countries_config.get(c, {}).get("display_name", c) for c in countries]
    ax.set_yticks(range(len(countries)))
    ax.set_yticklabels(display_names, fontsize=8)

    # Show every nth year label to avoid crowding
    step = max(1, len(years) // 20)
    ax.set_xticks(range(0, len(years), step))
    ax.set_xticklabels([years[i] for i in range(0, len(years), step)], fontsize=8, rotation=45)

    # Mark regime change years
    if regime_change_years:
        for i, country in enumerate(countries):
            if country in regime_change_years:
                rc_year = regime_change_years[country]
                if rc_year in years:
                    j = years.index(rc_year)
                    ax.plot(j, i, 'k|', markersize=15, markeredgewidth=2)

    ax.set_title(title)
    ax.set_xlabel("Year")

    # Colorbar
    cbar = plt.colorbar(im, ax=ax, shrink=0.8)
    cbar.set_label("Score (0-100)")

    plt.tight_layout()
    return fig


def main():
    if not HAS_MATPLOTLIB:
        print("Error: matplotlib required. Install with: pip install matplotlib")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Plot regime change trajectory data")

    # Selection options
    parser.add_argument("--countries", type=str, help="Comma-separated country IDs (e.g., iraq,libya,tunisia)")
    parser.add_argument("--region", type=str, help="Filter by region (e.g., mena, africa_peaceful)")
    parser.add_argument("--category", type=str, help="Filter by category (e.g., violent_unstable, peaceful_successful)")

    # What to plot
    parser.add_argument("--dimension", type=str, choices=["political", "economic", "international", "transparency", "composite"],
                        default="composite", help="Which dimension to plot (default: composite)")
    parser.add_argument("--indicator", type=str, help="Specific indicator to plot (requires --dimension)")
    parser.add_argument("--show-indicators", action="store_true", help="Show all indicators within selected dimension")
    parser.add_argument("--show-dimensions", action="store_true", help="Show all 4 dimensions (single country only)")

    # Plot style
    parser.add_argument("--overlay", action="store_true", help="Overlay all countries on one plot (default: separate)")
    parser.add_argument("--align-regime-change", action="store_true", help="Align x-axis to regime change year (year 0)")
    parser.add_argument("--plot-type", choices=["line", "heatmap"], default="line", help="Plot type")

    # Output
    parser.add_argument("--output", type=str, help="Save plot to file (e.g., plots/output.png)")
    parser.add_argument("--dpi", type=int, default=150, help="DPI for saved image")
    parser.add_argument("--list-regions", action="store_true", help="List available regions and exit")
    parser.add_argument("--list-categories", action="store_true", help="List available categories and exit")

    args = parser.parse_args()

    project_root = get_project_root()
    countries_config = load_countries_config(project_root)

    # List options
    if args.list_regions:
        print("Available regions:")
        for r in get_available_regions(countries_config):
            count = len(get_countries_for_region(countries_config, r))
            print(f"  {r} ({count} countries)")
        return

    if args.list_categories:
        print("Available categories:")
        for c in get_available_categories(countries_config):
            count = len(get_countries_for_category(countries_config, c))
            print(f"  {c} ({count} countries)")
        return

    # Determine which countries to include
    target_countries = None
    if args.countries:
        target_countries = [c.strip() for c in args.countries.split(",")]
        invalid = [c for c in target_countries if c not in countries_config]
        if invalid:
            print(f"Warning: Unknown countries ignored: {invalid}")
            target_countries = [c for c in target_countries if c in countries_config]
    elif args.region:
        target_countries = get_countries_for_region(countries_config, args.region)
        if not target_countries:
            print(f"Error: No countries found for region '{args.region}'")
            print(f"Available: {get_available_regions(countries_config)}")
            sys.exit(1)
    elif args.category:
        target_countries = get_countries_for_category(countries_config, args.category)
        if not target_countries:
            print(f"Error: No countries found for category '{args.category}'")
            print(f"Available: {get_available_categories(countries_config)}")
            sys.exit(1)

    if not target_countries:
        print("Error: Specify --countries, --region, or --category")
        sys.exit(1)

    # Load data
    data = load_scores(project_root, set(target_countries))

    if not data:
        print("Error: No score data found for selected countries. Run generate_scores.py first.")
        sys.exit(1)

    # Get regime change years
    regime_change_years = {c: get_regime_change_year(countries_config, c) for c in target_countries}
    regime_change_years = {k: v for k, v in regime_change_years.items() if v is not None}

    # Determine what to plot
    fig = None

    if args.show_dimensions:
        # All 4 dimensions for a single country
        if len(target_countries) != 1:
            print("Error: --show-dimensions requires exactly one country")
            sys.exit(1)
        fig = plot_dimensions_single_country(data, target_countries[0], countries_config, regime_change_years)
        title = f"{countries_config[target_countries[0]]['display_name']} - All Dimensions"

    elif args.show_indicators:
        # All indicators within a dimension for a single country
        if len(target_countries) != 1:
            print("Error: --show-indicators requires exactly one country")
            sys.exit(1)
        if args.dimension == "composite":
            print("Error: --show-indicators requires --dimension (not composite)")
            sys.exit(1)
        fig = plot_indicators_single_country(data, target_countries[0], args.dimension,
                                              countries_config, regime_change_years)
        title = f"{args.dimension.capitalize()} Indicators"

    elif args.indicator:
        # Specific indicator
        if args.dimension == "composite":
            print("Error: --indicator requires --dimension")
            sys.exit(1)
        scores = extract_indicator_scores(data, args.dimension, args.indicator)
        title = f"{args.indicator.replace('_', ' ').title()} ({args.dimension.capitalize()})"

        if args.plot_type == "heatmap":
            fig = plot_heatmap(scores, countries_config, title, regime_change_years)
        elif args.overlay:
            fig = plot_time_series_overlay(scores, countries_config, title,
                                           align_regime_change=args.align_regime_change,
                                           regime_change_years=regime_change_years)
        else:
            fig = plot_time_series_separate(scores, countries_config, title,
                                            regime_change_years=regime_change_years)

    else:
        # Dimension or composite scores
        if args.dimension == "composite":
            scores = extract_dimension_scores(data, "_composite")
            title = "Composite Score"
        else:
            scores = extract_dimension_scores(data, args.dimension)
            title = f"{args.dimension.capitalize()} Dimension"

        # Add context to title
        if args.region:
            title += f" - {args.region.replace('_', ' ').title()}"
        elif args.category:
            title += f" - {args.category.replace('_', ' ').title()}"

        if args.plot_type == "heatmap":
            fig = plot_heatmap(scores, countries_config, title, regime_change_years)
        elif args.overlay:
            fig = plot_time_series_overlay(scores, countries_config, title,
                                           align_regime_change=args.align_regime_change,
                                           regime_change_years=regime_change_years)
        else:
            fig = plot_time_series_separate(scores, countries_config, title,
                                            regime_change_years=regime_change_years)

    if fig is None:
        print("Error: No data to plot")
        sys.exit(1)

    # Output
    if args.output:
        output_path = project_root / args.output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=args.dpi, bbox_inches='tight')
        print(f"Saved: {output_path}")
    else:
        plt.show()


if __name__ == "__main__":
    main()

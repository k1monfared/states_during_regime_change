#!/usr/bin/env python3
"""Generate summary visualizations for the README."""

import csv
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import numpy as np
import yaml

ROOT = Path(__file__).resolve().parent.parent.parent


def load_countries_config():
    with open(ROOT / "data" / "config" / "countries.yaml") as f:
        return yaml.safe_load(f)


def load_combined():
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    with open(ROOT / "data" / "derived" / "combined.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            country = row["country"]
            year = int(row["year"])
            dimension = row["dimension"]
            indicator = row["indicator"]
            score = row["score"]
            if score:
                data[country][year][dimension][indicator] = float(score)
    return data


def get_composite_scores(data, countries_config):
    """Extract composite scores for all countries."""
    result = {}
    for country, years_data in data.items():
        scores = []
        for year in sorted(years_data.keys()):
            comp = years_data[year].get("_composite", {}).get("_composite_score")
            if comp is not None:
                scores.append((year, comp))
        if scores:
            result[country] = scores
    return result


def plot_all_regions_panel(data, countries_config):
    """Create a 2x3 panel plot, one per region."""
    regions = {
        'mena': 'Middle East & North Africa',
        'africa_violent': 'Africa (Violent Transitions)',
        'africa_peaceful': 'Africa (Peaceful Transitions)',
        'eastern_europe': 'Eastern Europe',
        'asia': 'Asia',
        'latin_america': 'Latin America',
    }

    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    axes = axes.flatten()
    colors = cm.tab10.colors

    for idx, (region_id, region_name) in enumerate(regions.items()):
        ax = axes[idx]
        region_countries = [cid for cid, cfg in countries_config.items()
                           if cfg.get("region") == region_id]

        for i, cid in enumerate(sorted(region_countries)):
            years_data = data.get(cid, {})
            scores = []
            for year in sorted(years_data.keys()):
                comp = years_data[year].get("_composite", {}).get("_composite_score")
                if comp is not None:
                    scores.append((year, comp))
            if scores:
                years, vals = zip(*scores)
                display = countries_config[cid].get("display_name", cid)
                ax.plot(years, vals, marker='.', markersize=3, label=display,
                        color=colors[i % len(colors)], linewidth=1.5)

                # Regime change markers
                rc_years = countries_config[cid].get("regime_change_years", [])
                for rcy in rc_years:
                    if min(years) <= rcy <= max(years):
                        ax.axvline(x=rcy, color=colors[i % len(colors)],
                                   linestyle='--', alpha=0.4, linewidth=0.8)

        ax.set_title(region_name, fontsize=10, fontweight='bold')
        ax.set_ylim(0, 100)
        ax.set_ylabel("Composite Score" if idx % 3 == 0 else "")
        ax.grid(True, alpha=0.2)
        ax.legend(loc='best', fontsize=6, ncol=1)

    fig.suptitle("Composite Trajectory Scores by Region (0-100)", fontsize=14, fontweight='bold', y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    out = ROOT / "plots" / "readme" / "all_regions_panel.png"
    fig.savefig(out, dpi=150, bbox_inches='tight')
    print(f"Saved: {out}")
    plt.close(fig)


def plot_violent_vs_peaceful(data, countries_config):
    """Compare average trajectories of violent vs peaceful transitions, aligned to regime change."""
    violent_cats = {'violent_unstable', 'violent_recurring', 'violent_regression',
                    'violent_then_recovery', 'violent_then_stabilization',
                    'violent_then_peaceful', 'peaceful_then_violent'}
    peaceful_cats = {'peaceful_successful', 'peaceful_then_backsliding',
                     'peaceful_electoral', 'peaceful_external_pressure',
                     'peaceful_institutional', 'peaceful_persistent_instability',
                     'mostly_peaceful', 'managed_partial'}

    def get_aligned(categories):
        all_aligned = defaultdict(list)
        for cid, cfg in countries_config.items():
            if cfg.get("category") not in categories:
                continue
            rc_years = cfg.get("regime_change_years", [])
            if not rc_years:
                continue
            rc = rc_years[0]
            years_data = data.get(cid, {})
            for year in sorted(years_data.keys()):
                comp = years_data[year].get("_composite", {}).get("_composite_score")
                if comp is not None:
                    t = year - rc
                    if -15 <= t <= 20:
                        all_aligned[t].append(comp)
        return all_aligned

    violent_aligned = get_aligned(violent_cats)
    peaceful_aligned = get_aligned(peaceful_cats)

    fig, ax = plt.subplots(figsize=(12, 6))

    # Plot violent average
    t_vals = sorted(violent_aligned.keys())
    means = [np.mean(violent_aligned[t]) for t in t_vals]
    stds = [np.std(violent_aligned[t]) for t in t_vals]
    ax.plot(t_vals, means, color='red', linewidth=2.5, label='Violent transitions (avg)')
    ax.fill_between(t_vals,
                     [m - s for m, s in zip(means, stds)],
                     [m + s for m, s in zip(means, stds)],
                     color='red', alpha=0.15)

    # Plot peaceful average
    t_vals = sorted(peaceful_aligned.keys())
    means = [np.mean(peaceful_aligned[t]) for t in t_vals]
    stds = [np.std(peaceful_aligned[t]) for t in t_vals]
    ax.plot(t_vals, means, color='green', linewidth=2.5, label='Peaceful transitions (avg)')
    ax.fill_between(t_vals,
                     [m - s for m, s in zip(means, stds)],
                     [m + s for m, s in zip(means, stds)],
                     color='green', alpha=0.15)

    ax.axvline(x=0, color='black', linestyle='--', alpha=0.7, linewidth=2, label='Regime change')
    ax.set_xlabel("Years relative to regime change", fontsize=12)
    ax.set_ylabel("Composite Score (0-100)", fontsize=12)
    ax.set_title("Violent vs. Peaceful Transitions: Average Trajectories", fontsize=14, fontweight='bold')
    ax.set_ylim(0, 100)
    ax.legend(loc='best', fontsize=10)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    out = ROOT / "plots" / "readme" / "violent_vs_peaceful.png"
    fig.savefig(out, dpi=150, bbox_inches='tight')
    print(f"Saved: {out}")
    plt.close(fig)


def plot_dimension_recovery(data, countries_config):
    """Show which dimensions recover first after regime change (all countries averaged)."""
    dimensions = ["political", "economic", "international", "transparency"]
    dim_colors = {"political": "#e74c3c", "economic": "#27ae60",
                  "international": "#2980b9", "transparency": "#8e44ad"}

    fig, ax = plt.subplots(figsize=(12, 6))

    for dim in dimensions:
        aligned = defaultdict(list)
        for cid, cfg in countries_config.items():
            rc_years = cfg.get("regime_change_years", [])
            if not rc_years:
                continue
            rc = rc_years[0]
            years_data = data.get(cid, {})
            for year in sorted(years_data.keys()):
                score = years_data[year].get(dim, {}).get("_dimension_score")
                if score is not None:
                    t = year - rc
                    if -15 <= t <= 20:
                        aligned[t].append(score)

        t_vals = sorted(aligned.keys())
        if t_vals:
            means = [np.mean(aligned[t]) for t in t_vals]
            ax.plot(t_vals, means, color=dim_colors[dim], linewidth=2.5,
                    label=dim.capitalize(), marker='.', markersize=4)

    ax.axvline(x=0, color='black', linestyle='--', alpha=0.7, linewidth=2, label='Regime change')
    ax.set_xlabel("Years relative to regime change", fontsize=12)
    ax.set_ylabel("Dimension Score (0-100)", fontsize=12)
    ax.set_title("Average Dimension Scores Around Regime Change (All Countries)", fontsize=14, fontweight='bold')
    ax.set_ylim(0, 100)
    ax.legend(loc='best', fontsize=10)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    out = ROOT / "plots" / "readme" / "dimension_recovery.png"
    fig.savefig(out, dpi=150, bbox_inches='tight')
    print(f"Saved: {out}")
    plt.close(fig)


def plot_data_coverage_heatmap(data, countries_config):
    """Show a data coverage heatmap -- which country-years have composite scores."""
    countries_sorted = sorted(countries_config.keys(),
                               key=lambda c: countries_config[c].get("region", ""))

    # Get all years
    all_years = set()
    for cid in countries_sorted:
        all_years.update(data.get(cid, {}).keys())
    years = sorted(all_years)
    if not years:
        return

    matrix = np.full((len(countries_sorted), len(years)), np.nan)
    for i, cid in enumerate(countries_sorted):
        for j, year in enumerate(years):
            comp = data.get(cid, {}).get(year, {}).get("_composite", {}).get("_composite_score")
            if comp is not None:
                matrix[i, j] = comp

    fig, ax = plt.subplots(figsize=(20, 12))
    im = ax.imshow(matrix, aspect='auto', cmap='RdYlGn', vmin=0, vmax=100)

    display_names = [countries_config[c].get("display_name", c) for c in countries_sorted]
    ax.set_yticks(range(len(countries_sorted)))
    ax.set_yticklabels(display_names, fontsize=7)

    step = max(1, len(years) // 25)
    ax.set_xticks(range(0, len(years), step))
    ax.set_xticklabels([years[i] for i in range(0, len(years), step)], fontsize=8, rotation=45)

    # Add regime change markers
    for i, cid in enumerate(countries_sorted):
        for rcy in countries_config[cid].get("regime_change_years", []):
            if rcy in years:
                j = years.index(rcy)
                ax.plot(j, i, 'k|', markersize=10, markeredgewidth=2)

    ax.set_title("Composite Scores: All 40 Countries (black marks = regime change)", fontsize=14, fontweight='bold')
    ax.set_xlabel("Year")
    cbar = plt.colorbar(im, ax=ax, shrink=0.6)
    cbar.set_label("Composite Score (0-100)")

    plt.tight_layout()
    out = ROOT / "plots" / "readme" / "full_heatmap.png"
    fig.savefig(out, dpi=150, bbox_inches='tight')
    print(f"Saved: {out}")
    plt.close(fig)


if __name__ == "__main__":
    countries_config = load_countries_config()
    data = load_combined()

    plot_all_regions_panel(data, countries_config)
    plot_violent_vs_peaceful(data, countries_config)
    plot_dimension_recovery(data, countries_config)
    plot_data_coverage_heatmap(data, countries_config)

    print("\nAll summary plots generated.")

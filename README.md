# Regime Change Trajectory Analysis

**Live**: https://k1monfared.github.io/states_during_regime_change/

**Status**: 🟡 MVP | **Mode**: 🤖 Claude Code | **Updated**: 2026-01-24

A data framework for measuring and comparing post-regime-change trajectories across 39 countries. Tracks four dimensions (political, economic, international, transparency) over time using a combination of quantitative data and qualitative expert assessments.

## Goal

Create comparable, time-series scores (0-100) for countries that underwent regime changes, enabling:
- Cross-country trajectory comparison (who recovers faster, who collapses further)
- Identification of patterns across regime change types (violent vs peaceful, external vs internal)
- Tracking of which dimensions recover first and which lag

## Quick Start

```bash
# Generate template files for all countries (already done, safe to re-run)
python3 data/scripts/scaffold.py

# Collect data for a country (using Claude Code)
/collect-data iraq 2003-2005

# Validate data files
python3 data/scripts/validate.py
python3 data/scripts/validate.py --country iraq

# Generate scores from collected data
python3 data/scripts/generate_scores.py
python3 data/scripts/generate_scores.py --country iraq --verbose --only-scored
```

## Project Structure

```
data/
├── config/                           # Configuration (edit these to change behavior)
│   ├── countries.yaml                # Country metadata, time ranges, categories
│   ├── indicators.yaml               # 20 indicator definitions + valid feature vocabulary
│   ├── scoring_rubrics.yaml          # How raw data maps to 0-100 scores
│   └── aggregation.yaml             # How scores combine (weights, functions, missing data)
│
├── raw/                              # Collected data (780 files, one per country/indicator)
│   └── <country>/<dimension>/<indicator>.yaml
│
├── derived/                          # Generated output (never hand-edit, gitignored)
│   ├── scores/<country>.csv
│   └── combined.csv
│
└── scripts/                          # Pipeline tools
    ├── scaffold.py                   # Creates template files from config
    ├── generate_scores.py            # Converts raw data to scores
    └── validate.py                   # Checks data quality and completeness
```

## The Four Dimensions (5 indicators each)

| Dimension | Indicators |
|-----------|-----------|
| **Political** | Territorial control, Political violence, Institutional functioning, Civil liberties, Elite cohesion |
| **Economic** | GDP per capita, Inflation, Unemployment, Trade openness, Fiscal health |
| **International** | Sanctions, Diplomatic integration, Foreign military presence, FDI, Refugee flows |
| **Transparency** | Budget transparency, Press freedom, Statistical transparency, Legal transparency, Extractive transparency |

## How Scoring Works

1. **Raw data** lives in YAML files per country/indicator with per-year entries
2. Each year has optional `quantitative` (numeric value + source) and `qualitative` (assessment + feature tags + sources)
3. **Scoring rubrics** convert raw data to 0-100 scores using threshold tables and feature mappings
4. **Aggregation** combines indicator scores into dimension scores, then into a composite score
5. All weights default to equal (1.0) but are configurable in `aggregation.yaml`

## Raw Data File Format

Each file (e.g., `data/raw/iraq/political/territorial_control.yaml`) contains:

```yaml
indicator: territorial_control
country: iraq
dimension: political

years:
  2003:
    data_status: partial        # complete | partial | missing | unavailable
    quantitative:
      value: null               # numeric or null
      unit: percent_territory_controlled
      source:
        citation: "..."
        url: "..."
        access_date: "2025-01-20"
      reliability: medium       # high | medium | low
    qualitative:
      assessment: |
        Free-text description of the situation.
      features:                 # Tags from controlled vocabulary in indicators.yaml
        - large_portions_contested_30_50pct
        - foreign_occupation
      sources:
        - citation: "ICG Report 2003"
          type: think_tank_report
          reliability: high
      confidence: medium        # high | medium | low
      notes: "Any caveats"
```

## Collecting Data

### Using Claude Code (recommended)

```
/collect-data <country_id> <year_range> [indicator_filter]
```

Examples:
- `/collect-data iraq 2003-2005` — all indicators for Iraq 2003-2005
- `/collect-data tunisia 2011 political` — political indicators only
- `/collect-data ghana 2000-2010` — all indicators for Ghana 2000-2010

### Manually

Edit the YAML files directly. Only modify the year entries you're filling in. Use features from the controlled vocabulary in `data/config/indicators.yaml`.

## Adding a New Country

1. Add an entry to `data/config/countries.yaml`:
   ```yaml
   new_country:
     display_name: "New Country"
     region: region_name
     category: category_name
     regime_change_years: [2020]
     notes: "Context about the transition"
   ```
   Note: `time_range` is **optional** — it's auto-calculated as `(earliest_regime_change - 15, current_year)`. Only specify if you need to override.

2. Run scaffold: `python3 data/scripts/scaffold.py --country new_country`
3. Collect data: `/collect-data new_country`

## Changing Scoring Behavior

- **Adjust which features map to which scores**: Edit `data/config/scoring_rubrics.yaml`
- **Change aggregation weights**: Edit `data/config/aggregation.yaml` (set weight > 1.0 to emphasize, < 1.0 to de-emphasize)
- **Change how missing data is handled**: In `aggregation.yaml`, set `missing_data_handling` to:
  - `skip_and_renormalize` — average only available indicators (default)
  - `use_zero` — treat missing as 0
  - `exclude_year` — don't produce a score if any indicator is missing

After changes, regenerate: `python3 data/scripts/generate_scores.py`

## Countries Covered (39)

**MENA**: Iraq, Libya, Egypt, Syria, Yemen, Tunisia, Afghanistan, Algeria

**Africa (Violent)**: DRC, Sierra Leone, Liberia, Cote d'Ivoire, CAR, Mali, Sudan, Burkina Faso, Ethiopia, South Sudan

**Africa (Peaceful)**: South Africa, Ghana, Senegal, Kenya, The Gambia, Malawi

**Eastern Europe**: Serbia, Georgia, Kyrgyzstan, Ukraine, Armenia, Croatia, Slovakia

**Asia**: Indonesia, Nepal, Myanmar, East Timor, Malaysia

**Latin America**: Venezuela, Peru, Mexico

## Plotting Data

### Using Claude Code

```
/plot-data iraq                              # single country, all dimensions
/plot-data mena overlay                      # MENA region overlaid
/plot-data africa_peaceful aligned           # aligned to regime change year
```

### Direct Script Usage

```bash
# Single country with all 4 dimensions
python3 data/scripts/plot_data.py --countries iraq --show-dimensions --output plots/iraq.png

# Multiple countries overlaid
python3 data/scripts/plot_data.py --countries iraq,libya,tunisia --overlay

# Region comparison aligned to regime change
python3 data/scripts/plot_data.py --region africa_peaceful --overlay --align-regime-change

# Specific indicator comparison
python3 data/scripts/plot_data.py --countries iraq,syria --dimension political --indicator territorial_control --overlay

# Heatmap view
python3 data/scripts/plot_data.py --region mena --plot-type heatmap --output plots/mena_heatmap.png

# List available regions/categories
python3 data/scripts/plot_data.py --list-regions
python3 data/scripts/plot_data.py --list-categories
```

### Plot Types

| Type | Use case |
|------|----------|
| Line (separate) | Compare trajectories across countries (default) |
| Line (overlay) | Direct comparison on same axes |
| Line (aligned) | Compare recovery/decline patterns relative to regime change |
| Heatmap | Overview of many countries × many years |

## Dependencies

- Python 3.6+
- PyYAML (`pip install pyyaml`)
- matplotlib (`pip install matplotlib`) — for plotting
- numpy (`pip install numpy`) — for heatmaps

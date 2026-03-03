---
name: pipeline
layer: 1-general
purpose: Reference for all 8 Python scripts — arguments, prerequisites, expected outputs, common errors
used_by: [validate-data, generate-scores, scaffold-country, analyze-country, compare, collect-data]
---

# Pipeline — Script Reference

All scripts live in `data/scripts/`. Run from the project root.

---

## Scoring pipeline (original 4 scripts)

### scaffold.py

**Purpose**: Create raw YAML file skeletons for new countries or extend time ranges.

```bash
python3 data/scripts/scaffold.py --country <country_id>   # new country or extend range
python3 data/scripts/scaffold.py                           # scaffold ALL countries
```

Prerequisites: country entry in `data/config/countries.yaml`; `time_range` determines years scaffolded.
Output: `data/raw/<country_id>/<dimension>/<indicator>.yaml` — existing year entries never overwritten.

---

### validate.py

```bash
python3 data/scripts/validate.py
python3 data/scripts/validate.py --country <country_id>
python3 data/scripts/validate.py --country <country_id> --strict
```

Output: per-indicator completeness counts, critical errors (schema violations), warnings (missing quant values).
Critical errors must be resolved before scoring. Warnings are informational.

---

### generate_scores.py

```bash
python3 data/scripts/generate_scores.py
python3 data/scripts/generate_scores.py --country <country_id>
python3 data/scripts/generate_scores.py --country <country_id> --verbose --only-scored
```

Output: `data/derived/scores/<country_id>.csv` — columns: country, year, all 48 indicators, 6 dimensions, composite.

---

### plot_data.py

```bash
python3 data/scripts/plot_data.py --countries <id> --show-dimensions --output plots/<id>_dimensions.png
python3 data/scripts/plot_data.py --countries iraq,tunisia --overlay --output plots/comparison.png
python3 data/scripts/plot_data.py --region mena --dimension political --plot-type heatmap
```

Prerequisites: `data/derived/scores/<country_id>.csv` must exist.

---

## Data management pipeline (new scripts)

### download_canonical.py

**Purpose**: Bulk-download canonical series from World Bank API. Other sources (ILO, UCDP, UNHCR) require manual download for now.

```bash
# Status overview
python3 data/scripts/download_canonical.py --status

# Download all priority-1 World Bank series (dry run first)
python3 data/scripts/download_canonical.py --source worldbank --priority 1 --dry-run
python3 data/scripts/download_canonical.py --source worldbank --priority 1

# Download a specific series
python3 data/scripts/download_canonical.py --series WB_SP.POP.TOTL

# Re-download even if CSV already exists
python3 data/scripts/download_canonical.py --source worldbank --priority 1 --force

# Download only specific countries (default: all 40)
python3 data/scripts/download_canonical.py --series WB_SP.POP.TOTL --countries IRQ,SYR,EGY
```

**Flags**:
| Flag | Default | Description |
|------|---------|-------------|
| `--source` | — | `worldbank`, `ilo`, `ucdp`, `acled`, `unhcr`, `vdem`, `imf`, `all` |
| `--priority` | all | `1`, `2`, or `3` — filters by series priority level |
| `--series` | — | download a single series by ID (e.g. `WB_SP.POP.TOTL`) |
| `--countries` | all 40 | comma-separated ISO3 codes |
| `--force` | false | re-download even if CSV exists |
| `--dry-run` | false | print what would be downloaded without writing files |
| `--status` | false | print download status table and exit |

**Current status** (as of 2026-03-03):
- World Bank: 38/88 series downloaded (priority-1 complete; priority-2/3 not yet run)
- ILO, UCDP, ACLED, UNHCR, V-Dem, IMF, UNDP: 0 downloaded (manual download required — see source skills)

**Output**: CSVs to `data/canonical/world_bank/<CODE>.csv`; status logs to `data/canonical/status/WB_<CODE>.yaml`; registry updated automatically.

**Note on SM.POP.REFG.OR**: This WB series returns no data via the API (refugees as % population). Use UNHCR directly — see `source-unhcr` skill.

---

### build_coverage.py

**Purpose**: Reads all canonical CSVs → generates coverage index and fundamental data files for the dashboard.

```bash
python3 data/scripts/build_coverage.py              # full rebuild
python3 data/scripts/build_coverage.py --country iraq   # single country (updates all files)
python3 data/scripts/build_coverage.py --summary    # print coverage table and exit
```

**Output**:
| File | Size | Description |
|------|------|-------------|
| `docs/data/coverage.json` | ~7 MB | Full coverage matrix: country × series × year × {status, value, verified} |
| `docs/data/fundamental.json` | ~1.2 MB | Flat lookup: country → series → year → value (for dashboard) |
| `docs/data/raw/<country>_fundamental.json` | per-country | Per-country fundamental series for the Countries page |

**Must be run after**: any new canonical CSV is added or updated.
**Must be run before**: `export_web.py` (so fundamental.json is populated).

**Current coverage** (2026-03-03): 59,720/76,160 observations available (78.4%)
Highest-coverage countries: Peru 93.8%, Indonesia 92.8%, Malaysia 92.4%
Lowest-coverage countries: South Sudan 40.3%, East Timor 53.2%, Serbia 59.3%

---

### compute_derived.py

**Purpose**: For each indicator that has a formula + canonical component series, compute `calculated_value` and fill `value` where missing.

```bash
python3 data/scripts/compute_derived.py               # all countries and indicators
python3 data/scripts/compute_derived.py --country iraq
python3 data/scripts/compute_derived.py --country iraq --indicator economic/trade_openness
python3 data/scripts/compute_derived.py --dry-run     # show what would change without writing
```

**Supported formulas**:
| Indicator slug | Formula | Components needed |
|----------------|---------|------------------|
| `trade_openness` | `(exports + imports) / gdp * 100` | WB_NE.EXP.GNFS.CD, WB_NE.IMP.GNFS.CD, WB_NY.GDP.MKTP.CD |
| `gdp_per_capita` | `gdp_usd / population` | WB_NY.GDP.MKTP.CD, WB_SP.POP.TOTL |
| `gini_adjusted_gdp_per_capita` | `gdp_pc * (1 - gini/100)` | WB_NY.GDP.PCAP.CD, WB_SI.POV.GINI |
| `gini_adjusted_gdp_per_capita_ppp` | `gdp_pc_ppp * (1 - gini/100)` | WB_NY.GDP.PCAP.PP.CD, WB_SI.POV.GINI |
| `refugee_flows` | `(refugees + idps) / population * 100` | UNHCR series (not yet downloaded) |
| `natural_resource_rents` | sum of 5 sub-rents | WB_NY.GDP.PETR.RT.ZS + 4 others |
| `unemployment` | `unemployed / labor_force * 100` | ILO series (not yet downloaded) |

**Behaviour**:
- Sets `quantitative.calculated_value` on every year where all components are available
- If `quantitative.value` is null (no downloaded value), also sets `value` and `value_source: calculated`
- If `value` already exists (`value_source: downloaded`), leaves it untouched — downloaded wins

**Last run results** (2026-03-03): 2,510 `calculated_value` fields computed; 204 missing gaps filled.

**Must be run after**: `build_coverage.py` (needs CSVs loaded), any new WB series downloaded.
**Must be run before**: `generate_scores.py` and `export_web.py` (so calculated values are in the YAML).

---

### verify.py

**Purpose**: Human verification of canonical data points — marks observations as human-checked in `data/verification.json`.

```bash
# Verify a single observation
python3 data/scripts/verify.py --series WB_SP.POP.TOTL --country iraq --year 2003

# With a note
python3 data/scripts/verify.py --series WB_SP.POP.TOTL --country iraq --year 2003 \
  --note "Cross-checked with UN DESA WPP 2024"

# Remove verification
python3 data/scripts/verify.py --unverify --series WB_SP.POP.TOTL --country iraq --year 2003

# List verifications for a country
python3 data/scripts/verify.py --list --country iraq

# Overall stats
python3 data/scripts/verify.py --stats

# Bulk-verify all available observations for a series
python3 data/scripts/verify.py --bulk --series WB_SP.POP.TOTL
```

**Verification records** go to `data/verification.json`, keyed as `"SERIES_ID/country_id/year"`.
Verification status is shown in the `/audit` UI and in per-country fundamental pages.

---

## Full pipeline sequences

### New country (scoring only)
```bash
# 1. Add to data/config/countries.yaml
python3 data/scripts/scaffold.py --country <id>
# 2. Fill data (/collect-data)
python3 data/scripts/validate.py --country <id>
python3 data/scripts/generate_scores.py --country <id> --verbose
python3 data/scripts/export_web.py
```

### After downloading new canonical series
```bash
python3 data/scripts/download_canonical.py --source worldbank --priority 2
python3 data/scripts/build_coverage.py
python3 data/scripts/compute_derived.py
python3 data/scripts/generate_scores.py   # re-score with newly filled values
python3 data/scripts/export_web.py
```

### Full rebuild from scratch
```bash
python3 data/scripts/download_canonical.py --source worldbank --priority 1
python3 data/scripts/build_coverage.py
python3 data/scripts/compute_derived.py
python3 data/scripts/validate.py
python3 data/scripts/generate_scores.py
python3 data/scripts/export_web.py
```

---

## Dependency graph

```
countries.yaml
  └─ scaffold.py → data/raw/**/*.yaml  (filled by /collect-data)
                       ├─ validate.py
                       └─ generate_scores.py → data/derived/scores/*.csv → plot_data.py

data/canonical/world_bank/*.csv  (from download_canonical.py)
  └─ build_coverage.py → docs/data/coverage.json
                          docs/data/fundamental.json       → export_web.py → docs/data/
  └─ compute_derived.py → fills YAML calculated_value fields ─────────────────────────┘
```

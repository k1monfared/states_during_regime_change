---
name: pipeline
layer: 1-general
purpose: Reference for the 4 Python scripts — arguments, prerequisites, expected outputs, common errors
used_by: [validate-data, generate-scores, scaffold-country, analyze-country, compare]
---

# Pipeline — Script Reference

All scripts live in `data/scripts/`. Run from the project root.

## Script 1: scaffold.py

**Purpose**: Create raw YAML file skeletons for new countries or extend time ranges.

### Usage

```bash
# Scaffold a brand-new country (must already be in countries.yaml)
python3 data/scripts/scaffold.py --country <country_id>

# Re-run to add new year entries after extending time_range in countries.yaml
python3 data/scripts/scaffold.py --country <country_id>

# Scaffold ALL countries (adds missing files, skips existing)
python3 data/scripts/scaffold.py
```

### Prerequisites
- Country entry must exist in `data/config/countries.yaml` before running
- `time_range` in countries.yaml determines which years are scaffolded

### Expected Output
- Creates `data/raw/<country_id>/<dimension>/<indicator>.yaml` for each of the 20 indicators
- Reports: number of files created vs. skipped (already existed)
- Existing year entries are never overwritten; new years are appended

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| `Country not found in config` | country_id not in countries.yaml | Add the entry first |
| `FileNotFoundError` | Missing dimension directory | Script creates dirs automatically; check permissions |

---

## Script 2: validate.py

**Purpose**: Check raw YAML files for completeness and schema correctness.

### Usage

```bash
# Validate all countries
python3 data/scripts/validate.py

# Validate one country
python3 data/scripts/validate.py --country <country_id>

# Strict mode (treat warnings as errors)
python3 data/scripts/validate.py --country <country_id> --strict
```

### Prerequisites
- Raw YAML files must exist (run scaffold.py first)
- `data/config/indicators.yaml` must be readable

### Expected Output

```
Validating <country_id>...
  territorial_control: 18/30 years complete, 5 partial, 7 missing
  ...
Summary:
  Coverage: 62%
  Critical errors: 2 (schema violations)
  Warnings: 8 (missing quantitative values)
```

### Output Interpretation
- **Critical errors**: Schema violations, invalid feature tags, malformed YAML — must fix before scoring
- **Warnings**: Missing quantitative values, low confidence entries, missing sources — scoring will proceed but quality notes are added
- **Coverage %**: (complete + partial years) / total expected years × 100

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid feature tag` | Feature not in valid_features list | Check indicators.yaml for correct tag |
| `YAML parse error` | Malformed YAML | Validate YAML syntax; check indentation |
| `Missing required field` | `data_status` or `features` absent | Fill in the field |

---

## Script 3: generate_scores.py

**Purpose**: Convert raw YAML feature data into 0–100 numerical scores.

### Usage

```bash
# Score all countries
python3 data/scripts/generate_scores.py

# Score one country
python3 data/scripts/generate_scores.py --country <country_id>

# Score with verbose output (shows per-indicator breakdown)
python3 data/scripts/generate_scores.py --country <country_id> --verbose

# Only output rows where at least one score was computed
python3 data/scripts/generate_scores.py --country <country_id> --only-scored
```

### Prerequisites
- Raw YAML files must exist and pass validation (critical errors must be resolved)
- `data/config/scoring_rubrics.yaml` and `data/config/aggregation.yaml` must be readable

### Expected Output

**Console** (verbose mode):
```
Iraq 2003:
  territorial_control: features=[large_portions_contested_30_50pct, foreign_occupation] → score=28
  political_violence: ...
  ...
  political_dimension: 34.2
  composite: 41.8
```

**File**: `data/derived/scores/<country_id>.csv`

CSV columns: `country, year, <indicator_1>, ..., <indicator_20>, political, economic, international, transparency, composite`

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| `No valid features found` | Features list empty or all null | Fill features or set data_status: missing |
| `Scoring rubric missing for feature` | Feature in YAML not in rubrics | Add rubric or fix feature tag |
| `KeyError: country not in aggregation` | Country missing from aggregation.yaml | Add entry or check country_id spelling |

---

## Script 4: plot_data.py

**Purpose**: Generate visualizations from computed scores.

### Usage — see `.claude/commands/plot-data.md` for full details

```bash
# Quick single-country check
python3 data/scripts/plot_data.py --countries <country_id> --show-dimensions --output plots/<country_id>_dimensions.png

# Overlay multiple countries
python3 data/scripts/plot_data.py --countries iraq,tunisia --overlay --output plots/comparison.png

# Region heatmap
python3 data/scripts/plot_data.py --region mena --dimension political --plot-type heatmap
```

### Prerequisites
- Score CSV must exist: `data/derived/scores/<country_id>.csv`
- `matplotlib` and `numpy` installed
- Run generate_scores.py first if scores are stale

### Expected Output
- PNG file at specified `--output` path (or displayed interactively if no --output)

---

## Typical Full Pipeline Sequence

```bash
# 1. Add country to countries.yaml (if new)
# 2. Scaffold
python3 data/scripts/scaffold.py --country <id>
# 3. Fill data (use /collect-data command)
# 4. Validate
python3 data/scripts/validate.py --country <id>
# 5. Score
python3 data/scripts/generate_scores.py --country <id> --verbose --only-scored
# 6. Plot
python3 data/scripts/plot_data.py --countries <id> --show-dimensions --output plots/<id>_dimensions.png
```

## Dependency Order

```
countries.yaml
    └─ scaffold.py  →  data/raw/<country>/**/*.yaml  (filled by collect-data)
                            └─ validate.py  (check quality)
                            └─ generate_scores.py  →  data/derived/scores/<country>.csv
                                                            └─ plot_data.py  →  plots/*.png
```

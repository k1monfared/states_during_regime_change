# Compare Countries or Groups

Generate cross-country or cross-group comparisons using the plotting pipeline and produce a narrative analysis.

## Skills Referenced
- `pipeline`: generate_scores.py and plot_data.py arguments
- `country-config`: regions and categories

## Input

Flexible arguments. Examples:
- `/compare iraq,tunisia` — two specific countries
- `/compare --region mena` — all MENA countries
- `/compare --category violent_then_recovery` — all countries in a category
- `/compare iraq,tunisia --dimension political` — specific dimension
- `/compare --region eastern_europe --align-regime-change` — aligned by regime change year

Parse `$ARGUMENTS` to identify:
1. Target selection: country list, region, or category
2. Optional: dimension (default: composite)
3. Optional: align-regime-change flag
4. Optional: specific plot type (line or heatmap)

## Process

### Step 1 — Resolve country list

If `--region <region>` or `--category <category>`: read `data/config/countries.yaml` to get the list of countries in that group.

If specific countries: use the list as-is.

### Step 2 — Check scores exist

For each country in the list, check whether `data/derived/scores/<country_id>.csv` exists.

For countries with missing score files:
```bash
python3 data/scripts/generate_scores.py --country <country_id> --only-scored
```

Report which countries needed scoring.

### Step 3 — Generate comparison plot(s)

#### Overlay plot (default for ≤8 countries)
```bash
python3 data/scripts/plot_data.py \
  --countries <c1,c2,...> \
  --dimension <dimension> \
  --overlay \
  [--align-regime-change] \
  --output plots/compare_<label>_<dimension>.png
```

#### Heatmap (good for >5 countries)
```bash
python3 data/scripts/plot_data.py \
  --countries <c1,c2,...> \
  --dimension <dimension> \
  --plot-type heatmap \
  --output plots/compare_<label>_<dimension>_heatmap.png
```

#### Regional/category shorthand
```bash
python3 data/scripts/plot_data.py \
  --region <region> \
  --dimension <dimension> \
  --overlay \
  --output plots/region_<region>_<dimension>.png
```

### Step 4 — Narrative summary

After generating the plots, write a comparative narrative:

**Structure**:
1. **Group overview**: What countries are being compared; what they have in common (region, transition type)
2. **Top performers**: Which countries score highest on the chosen dimension and why
3. **Bottom performers**: Which countries lag and key factors
4. **Divergence patterns**: Countries that started similar but diverged; turning point years
5. **Common patterns**: Shared trends across the group (e.g., "all MENA countries saw political scores decline after 2013")
6. **Outliers**: Any country that doesn't fit the group pattern — note it and speculate on cause

**Length**: 4–6 paragraphs for region/category comparisons; 2–3 paragraphs for bilateral comparisons.

### Step 5 — Output paths

Report all generated file paths at the end:
```
Generated:
  plots/compare_iraq_tunisia_composite.png
  plots/compare_iraq_tunisia_composite_heatmap.png
```

## Arguments

$ARGUMENTS

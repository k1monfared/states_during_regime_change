---
name: manage-coverage
layer: 1-general
purpose: Audit data coverage, prioritise gap-filling, run the Flask audit UI, verify observations
used_by: [collect-data, pipeline]
---

# Coverage Management Workflow

## Coverage at a glance (2026-03-03)

**World Bank (priority-1)**: 38/39 series downloaded; 78.4% of country-year observations available.
`SM.POP.REFG.OR` returned no data — use UNHCR directly instead.

**Not yet downloaded**: ILO (7 series), UCDP (5), ACLED (2), UNHCR (6), V-Dem (2), IMF (2), UNDP HDI (1).

**Coverage by country** (run `python3 data/scripts/build_coverage.py --summary` for current numbers):
| Tier | Countries | Coverage % |
|------|-----------|-----------|
| High (>85%) | Peru, Indonesia, Malaysia, Mexico, Egypt, Kenya, Côte d'Ivoire, South Africa, Algeria, Ghana, Iran, Senegal, Burkina Faso, Tunisia | 87–94% |
| Medium (70–85%) | Sudan, Nepal, CAR, Gambia, Syria, Mali, Iraq, Venezuela, Ethiopia, DRC, Sierra Leone, Myanmar, Libya, Georgia, Malawi | 70–83% |
| Low (<70%) | Slovakia, Ukraine, Kyrgyzstan, Armenia, Croatia, Liberia, Yemen, Afghanistan, Serbia, East Timor, South Sudan | 40–66% |

Low-coverage countries are mostly: post-Soviet transition states (data starts 1990s), fragile/conflict states (Yemen, Afghanistan, South Sudan), small/young states (East Timor, Liberia).

---

## Audit Commands

```bash
# Full coverage rebuild (run after any new canonical CSV)
python3 data/scripts/build_coverage.py

# Coverage summary table
python3 data/scripts/build_coverage.py --summary

# Download status of all canonical series
python3 data/scripts/download_canonical.py --status

# Launch Flask audit UI
python3 app.py
# Then open: http://localhost:5000/audit
```

---

## Flask Audit UI

Start with `python3 app.py` (port 5000 by default; `--port 8080` to change).

### Routes

| URL | Description |
|-----|-------------|
| `/audit` | Coverage matrix: country rows × category columns, colored by coverage %. Summary stats bar at top. |
| `/audit/country/<id>` | Per-country detail: all series grouped by category, year range, coverage %, verified count. Verify buttons. |
| `/audit/series/<series_id>` | Per-series view: all 40 countries, coverage %, collection plan if set. |
| `/audit/gaps` | All gap entries with inline plan editor — add text plans for each missing series×country. |
| `/api/coverage` | JSON dump of current coverage index. |

### Verification via UI

Click "Verify" on any row in `/audit/country/<id>` to mark that country×series as human-verified. Verification is stored in `data/verification.json` and shown in the audit UI and Countries page.

### POST endpoints (for programmatic use)

```bash
# Verify an observation
curl -X POST http://localhost:5000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"series_id":"WB_SP.POP.TOTL","country_id":"iraq","year":"2003","note":"Cross-checked with UN DESA WPP"}'

# Add a collection plan for a gap
curl -X POST http://localhost:5000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"series_id":"UCDP_BDEATHS_INTERNAL","country_id":"iraq","plan":"Download from ucdp.uu.se/downloads/ GED v24"}'
```

---

## Gap Status Vocabulary

| Status | Meaning | Action |
|--------|---------|--------|
| `available` | Value present in canonical CSV | Verify if important |
| `source_gap` | Source has no data for this country-year | Accept or find alternative source |
| `not_in_source` | Country never covered by this source | Use alternative source |
| `download_error` | HTTP error during download | Re-run `--force` or check API status |
| `pre_coverage` | Year predates source earliest data | Use historical sources; note in YAML |
| `estimated` | Interpolated/modeled value | Flag as `reliability: medium` |

---

## Verification Workflow

```bash
# Verify a single observation
python3 data/scripts/verify.py --series WB_SP.POP.TOTL --country iraq --year 2003 \
  --note "Cross-checked with UN DESA WPP 2024"

# List all verifications for a country
python3 data/scripts/verify.py --list --country iraq

# Show overall verification stats
python3 data/scripts/verify.py --stats

# Bulk-verify all available observations for a series (for trusted sources)
python3 data/scripts/verify.py --bulk --series WB_SP.POP.TOTL

# Remove a verification
python3 data/scripts/verify.py --unverify --series WB_SP.POP.TOTL --country iraq --year 2003
```

Verification records live in `data/verification.json`, keyed as `"SERIES_ID/country_id/year"`.

---

## Gap-filling Priority Order

### Tier 1 — Most impactful for scoring (these series feed scored indicators)

| Series | Feeds indicator | Status |
|--------|----------------|--------|
| `WB_NY.GDP.PCAP.CD` | gdp_per_capita | ✅ downloaded |
| `WB_FP.CPI.TOTL.ZG` | inflation | ✅ downloaded |
| `WB_SL.UEM.TOTL.ZS` | unemployment | ✅ downloaded |
| `WB_NE.TRD.GNFS.ZS` | trade_openness | ✅ downloaded |
| `WB_BX.KLT.DINV.CD.WD` | fdi | ✅ downloaded |
| `WB_NY.GDP.TOTL.RT.ZS` | natural_resource_rents | ✅ downloaded |
| `WB_SI.POV.GINI` | gini, poverty_rate | ✅ downloaded (sparse) |
| `WGI_CC` / `WGI_GE` / `WGI_PS` / `WGI_RL` / `WGI_VA` | governance indicators | ✅ downloaded |
| UCDP conflict series | political_violence | ❌ manual download needed |
| UNHCR refugee series | refugee_flows | ❌ manual download needed |
| ILO unemployment counts | unemployment components | ❌ manual download needed |

### Tier 2 — Useful for derived computation

| Series needed | Download command |
|--------------|-----------------|
| WB priority-2 (demographics, education) | `python3 data/scripts/download_canonical.py --source worldbank --priority 2` |
| ILO labor series | Manual — see source-bulk-ilo skill |
| UCDP GED conflict | Manual — see source-ucdp skill |

### Tier 3 — Nice-to-have

IMF fiscal series, ACLED cross-check, V-Dem political indices, IOM migration counts.

---

## After Downloading New Data

```bash
python3 data/scripts/build_coverage.py       # regenerate coverage.json
python3 data/scripts/compute_derived.py      # fill calculated_value in YAMLs
python3 data/scripts/generate_scores.py      # re-score with new values
python3 data/scripts/export_web.py           # rebuild docs/data/ for dashboard
```

---

## Coverage JSON Structure (for programmatic queries)

`docs/data/coverage.json`:
```json
{
  "meta": {"generated": "2026-03-03", "series_count": 114, "countries": 40},
  "series": {
    "WB_SP.POP.TOTL": {
      "name": "Population, total",
      "category": "demographics",
      "coverage": {
        "iraq": {
          "2003": {"status": "available", "value": 25175000.0, "verified": false}
        }
      }
    }
  },
  "summary": {
    "iraq": {
      "total_obs": 1904, "available": 1556, "source_gap": 120,
      "not_in_source": 0, "download_error": 0, "estimated": 0,
      "coverage_pct": 81.7
    }
  }
}
```

`docs/data/fundamental.json`: flat lookup for the dashboard:
```json
{
  "iraq": {
    "WB_SP.POP.TOTL": {"2003": 25175000.0, "2004": 26008000.0}
  }
}
```

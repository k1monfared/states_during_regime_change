---
name: source-sipri
layer: 1-source
purpose: How to source military expenditure data for the political or social dimension
indicators: [military_expenditure]
used_by: [collect-data]
---

# Source: SIPRI Military Expenditure Database

## What It Measures

The Stockholm International Peace Research Institute (SIPRI) Military Expenditure Database is
the authoritative global source for defense spending data. For this project, `military_expenditure`
measures annual military spending as a percentage of GDP — a key indicator of resource allocation
between coercive capacity and civilian welfare, and of regime priorities during transitions.

The World Bank `MS.MIL.XPND.GD.ZS` series is derived directly from SIPRI MILEX; when both are
available, prefer SIPRI for precision and coverage.

## Access

- **Portal**: https://www.sipri.org/databases/milex
- **Data download**: https://www.sipri.org/databases/milex (Excel files; free, no registration)
  - Download "SIPRI Military Expenditure Database" — multiple sheets for different units
- **Coverage**: 1949–present for many countries; broader coverage from 1988
- **Units available**: Current USD, constant USD (2022 prices), local currency, % of GDP, % of government expenditure, per capita

## Key Series

| Field | SIPRI sheet | Unit | Use |
|-------|-------------|------|-----|
| `military_expenditure_pct_gdp` | "Share of GDP" | % of GDP | **Main value** |
| `military_expenditure_usd` | "Current USD" | millions current USD | **Numerator component** |
| `military_expenditure_usd_constant` | "Constant (2022) USD" | millions 2022 USD | comparison component |
| `military_expenditure_pct_govt` | "Share of Govt. Expenditure" | % of govt spending | context component |

**World Bank fallback**: `MS.MIL.XPND.GD.ZS` (% of GDP) — same underlying SIPRI data;
use when SIPRI direct download is unavailable or for API access.

## Formula and Components

```
military_expenditure_pct_gdp = (military_expenditure_usd / gdp_current_usd) * 100
```

| Component | Source | Series / Sheet |
|-----------|--------|----------------|
| `military_expenditure_usd` | SIPRI MILEX "Current USD" sheet | millions, current USD |
| `gdp_current_usd` | World Bank WDI `NY.GDP.MKTP.CD` | current USD |
| `military_expenditure_usd_constant` | SIPRI MILEX "Constant (2022) USD" | for trend comparison |
| `military_expenditure_pct_govt` | SIPRI MILEX "Share of Govt. Expenditure" | % of government budget |

Note: SIPRI's "Share of GDP" sheet gives the derived rate directly; collect it as `main value`
AND collect the numerator (current USD) and GDP denominator separately for full auditability.

## Reliability

- SIPRI % of GDP: **high** for countries with transparent defense budgets
- **Medium** for authoritarian states where military spending is partially off-budget (security
  forces funded outside the defense ministry; paramilitary/intelligence classified)
- **Low** for active conflict zones and states with no functioning budget process

Key SIPRI footnotes to watch:
- `xxx` = data not available (enter as `null`, `data_status: missing`)
- `xx` = SIPRI estimate (lower reliability; note in YAML)
- `.` = unreliable data / no meaningful figure
- `[ ]` brackets = SIPRI estimate based on partial data

**⚠️ Always check SIPRI footnotes per country-year.** The Excel file has footnote codes per cell.
Countries with off-budget military spending (Russia, Iran, Myanmar, Venezuela, DRC) have systematic
underestimates; note this explicitly.

## Coverage Gaps

- **Very early years (pre-1988)**: Coverage is good for NATO/Warsaw Pact countries but sparse for
  developing countries. Check SIPRI's "coverage notes" tab for each country.
- **Conflict-collapsed states** (Libya 2011–2014, Somalia, Syria post-2012): `xxx` entries;
  use qualitative assessment and note the gap.
- **Paramilitary / parallel security spending**: Not captured in SIPRI for countries where security
  forces operate outside the defense budget. Examples: Iran's IRGC budget was partially off-books;
  Venezuela's Bolivarian militia; note this caveat when relevant.

## Feature Vocabulary (proposed: political or economic dimension)

### military_expenditure (% of GDP)
| Spending | Feature tag |
|----------|-------------|
| < 1% | `minimal_military_spending` |
| 1–2% | `low_military_spending` |
| 2–4% | `moderate_military_spending` |
| 4–7% | `elevated_military_spending` |
| 7–15% | `high_military_spending` |
| > 15% | `war_economy_spending` |

Also add contextual features when relevant:
- `rising_trend` / `falling_trend` — 3+ year direction
- `off_budget_concerns` — known off-budget spending
- `dominant_budget_item` — military > 30% of government expenditure

## Citation Format

```yaml
# SIPRI primary:
citation: "SIPRI Military Expenditure Database, <country>, <year>, accessed <date>"
url: "https://www.sipri.org/databases/milex"
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: high

# World Bank fallback:
citation: "World Bank WDI, MS.MIL.XPND.GD.ZS, <country>, <year>, accessed <date>"
url: "https://data.worldbank.org/indicator/MS.MIL.XPND.GD.ZS"
access_date: "<YYYY-MM-DD>"
type: official_statistics
reliability: high
```

> **URL is mandatory.** Use `https://www.sipri.org/databases/milex` for SIPRI data. Never leave `url: null`.

## YAML Components Schema

```yaml
  2003:
    data_status: complete
    quantitative:
      value: 4.8             # % of GDP
      unit: percent_gdp
      formula: "(military_expenditure_usd / gdp_current_usd) * 100"
      source:
        citation: "SIPRI Military Expenditure Database, Iraq, 2003, accessed 2026-03-02"
        url: "https://www.sipri.org/databases/milex"
        access_date: "2026-03-02"
      reliability: medium
      components:
        military_expenditure_usd:
          value: 1420        # millions current USD
          unit: usd_millions_current
          role: numerator
          source:
            citation: "SIPRI MILEX, Current USD sheet, Iraq, 2003, accessed 2026-03-02"
            url: "https://www.sipri.org/databases/milex"
            access_date: "2026-03-02"
          reliability: medium
        gdp_current_usd:
          value: 29570000000  # current USD
          unit: usd_current
          role: denominator
          source:
            citation: "World Bank WDI, NY.GDP.MKTP.CD, Iraq, 2003, accessed 2026-03-02"
            url: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD"
            access_date: "2026-03-02"
          reliability: high
        military_expenditure_pct_govt:
          value: 18.3        # % of government expenditure
          unit: percent_government_expenditure
          role: context
          source:
            citation: "SIPRI MILEX, Share of Govt. Expenditure sheet, Iraq, 2003, accessed 2026-03-02"
            url: "https://www.sipri.org/databases/milex"
            access_date: "2026-03-02"
          reliability: medium
```

## Quick Lookup Steps

1. Download the SIPRI MILEX Excel from https://www.sipri.org/databases/milex
2. Open the "Share of GDP" sheet → find country row × year column → copy value
3. Check the footnote code in that cell (xx, xxx, [ ] — see above)
4. Open the "Current USD" sheet → same cell → copy absolute spending in millions
5. Get GDP from World Bank `NY.GDP.MKTP.CD` for the denominator
6. Open "Share of Govt. Expenditure" sheet → copy for context component
7. Record footnotes in `qualitative.notes` if the cell has a footnote code

$ARGUMENTS

---
name: source-worldbank
layer: 1-source
purpose: How to source World Bank indicators for gdp_per_capita, trade_openness, fdi, statistical_transparency
indicators: [gdp_per_capita, trade_openness, fdi, statistical_transparency, unemployment]
used_by: [collect-data]
---

# Source: World Bank Open Data

## What It Measures

The World Bank World Development Indicators (WDI) is the primary source for macroeconomic and development statistics.

## Access

- **Portal**: https://data.worldbank.org
- **API**: `https://api.worldbank.org/v2/country/<iso2>/indicator/<series>?format=json&date=<start>:<end>&per_page=100`
- **Download**: Data can be downloaded as CSV from the portal for any indicator × country × year range
- **Coverage**: Annual data; most series run 1960–present; some start later

## Key Series for This Project

| Indicator | WDI Series Code | Unit | Notes |
|-----------|----------------|------|-------|
| `gdp_per_capita` | `NY.GDP.PCAP.CD` | USD current | Use current USD for comparability; constant USD available as NY.GDP.PCAP.KD |
| `unemployment` | `SL.UEM.TOTL.ZS` | % of labor force | ILO modeled estimates; gaps for conflict states |
| `trade_openness` | `NE.TRD.GNFS.ZS` | % of GDP | (Exports + Imports) / GDP × 100 |
| `fdi` | `BX.KLT.DINV.WD.GD.ZS` | % of GDP | Net FDI inflows as % of GDP |
| `statistical_transparency` | `IQ.SCI.OVRL` | 0–100 | Statistical Capacity Index (discontinued 2021; see note) |

## Reliability

- GDP, trade, FDI: **high** — compiled from national accounts and official sources
- Unemployment: **medium** to **high** — ILO models; conflict states have wider uncertainty bands
- Statistical capacity: **medium** — self-reported to World Bank

## Coverage Gaps

- **Conflict/fragile states**: Frequent data gaps (Syria 2013+, Yemen 2015+, Libya 2011+, Afghanistan 2022+). Mark as `data_status: missing` or use IMF Article IV fallback.
- **Statistical transparency (IQ.SCI.OVRL)**: Discontinued after 2020. Use available years; for 2021+, note absence and use qualitative assessment from UNSD or national stats office reports.
- **FDI**: Can be negative (divestment). Negative values are valid — enter as-is.

## Citation Format

```yaml
citation: "World Bank WDI, <Series Code>, accessed <YYYY-MM-DD>"
url: "https://data.worldbank.org/indicator/<Series Code>"
access_date: "<YYYY-MM-DD>"
type: official_statistics
reliability: high
```

Example:
```yaml
citation: "World Bank WDI, NY.GDP.PCAP.CD, accessed 2024-03-01"
url: "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD"
access_date: "2024-03-01"
```

## Converting to 0–100 Project Scale

GDP per capita, trade openness, FDI, and unemployment are entered as **raw values** (USD, %, etc.) in the `quantitative.value` field.

The `scoring_rubrics.yaml` and `generate_scores.py` handle the conversion to 0–100 based on defined thresholds. Do **not** pre-convert to 0–100; enter raw values.

Statistical transparency (IQ.SCI.OVRL) is already on a 0–100 scale — enter as-is.

## Handling Missing Years

If a specific year is absent from the WDI:
1. Check if an adjacent year (±1) is available; note the year mismatch in `notes`
2. If no year available, set `data_status: missing`, `quantitative.value: null`, explain in `notes`
3. Do not interpolate; the scoring pipeline handles missing data internally

## Quick Lookup Steps

1. Go to https://data.worldbank.org/indicator/<series-code>
2. Filter by country → open the data tab
3. Find the year row → copy the value
4. Note the access date for the citation

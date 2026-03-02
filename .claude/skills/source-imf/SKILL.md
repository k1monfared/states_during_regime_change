---
name: source-imf
layer: 1-source
purpose: How to source IMF indicators for inflation, fiscal_health; supplementary GDP
indicators: [inflation, fiscal_health, gdp_per_capita]
used_by: [collect-data]
---

# Source: International Monetary Fund (IMF)

## What It Measures

The IMF World Economic Outlook (WEO) database provides macroeconomic forecasts and historical data, particularly strong for fiscal and inflation series.

## Access

- **WEO Portal**: https://www.imf.org/en/Publications/WEO/weo-database (published April and October each year)
- **Download**: Full dataset available as CSV/Excel from the WEO portal
- **API**: https://www.imf.org/external/datamapper/api/v1 (free, JSON)
- **Article IV Reports**: Country-specific consultation reports at https://www.imf.org/en/Publications/CR (search by country + year)

## Key Series for This Project

| Indicator | WEO Code | Unit | Notes |
|-----------|---------|------|-------|
| `inflation` | `PCPIPCH` | % change (CPI) | Annual average inflation; negative = deflation |
| `fiscal_health` (balance) | `GGXCNL_NGDP` | % of GDP | Net lending/borrowing; negative = deficit |
| `fiscal_health` (debt) | `GGXWDG_NGDP` | % of GDP | General government gross debt |
| `gdp_per_capita` (fallback) | `NGDPDPC` | USD current | Use when World Bank data is absent |

## Which Series to Use for fiscal_health

The project's `fiscal_health` indicator combines balance and debt signals. Use:
1. `GGXCNL_NGDP` as the primary value (fiscal balance as % of GDP) — enter in `quantitative.value`
2. Note debt-to-GDP (`GGXWDG_NGDP`) in `qualitative.notes` when it's significantly elevated

## Reliability

- Inflation (CPI): **high** for most countries; **medium** for conflict states where price collection is disrupted
- Fiscal data: **medium** — IMF estimates are widely used but involve judgment calls; Article IV reports are more reliable for specific years
- For countries under IMF program (post-crisis): **high** — enhanced monitoring

## Coverage Gaps for Conflict/Fragile States

IMF data is absent or unreliable for countries where normal government functioning is disrupted:
- **Syria**: Limited after 2012; use qualitative fallback
- **Yemen**: 2015+ severely limited; use qualitative + Central Bank of Yemen estimates where available
- **Libya**: 2014–2018 contested government creates dual data; note in `notes`
- **South Sudan**: Gaps 2013–2015 (civil war outbreak)
- **Afghanistan**: 2021–2022 post-Taliban transition; IMF suspended engagement

When IMF data is absent, set `quantitative.value: null`, reliability: null, and document in `notes`.

## Citation Format

```yaml
# For WEO database:
citation: "IMF World Economic Outlook Database, <WEO Code>, <month YYYY>"
url: "https://www.imf.org/en/Publications/WEO/weo-database"
access_date: "<YYYY-MM-DD>"
type: official_statistics
reliability: high

# For Article IV consultation report:
citation: "IMF Article IV Consultation — <Country>, <Year>"
url: "https://www.imf.org/en/Publications/CR/Issues/YYYY/MM/DD/..."
access_date: "<YYYY-MM-DD>"
type: international_organization
reliability: high
```

## Hyperinflation Cases

For years with hyperinflation (>100%/year — Venezuela 2016+, Zimbabwe, South Sudan):
- Enter the actual percentage (e.g., `2437.0` for 2437% inflation)
- Note in `qualitative.notes`: hyperinflation period; data from IMF WEO / central bank
- Confidence: `medium` — hyperinflation makes measurement difficult

## Deflationary Periods

Negative inflation values (deflation) are valid — enter as negative numbers (e.g., `-2.1`).

## Accessing WEO Vintage Data

For historical analysis, use the WEO database archive to get the data *as it was known* at the time, not revised values. Archive at: https://www.imf.org/en/Publications/WEO/weo-database (select year/edition).

For this project, use the **most recent** available estimates (latest revision) unless specifically studying forecast accuracy.

## Quick Lookup Steps

### WEO Database (preferred):
1. Go to https://www.imf.org/en/Publications/WEO/weo-database
2. Select country → choose series code (PCPIPCH for inflation, GGXCNL_NGDP for fiscal balance)
3. Find the year → copy value
4. Note which edition (April/October) — prefer April for cross-country comparisons

### Article IV Consultation (for conflict states or WEO gaps):
1. Go to https://www.imf.org/en/Publications/CR
2. Search: country name + "Article IV" + year (e.g., "Iraq Article IV 2005")
3. Find the relevant table and read the value
4. Cite as: "IMF Article IV Consultation — <Country>, <Year>"

$ARGUMENTS

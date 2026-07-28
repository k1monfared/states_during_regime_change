---
name: source-bulk-ilo
layer: 1-source
purpose: Download ILO ILOSTAT labor market series for all 40 countries
used_by: [pipeline, manage-coverage, collect-data]
---

# ILO ILOSTAT Bulk Download Workflow

## Status: 6 of 7 series downloaded (2026-03-11)

6 series downloaded via `download_canonical.py --source ilo`. Only `ILO_EMP_2EMP_SEX_ECO_RT`
(informal employment rate) remains — it has no valid rplumber endpoint.
The ILOSTAT API is free and does not require authentication for bulk queries.

## Series to download

| Series ID | ILO API Code | Description | Feeds indicator | Status |
|-----------|-------------|-------------|----------------|--------|
| ILO_EAP_TEAP_SEX_AGE_NB | EAP_TEAP_SEX_AGE_NB | Labour force count (persons) | unemployment, labor_force_participation | downloaded |
| ILO_UNE_TUNE_SEX_AGE_NB | UNE_TUNE_SEX_AGE_NB | Unemployed persons count | unemployment | downloaded |
| ILO_EMP_TEMP_SEX_AGE_NB | EMP_TEMP_SEX_AGE_NB | Employed persons count | employment | downloaded |
| ILO_UNE_TUNE_SEX_AGE_RT | **UNE_DEAP_SEX_AGE_RT** | Unemployment rate (ILO definition) | unemployment alternative | downloaded |
| ILO_EAP_TEAP_SEX_AGE_RT | **EAP_DWAP_SEX_AGE_RT** | Labour force participation rate | labor_force_participation | downloaded |
| ILO_EMP_2EMP_SEX_ECO_RT | EMP_2EMP_SEX_ECO_RT | Informal employment (% total) | informal_economy | **no valid endpoint** |
| ILO_SDG_0851_SEX_AGE_RT | **EIP_NEET_SEX_AGE_RT** | NEET rate (%) | neet_rate | downloaded |

**Important**: Three rate series use different API codes than their series IDs suggest:
- `ILO_UNE_TUNE_SEX_AGE_RT` downloads from API code `UNE_DEAP_SEX_AGE_RT` (not `UNE_TUNE_SEX_AGE_RT`)
- `ILO_EAP_TEAP_SEX_AGE_RT` downloads from API code `EAP_DWAP_SEX_AGE_RT` (not `EAP_TEAP_SEX_AGE_RT`)
- `ILO_SDG_0851_SEX_AGE_RT` downloads from API code `EIP_NEET_SEX_AGE_RT` (not `SDG_0851_SEX_AGE_RT`)

## Download method 1 — ILOSTAT REST API (recommended)

No API key required. Returns JSON or CSV.

```
Base URL: https://rplumber.ilo.org/data/indicator/
Query: ?id=<ILO_CODE>&timefrom=1990&timeto=2024&lang=en&type=label&format=.csv
```
Omit `ref_area` to download all countries at once. Filter locally to the 40 project countries.

Example — unemployment rate (all countries, no ref_area filter):
```
https://rplumber.ilo.org/data/indicator/?id=UNE_DEAP_SEX_AGE_RT&sex=SEX_T&classif1=AGE_YTHADULT_YGE15&timefrom=1990&timeto=2024&type=label&format=.csv
```

**Note**: Download all countries at once (omit `ref_area`), then filter to the 40 project countries locally.
The correct API codes are `UNE_DEAP_SEX_AGE_RT`, `EAP_DWAP_SEX_AGE_RT`, `EIP_NEET_SEX_AGE_RT` (not the TUNE/TEAP/SDG variants).

### Bulk download (all countries, filter locally)

Download all countries at once (no `ref_area` filter), then filter to the 40 project countries:
```python
import requests, pandas as pd

ILO_CODE = "UNE_DEAP_SEX_AGE_RT"  # use correct API code (see table above)

url = (
    f"https://rplumber.ilo.org/data/indicator/"
    f"?id={ILO_CODE}"
    f"&sex=SEX_T&classif1=AGE_YTHADULT_YGE15"
    f"&timefrom=1990&timeto=2024"
    f"&type=label&format=.csv"
)
df = pd.read_csv(url)
# Filter to project countries locally
PROJECT_ISO2 = {"AF","DZ","CD","CF","HR","EG","ET","GM","GE","GH","IR","IQ",
                "CI","KE","KG","LY","LR","MW","MY","ML","MX","NP","MM","PE",
                "SN","RS","SL","ZA","SS","SD","SY","TL","TN","UA","VE","YE","SK"}
df = df[df["ref_area"].isin(PROJECT_ISO2)]
print(df.columns.tolist())
print(df.head())
```

Key columns in the ILO response: `ref_area`, `time`, `obs_value`, `obs_status`

## Download method 2 — ILOSTAT bulk CSV

Go to https://ilostat.ilo.org/bulk-download/ → select topic → download full CSV.
Better for getting all countries at once but files are large.

## Converting ILO CSV to canonical format

ILO CSV columns: `ref_area`, `ref_area.label`, `sex`, `classif1`, `time`, `obs_value`, `obs_status`

```python
import pandas as pd, yaml
from pathlib import Path

# Country mapping: ILO ISO2 → project country_id
ISO2_TO_COUNTRY_ID = {
    "AF": "afghanistan", "DZ": "algeria", "CD": "drc", "CF": "car",
    "HR": "croatia", "EG": "egypt", "ET": "ethiopia", "GM": "gambia",
    "GE": "georgia", "GH": "ghana", "IR": "iran", "IQ": "iraq",
    "CI": "cote_divoire", "KE": "kenya", "KG": "kyrgyzstan",
    "LY": "libya", "MW": "malawi", "MY": "malaysia", "ML": "mali",
    "MX": "mexico", "NP": "nepal", "MM": "myanmar", "PE": "peru",
    "SN": "senegal", "RS": "serbia", "SL": "sierra_leone",
    "ZA": "south_africa", "SS": "south_sudan", "SD": "sudan",
    "SY": "syria", "TL": "east_timor", "TN": "tunisia",
    "UA": "ukraine", "VE": "venezuela", "YE": "yemen", "SK": "slovakia",
    "LB": "liberia",  # Liberia uses LR in ISO but verify
}

# ISO3 mapping (for canonical CSV)
ISO2_TO_ISO3 = {
    "AF": "AFG", "DZ": "DZA", "CD": "COD", "CF": "CAF",
    "HR": "HRV", "EG": "EGY", "ET": "ETH", "GM": "GMB",
    "GE": "GEO", "GH": "GHA", "IR": "IRN", "IQ": "IRQ",
    "CI": "CIV", "KE": "KEN", "KG": "KGZ", "LY": "LBY",
    "MW": "MWI", "MY": "MYS", "ML": "MLI", "MX": "MEX",
    "NP": "NPL", "MM": "MMR", "PE": "PER", "SN": "SEN",
    "RS": "SRB", "SL": "SLE", "ZA": "ZAF", "SS": "SSD",
    "SD": "SDN", "SY": "SYR", "TL": "TLS", "TN": "TUN",
    "UA": "UKR", "VE": "VEN", "YE": "YEM", "SK": "SVK",
    "LB": "LBR",
}

def ilo_to_canonical(ilo_csv_path, series_id, output_path, download_date):
    df = pd.read_csv(ilo_csv_path)
    # Filter to total sex, total age (adjust for series-specific classifications)
    df = df[df["sex"] == "SEX_T"]
    if "classif1" in df.columns:
        df = df[df["classif1"].str.contains("TOTAL", na=False)]

    rows = []
    for _, row in df.iterrows():
        iso2 = row["ref_area"]
        country_id = ISO2_TO_COUNTRY_ID.get(iso2)
        iso3 = ISO2_TO_ISO3.get(iso2)
        if not country_id or not iso3:
            continue
        year = int(row["time"])
        value = row.get("obs_value")
        status = "available" if pd.notna(value) else "source_gap"
        rows.append({
            "iso3": iso3,
            "country_id": country_id,
            "year": year,
            "value": value if status == "available" else "",
            "status": status,
            "download_date": download_date,
            "notes": "",
        })

    out = pd.DataFrame(rows).sort_values(["country_id", "year"])
    out.to_csv(output_path, index=False)
    print(f"Written {len(out)} rows to {output_path}")

# Usage:
# ilo_to_canonical("raw_ilo.csv", "ILO_UNE_TUNE_SEX_AGE_RT",
#                  "data/canonical/ilo/UNE_TUNE_SEX_AGE_RT.csv", "2026-03-03")
```

## After downloading

1. Save CSV to `data/canonical/ilo/<ILO_CODE>.csv` in canonical format
2. Update `data/canonical/registry.yaml` — set `downloaded: true` and `last_download: YYYY-MM-DD`
3. Run the rebuild pipeline:
```bash
python3 data/scripts/build_coverage.py
python3 data/scripts/compute_derived.py
python3 data/scripts/export_web.py
```

## Coverage notes

- ILO modeled estimates (not actual surveys) are available for most countries
- Conflict states (Syria 2012+, Yemen 2015+, Afghanistan 2021+) have ILO model estimates with high uncertainty — flag as `reliability: low`
- NEET rate (EIP_NEET_SEX_AGE_RT, formerly SDG_0851): sparser coverage, many countries only have data from 2005 onward
- Pre-1991 data: mostly unavailable for post-Soviet states (Georgia, Kyrgyzstan, Armenia, Ukraine, etc.)

---
name: source-bulk-ilo
layer: 1-source
purpose: Download ILO ILOSTAT labor market series for all 40 countries
used_by: [pipeline, manage-coverage, collect-data]
---

# ILO ILOSTAT Bulk Download Workflow

## Status: manual download required (7 series not yet downloaded)

The download_canonical.py script prints manual instructions for ILO series.
The ILOSTAT API is free and does not require authentication for bulk queries.

## Series to download

| Series ID | ILO Code | Description | Feeds indicator |
|-----------|----------|-------------|----------------|
| ILO_EAP_TEAP_SEX_AGE_NB | EAP_TEAP_SEX_AGE_NB | Labour force count (persons) | unemployment, labor_force_participation |
| ILO_UNE_TUNE_SEX_AGE_NB | UNE_TUNE_SEX_AGE_NB | Unemployed persons count | unemployment |
| ILO_EMP_TEMP_SEX_AGE_NB | EMP_TEMP_SEX_AGE_NB | Employed persons count | employment |
| ILO_UNE_TUNE_SEX_AGE_RT | UNE_TUNE_SEX_AGE_RT | Unemployment rate (ILO definition) | unemployment alternative |
| ILO_EAP_TEAP_SEX_AGE_RT | EAP_TEAP_SEX_AGE_RT | Labour force participation rate | labor_force_participation |
| ILO_EMP_2EMP_SEX_ECO_RT | EMP_2EMP_SEX_ECO_RT | Informal employment (% total) | informal_economy |
| ILO_SDG_0851_SEX_AGE_RT | SDG_0851_SEX_AGE_RT | NEET rate (%) | neet_rate |

## Download method 1 — ILOSTAT REST API (recommended)

No API key required. Returns JSON or CSV.

```
Base URL: https://rplumber.ilo.org/data/indicator/
Query: ?id=<ILO_CODE>&ref_area=<ISO2_CODE>&timefrom=1990&timeto=2024&lang=en&type=label&format=.csv
```

Example — unemployment rate for Iraq:
```
https://rplumber.ilo.org/data/indicator/?id=UNE_TUNE_SEX_AGE_RT&ref_area=IQ&sex=SEX_T&classif1=AGE_AGGREGATE_TOTAL&timefrom=1990&timeto=2024&type=label&format=.csv
```

### Bulk download (all 40 countries for one series)

All 40 country ISO2 codes:
```
AF,DZ,CD,CF,HR,EG,ET,GM,GE,GH,IR,IQ,CI,KE,KG,LY,LB,MG,MW,MY,ML,MX,NP,MM,PE,SN,RS,SL,ZA,SS,SD,SY,TL,TN,UA,VE,YE,SK,AF
```

Full query for all 40 (adjust ILO_CODE and parameters):
```python
import requests, pandas as pd

ILO_CODE = "UNE_TUNE_SEX_AGE_RT"  # change per series
ISO2_CODES = "AF,DZ,CD,CF,HR,EG,ET,GM,GE,GH,IR,IQ,CI,KE,KG,LY,MW,MY,ML,MX,NP,MM,PE,SN,RS,SL,ZA,SS,SD,SY,TL,TN,UA,VE,YE,SK"

url = (
    f"https://rplumber.ilo.org/data/indicator/"
    f"?id={ILO_CODE}"
    f"&ref_area={ISO2_CODES}"
    f"&sex=SEX_T&classif1=AGE_AGGREGATE_TOTAL"
    f"&timefrom=1990&timeto=2024"
    f"&type=label&format=.csv"
)
df = pd.read_csv(url)
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
- NEET rate (SDG_0851): sparser coverage, many countries only have data from 2005 onward
- Pre-1991 data: mostly unavailable for post-Soviet states (Georgia, Kyrgyzstan, Armenia, Ukraine, etc.)

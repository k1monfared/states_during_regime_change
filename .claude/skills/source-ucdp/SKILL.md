---
name: source-ucdp
layer: 1-source
purpose: Download and process UCDP GED conflict data for battle-death counts
used_by: [pipeline, manage-coverage, collect-data]
---

# UCDP Conflict Data Workflow

## Status: manual download required (5 series not yet downloaded)

## Series definitions

| Series ID | Description |
|-----------|-------------|
| UCDP_BDEATHS_INTERNAL | Deaths in intrastate + internationalized conflicts (foreign forces killing inside the country) |
| UCDP_BDEATHS_INTERSTATE | Deaths in interstate conflicts (nationals killed abroad) |
| UCDP_OSV_GOVT | One-sided violence deaths by government actors |
| UCDP_OSV_REBEL | One-sided violence deaths by rebel/non-state actors |
| UCDP_NSA | Non-state actor conflict deaths |

## Step 1: Download UCDP GED

Go to: https://ucdp.uu.se/downloads/
Download: "UCDP Georeferenced Event Dataset (GED) Global version" — latest CSV
File name: `GEDEvent_v<version>.csv` (several hundred MB; do NOT commit to repo)

Also consider: UCDP Dyadic Dataset for conflict-type classification.

Cross-check source: World Bank `WB_VC.BTL.DETH` (already downloaded) is derived from UCDP — use for validation.

## Step 2: Aggregate GED to country-year

```python
import pandas as pd
from pathlib import Path

# GED type_of_violence: 1=state-based, 2=non-state, 3=one-sided
# conflict_type in UCDP conflict dataset: 1=extrasystemic, 2=interstate,
#   3=internal, 4=internationalized internal

GW_TO_COUNTRY_ID = {
    700: "afghanistan", 615: "algeria", 490: "drc", 482: "car",
    344: "croatia", 651: "egypt", 530: "ethiopia", 420: "gambia",
    370: "georgia", 452: "ghana", 630: "iran", 645: "iraq",
    437: "cote_divoire", 501: "kenya", 703: "kyrgyzstan",
    620: "libya", 553: "malawi", 820: "malaysia", 432: "mali",
    70: "mexico", 790: "nepal", 775: "myanmar", 135: "peru",
    433: "senegal", 345: "serbia", 451: "sierra_leone",
    560: "south_africa", 626: "south_sudan", 625: "sudan",
    652: "syria", 860: "east_timor", 616: "tunisia",
    369: "ukraine", 101: "venezuela", 679: "yemen", 317: "slovakia",
    450: "liberia",
}

def aggregate_ged(ged_path, output_dir):
    df = pd.read_csv(ged_path, low_memory=False)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    today = pd.Timestamp.today().strftime("%Y-%m-%d")
    COUNTRY_IDS = list(GW_TO_COUNTRY_ID.values())
    ISO3 = {v: None for v in COUNTRY_IDS}  # fill from countries.yaml if needed

    # Map GW location code to country_id
    df["country_id"] = df["country_id"].map(GW_TO_COUNTRY_ID)
    df = df[df["country_id"].notna()]

    # Series 1: INTERNAL — state-based (type_of_violence==1) non-interstate conflicts
    # type_of_conflict in UCDP: 3=intrastate, 4=internationalized internal
    internal = df[
        (df["type_of_violence"] == 1) &
        (df.get("type_of_conflict", pd.Series(dtype=int)).isin([3, 4]) if "type_of_conflict" in df.columns
         else df["conflict_name"].notna())
    ].groupby(["country_id", "year"])["best"].sum().reset_index()
    internal.columns = ["country_id", "year", "value"]
    _write_canonical(internal, "UCDP_BDEATHS_INTERNAL", output_dir, today)

    # Series 2: INTERSTATE — state-based interstate conflicts (type_of_conflict==2)
    if "type_of_conflict" in df.columns:
        interstate = df[
            (df["type_of_violence"] == 1) & (df["type_of_conflict"] == 2)
        ].groupby(["country_id", "year"])["best"].sum().reset_index()
        interstate.columns = ["country_id", "year", "value"]
        _write_canonical(interstate, "UCDP_BDEATHS_INTERSTATE", output_dir, today)

    # Series 3: One-sided violence by government (type_of_violence==3, side_a is govt)
    osv_govt = df[
        (df["type_of_violence"] == 3) &
        (df["side_a"].str.contains("Government|Armed Forces", na=False, case=False))
    ].groupby(["country_id", "year"])["best"].sum().reset_index()
    osv_govt.columns = ["country_id", "year", "value"]
    _write_canonical(osv_govt, "UCDP_OSV_GOVT", output_dir, today)

    # Series 4: One-sided violence by rebel/non-state
    osv_rebel = df[
        (df["type_of_violence"] == 3) &
        (~df["side_a"].str.contains("Government|Armed Forces", na=False, case=False))
    ].groupby(["country_id", "year"])["best"].sum().reset_index()
    osv_rebel.columns = ["country_id", "year", "value"]
    _write_canonical(osv_rebel, "UCDP_OSV_REBEL", output_dir, today)

    # Series 5: Non-state actor conflicts (type_of_violence==2)
    nsa = df[
        df["type_of_violence"] == 2
    ].groupby(["country_id", "year"])["best"].sum().reset_index()
    nsa.columns = ["country_id", "year", "value"]
    _write_canonical(nsa, "UCDP_NSA", output_dir, today)

    print("Done. Run: python3 data/scripts/build_coverage.py")


def _write_canonical(agg_df, series_id, output_dir, today):
    # All country-years in scope (1989 to present)
    from data.scripts.download_canonical import COUNTRY_ISO3  # iso3 lookup
    # Build full grid
    all_countries = list(GW_TO_COUNTRY_ID.values())
    years = range(1989, 2025)
    rows = []
    for country_id in all_countries:
        iso3 = ""  # fill if needed
        for year in years:
            match = agg_df[(agg_df["country_id"] == country_id) & (agg_df["year"] == year)]
            if not match.empty:
                rows.append({"iso3": iso3, "country_id": country_id, "year": year,
                              "value": match["value"].iloc[0], "status": "available",
                              "download_date": today, "notes": f"GED best estimate"})
            else:
                rows.append({"iso3": iso3, "country_id": country_id, "year": year,
                              "value": "", "status": "source_gap",
                              "download_date": today, "notes": "No events recorded (=0 or pre-1989)"})
    import pandas as pd
    out = pd.DataFrame(rows)
    path = output_dir / f"{series_id.replace("UCDP_","")}.csv"
    out.to_csv(path, index=False)
    print(f"  {series_id}: {len(out[out["status"]=="available"])} country-years with events → {path}")

# Usage:
# aggregate_ged("GEDEvent_v24_1.csv", "data/canonical/ucdp/")
```

## Step 3: Update registry and rebuild

After writing canonical CSVs to `data/canonical/ucdp/`:

1. Update `data/canonical/registry.yaml` — set `downloaded: true` for each UCDP series
2. Run rebuild:
```bash
python3 data/scripts/build_coverage.py
python3 data/scripts/export_web.py
```

## Cross-validation

Compare `UCDP_BDEATHS_INTERNAL` country-year totals against `WB_VC.BTL.DETH` (already downloaded). They should roughly match (WB derives from UCDP). Large discrepancies indicate a filtering or mapping issue.

```python
import pandas as pd
ucdp = pd.read_csv("data/canonical/ucdp/BDEATHS_INTERNAL.csv")
wb = pd.read_csv("data/canonical/world_bank/VC.BTL.DETH.csv")
check = ucdp.merge(wb, on=["country_id","year"], suffixes=("_ucdp","_wb"))
check["ratio"] = check["value_ucdp"] / check["value_wb"].replace(0, float("nan"))
print(check[check["ratio"].between(0.5, 2.0) == False][["country_id","year","value_ucdp","value_wb","ratio"]])
```

## Notes

- UCDP GED coverage: 1989–present (pre-1989 data not available in GED)
- `best` column = best estimate; `low` and `high` also available for uncertainty bounds
- "Internationalized internal" (type_of_conflict==4) = foreign forces supporting one side inside the country — this is the "killed internally by foreign actors" series
- "Interstate" (type_of_conflict==2) = cross-border conflict — this is the "nationals killed abroad" series
- ACLED (acleddata.com) extends coverage to some pre-1997 and more granular events — download separately as cross-check

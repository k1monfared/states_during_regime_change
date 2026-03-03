#!/usr/bin/env python3
"""
download_canonical.py — Bulk downloader for canonical series.

Automated (no API key needed):
  World Bank / WGI  →  World Bank API
  ILO               →  rplumber.ilo.org single-file API (no auth)
  UCDP GED          →  Single CSV zip from ucdp.uu.se/downloads/
  UNHCR             →  Public population API at api.unhcr.org
  IMF WEO           →  GitHub datasets mirror (raw CSV)
  UNDP HDI          →  Direct CSV from hdr.undp.org

Semi-automated (user provides one downloaded CSV file):
  V-Dem             →  python3 download_canonical.py --source vdem --file V-Dem-CY-Full-v14.csv
  ACLED             →  python3 download_canonical.py --source acled --file acled_export.csv

Download instructions for manual sources:
  V-Dem:  https://www.v-dem.net/data/the-v-dem-dataset/  (free, no login required)
  ACLED:  https://acleddata.com/data-export-tool/  (free account, export all relevant countries)

Usage:
    python3 download_canonical.py --source worldbank --priority 2
    python3 download_canonical.py --source ilo
    python3 download_canonical.py --source ucdp
    python3 download_canonical.py --source unhcr
    python3 download_canonical.py --source imf
    python3 download_canonical.py --source undp
    python3 download_canonical.py --source vdem --file /path/to/V-Dem-CY-Full-v14.csv
    python3 download_canonical.py --source acled --file /path/to/acled_data.csv
    python3 download_canonical.py --series UCDP_BDEATHS_INTERNAL
    python3 download_canonical.py --all
    python3 download_canonical.py --status
    python3 download_canonical.py --dry-run --source ilo
"""

import argparse
import csv
import gzip
import io
import json
import os
import sys
import time
import zipfile
from datetime import date
from pathlib import Path

import yaml

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
DATA_CONFIG = ROOT / "data" / "config"
DATA_CANONICAL = ROOT / "data" / "canonical"
DATA_CANONICAL_STATUS = DATA_CANONICAL / "status"
DATA_CANONICAL_STATUS.mkdir(parents=True, exist_ok=True)

# ── Country code mappings ───────────────────────────────────────────────────────

ISO3_MAP = {
    "iraq": "IRQ", "libya": "LBY", "egypt": "EGY", "syria": "SYR",
    "yemen": "YEM", "tunisia": "TUN", "afghanistan": "AFG", "iran": "IRN",
    "algeria": "DZA", "drc": "COD", "sierra_leone": "SLE", "liberia": "LBR",
    "cote_divoire": "CIV", "car": "CAF", "mali": "MLI", "sudan": "SDN",
    "burkina_faso": "BFA", "ethiopia": "ETH", "south_sudan": "SSD",
    "south_africa": "ZAF", "ghana": "GHA", "senegal": "SEN", "kenya": "KEN",
    "gambia": "GMB", "malawi": "MWI", "serbia": "SRB", "georgia": "GEO",
    "kyrgyzstan": "KGZ", "ukraine": "UKR", "armenia": "ARM", "croatia": "HRV",
    "slovakia": "SVK", "indonesia": "IDN", "nepal": "NPL", "myanmar": "MMR",
    "east_timor": "TLS", "malaysia": "MYS", "venezuela": "VEN", "peru": "PER",
    "mexico": "MEX",
}

ISO2_MAP = {
    "iraq": "IQ", "libya": "LY", "egypt": "EG", "syria": "SY",
    "yemen": "YE", "tunisia": "TN", "afghanistan": "AF", "iran": "IR",
    "algeria": "DZ", "drc": "CD", "sierra_leone": "SL", "liberia": "LR",
    "cote_divoire": "CI", "car": "CF", "mali": "ML", "sudan": "SD",
    "burkina_faso": "BF", "ethiopia": "ET", "south_sudan": "SS",
    "south_africa": "ZA", "ghana": "GH", "senegal": "SN", "kenya": "KE",
    "gambia": "GM", "malawi": "MW", "serbia": "RS", "georgia": "GE",
    "kyrgyzstan": "KG", "ukraine": "UA", "armenia": "AM", "croatia": "HR",
    "slovakia": "SK", "indonesia": "ID", "nepal": "NP", "myanmar": "MM",
    "east_timor": "TL", "malaysia": "MY", "venezuela": "VE", "peru": "PE",
    "mexico": "MX",
}

# Gleditsch-Ward → country_id (for UCDP GED)
GW_TO_COUNTRY = {
    70: "mexico", 101: "venezuela", 135: "peru",
    317: "slovakia", 340: "serbia", 344: "croatia",
    369: "ukraine", 371: "armenia", 372: "georgia",
    420: "gambia", 432: "mali", 433: "senegal", 437: "cote_divoire",
    439: "burkina_faso", 450: "liberia", 451: "sierra_leone", 452: "ghana",
    482: "car", 490: "drc", 501: "kenya", 530: "ethiopia",
    553: "malawi", 560: "south_africa",
    615: "algeria", 616: "tunisia", 620: "libya", 625: "sudan",
    626: "south_sudan", 630: "iran", 645: "iraq", 651: "egypt",
    652: "syria", 678: "yemen", 700: "afghanistan", 703: "kyrgyzstan",
    775: "myanmar", 790: "nepal", 820: "malaysia", 850: "indonesia",
    860: "east_timor",
}

# ── Load configs ────────────────────────────────────────────────────────────────

def load_countries():
    with open(DATA_CONFIG / "countries.yaml", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    result = {}
    for country_id in raw.keys():
        iso3 = ISO3_MAP.get(country_id)
        if iso3:
            result[country_id] = {
                "iso3": iso3,
                "iso2": ISO2_MAP.get(country_id, ""),
                "gw": next((gw for gw, cid in GW_TO_COUNTRY.items() if cid == country_id), None),
            }
    return result


def load_fundamental_metrics():
    with open(DATA_CONFIG / "fundamental_metrics.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_registry():
    with open(DATA_CANONICAL / "registry.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_registry(registry):
    registry["meta"]["last_updated"] = str(date.today())
    with open(DATA_CANONICAL / "registry.yaml", "w", encoding="utf-8") as f:
        yaml.dump(registry, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


# ── Status log helpers ──────────────────────────────────────────────────────────

def load_series_status(series_id):
    path = DATA_CANONICAL_STATUS / f"{series_id}.yaml"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def save_series_status(series_id, status):
    path = DATA_CANONICAL_STATUS / f"{series_id}.yaml"
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(status, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


# ── CSV helpers ─────────────────────────────────────────────────────────────────

CSV_HEADER = ["iso3", "country_id", "year", "value", "status", "download_date", "notes"]


def read_csv(csv_path):
    if not csv_path.exists():
        return {}
    result = {}
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            result[(row["iso3"], row["year"])] = row
    return result


def write_csv(csv_path, rows):
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_HEADER)
        w.writeheader()
        w.writerows(rows)


def dict_to_rows(data_by_country, countries, today):
    """data_by_country: {country_id: {year: value}}. Returns canonical rows (available only)."""
    id_to_iso3 = {cid: meta["iso3"] for cid, meta in countries.items()}
    rows = []
    for country_id, year_vals in data_by_country.items():
        iso3 = id_to_iso3.get(country_id)
        if not iso3:
            continue
        for year, val in sorted(year_vals.items(), key=lambda x: str(x[0])):
            if val is None:
                continue
            rows.append({
                "iso3": iso3, "country_id": country_id, "year": str(year),
                "value": str(val), "status": "available",
                "download_date": today, "notes": "",
            })
    return sorted(rows, key=lambda r: (r["iso3"], r["year"]))


def make_status(series_id, today, data_by_country, countries):
    countries_with_data = set(data_by_country.keys())
    countries_not_in_source = [
        cid for cid in countries if cid not in set(data_by_country.keys())
    ]
    return {
        "series_id": series_id,
        "last_download": today,
        "countries_attempted": len(countries),
        "countries_available": len(countries_with_data),
        "countries_not_in_source": countries_not_in_source,
        "download_errors": [],
        "plan": {},
    }


# ── World Bank downloader ───────────────────────────────────────────────────────

WB_BASE = "https://api.worldbank.org/v2/country/{iso3s}/indicator/{code}"


def download_worldbank(series_id, wb_code, countries, csv_path, force=False):
    today = str(date.today())
    existing = read_csv(csv_path) if not force else {}
    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}
    iso3_batch = ";".join(v["iso3"] for v in countries.values())
    url = WB_BASE.format(iso3s=iso3_batch, code=wb_code)
    try:
        resp = requests.get(url, params={"format": "json", "per_page": "20000", "mrv": "66"}, timeout=60)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return [], {"error": str(e), "last_attempt": today}

    if not data or len(data) < 2 or not data[1]:
        return [], {"error": "Empty response from WB API", "last_attempt": today}

    rows_by_key = {}
    for rec in data[1]:
        iso3 = rec.get("countryiso3code", "")
        if not iso3 or iso3 not in iso3_to_id:
            continue
        country_id = iso3_to_id[iso3]
        year = str(rec.get("date", ""))
        val = rec.get("value")
        key = (iso3, year)
        rows_by_key[key] = {
            "iso3": iso3, "country_id": country_id, "year": year,
            "value": str(val) if val is not None else "",
            "status": "available" if val is not None else "source_gap",
            "download_date": today, "notes": "",
        }
    for key, row in existing.items():
        if key not in rows_by_key:
            rows_by_key[key] = row

    countries_with_data = {r["country_id"] for r in rows_by_key.values() if r["status"] == "available"}
    countries_not = [cid for cid in countries if cid not in {r["country_id"] for r in rows_by_key.values()}]
    rows = sorted(rows_by_key.values(), key=lambda r: (r["iso3"], r["year"]))
    return rows, {
        "series_id": series_id, "last_download": today,
        "countries_attempted": len(countries), "countries_available": len(countries_with_data),
        "countries_not_in_source": countries_not, "download_errors": [], "plan": {},
    }


# ── ILO downloader ──────────────────────────────────────────────────────────────
# Public API: rplumber.ilo.org — no auth required
# URL: https://rplumber.ilo.org/data/indicator/?id={CODE}_A&ref_area={ISO2s}&lang=en&type=label&format=.csv

ILO_BASE = "https://rplumber.ilo.org/data/indicator/"

# Per-indicator filter config: which classif1 values to try (in preference order)
ILO_CONFIG = {
    # Count series (NB = number of persons)
    "EAP_TEAP_SEX_AGE_NB": {"sex": "SEX_T", "classif1_prefs": ["AGE_YTHADULT_YGE15", "AGE_AGGREGATE_TOTAL"]},
    "UNE_TUNE_SEX_AGE_NB": {"sex": "SEX_T", "classif1_prefs": ["AGE_YTHADULT_YGE15", "AGE_AGGREGATE_TOTAL"]},
    "EMP_TEMP_SEX_AGE_NB": {"sex": "SEX_T", "classif1_prefs": ["AGE_YTHADULT_YGE15", "AGE_AGGREGATE_TOTAL"]},
    # Rate series — correct rplumber API codes (differ from ILOSTAT bulk download codes)
    "UNE_DEAP_SEX_AGE_RT": {"sex": "SEX_T", "classif1_prefs": ["AGE_YTHADULT_YGE15", "AGE_AGGREGATE_TOTAL"]},
    "EAP_DWAP_SEX_AGE_RT": {"sex": "SEX_T", "classif1_prefs": ["AGE_YTHADULT_YGE15", "AGE_AGGREGATE_TOTAL"]},
    "EIP_NEET_SEX_AGE_RT": {"sex": "SEX_T", "classif1_prefs": ["AGE_AGGREGATE_YTH1524", "AGE_YTHADULT_YGE15", "AGE_AGGREGATE_TOTAL"]},
    # EMP_2EMP_SEX_ECO_RT (informal employment rate) has no valid rplumber endpoint
}


def download_ilo(series_id, ilo_code, countries, csv_path, force=False):
    """Download ILO indicator for all target countries from rplumber API.

    The ILO rplumber API does not support multi-country filtering via ref_area,
    so we download all countries (no filter) and select our 40 target countries
    client-side. Values are in thousands of persons (for count series) or percent.
    """
    today = str(date.today())

    cfg = ILO_CONFIG.get(ilo_code)
    if not cfg:
        return [], {"series_id": series_id, "download_errors": [f"No ILO filter config for {ilo_code}"]}

    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}
    target_iso3 = set(iso3_to_id.keys())

    url = ILO_BASE
    params = {
        "id": f"{ilo_code}_A",
        "lang": "en",
        "type": "code",   # Use code (not label) to get machine-readable classif values
        "format": ".csv",
    }

    print(f"    Fetching ILO {ilo_code} (all countries, will filter to {len(countries)})...", flush=True)
    try:
        resp = requests.get(url, params=params, timeout=300)
        resp.raise_for_status()
        text = resp.text
    except Exception as e:
        print(f"    ERROR: {e}", file=sys.stderr)
        return [], {"series_id": series_id, "download_errors": [str(e)]}

    if not text.strip():
        return [], {"series_id": series_id, "download_errors": ["Empty response from ILO API"]}

    # Parse the CSV (comma-separated, quoted)
    reader = csv.DictReader(io.StringIO(text))

    target_sex = cfg["sex"]
    classif1_prefs = cfg["classif1_prefs"]

    # First pass: collect all rows matching target countries and sex
    # Group by (country_id, year) → {classif1: value}
    by_country_year = {}  # {(country_id, year): {classif1: value}}

    for row in reader:
        iso3 = (row.get("ref_area") or "").strip().upper()
        if iso3 not in target_iso3:
            continue
        country_id = iso3_to_id[iso3]
        sex = (row.get("sex") or "").strip().upper()
        if sex != target_sex:
            continue
        classif1 = (row.get("classif1") or "").strip().upper()
        year_str = (row.get("time") or "").strip()
        try:
            year = int(year_str)
        except ValueError:
            continue
        val_str = (row.get("obs_value") or "").strip()
        if not val_str:
            continue
        try:
            val = float(val_str)
        except ValueError:
            continue
        key = (country_id, year)
        by_country_year.setdefault(key, {})[classif1] = val

    # Second pass: pick best classif1 value per (country, year) based on preference
    data = {}
    for (country_id, year), classif_vals in by_country_year.items():
        val = None
        for pref in classif1_prefs:
            if pref.upper() in classif_vals:
                val = classif_vals[pref.upper()]
                break
        if val is None:
            # Fallback: pick first available classif1 whose key contains "TOTAL" or "YGE15"
            for k, v in classif_vals.items():
                if "TOTAL" in k or "YGE15" in k or "YTH" in k:
                    val = v
                    break
        if val is None:
            continue
        data.setdefault(country_id, {})[year] = val

    rows = dict_to_rows(data, countries, today)
    status = make_status(series_id, today, data, countries)
    status["ilo_code"] = ilo_code
    status["classif1_prefs"] = classif1_prefs
    return rows, status


# ── UCDP GED downloader ─────────────────────────────────────────────────────────
# Public download: ucdp.uu.se/downloads/ged/ged241-csv.zip (no auth)
# Covers 1989–2023. One ZIP download produces all 5 UCDP series.

UCDP_GED_URL = "https://ucdp.uu.se/downloads/ged/ged241-csv.zip"
UCDP_GED_CACHE = DATA_CANONICAL / "ucdp" / "_ged_cache.csv"

_GOVT_KEYWORDS = frozenset([
    "government", "forces of", "military", "army", "police",
    "national guard", "security forces", "armed forces", "air force",
    "navy", "marines", "gendarmerie", "paramilitary",
])


def _is_govt_actor(side_a: str) -> bool:
    s = side_a.lower()
    return any(kw in s for kw in _GOVT_KEYWORDS)


def _download_ucdp_ged(force=False):
    """Download and cache the UCDP GED CSV. Returns path to cached CSV or None."""
    UCDP_GED_CACHE.parent.mkdir(parents=True, exist_ok=True)
    if UCDP_GED_CACHE.exists() and not force:
        print(f"    Using cached UCDP GED: {UCDP_GED_CACHE}")
        return UCDP_GED_CACHE

    print(f"    Downloading UCDP GED from {UCDP_GED_URL} ...", flush=True)
    try:
        resp = requests.get(UCDP_GED_URL, timeout=300, stream=True)
        resp.raise_for_status()
        zip_data = resp.content
    except Exception as e:
        print(f"    ERROR downloading UCDP GED: {e}", file=sys.stderr)
        return None

    print(f"    Extracting GED CSV ({len(zip_data)//1024//1024} MB zip)...")
    try:
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
            if not csv_names:
                print("    ERROR: No CSV found in UCDP zip", file=sys.stderr)
                return None
            csv_name = csv_names[0]
            with zf.open(csv_name) as src, open(UCDP_GED_CACHE, "wb") as dst:
                dst.write(src.read())
    except Exception as e:
        print(f"    ERROR extracting UCDP GED: {e}", file=sys.stderr)
        return None

    print(f"    Cached to {UCDP_GED_CACHE}")
    return UCDP_GED_CACHE


def download_ucdp(series_id, sub_code, countries, csv_path, force=False):
    """
    Download UCDP GED (once, cached) and aggregate into the requested sub-series.
    sub_code values: BDEATHS_INTERNAL, BDEATHS_INTERSTATE, OSV_GOVT, OSV_REBEL, NSA
    """
    today = str(date.today())
    ged_path = _download_ucdp_ged(force=force)
    if not ged_path:
        return [], {"series_id": series_id, "download_errors": ["UCDP GED download failed"]}

    # {country_id: {year: total_deaths}}
    data = {}

    try:
        with open(ged_path, newline="", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    year = int(row.get("year", 0))
                    tov = int(row.get("type_of_violence", 0))
                    best = float(row.get("best", 0) or 0)
                    # GED v24.1: location GW code is in "country_id"; side-A code is in "gwnoa"
                    gwno_loc = int(row.get("country_id", 0) or 0)
                    gwno_a_raw = row.get("gwnoa", "")
                    side_a = row.get("side_a", "")
                except (ValueError, TypeError):
                    continue

                # gwnoa may be a semicolon-separated list; take first
                try:
                    gwno_a = int(gwno_a_raw.split(";")[0].strip())
                except (ValueError, AttributeError):
                    gwno_a = 0

                def add_deaths(gw_code):
                    cid = GW_TO_COUNTRY.get(gw_code)
                    if cid and cid in countries:
                        data.setdefault(cid, {})
                        data[cid][year] = data[cid].get(year, 0) + best

                if sub_code == "BDEATHS_INTERNAL":
                    # State-based (tov=1) deaths inside the country
                    if tov == 1:
                        add_deaths(gwno_loc)

                elif sub_code == "BDEATHS_INTERSTATE":
                    # State-based deaths: country's forces fighting outside own territory
                    if tov == 1 and gwno_a and gwno_a != gwno_loc:
                        add_deaths(gwno_a)

                elif sub_code == "NSA":
                    # Non-state actor conflicts (tov=2) — location is home country
                    if tov == 2:
                        add_deaths(gwno_loc)

                elif sub_code == "OSV_GOVT":
                    # One-sided violence (tov=3) by government actors
                    if tov == 3 and _is_govt_actor(side_a):
                        add_deaths(gwno_loc)

                elif sub_code == "OSV_REBEL":
                    # One-sided violence (tov=3) by non-government actors
                    if tov == 3 and not _is_govt_actor(side_a):
                        add_deaths(gwno_loc)

    except Exception as e:
        return [], {"series_id": series_id, "download_errors": [f"GED parse error: {e}"]}

    # Round to integers
    for cid in data:
        for yr in data[cid]:
            data[cid][yr] = round(data[cid][yr])

    rows = dict_to_rows(data, countries, today)
    status = make_status(series_id, today, data, countries)
    return rows, status


# ── UNHCR downloader ────────────────────────────────────────────────────────────
# Public API at api.unhcr.org/population/v1/population — no auth required
# All UNHCR series come from the single /population endpoint.
# Use coo=<ISO3> for country-of-origin series, coa=<ISO3> for country-of-asylum.

UNHCR_BASE = "https://api.unhcr.org/population/v1"

# sub_code → (filter_param, value_field_in_response)
UNHCR_SERIES_CONFIG = {
    "REF_ORIGIN":            {"filter": "coo", "field": "refugees"},
    "REF_ASYLUM":            {"filter": "coa", "field": "refugees"},
    "IDP_TOTAL":             {"filter": "coo", "field": "idps"},
    "RETURNEES_INT":         {"filter": "coo", "field": "returned_refugees"},
    "RETURNEES_IDP":         {"filter": "coo", "field": "returned_idps"},
    "ASYLUM_SEEKERS_ORIGIN": {"filter": "coo", "field": "asylum_seekers"},
}

# Module-level cache: {(filter_param, iso3): {year: {field: value}}}
_UNHCR_CACHE = {}


def _fetch_unhcr_country(filter_param, iso3):
    """Fetch all years of UNHCR population data for one country via the given filter."""
    cache_key = (filter_param, iso3)
    if cache_key in _UNHCR_CACHE:
        return _UNHCR_CACHE[cache_key]

    result = {}  # {year: {field: value}}
    page = 1
    while True:
        try:
            r = requests.get(
                f"{UNHCR_BASE}/population",
                params={filter_param: iso3, "limit": 100, "page": page},
                timeout=30,
            )
            r.raise_for_status()
            payload = r.json()
        except Exception as e:
            print(f"    UNHCR fetch error ({filter_param}={iso3} page {page}): {e}", file=sys.stderr)
            break

        items = payload.get("items", [])
        for item in items:
            coo = str(item.get("coo", "") or "").upper()
            coa = str(item.get("coa", "") or "").upper()
            # Skip global aggregates (coo="-")
            if filter_param == "coo" and coo == "-":
                continue
            if filter_param == "coa" and coa == "-":
                continue
            year = item.get("year")
            if not year:
                continue
            yr = int(year)
            if yr not in result:
                result[yr] = {}
            for field in ("refugees", "asylum_seekers", "returned_refugees", "idps",
                          "returned_idps", "stateless"):
                raw = item.get(field)
                if raw is None or str(raw) in ("-", ""):
                    continue
                try:
                    result[yr][field] = float(str(raw).replace(",", ""))
                except (ValueError, TypeError):
                    pass

        max_pages = payload.get("maxPages", 1)
        if page >= max_pages or not items:
            break
        page += 1
        time.sleep(0.1)

    _UNHCR_CACHE[cache_key] = result
    return result


def download_unhcr(series_id, sub_code, countries, csv_path, force=False):
    today = str(date.today())
    cfg = UNHCR_SERIES_CONFIG.get(sub_code)
    if not cfg:
        return [], {"series_id": series_id, "download_errors": [f"No UNHCR config for {sub_code}"]}

    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}
    filter_param = cfg["filter"]
    value_field = cfg["field"]

    print(f"    Fetching UNHCR {sub_code} ({filter_param}=<iso3> × {len(countries)} countries)...",
          flush=True)

    data = {}
    for country_id, meta in countries.items():
        iso3 = meta["iso3"]
        year_data = _fetch_unhcr_country(filter_param, iso3)
        for yr, fields in year_data.items():
            val = fields.get(value_field)
            if val is not None:
                data.setdefault(country_id, {})[yr] = round(val)

    rows = dict_to_rows(data, countries, today)
    status = make_status(series_id, today, data, countries)
    status["unhcr_endpoint"] = "population"
    return rows, status


# ── IMF WEO downloader ──────────────────────────────────────────────────────────
# GitHub mirror of IMF World Economic Outlook database — no auth
# Raw CSVs: https://raw.githubusercontent.com/datasets/imf-weo/main/data/

IMF_VALUES_URL = "https://raw.githubusercontent.com/datasets/imf-weo/main/data/values.csv"
IMF_COUNTRY_URL = "https://raw.githubusercontent.com/datasets/imf-weo/main/data/country.csv"
IMF_INDICATORS_URL = "https://raw.githubusercontent.com/datasets/imf-weo/main/data/indicators.csv"

# Cache the WEO download so multiple series don't re-download
_IMF_CACHE = {}


def _load_imf_data():
    global _IMF_CACHE
    if _IMF_CACHE:
        return _IMF_CACHE

    print("    Downloading IMF WEO from GitHub datasets mirror...", flush=True)
    try:
        # Country code mapping
        country_resp = requests.get(IMF_COUNTRY_URL, timeout=60)
        country_resp.raise_for_status()
        country_rows = list(csv.DictReader(io.StringIO(country_resp.text)))

        # Build WEO code → ISO3 map
        weo_to_iso3 = {}
        for row in country_rows:
            weo_code = row.get("weo_code") or row.get("WEO Country Code") or row.get("code")
            iso3 = row.get("iso") or row.get("ISO") or row.get("iso3")
            if weo_code and iso3:
                weo_to_iso3[str(weo_code).strip()] = str(iso3).strip()

        # Values CSV
        values_resp = requests.get(IMF_VALUES_URL, timeout=120)
        values_resp.raise_for_status()
        values_rows = list(csv.DictReader(io.StringIO(values_resp.text)))
    except Exception as e:
        print(f"    ERROR loading IMF WEO data: {e}", file=sys.stderr)
        return None

    _IMF_CACHE = {"weo_to_iso3": weo_to_iso3, "values": values_rows}
    return _IMF_CACHE


def download_imf(series_id, imf_code, countries, csv_path, force=False):
    today = str(date.today())
    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}

    imf_data = _load_imf_data()
    if not imf_data:
        return [], {"series_id": series_id, "download_errors": ["Failed to load IMF WEO data"]}

    weo_to_iso3 = imf_data["weo_to_iso3"]
    values_rows = imf_data["values"]

    # Find the indicator code column — might be "indicator" or "weo_subject_code" or "Subject Code"
    if not values_rows:
        return [], {"series_id": series_id, "download_errors": ["No rows in IMF values CSV"]}

    sample = values_rows[0]
    ind_col = next((c for c in sample if "indicator" in c.lower() or "subject" in c.lower()), None)
    # values.csv has "Country" which directly stores ISO3 codes (e.g. "AFG", "IRQ")
    iso_col = next((c for c in sample if c.lower() in ("iso", "iso3", "iso_code", "country")), None)
    weo_col = next((c for c in sample if "weo" in c.lower() and "country" in c.lower()), None)
    year_col = next((c for c in sample if c.lower() in ("year", "date")), None)
    val_col = next((c for c in sample if c.lower() in ("value", "obs_value", "amount")), None)

    data = {}
    for row in values_rows:
        # Determine indicator code
        ind_val = (row.get(ind_col, "") or "").strip().upper()
        if ind_val != imf_code.upper():
            continue

        # Determine ISO3
        iso3 = (row.get(iso_col, "") or "").strip()
        if not iso3 and weo_col:
            weo_code = (row.get(weo_col, "") or "").strip()
            iso3 = weo_to_iso3.get(weo_code, "")
        if not iso3:
            continue

        country_id = iso3_to_id.get(iso3)
        if not country_id:
            continue

        year_str = (row.get(year_col, "") or "").strip()
        try:
            year = int(year_str)
        except ValueError:
            continue

        val_str = (row.get(val_col, "") or "").strip()
        if not val_str:
            continue
        try:
            val = float(val_str.replace(",", ""))
        except ValueError:
            continue

        data.setdefault(country_id, {})[year] = val

    rows = dict_to_rows(data, countries, today)
    status = make_status(series_id, today, data, countries)
    return rows, status


# ── UNDP HDI downloader ─────────────────────────────────────────────────────────
# Direct CSV from hdr.undp.org — no auth required
# Wide format: one row per country, columns hdi_1990, hdi_1991, ..., hdi_2022

UNDP_HDI_URL = "https://hdr.undp.org/sites/default/files/2023-24_HDR/HDR23-24_Composite_indices_complete_time_series.csv"


def download_undp(series_id, sub_code, countries, csv_path, force=False):
    today = str(date.today())
    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}

    print(f"    Downloading UNDP HDI from hdr.undp.org...", flush=True)
    try:
        resp = requests.get(UNDP_HDI_URL, timeout=120)
        resp.raise_for_status()
        text = resp.text
    except Exception as e:
        return [], {"series_id": series_id, "download_errors": [str(e)]}

    reader = csv.DictReader(io.StringIO(text))
    # Column format: iso3 (or "iso3"), country, hdi_1990, hdi_1991, ..., hdi_2022
    # (or hdi_rank_2022 for ranks — skip those)

    iso3_col = None
    hdi_cols = {}  # year → column name

    data = {}
    rows_read = list(reader)
    if not rows_read:
        return [], {"series_id": series_id, "download_errors": ["Empty UNDP CSV"]}

    # Find ISO3 column and HDI year columns
    sample = rows_read[0]
    for col in sample:
        cl = col.lower().strip()
        if cl in ("iso3", "iso_code", "iso"):
            iso3_col = col
        # Match hdi_YYYY columns (not hdi_rank_YYYY)
        if cl.startswith("hdi_") and "rank" not in cl and "change" not in cl:
            year_part = cl.replace("hdi_", "").split("_")[0]
            try:
                yr = int(year_part)
                hdi_cols[yr] = col
            except ValueError:
                pass

    if not iso3_col:
        # Try "country_code" fallback
        iso3_col = next((c for c in sample if "code" in c.lower() and len(sample[c].strip()) == 3), None)

    for row in rows_read:
        iso3 = (row.get(iso3_col, "") or "").strip().upper()
        country_id = iso3_to_id.get(iso3)
        if not country_id:
            continue
        for yr, col in hdi_cols.items():
            val_str = (row.get(col, "") or "").strip()
            if not val_str or val_str in ("..", "—", "n.a.", ".."):
                continue
            try:
                val = float(val_str)
            except ValueError:
                continue
            data.setdefault(country_id, {})[yr] = val

    rows = dict_to_rows(data, countries, today)
    status = make_status(series_id, today, data, countries)
    return rows, status


# ── V-Dem file processor ────────────────────────────────────────────────────────
# V-Dem CSV is freely downloadable from https://www.v-dem.net/data/the-v-dem-dataset/
# (no login required; select "Country-Year: Full+Others" or "Country-Year: Core")
# Usage: python3 download_canonical.py --source vdem --file V-Dem-CY-Full-v14.csv

VDEM_SERIES_MAP = {
    "VD_POLYARCHY": "v2x_polyarchy",
    "VD_LIBDEM": "v2x_libdem",
}


def process_vdem_csv(series_id, vdem_var, countries, csv_path, file_path, force=False):
    """Parse a locally-downloaded V-Dem country-year CSV."""
    today = str(date.today())
    fp = Path(file_path)
    if not fp.exists():
        return [], {"series_id": series_id, "download_errors": [f"File not found: {file_path}"]}

    # V-Dem CSV may be inside a zip
    if fp.suffix.lower() == ".zip":
        print(f"    Extracting V-Dem CSV from zip...", flush=True)
        try:
            with zipfile.ZipFile(fp) as zf:
                csv_names = [n for n in zf.namelist() if n.endswith(".csv") and "country_year" in n.lower() or "CY" in n]
                if not csv_names:
                    csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
                if not csv_names:
                    return [], {"series_id": series_id, "download_errors": ["No CSV found in V-Dem zip"]}
                with zf.open(csv_names[0]) as f:
                    text = io.TextIOWrapper(f, encoding="utf-8", errors="replace").read()
        except Exception as e:
            return [], {"series_id": series_id, "download_errors": [str(e)]}
    else:
        text = fp.read_text(encoding="utf-8", errors="replace")

    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}
    # V-Dem uses its own country_text_id (ISO3-like) or country_id
    data = {}
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        # Try multiple column names for ISO3
        iso3 = (row.get("country_text_id") or row.get("iso_code") or row.get("iso3") or "").strip().upper()
        country_id = iso3_to_id.get(iso3)
        if not country_id:
            continue
        year_str = (row.get("year") or "").strip()
        try:
            year = int(year_str)
        except ValueError:
            continue
        val_str = (row.get(vdem_var) or "").strip()
        if not val_str or val_str == "NA":
            continue
        try:
            val = round(float(val_str), 6)
        except ValueError:
            continue
        data.setdefault(country_id, {})[year] = val

    rows = dict_to_rows(data, countries, today)
    status = make_status(series_id, today, data, countries)
    status["vdem_variable"] = vdem_var
    status["source_file"] = str(file_path)
    return rows, status


# ── ACLED file processor ────────────────────────────────────────────────────────
# ACLED data requires a free account at acleddata.com/data-export-tool/
# Export all events for relevant countries, download as CSV
# Usage: python3 download_canonical.py --source acled --file acled_export.csv

ACLED_SERIES_MAP = {
    "ACLED_FATALITIES": "fatalities",
    "ACLED_EVENTS": "_count",  # Special: count rows per country-year
}


def process_acled_csv(series_id, sub_code, countries, csv_path, file_path, force=False):
    """Parse a locally-downloaded ACLED events CSV."""
    today = str(date.today())
    fp = Path(file_path)
    if not fp.exists():
        return [], {"series_id": series_id, "download_errors": [f"File not found: {file_path}"]}

    text = fp.read_text(encoding="utf-8", errors="replace")
    iso3_to_id = {v["iso3"]: k for k, v in countries.items()}
    data = {}

    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        iso3 = (row.get("iso3") or row.get("ISO3") or row.get("country_iso3") or "").strip().upper()
        country_id = iso3_to_id.get(iso3)
        if not country_id:
            # Try country name lookup
            country_name = (row.get("country") or "").strip().lower()
            for cid, meta in countries.items():
                # Simple heuristic — check if country name is close
                if cid.replace("_", " ") in country_name or country_name in cid.replace("_", " "):
                    country_id = cid
                    break
        if not country_id:
            continue

        year_str = (row.get("year") or row.get("event_date", "")[:4]).strip()
        try:
            year = int(year_str)
        except ValueError:
            continue

        if sub_code == "FATALITIES":
            val_str = (row.get("fatalities") or row.get("FATALITIES") or "0").strip()
            try:
                val = float(val_str)
            except ValueError:
                continue
            data.setdefault(country_id, {})
            data[country_id][year] = data[country_id].get(year, 0) + val
        elif sub_code == "EVENTS":
            data.setdefault(country_id, {})
            data[country_id][year] = data[country_id].get(year, 0) + 1

    # Round fatalities to int
    if sub_code == "FATALITIES":
        for cid in data:
            for yr in data[cid]:
                data[cid][yr] = round(data[cid][yr])

    rows = dict_to_rows(data, countries, today)
    status = make_status(series_id, today, data, countries)
    status["source_file"] = str(file_path)
    return rows, status


# ── Main dispatch ────────────────────────────────────────────────────────────────

def get_series_to_download(args, metrics, registry):
    series_list = []
    if args.series:
        for sid in args.series.split(","):
            sid = sid.strip()
            if sid in registry["series"]:
                series_list.append((sid, registry["series"][sid]))
            else:
                print(f"WARNING: Series {sid} not found in registry", file=sys.stderr)
        return series_list

    source_map = {
        "worldbank": "world_bank",
        "ilo": "ilo",
        "ucdp": "ucdp",
        "acled": "acled",
        "unhcr": "unhcr",
        "vdem": "vdem",
        "imf": "imf",
        "undp": "undp",
    }

    for cat in metrics.get("categories", {}).values():
        for series_id, series_meta in cat.get("series", {}).items():
            src = series_meta.get("source", "")
            priority = series_meta.get("priority", 3)

            if args.source and args.source != "all":
                expected = source_map.get(args.source, args.source)
                if src != expected:
                    continue

            if args.priority and priority > args.priority:
                continue

            if series_id in registry["series"]:
                series_list.append((series_id, registry["series"][series_id]))

    return series_list


def print_status(registry, metrics):
    total = len(registry["series"])
    downloaded = sum(1 for s in registry["series"].values() if s.get("downloaded"))
    print(f"\nCanonical Series Status: {downloaded}/{total} downloaded")
    print("-" * 60)
    by_source = {}
    for sid, meta in registry["series"].items():
        src = meta.get("source", "unknown")
        by_source.setdefault(src, {"total": 0, "downloaded": 0})
        by_source[src]["total"] += 1
        if meta.get("downloaded"):
            by_source[src]["downloaded"] += 1
    for src, counts in sorted(by_source.items()):
        pct = counts["downloaded"] / counts["total"] * 100 if counts["total"] else 0
        print(f"  {src:20s}: {counts['downloaded']:3d}/{counts['total']:3d} ({pct:.0f}%)")


def main():
    parser = argparse.ArgumentParser(description="Download canonical series data")
    parser.add_argument("--source", help="worldbank|ilo|ucdp|unhcr|imf|undp|vdem|acled|all")
    parser.add_argument("--priority", type=int, choices=[1, 2, 3])
    parser.add_argument("--series", help="Specific series ID(s), comma-separated")
    parser.add_argument("--countries", help="Comma-separated country IDs (default: all)")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--all", action="store_true", dest="download_all")
    parser.add_argument("--file", help="Path to locally-downloaded CSV (for --source vdem or acled)")
    args = parser.parse_args()

    if not args.source and not args.series and not args.download_all and not args.status:
        parser.print_help()
        sys.exit(0)

    countries = load_countries()
    metrics = load_fundamental_metrics()
    registry = load_registry()

    if args.status:
        print_status(registry, metrics)
        return

    if args.countries:
        requested = set(args.countries.split(","))
        countries = {k: v for k, v in countries.items() if k in requested}

    if args.download_all:
        args.source = "all"

    series_to_download = get_series_to_download(args, metrics, registry)

    if not series_to_download:
        print("No series matched the given filters.")
        return

    print(f"\nSeries to download: {len(series_to_download)}")
    for sid, _ in series_to_download:
        print(f"  {sid}")

    if args.dry_run:
        print("\n[dry-run] No files written.")
        return

    downloaded_count = 0
    error_count = 0

    for series_id, reg_meta in series_to_download:
        # Look up series metadata
        series_meta = None
        for cat in metrics.get("categories", {}).values():
            if series_id in cat.get("series", {}):
                series_meta = cat["series"][series_id]
                break
        if not series_meta:
            continue

        source = series_meta.get("source", "")
        source_code = series_meta.get("source_code", "")
        csv_path = ROOT / reg_meta["canonical_file"]

        if not args.force and csv_path.exists():
            print(f"  SKIP {series_id} (already downloaded, use --force to re-download)")
            continue

        print(f"  Downloading {series_id} ({source})...")
        rows, status_info = [], {}

        if source == "world_bank":
            wb_code = series_meta.get("source_code", series_id.replace("WB_", "").replace("WGI_", ""))
            rows, status_info = download_worldbank(series_id, wb_code, countries, csv_path, args.force)

        elif source == "ilo":
            rows, status_info = download_ilo(series_id, source_code, countries, csv_path, args.force)

        elif source == "ucdp":
            rows, status_info = download_ucdp(series_id, source_code, countries, csv_path, args.force)

        elif source == "unhcr":
            rows, status_info = download_unhcr(series_id, source_code, countries, csv_path, args.force)

        elif source == "imf":
            rows, status_info = download_imf(series_id, source_code, countries, csv_path, args.force)

        elif source == "undp":
            rows, status_info = download_undp(series_id, source_code, countries, csv_path, args.force)

        elif source == "vdem":
            if not args.file:
                print(f"  NOTE: V-Dem requires --file <path> to a locally-downloaded CSV.")
                print(f"        Download from: https://www.v-dem.net/data/the-v-dem-dataset/")
                status_info = {
                    "series_id": series_id, "last_download": None,
                    "download_errors": ["V-Dem requires --file argument"],
                    "plan": {"all": "Download V-Dem Country-Year CSV from v-dem.net, then run with --file"},
                }
            else:
                vdem_var = VDEM_SERIES_MAP.get(series_id, source_code)
                rows, status_info = process_vdem_csv(series_id, vdem_var, countries, csv_path, args.file, args.force)

        elif source == "acled":
            if not args.file:
                print(f"  NOTE: ACLED requires --file <path> to a locally-downloaded CSV.")
                print(f"        Download from: https://acleddata.com/data-export-tool/  (free account)")
                status_info = {
                    "series_id": series_id, "last_download": None,
                    "download_errors": ["ACLED requires --file argument"],
                    "plan": {"all": "Create free account at acleddata.com, export all relevant countries as CSV"},
                }
            else:
                sub = source_code.replace("FATALITIES", "FATALITIES").replace("EVENTS", "EVENTS")
                rows, status_info = process_acled_csv(series_id, sub, countries, csv_path, args.file, args.force)

        else:
            print(f"  NOTE: No automated downloader for source '{source}'")
            url_val = series_meta.get("url", "see fundamental_metrics.yaml")
            status_info = {
                "series_id": series_id, "last_download": None,
                "download_errors": [f"No downloader for '{source}'"],
                "plan": {"all": f"Download manually from {url_val}"},
            }

        if rows:
            write_csv(csv_path, rows)
            available = sum(1 for r in rows if r["status"] == "available")
            print(f"    -> {csv_path.name}: {len(rows)} rows, {available} available")
            downloaded_count += 1
            registry["series"][series_id]["downloaded"] = True
            registry["series"][series_id]["last_download"] = str(date.today())
        else:
            if status_info.get("download_errors"):
                error_count += 1
            else:
                print(f"    -> No data rows returned for {series_id}")

        save_series_status(series_id, status_info)
        time.sleep(0.3)

    save_registry(registry)
    print(f"\nDone. Downloaded: {downloaded_count}, Errors/manual: {error_count}")


if __name__ == "__main__":
    main()

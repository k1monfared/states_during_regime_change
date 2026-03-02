#!/usr/bin/env python3
"""
Data collection progress visualization.
Shows fill rate per country × indicator as a color-coded grid.

A cell is "filled" when data_status is complete, partial, not_applicable,
or unavailable — i.e. someone has assessed the entry.
"missing" means the scaffolded template has not been touched yet.

Usage:
    python3 data/scripts/progress.py              # full grid
    python3 data/scripts/progress.py --summary    # totals only, no grid
    python3 data/scripts/progress.py --country iraq
    python3 data/scripts/progress.py --no-color
"""

import argparse
import sys
from pathlib import Path

import yaml

# ── ANSI helpers ──────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
DIM    = "\033[2m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

USE_COLOR = True


def c(text, pct):
    """Wrap text in an ANSI color based on fill percentage."""
    if not USE_COLOR:
        return text
    if pct >= 80:
        return f"{GREEN}{text}{RESET}"
    elif pct >= 30:
        return f"{YELLOW}{text}{RESET}"
    else:
        return f"{RED}{text}{RESET}"


def bold(text):
    return f"{BOLD}{text}{RESET}" if USE_COLOR else text


def dim(text):
    return f"{DIM}{text}{RESET}" if USE_COLOR else text


# ── Config ────────────────────────────────────────────────────────────────────
def get_project_root():
    return Path(__file__).resolve().parent.parent.parent


def load_configs(project_root):
    cfg = project_root / "data" / "config"
    with open(cfg / "countries.yaml") as f:
        countries = yaml.safe_load(f)
    with open(cfg / "indicators.yaml") as f:
        indicators = yaml.safe_load(f)
    return countries, indicators


FILLED = {"complete", "partial", "not_applicable", "unavailable"}

# 4-char abbreviations for the grid header
ABBREV = {
    "territorial_control":       "terr",
    "political_violence":        "viol",
    "institutional_functioning": "inst",
    "civil_liberties":           "clib",
    "elite_cohesion":            "elit",
    "gdp_per_capita":            "gdp ",
    "inflation":                 "infl",
    "unemployment":              "unem",
    "trade_openness":            "trad",
    "fiscal_health":             "fisc",
    "sanctions":                 "sanc",
    "diplomatic_integration":    "dipl",
    "foreign_military":          "fmil",
    "fdi":                       "fdi ",
    "refugee_flows":             "refg",
    "budget_transparency":       "budg",
    "press_freedom":             "prss",
    "statistical_transparency":  "stat",
    "legal_transparency":        "legl",
    "extractive_transparency":   "extr",
}

DIM_LABEL = {
    "political":     "POLITICAL",
    "economic":      "ECONOMIC",
    "international": "INTERNATL",
    "transparency":  "TRANSPRCY",
}


# ── File scanning ─────────────────────────────────────────────────────────────
def scan_file(fp):
    """Return (filled_years, total_years). (0,0) if file absent or unreadable."""
    if not fp.exists():
        return 0, 0
    try:
        with open(fp) as f:
            data = yaml.safe_load(f)
        if not data or not isinstance(data.get("years"), dict):
            return 0, 0
        years = data["years"]
        total = len(years)
        filled = sum(
            1 for y in years.values()
            if isinstance(y, dict) and y.get("data_status") in FILLED
        )
        return filled, total
    except Exception:
        return 0, 0


# ── Formatting ────────────────────────────────────────────────────────────────
def cell(pct, has_file):
    """4-char display string, colored.  Trailing space added by caller."""
    if not has_file:
        return dim(" -- ")
    txt = f"{pct:3.0f}%"
    return c(txt, pct)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    global USE_COLOR

    ap = argparse.ArgumentParser(description="Data collection progress")
    ap.add_argument("--summary",  action="store_true", help="Totals only, no grid")
    ap.add_argument("--country",  type=str,            help="Detail view for one country")
    ap.add_argument("--no-color", action="store_true", help="Disable ANSI colors")
    args = ap.parse_args()

    if args.no_color:
        USE_COLOR = False

    root = get_project_root()
    raw_dir = root / "data" / "raw"
    countries, indicators = load_configs(root)

    dims = list(indicators.keys())
    country_list = list(countries.keys())
    if args.country:
        if args.country not in countries:
            print(f"Error: '{args.country}' not in countries.yaml", file=sys.stderr)
            sys.exit(1)
        country_list = [args.country]

    # ── Build matrix[cid][dim][ind] = (filled, total) ────────────────────────
    matrix = {
        cid: {
            dim: {
                ind: scan_file(raw_dir / cid / dim / f"{ind}.yaml")
                for ind in indicators[dim]
            }
            for dim in dims
        }
        for cid in country_list
    }

    # ── Per-country totals ────────────────────────────────────────────────────
    def country_pct(cid):
        f = t = 0
        for dim in dims:
            for ind in indicators[dim]:
                fi, ti = matrix[cid][dim][ind]
                f += fi; t += ti
        return (f / t * 100) if t > 0 else 0.0, f, t

    cpcts = {cid: country_pct(cid) for cid in country_list}

    # ── Per-indicator totals ──────────────────────────────────────────────────
    def ind_pct(dim, ind):
        f = t = 0
        for cid in country_list:
            fi, ti = matrix[cid][dim][ind]
            f += fi; t += ti
        return (f / t * 100) if t > 0 else 0.0

    # ── Grand total ───────────────────────────────────────────────────────────
    grand_f = sum(cpcts[cid][1] for cid in country_list)
    grand_t = sum(cpcts[cid][2] for cid in country_list)
    grand_pct = (grand_f / grand_t * 100) if grand_t > 0 else 0.0

    # ═════════════════════════════════════════════════════════════════════════
    # SINGLE COUNTRY DETAIL
    # ═════════════════════════════════════════════════════════════════════════
    if args.country:
        cid = args.country
        cname = countries[cid].get("display_name", cid)
        overall, _, _ = cpcts[cid]
        print(f"\n{bold(cname)} — fill rates\n")
        for dim in dims:
            print(f"  {bold(dim.upper())}")
            for ind in indicators[dim]:
                fi, ti = matrix[cid][dim][ind]
                pct = (fi / ti * 100) if ti > 0 else 0.0
                abbr = ABBREV.get(ind, ind[:8])
                bar = f"{fi}/{ti} yrs" if ti > 0 else "no file"
                txt = f"    {abbr}  {cell(pct, ti > 0)}  ({bar})"
                print(txt)
            print()
        print(f"  Overall: {c(f'{overall:.0f}%', overall)}\n")
        return

    # ═════════════════════════════════════════════════════════════════════════
    # SUMMARY ONLY
    # ═════════════════════════════════════════════════════════════════════════
    if args.summary:
        done    = sum(1 for cid in country_list if cpcts[cid][0] >= 95)
        started = sum(1 for cid in country_list if 0 < cpcts[cid][0] < 95)
        empty   = sum(1 for cid in country_list if cpcts[cid][0] == 0)

        print(f"\nOverall coverage:         {c(f'{grand_pct:.1f}%', grand_pct)}")
        print(f"Year-entries assessed:    {grand_f:,} / {grand_t:,}")
        print(f"Countries ≥95% complete:  {done}")
        print(f"Countries in progress:    {started}")
        print(f"Countries not started:    {empty}")

        ranked = sorted(cpcts.items(), key=lambda x: x[1][0], reverse=True)
        print(f"\nTop 5:")
        for cid, (pct, _, _) in ranked[:5]:
            nm = countries[cid].get("display_name", cid)
            print(f"  {nm:28s} {c(f'{pct:.0f}%', pct)}")
        if len(ranked) > 5:
            print(f"\nBottom 5:")
            for cid, (pct, _, _) in ranked[-5:]:
                nm = countries[cid].get("display_name", cid)
                print(f"  {nm:28s} {c(f'{pct:.0f}%', pct)}")
        print()
        return

    # ═════════════════════════════════════════════════════════════════════════
    # FULL GRID
    # ═════════════════════════════════════════════════════════════════════════
    NAME_W = 17   # country name column (truncated/padded)
    CELL_W = 5    # 4-char value + 1 space
    n_inds = 5    # indicators per dimension (fixed)
    BLK_W  = 2 + n_inds * CELL_W   # "| " + 5 cells = 27 chars

    sep = "-" * (NAME_W + BLK_W * len(dims) + 2 + CELL_W)

    # ── Header row 1: dimension labels ────────────────────────────────────────
    h1 = " " * NAME_W
    for dim in dims:
        lbl = DIM_LABEL[dim]
        h1 += f"| {bold(lbl):<9} "[:BLK_W + (9 if USE_COLOR else 0)]
        # dimension label padded to fill the block width
        pad = BLK_W - 2 - len(lbl)
        h1 = h1.rstrip()   # undo the slice trick; rebuild cleanly
    # Rebuild h1 cleanly without slice tricks:
    h1 = " " * NAME_W
    for dim in dims:
        lbl = DIM_LABEL[dim]
        block_plain_w = BLK_W  # 27
        inner_w = block_plain_w - 2  # 25 for "| " prefix removed
        h1 += "| " + bold(lbl) + " " * (inner_w - len(lbl))
    h1 += "| ALL "
    print("\n" + h1)

    # ── Header row 2: indicator abbreviations ────────────────────────────────
    h2 = " " * NAME_W
    for dim in dims:
        h2 += "| "
        for ind in indicators[dim]:
            h2 += ABBREV.get(ind, ind[:4]) + " "
    h2 += "|     "
    print(h2)

    print(sep)

    # ── Data rows ─────────────────────────────────────────────────────────────
    for cid in country_list:
        nm = countries[cid].get("display_name", cid)
        row = f"{nm[:NAME_W]:<{NAME_W}}"
        for dim in dims:
            row += "| "
            for ind in indicators[dim]:
                fi, ti = matrix[cid][dim][ind]
                pct = (fi / ti * 100) if ti > 0 else 0.0
                row += cell(pct, ti > 0) + " "
        pct_all, _, _ = cpcts[cid]
        row += "| " + c(f"{pct_all:3.0f}%", pct_all)
        print(row)

    print(sep)

    # ── Footer: per-indicator totals ─────────────────────────────────────────
    foot = f"{'TOTAL':<{NAME_W}}"
    for dim in dims:
        foot += "| "
        for ind in indicators[dim]:
            pct = ind_pct(dim, ind)
            foot += cell(pct, True) + " "
    foot += "| " + c(f"{grand_pct:3.0f}%", grand_pct)
    print(foot)

    print(f"\nDataset: {c(f'{grand_pct:.1f}%', grand_pct)} assessed  "
          f"({grand_f:,} / {grand_t:,} year-entries)\n")


if __name__ == "__main__":
    main()

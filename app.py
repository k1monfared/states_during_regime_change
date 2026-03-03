#!/usr/bin/env python3
"""
app.py — Flask backend for the data audit and verification interface.

Routes:
    GET  /audit                       — main coverage matrix
    GET  /audit/country/<id>          — per-country series detail
    GET  /audit/series/<series_id>    — per-series country coverage
    GET  /audit/gaps                  — all gaps with plans
    POST /api/verify                  — mark observation verified
    POST /api/plan                    — add/update gap collection plan
    GET  /api/coverage                — return current coverage.json

Usage:
    python app.py
    python app.py --port 5001
"""

import argparse
import csv
import json
import os
import sys
from datetime import date
from pathlib import Path

from flask import Flask, jsonify, render_template, request, abort

import yaml

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent
DATA_CONFIG = ROOT / "data" / "config"
DATA_CANONICAL = ROOT / "data" / "canonical"
DATA_CANONICAL_STATUS = DATA_CANONICAL / "status"
DOCS_DATA = ROOT / "docs" / "data"
VERIFICATION_FILE = ROOT / "data" / "verification.json"

app = Flask(__name__, template_folder="templates")


# ── Data loaders (cached in memory) ───────────────────────────────────────────

_CACHE = {}


def _load(key, loader):
    if key not in _CACHE:
        _CACHE[key] = loader()
    return _CACHE[key]


def load_countries():
    def _load():
        with open(DATA_CONFIG / "countries.yaml", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
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
        result = {}
        for cid, meta in raw.items():
            result[cid] = {
                "display_name": meta.get("display_name", cid),
                "region": meta.get("region", ""),
                "regime_change_years": meta.get("regime_change_years", []),
                "iso3": ISO3_MAP.get(cid, ""),
            }
        return result
    return _load(f"countries", _load)


def load_registry():
    def _load():
        with open(DATA_CANONICAL / "registry.yaml", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return _load("registry", _load)


def load_fundamental_metrics():
    def _load():
        path = DATA_CONFIG / "fundamental_metrics.yaml"
        if not path.exists():
            return {}
        with open(path, encoding="utf-8") as f:
            return yaml.safe_load(f)
    return _load("fundamental_metrics", _load)


def load_verification():
    if VERIFICATION_FILE.exists():
        with open(VERIFICATION_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_verification(data):
    with open(VERIFICATION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    # Invalidate cache
    _CACHE.pop("verification", None)


def load_coverage():
    def _load():
        path = DOCS_DATA / "coverage.json"
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        return None
    return _load("coverage", _load)


def build_series_info():
    """Build flat dict: series_id → {name, category, unit, priority}"""
    metrics = load_fundamental_metrics()
    info = {}
    for cat_id, cat in metrics.get("categories", {}).items():
        for sid, smeta in cat.get("series", {}).items():
            info[sid] = {
                "name": smeta.get("name", sid),
                "category": cat_id,
                "unit": smeta.get("unit", ""),
                "priority": smeta.get("priority", 3),
                "used_by": smeta.get("used_by", []),
                "source": smeta.get("source", ""),
            }
    return info


def get_canonical_data(series_id):
    """Load canonical CSV rows for a series_id."""
    registry = load_registry()
    if series_id not in registry.get("series", {}):
        return []
    canonical_file = registry["series"][series_id].get("canonical_file", "")
    if not canonical_file:
        return []
    csv_path = ROOT / canonical_file
    if not csv_path.exists():
        return []
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def compute_coverage_summary():
    """
    Compute live coverage summary from canonical CSVs.
    Returns: {country_id: {total, available, source_gap, ...}, series_summary: {series_id: {...}}}
    """
    registry = load_registry()
    countries = load_countries()
    verification = load_verification()
    series_info = build_series_info()

    country_summary = {cid: {
        "total_obs": 0, "available": 0, "source_gap": 0,
        "not_in_source": 0, "download_error": 0, "estimated": 0,
        "coverage_pct": 0.0, "verified": 0,
    } for cid in countries}

    series_summary = {}

    for series_id, reg_meta in registry.get("series", {}).items():
        canonical_file = reg_meta.get("canonical_file", "")
        if not canonical_file:
            continue
        csv_path = ROOT / canonical_file
        if not csv_path.exists():
            series_summary[series_id] = {"downloaded": False, "available": 0}
            continue

        rows = get_canonical_data(series_id)
        available = 0
        for row in rows:
            cid = row.get("country_id", "")
            if cid not in countries:
                continue
            year = row.get("year", "")
            status = row.get("status", "source_gap")

            if cid in country_summary:
                country_summary[cid]["total_obs"] += 1
                if status in country_summary[cid]:
                    country_summary[cid][status] += 1
                vkey = f"{series_id}/{cid}/{year}"
                if verification.get(vkey, {}).get("verified"):
                    country_summary[cid]["verified"] += 1
            if status == "available":
                available += 1

        series_summary[series_id] = {
            "downloaded": True,
            "available": available,
            "total_rows": len(rows),
        }

    for cid, s in country_summary.items():
        if s["total_obs"] > 0:
            s["coverage_pct"] = round(s["available"] / s["total_obs"] * 100, 1)

    return country_summary, series_summary


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index_redirect():
    from flask import redirect
    return redirect("/audit")


@app.route("/audit")
def audit_index():
    """Main coverage matrix page."""
    countries = load_countries()
    series_info = build_series_info()
    registry = load_registry()
    verification = load_verification()

    country_summary, series_summary = compute_coverage_summary()

    # Compute overall stats
    total_series = len(series_info)
    downloaded_series = sum(1 for s in registry.get("series", {}).values() if s.get("downloaded"))
    total_obs = sum(s["total_obs"] for s in country_summary.values())
    total_avail = sum(s["available"] for s in country_summary.values())
    total_verified = sum(s["verified"] for s in country_summary.values())
    coverage_pct = round(total_avail / total_obs * 100, 1) if total_obs else 0
    verified_pct = round(total_verified / total_avail * 100, 1) if total_avail else 0

    # Category breakdown
    categories = {}
    for sid, info in series_info.items():
        cat = info["category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "downloaded": 0}
        categories[cat]["total"] += 1
        if series_summary.get(sid, {}).get("downloaded"):
            categories[cat]["downloaded"] += 1

    return render_template("audit_index.html",
        countries=countries,
        series_info=series_info,
        registry=registry.get("series", {}),
        country_summary=country_summary,
        series_summary=series_summary,
        categories=categories,
        stats={
            "total_series": total_series,
            "downloaded_series": downloaded_series,
            "total_obs": total_obs,
            "total_avail": total_avail,
            "total_verified": total_verified,
            "coverage_pct": coverage_pct,
            "verified_pct": verified_pct,
        },
    )


@app.route("/audit/country/<country_id>")
def audit_country(country_id):
    """Per-country series detail page."""
    countries = load_countries()
    if country_id not in countries:
        abort(404)

    series_info = build_series_info()
    registry = load_registry()
    verification = load_verification()

    country_meta = countries[country_id]
    country_series = {}

    for series_id, reg_meta in registry.get("series", {}).items():
        rows = get_canonical_data(series_id)
        country_rows = [r for r in rows if r.get("country_id") == country_id]
        if not country_rows:
            # Check if series is in any CSV
            sinfo = series_info.get(series_id, {})
            country_series[series_id] = {
                "info": sinfo,
                "rows": [],
                "available": 0,
                "coverage_years": 0,
                "downloaded": reg_meta.get("downloaded", False),
                "verified_count": 0,
            }
            continue

        available = sum(1 for r in country_rows if r.get("status") == "available")
        verified_count = sum(
            1 for r in country_rows
            if verification.get(f"{series_id}/{country_id}/{r.get('year', '')}", {}).get("verified")
        )

        # Sort rows by year
        country_rows.sort(key=lambda r: r.get("year", ""))

        country_series[series_id] = {
            "info": series_info.get(series_id, {"name": series_id, "category": "unknown"}),
            "rows": country_rows,
            "available": available,
            "coverage_years": len(country_rows),
            "downloaded": reg_meta.get("downloaded", False),
            "verified_count": verified_count,
        }

    # Group by category
    by_category = {}
    for sid, sdata in country_series.items():
        cat = sdata["info"].get("category", "other")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append((sid, sdata))

    return render_template("audit_country.html",
        country_id=country_id,
        country_meta=country_meta,
        country_series=country_series,
        by_category=by_category,
        verification=verification,
    )


@app.route("/audit/series/<path:series_id>")
def audit_series(series_id):
    """Per-series view across all countries."""
    series_info = build_series_info()
    registry = load_registry()
    countries = load_countries()
    verification = load_verification()

    if series_id not in series_info and series_id not in registry.get("series", {}):
        abort(404)

    rows = get_canonical_data(series_id)

    # Group rows by country
    by_country = {}
    for row in rows:
        cid = row.get("country_id", "")
        if cid not in by_country:
            by_country[cid] = []
        by_country[cid].append(row)

    # Sort each country's rows by year
    for cid in by_country:
        by_country[cid].sort(key=lambda r: r.get("year", ""))

    # Load series status file if it exists
    status_data = {}
    status_path = DATA_CANONICAL_STATUS / f"{series_id}.yaml"
    if status_path.exists():
        with open(status_path, encoding="utf-8") as f:
            status_data = yaml.safe_load(f) or {}

    sinfo = series_info.get(series_id, {"name": series_id})
    reg_meta = registry.get("series", {}).get(series_id, {})

    return render_template("audit_series.html",
        series_id=series_id,
        series_info=sinfo,
        reg_meta=reg_meta,
        countries=countries,
        by_country=by_country,
        status_data=status_data,
        verification=verification,
    )


@app.route("/audit/gaps")
def audit_gaps():
    """Show all gaps with collection plans."""
    series_info = build_series_info()
    registry = load_registry()
    countries = load_countries()

    gaps = []
    for series_id, reg_meta in registry.get("series", {}).items():
        if not reg_meta.get("downloaded", False):
            sinfo = series_info.get(series_id, {})
            # Load status file for plan info
            status_path = DATA_CANONICAL_STATUS / f"{series_id}.yaml"
            plan = {}
            if status_path.exists():
                with open(status_path, encoding="utf-8") as f:
                    status_data = yaml.safe_load(f) or {}
                plan = status_data.get("plan", {})
                errors = status_data.get("download_errors", [])
            else:
                errors = []

            gaps.append({
                "series_id": series_id,
                "name": sinfo.get("name", series_id),
                "source": sinfo.get("source", reg_meta.get("source", "")),
                "category": sinfo.get("category", ""),
                "priority": sinfo.get("priority", 3),
                "plan": plan,
                "errors": errors,
            })

    # Sort by priority then source
    gaps.sort(key=lambda g: (g["priority"], g["source"]))

    return render_template("audit_gaps.html",
        gaps=gaps,
        series_info=series_info,
    )


# ── API endpoints ───────────────────────────────────────────────────────────────

@app.route("/api/verify", methods=["POST"])
def api_verify():
    """Mark an observation as verified."""
    data = request.json
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    series_id = data.get("series_id")
    country_id = data.get("country_id")
    year = str(data.get("year", ""))
    note = data.get("note", "")
    unverify = data.get("unverify", False)

    if not all([series_id, country_id, year]):
        return jsonify({"error": "Missing series_id, country_id, or year"}), 400

    verification = load_verification()
    key = f"{series_id}/{country_id}/{year}"

    if unverify:
        verification.pop(key, None)
        save_verification(verification)
        return jsonify({"status": "unverified", "key": key})

    verification[key] = {
        "verified": True,
        "verified_by": "human",
        "verified_date": str(date.today()),
        "note": note,
    }
    save_verification(verification)
    return jsonify({"status": "verified", "key": key})


@app.route("/api/plan", methods=["POST"])
def api_plan():
    """Add or update a collection plan for a gap."""
    data = request.json
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    series_id = data.get("series_id")
    plan_text = data.get("plan", "")
    country_id = data.get("country_id", "all")

    if not series_id:
        return jsonify({"error": "Missing series_id"}), 400

    status_path = DATA_CANONICAL_STATUS / f"{series_id}.yaml"
    status_data = {}
    if status_path.exists():
        with open(status_path, encoding="utf-8") as f:
            status_data = yaml.safe_load(f) or {}

    if "plan" not in status_data:
        status_data["plan"] = {}
    status_data["plan"][country_id] = plan_text

    DATA_CANONICAL_STATUS.mkdir(parents=True, exist_ok=True)
    with open(status_path, "w", encoding="utf-8") as f:
        yaml.dump(status_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    return jsonify({"status": "ok", "series_id": series_id, "country": country_id})


@app.route("/api/coverage")
def api_coverage():
    """Return current coverage.json (or compute live if not present)."""
    coverage_path = DOCS_DATA / "coverage.json"
    if coverage_path.exists():
        with open(coverage_path, encoding="utf-8") as f:
            return jsonify(json.load(f))

    # Generate live summary
    country_summary, series_summary = compute_coverage_summary()
    return jsonify({
        "meta": {"generated": str(date.today()), "note": "live computation — run build_coverage.py for full data"},
        "summary": country_summary,
        "series_summary": series_summary,
    })


# ── Main ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Data audit Flask server")
    parser.add_argument("--port", type=int, default=5000, help="Port to listen on")
    parser.add_argument("--host", default="127.0.0.1", help="Host to listen on")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    print(f"Starting audit server at http://{args.host}:{args.port}/audit")
    app.run(host=args.host, port=args.port, debug=args.debug)

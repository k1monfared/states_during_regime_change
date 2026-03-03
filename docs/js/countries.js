/**
 * countries.js — Country browser logic
 */

import { loadAll, loadCountryRaw, loadDefinitions } from "./data.js";
import { encodeState } from "./state.js";

const DIMENSION_ORDER = ["political", "economic", "international", "transparency"];
const DIMENSION_LABELS = {
  political: "Political",
  economic: "Economic",
  international: "International",
  transparency: "Transparency",
};
const INDICATOR_LABELS = {
  territorial_control: "Territorial Control",
  political_violence: "Political Violence",
  institutional_functioning: "Institutional Functioning",
  civil_liberties: "Civil Liberties",
  elite_cohesion: "Elite Cohesion",
  gdp_per_capita: "GDP per Capita",
  inflation: "Inflation",
  unemployment: "Unemployment",
  trade_openness: "Trade Openness",
  fiscal_health: "Fiscal Health",
  sanctions: "Sanctions",
  diplomatic_integration: "Diplomatic Integration",
  foreign_military: "Foreign Military",
  fdi: "FDI",
  refugee_flows: "Refugee Flows",
  budget_transparency: "Budget Transparency",
  press_freedom: "Press Freedom",
  statistical_transparency: "Statistical Transparency",
  legal_transparency: "Legal Transparency",
  extractive_transparency: "Extractive Transparency",
};

let _allData = null;
let _selectedCountry = null;

export async function init() {
  _allData = await loadAll();
  _renderNav();

  // Select from URL hash ?country=iraq
  const params = new URLSearchParams(window.location.search);
  const initial = params.get("country");
  if (initial && _allData.countries[initial]) {
    selectCountry(initial);
  } else {
    // Select first country
    const ids = _getSortedCountryIds();
    if (ids.length > 0) selectCountry(ids[0]);
  }

  document.getElementById("country-nav-search")?.addEventListener("input", (e) => {
    _renderNav(e.target.value.toLowerCase());
  });

  // Event delegation for "read more / show less" — one listener survives country switches
  document.getElementById("country-main")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-read-more");
    if (!btn) return;
    const span = btn.previousElementSibling;
    if (!span) return;
    const clamped = span.classList.toggle("assessment-clamp");
    btn.textContent = clamped ? "read more" : "show less";
  });
}

function _getSortedCountryIds() {
  return Object.keys(_allData.countries)
    .filter((k) => !k.startsWith("_"))
    .sort((a, b) =>
      (_allData.countries[a]?.display_name ?? a).localeCompare(
        _allData.countries[b]?.display_name ?? b
      )
    );
}

function _renderNav(search = "") {
  const nav = document.getElementById("country-nav");
  if (!nav) return;

  const groups = _allData.countries._groups?.by_region ?? {};
  const REGION_LABELS = {
    mena: "Middle East & North Africa",
    africa_violent: "Africa — Violent Transitions",
    africa_peaceful: "Africa — Peaceful Transitions",
    eastern_europe: "Eastern Europe",
    asia: "Asia",
    latin_america: "Latin America",
  };

  nav.innerHTML = "";

  for (const [regionId, countryIds] of Object.entries(groups)) {
    const filtered = countryIds.filter((id) => {
      if (!search) return true;
      return (_allData.countries[id]?.display_name ?? id).toLowerCase().includes(search);
    });
    if (filtered.length === 0) continue;

    const heading = document.createElement("div");
    heading.className = "country-group-heading";
    heading.textContent = REGION_LABELS[regionId] ?? regionId;
    nav.appendChild(heading);

    for (const id of filtered) {
      const meta = _allData.countries[id];
      const item = document.createElement("div");
      item.className = "country-nav-item" + (_selectedCountry === id ? " active" : "");
      item.dataset.id = id;
      item.textContent = meta?.display_name ?? id;
      item.addEventListener("click", () => selectCountry(id));
      nav.appendChild(item);
    }
  }
}

async function selectCountry(id) {
  _selectedCountry = id;

  // Update nav active state
  document.querySelectorAll(".country-nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const main = document.getElementById("country-main");
  if (!main) return;

  main.innerHTML = `<div class="loading">Loading ${id}…</div>`;

  const meta = _allData.countries[id];
  let rawData;
  try {
    rawData = await loadCountryRaw(id);
  } catch (err) {
    main.innerHTML = `<div class="error-msg">Failed to load raw data: ${err.message}</div>`;
    return;
  }

  // Load definitions for per-indicator source info (best-effort; failure is non-fatal)
  let definitions = {};
  try {
    definitions = await loadDefinitions();
  } catch (_e) {
    // definitions stays empty; indicator source blocks simply won't render
  }

  // Build dashboard link
  const dashState = {
    v: 1,
    countries: [id],
    countryOrder: [id],
    chartMode: "overlay",
    metrics: ["composite"],
    custom: [],
    xMode: "aligned",
    pivots: {},
    range: [
      (meta?.years?.[0] ?? 1990),
      (meta?.years?.[meta.years.length - 1] ?? 2026),
    ],
  };
  const dashHash = encodeState(dashState);
  const dashUrl = `index.html#${dashHash}`;

  const rcYears = meta?.regime_change_years ?? [];

  // Render header
  let html = `
    <div class="country-header">
      <h2>${meta?.display_name ?? id}</h2>
      <div class="country-meta">
        <span class="meta-tag">${meta?.region ?? "unknown"}</span>
        <span class="meta-tag">${(meta?.category ?? "unknown").replace(/_/g, " ")}</span>
        ${rcYears.map((y) => `<span class="meta-tag regime-year">Regime change: ${y}</span>`).join("")}
      </div>
      ${meta?.notes ? `<div class="country-notes">${meta.notes}</div>` : ""}
      <a href="${dashUrl}" class="btn-open-dashboard">Open in Dashboard →</a>
    </div>
  `;

  // Render dimensions
  for (const dim of DIMENSION_ORDER) {
    const dimData = rawData?.[dim];
    const dimLabel = DIMENSION_LABELS[dim] ?? dim;

    html += `
      <div class="dimension-section" data-dim="${dim}">
        <button class="dimension-toggle" data-dim="${dim}">
          ${dimLabel}
          <span class="toggle-icon">▶</span>
        </button>
        <div class="dimension-body" data-dim="${dim}">
    `;

    if (!dimData) {
      html += `<div style="padding:8px 12px;font-size:12px;color:var(--text-muted)">No data available</div>`;
    } else {
      for (const [indId, indYears] of Object.entries(dimData)) {
        const indLabel = INDICATOR_LABELS[indId] ?? indId.replace(/_/g, " ");
        const yearKeys = Object.keys(indYears).sort();
        const coverage = yearKeys.filter((y) => indYears[y]?.status !== "unavailable").length;

        // Build source definition block for this indicator
        const def = definitions[`${dim}/${indId}`];
        let defBlock = "";
        if (def) {
          const sourceLink = def.primary_source
            ? (def.primary_source_url
                ? `<a href="${_esc(def.primary_source_url)}" target="_blank" rel="noopener">${_esc(def.primary_source)}</a>`
                : _esc(def.primary_source))
            : "";
          const concept = (def.concept ?? "").replace(/\s+/g, " ").trim();
          const transform = (def.project_transform ?? "").replace(/\s+/g, " ").trim();
          const breakText = (def.methodology_break ?? "").replace(/\s+/g, " ").trim();
          const coverageStr = [def.coverage_period, def.frequency].filter(Boolean).join(" · ");
          const caveats = def.caveats ?? [];

          defBlock = `<div class="indicator-definition">`;
          if (sourceLink) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Source</span><span class="ind-def-value">${sourceLink}</span></div>`;
          if (def.series_id) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Series</span><span class="ind-def-value">${_esc(def.series_id)}</span></div>`;
          if (concept) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Concept</span><span class="ind-def-value">${_esc(concept)}</span></div>`;
          if (def.numerator) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Numerator</span><span class="ind-def-value">${_esc(def.numerator)}</span></div>`;
          if (def.denominator) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Denominator</span><span class="ind-def-value">${_esc(def.denominator)}</span></div>`;
          if (def.native_unit) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Native unit</span><span class="ind-def-value">${_esc(def.native_unit)}</span></div>`;
          if (transform) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Transform</span><span class="ind-def-value">${_esc(transform)}</span></div>`;
          if (coverageStr) defBlock += `<div class="ind-def-row"><span class="ind-def-label">Coverage</span><span class="ind-def-value">${_esc(coverageStr)}</span></div>`;
          if (breakText) defBlock += `<div class="methodology-break-notice">${_esc(breakText)}</div>`;
          if (caveats.length) {
            defBlock += `<div class="ind-def-row"><span class="ind-def-label">Caveats</span><span class="ind-def-value"><ul>${caveats.map((c) => `<li>${_esc(c)}</li>`).join("")}</ul></span></div>`;
          }
          defBlock += `</div>`;
        }

        html += `
          <div class="indicator-section">
            <button class="indicator-toggle" data-ind="${indId}">
              <span class="ind-name">${indLabel}</span>
              <span class="ind-coverage">${coverage}/${yearKeys.length} years</span>
              <span class="toggle-icon">▶</span>
            </button>
            <div class="indicator-body" data-ind="${indId}">
              ${defBlock}
              <table class="raw-data-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Status</th>
                    <th>Raw Value</th>
                    <th>Score (0–100)</th>
                    <th>Confidence</th>
                    <th>Assessment</th>
                    <th>Sources</th>
                  </tr>
                </thead>
                <tbody>
        `;

        for (const year of yearKeys) {
          const entry = indYears[year];
          const status = entry?.status ?? "unknown";
          const statusClass =
            status === "complete"
              ? "status-complete"
              : status === "partial"
              ? "status-partial"
              : "status-unavailable";
          const confidence = entry?.confidence ?? "";
          const confClass =
            confidence === "high"
              ? "confidence-high"
              : confidence === "medium"
              ? "confidence-medium"
              : confidence === "low"
              ? "confidence-low"
              : "";
          const fullText = (entry?.assessment ?? "").replace(/\s+/g, " ").trim();
          const isLong = fullText.length > 400;
          const assessmentCell = fullText
            ? `<span class="assessment-text${isLong ? " assessment-clamp" : ""}">${_esc(fullText)}</span>${isLong ? `<button class="btn-read-more">read more</button>` : ""}`
            : "—";
          const sources = (entry?.sources ?? [])
            .map((s) => `<span title="${s.citation}">${s.type ?? "source"}</span>`)
            .join(", ");
          const rawVal = entry?.raw_value != null
            ? `${entry.raw_value}${entry.unit ? ` <small class="raw-unit">${_esc(entry.unit.replace(/_/g, " "))}</small>` : ""}`
            : "—";
          const combinedScore = _allData.combined?.[id]?.[year]?.[dim]?.[indId];
          const scoreCell = combinedScore != null ? combinedScore.toFixed(1) : "—";

          html += `
            <tr>
              <td>${year}</td>
              <td><span class="status-badge ${statusClass}">${status}</span></td>
              <td>${rawVal}</td>
              <td class="score-cell">${scoreCell}</td>
              <td class="confidence-badge ${confClass}">${confidence || "—"}</td>
              <td>${assessmentCell}</td>
              <td>${sources || "—"}</td>
            </tr>
          `;
        }

        html += `</tbody></table></div></div>`;
      }
    }

    html += `</div></div>`;
  }

  main.innerHTML = html;

  // Wire toggle buttons
  main.querySelectorAll(".dimension-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dim = btn.dataset.dim;
      const body = main.querySelector(`.dimension-body[data-dim="${dim}"]`);
      const icon = btn.querySelector(".toggle-icon");
      if (body) {
        body.classList.toggle("open");
        if (icon) icon.textContent = body.classList.contains("open") ? "▼" : "▶";
      }
    });
  });

  main.querySelectorAll(".indicator-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ind = btn.dataset.ind;
      const body = btn.nextElementSibling;
      const icon = btn.querySelector(".toggle-icon");
      if (body) {
        body.classList.toggle("open");
        if (icon) icon.textContent = body.classList.contains("open") ? "▼" : "▶";
      }
    });
  });
}

function _esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

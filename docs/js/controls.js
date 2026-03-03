/**
 * controls.js — Renders all UI controls and wires user interactions to state
 *
 * Depends on: state.js, data.js (allData passed in), SortableJS global
 */

import { state } from "./state.js";
import { pythonToJS } from "./data.js";

// Mirror chart.js color/dash assignments for sidebar indicators
const COUNTRY_COLORS = [
  "#2563eb","#dc2626","#16a34a","#d97706","#7c3aed",
  "#0891b2","#db2777","#65a30d","#ea580c","#475569",
];
const METRIC_DASH = ["solid","dash","dot","dashdot","longdash"];

// Collapse state for sidebar groups (persists across re-renders)
let _collapsedMetricGroups = new Set();
let _collapsedCountryGroups = new Set();
let _expandedFolds = new Set(); // indicator IDs with fold open
let _expandedDimFormulas = new Set(); // composite/dimension IDs with formula panel open

let _allData = null;
let _sortable = null;
let _customIdCounter = 0;

// ── Library (localStorage) ──────────────────────────────────────────────────

const LIBRARY_KEY = "rc_metric_library";

function _loadLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "[]"); }
  catch { return []; }
}

function _saveToLibrary(metric) {
  const lib = _loadLibrary();
  const idx = lib.findIndex((m) => m.slug === metric.slug);
  if (idx >= 0) lib[idx] = metric; else lib.push(metric);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
}

function _removeFromLibrary(slug) {
  const lib = _loadLibrary().filter((m) => m.slug !== slug);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Returns the chart color for a selected country (based on its position in the
// selected+ordered list, matching chart.js getColor assignment order).
function _countryColor(countryId, selectedInOrder) {
  const idx = selectedInOrder.indexOf(countryId);
  return idx >= 0 ? COUNTRY_COLORS[idx % COUNTRY_COLORS.length] : null;
}

// Returns a small SVG line element representing a dash style.
function _dashSvg(dash, active = true) {
  const arrays = {
    solid: "",
    dash: "5,2.5",
    dot: "1.5,2",
    dashdot: "5,2,1.5,2",
    longdash: "8,3",
  };
  const da = arrays[dash] ?? "";
  const color = active ? "#555" : "#ccc";
  return `<svg class="metric-dash-svg" width="18" height="10" viewBox="0 0 18 10"><line x1="1" y1="5" x2="17" y2="5" stroke="${color}" stroke-width="2.5"${da ? ` stroke-dasharray="${da}"` : ""}></line></svg>`;
}

function _methodologyAnchor(ind) {
  if (ind.id === "composite") return "aggregation";
  if (ind.type === "dimension") return `dim-${ind.id}`;
  return `ind-${ind.id.replace("/", "-")}`;
}

function _buildVarNames() {
  const scores = ["composite", "political", "economic", "international", "transparency",
                   "population_mobility", "social"];
  const rawVars = [];
  for (const ind of _allData.indicators) {
    if (ind.type === "indicator") {
      const slug = ind.id.split("/")[1];
      if (slug) {
        scores.push(slug);
        rawVars.push(`raw_${slug}`);
      }
    }
  }
  return [...scores, ...rawVars];
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function init(allData) {
  _allData = allData;
  _renderMetricList();
  _renderCustomPanel();
  _wireToolbar();
  _wireShareButton();
  _wireSidebarCollapse();

  state.subscribe((s) => {
    _renderCountryList(s);
    _updateToolbarFromState(s);
  });

  _renderCountryList(state.get());
  _updateToolbarFromState(state.get());
}

// ── Country list ──────────────────────────────────────────────────────────────

function _renderCountryList(s) {
  const ul = document.getElementById("country-list");
  if (!ul) return;

  const { countries: countriesMeta } = _allData;
  const search = document.getElementById("country-search")?.value.toLowerCase() ?? "";

  const allIds = Object.keys(countriesMeta).filter((k) => !k.startsWith("_"));
  const selectedSet = new Set(s.countries);

  // orderedSelected: selected countries in drag order
  const orderedSelected = s.countryOrder.filter((id) => allIds.includes(id) && selectedSet.has(id));

  // ── Selected countries in #country-list UL (draggable) ──────────────────────
  ul.innerHTML = "";

  const filteredSelected = orderedSelected.filter((id) => {
    if (!search) return true;
    const name = (countriesMeta[id]?.display_name ?? id).toLowerCase();
    return name.includes(search);
  });

  // Show/hide the "drag to reorder" label
  const reorderHeader = document.getElementById("selected-reorder-header");
  if (reorderHeader) reorderHeader.style.display = filteredSelected.length > 0 ? "" : "none";

  for (const id of filteredSelected) {
    const meta = countriesMeta[id];
    const displayName = meta?.display_name ?? id;
    const rcYears = meta?.regime_change_years ?? [];
    const color = _countryColor(id, orderedSelected);

    const li = document.createElement("li");
    li.className = "country-item";
    li.dataset.id = id;

    li.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <span class="country-color-dot" style="background:${color || 'transparent'};border:${color ? 'none' : '1px solid var(--border)'}"></span>
      <input type="checkbox" class="country-check" checked data-id="${id}">
      <span class="country-label">
        ${displayName}
        ${rcYears.length > 0 ? `<small class="country-regime-years">${rcYears.join(", ")}</small>` : ""}
      </span>
      <a href="countries.html?country=${id}" target="_blank" rel="noopener" class="info-link country-info-link" title="View country page">↗</a>
    `;

    ul.appendChild(li);

    if (s.xMode === "aligned" && rcYears.length > 1) {
      const alignRow = document.createElement("div");
      alignRow.className = "country-sub-row country-align-row";
      alignRow.dataset.for = id;

      const chosen = s.alignYears?.[id] ?? rcYears[0];
      const btns = rcYears
        .map(
          (y) =>
            `<button class="btn-align-year ${y === chosen ? "active" : ""}" data-country="${id}" data-year="${y}">${y}</button>`
        )
        .join("");

      alignRow.innerHTML = `<span class="sub-row-label">align:</span>${btns}`;
      ul.appendChild(alignRow);
    }

    if (s.xMode === "pivot") {
      const pivotRow = document.createElement("div");
      pivotRow.className = "country-sub-row country-pivot-row visible";
      pivotRow.dataset.for = id;

      const years = meta?.years ?? [];
      const minYear = years[0] ?? 1990;
      const maxYear = years[years.length - 1] ?? 2026;
      const defaultPivot = rcYears[0] ?? Math.round((minYear + maxYear) / 2);
      const currentPivot = s.pivots[id] ?? defaultPivot;
      const isModified = currentPivot !== defaultPivot;

      pivotRow.innerHTML = `
        <span class="sub-row-label">pivot:</span>
        <div class="pivot-stepper">
          <button class="pivot-step" data-country="${id}" data-delta="-1">‹</button>
          <input type="number" class="pivot-year-input" value="${currentPivot}" min="${minYear}" max="${maxYear}" data-country="${id}">
          <button class="pivot-step" data-country="${id}" data-delta="1">›</button>
          <button class="pivot-reset ${isModified ? "" : "pivot-reset-hidden"}" data-country="${id}" data-default="${defaultPivot}" title="Reset to default (${defaultPivot})">↺</button>
        </div>
      `;

      ul.appendChild(pivotRow);
    }
  }

  // Wire events for selected countries in ul
  ul.querySelectorAll(".country-check").forEach((cb) => {
    cb.addEventListener("change", () => state.toggleCountry(cb.dataset.id));
  });

  ul.querySelectorAll(".pivot-year-input").forEach((input) => {
    const countryId = input.dataset.country;
    input.addEventListener("change", () => {
      const min = parseInt(input.min, 10);
      const max = parseInt(input.max, 10);
      const year = Math.max(min, Math.min(max, parseInt(input.value, 10) || min));
      input.value = year;
      const resetBtn = input.closest(".pivot-stepper")?.querySelector(".pivot-reset");
      if (resetBtn) resetBtn.classList.toggle("pivot-reset-hidden", year === parseInt(resetBtn.dataset.default, 10));
      state.setPivot(countryId, year);
    });
  });

  ul.querySelectorAll(".pivot-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const stepper = btn.closest(".pivot-stepper");
      const input = stepper.querySelector(".pivot-year-input");
      const min = parseInt(input.min, 10);
      const max = parseInt(input.max, 10);
      const delta = parseInt(btn.dataset.delta, 10);
      const year = Math.max(min, Math.min(max, parseInt(input.value, 10) + delta));
      input.value = year;
      const resetBtn = stepper.querySelector(".pivot-reset");
      if (resetBtn) resetBtn.classList.toggle("pivot-reset-hidden", year === parseInt(resetBtn.dataset.default, 10));
      state.setPivot(btn.dataset.country, year);
    });
  });

  ul.querySelectorAll(".pivot-reset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const stepper = btn.closest(".pivot-stepper");
      const input = stepper.querySelector(".pivot-year-input");
      const defaultYear = parseInt(btn.dataset.default, 10);
      input.value = defaultYear;
      btn.classList.add("pivot-reset-hidden");
      state.setPivot(btn.dataset.country, defaultYear);
    });
  });

  ul.querySelectorAll(".btn-align-year").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.setAlignYear(btn.dataset.country, parseInt(btn.dataset.year, 10));
    });
  });

  // ── Sortable on #country-list (selected only) ────────────────────────────────
  if (_sortable) { _sortable.destroy(); _sortable = null; }
  if (window.Sortable) {
    _sortable = new Sortable(ul, {
      handle: ".drag-handle",
      animation: 120,
      ghostClass: "sortable-ghost",
      filter: ".country-sub-row",
      onEnd: () => {
        const newOrder = [];
        ul.querySelectorAll(".country-item").forEach((li) => {
          if (li.dataset.id && s.countries.includes(li.dataset.id)) newOrder.push(li.dataset.id);
        });
        state.setCountryOrder(newOrder);
      },
    });
  }

  // ── Unselected countries in #country-groups grouped by region ────────────────
  _renderCountryGroups(s, allIds, selectedSet, search, orderedSelected, countriesMeta);

  _renderGroupButtons(s);
}

function _renderCountryGroups(s, allIds, selectedSet, search, orderedSelected, countriesMeta) {
  const container = document.getElementById("country-groups");
  if (!container) return;

  const groups = _allData.countries._groups?.by_region ?? {};
  const REGION_ORDER = ["mena", "africa_violent", "africa_peaceful", "eastern_europe", "asia", "latin_america"];

  // Build a map: countryId -> regionId
  const countryToRegion = {};
  for (const [regionId, ids] of Object.entries(groups)) {
    for (const id of ids) countryToRegion[id] = regionId;
  }

  container.innerHTML = "";

  const allRegions = [...REGION_ORDER, "other"];
  for (const regionId of allRegions) {
    // All countries in this region (from data)
    const allInRegion = regionId === "other"
      ? allIds.filter((id) => !countryToRegion[id])
      : (groups[regionId] ?? []).filter((id) => allIds.includes(id));

    if (allInRegion.length === 0) continue;

    // Apply search filter (show all that match — selected or not)
    const filteredInRegion = search
      ? allInRegion.filter((id) => {
          const name = (countriesMeta[id]?.display_name ?? id).toLowerCase();
          return name.includes(search);
        })
      : allInRegion;

    if (filteredInRegion.length === 0) continue;

    // Sort alphabetically
    filteredInRegion.sort((a, b) =>
      (countriesMeta[a]?.display_name ?? a).localeCompare(countriesMeta[b]?.display_name ?? b)
    );

    const selectedCount = allInRegion.filter((id) => selectedSet.has(id)).length;
    const totalCount = allInRegion.length;

    const groupDiv = document.createElement("div");
    groupDiv.className = "country-group" + (_collapsedCountryGroups.has(regionId) ? " collapsed" : "");

    const headerDiv = document.createElement("div");
    headerDiv.className = "country-group-header";
    headerDiv.dataset.group = regionId;
    headerDiv.innerHTML = `
      <span class="country-group-chevron">▾</span>
      <span class="country-group-name">${_regionLabel(regionId)}</span>
      <span class="country-group-count">(${selectedCount}/${totalCount})</span>
      <button class="btn-select-group" data-region="${regionId}">Select all</button>
    `;

    const bodyDiv = document.createElement("div");
    bodyDiv.className = "country-group-body";

    for (const id of filteredInRegion) {
      const meta = countriesMeta[id];
      const displayName = meta?.display_name ?? id;
      const rcYears = meta?.regime_change_years ?? [];
      const isSelected = selectedSet.has(id);
      const color = isSelected ? _countryColor(id, orderedSelected) : null;

      const itemDiv = document.createElement("div");
      itemDiv.className = "country-item" + (isSelected ? " is-selected" : "");
      itemDiv.dataset.id = id;

      itemDiv.innerHTML = `
        <span class="country-color-dot" style="background:${color || "transparent"};${color ? "" : "border:1px solid transparent"}"></span>
        <input type="checkbox" class="country-check" data-id="${id}" ${isSelected ? "checked" : ""}>
        <span class="country-label">
          ${displayName}
          ${rcYears.length > 0 ? `<small class="country-regime-years">${rcYears.join(", ")}</small>` : ""}
        </span>
        <a href="countries.html?country=${id}" target="_blank" rel="noopener" class="info-link country-info-link" title="View country page">↗</a>
      `;

      bodyDiv.appendChild(itemDiv);
    }

    // Wire checkbox events on group body
    bodyDiv.querySelectorAll(".country-check").forEach((cb) => {
      cb.addEventListener("change", () => state.toggleCountry(cb.dataset.id));
    });

    // Wire "Select all" button
    headerDiv.querySelector(".btn-select-group").addEventListener("click", (e) => {
      e.stopPropagation();
      const regionIds = regionId === "other"
        ? allIds.filter((id) => !countryToRegion[id])
        : (groups[regionId] ?? []);
      state.selectGroup(regionIds);
    });

    // Wire header collapse toggle
    headerDiv.addEventListener("click", () => {
      if (_collapsedCountryGroups.has(regionId)) {
        _collapsedCountryGroups.delete(regionId);
        groupDiv.classList.remove("collapsed");
      } else {
        _collapsedCountryGroups.add(regionId);
        groupDiv.classList.add("collapsed");
      }
    });

    groupDiv.appendChild(headerDiv);
    groupDiv.appendChild(bodyDiv);
    container.appendChild(groupDiv);
  }
}

// ── Group buttons ─────────────────────────────────────────────────────────────

function _renderGroupButtons(s) {
  const container = document.getElementById("group-buttons");
  if (!container) return;

  const groups = _allData.countries._groups;
  if (!groups) return;

  const buttons = [];
  for (const [regionId, countryIds] of Object.entries(groups.by_region ?? {})) {
    buttons.push({ label: _regionLabel(regionId), id: `by_region:${regionId}`, ids: countryIds });
  }

  if (container.dataset.rendered) return;
  container.dataset.rendered = "1";
  container.innerHTML = "";

  for (const btn of buttons) {
    const b = document.createElement("button");
    b.className = "btn-group";
    b.textContent = btn.label;
    b.title = btn.ids.join(", ");
    b.addEventListener("click", () => state.selectGroup(btn.ids));
    container.appendChild(b);
  }
}

function _regionLabel(id) {
  return {
    mena: "MENA",
    africa_violent: "Africa (violent)",
    africa_peaceful: "Africa (peaceful)",
    eastern_europe: "E. Europe",
    asia: "Asia",
    latin_america: "LatAm",
  }[id] ?? id;
}

// ── Dimension formula helpers ─────────────────────────────────────────────────

/**
 * Build the default skip_and_renormalize formula for a composite or dimension metric.
 * The formula uses the same variable names that evaluateDimensionFormula() receives.
 */
function _defaultDimFormula(metricId, indicators) {
  let vars;
  if (metricId === "composite") {
    vars = ["political", "economic", "international", "transparency", "population_mobility", "social"];
  } else {
    vars = indicators
      .filter((ind) => ind.type === "indicator" && ind.id.startsWith(metricId + "/"))
      .map((ind) => ind.id.split("/")[1]);
  }
  const varList = "[" + vars.join(", ") + "]";
  const lines = [
    "# Default: skip_and_renormalize (equal weights, ignore nulls/NaN)",
    `available = [v for v in ${varList} if v is not None and v == v]`,
    "return sum(available) / len(available) if len(available) > 0 else None",
  ];
  return lines.join("\n");
}

// ── Metric list ───────────────────────────────────────────────────────────────

function _renderMetricList() {
  const ul = document.getElementById("metric-list");
  if (!ul) return;

  const indicators = _allData.indicators;
  const s = state.get();
  ul.innerHTML = "";

  // Build reverse mapping: indicatorSlug -> [fundamentalEntry, ...]
  const indicatorComponents = {};
  for (const fund of indicators.filter(i => i.type === "fundamental")) {
    for (const usedBySlug of (fund.used_by || [])) {
      if (!indicatorComponents[usedBySlug]) indicatorComponents[usedBySlug] = [];
      indicatorComponents[usedBySlug].push(fund);
    }
  }

  // Group definitions: name -> filter function
  const groupDefs = [
    { id: "overall",       label: "Overall",       filter: (ind) => ind.type === "composite" },
    { id: "political",     label: "Political",     filter: (ind) => ind.id === "political" || ind.id.startsWith("political/") },
    { id: "economic",      label: "Economic",      filter: (ind) => ind.id === "economic" || ind.id.startsWith("economic/") },
    { id: "international", label: "International", filter: (ind) => ind.id === "international" || ind.id.startsWith("international/") },
    { id: "transparency",  label: "Transparency",  filter: (ind) => ind.id === "transparency" || ind.id.startsWith("transparency/") },
    { id: "population_mobility", label: "Population Mobility",
      filter: (ind) => ind.id === "population_mobility" || ind.id.startsWith("population_mobility/") },
    { id: "social", label: "Social & Human Dev.",
      filter: (ind) => ind.id === "social" || ind.id.startsWith("social/") },
  ];

  for (const grp of groupDefs) {
    const groupInds = indicators.filter(grp.filter);
    if (groupInds.length === 0) continue;

    const groupDiv = document.createElement("div");
    groupDiv.className = "metric-group" + (_collapsedMetricGroups.has(grp.id) ? " collapsed" : "");
    groupDiv.dataset.group = grp.id;

    const headerDiv = document.createElement("div");
    headerDiv.className = "metric-group-header";
    headerDiv.dataset.group = grp.id;
    headerDiv.innerHTML = `<span class="metric-group-chevron">▾</span><span class="metric-group-name">${grp.label}</span>`;

    const bodyDiv = document.createElement("div");
    bodyDiv.className = "metric-group-body";

    for (const ind of groupInds) {
      const checked = s.metrics.includes(ind.id);
      const dashIdx = checked ? s.metrics.indexOf(ind.id) : -1;
      const dash = dashIdx >= 0 ? METRIC_DASH[dashIdx % METRIC_DASH.length] : "solid";

      const li = document.createElement("li");
      li.className = `metric-item metric-type-${ind.type}`;
      li.dataset.id = ind.id;

      if (ind.type === "indicator") {
        const hasRaw = ind.unit && ind.unit !== "qualitative_scale";
        const indSlug = ind.id.split("/")[1];
        const comps = indicatorComponents[indSlug] || [];
        const hasFold = hasRaw || comps.length > 0;
        const foldOpen = hasFold && _expandedFolds.has(ind.id);
        const foldBtnLabel = foldOpen ? "data ▾" : "data ▸";

        const compRowsHtml = comps.length > 0 ? `
          <div class="metric-fold-section-label">Input series:</div>
          ${comps.map(comp => `
          <label class="metric-fold-row metric-fold-component">
            <input type="checkbox" class="metric-check" data-id="${comp.id}" ${s.metrics.includes(comp.id) ? "checked" : ""}>
            <span class="metric-fold-comp-label">${comp.label}</span>
            ${comp.unit ? `<span class="metric-unit-tag">${comp.unit.replace(/_/g, " ")}</span>` : ""}
          </label>`).join("")}` : "";

        li.innerHTML = `
          <input type="checkbox" class="metric-check" data-id="${ind.id}" ${checked ? "checked" : ""}>
          <span class="metric-dash-indicator">${_dashSvg(dash, checked)}</span>
          <span class="metric-label">${ind.label}</span>
          ${hasFold ? `<button class="metric-fold-toggle" data-fold="${ind.id}" title="Show raw/input data">${foldBtnLabel}</button>` : ""}
          <a href="methodology.html#${_methodologyAnchor(ind)}" target="_blank" rel="noopener" class="info-link" title="View in methodology">ℹ</a>
          ${hasFold ? `
          <div class="metric-fold-body" data-fold-id="${ind.id}" ${foldOpen ? "" : "hidden"}>
            ${hasRaw ? `<label class="metric-fold-row">
              <input type="checkbox" class="metric-fold-radio" data-metric="${ind.id}">
              <span>Show raw on right y-axis</span>
            </label>` : ""}
            ${compRowsHtml}
          </div>` : ""}
        `;

        if (hasFold) {
          const foldToggle = li.querySelector(".metric-fold-toggle");
          const foldBody = li.querySelector(".metric-fold-body");
          foldToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            if (foldBody.hidden) {
              foldBody.hidden = false;
              foldToggle.textContent = "data ▾";
              _expandedFolds.add(ind.id);
            } else {
              foldBody.hidden = true;
              foldToggle.textContent = "data ▸";
              _expandedFolds.delete(ind.id);
            }
          });

          if (hasRaw) {
            const radio = li.querySelector(".metric-fold-radio");
            radio.checked = s.rawAxes?.includes(ind.id) ?? false;
            radio.addEventListener("change", () => {
              state.toggleRawAxis(ind.id);
            });
          }

          // Wire component metric checkboxes
          li.querySelectorAll(".metric-fold-component .metric-check").forEach((cb) => {
            cb.addEventListener("change", () => state.toggleMetric(cb.dataset.id));
          });
        }
      } else {
        // Composite or dimension — show formula fold toggle
        const fmlaOpen = _expandedDimFormulas.has(ind.id);
        const hasCustomFormula = !!s.dimensionFormulas?.[ind.id];
        const fmlaBtnLabel = fmlaOpen ? "▾" : (hasCustomFormula ? "ƒ✎" : "ƒ");
        li.innerHTML = `
          <input type="checkbox" class="metric-check" data-id="${ind.id}" ${checked ? "checked" : ""}>
          <span class="metric-dash-indicator">${_dashSvg(dash, checked)}</span>
          <span class="metric-label">${ind.label}</span>
          <button class="metric-formula-toggle${hasCustomFormula ? " has-custom" : ""}" data-fmla="${ind.id}" title="Edit aggregation formula">${fmlaBtnLabel}</button>
          <a href="methodology.html#${_methodologyAnchor(ind)}" target="_blank" rel="noopener" class="info-link" title="View in methodology">ℹ</a>
          <div class="metric-formula-panel" data-fmla-id="${ind.id}" ${fmlaOpen ? "" : "hidden"}>
            <textarea class="metric-formula-input" spellcheck="false" rows="4" data-fmla-metric="${ind.id}"></textarea>
            <div class="metric-formula-actions">
              <button class="metric-formula-apply" data-fmla-metric="${ind.id}">Apply</button>
              <button class="metric-formula-reset" data-fmla-metric="${ind.id}">Reset</button>
            </div>
          </div>
        `;

        const fmlaToggle = li.querySelector(".metric-formula-toggle");
        const fmlaPanel = li.querySelector(".metric-formula-panel");
        const fmlaTextarea = li.querySelector(".metric-formula-input");

        // Pre-fill with custom formula or default
        fmlaTextarea.value = s.dimensionFormulas?.[ind.id] ?? _defaultDimFormula(ind.id, indicators);

        fmlaToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          if (fmlaPanel.hidden) {
            fmlaPanel.hidden = false;
            fmlaToggle.textContent = "▾";
            _expandedDimFormulas.add(ind.id);
          } else {
            fmlaPanel.hidden = true;
            const custom = !!state.get().dimensionFormulas?.[ind.id];
            fmlaToggle.textContent = custom ? "ƒ✎" : "ƒ";
            fmlaToggle.classList.toggle("has-custom", custom);
            _expandedDimFormulas.delete(ind.id);
          }
        });

        li.querySelector(".metric-formula-apply").addEventListener("click", (e) => {
          e.stopPropagation();
          const formula = fmlaTextarea.value.trim();
          state.setDimensionFormula(ind.id, formula || null);
          const hasF = !!formula;
          fmlaToggle.classList.toggle("has-custom", hasF);
          fmlaToggle.textContent = "▾"; // panel stays open
        });

        li.querySelector(".metric-formula-reset").addEventListener("click", (e) => {
          e.stopPropagation();
          state.setDimensionFormula(ind.id, null);
          fmlaTextarea.value = _defaultDimFormula(ind.id, indicators);
          fmlaToggle.classList.remove("has-custom");
          fmlaToggle.textContent = fmlaPanel.hidden ? "ƒ" : "▾";
        });
      }

      li.querySelector(".metric-check").addEventListener("change", () => state.toggleMetric(ind.id));
      bodyDiv.appendChild(li);
    }

    headerDiv.addEventListener("click", () => {
      if (_collapsedMetricGroups.has(grp.id)) {
        _collapsedMetricGroups.delete(grp.id);
        groupDiv.classList.remove("collapsed");
      } else {
        _collapsedMetricGroups.add(grp.id);
        groupDiv.classList.add("collapsed");
      }
    });

    groupDiv.appendChild(headerDiv);
    groupDiv.appendChild(bodyDiv);
    ul.appendChild(groupDiv);
  }

  // -- Fundamental Metrics group ---------------------------------------------
  const fundamentalGroup = document.createElement("div");
  fundamentalGroup.className = "metric-group" + (_collapsedMetricGroups.has("fundamental") ? " collapsed" : "");
  fundamentalGroup.dataset.group = "fundamental";

  const fundHeader = document.createElement("div");
  fundHeader.className = "metric-group-header";
  fundHeader.dataset.group = "fundamental";
  fundHeader.innerHTML = `<span class="metric-group-chevron">▾</span><span class="metric-group-name">Fundamental Metrics</span>`;

  const fundBody = document.createElement("div");
  fundBody.className = "metric-group-body";

  // Get all fundamental entries from indicators
  const fundamentalEntries = indicators.filter((ind) => ind.type === "fundamental");
  const fundamentalCategories = indicators.filter((ind) => ind.type === "fundamental_category");

  // Group fundamental entries by category
  const fundByCategory = {};
  for (const ind of fundamentalEntries) {
    const cat = ind.category || "other";
    if (!fundByCategory[cat]) fundByCategory[cat] = [];
    fundByCategory[cat].push(ind);
  }

  for (const catEntry of fundamentalCategories) {
    const catId = catEntry.category;
    const catInds = fundByCategory[catId] || [];
    if (catInds.length === 0) continue;

    const catDiv = document.createElement("div");
    catDiv.className = "metric-subgroup" + (_collapsedMetricGroups.has(`fundamental/${catId}`) ? " collapsed" : "");

    const catHeader = document.createElement("div");
    catHeader.className = "metric-subgroup-header";
    catHeader.dataset.group = `fundamental/${catId}`;
    catHeader.innerHTML = `<span class="metric-group-chevron">▾</span><span class="metric-subgroup-name">${catEntry.label}</span>`;

    catHeader.addEventListener("click", () => {
      const gid = `fundamental/${catId}`;
      if (_collapsedMetricGroups.has(gid)) {
        _collapsedMetricGroups.delete(gid);
        catDiv.classList.remove("collapsed");
      } else {
        _collapsedMetricGroups.add(gid);
        catDiv.classList.add("collapsed");
      }
    });

    const catBody = document.createElement("div");
    catBody.className = "metric-subgroup-body";

    for (const ind of catInds) {
      const checked = s.metrics.includes(ind.id);
      const dashIdx = checked ? s.metrics.indexOf(ind.id) : -1;
      const dash = dashIdx >= 0 ? METRIC_DASH[dashIdx % METRIC_DASH.length] : "solid";

      const li = document.createElement("li");
      li.className = "metric-item metric-type-fundamental";
      li.dataset.id = ind.id;

      li.innerHTML = `
        <input type="checkbox" class="metric-check" data-id="${ind.id}" ${checked ? "checked" : ""}>
        <span class="metric-dash-indicator">${_dashSvg(dash, checked)}</span>
        <span class="metric-label">${ind.label}</span>
        <span class="metric-unit-tag" title="${ind.unit || ''}">${(ind.unit || '').replace(/_/g, ' ')}</span>
      `;

      li.querySelector(".metric-check").addEventListener("change", () => state.toggleMetric(ind.id));
      catBody.appendChild(li);
    }

    catDiv.appendChild(catHeader);
    catDiv.appendChild(catBody);
    fundBody.appendChild(catDiv);
  }

  fundHeader.addEventListener("click", () => {
    if (_collapsedMetricGroups.has("fundamental")) {
      _collapsedMetricGroups.delete("fundamental");
      fundamentalGroup.classList.remove("collapsed");
    } else {
      _collapsedMetricGroups.add("fundamental");
      fundamentalGroup.classList.add("collapsed");
    }
  });

  if (fundamentalEntries.length > 0) {
    fundamentalGroup.appendChild(fundHeader);
    fundamentalGroup.appendChild(fundBody);
    ul.appendChild(fundamentalGroup);
  }

  // Custom group placeholder (populated by _syncCustomMetricCheckboxes)
  const customGroupDiv = document.createElement("div");
  customGroupDiv.id = "metric-group-custom";
  customGroupDiv.className = "metric-group";
  ul.appendChild(customGroupDiv);

  state.subscribe((s) => {
    // Update checkboxes and dash indicators for all built-in metrics
    ul.querySelectorAll(".metric-check[data-id]").forEach((cb) => {
      const id = cb.dataset.id;
      const checked = s.metrics.includes(id);
      cb.checked = checked;
      // Skip dash update for component checkboxes inside fold bodies
      if (!cb.closest(".metric-fold-body")) {
        const dashIdx = checked ? s.metrics.indexOf(id) : -1;
        const dash = dashIdx >= 0 ? METRIC_DASH[dashIdx % METRIC_DASH.length] : "solid";
        const indicator = cb.closest(".metric-item")?.querySelector(".metric-dash-indicator");
        if (indicator) indicator.innerHTML = _dashSvg(dash, checked);
      }
    });
    // Sync raw axis checkbox states
    ul.querySelectorAll(".metric-fold-radio[data-metric]").forEach((radio) => {
      radio.checked = s.rawAxes?.includes(radio.dataset.metric) ?? false;
    });
    _syncCustomMetricCheckboxes(s);
  });
}

function _syncCustomMetricCheckboxes(s) {
  const ul = document.getElementById("metric-list");
  if (!ul) return;

  // Find or create the custom group container
  let customGroup = document.getElementById("metric-group-custom");
  if (!customGroup) {
    customGroup = document.createElement("div");
    customGroup.id = "metric-group-custom";
    customGroup.className = "metric-group";
    ul.appendChild(customGroup);
  }

  // Remove items no longer in state
  customGroup.querySelectorAll("[data-custom]").forEach((li) => {
    if (!s.custom.find((c) => c.id === li.dataset.id)) li.remove();
  });

  // Add/show header only when there are custom metrics
  let header = customGroup.querySelector(".metric-group-header");
  let body = customGroup.querySelector(".metric-group-body");

  if (s.custom.length === 0) {
    customGroup.innerHTML = "";
    return;
  }

  if (!header) {
    header = document.createElement("div");
    header.className = "metric-group-header";
    header.dataset.group = "custom";
    header.innerHTML = `<span class="metric-group-chevron">▾</span><span class="metric-group-name">Custom</span>`;
    header.addEventListener("click", () => {
      if (_collapsedMetricGroups.has("custom")) {
        _collapsedMetricGroups.delete("custom");
        customGroup.classList.remove("collapsed");
      } else {
        _collapsedMetricGroups.add("custom");
        customGroup.classList.add("collapsed");
      }
    });
    customGroup.appendChild(header);
  }

  if (!body) {
    body = document.createElement("div");
    body.className = "metric-group-body";
    customGroup.appendChild(body);
  }

  for (const custom of s.custom) {
    if (body.querySelector(`[data-id="${custom.id}"]`)) continue;

    const li = document.createElement("li");
    li.className = "metric-item metric-type-custom";
    li.dataset.id = custom.id;
    li.dataset.custom = "1";

    const checked = s.metrics.includes(custom.id);
    const dashIdx = checked ? s.metrics.indexOf(custom.id) : -1;
    const dash = dashIdx >= 0 ? METRIC_DASH[dashIdx % METRIC_DASH.length] : "solid";

    li.innerHTML = `
      <input type="checkbox" class="metric-check" data-id="${custom.id}" ${checked ? "checked" : ""}>
      <span class="metric-dash-indicator">${_dashSvg(dash, checked)}</span>
      <span class="metric-label">${custom.name} <span class="metric-custom-tag">custom</span></span>
    `;
    body.appendChild(li);

    li.querySelector(".metric-check").addEventListener("change", () => {
      state.toggleMetric(custom.id);
    });
  }
}

// ── Custom metric panel ───────────────────────────────────────────────────────

function _renderCustomPanel() {
  const panel = document.getElementById("custom-metric-panel");
  if (!panel) return;

  // Populate available variables list
  const varsList = document.getElementById("custom-vars-list");
  if (varsList) {
    const vars = _buildVarNames();
    const scoreVars = vars.filter((v) => !v.startsWith("raw_"));
    const rawVars = vars.filter((v) => v.startsWith("raw_"));
    varsList.innerHTML =
      scoreVars.map((v) => `<code class="var-chip">${v}</code>`).join(" ") +
      (rawVars.length > 0
        ? `<div style="flex:0 0 100%;font-size:10px;color:var(--text-muted);margin-top:4px">Raw values:</div>` +
          rawVars.map((v) => `<code class="var-chip" style="opacity:0.75">${v}</code>`).join(" ")
        : "");
  }

  // Name → slug auto-generation
  const nameInput = document.getElementById("custom-name");
  const slugInput = document.getElementById("custom-slug");
  let slugEdited = false;
  if (nameInput && slugInput) {
    slugInput.addEventListener("input", () => { slugEdited = true; });
    nameInput.addEventListener("input", () => {
      if (!slugEdited) slugInput.value = _toSlug(nameInput.value);
    });
  }

  // Live formula syntax check
  const formulaInput = document.getElementById("custom-formula");
  const errorDiv = document.getElementById("custom-formula-error");
  if (formulaInput && errorDiv) {
    formulaInput.addEventListener("input", () => _validateFormula(formulaInput.value, errorDiv));
  }

  // Buttons
  document.getElementById("btn-save-custom")?.addEventListener("click", () => _doSave(false));
  document.getElementById("btn-library-custom")?.addEventListener("click", () => _doSave(true));
  document.getElementById("btn-close-panel")?.addEventListener("click", () => panel.classList.remove("open"));
  document.getElementById("btn-custom-metric")?.addEventListener("click", () => panel.classList.add("open"));

  state.subscribe((s) => {
    _renderSavedList(s);
    _syncCustomMetricCheckboxes(s);
  });
  _renderSavedList(state.get());
  _renderLibraryList();
}

function _validateFormula(formula, errorDiv) {
  if (!formula.trim()) { errorDiv.textContent = ""; return true; }
  try {
    let code = _translateFormula(formula);
    new Function('"use strict";\n' + code); // syntax check only
    errorDiv.textContent = "";
    return true;
  } catch (e) {
    errorDiv.textContent = "⚠ " + e.message;
    return false;
  }
}

function _translateFormula(formula) {
  return pythonToJS(formula);
}

function _doSave(addToLibrary) {
  const name = document.getElementById("custom-name")?.value.trim();
  const slugRaw = document.getElementById("custom-slug")?.value.trim();
  const formula = document.getElementById("custom-formula")?.value.trim();
  const errorDiv = document.getElementById("custom-formula-error");

  if (!name) { alert("Enter a metric name."); return; }
  if (!formula) { alert("Enter a formula."); return; }
  if (errorDiv && !_validateFormula(formula, errorDiv)) return;

  const slug = slugRaw || _toSlug(name);
  _customIdCounter++;
  const metric = { id: `c_${_customIdCounter}`, name, slug, formula };
  state.addCustomMetric(metric);

  if (addToLibrary) {
    _saveToLibrary({ name, slug, formula });
    _renderLibraryList();
  }

  // Reset form
  const nameInput = document.getElementById("custom-name");
  const slugInput = document.getElementById("custom-slug");
  const formulaInput = document.getElementById("custom-formula");
  if (nameInput) nameInput.value = "";
  if (slugInput) { slugInput.value = ""; slugEdited_reset(); }
  if (formulaInput) formulaInput.value = "";
  if (errorDiv) errorDiv.textContent = "";
}

// tiny helper to reset slugEdited flag after save
let _slugEdited = false;
function slugEdited_reset() { _slugEdited = false; }

function _renderSavedList(s) {
  const list = document.getElementById("custom-saved-list");
  if (!list) return;
  list.innerHTML = "";

  if (s.custom.length === 0) {
    list.innerHTML = '<p class="custom-empty-msg">None yet.</p>';
    return;
  }

  for (const custom of s.custom) {
    const item = document.createElement("div");
    item.className = "custom-saved-item";
    item.innerHTML = `
      <span class="custom-saved-name">${custom.name}${custom.slug ? ` <code class="var-chip">${custom.slug}</code>` : ""}</span>
      <button class="btn-remove-custom" data-id="${custom.id}" title="Remove">×</button>
    `;
    list.appendChild(item);
    item.querySelector(".btn-remove-custom").addEventListener("click", () => {
      state.removeCustomMetric(custom.id);
    });
  }
}

function _renderLibraryList() {
  const list = document.getElementById("custom-library-list");
  if (!list) return;
  const lib = _loadLibrary();

  list.innerHTML = "";

  if (lib.length === 0) {
    list.innerHTML = '<p class="custom-empty-msg">No saved metrics.</p>';
    return;
  }

  for (const metric of lib) {
    const item = document.createElement("div");
    item.className = "custom-saved-item";
    item.innerHTML = `
      <span class="custom-saved-name">${metric.name}${metric.slug ? ` <code class="var-chip">${metric.slug}</code>` : ""}</span>
      <div class="custom-item-btns">
        <button class="btn-load-library" title="Load to session">↓ use</button>
        <button class="btn-remove-custom" title="Remove from library">×</button>
      </div>
    `;
    list.appendChild(item);

    item.querySelector(".btn-load-library").addEventListener("click", () => {
      _customIdCounter++;
      state.addCustomMetric({ id: `c_${_customIdCounter}`, name: metric.name, slug: metric.slug, formula: metric.formula });
    });

    item.querySelector(".btn-remove-custom").addEventListener("click", () => {
      _removeFromLibrary(metric.slug);
      _renderLibraryList();
    });
  }
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function _wireToolbar() {
  document.querySelectorAll("input[name=chart-mode]").forEach((radio) => {
    radio.addEventListener("change", () => state.update({ chartMode: radio.value }));
  });

  document.querySelectorAll("input[name=x-mode]").forEach((radio) => {
    radio.addEventListener("change", () => state.update({ xMode: radio.value }));
  });

  const search = document.getElementById("country-search");
  if (search) search.addEventListener("input", () => _renderCountryList(state.get()));

  // Year range inputs
  document.getElementById("range-min")?.addEventListener("change", (e) => {
    const min = parseInt(e.target.value, 10);
    const max = state.get().range[1];
    if (!isNaN(min) && min < max) state.update({ range: [min, max] });
    else e.target.value = state.get().range[0];
  });
  document.getElementById("range-max")?.addEventListener("change", (e) => {
    const max = parseInt(e.target.value, 10);
    const min = state.get().range[0];
    if (!isNaN(max) && max > min) state.update({ range: [min, max] });
    else e.target.value = state.get().range[1];
  });

  // Overlay checkboxes
  document.getElementById("cb-overlay-bands")
    ?.addEventListener("change", (e) => state.update({ overlayBands: e.target.checked }));
  document.getElementById("cb-overlay-volatility")
    ?.addEventListener("change", (e) => state.update({ overlayVolatility: e.target.checked }));
  document.getElementById("cb-overlay-trend")
    ?.addEventListener("change", (e) => state.update({ overlayTrend: e.target.checked }));
  document.getElementById("cb-overlay-source-markers")
    ?.addEventListener("change", (e) => state.update({ overlaySourceMarkers: e.target.checked }));
  document.getElementById("cb-tooltip-detail")
    ?.addEventListener("change", (e) => state.update({ tooltipDetail: e.target.checked }));
  document.getElementById("cb-sync-raw-axes")
    ?.addEventListener("change", (e) => state.update({ syncRawAxes: e.target.checked }));

  // Overlay sub-option radios
  document.querySelectorAll("input[name=bands-method]").forEach((radio) => {
    radio.addEventListener("change", () => state.update({ overlayBandsMethod: radio.value }));
  });
  document.querySelectorAll("input[name=volatility-window]").forEach((radio) => {
    radio.addEventListener("change", () => state.update({ overlayVolatilityWindow: parseInt(radio.value, 10) }));
  });
  document.querySelectorAll("input[name=trend-method]").forEach((radio) => {
    radio.addEventListener("change", () => state.update({ overlayTrendMethod: radio.value }));
  });
}

function _updateToolbarFromState(s) {
  document.querySelectorAll("input[name=chart-mode]").forEach((radio) => {
    radio.checked = radio.value === s.chartMode;
  });
  document.querySelectorAll("input[name=x-mode]").forEach((radio) => {
    radio.checked = radio.value === s.xMode;
  });

  // Year range
  const rangeMin = document.getElementById("range-min");
  if (rangeMin) rangeMin.value = s.range?.[0] ?? 1990;
  const rangeMax = document.getElementById("range-max");
  if (rangeMax) rangeMax.value = s.range?.[1] ?? 2026;

  // Overlay checkboxes
  const cbBands = document.getElementById("cb-overlay-bands");
  if (cbBands) cbBands.checked = !!s.overlayBands;
  const cbVol = document.getElementById("cb-overlay-volatility");
  if (cbVol) cbVol.checked = !!s.overlayVolatility;
  const cbTrend = document.getElementById("cb-overlay-trend");
  if (cbTrend) cbTrend.checked = !!s.overlayTrend;
  const cbSrc = document.getElementById("cb-overlay-source-markers");
  if (cbSrc) cbSrc.checked = !!s.overlaySourceMarkers;
  const cbDetail = document.getElementById("cb-tooltip-detail");
  if (cbDetail) cbDetail.checked = !!s.tooltipDetail;
  const cbSync = document.getElementById("cb-sync-raw-axes");
  if (cbSync) cbSync.checked = !!s.syncRawAxes;
  // Show stacked-only options only in stacked mode
  const stackedOpts = document.getElementById("stacked-options");
  if (stackedOpts) stackedOpts.classList.toggle("visible", s.chartMode === "stacked");

  // Sub-row visibility
  document.getElementById("sub-bands")?.classList.toggle("visible", !!s.overlayBands);
  document.getElementById("sub-volatility")?.classList.toggle("visible", !!s.overlayVolatility);
  document.getElementById("sub-trend")?.classList.toggle("visible", !!s.overlayTrend);

  // Sync radio states
  document.querySelectorAll("input[name=bands-method]").forEach((radio) => {
    radio.checked = radio.value === (s.overlayBandsMethod ?? "quality");
  });
  document.querySelectorAll("input[name=volatility-window]").forEach((radio) => {
    radio.checked = radio.value === String(s.overlayVolatilityWindow ?? 3);
  });
  document.querySelectorAll("input[name=trend-method]").forEach((radio) => {
    radio.checked = radio.value === (s.overlayTrendMethod ?? "slope");
  });
}

// ── Sidebar collapsible sections ──────────────────────────────────────────────

function _wireSidebarCollapse() {
  document.querySelectorAll(".sidebar-toggle").forEach((title) => {
    title.addEventListener("click", () => {
      title.closest(".sidebar-section").classList.toggle("collapsed");
    });
  });
}

// ── Share button ──────────────────────────────────────────────────────────────

function _wireShareButton() {
  const btn = document.getElementById("btn-share");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch {
      prompt("Copy this URL:", window.location.href);
    }
  });
}

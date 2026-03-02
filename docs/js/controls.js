/**
 * controls.js — Renders all UI controls and wires user interactions to state
 *
 * Depends on: state.js, data.js (allData passed in), SortableJS global
 */

import { state } from "./state.js";

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

function _methodologyAnchor(ind) {
  if (ind.id === "composite") return "aggregation";
  if (ind.type === "dimension") return `dim-${ind.id}`;
  return `ind-${ind.id.replace("/", "-")}`;
}

function _buildVarNames() {
  const vars = ["composite", "political", "economic", "international", "transparency"];
  for (const ind of _allData.indicators) {
    if (ind.type === "indicator") {
      const slug = ind.id.split("/")[1];
      if (slug) vars.push(slug);
    }
  }
  return vars;
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

  const orderedSelected = s.countryOrder.filter((id) => allIds.includes(id));
  const unselected = allIds
    .filter((id) => !selectedSet.has(id))
    .sort((a, b) =>
      (countriesMeta[a]?.display_name ?? a).localeCompare(
        countriesMeta[b]?.display_name ?? b
      )
    );

  const displayList = [...orderedSelected, ...unselected];

  const filtered = displayList.filter((id) => {
    if (!search) return true;
    const name = (countriesMeta[id]?.display_name ?? id).toLowerCase();
    return name.includes(search);
  });

  ul.innerHTML = "";

  for (const id of filtered) {
    const meta = countriesMeta[id];
    const displayName = meta?.display_name ?? id;
    const rcYears = meta?.regime_change_years ?? [];
    const isSelected = selectedSet.has(id);

    const li = document.createElement("li");
    li.className = "country-item";
    li.dataset.id = id;

    li.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <input type="checkbox" class="country-check" ${isSelected ? "checked" : ""} data-id="${id}">
      <span class="country-label">
        ${displayName}
        ${rcYears.length > 0 ? `<small class="country-regime-years">${rcYears.join(", ")}</small>` : ""}
      </span>
      <a href="countries.html?country=${id}" target="_blank" rel="noopener" class="info-link country-info-link" title="View country page">↗</a>
    `;

    ul.appendChild(li);

    if (isSelected && s.xMode === "aligned" && rcYears.length > 1) {
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

    if (isSelected && s.xMode === "pivot") {
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

  _renderGroupButtons(s);
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

// ── Metric list ───────────────────────────────────────────────────────────────

function _renderMetricList() {
  const ul = document.getElementById("metric-list");
  if (!ul) return;

  const indicators = _allData.indicators;
  ul.innerHTML = "";

  for (const ind of indicators) {
    const li = document.createElement("li");
    li.className = `metric-item metric-type-${ind.type}`;
    li.dataset.id = ind.id;

    const s = state.get();
    const checked = s.metrics.includes(ind.id);

    li.innerHTML = `
      <input type="checkbox" class="metric-check" data-id="${ind.id}" ${checked ? "checked" : ""}>
      <span class="metric-label">${ind.label}</span>
      <a href="methodology.html#${_methodologyAnchor(ind)}" target="_blank" rel="noopener" class="info-link" title="View in methodology">ℹ</a>
    `;
    ul.appendChild(li);
  }

  ul.querySelectorAll(".metric-check").forEach((cb) => {
    cb.addEventListener("change", () => state.toggleMetric(cb.dataset.id));
  });

  state.subscribe((s) => {
    ul.querySelectorAll(".metric-check").forEach((cb) => {
      cb.checked = s.metrics.includes(cb.dataset.id);
    });
    _syncCustomMetricCheckboxes(s);
  });
}

function _syncCustomMetricCheckboxes(s) {
  const ul = document.getElementById("metric-list");
  if (!ul) return;

  ul.querySelectorAll("[data-custom]").forEach((li) => {
    if (!s.custom.find((c) => c.id === li.dataset.id)) li.remove();
  });

  for (const custom of s.custom) {
    if (ul.querySelector(`[data-id="${custom.id}"]`)) continue;

    const li = document.createElement("li");
    li.className = "metric-item metric-type-custom";
    li.dataset.id = custom.id;
    li.dataset.custom = "1";

    li.innerHTML = `
      <input type="checkbox" class="metric-check" data-id="${custom.id}" checked>
      <span class="metric-label">${custom.name} <span class="metric-custom-tag">custom</span></span>
    `;
    ul.appendChild(li);

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
    varsList.innerHTML = vars.map((v) => `<code class="var-chip">${v}</code>`).join(" ");
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
  // Python → JS compatibility layer
  let code = formula
    .replace(/\bmath\.(\w+)/g, "Math.$1")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");

  // Strip # comments
  const lines = code.split("\n").map((l) => l.replace(/#.*$/, ""));

  // Auto-add return to last non-empty line if no explicit return
  if (!lines.some((l) => /^\s*return\s/.test(l))) {
    const lastIdx = [...lines.keys()].reverse().find((i) => lines[i].trim());
    if (lastIdx !== undefined) lines[lastIdx] = "return (" + lines[lastIdx].trim() + ")";
  }

  return lines.join("\n");
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
}

function _updateToolbarFromState(s) {
  document.querySelectorAll("input[name=chart-mode]").forEach((radio) => {
    radio.checked = radio.value === s.chartMode;
  });
  document.querySelectorAll("input[name=x-mode]").forEach((radio) => {
    radio.checked = radio.value === s.xMode;
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

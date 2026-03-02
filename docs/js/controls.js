/**
 * controls.js — Renders all UI controls and wires user interactions to state
 *
 * Depends on: state.js, data.js (allData passed in), SortableJS global
 */

import { state } from "./state.js";

let _allData = null; // set by init()
let _sortable = null;

// ── Init ────────────────────────────────────────────────────────────────────────

export function init(allData) {
  _allData = allData;
  _renderMetricList();
  _renderCustomPanel();
  _wireToolbar();
  _wireShareButton();
  _wireSidebarCollapse();

  // Re-render country list whenever state changes
  state.subscribe((s) => {
    _renderCountryList(s);
    _updateToolbarFromState(s);
  });

  // Initial render
  _renderCountryList(state.get());
  _updateToolbarFromState(state.get());
}

// ── Country list ────────────────────────────────────────────────────────────────

function _renderCountryList(s) {
  const ul = document.getElementById("country-list");
  if (!ul) return;

  const { countries: countriesMeta } = _allData;
  const search = document.getElementById("country-search")?.value.toLowerCase() ?? "";

  // Build ordered list: selected countries first (in countryOrder), then unselected alphabetically
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
    `;

    ul.appendChild(li);

    // Align-year picker (only shown in aligned mode for selected countries with >1 RC year)
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

    // Pivot row (only shown in pivot mode for selected countries)
    if (isSelected && s.xMode === "pivot") {
      const pivotRow = document.createElement("div");
      pivotRow.className = "country-sub-row country-pivot-row visible";
      pivotRow.dataset.for = id;

      const years = meta?.years ?? [];
      const minYear = years[0] ?? 1990;
      const maxYear = years[years.length - 1] ?? 2026;
      const currentPivot = s.pivots[id] ?? rcYears[0] ?? Math.round((minYear + maxYear) / 2);

      pivotRow.innerHTML = `
        <label>
          pivot:
          <input type="range" min="${minYear}" max="${maxYear}" value="${currentPivot}" data-country="${id}" class="pivot-slider">
          <span class="country-pivot-year">${currentPivot}</span>
        </label>
      `;

      ul.appendChild(pivotRow);
    }
  }

  // Checkbox handlers
  ul.querySelectorAll(".country-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      state.toggleCountry(cb.dataset.id);
    });
  });

  // Pivot slider handlers
  ul.querySelectorAll(".pivot-slider").forEach((slider) => {
    const countryId = slider.dataset.country;
    const label = slider.parentElement.querySelector(".country-pivot-year");
    let raf = null;
    slider.addEventListener("input", () => {
      const year = parseInt(slider.value, 10);
      if (label) label.textContent = year;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        state.setPivot(countryId, year);
        raf = null;
      });
    });
  });

  // Align-year button handlers
  ul.querySelectorAll(".btn-align-year").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.setAlignYear(btn.dataset.country, parseInt(btn.dataset.year, 10));
    });
  });

  // Sortable drag-to-reorder
  if (_sortable) {
    _sortable.destroy();
    _sortable = null;
  }
  if (window.Sortable) {
    _sortable = new Sortable(ul, {
      handle: ".drag-handle",
      animation: 120,
      ghostClass: "sortable-ghost",
      filter: ".country-sub-row",
      onEnd: () => {
        const newOrder = [];
        ul.querySelectorAll(".country-item").forEach((li) => {
          if (li.dataset.id && s.countries.includes(li.dataset.id)) {
            newOrder.push(li.dataset.id);
          }
        });
        state.setCountryOrder(newOrder);
      },
    });
  }

  _renderGroupButtons(s);
}

// ── Group buttons ───────────────────────────────────────────────────────────────

function _renderGroupButtons(s) {
  const container = document.getElementById("group-buttons");
  if (!container) return;

  const groups = _allData.countries._groups;
  if (!groups) return;

  const buttons = [];

  // Region groups
  for (const [regionId, countryIds] of Object.entries(groups.by_region ?? {})) {
    buttons.push({ label: _regionLabel(regionId), id: `by_region:${regionId}`, ids: countryIds });
  }

  if (container.dataset.rendered) return; // only render once
  container.dataset.rendered = "1";
  container.innerHTML = "";

  for (const btn of buttons) {
    const b = document.createElement("button");
    b.className = "btn-group";
    b.textContent = btn.label;
    b.title = btn.ids.join(", ");
    b.addEventListener("click", () => {
      state.selectGroup(btn.ids);
    });
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

// ── Metric list ─────────────────────────────────────────────────────────────────

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
    `;
    ul.appendChild(li);
  }

  ul.querySelectorAll(".metric-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      state.toggleMetric(cb.dataset.id);
    });
  });

  // Re-sync checkboxes when state changes
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

  // Remove stale custom items
  ul.querySelectorAll("[data-custom]").forEach((li) => {
    if (!s.custom.find((c) => c.id === li.dataset.id)) {
      li.remove();
    }
  });

  // Add new custom items
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

    li.querySelector(".metric-check").addEventListener("change", (e) => {
      state.toggleMetric(custom.id);
    });
  }
}

// ── Custom metric panel ─────────────────────────────────────────────────────────

let _customIdCounter = 0;

function _renderCustomPanel() {
  const panel = document.getElementById("custom-metric-panel");
  if (!panel) return;

  const body = document.getElementById("custom-panel-body");
  if (!body) return;

  // Indicator rows
  const indicatorRows = document.getElementById("custom-indicator-rows");
  if (indicatorRows) {
    indicatorRows.innerHTML = "";
    for (const ind of _allData.indicators) {
      if (ind.type !== "indicator") continue;

      const row = document.createElement("div");
      row.className = "custom-indicator-row";
      row.dataset.id = ind.id;

      row.innerHTML = `
        <input type="checkbox" class="custom-indicator-check" data-id="${ind.id}">
        <span class="custom-indicator-label">
          ${ind.label}
          <small>${ind.dimension ?? ""}</small>
        </span>
        <input type="number" class="custom-weight-input" value="1.0" step="0.1" min="0" max="100" disabled data-id="${ind.id}">
      `;

      indicatorRows.appendChild(row);

      const check = row.querySelector(".custom-indicator-check");
      const weightInput = row.querySelector(".custom-weight-input");

      check.addEventListener("change", () => {
        weightInput.disabled = !check.checked;
        _updateFormulaPreview();
      });

      weightInput.addEventListener("input", _updateFormulaPreview);
    }
  }

  // Name input
  const nameInput = document.getElementById("custom-name");
  if (nameInput) nameInput.addEventListener("input", _updateFormulaPreview);

  // Save button
  const saveBtn = document.getElementById("btn-save-custom");
  if (saveBtn) {
    saveBtn.addEventListener("click", _saveCustomMetric);
  }

  // Close button
  document.getElementById("btn-close-panel")?.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // Open button
  document.getElementById("btn-custom-metric")?.addEventListener("click", () => {
    panel.classList.add("open");
  });

  // Sync saved list
  state.subscribe((s) => _renderSavedCustomList(s));
}

function _updateFormulaPreview() {
  const preview = document.getElementById("custom-formula-preview");
  if (!preview) return;

  const name = document.getElementById("custom-name")?.value || "Custom";
  const rows = document.querySelectorAll(".custom-indicator-row");
  const parts = [];

  rows.forEach((row) => {
    const check = row.querySelector(".custom-indicator-check");
    const weight = row.querySelector(".custom-weight-input");
    if (check?.checked) {
      const indId = row.dataset.id;
      const label = _allData.indicators.find((i) => i.id === indId)?.label ?? indId;
      parts.push(`${parseFloat(weight?.value ?? 1).toFixed(1)}×${label}`);
    }
  });

  if (parts.length === 0) {
    preview.textContent = "(select indicators)";
  } else {
    preview.textContent = `${name} = ${parts.join(" + ")}`;
  }
}

function _saveCustomMetric() {
  const name = document.getElementById("custom-name")?.value.trim();
  if (!name) {
    alert("Enter a name for the custom metric.");
    return;
  }

  const weights = {};
  document.querySelectorAll(".custom-indicator-row").forEach((row) => {
    const check = row.querySelector(".custom-indicator-check");
    const weight = row.querySelector(".custom-weight-input");
    if (check?.checked) {
      weights[row.dataset.id] = parseFloat(weight?.value ?? 1);
    }
  });

  if (Object.keys(weights).length === 0) {
    alert("Select at least one indicator.");
    return;
  }

  _customIdCounter++;
  const id = `c_${_customIdCounter}`;
  state.addCustomMetric({ id, name, weights });

  // Reset form
  if (document.getElementById("custom-name")) {
    document.getElementById("custom-name").value = "";
  }
  document.querySelectorAll(".custom-indicator-check").forEach((cb) => {
    cb.checked = false;
    cb.closest(".custom-indicator-row").querySelector(".custom-weight-input").disabled = true;
  });
  _updateFormulaPreview();
}

function _renderSavedCustomList(s) {
  const list = document.getElementById("custom-saved-list");
  if (!list) return;

  list.innerHTML = "";

  if (s.custom.length === 0) {
    list.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">No custom metrics saved yet.</p>`;
    return;
  }

  for (const custom of s.custom) {
    const item = document.createElement("div");
    item.className = "custom-saved-item";
    item.innerHTML = `
      <span class="custom-saved-name">${custom.name}</span>
      <button class="btn-remove-custom" data-id="${custom.id}" title="Remove">×</button>
    `;
    list.appendChild(item);

    item.querySelector(".btn-remove-custom").addEventListener("click", () => {
      state.removeCustomMetric(custom.id);
    });
  }
}

// ── Toolbar ─────────────────────────────────────────────────────────────────────

function _wireToolbar() {
  // Chart mode
  document.querySelectorAll("input[name=chart-mode]").forEach((radio) => {
    radio.addEventListener("change", () => {
      state.update({ chartMode: radio.value });
    });
  });

  // X mode
  document.querySelectorAll("input[name=x-mode]").forEach((radio) => {
    radio.addEventListener("change", () => {
      state.update({ xMode: radio.value });
    });
  });

  // Country search
  const search = document.getElementById("country-search");
  if (search) {
    search.addEventListener("input", () => {
      _renderCountryList(state.get());
    });
  }
}

function _updateToolbarFromState(s) {
  // Chart mode radios
  document.querySelectorAll("input[name=chart-mode]").forEach((radio) => {
    radio.checked = radio.value === s.chartMode;
  });
  // X mode radios
  document.querySelectorAll("input[name=x-mode]").forEach((radio) => {
    radio.checked = radio.value === s.xMode;
  });
}

// ── Sidebar collapsible sections ───────────────────────────────────────────────

function _wireSidebarCollapse() {
  document.querySelectorAll(".sidebar-toggle").forEach((title) => {
    title.addEventListener("click", () => {
      title.closest(".sidebar-section").classList.toggle("collapsed");
    });
  });
}

// ── Share button ────────────────────────────────────────────────────────────────

function _wireShareButton() {
  const btn = document.getElementById("btn-share");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = orig;
      }, 1500);
    } catch {
      prompt("Copy this URL:", window.location.href);
    }
  });
}

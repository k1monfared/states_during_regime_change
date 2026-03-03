/**
 * state.js — URL hash encode/decode + state management
 *
 * State shape:
 * {
 *   v: 1,
 *   countries: ["iraq", "syria"],          // selected country IDs
 *   countryOrder: ["iraq", "syria"],        // display order (draggable)
 *   chartMode: "overlay",                  // "overlay" | "stacked"
 *   metrics: ["composite"],                // selected metric IDs
 *   custom: [{id,name,weights}],           // custom metrics
 *   xMode: "absolute",                     // "absolute" | "aligned" | "pivot"
 *   pivots: {"iraq": 2003},                // per-country pivot year (pivot mode)
 *   alignYears: {"afghanistan": 2001},     // per-country chosen alignment year (aligned mode)
 *   range: [1990, 2026],                   // time range [min, max]
 *   overlayBands: false,                   // confidence band overlay
 *   overlayBandsMethod: "quality",         // "quality" | "variance"
 *   overlayVolatility: false,              // rolling std dev overlay
 *   overlayVolatilityWindow: 3,            // 3 | 5
 *   overlayTrend: false,                   // trend indicator overlay
 *   overlayTrendMethod: "slope",           // "slope" | "mannkendall"
 *   overlayTrendWindow: 5,                 // years used for regression
 *   overlaySourceMarkers: false,           // source-change diamond markers
 *   rawAxes: [],                           // metricId[] — right y-axis raw series (one axis per distinct unit)
 *   tooltipDetail: false,                // show confidence/assessment/raw value in tooltip (indicator metrics only)
 * }
 */

const DEFAULT_STATE = {
  v: 1,
  countries: [],
  countryOrder: [],
  chartMode: "overlay",
  metrics: ["composite"],
  custom: [],
  xMode: "absolute",
  pivots: {},
  alignYears: {},
  range: [1990, 2026],
  // Overlays (all default OFF)
  overlayBands: false,
  overlayBandsMethod: "quality",      // "quality" | "variance"
  overlayVolatility: false,
  overlayVolatilityWindow: 3,         // 3 | 5
  overlayTrend: false,
  overlayTrendMethod: "slope",        // "slope" | "mannkendall"
  overlayTrendWindow: 5,              // years used for regression
  overlaySourceMarkers: false,
  rawAxes: [],                        // metricId[] — right y-axis raw series (per-unit axes)
  tooltipDetail: false,               // show raw data detail in tooltip (indicator metrics only)
};

// ── Encode / Decode ────────────────────────────────────────────────────────────

export function encodeState(state) {
  try {
    const json = JSON.stringify(state);
    return btoa(encodeURIComponent(json));
  } catch {
    return "";
  }
}

export function decodeState(hash) {
  try {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return null;
    const json = decodeURIComponent(atob(raw));
    const parsed = JSON.parse(json);
    if (parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── State class ────────────────────────────────────────────────────────────────

class AppState {
  constructor() {
    this._state = { ...DEFAULT_STATE };
    this._listeners = [];
  }

  /** Load from URL hash or return default */
  init() {
    const fromHash = decodeState(window.location.hash);
    if (fromHash) {
      const merged = { ...DEFAULT_STATE, ...fromHash };
      // Backward compat: old state had rawAxis: {metricId, component}
      if (!merged.rawAxes?.length && merged.rawAxis) {
        merged.rawAxes = [merged.rawAxis.metricId];
      }
      delete merged.rawAxis;
      this._state = merged;
    }
    window.addEventListener("hashchange", () => {
      const fromHash = decodeState(window.location.hash);
      if (fromHash) {
        const merged = { ...DEFAULT_STATE, ...fromHash };
        if (!merged.rawAxes?.length && merged.rawAxis) {
          merged.rawAxes = [merged.rawAxis.metricId];
        }
        delete merged.rawAxis;
        this._state = merged;
        this._notify();
      }
    });
  }

  get() {
    return { ...this._state };
  }

  /** Merge patch into state, push to URL, notify listeners */
  update(patch) {
    this._state = { ...this._state, ...patch };
    const encoded = encodeState(this._state);
    history.replaceState(null, "", "#" + encoded);
    this._notify();
  }

  /** Register a callback fired on every state change */
  subscribe(fn) {
    this._listeners.push(fn);
  }

  _notify() {
    const s = this.get();
    for (const fn of this._listeners) fn(s);
  }

  // ── Convenience helpers ──────────────────────────────────────────────────────

  toggleCountry(id) {
    const s = this._state;
    const selected = new Set(s.countries);
    const order = [...s.countryOrder];
    if (selected.has(id)) {
      selected.delete(id);
      const idx = order.indexOf(id);
      if (idx >= 0) order.splice(idx, 1);
    } else {
      selected.add(id);
      if (!order.includes(id)) order.push(id);
    }
    this.update({ countries: [...selected], countryOrder: order });
  }

  toggleMetric(id) {
    const metrics = [...this._state.metrics];
    const idx = metrics.indexOf(id);
    if (idx >= 0) metrics.splice(idx, 1);
    else metrics.push(id);
    this.update({ metrics });
  }

  addCustomMetric(metric) {
    const custom = [...this._state.custom, metric];
    const metrics = [...this._state.metrics, metric.id];
    this.update({ custom, metrics });
  }

  removeCustomMetric(id) {
    const custom = this._state.custom.filter((m) => m.id !== id);
    const metrics = this._state.metrics.filter((m) => m !== id);
    this.update({ custom, metrics });
  }

  setPivot(countryId, year) {
    const pivots = { ...this._state.pivots, [countryId]: year };
    this.update({ pivots });
  }

  setAlignYear(countryId, year) {
    const alignYears = { ...this._state.alignYears, [countryId]: year };
    this.update({ alignYears });
  }

  setCountryOrder(order) {
    this.update({ countryOrder: order });
  }

  toggleRawAxis(metricId) {
    const rawAxes = [...this._state.rawAxes];
    const idx = rawAxes.indexOf(metricId);
    if (idx >= 0) rawAxes.splice(idx, 1);
    else rawAxes.push(metricId);
    this.update({ rawAxes });
  }

  selectGroup(countryIds) {
    // Replace current selection with group
    const order = [...countryIds];
    this.update({ countries: countryIds, countryOrder: order });
  }

  getDefaultPivot(countryId, countriesData) {
    const meta = countriesData[countryId];
    if (!meta) return null;
    const rcYears = meta.regime_change_years;
    if (rcYears && rcYears.length > 0) return rcYears[0];
    return null;
  }
}

export const state = new AppState();

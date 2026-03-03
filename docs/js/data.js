/**
 * data.js — Fetch/cache JSON, compute series, custom metrics
 */

// ── Cache ──────────────────────────────────────────────────────────────────────

const _cache = {
  combined: null,
  countries: null,
  indicators: null,
  definitions: null,
  raw: {},
};

// Resolve base URL relative to this file's location (works on any path prefix)
const BASE = new URL("../", import.meta.url).href;

async function fetchJSON(path) {
  const url = BASE + path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

// ── Public load API ────────────────────────────────────────────────────────────

export async function loadAll() {
  if (_cache.combined && _cache.countries && _cache.indicators) {
    return {
      combined: _cache.combined,
      countries: _cache.countries,
      indicators: _cache.indicators,
    };
  }
  const [combined, countries, indicators] = await Promise.all([
    fetchJSON("data/combined.json"),
    fetchJSON("data/countries.json"),
    fetchJSON("data/indicators.json"),
  ]);
  _cache.combined = combined;
  _cache.countries = countries;
  _cache.indicators = indicators;
  return { combined, countries, indicators };
}

export async function loadCountryRaw(countryId) {
  if (_cache.raw[countryId]) return _cache.raw[countryId];
  const data = await fetchJSON(`data/raw/${countryId}.json`);
  _cache.raw[countryId] = data;
  return data;
}

export async function loadDefinitions() {
  if (_cache.definitions) return _cache.definitions;
  const data = await fetchJSON("data/definitions.json");
  _cache.definitions = data;
  return data;
}

// ── Series computation ─────────────────────────────────────────────────────────

/**
 * getScoreForMetric(yearData, metricId, customDefs)
 *   yearData: combined[country][year]
 *   metricId: "composite" | "political" | "political/territorial_control" | "c_custom1"
 *   customDefs: array of {id, name, weights} from state.custom
 */
function getScoreForMetric(yearData, metricId, customDefs) {
  if (!yearData) return null;

  if (metricId === "composite") {
    return yearData._composite ?? null;
  }

  if (!metricId.includes("/")) {
    // dimension score
    return yearData[metricId]?._score ?? null;
  }

  // indicator score: "dimension/indicator"
  const [dim, ind] = metricId.split("/", 2);
  return yearData[dim]?.[ind] ?? null;
}

/**
 * computeCustomScore(yearData, weights)
 *   weights: { "political/territorial_control": 2.0, ... }
 * Returns weighted average of available indicators, skipping nulls.
 */
function computeCustomScore(yearData, weights) {
  if (!yearData) return null;

  let sum = 0;
  let totalWeight = 0;

  for (const [metricId, weight] of Object.entries(weights)) {
    if (weight === 0) continue;
    const val = getScoreForMetric(yearData, metricId, []);
    if (val != null) {
      sum += val * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  return sum / totalWeight;
}


// ── Formula evaluation ────────────────────────────────────────────────────────

/**
 * _buildRawYearData(rawCountryData, yearStr)
 * Returns { indicatorSlug: rawValue, ... } for one year across all dimensions.
 */
function _buildRawYearData(rawCountryData, yearStr) {
  const result = {};
  if (!rawCountryData) return result;
  for (const dimData of Object.values(rawCountryData)) {
    if (typeof dimData !== "object" || dimData === null) continue;
    for (const [ind, indData] of Object.entries(dimData)) {
      const entry = indData?.[yearStr];
      if (entry?.raw_value != null) result[ind] = entry.raw_value;
    }
  }
  return result;
}

function _buildVarMap(yearData, rawYearData = {}) {
  const vars = {};
  if (!yearData) return vars;
  vars.composite = yearData._composite != null ? yearData._composite : NaN;
  for (const [dim, dimData] of Object.entries(yearData)) {
    if (dim.startsWith("_") || typeof dimData !== "object" || dimData === null) continue;
    vars[dim] = dimData._score != null ? dimData._score : NaN;
    for (const [ind, val] of Object.entries(dimData)) {
      if (ind.startsWith("_")) continue;
      vars[ind] = val != null ? val : NaN;
    }
  }
  // raw_<slug> = actual numeric value (not 0-100 score), for formula use
  for (const [ind, val] of Object.entries(rawYearData)) {
    vars[`raw_${ind}`] = val;
  }
  return vars;
}

export function evaluateFormulaScore(yearData, formula, rawYearData = {}) {
  const vars = _buildVarMap(yearData, rawYearData);
  const names = Object.keys(vars);
  const values = names.map((k) => vars[k]);
  try {
    let code = formula
      .replace(/\bmath\.(\w+)/g, "Math.$1")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null");

    const lines = code.split("\n").map((l) => l.replace(/#.*$/, ""));

    if (!lines.some((l) => /^\s*return\s/.test(l))) {
      const lastIdx = [...lines.keys()].reverse().find((i) => lines[i].trim());
      if (lastIdx !== undefined) lines[lastIdx] = "return (" + lines[lastIdx].trim() + ")";
    }

    const fn = new Function(...names, '"use strict";\n' + lines.join("\n"));
    const result = fn(...values);
    if (typeof result === "number" && isFinite(result)) {
      return Math.max(0, Math.min(100, result));
    }
    return null;
  } catch {
    return null;
  }
}


/**
 * getSeries(countryId, metricId, state, allData)
 * Returns [{x, y, label, year}] — x may be calendar year or relative offset
 */
export function getSeries(countryId, metricId, appState, allData) {
  const { combined, countries } = allData;
  const countryData = combined[countryId];
  const countryMeta = countries[countryId];
  if (!countryData || !countryMeta) return [];

  const [rangeMin, rangeMax] = appState.range;

  // Resolve custom def if needed
  let customDef = null;
  if (metricId.startsWith("c_")) {
    customDef = appState.custom.find((c) => c.id === metricId) ?? null;
    if (!customDef) return [];
  }

  // Pivot year for x-axis offset
  const rcYears = countryMeta.regime_change_years ?? [];
  let pivotYear = null;
  if (appState.xMode === "aligned") {
    pivotYear = appState.alignYears?.[countryId] ?? rcYears[0] ?? null;
  } else if (appState.xMode === "pivot") {
    pivotYear = appState.pivots[countryId] ?? rcYears[0] ?? null;
  }

  const rawCountryData = _cache.raw[countryId] ?? null;
  const points = [];

  for (const [yearStr, yearData] of Object.entries(countryData)) {
    const year = parseInt(yearStr, 10);
    if (year < rangeMin || year > rangeMax) continue;

    let score;
    if (customDef) {
      if (customDef.formula) {
        const rawYearData = _buildRawYearData(rawCountryData, yearStr);
        score = evaluateFormulaScore(yearData, customDef.formula, rawYearData);
      } else {
        score = computeCustomScore(yearData, customDef.weights ?? {});
      }
    } else {
      score = getScoreForMetric(yearData, metricId, appState.custom);
    }

    if (score == null) continue;

    const x = pivotYear != null ? year - pivotYear : year;
    points.push({ x, y: score, year });
  }

  points.sort((a, b) => a.x - b.x);
  return points;
}

/**
 * getRegimeChangeXPositions(countryId, appState, countriesData)
 * Returns x-axis positions of regime change years (for vertical annotations)
 */
export function getRegimeChangeXPositions(countryId, appState, countriesData) {
  const meta = countriesData[countryId];
  if (!meta) return [];

  const rcYears = meta.regime_change_years ?? [];

  let pivotYear = null;
  if (appState.xMode === "aligned") {
    pivotYear = appState.alignYears?.[countryId] ?? rcYears[0] ?? null;
  } else if (appState.xMode === "pivot") {
    pivotYear = appState.pivots[countryId] ?? rcYears[0] ?? null;
  }

  return rcYears.map((y) => (pivotYear != null ? y - pivotYear : y));
}

// ── Overlay computation functions ──────────────────────────────────────────────

/**
 * getMetaForSeries(countryId, metricId, combined)
 * Returns Map<year, {st, ds}>. Empty map for non-indicator metrics.
 */
export function getMetaForSeries(countryId, metricId, combined) {
  const result = new Map();
  if (!metricId.includes("/")) return result;
  const [dim, ind] = metricId.split("/", 2);
  const countryData = combined[countryId];
  if (!countryData) return result;
  for (const [yearStr, yearData] of Object.entries(countryData)) {
    const meta = yearData[dim]?._meta?.[ind];
    if (meta) result.set(parseInt(yearStr, 10), meta);
  }
  return result;
}

/**
 * computeConfidenceBand(points, metricId, combined, countryId, method)
 * Returns [{x, yLow, yHigh}] parallel to points.
 */
export function computeConfidenceBand(points, metricId, combined, countryId, method) {
  const metaMap = getMetaForSeries(countryId, metricId, combined);

  return points.map((p, i) => {
    let half = null;

    if (method === "quality") {
      const meta = metaMap.get(p.year);
      if (meta) {
        const { st, ds } = meta;
        if (ds === "complete") {
          half = st === "quantitative" ? 5 : 10;
        } else if (ds === "partial") {
          half = 18;
        }
        // unavailable/missing → null (no band)
      }
    } else if (method === "variance") {
      // ±std of 3-point centered window
      const neighbors = [];
      if (i > 0) neighbors.push(points[i - 1].y);
      neighbors.push(p.y);
      if (i < points.length - 1) neighbors.push(points[i + 1].y);
      if (neighbors.length >= 2) {
        const mean = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
        const variance = neighbors.reduce((a, b) => a + (b - mean) ** 2, 0) / neighbors.length;
        half = Math.sqrt(variance);
      }
    }

    if (half == null) return { x: p.x, yLow: null, yHigh: null };
    return {
      x: p.x,
      yLow: Math.max(0, p.y - half),
      yHigh: Math.min(100, p.y + half),
    };
  });
}

/**
 * computeVolatility(points, windowSize)
 * Returns [{x, vol}]. Trailing rolling std dev over windowSize years.
 */
export function computeVolatility(points, windowSize) {
  return points.map((p, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const window = points.slice(start, i + 1).map((q) => q.y);
    if (window.length < 2) return { x: p.x, vol: null };
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
    return { x: p.x, vol: Math.sqrt(variance) };
  });
}

/**
 * computeTrend(points, method, windowYears)
 * Returns {direction, magnitude, label} or null.
 */
export function computeTrend(points, method, windowYears) {
  if (points.length < 3) return null;

  const recent = points.slice(-windowYears);
  if (recent.length < 2) return null;

  if (method === "slope") {
    const n = recent.length;
    const xs = recent.map((p) => p.x);
    const ys = recent.map((p) => p.y);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((a, x, i) => a + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((a, x) => a + (x - xMean) ** 2, 0);
    if (den === 0) return null;
    const beta = num / den;
    const dir = beta >= 0.5 ? "↑" : beta <= -0.5 ? "↓" : "→";
    const label = `${dir} ${beta >= 0 ? "+" : ""}${beta.toFixed(1)}/yr`;
    return { direction: dir, magnitude: beta, label };
  } else if (method === "mannkendall") {
    const ys = recent.map((p) => p.y);
    const n = ys.length;
    let P = 0, Q = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const diff = ys[j] - ys[i];
        if (diff > 0) P++;
        else if (diff < 0) Q++;
      }
    }
    const tau = (P - Q) / (n * (n - 1) / 2);
    const dir = tau > 0.3 ? "↑" : tau < -0.3 ? "↓" : "→";
    const label = `${dir} τ=${tau.toFixed(2)}`;
    return { direction: dir, magnitude: tau, label };
  }

  return null;
}

/**
 * computeSourceChangeXs(points, metricId, combined, countryId)
 * Returns array of x-values where source_type transitions between consecutive years.
 */
export function computeSourceChangeXs(points, metricId, combined, countryId) {
  if (!metricId.includes("/")) return [];
  const metaMap = getMetaForSeries(countryId, metricId, combined);
  const xs = [];
  for (let i = 1; i < points.length; i++) {
    const prev = metaMap.get(points[i - 1].year);
    const curr = metaMap.get(points[i].year);
    if (prev && curr && prev.st && curr.st && prev.st !== curr.st) {
      xs.push(points[i].x);
    }
  }
  return xs;
}

/**
 * buildSourceTransitions(points, metricId, combined, countryId)
 * Returns array parallel to points: null or {from, to} at years where
 * source_type transitions from the previous point.
 */
export function buildSourceTransitions(points, metricId, combined, countryId) {
  if (!metricId.includes("/")) return null;
  const metaMap = getMetaForSeries(countryId, metricId, combined);
  return points.map((p, i) => {
    if (i === 0) return null;
    const prev = metaMap.get(points[i - 1].year);
    const curr = metaMap.get(p.year);
    if (prev?.st && curr?.st && prev.st !== curr.st) {
      return { from: prev.st, to: curr.st };
    }
    return null;
  });
}

/**
 * getRawSeries(countryId, metricId, appState, allData, rawCountryData)
 * Returns { points: [{x, y, year}], unit } for the right y-axis.
 */
export function getRawSeries(countryId, metricId, appState, allData, rawCountryData) {
  if (!metricId?.includes("/") || !rawCountryData) return { points: [], unit: "" };
  const [dim, ind] = metricId.split("/", 2);
  const indData = rawCountryData[dim]?.[ind];
  if (!indData) return { points: [], unit: "" };

  const countryMeta = allData.countries[countryId];
  if (!countryMeta) return { points: [], unit: "" };

  const [rangeMin, rangeMax] = appState.range;
  const rcYears = countryMeta.regime_change_years ?? [];
  let pivotYear = null;
  if (appState.xMode === "aligned") {
    pivotYear = appState.alignYears?.[countryId] ?? rcYears[0] ?? null;
  } else if (appState.xMode === "pivot") {
    pivotYear = appState.pivots[countryId] ?? rcYears[0] ?? null;
  }

  const points = [];
  let unit = "";
  for (const [yearStr, entry] of Object.entries(indData)) {
    const year = parseInt(yearStr, 10);
    if (year < rangeMin || year > rangeMax) continue;
    if (entry?.raw_value == null) continue;
    if (!unit && entry.unit) unit = entry.unit;
    const x = pivotYear != null ? year - pivotYear : year;
    points.push({ x, y: entry.raw_value, year });
  }
  return { points: points.sort((a, b) => a.x - b.x), unit };
}

/** Access the raw data cache (for chart.js) */
export function getCachedRaw(countryId) {
  return _cache.raw[countryId] ?? null;
}

/**
 * getAllRawSeries(appState, allData)
 * Returns [{countryId, countryLabel, points, unit}] for the active rawAxis metric.
 * Uses cached raw data — caller must ensure loadCountryRaw() has been called first.
 */
export function getAllRawSeries(appState, allData) {
  if (!appState.rawAxis) return [];
  const { metricId } = appState.rawAxis;
  const { countries } = allData;
  const result = [];
  for (const countryId of appState.countryOrder) {
    if (!appState.countries.includes(countryId)) continue;
    const rawCountryData = _cache.raw[countryId] ?? null;
    if (!rawCountryData) continue;
    const { points, unit } = getRawSeries(countryId, metricId, appState, allData, rawCountryData);
    if (points.length === 0) continue;
    const displayName = countries[countryId]?.display_name ?? countryId;
    const indEntry = allData.indicators?.find((i) => i.id === metricId);
    const metricLabel = indEntry?.label ?? metricId;
    result.push({ countryId, countryLabel: displayName, points, unit, metricId, metricLabel });
  }
  return result;
}

/**
 * getGroupCountries(groupId, countriesData)
 * groupId: "by_region:mena" | "by_category:violent_unstable"
 */
export function getGroupCountries(groupId, countriesData) {
  const groups = countriesData._groups;
  if (!groups) return [];
  const [type, key] = groupId.split(":", 2);
  return groups[type]?.[key] ?? [];
}

/**
 * getAllCountrySeries(appState, allData)
 * Returns structured data needed by chart.js:
 * [{countryId, metricId, label, points, regimeChangeXs}]
 */
export function getAllCountrySeries(appState, allData) {
  const { countries, indicators } = allData;
  const result = [];

  // Build metric label map
  const metricLabels = {};
  for (const ind of indicators) {
    metricLabels[ind.id] = ind.label;
  }
  for (const custom of appState.custom) {
    metricLabels[custom.id] = custom.name;
  }

  for (const countryId of appState.countryOrder) {
    if (!appState.countries.includes(countryId)) continue;

    const displayName = countries[countryId]?.display_name ?? countryId;
    const rcXs = getRegimeChangeXPositions(countryId, appState, countries);
    const rcYears = countries[countryId]?.regime_change_years ?? [];

    // Pivot year used for t= computation in tooltips
    let pivotYear = null;
    if (appState.xMode === "aligned") {
      pivotYear = appState.alignYears?.[countryId] ?? rcYears[0] ?? null;
    } else if (appState.xMode === "pivot") {
      pivotYear = appState.pivots?.[countryId] ?? rcYears[0] ?? null;
    } else {
      pivotYear = rcYears[0] ?? null; // absolute: annotate relative to first rc year
    }

    for (const metricId of appState.metrics) {
      const points = getSeries(countryId, metricId, appState, allData);
      if (points.length === 0) continue;

      // Build per-point detail for indicator metrics when tooltipDetail is enabled
      let pointDetails = null;
      if (appState.tooltipDetail && metricId.includes("/")) {
        const [dim, ind] = metricId.split("/", 2);
        const rawCountryData = _cache.raw[countryId] ?? null;
        const indRaw = rawCountryData?.[dim]?.[ind];
        if (indRaw) {
          pointDetails = points.map((p) => {
            const entry = indRaw[String(p.year)];
            if (!entry) return null;
            return {
              confidence: entry.confidence ?? null,
              assessment: entry.assessment ?? null,
              rawValue: entry.raw_value ?? null,
              rawUnit: entry.unit ?? null,
            };
          });
        }
      }

      const sourceTransitions = metricId.includes("/")
        ? buildSourceTransitions(points, metricId, allData.combined, countryId)
        : null;

      const baseLabel = metricLabels[metricId] ?? metricId;
      // Indicator-level metrics (dim/ind) get a "(score)" suffix to distinguish
      // the 0–100 score from the raw value series shown on the right axis.
      const isIndicator = metricId.includes("/") && !metricId.startsWith("c_");
      const metricLabel = isIndicator ? baseLabel + " (score)" : baseLabel;

      result.push({
        countryId,
        metricId,
        countryLabel: displayName,
        metricLabel,
        points,
        regimeChangeXs: rcXs,
        pivotYear,
        pointDetails,
        sourceTransitions,
      });
    }
  }

  return result;
}

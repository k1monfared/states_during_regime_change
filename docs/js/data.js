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
  fundamental: null,
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
      fundamental: _cache.fundamental,
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

  // Load fundamental.json silently (may not exist yet)
  try {
    const fundamental = await fetchJSON("data/fundamental.json");
    _cache.fundamental = fundamental;
  } catch {
    _cache.fundamental = {};
  }

  return {
    combined,
    countries,
    indicators,
    fundamental: _cache.fundamental,
  };
}

/**
 * getFundamentalValue(countryId, seriesId, yearStr)
 * Returns the raw numeric value from the fundamental cache, or null.
 */
export function getFundamentalValue(countryId, seriesId, yearStr) {
  if (!_cache.fundamental) return null;
  return _cache.fundamental[countryId]?.[seriesId]?.[yearStr] ?? null;
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

/**
 * _buildDimensionVars(yearData, metricId)
 * Returns { indicatorSlug: score, ... } for one dimension or composite.
 * For composite: keys are dimension ids (political, economic, ...).
 * For dimension: keys are bare indicator slugs (territorial_control, ...).
 */
function _buildDimensionVars(yearData, metricId) {
  if (!yearData) return {};
  const vars = {};
  if (metricId === "composite") {
    for (const [dim, dimData] of Object.entries(yearData)) {
      if (dim.startsWith("_") || typeof dimData !== "object" || dimData === null) continue;
      vars[dim] = dimData._score != null ? dimData._score : NaN;
    }
  } else {
    const dimData = yearData[metricId];
    if (dimData && typeof dimData === "object") {
      for (const [ind, val] of Object.entries(dimData)) {
        if (ind.startsWith("_")) continue;
        vars[ind] = val != null ? val : NaN;
      }
    }
  }
  return vars;
}

/**
 * pythonToJS(formula)
 * Translates Python-like formula syntax into JavaScript for use with new Function().
 * Supports: None/True/False, is/is not None, and/or/not, abs/round/floor/ceil/sqrt/min/max,
 *           sum(arr)/len(arr), list comprehensions [expr for v in [...] if cond],
 *           Python ternary (val if cond else fallback), bare assignments → let,
 *           if/elif/else blocks, # comments.
 */
export function pythonToJS(formula) {
  let code = formula;

  // is not None / is None  (before None→null replacement)
  code = code
    .replace(/\bis\s+not\s+None\b/g, "!== null")
    .replace(/\bis\s+None\b/g, "=== null");

  // Literals and math builtins
  code = code
    .replace(/\bNone\b/g, "null")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bmath\.(\w+)/g, "Math.$1")
    .replace(/\babs\b(?=\s*\()/g, "Math.abs")
    .replace(/\bround\b(?=\s*\()/g, "Math.round")
    .replace(/\bfloor\b(?=\s*\()/g, "Math.floor")
    .replace(/\bceil\b(?=\s*\()/g, "Math.ceil")
    .replace(/\bsqrt\b(?=\s*\()/g, "Math.sqrt")
    .replace(/\bmin\b(?=\s*\()/g, "Math.min")
    .replace(/\bmax\b(?=\s*\()/g, "Math.max")
    .replace(/\bpow\b(?=\s*\()/g, "Math.pow");

  // Boolean operators
  code = code
    .replace(/\bnot\s+(?=[\w(])/g, "!")
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||");

  // sum(arr) → arr.reduce(...)  and  len(arr) → (arr).length
  code = code.replace(/\bsum\s*\(([^)]+)\)/g, "($1).reduce((a,b)=>a+b,0)");
  code = code.replace(/\blen\s*\(([^)]+)\)/g, "($1).length");

  // List comprehensions (loop handles multiple on the same line)
  let prev;
  do {
    prev = code;
    // [expr for v in [items] if cond]
    code = code.replace(
      /\[\s*([\w\s+\-*/().]+?)\s+for\s+(\w+)\s+in\s+(\[[^\]]*\])\s+if\s+([^\]]*?)\s*\]/g,
      (_, expr, v, iter, cond) => {
        expr = expr.trim();
        return expr === v
          ? `${iter}.filter(${v} => (${cond}))`
          : `${iter}.filter(${v} => (${cond})).map(${v} => ${expr})`;
      }
    );
    // [expr for v in [items]]
    code = code.replace(
      /\[\s*([\w\s+\-*/().]+?)\s+for\s+(\w+)\s+in\s+(\[[^\]]*\])\s*\]/g,
      (_, expr, v, iter) => {
        expr = expr.trim();
        return expr === v ? iter : `${iter}.map(${v} => ${expr})`;
      }
    );
  } while (code !== prev);

  // Python ternary: "val if cond else fallback" (end-of-line; skip JS if-statements)
  code = code.replace(
    /^(\s*(?:return\s+)?)(.+?)\s+if\s+(.+?)\s+else\s+(.+?)\s*$/gm,
    (m, prefix, val, cond, fallback) => {
      if (/^\s*if\s*\(/.test(m)) return m; // already a JS if(...)
      return `${prefix}(${cond}) ? (${val}) : ${fallback}`;
    }
  );

  // Line-by-line transformations
  const lines = code.split("\n").map((line) => {
    line = line.replace(/#.*$/, ""); // strip # comments
    // if/elif/else Python syntax → JS (add parens, strip colon)
    line = line.replace(/^(\s*)elif\s+(.*?):\s*$/, "$1else if ($2)");
    line = line.replace(/^(\s*)if\s+(.*?):\s*$/, "$1if ($2)");
    line = line.replace(/^(\s*)else\s*:\s*$/, "$1else");
    // bare assignments → let declarations
    if (!/^\s*(let|const|var|return|if|else|for|while|\/\/)/.test(line)) {
      line = line.replace(/^(\s*)(\w+)\s*=(?![=>])(.*)$/, "$1let $2 =$3");
    }
    return line;
  });

  // Auto-return last non-empty line if no explicit return
  if (!lines.some((l) => /^\s*return\s/.test(l))) {
    const lastIdx = [...lines.keys()].reverse().find((i) => lines[i].trim());
    if (lastIdx !== undefined) lines[lastIdx] = "return (" + lines[lastIdx].trim() + ")";
  }

  return lines.join("\n");
}

/**
 * evaluateDimensionFormula(vars, formula)
 * Evaluates a user-supplied Python-like formula with dimension/indicator vars.
 * Returns a score (0–100) or null on error.
 */
export function evaluateDimensionFormula(vars, formula) {
  const names = Object.keys(vars);
  const values = names.map((k) => vars[k]);
  try {
    const code = pythonToJS(formula);
    const fn = new Function(...names, '"use strict";\n' + code);
    const result = fn(...values);
    if (typeof result === "number" && isFinite(result)) {
      return Math.max(0, Math.min(100, result));
    }
    return null;
  } catch {
    return null;
  }
}

export function evaluateFormulaScore(yearData, formula, rawYearData = {}) {
  const vars = _buildVarMap(yearData, rawYearData);
  const names = Object.keys(vars);
  const values = names.map((k) => vars[k]);
  try {
    const code = pythonToJS(formula);
    const fn = new Function(...names, '"use strict";\n' + code);
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

  // Handle fundamental series (from fundamental.json, not combined.json)
  if (metricId.startsWith("fundamental/series/")) {
    const seriesId = metricId.replace("fundamental/series/", "");
    const fundCountryData = _cache.fundamental?.[countryId];
    if (!fundCountryData || !fundCountryData[seriesId]) return [];

    const points = [];
    for (const [yearStr, value] of Object.entries(fundCountryData[seriesId])) {
      const year = parseInt(yearStr, 10);
      if (year < rangeMin || year > rangeMax) continue;
      if (value == null) continue;
      const x = pivotYear != null ? year - pivotYear : year;
      points.push({ x, y: value, year });
    }
    points.sort((a, b) => a.x - b.x);
    return points;
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
      // Check for custom dimension/composite formula
      const dimFormula = appState.dimensionFormulas?.[metricId];
      if (dimFormula && !metricId.includes("/")) {
        const vars = _buildDimensionVars(yearData, metricId);
        score = evaluateDimensionFormula(vars, dimFormula);
      } else {
        score = getScoreForMetric(yearData, metricId, appState.custom);
      }
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
 * Returns [{countryId, countryLabel, points, unit, metricId, metricLabel}] for all active
 * rawAxes metrics across all selected countries.
 * Uses cached raw data — caller must ensure loadCountryRaw() has been called first.
 */
export function getAllRawSeries(appState, allData) {
  const { countries } = allData;
  const result = [];

  // Standard raw-axis series (user-toggled via rawAxes)
  for (const metricId of (appState.rawAxes ?? [])) {
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
  }

  // Fundamental metrics selected in appState.metrics — raw by nature, always right axis
  for (const metricId of (appState.metrics ?? [])) {
    if (!metricId.startsWith("fundamental/series/")) continue;
    for (const countryId of appState.countryOrder) {
      if (!appState.countries.includes(countryId)) continue;
      const points = getSeries(countryId, metricId, appState, allData);
      if (points.length === 0) continue;
      const displayName = countries[countryId]?.display_name ?? countryId;
      const indEntry = allData.indicators?.find((i) => i.id === metricId);
      const metricLabel = indEntry?.label ?? metricId;
      const unit = indEntry?.unit ?? "";
      result.push({ countryId, countryLabel: displayName, points, unit, metricId, metricLabel });
    }
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
      // Skip fundamental series — they carry raw values (not 0–100 scores)
      // and are rendered on the right y-axis via getAllRawSeries().
      if (metricId.startsWith("fundamental/series/")) continue;

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

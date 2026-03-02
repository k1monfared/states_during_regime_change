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

  const points = [];

  for (const [yearStr, yearData] of Object.entries(countryData)) {
    const year = parseInt(yearStr, 10);
    if (year < rangeMin || year > rangeMax) continue;

    let score;
    if (customDef) {
      score = computeCustomScore(yearData, customDef.weights);
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

    for (const metricId of appState.metrics) {
      const points = getSeries(countryId, metricId, appState, allData);
      if (points.length === 0) continue;

      result.push({
        countryId,
        metricId,
        countryLabel: displayName,
        metricLabel: metricLabels[metricId] ?? metricId,
        points,
        regimeChangeXs: rcXs,
      });
    }
  }

  return result;
}

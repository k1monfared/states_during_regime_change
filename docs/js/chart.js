/**
 * chart.js — Plotly wrapper for overlay and stacked chart modes
 *
 * Uses Plotly.react() for efficient diff-updates.
 */

import {
  computeConfidenceBand, computeVolatility,
  computeTrend, computeSourceChangeXs, buildSourceTransitions,
} from "./data.js";

// 10-color palette, colorblind-accessible
const COUNTRY_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
  "#ea580c", // orange
  "#475569", // slate
];

const METRIC_DASH = ["solid", "dash", "dot", "dashdot", "longdash"];

let _colorMap = {}; // countryId → color index

function getColor(id, map) {
  if (!(id in map)) {
    const idx = Object.keys(map).length % COUNTRY_COLORS.length;
    map[id] = idx;
  }
  return COUNTRY_COLORS[map[id]];
}

// Derive dash from the metric's current position in the metrics array.
// This mirrors controls.js so the sidebar and chart always agree,
// and avoids stale assignments when metrics are added/removed.
function getMetricDash(metricId, metricsOrder) {
  const idx = metricsOrder.indexOf(metricId);
  return METRIC_DASH[idx >= 0 ? idx % METRIC_DASH.length : 0];
}

// ── Plot context ───────────────────────────────────────────────────────────────

/**
 * _buildPlotContext(seriesList, rawSeriesList, appState)
 *
 * Resolves all visual decisions (colors, dashes, axis assignments, legend
 * behaviour) before any trace is built.  Both _renderOverlay and
 * _renderStacked call this once at the top of their bodies.
 */
function _buildPlotContext(seriesList, rawSeriesList, appState) {
  const chartMode = appState.chartMode;
  const countriesInOrder = appState.countryOrder.filter(c => appState.countries.includes(c));
  const N = chartMode === "stacked" ? countriesInOrder.length : 0;

  const scoreCountries = [...new Set(seriesList.map(s => s.countryId))];
  const scoreMetrics   = [...new Set(seriesList.map(s => s.metricId))];
  const allCountries   = [...new Set([
    ...scoreCountries,
    ...rawSeriesList.map(rs => rs.countryId),
  ])];
  const allMetrics = [...new Set([
    ...scoreMetrics,
    ...rawSeriesList.map(rs => rs.metricId),
  ])];

  // ── Color scheme ──────────────────────────────────────────────────────────
  let colorScheme;
  if (chartMode === "stacked") {
    colorScheme = "by-metric";
  } else if (scoreMetrics.length === 0) {
    // No score metrics — only raw/fundamental series: color by metric
    colorScheme = "by-metric";
  } else if (scoreMetrics.length <= 1 && scoreCountries.length !== 1) {
    colorScheme = "by-country";
  } else if (scoreCountries.length === 1) {
    colorScheme = "by-metric";
  } else {
    colorScheme = "by-country"; // multi-metric + multi-country
  }

  // Build color lookups (deterministic from current series, not global map)
  const countryColorIdx = {};
  allCountries.forEach((c, i) => { countryColorIdx[c] = i % COUNTRY_COLORS.length; });
  const metricColorIdx = {};
  allMetrics.forEach((m, i) => { metricColorIdx[m] = i % COUNTRY_COLORS.length; });

  function ctxGetColor(countryId, metricId) {
    if (colorScheme === "by-metric") return COUNTRY_COLORS[metricColorIdx[metricId] ?? 0];
    return COUNTRY_COLORS[countryColorIdx[countryId] ?? 0];
  }

  function getDash(metricId) {
    if (scoreMetrics.length <= 1) return "solid";
    return getMetricDash(metricId, appState.metrics);
  }

  // ── Legend ────────────────────────────────────────────────────────────────
  const splitLegend = colorScheme === "by-country"
    && scoreMetrics.length > 1 && scoreCountries.length > 1;

  function legendLabel(s) {
    if (splitLegend) return `${s.countryLabel} — ${s.metricLabel}`;
    if (colorScheme === "by-metric") return s.metricLabel;
    return s.countryLabel;
  }
  function rawLegendLabel(rs) {
    return `${rs.countryLabel} — ${rs.metricLabel} (raw)`;
  }

  // ── Score axis lookups ────────────────────────────────────────────────────
  function getScoreYAxis(countryId) {
    if (chartMode !== "stacked") return "y";
    const row = countriesInOrder.indexOf(countryId);
    return row === 0 ? "y" : `y${row + 1}`;
  }
  function getScoreXAxis(countryId) {
    if (chartMode !== "stacked") return undefined;
    const row = countriesInOrder.indexOf(countryId);
    return row === 0 ? "x" : `x${row + 1}`;
  }

  // ── Raw axis assignments ──────────────────────────────────────────────────
  const rawAxisEntries = []; // [{axisKey, unit, overlayAxis, xaxisKey, ...}]
  const _rawAxisLookup = new Map(); // "cId:unit" → axisKey

  if (chartMode !== "stacked") {
    // Overlay: one axis per unit, shared across all countries
    const units = [...new Set(rawSeriesList.map(rs => rs.unit ?? ""))];
    units.forEach((unit, i) => {
      const axisKey = `y${i + 2}`;
      rawAxisEntries.push({ axisKey, unit, overlayAxis: "y", xaxisKey: undefined });
      _rawAxisLookup.set(`:${unit}`, axisKey);
    });
  } else {
    // Stacked: one axis per (country, unit) combination
    let secIdx = N + 1;
    const uniqueUnits = [...new Set(rawSeriesList.map(rs => rs.unit ?? ""))];
    for (let row = 0; row < countriesInOrder.length; row++) {
      const countryId = countriesInOrder[row];
      const primaryNum = row === 0 ? "" : String(row + 1);
      const overlayAxis = `y${primaryNum}`;
      const xaxisKey = row === 0 ? "x" : `x${row + 1}`;
      const countryUnits = uniqueUnits.filter(u =>
        rawSeriesList.some(rs => rs.countryId === countryId && (rs.unit ?? "") === u)
      );
      countryUnits.forEach((unit, unitIdx) => {
        const axisKey = `y${secIdx}`;
        rawAxisEntries.push({ axisKey, unit, overlayAxis, xaxisKey, countryId, unitIdx });
        _rawAxisLookup.set(`${countryId}:${unit}`, axisKey);
        secIdx++;
      });
    }
  }

  function getRawYAxis(countryId, unit) {
    const key = chartMode === "stacked"
      ? `${countryId}:${unit ?? ""}`
      : `:${unit ?? ""}`;
    return _rawAxisLookup.get(key) ?? null;
  }
  function getRawXAxis(countryId) {
    if (chartMode !== "stacked") return undefined;
    const row = countriesInOrder.indexOf(countryId);
    return row === 0 ? "x" : `x${row + 1}`;
  }

  // Max distinct units in any single row (drives right margin)
  let maxRawUnitsPerRow = 0;
  if (chartMode !== "stacked") {
    maxRawUnitsPerRow = rawAxisEntries.length; // overlay: all on same chart
  } else {
    for (const countryId of countriesInOrder) {
      const n = rawAxisEntries.filter(e => e.countryId === countryId).length;
      if (n > maxRawUnitsPerRow) maxRawUnitsPerRow = n;
    }
  }

  return {
    chartMode, countriesInOrder, N,
    scoreCountries, scoreMetrics, allCountries, allMetrics,
    colorScheme,
    getColor: ctxGetColor,
    getDash,
    splitLegend, legendLabel, rawLegendLabel,
    getScoreYAxis, getScoreXAxis,
    getRawYAxis, getRawXAxis,
    rawAxisEntries, numExtraAxes: rawAxisEntries.length,
    maxRawUnitsPerRow,
  };
}

// ── Build Plotly traces & layout ───────────────────────────────────────────────

// HTML-escape helper for values embedded inside hovertemplate strings
function _htesc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Word-wrap plain text at lineWidth chars, HTML-escaping each line
function _wrapAndEsc(text, lineWidth) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    if (cur.length > 0 && cur.length + 1 + word.length > lineWidth) {
      lines.push(_htesc(cur));
      cur = word;
    } else {
      cur = cur.length > 0 ? cur + " " + word : word;
    }
  }
  if (cur) lines.push(_htesc(cur));
  return lines.join("<br>");
}

/**
 * Pre-build hover text per point (year + t= offset, plus optional detail).
 * pointDetails: array of {confidence, assessment, rawValue, rawUnit} | null,
 *   parallel to points — populated when appState.tooltipDetail is true.
 * sourceTransitions: array of {from, to} | null, parallel to points.
 */
function buildHoverText(points, pivotYear, pointDetails, sourceTransitions) {
  const _fmtSt = (t) => t === "quantitative" ? "quant" : "qual";
  return points.map((p, i) => {
    let s = `Year: ${p.year}`;
    if (pivotYear != null) {
      s += `<br>t = ${p.year - pivotYear} (from ${pivotYear})`;
    }
    const trans = sourceTransitions?.[i];
    if (trans) {
      s += `<br>⚠ Source type: ${_fmtSt(trans.from)} → ${_fmtSt(trans.to)}`;
    }
    const detail = pointDetails?.[i];
    if (detail) {
      if (detail.rawValue != null) {
        const u = detail.rawUnit
          ? ` ${_htesc(detail.rawUnit.replace(/_/g, " "))}`
          : "";
        s += `<br>Raw: ${_htesc(String(detail.rawValue))}${u}`;
      }
      if (detail.confidence) {
        s += `<br>Confidence: ${_htesc(detail.confidence)}`;
      }
      if (detail.assessment) {
        const full = detail.assessment.replace(/\s+/g, " ").trim();
        s += `<br><i>${_wrapAndEsc(full, 65)}</i>`;
      }
    }
    return s;
  });
}

function buildHoverTemplate(countryLabel, metricLabel) {
  return `<b>${countryLabel}</b><br>${metricLabel}: %{y:.0f}<br>%{text}<extra></extra>`;
}

/**
 * render(seriesList, rawSeriesList, appState, allData)
 * seriesList: output of getAllCountrySeries()
 * rawSeriesList: output of getAllRawSeries() — right y-axis raw series
 * appState: current state snapshot
 * allData: {combined, countries, indicators} for overlay computations
 */
export function render(seriesList, rawSeriesList, appState, allData) {
  const el = document.getElementById("chart");
  const emptyEl = document.getElementById("chart-empty");

  if (!el) return;

  if (seriesList.length === 0 && (rawSeriesList ?? []).length === 0) {
    if (emptyEl) emptyEl.style.display = "flex";
    Plotly.purge(el);
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  if (appState.chartMode === "stacked") {
    _renderStacked(el, seriesList, rawSeriesList ?? [], appState, allData);
  } else {
    _renderOverlay(el, seriesList, rawSeriesList ?? [], appState, allData);
  }
}

// ── Overlay trace builders ──────────────────────────────────────────────────────

/**
 * _buildOverlayTraces(s, appState, allData, axisConfig)
 * Returns array of Plotly trace objects for overlays (bands, volatility, source markers).
 * axisConfig: {xAxis, yAxis, color}
 */
function _buildOverlayTraces(s, appState, allData, axisConfig) {
  const { xAxis, yAxis, color } = axisConfig;
  const traces = [];
  const combined = allData?.combined;

  if (appState.overlayBands && combined) {
    const bands = computeConfidenceBand(
      s.points, s.metricId, combined, s.countryId, appState.overlayBandsMethod
    );
    const validBands = bands.filter((b) => b.yHigh != null);
    if (validBands.length > 0) {
      // Upper bound (invisible line)
      traces.push({
        x: bands.map((b) => b.x),
        y: bands.map((b) => b.yHigh),
        type: "scatter",
        mode: "lines",
        line: { color: "transparent", width: 0 },
        showlegend: false,
        hoverinfo: "skip",
        xaxis: xAxis,
        yaxis: yAxis,
      });
      // Lower bound with fill to upper
      traces.push({
        x: bands.map((b) => b.x),
        y: bands.map((b) => b.yLow),
        type: "scatter",
        mode: "lines",
        line: { color: "transparent", width: 0 },
        fill: "tonexty",
        fillcolor: color + "33",
        showlegend: false,
        hoverinfo: "skip",
        xaxis: xAxis,
        yaxis: yAxis,
      });
    }
  }

  if (appState.overlayVolatility) {
    const volData = computeVolatility(s.points, appState.overlayVolatilityWindow ?? 3);
    const xs = s.points.map((p) => p.x);
    const ys = s.points.map((p) => p.y);
    // Upper envelope: y + vol
    traces.push({
      x: xs,
      y: ys.map((y, i) => volData[i].vol != null ? Math.min(100, y + volData[i].vol) : null),
      type: "scatter",
      mode: "lines",
      line: { color: "transparent", width: 0 },
      showlegend: false,
      hoverinfo: "skip",
      xaxis: xAxis,
      yaxis: yAxis,
    });
    // Lower envelope with fill
    traces.push({
      x: xs,
      y: ys.map((y, i) => volData[i].vol != null ? Math.max(0, y - volData[i].vol) : null),
      type: "scatter",
      mode: "lines",
      line: { color: "transparent", width: 0 },
      fill: "tonexty",
      fillcolor: color + "22",
      showlegend: false,
      hoverinfo: "skip",
      xaxis: xAxis,
      yaxis: yAxis,
    });
  }

  if (appState.overlaySourceMarkers && combined) {
    const changeXs = computeSourceChangeXs(s.points, s.metricId, combined, s.countryId);
    if (changeXs.length > 0) {
      const changePoints = s.points.filter((p) => changeXs.includes(p.x));
      traces.push({
        x: changePoints.map((p) => p.x),
        y: changePoints.map((p) => p.y),
        type: "scatter",
        mode: "markers",
        name: "Source change",
        showlegend: false,
        hoverinfo: "skip",
        marker: {
          symbol: "diamond",
          size: 9,
          color: "#fff",
          line: { color, width: 2 },
        },
        xaxis: xAxis,
        yaxis: yAxis,
      });
    }
  }

  return traces;
}

/**
 * _buildTrendAnnotations(seriesList, appState, yref?)
 * Returns array of Plotly layout.annotations for trend indicators.
 * Uses global _colorMap for color consistency with the sidebar.
 */
function _buildTrendAnnotations(seriesList, appState, yrefFn) {
  if (!appState.overlayTrend) return [];
  const annotations = [];

  for (const s of seriesList) {
    if (s.points.length < 3) continue;
    const trend = computeTrend(
      s.points,
      appState.overlayTrendMethod ?? "slope",
      appState.overlayTrendWindow ?? 5
    );
    if (!trend) continue;

    const lastPt = s.points[s.points.length - 1];
    const color = getColor(s.countryId, _colorMap);
    const yref = yrefFn ? yrefFn(s) : "y";

    annotations.push({
      x: lastPt.x,
      y: lastPt.y,
      xref: "x",
      yref,
      text: trend.label,
      showarrow: false,
      xanchor: "left",
      xshift: 6,
      font: { size: 10, color },
    });
  }

  return annotations;
}

// ── Overlay mode ───────────────────────────────────────────────────────────────

function _renderOverlay(el, seriesList, rawSeriesList, appState, allData) {
  const mainTraces = [];
  const overlayTraces = [];
  const legendTraces = [];
  const shapes = [];
  const seenRC = new Set();

  const ctx = _buildPlotContext(seriesList, rawSeriesList, appState);

  // In multi-country + multi-metric mode, add legend-only dummy traces so the
  // legend shows colors → countries and line styles → metrics separately.
  if (ctx.splitLegend) {
    const seenCountries = new Set();
    const seenMetrics = new Set();
    for (const s of seriesList) {
      if (!seenCountries.has(s.countryId)) {
        seenCountries.add(s.countryId);
        legendTraces.push({
          x: [], y: [], type: "scatter", mode: "lines",
          name: s.countryLabel,
          line: { color: ctx.getColor(s.countryId, s.metricId), dash: "solid", width: 2 },
          showlegend: true,
          hoverinfo: "skip",
        });
      }
      if (!seenMetrics.has(s.metricId)) {
        seenMetrics.add(s.metricId);
        legendTraces.push({
          x: [], y: [], type: "scatter", mode: "lines",
          name: s.metricLabel,
          line: { color: "#888", dash: ctx.getDash(s.metricId), width: 2 },
          showlegend: true,
          hoverinfo: "skip",
        });
      }
    }
  }

  for (const s of seriesList) {
    const color = ctx.getColor(s.countryId, s.metricId);
    const dash = ctx.getDash(s.metricId);
    const name = ctx.legendLabel(s);

    // Build overlay traces (render behind main lines)
    const axisConfig = { xAxis: undefined, yAxis: undefined, color };
    overlayTraces.push(..._buildOverlayTraces(s, appState, allData, axisConfig));

    mainTraces.push({
      x: s.points.map((p) => p.x),
      y: s.points.map((p) => p.y),
      text: buildHoverText(s.points, s.pivotYear, s.pointDetails, s.sourceTransitions),
      type: "scatter",
      mode: "lines",
      name,
      showlegend: !ctx.splitLegend,
      line: { color, dash, width: 1.8 },
      hovertemplate: buildHoverTemplate(s.countryLabel, s.metricLabel),
    });

    // In absolute mode, mark regime change years with a triangle on the curve
    if (appState.xMode === "absolute") {
      const rcSet = new Set(s.regimeChangeXs);
      const rcPoints = s.points.filter((p) => rcSet.has(p.x));
      if (rcPoints.length > 0) {
        // Map rcPoints back to their indices in s.points for correct detail lookup
        const rcDetails = rcPoints.map((rp) => {
          const idx = s.points.findIndex((p) => p.x === rp.x && p.year === rp.year);
          return s.pointDetails?.[idx] ?? null;
        });
        const rcTransitions = rcPoints.map((rp) => {
          const idx = s.points.findIndex((p) => p.x === rp.x && p.year === rp.year);
          return s.sourceTransitions?.[idx] ?? null;
        });
        mainTraces.push({
          x: rcPoints.map((p) => p.x),
          y: rcPoints.map((p) => p.y),
          text: buildHoverText(rcPoints, s.pivotYear, rcDetails, rcTransitions),
          type: "scatter",
          mode: "markers",
          name,
          showlegend: false,
          marker: { color, symbol: "triangle-up", size: 10, line: { color: "#fff", width: 1 } },
          hovertemplate: buildHoverTemplate(s.countryLabel, s.metricLabel + " (regime change)"),
        });
      }
    }
  }

  // Regime change vertical lines (overlay: one shape set)
  // Use global _colorMap for color consistency with the sidebar.
  if (appState.xMode !== "absolute") {
    for (const s of seriesList) {
      for (const x of s.regimeChangeXs) {
        const key = `${s.countryId}:${x}`;
        if (!seenRC.has(key)) {
          seenRC.add(key);
          shapes.push({
            type: "line",
            x0: x,
            x1: x,
            y0: 0,
            y1: 1,
            yref: "paper",
            line: {
              color: getColor(s.countryId, _colorMap),
              width: 1.5,
              dash: "dash",
            },
          });
        }
      }
    }
  }

  // Raw traces — iterate rawSeriesList directly using ctx axis assignments
  const rawTraces = [];
  const hasScoreTraces = seriesList.length > 0;
  const rawOnly = !hasScoreTraces;
  // When rawOnly, the first unit's axis was promoted to primary "y"
  const firstRawUnit = rawOnly && ctx.rawAxisEntries.length > 0
    ? ctx.rawAxisEntries[0].unit : null;
  for (const rs of rawSeriesList) {
    const color = ctx.getColor(rs.countryId, rs.metricId);
    const dash = hasScoreTraces ? "dot" : ctx.getDash(rs.metricId);
    let axisKey = ctx.getRawYAxis(rs.countryId, rs.unit);
    if (!axisKey) continue;
    // Remap first unit to primary axis in rawOnly mode
    if (rawOnly && (rs.unit ?? "") === (firstRawUnit ?? "")) axisKey = "y";
    const rawLabel = rs.metricLabel ?? rs.metricId;
    const unit = rs.unit ?? "";
    const unitStr = unit ? ` (${unit.replace(/_/g, " ")})` : "";
    rawTraces.push({
      x: rs.points.map((p) => p.x),
      y: rs.points.map((p) => p.y),
      text: buildHoverText(rs.points, null),
      type: "scatter",
      mode: "lines",
      name: hasScoreTraces ? ctx.rawLegendLabel(rs) : rs.metricLabel,
      showlegend: true,
      line: { color, dash, width: 1.5 },
      yaxis: axisKey,
      hovertemplate: `<b>${_htesc(rs.countryLabel)}</b><br>${_htesc(rawLabel)}${hasScoreTraces ? " (raw)" : ""}: %{y:.4g}${unitStr ? " " + _htesc(unitStr) : ""}<br>%{text}<extra></extra>`,
    });
  }

  const layout = _baseLayout(appState, ctx.rawAxisEntries, seriesList.length === 0);
  layout.shapes = shapes;
  layout.legend = { orientation: "h", y: -0.12, font: { size: 11 } };
  layout.annotations = _buildTrendAnnotations(seriesList, appState);

  // legendTraces first (so they anchor the legend order), then overlays, then main lines, then raw
  Plotly.react(el, [...legendTraces, ...overlayTraces, ...mainTraces, ...rawTraces], layout, _config());
}

// ── Stacked mode ───────────────────────────────────────────────────────────────

function _renderStacked(el, seriesList, rawSeriesList, appState, allData) {
  const ctx = _buildPlotContext(seriesList, rawSeriesList, appState);
  const { countriesInOrder, N } = ctx;

  if (countriesInOrder.length === 0) {
    Plotly.purge(el);
    return;
  }

  const traces = [];
  const shapes = [];

  // Compute per-subplot vertical domains manually.
  // yaxis.domain = [bottom, top] in paper coordinates (0 = bottom, 1 = top).
  // Row 0 is the top subplot; rows increase downward.
  const gap = N > 1 ? 0.04 : 0;
  const plotHeight = (1 - gap * (N - 1)) / N;
  function rowDomain(row) {
    const top = 1 - row * (plotHeight + gap);
    const bottom = top - plotHeight;
    return [+bottom.toFixed(4), +top.toFixed(4)];
  }

  // Build traces and shapes
  const allAnnotations = [];
  for (let row = 0; row < N; row++) {
    const countryId = countriesInOrder[row];
    const xAxis = ctx.getScoreXAxis(countryId);
    const yAxis = ctx.getScoreYAxis(countryId);

    // Add an invisible placeholder so Plotly renders this subplot even when
    // no score traces exist (raw-only view).  Without at least one trace on
    // each primary axis Plotly may discard the subplot and orphan secondary axes.
    traces.push({
      x: [0], y: [null],
      type: "scatter", mode: "lines",
      showlegend: false, hoverinfo: "skip",
      xaxis: xAxis, yaxis: yAxis,
      line: { width: 0 },
    });

    const countrySeries = seriesList.filter((s) => s.countryId === countryId);

    for (const s of countrySeries) {
      const color = ctx.getColor(s.countryId, s.metricId);
      const dash = ctx.getDash(s.metricId);

      // Overlay traces for this row (behind main line)
      const rowOverlays = _buildOverlayTraces(s, appState, allData, { xAxis, yAxis, color });
      traces.push(...rowOverlays);

      traces.push({
        x: s.points.map((p) => p.x),
        y: s.points.map((p) => p.y),
        text: buildHoverText(s.points, s.pivotYear, s.pointDetails, s.sourceTransitions),
        type: "scatter",
        mode: "lines",
        name: s.metricLabel,
        xaxis: xAxis,
        yaxis: yAxis,
        line: { color, dash, width: 1.8 },
        hovertemplate: buildHoverTemplate(s.countryLabel, s.metricLabel),
        showlegend: row === 0, // show legend entries only once
        legendgroup: s.metricId,
      });
    }

    // Trend annotations for this row
    const rowAnnotations = _buildTrendAnnotations(
      countrySeries,
      appState,
      () => yAxis
    );
    allAnnotations.push(...rowAnnotations);

    // Regime change lines
    const rcXs = countrySeries[0]?.regimeChangeXs ?? [];
    for (const x of rcXs) {
      shapes.push({
        type: "line",
        xref: xAxis,
        yref: `${yAxis} domain`,
        x0: x, x1: x, y0: 0, y1: 1,
        line: { color: "#888", width: 1.5, dash: "dash" },
      });
    }
  }

  // Raw traces — each country row gets its own secondary axis per unit
  const stackedHasScores = seriesList.length > 0;
  for (const rs of rawSeriesList) {
    const xaxisKey = ctx.getRawXAxis(rs.countryId);
    const yaxisKey = ctx.getRawYAxis(rs.countryId, rs.unit);
    if (!yaxisKey) continue;
    const color = ctx.getColor(rs.countryId, rs.metricId);
    const dash = stackedHasScores ? "dot" : ctx.getDash(rs.metricId);
    const rawLabel = rs.metricLabel ?? rs.metricId;
    const unit = rs.unit ?? "";
    const unitStr = unit ? ` (${unit.replace(/_/g, " ")})` : "";
    traces.push({
      x: rs.points.map((p) => p.x),
      y: rs.points.map((p) => p.y),
      text: buildHoverText(rs.points, null),
      type: "scatter",
      mode: "lines",
      name: stackedHasScores ? ctx.rawLegendLabel(rs) : rs.metricLabel,
      xaxis: xaxisKey,
      yaxis: yaxisKey,
      line: { color, dash, width: 1.5 },
      showlegend: true,
      hovertemplate: `<b>${_htesc(rs.countryLabel)}</b><br>${_htesc(rawLabel)} (raw): %{y:.4g}${unitStr ? " " + _htesc(unitStr) : ""}<br>%{text}<extra></extra>`,
    });
  }

  // Build layout with explicit axis domains — no layout.grid
  const xTitle =
    appState.xMode === "absolute"
      ? "Year"
      : appState.xMode === "aligned"
      ? "Years relative to regime change (t=0)"
      : "Years relative to pivot year (t=0)";

  const layout = {
    margin: { t: 16, r: 16 + ctx.maxRawUnitsPerRow * 60, b: 50, l: 72 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { family: "-apple-system, 'Inter', system-ui, sans-serif", size: 12 },
    hovermode: "closest",
    hoverlabel: { bordercolor: "transparent", font: { size: 12, color: "rgba(255,255,255,0.95)" } },
    shapes,
    annotations: allAnnotations,
    legend: { orientation: "h", y: -0.06, font: { size: 11 } },
    autosize: true,
  };

  for (let row = 0; row < N; row++) {
    const countryId = countriesInOrder[row];
    const countryMeta = _currentCountriesMeta?.[countryId];
    const displayName = countryMeta?.display_name ?? countryId;
    const axisNum = row === 0 ? "" : String(row + 1);
    const isBottom = row === N - 1;

    layout[`xaxis${axisNum}`] = {
      domain: ctx.maxRawUnitsPerRow > 1
        ? [0, Math.max(0.5, 1 - ctx.maxRawUnitsPerRow * 0.10)]
        : [0, 1],
      anchor: `y${axisNum}`,
      showgrid: true,
      gridcolor: "#f0f0f0",
      zeroline: false,
      tickfont: { size: 10 },
      showticklabels: isBottom,
      ...(appState.xMode === "absolute" ? { range: appState.range } : { autorange: true }),
      // Link all x-axes so pan/zoom is synchronised; skip self-reference on row 0
      ...(row > 0 ? { matches: "x" } : { title: { text: xTitle, font: { size: 11 }, standoff: 6 } }),
    };

    layout[`yaxis${axisNum}`] = {
      domain: rowDomain(row),
      anchor: `x${axisNum}`,
      title: { text: displayName, font: { size: 11 }, standoff: 4 },
      range: [0, 105],
      showgrid: true,
      gridcolor: "#f0f0f0",
      tickfont: { size: 10 },
    };
  }

  // When syncRawAxes is on, compute shared [min, max] per unit across all raw series.
  // Score axes always stay at [0, 105].
  const unitSharedRange = {};
  if (appState.syncRawAxes) {
    for (const rs of rawSeriesList) {
      const unit = rs.unit ?? "";
      const vals = rs.points.map((p) => p.y).filter((v) => v != null && !isNaN(v));
      if (vals.length === 0) continue;
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      if (!(unit in unitSharedRange)) {
        unitSharedRange[unit] = [mn, mx];
      } else {
        unitSharedRange[unit][0] = Math.min(unitSharedRange[unit][0], mn);
        unitSharedRange[unit][1] = Math.max(unitSharedRange[unit][1], mx);
      }
    }
    // Pad each range by 5% on each side so data isn't flush against the axis edges
    for (const unit in unitSharedRange) {
      const [mn, mx] = unitSharedRange[unit];
      const span = mx - mn;
      const pad = span > 0 ? span * 0.05 : Math.abs(mn) * 0.05 || 1;
      unitSharedRange[unit] = [mn - pad, mx + pad];
    }
  }

  // Secondary y-axes for raw traces: one per (country, unit), overlaying that row's primary axis.
  // All secondary axes need an explicit anchor so Plotly places their tick labels in the
  // correct subplot row.  unitIdx=0 anchors to the row's x-axis; unitIdx>0 floats free.
  for (const entry of ctx.rawAxisEntries) {
    const { axisKey, unit, overlayAxis, unitIdx, xaxisKey } = entry;
    const axisNum = axisKey.slice(1);
    const unitLabel = unit ? unit.replace(/_/g, " ") : "Raw value";
    const spec = {
      title: { text: unitLabel, font: { size: 11 }, standoff: 6 },
      overlaying: overlayAxis,
      side: "right",
      showgrid: false,
      zeroline: false,
      tickfont: { size: 10 },
    };
    if (appState.syncRawAxes && (unit in unitSharedRange)) {
      spec.range = unitSharedRange[unit];
      spec.autorange = false;
    } else {
      spec.autorange = true;
    }
    if (unitIdx === 0) {
      // Anchor to this row's x-axis so labels appear beside the correct subplot
      spec.anchor = xaxisKey || "x";
    } else {
      spec.anchor = "free";
      spec.position = 1.0 + unitIdx * 0.08; // slight offset for 2nd+ unit per row
    }
    layout[`yaxis${axisNum}`] = spec;
  }

  Plotly.react(el, traces, layout, _config());
}

// Let chart.js access countries metadata for labels
let _currentCountriesMeta = null;
export function setCountriesMeta(meta) {
  _currentCountriesMeta = meta;
}

// ── Shared layout ──────────────────────────────────────────────────────────────

/**
 * _baseLayout(appState, rawAxisEntries = [], rawOnly = false)
 * Builds the base Plotly layout for overlay mode.
 * rawAxisEntries: array from _buildPlotContext.rawAxisEntries (overlay entries only).
 * rawOnly: true when no score traces exist (fundamental-only view).
 */
function _baseLayout(appState, rawAxisEntries = [], rawOnly = false) {
  const xTitle =
    appState.xMode === "absolute"
      ? "Year"
      : appState.xMode === "aligned"
      ? "Years relative to regime change (t=0)"
      : "Years relative to pivot year (t=0)";

  // When rawOnly, the first raw axis becomes the primary left axis;
  // remaining raw axes go on the right. Otherwise all raw axes are secondary.
  const secondaryRawEntries = rawOnly ? rawAxisEntries.slice(1) : rawAxisEntries;
  const numExtraAxes = secondaryRawEntries.length;

  const layout = {
    margin: { t: 16, r: 16 + numExtraAxes * 60, b: 60, l: 56 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { family: "-apple-system, 'Inter', system-ui, sans-serif", size: 12 },
    hovermode: "closest",
    hoverlabel: { bordercolor: "transparent", font: { size: 12, color: "rgba(255,255,255,0.95)" } },
    xaxis: {
      title: { text: xTitle, font: { size: 11 }, standoff: 8 },
      showgrid: true,
      gridcolor: "#f0f0f0",
      zeroline: false,
      tickfont: { size: 10 },
      ...(appState.xMode === "absolute" ? { range: appState.range } : { autorange: true }),
      domain: numExtraAxes > 1 ? [0, Math.max(0.5, 1 - numExtraAxes * 0.10)] : [0, 1],
    },
    shapes: [],
    autosize: true,
  };

  if (rawOnly && rawAxisEntries.length > 0) {
    // Promote first raw axis to the primary left y-axis
    const firstUnit = rawAxisEntries[0].unit;
    const firstLabel = firstUnit ? firstUnit.replace(/_/g, " ") : "Value";
    layout.yaxis = {
      title: { text: firstLabel, font: { size: 11 }, standoff: 6 },
      autorange: true,
      showgrid: true,
      gridcolor: "#f0f0f0",
      zeroline: false,
      tickfont: { size: 10 },
    };
  } else {
    layout.yaxis = {
      title: { text: "Score (0–100)", font: { size: 11 }, standoff: 6 },
      range: [0, 105],
      showgrid: true,
      gridcolor: "#f0f0f0",
      zeroline: false,
      tickfont: { size: 10 },
    };
  }

  // Add secondary right y-axes.
  // When rawOnly, the first raw entry was promoted to primary, so skip it.
  const entriesToLayout = rawOnly ? rawAxisEntries.slice(1) : rawAxisEntries;
  for (let i = 0; i < entriesToLayout.length; i++) {
    const { axisKey, unit } = entriesToLayout[i];
    const axisNum = axisKey.slice(1);
    const unitLabel = unit ? unit.replace(/_/g, " ") : "Raw value";
    const spec = {
      title: { text: unitLabel, font: { size: 11 }, standoff: 6 },
      overlaying: "y",
      side: "right",
      showgrid: false,
      zeroline: false,
      tickfont: { size: 10 },
      autorange: true,
    };
    if (entriesToLayout.length > 1) {
      spec.anchor = "free";
      spec.position = 1.0 + i * 0.10;
    }
    layout[`yaxis${axisNum}`] = spec;
  }

  return layout;
}

function _config() {
  return {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["select2d", "lasso2d", "toImage"],
  };
}

// ── Reset color map (call when state changes significantly) ────────────────────
export function resetColorMap() {
  _colorMap = {};
}

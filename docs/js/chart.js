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
let _dashMap = {}; // metricId → dash index

function getColor(id, map) {
  if (!(id in map)) {
    const idx = Object.keys(map).length % COUNTRY_COLORS.length;
    map[id] = idx;
  }
  return COUNTRY_COLORS[map[id]];
}

function getDash(id) {
  if (!(id in _dashMap)) {
    const idx = Object.keys(_dashMap).length % METRIC_DASH.length;
    _dashMap[id] = idx;
  }
  return METRIC_DASH[_dashMap[id]];
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
  return `<b>${countryLabel}</b><br>${metricLabel}: %{y:.1f}<br>%{text}<extra></extra>`;
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

  if (seriesList.length === 0) {
    if (emptyEl) emptyEl.style.display = "flex";
    Plotly.purge(el);
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  if (appState.chartMode === "stacked") {
    _renderStacked(el, seriesList, appState, allData);
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

  const multiMetric = appState.metrics.length > 1;
  const multiCountry = appState.countries.length > 1;
  const splitLegend = multiMetric && multiCountry;

  // In multi-country + multi-metric mode, add legend-only dummy traces so the
  // legend shows colors → countries and line styles → metrics separately.
  if (splitLegend) {
    const seenCountries = new Set();
    const seenMetrics = new Set();
    for (const s of seriesList) {
      if (!seenCountries.has(s.countryId)) {
        seenCountries.add(s.countryId);
        legendTraces.push({
          x: [], y: [], type: "scatter", mode: "lines",
          name: s.countryLabel,
          line: { color: getColor(s.countryId, _colorMap), dash: "solid", width: 2 },
          showlegend: true,
          hoverinfo: "skip",
        });
      }
      if (!seenMetrics.has(s.metricId)) {
        seenMetrics.add(s.metricId);
        legendTraces.push({
          x: [], y: [], type: "scatter", mode: "lines",
          name: s.metricLabel,
          line: { color: "#888", dash: getDash(s.metricId), width: 2 },
          showlegend: true,
          hoverinfo: "skip",
        });
      }
    }
  }

  for (const s of seriesList) {
    const color = getColor(s.countryId, _colorMap);
    const dash = multiMetric ? getDash(s.metricId) : "solid";

    let name;
    if (multiMetric && multiCountry) {
      name = `${s.countryLabel} — ${s.metricLabel}`;
    } else if (multiMetric) {
      name = s.metricLabel;
    } else {
      name = s.countryLabel;
    }

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
      showlegend: !splitLegend,
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

  // Raw axis traces (right y-axis, overlay mode only)
  const rawTraces = [];
  let rawUnit = "";
  let rawMetricLabel = "";
  if (rawSeriesList.length > 0) {
    rawUnit = rawSeriesList[0]?.unit ?? "";
    rawMetricLabel = rawSeriesList[0]?.metricLabel ?? rawSeriesList[0]?.metricId ?? "";
    for (const rs of rawSeriesList) {
      const color = getColor(rs.countryId, _colorMap);
      const rawLabel = rs.metricLabel ?? rs.metricId;
      const unitStr = rawUnit ? ` (${rawUnit.replace(/_/g, " ")})` : "";
      rawTraces.push({
        x: rs.points.map((p) => p.x),
        y: rs.points.map((p) => p.y),
        text: buildHoverText(rs.points, null),
        type: "scatter",
        mode: "lines",
        name: `${rs.countryLabel} — ${rawLabel} (raw)`,
        showlegend: true,
        line: { color, dash: "dot", width: 1.5 },
        yaxis: "y2",
        hovertemplate: `<b>${_htesc(rs.countryLabel)}</b><br>${_htesc(rawLabel)} (raw): %{y:.4g}${unitStr ? " " + _htesc(unitStr) : ""}<br>%{text}<extra></extra>`,
      });
    }
  }

  const layout = _baseLayout(appState, rawUnit, rawMetricLabel);
  layout.shapes = shapes;
  layout.legend = { orientation: "h", y: -0.12, font: { size: 11 } };
  layout.annotations = _buildTrendAnnotations(seriesList, appState);

  // legendTraces first (so they anchor the legend order), then overlays, then main lines, then raw
  Plotly.react(el, [...legendTraces, ...overlayTraces, ...mainTraces, ...rawTraces], layout, _config());
}

// ── Stacked mode ───────────────────────────────────────────────────────────────

function _renderStacked(el, seriesList, appState, allData) {
  const countriesInOrder = appState.countryOrder.filter((c) =>
    appState.countries.includes(c)
  );

  if (countriesInOrder.length === 0) {
    Plotly.purge(el);
    return;
  }

  const N = countriesInOrder.length;
  const traces = [];
  const shapes = [];

  // Color by metric so the same metric has the same color across all subplots
  const metricColorMap = {};
  for (let i = 0; i < appState.metrics.length; i++) {
    metricColorMap[appState.metrics[i]] = COUNTRY_COLORS[i % COUNTRY_COLORS.length];
  }

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
    const axisNum = row === 0 ? "" : String(row + 1);
    const xAxis = `x${axisNum}`;
    const yAxis = `y${axisNum}`;

    const countrySeries = seriesList.filter((s) => s.countryId === countryId);

    for (const s of countrySeries) {
      const color = metricColorMap[s.metricId] ?? COUNTRY_COLORS[0];
      const dash = appState.metrics.length > 1 ? getDash(s.metricId) : "solid";

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

  // Build layout with explicit axis domains — no layout.grid
  const xTitle =
    appState.xMode === "absolute"
      ? "Year"
      : appState.xMode === "aligned"
      ? "Years relative to regime change (t=0)"
      : "Years relative to pivot year (t=0)";

  const layout = {
    margin: { t: 16, r: 16, b: 50, l: 72 },
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
      domain: [0, 1],
      anchor: `y${axisNum}`,
      showgrid: true,
      gridcolor: "#f0f0f0",
      zeroline: false,
      tickfont: { size: 10 },
      showticklabels: isBottom,
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

  Plotly.react(el, traces, layout, _config());
}

// Let chart.js access countries metadata for labels
let _currentCountriesMeta = null;
export function setCountriesMeta(meta) {
  _currentCountriesMeta = meta;
}

// ── Shared layout ──────────────────────────────────────────────────────────────

function _baseLayout(appState, rawUnit, rawMetricLabel = "") {
  const xTitle =
    appState.xMode === "absolute"
      ? "Year"
      : appState.xMode === "aligned"
      ? "Years relative to regime change (t=0)"
      : "Years relative to pivot year (t=0)";

  const hasRaw = rawUnit !== undefined && rawUnit !== null;

  const layout = {
    margin: { t: 16, r: hasRaw ? 72 : 16, b: 60, l: 56 },
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
    },
    yaxis: {
      title: { text: "Score (0–100)", font: { size: 11 }, standoff: 6 },
      range: [0, 105],
      showgrid: true,
      gridcolor: "#f0f0f0",
      zeroline: false,
      tickfont: { size: 10 },
    },
    shapes: [],
    autosize: true,
  };

  if (hasRaw) {
    const y2Title = rawMetricLabel
      ? `${rawMetricLabel}${rawUnit ? ` (${rawUnit.replace(/_/g, " ")})` : ""}`
      : rawUnit || "Raw value";
    layout.yaxis2 = {
      title: { text: y2Title, font: { size: 11 }, standoff: 6 },
      overlaying: "y",
      side: "right",
      showgrid: false,
      zeroline: false,
      tickfont: { size: 10 },
      autorange: true,
    };
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

// ── Reset color/dash maps (call when state changes significantly) ───────────────
export function resetColorMap() {
  _colorMap = {};
  _dashMap = {};
}

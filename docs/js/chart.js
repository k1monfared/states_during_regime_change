/**
 * chart.js — Plotly wrapper for overlay and stacked chart modes
 *
 * Uses Plotly.react() for efficient diff-updates.
 */

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

function buildHoverTemplate(countryLabel, metricLabel, xMode) {
  const xLabel = xMode === "absolute" ? "%{x}" : "t=%{x}";
  return `<b>${countryLabel}</b> ${xLabel}<br>${metricLabel}: %{y:.1f}<extra></extra>`;
}

/**
 * render(seriesList, appState)
 * seriesList: output of getAllCountrySeries()
 * appState: current state snapshot
 */
export function render(seriesList, appState) {
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
    _renderStacked(el, seriesList, appState);
  } else {
    _renderOverlay(el, seriesList, appState);
  }
}

// ── Overlay mode ───────────────────────────────────────────────────────────────

function _renderOverlay(el, seriesList, appState) {
  const traces = [];
  const annotations = [];
  const seenRC = new Set(); // avoid duplicate RC line labels

  // Collect unique countries for RC annotations
  const countriesInOrder = appState.countryOrder.filter((c) =>
    appState.countries.includes(c)
  );

  for (const s of seriesList) {
    const color = getColor(s.countryId, _colorMap);
    const dash = appState.metrics.length > 1 ? getDash(s.metricId) : "solid";
    const multiMetric = appState.metrics.length > 1;
    const multiCountry = appState.countries.length > 1;

    let name;
    if (multiMetric && multiCountry) {
      name = `${s.countryLabel} — ${s.metricLabel}`;
    } else if (multiMetric) {
      name = s.metricLabel;
    } else {
      name = s.countryLabel;
    }

    traces.push({
      x: s.points.map((p) => p.x),
      y: s.points.map((p) => p.y),
      type: "scatter",
      mode: "lines",
      name,
      line: { color, dash, width: 1.8 },
      hovertemplate: buildHoverTemplate(s.countryLabel, s.metricLabel, appState.xMode),
    });
  }

  // Regime change vertical lines (overlay: one annotation set)
  if (appState.xMode !== "absolute") {
    for (const s of seriesList) {
      for (const x of s.regimeChangeXs) {
        const key = `${s.countryId}:${x}`;
        if (!seenRC.has(key)) {
          seenRC.add(key);
          annotations.push({
            type: "line",
            x0: x,
            x1: x,
            y0: 0,
            y1: 1,
            yref: "paper",
            line: {
              color: getColor(s.countryId, _colorMap),
              width: 1,
              dash: "dot",
            },
          });
        }
      }
    }
  }

  const layout = _baseLayout(appState);
  layout.shapes = annotations;
  layout.legend = { orientation: "h", y: -0.12, font: { size: 11 } };

  Plotly.react(el, traces, layout, _config());
}

// ── Stacked mode ───────────────────────────────────────────────────────────────

function _renderStacked(el, seriesList, appState) {
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
  for (let row = 0; row < N; row++) {
    const countryId = countriesInOrder[row];
    const axisNum = row === 0 ? "" : String(row + 1);
    const xAxis = `x${axisNum}`;
    const yAxis = `y${axisNum}`;

    const countrySeries = seriesList.filter((s) => s.countryId === countryId);

    for (const s of countrySeries) {
      const color = metricColorMap[s.metricId] ?? COUNTRY_COLORS[0];
      const dash = appState.metrics.length > 1 ? getDash(s.metricId) : "solid";

      traces.push({
        x: s.points.map((p) => p.x),
        y: s.points.map((p) => p.y),
        type: "scatter",
        mode: "lines",
        name: s.metricLabel,
        xaxis: xAxis,
        yaxis: yAxis,
        line: { color, dash, width: 1.8 },
        hovertemplate: buildHoverTemplate(s.countryLabel, s.metricLabel, appState.xMode),
        showlegend: row === 0, // show legend entries only once
        legendgroup: s.metricId,
      });
    }

    // Regime change lines
    const rcXs = countrySeries[0]?.regimeChangeXs ?? [];
    for (const x of rcXs) {
      shapes.push({
        type: "line",
        xref: xAxis,
        yref: `${yAxis} domain`,
        x0: x, x1: x, y0: 0, y1: 1,
        line: { color: "#aaa", width: 1, dash: "dot" },
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
    shapes,
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

function _baseLayout(appState) {
  const xTitle =
    appState.xMode === "absolute"
      ? "Year"
      : appState.xMode === "aligned"
      ? "Years relative to regime change (t=0)"
      : "Years relative to pivot year (t=0)";

  return {
    margin: { t: 16, r: 16, b: 60, l: 56 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { family: "-apple-system, 'Inter', system-ui, sans-serif", size: 12 },
    hovermode: "closest",
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

/**
 * renderer.js — SVG fretboard renderer.
 *
 * Draws a guitar fretboard as inline SVG and marks note positions with
 * coloured dots, labelled by chord/scale degree.
 *
 * This module is purely presentational — it receives pre-computed position
 * data from fretboard.js and display metadata from theory.js.
 * It has no music theory knowledge of its own.
 */

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const DEFAULTS = {
  maxFret:       12,
  stringCount:   6,
  // SVG geometry
  marginTop:     40,    // space above nut for string labels
  marginLeft:    48,    // space left of nut for open-string dots
  marginRight:   24,
  marginBottom:  32,
  fretWidth:     56,    // px per fret
  stringSpacing: 28,    // px between strings
  dotRadius:     11,
  nutWidth:      6,
  fretLineWidth: 1.5,
  stringLineWidth: 1.2,
  openDotRadius: 9,
  // Colours — one per degree index (up to 9, wraps)
  degreeColors: [
    '#e74c3c',   // 0 — root (red)
    '#2980b9',   // 1 — 2nd / minor 3rd (blue)
    '#27ae60',   // 2 — 3rd / major 3rd (green)
    '#8e44ad',   // 3 — 4th / 4th (purple)
    '#f39c12',   // 4 — 5th (amber)
    '#16a085',   // 5 — 6th (teal)
    '#d35400',   // 6 — 7th (burnt orange)
    '#2c3e50',   // 7 — 8th (dark)
    '#c0392b',   // 8
    '#1abc9c',   // 9
  ],
  fretboardColor:  '#f5e6c8',
  fretColor:       '#8b7355',
  stringColor:     '#4a3728',
  nutColor:        '#2c1810',
  markerColor:     '#d4b896',    // fret marker dots (inlays)
  labelColor:      '#ffffff',
  openLabelColor:  '#ffffff',
  mutedColor:      '#bbb',
};

// Standard fret markers (inlay positions on a real guitar)
const INLAY_FRETS = [3, 5, 7, 9, 12];
const DOUBLE_INLAY_FRET = 12;

// ---------------------------------------------------------------------------
// Core renderer
// ---------------------------------------------------------------------------

/**
 * Render a fretboard SVG into the given container element.
 *
 * @param {HTMLElement} container - Element to render into (existing SVG is replaced)
 * @param {Array}  positions      - From fretboard.findPositions() or similar
 * @param {string[]} degreeLabels - Label for each degree index, e.g. ['1','3','5']
 * @param {object} opts           - Override any DEFAULTS key
 *
 * positions entries: { string, fret, pc, degreeIndex }
 *   string:      1-indexed, 1 = lowest (fat E)
 *   fret:        0 = open string
 *   degreeIndex: index into degreeLabels and degreeColors
 */
export function renderFretboard(container, positions, degreeLabels = [], opts = {}) {
  const cfg = Object.assign({}, DEFAULTS, opts);

  const fretCount  = cfg.maxFret;
  const strCount   = cfg.stringCount;

  const boardWidth  = fretCount * cfg.fretWidth;
  const boardHeight = (strCount - 1) * cfg.stringSpacing;

  const svgWidth  = cfg.marginLeft + boardWidth + cfg.marginRight;
  const svgHeight = cfg.marginTop + boardHeight + cfg.marginBottom;

  const svg = createSVG(svgWidth, svgHeight);

  // ---- Background ----
  rect(svg, 0, 0, svgWidth, svgHeight, { fill: 'transparent' });

  // ---- Fretboard body ----
  rect(svg, cfg.marginLeft, cfg.marginTop, boardWidth, boardHeight, {
    fill: cfg.fretboardColor,
    rx: 2,
  });

  // ---- Fret inlay markers ----
  INLAY_FRETS.forEach(f => {
    if (f > fretCount) return;
    const cx = cfg.marginLeft + (f - 0.5) * cfg.fretWidth;
    if (f === DOUBLE_INLAY_FRET) {
      // Double dot at 12th
      const y1 = cfg.marginTop + cfg.stringSpacing;
      const y2 = cfg.marginTop + boardHeight - cfg.stringSpacing;
      circle(svg, cx, y1, 5, { fill: cfg.markerColor });
      circle(svg, cx, y2, 5, { fill: cfg.markerColor });
    } else {
      const cy = cfg.marginTop + boardHeight / 2;
      circle(svg, cx, cy, 5, { fill: cfg.markerColor });
    }
  });

  // ---- Fret lines ----
  for (let f = 1; f <= fretCount; f++) {
    const x = cfg.marginLeft + f * cfg.fretWidth;
    line(svg, x, cfg.marginTop, x, cfg.marginTop + boardHeight, {
      stroke: cfg.fretColor,
      'stroke-width': cfg.fretLineWidth,
    });
  }

  // ---- Nut ----
  rect(svg, cfg.marginLeft - cfg.nutWidth / 2, cfg.marginTop - 2,
       cfg.nutWidth, boardHeight + 4, { fill: cfg.nutColor, rx: 1 });

  // ---- Strings ----
  for (let s = 0; s < strCount; s++) {
    // String 1 (lowest/thickest) is drawn at the bottom
    const y = cfg.marginTop + (strCount - 1 - s) * cfg.stringSpacing;
    // Thickness: thicker for lower strings
    const thickness = 0.6 + ((strCount - 1 - s) / (strCount - 1)) * 2.0;
    line(svg, cfg.marginLeft, y, cfg.marginLeft + boardWidth, y, {
      stroke: cfg.stringColor,
      'stroke-width': thickness,
    });
  }

  // ---- Fret number labels ----
  for (let f = 1; f <= fretCount; f++) {
    const x = cfg.marginLeft + (f - 0.5) * cfg.fretWidth;
    const y = cfg.marginTop + boardHeight + 20;
    text(svg, x, y, String(f), {
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': '11',
      'font-family': 'monospace',
      fill: '#888',
    });
  }

  // ---- Group positions by string ----
  // Build a set of open-string positions (fret === 0) and fretted positions
  const openByString   = new Map();
  const frettedByFret  = [];

  positions.forEach(pos => {
    if (pos.fret === 0) {
      // Multiple open notes on same string: keep; unlikely but handle gracefully
      if (!openByString.has(pos.string)) openByString.set(pos.string, []);
      openByString.get(pos.string).push(pos);
    } else {
      frettedByFret.push(pos);
    }
  });

  // ---- Draw open-string dots (left of nut) ----
  openByString.forEach((posList, strNum) => {
    const y  = cfg.marginTop + (strCount - strNum) * cfg.stringSpacing;
    const x  = cfg.marginLeft - cfg.nutWidth - cfg.openDotRadius - 4;
    const pos = posList[0]; // draw first; show label
    const color = degreeColor(pos.degreeIndex, cfg);
    circle(svg, x, y, cfg.openDotRadius, { fill: color, stroke: '#fff', 'stroke-width': 1.5 });
    const label = degreeLabels[pos.degreeIndex] ?? '';
    text(svg, x, y, label, {
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': '10',
      'font-family': 'sans-serif',
      'font-weight': 'bold',
      fill: cfg.openLabelColor,
    });
  });

  // ---- Draw fretted dots ----
  frettedByFret.forEach(pos => {
    const x = cfg.marginLeft + (pos.fret - 0.5) * cfg.fretWidth;
    const y = cfg.marginTop + (strCount - pos.string) * cfg.stringSpacing;
    const color = degreeColor(pos.degreeIndex, cfg);
    circle(svg, x, y, cfg.dotRadius, { fill: color, stroke: '#fff', 'stroke-width': 1.5 });
    const label = degreeLabels[pos.degreeIndex] ?? '';
    text(svg, x, y, label, {
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': '11',
      'font-family': 'sans-serif',
      'font-weight': 'bold',
      fill: cfg.labelColor,
    });
  });

  // ---- Replace container contents ----
  container.innerHTML = '';
  container.appendChild(svg);
}

// ---------------------------------------------------------------------------
// Legend renderer
// ---------------------------------------------------------------------------

/**
 * Render a degree legend (coloured swatches + labels) into a container.
 *
 * @param {HTMLElement} container
 * @param {string[]} degreeLabels  - e.g. ['1','3','5'] or ['R','b3','5','b7']
 * @param {string[]} noteNames     - actual note names for each degree, e.g. ['C','E','G']
 * @param {object}   opts          - override DEFAULTS
 */
export function renderLegend(container, degreeLabels, noteNames = [], opts = {}) {
  const cfg = Object.assign({}, DEFAULTS, opts);
  container.innerHTML = '';

  degreeLabels.forEach((label, i) => {
    const item = document.createElement('span');
    item.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = degreeColor(i, cfg);

    const lbl = document.createElement('span');
    lbl.className = 'legend-label';
    lbl.textContent = noteNames[i] ? `${label} (${noteNames[i]})` : label;

    item.appendChild(swatch);
    item.appendChild(lbl);
    container.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function createSVG(width, height) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('width', width);
  el.setAttribute('height', height);
  el.setAttribute('viewBox', `0 0 ${width} ${height}`);
  el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return el;
}

function setAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function rect(parent, x, y, w, h, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  setAttrs(el, { x, y, width: w, height: h, ...attrs });
  parent.appendChild(el);
  return el;
}

function circle(parent, cx, cy, r, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  setAttrs(el, { cx, cy, r, ...attrs });
  parent.appendChild(el);
  return el;
}

function line(parent, x1, y1, x2, y2, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  setAttrs(el, { x1, y1, x2, y2, ...attrs });
  parent.appendChild(el);
  return el;
}

function text(parent, x, y, content, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  setAttrs(el, { x, y, ...attrs });
  el.textContent = content;
  parent.appendChild(el);
  return el;
}

function degreeColor(index, cfg) {
  return cfg.degreeColors[index % cfg.degreeColors.length];
}

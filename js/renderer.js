/**
 * renderer.js — SVG fretboard renderer. Purely presentational.
 */

const DEFAULTS = {
  maxFret:         12,
  stringCount:     6,
  marginTop:       40,
  marginLeft:      60,
  marginRight:     28,
  marginBottom:    32,
  fretWidth:       56,
  stringSpacing:   28,
  dotRadius:       11,
  nutWidth:        6,
  fretLineWidth:   1.5,
  openDotRadius:   10,
  degreeColors: [
    '#e74c3c', '#2980b9', '#27ae60', '#8e44ad', '#f39c12',
    '#16a085', '#d35400', '#2c3e50', '#c0392b', '#1abc9c',
  ],
  fretboardColor: '#f5e6c8',
  fretColor:      '#8b7355',
  stringColor:    '#4a3728',
  nutColor:       '#2c1810',
  markerColor:    '#d4b896',
  labelColor:     '#ffffff',
};

const INLAY_FRETS       = [3, 5, 7, 9, 12];
const DOUBLE_INLAY_FRET = 12;

// Y coordinate for string at 0-indexed s (s=0 → lowest → bottom of board)
function stringY(s, strCount, cfg) {
  return cfg.marginTop + (strCount - 1 - s) * cfg.stringSpacing;
}

function degreeColor(index, cfg) {
  return cfg.degreeColors[index % cfg.degreeColors.length];
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function ns(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function attrs(el, map) {
  for (const [k, v] of Object.entries(map)) el.setAttribute(k, v);
  return el;
}

function svgRect(parent, x, y, w, h, extra = {}) {
  parent.appendChild(attrs(ns('rect'), { x, y, width: w, height: h, ...extra }));
}

function svgCircle(parent, cx, cy, r, extra = {}) {
  parent.appendChild(attrs(ns('circle'), { cx, cy, r, ...extra }));
}

function svgLine(parent, x1, y1, x2, y2, extra = {}) {
  parent.appendChild(attrs(ns('line'), { x1, y1, x2, y2, ...extra }));
}

function svgText(parent, x, y, content, extra = {}) {
  const el = attrs(ns('text'), { x, y, ...extra });
  el.textContent = content;
  parent.appendChild(el);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderFretboard(container, positions, degreeLabels = [], opts = {}) {
  const cfg = Object.assign({}, DEFAULTS, opts);

  const strCount    = cfg.stringCount;
  const fretCount   = cfg.maxFret;
  const boardWidth  = fretCount * cfg.fretWidth;
  const boardHeight = (strCount - 1) * cfg.stringSpacing;
  const svgW        = cfg.marginLeft + boardWidth + cfg.marginRight;
  const svgH        = cfg.marginTop  + boardHeight + cfg.marginBottom;

  const svg = attrs(ns('svg'), {
    viewBox: `0 0 ${svgW} ${svgH}`,
    width:   svgW,    // explicit attrs prevent height-collapse in some browsers
    height:  svgH,
    preserveAspectRatio: 'xMidYMid meet',
  });

  // Fretboard body
  svgRect(svg, cfg.marginLeft, cfg.marginTop, boardWidth, boardHeight,
    { fill: cfg.fretboardColor, rx: 2 });

  // Inlay markers
  INLAY_FRETS.forEach(f => {
    if (f > fretCount) return;
    const cx = cfg.marginLeft + (f - 0.5) * cfg.fretWidth;
    if (f === DOUBLE_INLAY_FRET) {
      svgCircle(svg, cx, cfg.marginTop + cfg.stringSpacing,               5, { fill: cfg.markerColor });
      svgCircle(svg, cx, cfg.marginTop + boardHeight - cfg.stringSpacing, 5, { fill: cfg.markerColor });
    } else {
      svgCircle(svg, cx, cfg.marginTop + boardHeight / 2, 5, { fill: cfg.markerColor });
    }
  });

  // Fret lines
  for (let f = 1; f <= fretCount; f++) {
    const x = cfg.marginLeft + f * cfg.fretWidth;
    svgLine(svg, x, cfg.marginTop, x, cfg.marginTop + boardHeight,
      { stroke: cfg.fretColor, 'stroke-width': cfg.fretLineWidth });
  }

  // Nut
  svgRect(svg,
    cfg.marginLeft - cfg.nutWidth / 2, cfg.marginTop - 2,
    cfg.nutWidth, boardHeight + 4,
    { fill: cfg.nutColor, rx: 1 });

  // Strings (s=0 → string 1 lowest, drawn at bottom)
  for (let s = 0; s < strCount; s++) {
    const y         = stringY(s, strCount, cfg);
    const thickness = 0.6 + ((strCount - 1 - s) / (strCount - 1)) * 2.0;
    svgLine(svg, cfg.marginLeft, y, cfg.marginLeft + boardWidth, y,
      { stroke: cfg.stringColor, 'stroke-width': thickness });
  }

  // Fret number labels
  for (let f = 1; f <= fretCount; f++) {
    svgText(svg,
      cfg.marginLeft + (f - 0.5) * cfg.fretWidth,
      cfg.marginTop + boardHeight + 20,
      String(f),
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '11', 'font-family': 'monospace', fill: '#888' });
  }

  // Separate open-string from fretted positions
  const openByString = new Map();
  const fretted      = [];
  positions.forEach(pos => {
    if (pos.fret === 0) {
      if (!openByString.has(pos.string)) openByString.set(pos.string, pos);
    } else {
      fretted.push(pos);
    }
  });

  // activeKeys: Set of "string:fret" strings marking the selected voicing.
  // Active positions receive a gold highlight ring drawn behind the dot.
  const activeKeys = cfg.activeKeys instanceof Set ? cfg.activeKeys : new Set();
  const activeRingColor = cfg.activeRingColor ?? '#f5a623';

  // Open-string dots (left of nut)
  openByString.forEach((pos, strNum) => {
    const x      = cfg.marginLeft - cfg.nutWidth - cfg.openDotRadius - 4;
    const y      = stringY(strNum - 1, strCount, cfg);
    const color  = degreeColor(pos.degreeIndex, cfg);
    const active = activeKeys.has(`${pos.string}:${pos.fret}`);
    if (active) {
      svgCircle(svg, x, y, cfg.openDotRadius + 5,
        { fill: 'none', stroke: activeRingColor, 'stroke-width': 2.5 });
    }
    svgCircle(svg, x, y, cfg.openDotRadius,
      { fill: color, stroke: '#fff', 'stroke-width': 1.5 });
    svgText(svg, x, y, degreeLabels[pos.degreeIndex] ?? '',
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '10', 'font-family': 'sans-serif', 'font-weight': 'bold',
        fill: cfg.labelColor });
  });

  // Fretted dots
  fretted.forEach(pos => {
    const x      = cfg.marginLeft + (pos.fret - 0.5) * cfg.fretWidth;
    const y      = stringY(pos.string - 1, strCount, cfg);
    const color  = degreeColor(pos.degreeIndex, cfg);
    const active = activeKeys.has(`${pos.string}:${pos.fret}`);
    if (active) {
      svgCircle(svg, x, y, cfg.dotRadius + 5,
        { fill: 'none', stroke: activeRingColor, 'stroke-width': 2.5 });
    }
    svgCircle(svg, x, y, cfg.dotRadius,
      { fill: color, stroke: '#fff', 'stroke-width': 1.5 });
    svgText(svg, x, y, degreeLabels[pos.degreeIndex] ?? '',
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '11', 'font-family': 'sans-serif', 'font-weight': 'bold',
        fill: cfg.labelColor });
  });

  container.innerHTML = '';
  container.appendChild(svg);
}

/**
 * Render a compact horizontal mini-fretboard for a single chord voicing.
 * Matches the orientation of the main fretboard: low E at bottom, nut on
 * the left, higher frets to the right.
 *
 * voicing      — array of 6 items (strIdx 0 = low E), null = muted.
 * degreeLabels — e.g. ['1','3','5']
 */
export function renderChordDiagram(container, voicing, degreeLabels = [], opts = {}) {
  const cfg = Object.assign({}, DEFAULTS, opts);

  const STRINGS = 6;
  const FRETS   = 4;           // fret slots shown
  const FW      = 26;          // pixels per fret (horizontal)
  const SS      = 11;          // pixels per string (vertical) — compact so card stays short
  const DR      = 6;           // note dot radius
  const NW      = 4;           // nut width

  const mTop    = 6;           // above top string
  const mLeft   = 18;          // left of nut (for × / open-string symbols)
  const mRight  = 5;
  const mBottom = 14;          // below bottom string (fret label)

  const boardW  = FRETS * FW;
  const boardH  = (STRINGS - 1) * SS;
  const svgW    = mLeft + boardW + mRight;
  const svgH    = mTop  + boardH + mBottom;

  // String y: strIdx 0 (low E) at BOTTOM, strIdx 5 (high e) at TOP
  const strY = s => mTop + (STRINGS - 1 - s) * SS;

  // Min fretted note → determines left edge of the diagram window
  let minFret = Infinity;
  for (const v of voicing) {
    if (v !== null && v.fret > 0 && v.fret < minFret) minFret = v.fret;
  }
  if (minFret === Infinity) minFret = 0;
  const isOpen = minFret <= 1;   // nut visible; fret 0 = open strings

  const svg = attrs(ns('svg'), {
    viewBox: `0 0 ${svgW} ${svgH}`,
    preserveAspectRatio: 'xMidYMid meet',
  });

  // Fretboard body
  svgRect(svg, mLeft, mTop, boardW, boardH,
    { fill: cfg.fretboardColor, rx: 1 });

  // Nut (thick bar) when in open position, otherwise thin left edge
  if (isOpen) {
    svgRect(svg, mLeft - NW / 2, mTop - 1, NW, boardH + 2,
      { fill: cfg.nutColor, rx: 1 });
  } else {
    svgLine(svg, mLeft, mTop, mLeft, mTop + boardH,
      { stroke: cfg.fretColor, 'stroke-width': 1.5 });
  }

  // Vertical fret lines
  for (let f = 1; f <= FRETS; f++) {
    const x = mLeft + f * FW;
    svgLine(svg, x, mTop, x, mTop + boardH,
      { stroke: cfg.fretColor, 'stroke-width': 1.5 });
  }

  // Horizontal string lines (low E = bottom = thickest)
  for (let s = 0; s < STRINGS; s++) {
    const y         = strY(s);
    const thickness = 0.5 + ((STRINGS - 1 - s) / (STRINGS - 1)) * 1.6;
    svgLine(svg, mLeft, y, mLeft + boardW, y,
      { stroke: cfg.stringColor, 'stroke-width': thickness });
  }

  // Position label below the board when not open position
  if (!isOpen) {
    svgText(svg, mLeft + FW * 0.5, mTop + boardH + 11, `${minFret}fr`,
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '9', 'font-family': 'monospace', fill: '#888' });
  }

  // Left-of-nut symbols: × for muted, coloured dot for open string
  voicing.forEach((v, strIdx) => {
    const x = mLeft - 10;
    const y = strY(strIdx);
    if (v === null) {
      svgText(svg, x, y, '×',
        { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': '11', 'font-family': 'sans-serif', fill: '#777' });
    } else if (v.fret === 0) {
      const color = degreeColor(v.degreeIndex, cfg);
      svgCircle(svg, x, y, 6, { fill: color, stroke: '#fff', 'stroke-width': 1.2 });
      svgText(svg, x, y, degreeLabels[v.degreeIndex] ?? '',
        { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': '7', 'font-family': 'sans-serif', 'font-weight': 'bold',
          fill: cfg.labelColor });
    }
  });

  // Fretted note dots
  voicing.forEach((v, strIdx) => {
    if (v === null || v.fret === 0) return;
    const fretPos = v.fret - minFret;              // 0-indexed from left edge
    const x       = mLeft + (fretPos + 0.5) * FW;
    const y       = strY(strIdx);
    const color   = degreeColor(v.degreeIndex, cfg);
    svgCircle(svg, x, y, DR, { fill: color, stroke: '#fff', 'stroke-width': 1.5 });
    svgText(svg, x, y, degreeLabels[v.degreeIndex] ?? '',
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '8', 'font-family': 'sans-serif', 'font-weight': 'bold',
        fill: cfg.labelColor });
  });

  container.innerHTML = '';
  container.appendChild(svg);
}

export function renderLegend(container, degreeLabels, noteNames = [], opts = {}) {
  const cfg = Object.assign({}, DEFAULTS, opts);
  container.innerHTML = '';
  degreeLabels.forEach((label, i) => {
    const item   = document.createElement('span');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className     = 'legend-swatch';
    swatch.style.background = degreeColor(i, cfg);
    const lbl  = document.createElement('span');
    lbl.className   = 'legend-label';
    lbl.textContent = noteNames[i] ? `${label} (${noteNames[i]})` : label;
    item.appendChild(swatch);
    item.appendChild(lbl);
    container.appendChild(item);
  });
}

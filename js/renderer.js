/**
 * renderer.js — SVG fretboard renderer. Purely presentational.
 */

const DEFAULTS = {
  maxFret:         12,
  stringCount:     6,
  marginTop:       40,
  marginLeft:      60,
  marginRight:     28,
  marginBottom:    56,
  fretWidth:       56,
  stringSpacing:   40,
  dotRadius:       11,
  nutWidth:        6,
  fretLineWidth:   1.5,
  openDotRadius:   10,
  // Root note (index 0) filled red; all other degrees transparent/background.
  degreeColors: [
    '#e74c3c',
    '#f5e6c8', '#f5e6c8', '#f5e6c8', '#f5e6c8',
    '#f5e6c8', '#f5e6c8', '#f5e6c8', '#f5e6c8', '#f5e6c8',
  ],
  fretboardColor: '#f5e6c8',
  fretColor:      '#8b7355',
  stringColor:    '#4a3728',
  nutColor:       '#2c1810',
  markerColor:    '#d4b896',
  labelColor:     '#000000',
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
      // Place dots midway between adjacent string pairs, not at string lines
      svgCircle(svg, cx, cfg.marginTop + 1.5 * cfg.stringSpacing,               5, { fill: cfg.markerColor });
      svgCircle(svg, cx, cfg.marginTop + boardHeight - 1.5 * cfg.stringSpacing, 5, { fill: cfg.markerColor });
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
      cfg.marginTop + boardHeight + Math.round(cfg.marginBottom / 2),
      String(f),
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '11', 'font-family': 'monospace', fill: '#555' });
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
  const activeKeys      = cfg.activeKeys instanceof Set ? cfg.activeKeys : new Set();
  const activeRingColor = cfg.activeRingColor ?? '#000000';

  // Open-string dots (left of nut)
  openByString.forEach((pos, strNum) => {
    const x      = cfg.marginLeft - cfg.nutWidth - cfg.openDotRadius - 4;
    const y      = stringY(strNum - 1, strCount, cfg);
    const color  = degreeColor(pos.degreeIndex, cfg);
    const active = activeKeys.has(`${pos.string}:${pos.fret}`);
    if (active) {
      // Disc at ring-centre radius: occludes string between dot and ring, no gap outside
      svgCircle(svg, x, y, cfg.openDotRadius + 5,
        { fill: cfg.fretboardColor, stroke: 'none' });
      svgCircle(svg, x, y, cfg.openDotRadius + 5,
        { fill: 'none', stroke: activeRingColor, 'stroke-width': 2.5 });
    }
    svgCircle(svg, x, y, cfg.openDotRadius,
      { fill: color, stroke: '#000', 'stroke-width': 1.5 });
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
      // Disc at ring-centre radius: occludes string between dot and ring, no gap outside
      svgCircle(svg, x, y, cfg.dotRadius + 5,
        { fill: cfg.fretboardColor, stroke: 'none' });
      svgCircle(svg, x, y, cfg.dotRadius + 5,
        { fill: 'none', stroke: activeRingColor, 'stroke-width': 2.5 });
    }
    svgCircle(svg, x, y, cfg.dotRadius,
      { fill: color, stroke: '#000', 'stroke-width': 1.5 });
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
  const FW      = 28;          // pixels per fret (horizontal)
  const SS      = 17;          // string spacing — must be > 2×DR to avoid overlap
  const DR      = 7;           // note dot radius
  const NW      = 5;           // nut width

  const mTop    = 20;          // above top string
  const mRight  = 6;
  const mBottom = 30;          // below bottom string for fret label

  // When a fingering is provided, reserve a column on the left for finger-number
  // badges (one per string), push the existing ×/open symbols to the right.
  const fingering = opts.fingering ?? null;
  const FCOL_W  = fingering ? 16 : 0;  // width of the finger-number column
  const mLeft   = 22 + FCOL_W;         // left margin for ×/open symbols

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

  // ── Fretboard body ────────────────────────────────────────────────────────
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

  // ── Barre bar inscribed in the fret ──────────────────────────────────────
  // Drawn after string lines so it sits over them, before note dots so dots
  // remain on top.  The barre is always at minFret (fretPos 0).
  //
  // The top of the bar always reaches the high e string (strIdx STRINGS-1)
  // regardless of barre.toString — the index finger physically covers all
  // strings from fromString up to high e even when higher-pitched strings are
  // pressed by other fingers at frets above the barre.
  // (The only exception would be a note on high e BELOW the barre fret, but
  // that cannot arise because the barre is always detected at minFret.)
  if (fingering?.barre) {
    const { fromString } = fingering.barre;
    const bx   = mLeft + 0.5 * FW;
    const by1  = strY(STRINGS - 1);      // always: top Y = high e
    const by2  = strY(fromString - 1);   // bottom Y = lowest barred string
    const barreColor = fingering.semi
      ? 'rgba(230,126,34,0.70)'   // amber — semi-barre warning
      : 'rgba(44,62,80,0.55)';    // dark slate — clean barre
    svgRect(svg, bx - 5, by1, 10, by2 - by1, { fill: barreColor, rx: 5 });
  }

  // Position label below the board when not open position
  if (!isOpen) {
    svgText(svg, mLeft + FW * 0.5, mTop + boardH + 20, `${minFret}fr`,
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '9', 'font-family': 'monospace', fill: '#000' });
  }

  // ── Left-of-nut symbols: × for muted, coloured dot for open string ─────────
  voicing.forEach((v, strIdx) => {
    const x = mLeft - 10;
    const y = strY(strIdx);
    if (v === null) {
      svgText(svg, x, y, '×',
        { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': '11', 'font-family': 'sans-serif', fill: '#000' });
    } else if (v.fret === 0) {
      const color = degreeColor(v.degreeIndex, cfg);
      svgCircle(svg, x, y, 6, { fill: color, stroke: '#000', 'stroke-width': 1.2 });
      svgText(svg, x, y, degreeLabels[v.degreeIndex] ?? '',
        { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': '7', 'font-family': 'sans-serif', 'font-weight': 'bold',
          fill: cfg.labelColor });
    }
  });

  // ── Fretted note dots ─────────────────────────────────────────────────────
  voicing.forEach((v, strIdx) => {
    if (v === null || v.fret === 0) return;
    const fretPos = v.fret - minFret;
    const x       = mLeft + (fretPos + 0.5) * FW;
    const y       = strY(strIdx);
    const color   = degreeColor(v.degreeIndex, cfg);
    svgCircle(svg, x, y, DR, { fill: color, stroke: '#000', 'stroke-width': 1.5 });
    svgText(svg, x, y, degreeLabels[v.degreeIndex] ?? '',
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '8', 'font-family': 'sans-serif', 'font-weight': 'bold',
        fill: cfg.labelColor });
  });

  // ── Fingering overlays ────────────────────────────────────────────────────
  if (fingering) {
    const badgeColorFor = f =>
      f === '?' ? '#e74c3c' :   // impossible — red
      f === 'T' ? '#8e44ad' :   // thumb       — purple
      '#2c3e50';                 // 1–4         — dark slate

    const COL_X = FCOL_W / 2;   // centre of the finger-number column

    // ── Left column badges ────────────────────────────────────────────────
    // One badge per non-muted string aligned to its string Y.
    // Fretted notes → finger number; open strings → 'o'; muted → nothing.
    voicing.forEach((v, strIdx) => {
      const f = fingering.fingers[strIdx];
      if (f === null) return;    // muted — already shown by ×

      const cy    = strY(strIdx);
      const label = f === 0 ? 'o' : String(f);
      const bc    = f === 0 ? '#777' : badgeColorFor(f);
      svgCircle(svg, COL_X, cy, 5.5, { fill: bc, stroke: '#fff', 'stroke-width': 0.8 });
      svgText(svg, COL_X, cy, label,
        { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': '6.5', 'font-family': 'monospace', 'font-weight': 'bold',
          fill: '#fff' });
    });

    // ── C: Difficulty badge — top-right corner ───────────────────────────────
    const diffColor = fingering.difficulty <= 2 ? '#27ae60'
                    : fingering.difficulty <= 3  ? '#e67e22'
                    : '#e74c3c';
    const diffLabel = fingering.impossible ? '!' : String(fingering.difficulty);
    const dx = svgW - 7;
    const dy = 9;
    svgCircle(svg, dx, dy, 6.5, { fill: diffColor });
    svgText(svg, dx, dy, diffLabel,
      { 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '7', 'font-family': 'monospace', 'font-weight': 'bold',
        fill: '#fff' });
  }

  container.innerHTML = '';
  container.appendChild(svg);
}

/**
 * Render a compact horizontal mini-fretboard for one scale box position.
 * Low E at bottom.  When the window starts at fret 0 (open position):
 *   – a nut is drawn and open-string notes (fret 0) appear to its LEFT,
 *     so they are visually distinct from fret-1 notes (which appear in the
 *     first slot after the nut).
 * For all other positions a fret-number label is shown at the bottom-left.
 * Every note dot shows its scale degree number (1–7 etc.).
 */
export function renderScaleDiagram(container, notes, windowStart, windowSize) {
  const cfg = DEFAULTS;

  const STRINGS = 6;
  const FW      = 26;    // pixels per fret slot
  const SS      = 17;    // pixels per string
  const DR      = 6.5;   // dot radius (large enough for a digit)
  const NW      = 5;     // nut width
  const mTop    = 8;
  const mLeft   = 10;
  const mRight  = 8;
  const mBottom = 22;

  // When the window includes fret 0 we need an extra column to the left of
  // the nut so that open-string dots don't sit in the "fret 1" slot.
  const hasOpen  = (windowStart === 0);
  const openW    = hasOpen ? FW : 0;    // extra width for the open-string column
  // Number of fretted columns = span excluding fret 0 when hasOpen
  const FRETS    = hasOpen ? (windowSize - 1) : windowSize;
  const boardBgX = mLeft + openW;       // x where the fretted board starts (= nut x)
  const boardW   = FRETS * FW;
  const boardH   = (STRINGS - 1) * SS;
  const svgW     = mLeft + openW + boardW + mRight;
  const svgH     = mTop  + boardH + mBottom;

  // strIdx 0 = low E → bottom; strIdx 5 = high e → top
  const strY = (strIdx) => mTop + (STRINGS - 1 - strIdx) * SS;

  // noteX maps a real fret number to the horizontal centre of its slot:
  //   hasOpen  → fret 0 is in the open column (left of nut),
  //              fret 1 is in the first fretted slot (right of nut), etc.
  //   !hasOpen → fret windowStart is in slot 0, windowStart+1 in slot 1, …
  const noteX = (fret) =>
    hasOpen
      ? mLeft + (fret + 0.5) * FW          // fret 0 → mLeft+½FW; fret 1 → mLeft+1½FW
      : mLeft + (fret - windowStart + 0.5) * FW;

  const svg = attrs(ns('svg'), {
    viewBox: `0 0 ${svgW} ${svgH}`,
    width: svgW, height: svgH,
    preserveAspectRatio: 'xMidYMid meet',
  });

  // Background covers the full content area (open column + fretted board)
  svgRect(svg, mLeft, mTop, openW + boardW, boardH, { fill: cfg.fretboardColor });

  // Nut (open positions) or left boundary line
  if (hasOpen) {
    svgRect(svg, boardBgX, mTop - 1, NW, boardH + 2, { fill: cfg.nutColor });
  } else if (windowStart <= 1) {
    svgRect(svg, mLeft, mTop - 1, NW, boardH + 2, { fill: cfg.nutColor });
  } else {
    svgLine(svg, mLeft, mTop, mLeft, mTop + boardH,
      { stroke: cfg.fretColor, 'stroke-width': 1.5 });
  }

  // Fret lines (vertical) — only inside the fretted board area
  for (let f = 1; f <= FRETS; f++) {
    svgLine(svg, boardBgX + f * FW, mTop, boardBgX + f * FW, mTop + boardH,
      { stroke: cfg.fretColor, 'stroke-width': 1.5 });
  }

  // String lines span the full diagram width (open column + fretted area)
  for (let s = 0; s < STRINGS; s++) {
    svgLine(svg, mLeft, strY(s), mLeft + openW + boardW, strY(s), {
      stroke:           cfg.stringColor,
      'stroke-width':   (1.8 - s * 0.22).toFixed(2),
    });
  }

  // Fret-position label — bottom-left of first fretted slot (non-open only)
  if (!hasOpen) {
    svgText(svg, mLeft + FW * 0.5, mTop + boardH + 14, `${windowStart}fr`, {
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '9', 'font-family': 'monospace', fill: '#000',
    });
  }

  // Note dots with scale-degree number inside
  notes.forEach(n => {
    const x    = noteX(n.fret);
    const y    = strY(n.string - 1);
    const fill = degreeColor(n.degreeIndex, cfg);
    svgCircle(svg, x, y, DR, { fill, stroke: '#000', 'stroke-width': 1.2 });
    svgText(svg, x, y, String(n.degreeIndex + 1), {
      'text-anchor':       'middle',
      'dominant-baseline': 'middle',
      'font-size':         '8',
      'font-family':       'sans-serif',
      'font-weight':       'bold',
      fill: n.degreeIndex === 0 ? '#fff' : '#000',
    });
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

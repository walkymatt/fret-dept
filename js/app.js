/**
 * app.js — Application entry point. Wires theory + fretboard + renderer.
 */

import {
  nameToPc, pcToName,
  getChordPitchClasses, getScalePitchClasses,
  CHORDS, CHORD_LABELS,
  SCALES, SCALE_LABELS,
  NOTE_NAMES_SHARP,
} from './theory.js';

import {
  findPositions, findVoicingsAcrossNeck, findScalePositions,
  identifyCagedShape,
  TUNINGS, TUNING_LABELS,
} from './fretboard.js';

import {
  renderFretboard, renderLegend,
  renderChordDiagram, renderScaleDiagram,
} from './renderer.js';

import { assignFingering } from './fingering.js';

const FRETBOARD_FRETS = 12;
const VOICING_FRETS   = 22;

const state = {
  mode:               'chord',
  rootName:           'C',
  chordName:          'major',
  scaleName:          'major',
  tuningKey:          'standard',
  inversion:          0,
  positionIndex:      0,   // chord voicing gallery index
  voicings:           [],  // computed in chord mode
  scalePositionIndex: 0,   // scale diagram gallery index
  scalePositions:     [],  // computed in scale mode
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useFlats() { return state.rootName.includes('b'); }

function getVoicingBassPc(voicing) {
  const played = voicing.filter(Boolean).sort((a, b) => a.string - b.string);
  return played.length ? played[0].pc : null;
}

// ---------------------------------------------------------------------------
// Core data for current state
// ---------------------------------------------------------------------------

function getChordScaleData() {
  const rootPc = nameToPc(state.rootName);
  const tuning = TUNINGS[state.tuningKey];
  let pitchClasses, degrees, displayTitle;

  if (state.mode === 'chord') {
    ({ pitchClasses, degrees } = getChordPitchClasses(rootPc, state.chordName));
    displayTitle = `${state.rootName} ${CHORD_LABELS[state.chordName]}`;
    if (state.inversion > 0 && state.inversion < pitchClasses.length) {
      const bassName = pcToName(pitchClasses[state.inversion], useFlats());
      displayTitle += ` / ${bassName}`;
    }
  } else {
    pitchClasses = getScalePitchClasses(rootPc, state.scaleName);
    degrees      = pitchClasses.map((_, i) => String(i + 1));
    displayTitle = `${state.rootName} ${SCALE_LABELS[state.scaleName]}`;
  }

  return { rootPc, tuning, pitchClasses, degrees, displayTitle };
}

// ---------------------------------------------------------------------------
// Main fretboard render
// ---------------------------------------------------------------------------

function render() {
  try {
    const { tuning, pitchClasses, degrees, displayTitle } = getChordScaleData();
    const positions = findPositions(pitchClasses, tuning, FRETBOARD_FRETS);
    const noteNames = pitchClasses.map(pc => pcToName(pc, useFlats()));

    let activeKeys;
    if (state.mode === 'chord' && state.voicings.length > 0) {
      const voicing = state.voicings[state.positionIndex]?.voicing ?? [];
      activeKeys = new Set(
        voicing.filter(Boolean).map(v => `${v.string}:${v.fret}`)
      );
    } else if (state.mode === 'scale' && state.scalePositions.length > 0) {
      const pos = state.scalePositions[state.scalePositionIndex];
      if (pos) activeKeys = new Set(pos.notes.map(n => `${n.string}:${n.fret}`));
    }

    renderFretboard(document.getElementById('fretboard'), positions, degrees,
      { maxFret: FRETBOARD_FRETS, activeKeys });
    renderLegend(document.getElementById('legend'), degrees, noteNames);
    document.getElementById('display-title').textContent = displayTitle;
  } catch (e) {
    document.getElementById('fretboard').textContent =
      'render() error: ' + e.message + ' — ' + e.stack;
    console.error('render() failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Chord: voicing gallery
// ---------------------------------------------------------------------------

/**
 * For an impossible voicing, try muting outer strings (high first, then low)
 * until the fingering becomes viable.  The muted voicing must still contain
 * every required pitch class, keep at least 3 voices, and satisfy any bass-
 * note inversion constraint.
 *
 * Returns a new 6-element voicing array, or null if nothing works.
 */
function fixImpossibleVoicing(voicing, requiredPcs, bassPc) {
  // Muting patterns: strIdx arrays, tried in order (outermost strings first).
  const patterns = [
    [5],           // mute high e
    [0],           // mute low E
    [5, 4],        // mute high e + B
    [0, 1],        // mute low E + A
    [5, 0],        // mute both extremes
    [5, 4, 0],     // mute top two + low E
    [5, 0, 1],     // mute high e + low two
    [5, 4, 3],     // mute top three
  ];

  for (const toMute of patterns) {
    const trimmed = voicing.map((v, i) => toMute.includes(i) ? null : v);
    const notes   = trimmed.filter(v => v !== null);
    if (notes.length < 3) continue;

    // All required pitch classes must still be present.
    const present = new Set(notes.map(n => n.pc));
    if (requiredPcs.some(pc => !present.has(pc))) continue;

    // Bass inversion constraint: the lowest sounding string must still carry
    // the required bass pitch class.
    if (bassPc !== null) {
      const lowest = trimmed.find(v => v !== null);   // strIdx 0 = low E = first
      if (!lowest || lowest.pc !== bassPc) continue;
    }

    const f = assignFingering(trimmed);
    if (!f.impossible) return trimmed;
  }
  return null;
}

function computeVoicings() {
  if (state.mode !== 'chord') { state.voicings = []; return; }
  const { pitchClasses, tuning } = getChordScaleData();
  const bassPc = (state.inversion > 0 && state.inversion < pitchClasses.length)
    ? pitchClasses[state.inversion] : null;
  const raw = findVoicingsAcrossNeck(pitchClasses, tuning, VOICING_FRETS, 4, bassPc);
  const seen = new Set();
  state.voicings = raw.map(v => {
    const f = assignFingering(v.voicing);
    if (!f.impossible) return v;                                 // already fine
    const fixed = fixImpossibleVoicing(v.voicing, pitchClasses, bassPc);
    if (fixed === null) return null;                             // drop it
    return { ...v, voicing: fixed, cagedShape: identifyCagedShape(fixed) }; // retag
  }).filter(Boolean).filter(v => {
    // Deduplicate: two voicings are identical when every string has the same
    // fret value (or both null).  Keep only the first occurrence.
    const key = v.voicing.map(n => n === null ? 'x' : n.fret).join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (state.positionIndex >= state.voicings.length) state.positionIndex = 0;
}

function populateInversionSelect() {
  const el = document.getElementById('sel-inversion');
  if (!el) return;
  const { pitchClasses } = getChordScaleData();
  const flat = useFlats();
  const ordinals = ['Root pos.', '1st inv.', '2nd inv.', '3rd inv.', '4th inv.'];
  el.innerHTML = '';
  pitchClasses.forEach((pc, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i === 0
      ? 'Root pos.'
      : `${ordinals[i]} (${state.rootName}/${pcToName(pc, flat)})`;
    if (i === state.inversion) opt.selected = true;
    el.appendChild(opt);
  });
}

function renderPositionNav(scrollToActive = false) {
  const navEl     = document.getElementById('position-nav');
  const galleryEl = document.getElementById('voicing-gallery');

  if (state.mode !== 'chord') {
    navEl.style.display     = 'none';
    galleryEl.style.display = 'none';
    return;
  }

  navEl.style.display     = '';
  galleryEl.style.display = '';

  const { voicings, positionIndex } = state;
  const cur = voicings[positionIndex];
  const label = cur
    ? `${cur.cagedShape ? cur.cagedShape + ' shape · ' : ''}fret ${cur.windowStart}`
    : 'No voicings found';
  document.getElementById('pos-label').textContent = label;
  document.getElementById('pos-count').textContent =
    voicings.length > 0 ? `${positionIndex + 1} / ${voicings.length}` : '';
  document.getElementById('pos-prev').disabled = positionIndex <= 0;
  document.getElementById('pos-next').disabled = positionIndex >= voicings.length - 1;

  const { degrees } = getChordScaleData();
  galleryEl.innerHTML = '';

  voicings.forEach((v, idx) => {
    const card   = document.createElement('div');
    card.className = 'voicing-card' + (idx === positionIndex ? ' active' : '');
    const diagEl = document.createElement('div');
    diagEl.className = 'voicing-diagram';
    const fingering = assignFingering(v.voicing);
    renderChordDiagram(diagEl, v.voicing, degrees, { fingering });
    const lbl = document.createElement('div');
    lbl.className   = 'voicing-card-label';
    lbl.textContent = v.cagedShape ? `${v.cagedShape}  fr${v.windowStart}` : `fr${v.windowStart}`;
    card.appendChild(diagEl);
    card.appendChild(lbl);
    card.addEventListener('click', () => {
      state.positionIndex = idx;
      render();
      renderPositionNav(true);
    });
    galleryEl.appendChild(card);
  });

  if (scrollToActive) {
    const active = galleryEl.querySelector('.voicing-card.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

// ---------------------------------------------------------------------------
// Scale: position gallery
// ---------------------------------------------------------------------------

function computeScalePositions() {
  if (state.mode !== 'scale') { state.scalePositions = []; return; }
  const { pitchClasses, tuning } = getChordScaleData();
  state.scalePositions = findScalePositions(pitchClasses, tuning, VOICING_FRETS);
  if (state.scalePositionIndex >= state.scalePositions.length) state.scalePositionIndex = 0;
}

function renderScaleNav(scrollToActive = false) {
  const navEl     = document.getElementById('scale-position-nav');
  const galleryEl = document.getElementById('scale-gallery');

  if (state.mode !== 'scale') {
    navEl.style.display     = 'none';
    galleryEl.style.display = 'none';
    return;
  }

  navEl.style.display     = '';
  galleryEl.style.display = '';

  const { scalePositions, scalePositionIndex } = state;
  const cur = scalePositions[scalePositionIndex];
  document.getElementById('scale-pos-label').textContent =
    cur ? `fret ${cur.windowStart}` : 'No positions found';
  document.getElementById('scale-pos-count').textContent =
    scalePositions.length > 0 ? `${scalePositionIndex + 1} / ${scalePositions.length}` : '';
  document.getElementById('scale-pos-prev').disabled = scalePositionIndex <= 0;
  document.getElementById('scale-pos-next').disabled =
    scalePositionIndex >= scalePositions.length - 1;

  galleryEl.innerHTML = '';
  scalePositions.forEach((pos, idx) => {
    const card   = document.createElement('div');
    card.className = 'voicing-card' + (idx === scalePositionIndex ? ' active' : '');
    const diagEl = document.createElement('div');
    diagEl.className = 'voicing-diagram';
    renderScaleDiagram(diagEl, pos.notes, pos.windowStart, pos.windowSize);
    const lbl = document.createElement('div');
    lbl.className   = 'voicing-card-label';
    lbl.textContent = `fr${pos.windowStart}`;
    card.appendChild(diagEl);
    card.appendChild(lbl);
    card.addEventListener('click', () => {
      state.scalePositionIndex = idx;
      render();         // highlights this window on main fretboard
      renderScaleNav(true);
    });
    galleryEl.appendChild(card);
  });

  if (scrollToActive) {
    const active = galleryEl.querySelector('.voicing-card.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

// ---------------------------------------------------------------------------
// Combined refresh
// ---------------------------------------------------------------------------

function fullRefresh() {
  if (state.mode === 'chord') {
    try { computeVoicings(); } catch (e) {
      console.error('computeVoicings failed:', e); state.voicings = [];
    }
    populateInversionSelect();
  } else {
    try { computeScalePositions(); } catch (e) {
      console.error('computeScalePositions failed:', e); state.scalePositions = [];
    }
  }
  render();
  setTimeout(() => { renderPositionNav(); renderScaleNav(); }, 0);
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

function populateSelect(el, entries, selected) {
  el.innerHTML = '';
  for (const [value, label] of entries) {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === selected) opt.selected = true;
    el.appendChild(opt);
  }
}

function updateModeUI() {
  const isChord = state.mode === 'chord';
  document.getElementById('chord-row').style.display      = isChord ? '' : 'none';
  document.getElementById('scale-row').style.display      = isChord ? 'none' : '';
  document.getElementById('inversion-row').style.display  = isChord ? '' : 'none';
}

function init() {
  const elMode      = document.getElementById('sel-mode');
  const elRoot      = document.getElementById('sel-root');
  const elChord     = document.getElementById('sel-chord');
  const elScale     = document.getElementById('sel-scale');
  const elTuning    = document.getElementById('sel-tuning');
  const elInversion = document.getElementById('sel-inversion');

  populateSelect(elRoot,   NOTE_NAMES_SHARP.map(n => [n, n]),                   state.rootName);
  populateSelect(elChord,  Object.keys(CHORDS).map(k  => [k, CHORD_LABELS[k]]), state.chordName);
  populateSelect(elScale,  Object.keys(SCALES).map(k  => [k, SCALE_LABELS[k]]), state.scaleName);
  populateSelect(elTuning, Object.keys(TUNINGS).map(k => [k, TUNING_LABELS[k]]),state.tuningKey);

  elMode.addEventListener('change', () => {
    state.mode = elMode.value;
    state.positionIndex = 0;
    state.scalePositionIndex = 0;
    updateModeUI();
    fullRefresh();
  });
  elRoot.addEventListener('change', () => {
    state.rootName  = elRoot.value;
    state.inversion = 0;
    state.positionIndex = 0;
    state.scalePositionIndex = 0;
    fullRefresh();
  });
  elChord.addEventListener('change', () => {
    state.chordName = elChord.value;
    state.inversion = 0;
    state.positionIndex = 0;
    fullRefresh();
  });
  elScale.addEventListener('change', () => {
    state.scaleName = elScale.value;
    state.scalePositionIndex = 0;
    fullRefresh();
  });
  elTuning.addEventListener('change', () => {
    state.tuningKey = elTuning.value;
    state.positionIndex = 0;
    state.scalePositionIndex = 0;
    fullRefresh();
  });
  elInversion.addEventListener('change', () => {
    state.inversion     = parseInt(elInversion.value, 10);
    state.positionIndex = 0;
    try { computeVoicings(); } catch (e) {
      console.error('computeVoicings failed:', e); state.voicings = [];
    }
    render();
    setTimeout(renderPositionNav, 0);
  });

  // Chord navigator buttons
  document.getElementById('pos-prev').addEventListener('click', () => {
    if (state.positionIndex > 0) {
      state.positionIndex--;
      render(); renderPositionNav(true);
    }
  });
  document.getElementById('pos-next').addEventListener('click', () => {
    if (state.positionIndex < state.voicings.length - 1) {
      state.positionIndex++;
      render(); renderPositionNav(true);
    }
  });

  // Scale navigator buttons
  document.getElementById('scale-pos-prev').addEventListener('click', () => {
    if (state.scalePositionIndex > 0) {
      state.scalePositionIndex--;
      render(); renderScaleNav(true);
    }
  });
  document.getElementById('scale-pos-next').addEventListener('click', () => {
    if (state.scalePositionIndex < state.scalePositions.length - 1) {
      state.scalePositionIndex++;
      render(); renderScaleNav(true);
    }
  });

  updateModeUI();
  fullRefresh();
}

document.addEventListener('DOMContentLoaded', () => {
  try { init(); } catch (e) {
    document.getElementById('fretboard').textContent =
      'init() error: ' + e.message + ' — ' + e.stack;
    console.error('init() failed:', e);
  }
});

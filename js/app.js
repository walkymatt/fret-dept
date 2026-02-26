/**
 * app.js — Main application entry point.
 *
 * Wires together theory.js, fretboard.js, and renderer.js.
 * Handles UI state, dropdowns, and re-renders on change.
 */

import {
  nameToPc,
  pcToName,
  getChordPitchClasses,
  getScalePitchClasses,
  CHORDS, CHORD_LABELS,
  SCALES, SCALE_LABELS,
  NOTE_NAMES_SHARP,
} from './theory.js';

import {
  findPositions,
  TUNINGS, TUNING_LABELS,
  parseTuning,
} from './fretboard.js';

import { renderFretboard, renderLegend } from './renderer.js';

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

const state = {
  mode:       'chord',     // 'chord' | 'scale'
  rootName:   'C',
  chordName:  'major',
  scaleName:  'major',
  tuningKey:  'standard',
  maxFret:    12,
  useFlats:   false,
};

// ---------------------------------------------------------------------------
// DOM references (resolved after DOMContentLoaded)
// ---------------------------------------------------------------------------

let elMode, elRoot, elChord, elScale, elTuning, elFretboard, elLegend, elTitle;

// ---------------------------------------------------------------------------
// Render cycle
// ---------------------------------------------------------------------------

function render() {
  const rootPc   = nameToPc(state.rootName);
  const tuning   = TUNINGS[state.tuningKey];

  let pitchClasses, degrees, displayTitle;

  if (state.mode === 'chord') {
    const result = getChordPitchClasses(rootPc, state.chordName);
    pitchClasses = result.pitchClasses;
    degrees      = result.degrees;
    displayTitle = `${state.rootName} ${CHORD_LABELS[state.chordName]}`;
  } else {
    pitchClasses = getScalePitchClasses(rootPc, state.scaleName);
    // Build degree labels: 1, 2, 3, … up to scale length
    degrees = pitchClasses.map((_, i) => String(i + 1));
    displayTitle = `${state.rootName} ${SCALE_LABELS[state.scaleName]}`;
  }

  // Note names for legend
  const noteNames = pitchClasses.map(pc => pcToName(pc, state.useFlats));

  const positions = findPositions(pitchClasses, tuning, state.maxFret);

  renderFretboard(elFretboard, positions, degrees, { maxFret: state.maxFret });
  renderLegend(elLegend, degrees, noteNames);
  elTitle.textContent = displayTitle;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function populateSelect(el, entries, selected) {
  el.innerHTML = '';
  for (const [value, label] of entries) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === selected) opt.selected = true;
    el.appendChild(opt);
  }
}

function updateModeUI() {
  const chordRow = document.getElementById('chord-row');
  const scaleRow = document.getElementById('scale-row');
  if (state.mode === 'chord') {
    chordRow.style.display = '';
    scaleRow.style.display = 'none';
  } else {
    chordRow.style.display = 'none';
    scaleRow.style.display = '';
  }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function init() {
  elMode     = document.getElementById('sel-mode');
  elRoot     = document.getElementById('sel-root');
  elChord    = document.getElementById('sel-chord');
  elScale    = document.getElementById('sel-scale');
  elTuning   = document.getElementById('sel-tuning');
  elFretboard= document.getElementById('fretboard');
  elLegend   = document.getElementById('legend');
  elTitle    = document.getElementById('display-title');

  // Populate root notes
  populateSelect(elRoot,
    NOTE_NAMES_SHARP.map(n => [n, n]),
    state.rootName,
  );

  // Populate chords
  populateSelect(elChord,
    Object.keys(CHORDS).map(k => [k, CHORD_LABELS[k]]),
    state.chordName,
  );

  // Populate scales
  populateSelect(elScale,
    Object.keys(SCALES).map(k => [k, SCALE_LABELS[k]]),
    state.scaleName,
  );

  // Populate tunings
  populateSelect(elTuning,
    Object.keys(TUNINGS).map(k => [k, TUNING_LABELS[k]]),
    state.tuningKey,
  );

  // Event listeners
  elMode.addEventListener('change', () => {
    state.mode = elMode.value;
    updateModeUI();
    render();
  });

  elRoot.addEventListener('change', () => {
    state.rootName = elRoot.value;
    render();
  });

  elChord.addEventListener('change', () => {
    state.chordName = elChord.value;
    render();
  });

  elScale.addEventListener('change', () => {
    state.scaleName = elScale.value;
    render();
  });

  elTuning.addEventListener('change', () => {
    state.tuningKey = elTuning.value;
    render();
  });

  // Flat/sharp toggle
  const elFlats = document.getElementById('toggle-flats');
  if (elFlats) {
    elFlats.addEventListener('change', () => {
      state.useFlats = elFlats.checked;
      render();
    });
  }

  // Fret range slider
  const elFrets = document.getElementById('sel-frets');
  const elFretsLabel = document.getElementById('frets-label');
  if (elFrets) {
    elFrets.addEventListener('input', () => {
      state.maxFret = parseInt(elFrets.value, 10);
      if (elFretsLabel) elFretsLabel.textContent = state.maxFret;
      render();
    });
  }

  updateModeUI();
  render();
}

document.addEventListener('DOMContentLoaded', init);

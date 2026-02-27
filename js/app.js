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
  findPositions, findVoicingsAcrossNeck,
  TUNINGS, TUNING_LABELS,
} from './fretboard.js';

import { renderFretboard, renderLegend, renderChordDiagram } from './renderer.js';

const state = {
  mode:           'chord',
  rootName:       'C',
  chordName:      'major',
  scaleName:      'major',
  tuningKey:      'standard',
  maxFret:        12,
  useFlats:       false,
  positionIndex:  0,     // index into voicings[] currently shown in gallery
  voicings:       [],    // computed by findVoicingsAcrossNeck in chord mode
};

// ---------------------------------------------------------------------------
// Core chord / scale data for the current state
// ---------------------------------------------------------------------------

function getChordScaleData() {
  const rootPc = nameToPc(state.rootName);
  const tuning = TUNINGS[state.tuningKey];
  let pitchClasses, degrees, displayTitle;

  if (state.mode === 'chord') {
    ({ pitchClasses, degrees } = getChordPitchClasses(rootPc, state.chordName));
    displayTitle = `${state.rootName} ${CHORD_LABELS[state.chordName]}`;
  } else {
    pitchClasses = getScalePitchClasses(rootPc, state.scaleName);
    degrees      = pitchClasses.map((_, i) => String(i + 1));
    displayTitle = `${state.rootName} ${SCALE_LABELS[state.scaleName]}`;
  }

  return { rootPc, tuning, pitchClasses, degrees, displayTitle };
}

// ---------------------------------------------------------------------------
// Main fretboard + legend render
// ---------------------------------------------------------------------------

function render() {
  const { tuning, pitchClasses, degrees, displayTitle } = getChordScaleData();

  const positions = findPositions(pitchClasses, tuning, state.maxFret);
  const noteNames = pitchClasses.map(pc => pcToName(pc, state.useFlats));

  renderFretboard(document.getElementById('fretboard'), positions, degrees, { maxFret: state.maxFret });
  renderLegend(document.getElementById('legend'), degrees, noteNames);
  document.getElementById('display-title').textContent = displayTitle;
}

// ---------------------------------------------------------------------------
// Position navigator + voicing gallery
// ---------------------------------------------------------------------------

function computeVoicings() {
  if (state.mode !== 'chord') { state.voicings = []; return; }
  const { pitchClasses, tuning } = getChordScaleData();
  state.voicings = findVoicingsAcrossNeck(pitchClasses, tuning, 22, 4);
  if (state.positionIndex >= state.voicings.length) state.positionIndex = 0;
}

function renderPositionNav() {
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

  // Navigator label
  const cur = voicings[positionIndex];
  let label = 'No voicings found';
  if (cur) {
    const shape = cur.cagedShape ? `${cur.cagedShape} shape · ` : '';
    label = `${shape}fret ${cur.windowStart}`;
  }
  document.getElementById('pos-label').textContent = label;
  document.getElementById('pos-count').textContent =
    voicings.length > 0 ? `${positionIndex + 1} / ${voicings.length}` : '';

  document.getElementById('pos-prev').disabled = positionIndex <= 0;
  document.getElementById('pos-next').disabled = positionIndex >= voicings.length - 1;

  // Gallery
  const { degrees } = getChordScaleData();
  galleryEl.innerHTML = '';

  voicings.forEach((v, idx) => {
    const card = document.createElement('div');
    card.className = 'voicing-card' + (idx === positionIndex ? ' active' : '');

    const diagEl = document.createElement('div');
    diagEl.className = 'voicing-diagram';
    renderChordDiagram(diagEl, v.voicing, degrees, {
      diagramFretCount:      4,
      diagramStringSpacing:  18,
      diagramFretHeight:     20,
      diagramDotRadius:      8,
    });

    const lbl = document.createElement('div');
    lbl.className = 'voicing-card-label';
    lbl.textContent = v.cagedShape
      ? `${v.cagedShape}  fr${v.windowStart}`
      : `fr${v.windowStart}`;

    card.appendChild(diagEl);
    card.appendChild(lbl);
    card.addEventListener('click', () => {
      state.positionIndex = idx;
      renderPositionNav();
    });

    galleryEl.appendChild(card);
  });

  // Scroll active card into view
  const active = galleryEl.querySelector('.voicing-card.active');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// Recompute voicings and refresh everything chord-related
function fullChordRefresh() {
  computeVoicings();
  render();
  renderPositionNav();
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

function populateSelect(el, entries, selected) {
  el.innerHTML = '';
  for (const [value, label] of entries) {
    const opt = document.createElement('option');
    opt.value       = value;
    opt.textContent = label;
    if (value === selected) opt.selected = true;
    el.appendChild(opt);
  }
}

function updateModeUI() {
  document.getElementById('chord-row').style.display = state.mode === 'chord' ? '' : 'none';
  document.getElementById('scale-row').style.display = state.mode === 'scale' ? '' : 'none';
}

function init() {
  const elMode       = document.getElementById('sel-mode');
  const elRoot       = document.getElementById('sel-root');
  const elChord      = document.getElementById('sel-chord');
  const elScale      = document.getElementById('sel-scale');
  const elTuning     = document.getElementById('sel-tuning');
  const elFlats      = document.getElementById('toggle-flats');
  const elFrets      = document.getElementById('sel-frets');
  const elFretsLabel = document.getElementById('frets-label');

  populateSelect(elRoot,   NOTE_NAMES_SHARP.map(n => [n, n]),                    state.rootName);
  populateSelect(elChord,  Object.keys(CHORDS).map(k =>  [k, CHORD_LABELS[k]]),  state.chordName);
  populateSelect(elScale,  Object.keys(SCALES).map(k =>  [k, SCALE_LABELS[k]]),  state.scaleName);
  populateSelect(elTuning, Object.keys(TUNINGS).map(k => [k, TUNING_LABELS[k]]), state.tuningKey);

  elMode.addEventListener('change',  () => {
    state.mode = elMode.value;
    state.positionIndex = 0;
    updateModeUI();
    fullChordRefresh();
  });
  elRoot.addEventListener('change',  () => { state.rootName  = elRoot.value;  state.positionIndex = 0; fullChordRefresh(); });
  elChord.addEventListener('change', () => { state.chordName = elChord.value; state.positionIndex = 0; fullChordRefresh(); });
  elScale.addEventListener('change', () => { state.scaleName = elScale.value; render(); });
  elTuning.addEventListener('change',() => { state.tuningKey = elTuning.value; state.positionIndex = 0; fullChordRefresh(); });
  elFlats.addEventListener('change', () => { state.useFlats  = elFlats.checked; render(); });
  elFrets.addEventListener('input',  () => {
    state.maxFret = parseInt(elFrets.value, 10);
    elFretsLabel.textContent = state.maxFret;
    render(); // voicings scan up to 22 frets regardless
  });

  // Position navigator buttons
  document.getElementById('pos-prev').addEventListener('click', () => {
    if (state.positionIndex > 0) { state.positionIndex--; renderPositionNav(); }
  });
  document.getElementById('pos-next').addEventListener('click', () => {
    if (state.positionIndex < state.voicings.length - 1) { state.positionIndex++; renderPositionNav(); }
  });

  updateModeUI();
  fullChordRefresh();
}

document.addEventListener('DOMContentLoaded', init);

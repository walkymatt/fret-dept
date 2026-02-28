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

const FRETBOARD_FRETS = 12;   // fixed display depth
const VOICING_FRETS   = 22;   // search depth for voicings

const state = {
  mode:          'chord',
  rootName:      'C',
  chordName:     'major',
  scaleName:     'major',
  tuningKey:     'standard',
  inversion:     0,     // 0 = root position, 1 = 1st inversion, etc.
  positionIndex: 0,     // index into voicings[] shown in gallery
  voicings:      [],    // computed by findVoicingsAcrossNeck in chord mode
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Prefer flat spellings when the root note name contains 'b'. */
function useFlats() { return state.rootName.includes('b'); }

/**
 * Pitch class of the lowest-sounding string in a voicing.
 * Voicing entries already carry a .pc field — no need to recompute from tuning.
 * string numbering: 1 = low E … 6 = high e
 */
function getVoicingBassPc(voicing) {
  const played = voicing.filter(Boolean).sort((a, b) => a.string - b.string);
  if (played.length === 0) return null;
  return played[0].pc;
}

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
// Main fretboard + legend render
// ---------------------------------------------------------------------------

function render() {
  try {
    const { tuning, pitchClasses, degrees, displayTitle } = getChordScaleData();

    const positions = findPositions(pitchClasses, tuning, FRETBOARD_FRETS);
    const noteNames = pitchClasses.map(pc => pcToName(pc, useFlats()));

    // Build activeKeys from the selected voicing
    let activeKeys;
    if (state.mode === 'chord' && state.voicings.length > 0) {
      const voicing = state.voicings[state.positionIndex]?.voicing ?? [];
      activeKeys = new Set(
        voicing.filter(Boolean).map(v => `${v.string}:${v.fret}`)
      );
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
// Position navigator + voicing gallery
// ---------------------------------------------------------------------------

function computeVoicings() {
  if (state.mode !== 'chord') { state.voicings = []; return; }
  const { pitchClasses, tuning } = getChordScaleData();
  // Pass the required bass pc into the search so the scorer hard-gates by it.
  // null = unconstrained (root position): natural scoring already favours root-in-bass.
  const bassPc = (state.inversion > 0 && state.inversion < pitchClasses.length)
    ? pitchClasses[state.inversion]
    : null;
  state.voicings = findVoicingsAcrossNeck(pitchClasses, tuning, VOICING_FRETS, 4, bassPc);
  if (state.positionIndex >= state.voicings.length) state.positionIndex = 0;
}

/** Repopulate the inversion dropdown from current chord tones. */
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
    if (i === 0) {
      opt.textContent = 'Root pos.';
    } else {
      const bassName = pcToName(pc, flat);
      opt.textContent = `${ordinals[i]} (${state.rootName}/${bassName})`;
    }
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

  const { degrees } = getChordScaleData();
  galleryEl.innerHTML = '';

  voicings.forEach((v, idx) => {
    const card = document.createElement('div');
    card.className = 'voicing-card' + (idx === positionIndex ? ' active' : '');

    const diagEl = document.createElement('div');
    diagEl.className = 'voicing-diagram';
    renderChordDiagram(diagEl, v.voicing, degrees);

    const lbl = document.createElement('div');
    lbl.className = 'voicing-card-label';
    lbl.textContent = v.cagedShape
      ? `${v.cagedShape}  fr${v.windowStart}`
      : `fr${v.windowStart}`;

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

function fullChordRefresh() {
  try { computeVoicings(); } catch (e) {
    console.error('computeVoicings failed:', e);
    state.voicings = [];
  }
  populateInversionSelect();
  render();
  setTimeout(renderPositionNav, 0);
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
  const isChord = state.mode === 'chord';
  document.getElementById('chord-row').style.display     = isChord ? '' : 'none';
  document.getElementById('scale-row').style.display     = isChord ? 'none' : '';
  document.getElementById('inversion-row').style.display = isChord ? '' : 'none';
}

function init() {
  const elMode       = document.getElementById('sel-mode');
  const elRoot       = document.getElementById('sel-root');
  const elChord      = document.getElementById('sel-chord');
  const elScale      = document.getElementById('sel-scale');
  const elTuning     = document.getElementById('sel-tuning');
  const elInversion  = document.getElementById('sel-inversion');

  populateSelect(elRoot,   NOTE_NAMES_SHARP.map(n => [n, n]),                    state.rootName);
  populateSelect(elChord,  Object.keys(CHORDS).map(k =>  [k, CHORD_LABELS[k]]),  state.chordName);
  populateSelect(elScale,  Object.keys(SCALES).map(k =>  [k, SCALE_LABELS[k]]),  state.scaleName);
  populateSelect(elTuning, Object.keys(TUNINGS).map(k => [k, TUNING_LABELS[k]]), state.tuningKey);

  elMode.addEventListener('change', () => {
    state.mode = elMode.value;
    state.positionIndex = 0;
    updateModeUI();
    fullChordRefresh();
  });

  elRoot.addEventListener('change', () => {
    state.rootName    = elRoot.value;
    state.inversion   = 0;
    state.positionIndex = 0;
    fullChordRefresh();
  });

  elChord.addEventListener('change', () => {
    state.chordName   = elChord.value;
    state.inversion   = 0;
    state.positionIndex = 0;
    fullChordRefresh();
  });

  elScale.addEventListener('change', () => {
    state.scaleName = elScale.value;
    render();
  });

  elTuning.addEventListener('change', () => {
    state.tuningKey   = elTuning.value;
    state.positionIndex = 0;
    fullChordRefresh();
  });

  elInversion.addEventListener('change', () => {
    state.inversion   = parseInt(elInversion.value, 10);
    state.positionIndex = 0;
    try { computeVoicings(); } catch (e) {
      console.error('computeVoicings failed:', e);
      state.voicings = [];
    }
    render();
    setTimeout(renderPositionNav, 0);
  });

  // Position navigator buttons
  document.getElementById('pos-prev').addEventListener('click', () => {
    if (state.positionIndex > 0) {
      state.positionIndex--;
      render();
      renderPositionNav(true);
    }
  });
  document.getElementById('pos-next').addEventListener('click', () => {
    if (state.positionIndex < state.voicings.length - 1) {
      state.positionIndex++;
      render();
      renderPositionNav(true);
    }
  });

  updateModeUI();
  fullChordRefresh();
}

document.addEventListener('DOMContentLoaded', () => {
  try { init(); } catch (e) {
    document.getElementById('fretboard').textContent =
      'init() error: ' + e.message + ' — ' + e.stack;
    console.error('init() failed:', e);
  }
});

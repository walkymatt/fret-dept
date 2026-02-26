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

import { findPositions, TUNINGS, TUNING_LABELS } from './fretboard.js';
import { renderFretboard, renderLegend }          from './renderer.js';

const state = {
  mode:      'chord',
  rootName:  'C',
  chordName: 'major',
  scaleName: 'major',
  tuningKey: 'standard',
  maxFret:   12,
  useFlats:  false,
};

function render() {
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

  const noteNames = pitchClasses.map(pc => pcToName(pc, state.useFlats));
  const positions = findPositions(pitchClasses, tuning, state.maxFret);

  renderFretboard(document.getElementById('fretboard'), positions, degrees, { maxFret: state.maxFret });
  renderLegend(document.getElementById('legend'), degrees, noteNames);
  document.getElementById('display-title').textContent = displayTitle;
}

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

  elMode.addEventListener('change',  () => { state.mode      = elMode.value;                     updateModeUI(); render(); });
  elRoot.addEventListener('change',  () => { state.rootName  = elRoot.value;                     render(); });
  elChord.addEventListener('change', () => { state.chordName = elChord.value;                    render(); });
  elScale.addEventListener('change', () => { state.scaleName = elScale.value;                    render(); });
  elTuning.addEventListener('change',() => { state.tuningKey = elTuning.value;                   render(); });
  elFlats.addEventListener('change', () => { state.useFlats  = elFlats.checked;                  render(); });
  elFrets.addEventListener('input',  () => { state.maxFret   = parseInt(elFrets.value, 10);
                                             elFretsLabel.textContent = state.maxFret;           render(); });
  updateModeUI();
  render();
}

document.addEventListener('DOMContentLoaded', init);

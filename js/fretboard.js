/**
 * fretboard.js — Guitar fretboard layout, instrument-specific.
 *
 * Strings numbered 1–6, low E to high E (standard tuning).
 * Fret 0 = open string.
 */

import { pitchClass, nameToMidi } from './theory.js';

// ---------------------------------------------------------------------------
// Tunings
// ---------------------------------------------------------------------------

export function parseTuning(spec) {
  if (!Array.isArray(spec) || spec.length !== 6) {
    throw new Error('Tuning must be an array of 6 values');
  }
  return spec.map(v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const match = v.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
      if (!match) throw new Error(`Cannot parse note: "${v}"`);
      const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      return nameToMidi(noteName, parseInt(match[2], 10));
    }
    throw new Error(`Invalid tuning value: ${v}`);
  });
}

export const TUNINGS = Object.freeze({
  standard:       ['E2','A2','D3','G3','B3','E4'],
  drop_d:         ['D2','A2','D3','G3','B3','E4'],
  open_g:         ['D2','G2','D3','G3','B3','D4'],
  open_d:         ['D2','A2','D3','F#3','A3','D4'],
  open_e:         ['E2','B2','E3','G#3','B3','E4'],
  open_a:         ['E2','A2','E3','A3','C#4','E4'],
  dadgad:         ['D2','A2','D3','G3','A3','D4'],
  half_step_down: ['Eb2','Ab2','Db3','Gb3','Bb3','Eb4'],
  full_step_down: ['D2','G2','C3','F3','A3','D4'],
  drop_c:         ['C2','G2','C3','F3','A3','D4'],
});

export const TUNING_LABELS = Object.freeze({
  standard:       'Standard (EADGBe)',
  drop_d:         'Drop D (DADGBe)',
  open_g:         'Open G (DGDGBd)',
  open_d:         'Open D (DADf#ad)',
  open_e:         'Open E (EBEg#be)',
  open_a:         'Open A (EAEAc#e)',
  dadgad:         'DADGAD',
  half_step_down: 'Half Step Down (Eb)',
  full_step_down: 'Full Step Down (D)',
  drop_c:         'Drop C',
});

// ---------------------------------------------------------------------------
// Fretboard map
// ---------------------------------------------------------------------------

export function buildFretboardMap(tuningSpec, maxFret = 12) {
  const openNotes = parseTuning(tuningSpec);
  return openNotes.map(open => {
    const frets = [];
    for (let fret = 0; fret <= maxFret; fret++) frets.push(open + fret);
    return frets;
  });
}

// ---------------------------------------------------------------------------
// Position finding
// ---------------------------------------------------------------------------

export function findPositions(targetPcs, tuningSpec, maxFret = 12) {
  const map       = buildFretboardMap(tuningSpec, maxFret);
  const positions = [];
  map.forEach((stringFrets, strIdx) => {
    stringFrets.forEach((midi, fret) => {
      const pc          = pitchClass(midi);
      const degreeIndex = targetPcs.indexOf(pc);
      if (degreeIndex !== -1) {
        positions.push({ string: strIdx + 1, fret, midi, pc, degreeIndex });
      }
    });
  });
  return positions;
}

export function findBoxVoicing(targetPcs, tuningSpec, windowStart = 0, windowSize = 4) {
  const map     = buildFretboardMap(tuningSpec, windowStart + windowSize);
  const voicing = [];
  map.forEach((stringFrets, strIdx) => {
    const hit = stringFrets
      .map((midi, fret) => ({ fret, midi, pc: pitchClass(midi) }))
      .filter(({ fret }) => fret >= windowStart && fret <= windowStart + windowSize)
      .find(({ pc }) => targetPcs.includes(pc));

    voicing.push(hit
      ? { string: strIdx + 1, fret: hit.fret, pc: hit.pc, degreeIndex: targetPcs.indexOf(hit.pc) }
      : null
    );
  });
  return voicing;
}

export function filterByFretRange(positions, minFret, maxFret) {
  return positions.filter(p => p.fret >= minFret && p.fret <= maxFret);
}

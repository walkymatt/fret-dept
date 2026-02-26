/**
 * fretboard.js — Guitar fretboard layout, instrument-specific.
 *
 * Knows about strings, frets, and tunings.
 * Depends on theory.js for pitch-class arithmetic but not for display.
 *
 * Strings are numbered 1–6, low E to high E (standard tuning).
 * Fret 0 = open string.
 */

import { pitchClass, nameToMidi } from './theory.js';

// ---------------------------------------------------------------------------
// Standard tunings (open-string MIDI notes, string 1 = lowest)
// ---------------------------------------------------------------------------

/**
 * Parse a tuning specification.
 * Accepts either:
 *   - an array of MIDI numbers: [40, 45, 50, 55, 59, 64]
 *   - an array of note strings: ['E2','A2','D3','G3','B3','E4']
 *
 * Returns an array of 6 MIDI numbers (string 1 → string 6, low → high).
 */
export function parseTuning(spec) {
  if (!Array.isArray(spec) || spec.length !== 6) {
    throw new Error('Tuning must be an array of 6 values');
  }
  return spec.map(v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      // Parse e.g. "E2", "Bb3", "C#4"
      const match = v.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
      if (!match) throw new Error(`Cannot parse note: "${v}"`);
      const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      const oct = parseInt(match[2], 10);
      return nameToMidi(noteName, oct);
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
// Fretboard note mapping
// ---------------------------------------------------------------------------

/**
 * Build a full map of MIDI notes across the fretboard.
 *
 * @param {string[]|number[]} tuningSpec - Open-string notes (6 values)
 * @param {number} maxFret               - Highest fret to include (default 12)
 * @returns {number[][]} notes[stringIndex][fret] = MIDI note number
 *   stringIndex 0 = string 1 (lowest), stringIndex 5 = string 6 (highest)
 */
export function buildFretboardMap(tuningSpec, maxFret = 12) {
  const openNotes = parseTuning(tuningSpec);
  return openNotes.map(open => {
    const frets = [];
    for (let fret = 0; fret <= maxFret; fret++) {
      frets.push(open + fret);
    }
    return frets;
  });
}

// ---------------------------------------------------------------------------
// Finding note positions
// ---------------------------------------------------------------------------

/**
 * Find every fretboard position that matches any of the given pitch classes.
 *
 * @param {number[]} targetPcs   - Pitch classes to find (0–11)
 * @param {string[]|number[]} tuningSpec
 * @param {number} maxFret
 * @returns {Array<{ string: number, fret: number, midi: number, pc: number, degreeIndex: number }>}
 *   string is 1-indexed (1 = lowest string), fret is 0-indexed (0 = open).
 *   degreeIndex is the index into targetPcs (so callers can colour by chord degree).
 */
export function findPositions(targetPcs, tuningSpec, maxFret = 12) {
  const map = buildFretboardMap(tuningSpec, maxFret);
  const positions = [];

  map.forEach((stringFrets, strIdx) => {
    stringFrets.forEach((midi, fret) => {
      const pc = pitchClass(midi);
      const degreeIndex = targetPcs.indexOf(pc);
      if (degreeIndex !== -1) {
        positions.push({
          string: strIdx + 1,   // 1 = lowest
          fret,
          midi,
          pc,
          degreeIndex,
        });
      }
    });
  });

  return positions;
}

// ---------------------------------------------------------------------------
// Playable chord voicings
// ---------------------------------------------------------------------------

/**
 * A voicing is one position per string (or null = muted/skipped).
 * This function finds "box" voicings: all positions within a fret window,
 * one note per string, where each string either plays a chord tone or is muted.
 *
 * For display purposes we often want ALL positions (findPositions is better),
 * but this utility helps generate playable voicings for chord diagrams.
 *
 * @param {number[]} targetPcs     - Chord pitch classes
 * @param {string[]|number[]} tuningSpec
 * @param {number} windowStart     - Lowest fret of the window (0 = include open)
 * @param {number} windowSize      - Number of frets in the window (default 4)
 * @returns {Array<{ string: number, fret: number, pc: number, degreeIndex: number }|null>}
 *   One entry per string (index 0 = string 1), null if that string is muted.
 */
export function findBoxVoicing(targetPcs, tuningSpec, windowStart = 0, windowSize = 4) {
  const map = buildFretboardMap(tuningSpec, windowStart + windowSize);
  const voicing = [];

  map.forEach((stringFrets, strIdx) => {
    // Prefer lower frets within the window
    const windowFrets = stringFrets
      .map((midi, fret) => ({ fret, midi, pc: pitchClass(midi) }))
      .filter(({ fret }) => fret >= windowStart && fret <= windowStart + windowSize);

    const hit = windowFrets.find(({ pc }) => targetPcs.includes(pc));
    if (hit) {
      voicing.push({
        string: strIdx + 1,
        fret: hit.fret,
        pc: hit.pc,
        degreeIndex: targetPcs.indexOf(hit.pc),
      });
    } else {
      voicing.push(null);
    }
  });

  return voicing;
}

/**
 * Helper: given a set of positions (from findPositions), filter down to only
 * those within a specific fret range.
 */
export function filterByFretRange(positions, minFret, maxFret) {
  return positions.filter(p => p.fret >= minFret && p.fret <= maxFret);
}

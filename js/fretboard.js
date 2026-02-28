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

// ---------------------------------------------------------------------------
// Voicing scoring & position discovery
// ---------------------------------------------------------------------------

/**
 * Score a candidate voicing (array of 6 position-objects-or-null).
 * Returns 0 if any chord tone is missing (hard gate).
 * Higher scores = more playable / more complete voicings.
 */
/**
 * @param {Array} voicing
 * @param {number[]} targetPcs
 * @param {number|null} requiredBassPc  When non-null, the lowest sounding
 *   string MUST have this pitch class (hard gate).  Use for inversions.
 *   When null, a root-in-bass bonus is applied instead (default behaviour).
 */
export function scoreVoicing(voicing, targetPcs, requiredBassPc = null) {
  const active = voicing.filter(v => v !== null);
  if (active.length === 0) return 0;

  // Hard gate: every chord tone must be represented.
  const presentPcs = new Set(active.map(v => v.pc));
  for (const pc of targetPcs) {
    if (!presentPcs.has(pc)) return 0;
  }

  const lowestIdx = voicing.findIndex(v => v !== null);

  // Hard gate: if a specific bass is required, enforce it now.
  if (requiredBassPc !== null && voicing[lowestIdx].pc !== requiredBassPc) return 0;

  let score = 100 * targetPcs.length; // completeness base

  // More strings = better
  score += active.length * 10;

  // Tighter fret span = better (open strings excluded from span calc)
  const frettedFrets = active.filter(v => v.fret > 0).map(v => v.fret);
  if (frettedFrets.length > 0) {
    const span = Math.max(...frettedFrets) - Math.min(...frettedFrets);
    if (span <= 3) score += 20;
    else if (span <= 4) score += 10;
  } else {
    score += 20; // all open strings — ideal
  }

  // Bass bonus
  if (lowestIdx !== -1) {
    if (requiredBassPc !== null) {
      score += 30; // always satisfied — hard gate above ensures it
    } else if (voicing[lowestIdx].degreeIndex === 0) {
      score += 30; // root-in-bass bonus for unconstrained (root position) search
    }
  }

  // No muted strings buried in the middle of the voicing
  let first = -1, last = -1;
  for (let i = 0; i < voicing.length; i++) {
    if (voicing[i] !== null) {
      if (first === -1) first = i;
      last = i;
    }
  }
  let hasGap = false;
  for (let i = first + 1; i < last; i++) {
    if (voicing[i] === null) { hasGap = true; break; }
  }
  if (!hasGap) score += 10;

  return score;
}

/**
 * Find the best-scoring complete voicing within a fret window.
 * Tries every combination of candidate notes (one per string, or mute).
 * Returns null if no complete voicing exists in the window.
 */
export function findBestVoicingInWindow(targetPcs, tuningSpec, windowStart = 0, windowSize = 4, requiredBassPc = null) {
  const map = buildFretboardMap(tuningSpec, windowStart + windowSize);

  // Collect candidate notes per string (plus null = mute)
  const candidates = map.map((stringFrets, strIdx) => {
    const hits = [];
    for (let fret = windowStart; fret <= windowStart + windowSize; fret++) {
      if (fret >= stringFrets.length) break;
      const pc = pitchClass(stringFrets[fret]);
      const di = targetPcs.indexOf(pc);
      if (di !== -1) {
        hits.push({ string: strIdx + 1, fret, pc, degreeIndex: di });
      }
    }
    return [null, ...hits]; // null = mute this string
  });

  let bestVoicing = null;
  let bestScore   = 0;
  const current   = new Array(6);

  function recurse(strIdx) {
    if (strIdx === 6) {
      const score = scoreVoicing(current, targetPcs, requiredBassPc);
      if (score > bestScore) {
        bestScore   = score;
        bestVoicing = [...current];
      }
      return;
    }
    for (const candidate of candidates[strIdx]) {
      current[strIdx] = candidate;
      recurse(strIdx + 1);
    }
  }

  recurse(0);
  return bestScore > 0 ? bestVoicing : null;
}

/**
 * Slide a window across the neck and collect the best voicing at each
 * distinct position.  Adjacent windows that produce identical fingerings
 * are deduplicated.  Returns an array of:
 *   { windowStart, voicing, score, cagedShape }
 */
export function findVoicingsAcrossNeck(targetPcs, tuningSpec, maxFret = 22, windowSize = 4, requiredBassPc = null) {
  const results        = [];
  let lastFingerprint  = null;

  for (let ws = 0; ws <= maxFret - windowSize; ws++) {
    const voicing = findBestVoicingInWindow(targetPcs, tuningSpec, ws, windowSize, requiredBassPc);
    if (!voicing) continue;

    const fingerprint = voicing.map(v => v ? String(v.fret) : 'x').join(',');
    if (fingerprint === lastFingerprint) continue;
    lastFingerprint = fingerprint;

    const score     = scoreVoicing(voicing, targetPcs);
    const cagedShape = identifyCagedShape(voicing);
    results.push({ windowStart: ws, voicing, score, cagedShape });
  }

  return results;
}

/**
 * Identify which CAGED shape a voicing corresponds to, based on which
 * string carries the root (degreeIndex === 0) in the lowest position.
 *
 * Returns 'E' | 'A' | 'C' | 'D' | null.
 * G shape is not distinguished from E shape (both have root on string 6)
 * because auto-generated voicings rarely produce a clean G-shape barre
 * and misidentifying an E-barre as G would be confusing.
 */
export function identifyCagedShape(voicing) {
  // Find the lowest-string index that has the root
  let rootStrIdx = -1;
  for (let i = 0; i < voicing.length; i++) {
    if (voicing[i] !== null && voicing[i].degreeIndex === 0) {
      rootStrIdx = i;
      break;
    }
  }

  if (rootStrIdx === -1) return null;

  // Root on string 1 (low E, strIdx 0) — distinguish E shape from G shape.
  // E shape: A string (strIdx 1) carries the 5th  (degreeIndex 2), like open E/F barre.
  // G shape: A string carries the 3rd (degreeIndex 1) or is muted — like open G chord.
  if (rootStrIdx === 0) {
    const aStr = voicing[1]; // A string
    if (aStr !== null && aStr.degreeIndex === 2) return 'E'; // 5th on A → E shape
    if (aStr !== null && aStr.degreeIndex === 1) return 'G'; // 3rd on A → G shape
    // A muted: check for root on high-e (classic G-shape bracket)
    if (voicing[1] === null && voicing[5] !== null && voicing[5].degreeIndex === 0) return 'G';
    return 'E'; // fallback: root on low E without distinguishing info
  }

  // A or C shape: root on string 5 (strIdx 1, A), string 6 muted
  if (rootStrIdx === 1 && voicing[0] === null) {
    // A shape: D/G/B strings (strIdx 2-4) all at the same fret (barre-like)
    const inner = [voicing[2], voicing[3], voicing[4]].filter(Boolean);
    if (inner.length >= 2) {
      const allSameFret = inner.every(v => v.fret === inner[0].fret);
      return allSameFret ? 'A' : 'C';
    }
    return 'A'; // only 1 or 0 inner strings — default to A
  }

  // D shape: root on string 4 (strIdx 2, D), strings 6 & 5 muted
  if (rootStrIdx === 2 && voicing[0] === null && voicing[1] === null) {
    return 'D';
  }

  return null;
}

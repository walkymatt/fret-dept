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
      .filter(({ fret }) => fret >= windowStart && fret < windowStart + windowSize)
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

  // Collect candidate notes per string (plus null = mute).
  // Open strings (fret 0) are always playable regardless of windowStart, so
  // they are checked separately before the windowed loop.
  const candidates = map.map((stringFrets, strIdx) => {
    const hits = [];

    // fret 0 — open string: only offer when the string has NO chord tone
    // inside the current window.  This fills muted-string gaps (e.g. open D
    // in a 2nd-position G major) without displacing good local notes or
    // competing with barre shapes that already cover every string.
    if (windowStart > 0 && stringFrets.length > 0) {
      let hasLocalHit = false;
      for (let f = windowStart; f < windowStart + windowSize && !hasLocalHit; f++) {
        if (f < stringFrets.length && targetPcs.includes(pitchClass(stringFrets[f])))
          hasLocalHit = true;
      }
      if (!hasLocalHit) {
        const pc = pitchClass(stringFrets[0]);
        const di = targetPcs.indexOf(pc);
        if (di !== -1) hits.push({ string: strIdx + 1, fret: 0, pc, degreeIndex: di });
      }
    }

    for (let fret = windowStart; fret < windowStart + windowSize; fret++) {
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
 * Find scale "box positions" across the neck.
 * Anchors each window on a fret where a scale tone appears on the lowest
 * string (string 1), covering frets 0–12 (one octave) so each standard
 * position appears exactly once.
 *
 * Returns an array of { windowStart, windowSize, notes } where notes is
 * an array of { string, fret, pc, degreeIndex }.
 *
 * Strategy: anchor each position on a scale tone that falls on the lowest
 * string (frets 0–12).  For each anchor, collect every scale note within a
 * fixed 4-fret window [anchor, anchor+3] on all six strings.  Only keep
 * positions where all scale degrees are present in the window.
 */
export function findScalePositions(targetPcs, tuningSpec, maxFret = 22) {
  const SPAN = 5;                          // inclusive fret count per window
  const map  = buildFretboardMap(tuningSpec, maxFret);
  const lowE = map[0];
  const results = [];
  const seen    = new Set();

  for (let anchor = 0; anchor <= Math.min(12, maxFret - SPAN + 1); anchor++) {
    // Only anchor where a scale tone sits on string 1
    if (targetPcs.indexOf(pitchClass(lowE[anchor])) === -1) continue;

    // Collect every scale note in [anchor, anchor + SPAN - 1] on all strings
    const raw = [];
    map.forEach((stringFrets, strIdx) => {
      for (let fret = anchor; fret < anchor + SPAN; fret++) {
        if (fret >= stringFrets.length) break;
        const pc = pitchClass(stringFrets[fret]);
        const di = targetPcs.indexOf(pc);
        if (di !== -1) raw.push({ string: strIdx + 1, fret, pc, degreeIndex: di,
                                   midi: stringFrets[fret] });
      }
    });

    // Collect pairs where the same MIDI pitch appears on adjacent strings.
    // For each such pair we have a choice: assign the note to the lower or
    // upper string.  We try every combination (2^N, N ≤ 2 in practice) and
    // pick the one whose resulting note-set spans the fewest frets.
    const dupePairs = [];
    for (let s = 1; s <= 5; s++) {
      const onS   = raw.filter(n => n.string === s);
      const onSp1 = raw.filter(n => n.string === s + 1);
      for (const a of onS)
        for (const b of onSp1)
          if (a.midi === b.midi) dupePairs.push([a, b]); // [lower, upper]
    }

    // Evaluate every assignment combination; keep the narrowest valid one.
    let notes    = null;
    let bestSpan = Infinity;

    for (let mask = 0; mask < (1 << dupePairs.length); mask++) {
      const toRemove = new Set();
      dupePairs.forEach(([lo, hi], i) => {
        // bit=0 → keep lower (drop upper); bit=1 → keep upper (drop lower)
        toRemove.add((mask >> i & 1) ? lo : hi);
      });
      const candidate = raw.filter(n => !toRemove.has(n));

      // Must still cover every scale degree
      const present = new Set(candidate.map(n => n.pc));
      if (!targetPcs.every(pc => present.has(pc))) continue;

      const frets = candidate.map(n => n.fret);
      const span  = Math.max(...frets) - Math.min(...frets);
      if (span < bestSpan) { bestSpan = span; notes = candidate; }
    }

    if (!notes) continue;   // no valid assignment found for this anchor

    // ── Connectivity trim ────────────────────────────────────────────────
    // Notes must form a gapless ascending scale run across strings.  When the
    // transition from string S to string S+1 skips one or more scale degrees,
    // the fragments are disconnected.  Keep the longest contiguous run of
    // strings that together still cover every scale degree (≥ one octave).
    // Drop the whole diagram if no such run exists.
    {
      const N = targetPcs.length;

      // Group by string; sort each group by fret (ascending pitch on string)
      const byStr = new Map();
      notes.forEach(n => {
        if (!byStr.has(n.string)) byStr.set(n.string, []);
        byStr.get(n.string).push(n);
      });
      byStr.forEach(ns => ns.sort((a, b) => a.fret - b.fret));

      const active = [1, 2, 3, 4, 5, 6].filter(s => byStr.has(s));

      // connected[i] = true iff active[i]→active[i+1] has no degree gap
      const connected = active.slice(0, -1).map((s, i) => {
        const last  = byStr.get(s).at(-1).degreeIndex;
        const first = byStr.get(active[i + 1])[0].degreeIndex;
        return first === (last + 1) % N;
      });

      // Find longest contiguous connected sub-range covering all degrees
      let best = null, bestLen = 0;
      for (let i = 0; i < active.length; i++) {
        for (let j = i; j < active.length; j++) {
          if (j > i && !connected[j - 1]) break;   // hit a disconnection
          const run = active.slice(i, j + 1).flatMap(s => byStr.get(s));
          const present = new Set(run.map(n => n.pc));
          if (!targetPcs.every(pc => present.has(pc))) continue;
          if (j - i + 1 > bestLen) { bestLen = j - i + 1; best = run; }
        }
      }
      if (!best) continue;   // no complete-octave connected run — drop diagram
      notes = best;
    }

    // Deduplicate by exact fingering fingerprint
    const fp = notes.map(n => `${n.string}:${n.fret}`).join(',');
    if (seen.has(fp)) continue;
    seen.add(fp);

    const fretsUsed   = notes.map(n => n.fret);
    const windowStart = Math.min(...fretsUsed);   // always equals anchor
    const windowSize  = Math.max(...fretsUsed) - windowStart + 1;

    results.push({ windowStart, windowSize, notes });
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

  // D shape vs E shape (muted low strings): root on D string (strIdx 2),
  // both lower strings muted.
  // E-shape: the D string root sits ABOVE the barre — it's the highest-fret
  //   note of the four top strings (e.g. x-x-10-9-8-8 → D@10 > min 8).
  // D-shape: the D string root IS the barre — it's the lowest-fret note
  //   (e.g. x-x-2-4-5-4 → D@2 = min 2).
  if (rootStrIdx === 2 && voicing[0] === null && voicing[1] === null) {
    const top4    = [voicing[2], voicing[3], voicing[4], voicing[5]].filter(Boolean);
    if (top4.length === 0) return null;
    const minTop4 = Math.min(...top4.map(v => v.fret));
    return voicing[2].fret > minTop4 ? 'E' : 'D';
  }

  return null;
}

/**
 * fingering.js — Finger assignment for chord voicings.
 *
 * Primary path: lookup against data/fingerings.json (keyed on relative shape
 * fingerprint, so one entry covers all transpositions of a moveable shape).
 * Fallback path: algorithmic assignment using barre detection + greedy finger
 * allocation.
 *
 * Public API:
 *   assignFingering(voicing) → FingeringResult
 *
 * FingeringResult:
 *   fingers    (0|1|2|3|4|'T'|null)[]   per-string: 0=open, 1-4=fret finger,
 *                                        'T'=thumb, null=muted/unassigned
 *   barre      { finger, fromString, toString } | null
 *              fromString/toString are 1-indexed (1=low E, 6=high e)
 *   difficulty 1–5
 *   impossible boolean — true when no valid ≤4-finger assignment was found
 *   semi       boolean — barre spans an internal open string (harder; warn)
 *   source     'lookup' | 'algorithm'
 */

import FINGERING_DATA from '../data/fingerings.json';

const SHAPES = FINGERING_DATA.shapes;

// ── Lookup ──────────────────────────────────────────────────────────────────

/**
 * Try to find a curated fingering for the voicing.
 *
 * open:true  entries → exact match on absolute fret values.
 * open:false entries → match after normalising to relative offsets (subtract
 *                      min fret), so one entry covers all transpositions.
 *
 * Returns the matching shape object, or null if no match.
 */
function lookupFingering(voicing) {
  const frets = voicing.map(n => (n === null ? null : n.fret));
  const hasOpen = frets.some(f => f === 0);

  if (hasOpen) {
    return SHAPES.find(s => s.open && frets.every((f, i) => f === s.strings[i])) ?? null;
  }

  const nonNull = frets.filter(f => f !== null);
  if (nonNull.length === 0) return null;

  const minFret = Math.min(...nonNull);
  const rel = frets.map(f => (f === null ? null : f - minFret));
  return SHAPES.find(s => !s.open && rel.every((f, i) => f === s.strings[i])) ?? null;
}

// ── Barre detection ─────────────────────────────────────────────────────────

/**
 * Given an array of 6 fret values (null | int), attempt to identify a barre.
 *
 * A barre exists when ≥2 strings share the minimum non-zero fret and the
 * remaining notes above that fret can be covered by ≤3 additional fingers.
 *
 * Returns null if no viable barre exists, or:
 *   { fret, fromString, toString, semi }
 *   where fromString/toString are 1-indexed and semi=true means the barre
 *   span contains an internal open string (harder — avoid if possible).
 */
function detectBarre(frets) {
  const frettedPairs = frets
    .map((f, i) => (f !== null && f > 0 ? { str: i, fret: f } : null))
    .filter(Boolean);

  if (frettedPairs.length < 2) return null;

  const minFret = Math.min(...frettedPairs.map(n => n.fret));
  const atMin   = frettedPairs.filter(n => n.fret === minFret);
  if (atMin.length < 2) return null;

  const fromStr = Math.min(...atMin.map(n => n.str)); // 0-indexed
  const toStr   = Math.max(...atMin.map(n => n.str)); // 0-indexed

  // Check for open strings sitting inside the barre span
  let internalOpens = 0;
  for (let i = fromStr + 1; i < toStr; i++) {
    if (frets[i] === 0) internalOpens++;
  }

  // After using index (1) for the barre, only fingers 2–4 remain
  const above = frettedPairs.filter(n => n.fret > minFret);
  if (above.length > 3) return null; // not enough fingers

  return {
    fret:       minFret,
    fromString: fromStr + 1, // 1-indexed
    toString:   toStr + 1,   // 1-indexed
    semi:       internalOpens > 0,
  };
}

// ── Finger builder ──────────────────────────────────────────────────────────

/**
 * Build a fingers array given frets and an optional barre.
 * Assigns the lowest available finger to each remaining note, sorted by
 * (fret ASC, string ASC) — lower string gets the lower finger number within
 * the same fret.
 *
 * Returns { fingers, impossible }.
 */
function buildFingers(frets, barre) {
  const fingers = new Array(6).fill(null);

  // Open strings need no finger
  frets.forEach((f, i) => { if (f === 0) fingers[i] = 0; });

  let notes = frets
    .map((f, i) => (f !== null && f > 0 ? { str: i, fret: f } : null))
    .filter(Boolean);

  let nextFinger = 1;

  if (barre) {
    const lo = barre.fromString - 1; // 0-indexed
    const hi = barre.toString - 1;
    notes.forEach(n => {
      if (n.fret === barre.fret && n.str >= lo && n.str <= hi) {
        fingers[n.str] = 1; // index finger holds the barre
      }
    });
    notes = notes.filter(n => !(n.fret === barre.fret && n.str >= lo && n.str <= hi));
    nextFinger = 2;
  }

  // Sort remaining notes: fret ASC then string ASC (lower string → lower finger)
  notes.sort((a, b) => (a.fret !== b.fret ? a.fret - b.fret : a.str - b.str));

  let impossible = false;
  for (const n of notes) {
    if (nextFinger > 4) { impossible = true; break; }
    fingers[n.str] = nextFinger++;
  }

  return { fingers, impossible };
}

// ── Algorithmic assignment ──────────────────────────────────────────────────

function algorithmicFingering(frets) {
  const frettedNotes = frets
    .map((f, i) => (f !== null && f > 0 ? { str: i, fret: f } : null))
    .filter(Boolean)
    .sort((a, b) => (a.fret !== b.fret ? a.fret - b.fret : a.str - b.str));

  // ── No barre needed (≤4 fretted notes) ───────────────────────────────────
  if (frettedNotes.length <= 4) {
    const fingers = new Array(6).fill(null);
    frets.forEach((f, i) => { if (f === 0) fingers[i] = 0; });
    frettedNotes.forEach((n, idx) => { fingers[n.str] = idx + 1; });
    return { fingers, barre: null, impossible: false, semi: false };
  }

  // ── Thumb on low E (string index 0) ──────────────────────────────────────
  // Only viable at low frets where the thumb can wrap over the neck.
  if (frets[0] !== null && frets[0] > 0 && frets[0] <= 5) {
    const rest = frettedNotes.filter(n => n.str !== 0);
    if (rest.length <= 4) {
      const fingers = new Array(6).fill(null);
      frets.forEach((f, i) => { if (f === 0) fingers[i] = 0; });
      fingers[0] = 'T';
      rest.forEach((n, idx) => { fingers[n.str] = idx + 1; });
      return { fingers, barre: null, impossible: false, semi: false };
    }
  }

  // ── Clean barre (no internal open strings) ────────────────────────────────
  const barre = detectBarre(frets);

  if (barre && !barre.semi) {
    const { fingers, impossible } = buildFingers(frets, barre);
    if (!impossible) {
      return {
        fingers,
        barre: { finger: 1, fromString: barre.fromString, toString: barre.toString },
        impossible: false,
        semi: false,
      };
    }
  }

  // ── Semi-barre (internal open string) ─────────────────────────────────────
  // Avoided if possible; used only when no clean alternative exists.
  if (barre && barre.semi) {
    const { fingers, impossible } = buildFingers(frets, barre);
    if (!impossible) {
      return {
        fingers,
        barre: { finger: 1, fromString: barre.fromString, toString: barre.toString },
        impossible: false,
        semi: true,
      };
    }
  }

  // ── Impossible ────────────────────────────────────────────────────────────
  const fingers = new Array(6).fill(null);
  frets.forEach((f, i) => {
    if (f === 0)       fingers[i] = 0;
    else if (f !== null) fingers[i] = '?'; // unassignable — signal to renderer
  });
  return { fingers, barre: null, impossible: true, semi: false };
}

// ── Difficulty ──────────────────────────────────────────────────────────────

/**
 * Compute a 1–5 difficulty score from the voicing's fret positions and the
 * derived barre/semi fields.
 *
 * Additive model:
 *   spread 0–1 frets          +0
 *   spread 2–3                +1
 *   spread 4                  +2
 *   spread 5+                 +3
 *   partial barre (<5 strings)+1
 *   full barre (≥5 strings)   +2
 *   semi-barre (internal open)+3  (replaces barre penalty, much harder)
 *   each muted gap in span    +0.5
 *   all frets > 7 (high pos.) −0.5
 *   any open string           −0.5
 *   Base offset               +1  (so score 0 → difficulty 1)
 */
function computeDifficulty(frets, barre, semi, impossible) {
  if (impossible) return 5;

  const nonZero = frets.filter(f => f !== null && f > 0);
  if (nonZero.length === 0) return 1; // all open / muted

  const minFret = Math.min(...nonZero);
  const maxFret = Math.max(...nonZero);
  const spread  = maxFret - minFret;

  let score = 0;

  // Fret spread
  if      (spread <= 1) score += 0;
  else if (spread <= 3) score += 1;
  else if (spread === 4) score += 2;
  else                   score += 3;

  // Barre penalty
  if (barre) {
    const span = barre.toString - barre.fromString + 1;
    if (semi)          score += 3; // semi-barre: arching one finger over an open string
    else if (span >= 5) score += 2; // full (or near-full) barre
    else               score += 1; // partial barre (e.g. 4-string D-shape)
  }

  // Muted strings inside the played span (hard to avoid ringing)
  const playedIdxs = frets
    .map((f, i) => (f !== null ? i : -1))
    .filter(i => i >= 0);
  if (playedIdxs.length >= 2) {
    const lo = playedIdxs[0];
    const hi = playedIdxs[playedIdxs.length - 1];
    for (let i = lo + 1; i < hi; i++) {
      if (frets[i] === null) score += 0.5;
    }
  }

  // High fret position: strings shorter, frets physically closer together
  if (minFret > 7) score -= 0.5;

  // Open strings: generally makes voicings easier
  if (frets.some(f => f === 0)) score -= 0.5;

  return Math.max(1, Math.min(5, Math.round(score + 1)));
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * assignFingering(voicing) → FingeringResult
 *
 * voicing: 6-element array, each element null (muted) or
 *          { string, fret, pc, degreeIndex, midi } as returned by
 *          findVoicingsAcrossNeck / findBestVoicingInWindow.
 */
export function assignFingering(voicing) {
  // ── Lookup ────────────────────────────────────────────────────────────────
  const shape = lookupFingering(voicing);

  if (shape) {
    const barre = shape.barre ?? null;
    const frets = voicing.map(n => (n === null ? null : n.fret));
    return {
      fingers:    shape.fingers,
      barre,
      difficulty: computeDifficulty(frets, barre, false, false),
      impossible: false,
      semi:       false,
      source:     'lookup',
    };
  }

  // ── Algorithm ─────────────────────────────────────────────────────────────
  const frets  = voicing.map(n => (n === null ? null : n.fret));
  const algo   = algorithmicFingering(frets);

  return {
    fingers:    algo.fingers,
    barre:      algo.barre,
    difficulty: computeDifficulty(frets, algo.barre, algo.semi, algo.impossible),
    impossible: algo.impossible,
    semi:       algo.semi,
    source:     'algorithm',
  };
}

/** Human-readable difficulty labels. */
export const DIFFICULTY_LABELS = { 1: 'Easy', 2: 'Moderate', 3: 'Moderate', 4: 'Hard', 5: 'Very Hard' };

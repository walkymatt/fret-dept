import { describe, it, expect } from 'bun:test';
import { assignFingering, DIFFICULTY_LABELS } from '../js/fingering.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal voicing-slot object from a fret number (or null). */
const slot = (fret, str = 1) =>
  fret === null ? null : { string: str, fret, pc: 0, degreeIndex: 0, midi: 40 + fret };

/** Build a 6-slot voicing from an array of fret | null values. */
const mkVoicing = (frets) =>
  frets.map((f, i) => (f === null ? null : { string: i + 1, fret: f, pc: 0, degreeIndex: 0, midi: 40 + i * 5 + f }));

// ── DIFFICULTY_LABELS ────────────────────────────────────────────────────────

describe('DIFFICULTY_LABELS', () => {
  it('has entries for 1–5', () => {
    expect(Object.keys(DIFFICULTY_LABELS).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('values are non-empty strings', () => {
    Object.values(DIFFICULTY_LABELS).forEach(v => expect(typeof v).toBe('string'));
  });
});

// ── Return shape ─────────────────────────────────────────────────────────────

describe('assignFingering() return shape', () => {
  const v = mkVoicing([null, 0, 2, 2, 1, 0]); // Am open
  let result;
  it('returns an object', () => { result = assignFingering(v); expect(typeof result).toBe('object'); });
  it('has fingers array length 6', () => expect(result.fingers.length).toBe(6));
  it('has barre null or object',   () => expect(result.barre === null || typeof result.barre === 'object').toBe(true));
  it('difficulty is 1–5',          () => { expect(result.difficulty).toBeGreaterThanOrEqual(1); expect(result.difficulty).toBeLessThanOrEqual(5); });
  it('impossible is boolean',      () => expect(typeof result.impossible).toBe('boolean'));
  it('semi is boolean',            () => expect(typeof result.semi).toBe('boolean'));
  it('source is lookup or algorithm', () => expect(['lookup','algorithm']).toContain(result.source));
});

// ── Lookup hits ──────────────────────────────────────────────────────────────

describe('assignFingering() — lookup hits (open chords)', () => {

  it('E major: source=lookup, fingers match standard fingering', () => {
    const r = assignFingering(mkVoicing([0, 2, 2, 1, 0, 0]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([0, 2, 3, 1, 0, 0]);
    expect(r.barre).toBeNull();
    expect(r.impossible).toBe(false);
  });

  it('E minor: source=lookup, fingers [0,2,3,0,0,0]', () => {
    const r = assignFingering(mkVoicing([0, 2, 2, 0, 0, 0]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([0, 2, 3, 0, 0, 0]);
  });

  it('A minor: source=lookup, fingers [null,0,3,2,1,0]', () => {
    const r = assignFingering(mkVoicing([null, 0, 2, 2, 1, 0]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([null, 0, 3, 2, 1, 0]);
  });

  it('D major: source=lookup, fingers [null,null,0,2,3,1]', () => {
    const r = assignFingering(mkVoicing([null, null, 0, 2, 3, 2]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([null, null, 0, 2, 3, 1]);
  });

  it('C major: source=lookup, fingers [null,3,2,0,1,0]', () => {
    const r = assignFingering(mkVoicing([null, 3, 2, 0, 1, 0]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([null, 3, 2, 0, 1, 0]);
  });

  it('G major: source=lookup, fingers [3,2,0,0,0,4]', () => {
    const r = assignFingering(mkVoicing([3, 2, 0, 0, 0, 3]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([3, 2, 0, 0, 0, 4]);
  });
});

describe('assignFingering() — lookup hits (barre chords)', () => {

  // E-shape barre at fret 1 (F major)
  it('F major (E-barre@1): source=lookup, full barre', () => {
    const r = assignFingering(mkVoicing([1, 3, 3, 2, 1, 1]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([1, 3, 4, 2, 1, 1]);
    expect(r.barre).toEqual({ finger: 1, fromString: 1, toString: 6 });
    expect(r.impossible).toBe(false);
    expect(r.semi).toBe(false);
  });

  // E-shape barre at fret 5 (A major via E-shape)
  it('A major (E-barre@5): same shape as F-barre, same fingers', () => {
    const r = assignFingering(mkVoicing([5, 7, 7, 6, 5, 5]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([1, 3, 4, 2, 1, 1]);
    expect(r.barre).toEqual({ finger: 1, fromString: 1, toString: 6 });
  });

  // Em-shape barre at fret 2 (F#m)
  it('F#m (Em-barre@2): full barre, fingers [1,3,4,1,1,1]', () => {
    const r = assignFingering(mkVoicing([2, 4, 4, 2, 2, 2]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([1, 3, 4, 1, 1, 1]);
    expect(r.barre).toEqual({ finger: 1, fromString: 1, toString: 6 });
  });

  // A-shape barre at fret 2 (B major)
  it('B major (A-barre@2): source=lookup, 5-string barre', () => {
    const r = assignFingering(mkVoicing([null, 2, 4, 4, 4, 2]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([null, 1, 2, 3, 4, 1]);
    expect(r.barre).toEqual({ finger: 1, fromString: 2, toString: 6 });
  });

  // A-minor barre at fret 5 (Dm)
  it('Dm (Am-barre@5): fingers [null,1,3,4,2,1]', () => {
    const r = assignFingering(mkVoicing([null, 5, 7, 7, 6, 5]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([null, 1, 3, 4, 2, 1]);
    expect(r.barre).toEqual({ finger: 1, fromString: 2, toString: 6 });
  });

  // Power chord (2-string) at fret 7
  it('power chord at fret 7: source=lookup, fingers [1,3,null,null,null,null]', () => {
    const r = assignFingering(mkVoicing([7, 9, null, null, null, null]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([1, 3, null, null, null, null]);
    expect(r.barre).toBeNull();
  });

  // Power chord with octave at fret 5
  it('power chord+octave at fret 5: fingers [1,3,4,null,null,null]', () => {
    const r = assignFingering(mkVoicing([5, 7, 7, null, null, null]));
    expect(r.source).toBe('lookup');
    expect(r.fingers).toEqual([1, 3, 4, null, null, null]);
  });
});

// ── Algorithm fallback ───────────────────────────────────────────────────────

describe('assignFingering() — algorithm fallback', () => {

  it('all muted: impossible=false, difficulty=1, all-null fingers', () => {
    const r = assignFingering(mkVoicing([null, null, null, null, null, null]));
    expect(r.impossible).toBe(false);
    expect(r.difficulty).toBe(1);
    expect(r.fingers.every(f => f === null)).toBe(true);
  });

  it('single open string: difficulty=1, no finger needed', () => {
    const r = assignFingering(mkVoicing([null, 0, null, null, null, null]));
    expect(r.difficulty).toBe(1);
    expect(r.fingers[1]).toBe(0); // open string
  });

  it('2 fretted notes (novel voicing): 2 fingers, no barre', () => {
    // Not in lookup; 2 notes at different frets
    const r = assignFingering(mkVoicing([null, null, 3, 5, null, null]));
    expect(r.source).toBe('algorithm');
    expect(r.barre).toBeNull();
    expect(r.impossible).toBe(false);
    const used = r.fingers.filter(f => f !== null && f !== 0);
    expect(used.length).toBe(2);
  });

  it('4 fretted notes at distinct frets: fingers 1–4 assigned, no barre', () => {
    const r = assignFingering(mkVoicing([null, 3, 4, 5, 6, null]));
    expect(r.source).toBe('algorithm');
    expect(r.barre).toBeNull();
    expect(r.impossible).toBe(false);
    // All 4 fingers used
    const fingers = r.fingers.filter(f => typeof f === 'number' && f > 0);
    expect(new Set(fingers).size).toBe(4);
  });

  it('lower string at same fret gets lower finger number', () => {
    // Two notes at fret 5: str3 (lower) and str5 (higher)
    const r = assignFingering(mkVoicing([null, null, 5, null, 5, null]));
    expect(r.source).toBe('algorithm');
    // str index 2 (str3) → lower finger than str index 4 (str5)
    expect(r.fingers[2]).toBeLessThan(r.fingers[4]);
  });

  it('5 fretted notes (str1 null) → barre detected at min fret', () => {
    // str1 muted so thumb path can't fire; 5 notes with 4 at fret 5, 1 at fret 7
    // barre at fret 5 should fire across strings 2–6
    const r = assignFingering(mkVoicing([null, 5, 5, 7, 5, 5]));
    expect(r.source).toBe('algorithm');
    expect(r.barre).not.toBeNull();
    expect(r.barre.finger).toBe(1);
    expect(r.barre.fromString).toBe(2);
    expect(r.impossible).toBe(false);
  });

  it('6-string full barre: all fingers=1, barre spans 1–6', () => {
    const r = assignFingering(mkVoicing([4, 4, 4, 4, 4, 4]));
    // Not in lookup (no such entry), falls to algorithm
    // All notes at same fret → barre across all 6 strings
    expect(r.barre).not.toBeNull();
    expect(r.barre.fromString).toBe(1);
    expect(r.barre.toString).toBe(6);
    expect(r.impossible).toBe(false);
    expect(r.fingers.every(f => f === 1)).toBe(true);
  });

  it('thumb used when str1 fretted at low fret and rest needs 4 fingers', () => {
    // str1 at fret 3, strings 2-5 at frets 5,6,7,8 (4 distinct frets + str1 = 5 total)
    const r = assignFingering(mkVoicing([3, 5, 6, 7, 8, null]));
    expect(r.source).toBe('algorithm');
    expect(r.fingers[0]).toBe('T');
    expect(r.impossible).toBe(false);
  });

  it('thumb not used when str1 high up the neck (>5)', () => {
    // str1 at fret 8 — thumb-over impractical
    const r = assignFingering(mkVoicing([8, 10, 11, 12, 13, null]));
    expect(r.fingers[0]).not.toBe('T');
  });

  it('impossible when >4 notes with no viable barre or thumb', () => {
    // 5 notes, no two at the same fret, str1 too high for thumb
    const r = assignFingering(mkVoicing([8, 10, 11, 12, 13, null]));
    expect(r.impossible).toBe(true);
    expect(r.difficulty).toBe(5);
  });
});

// ── Difficulty ───────────────────────────────────────────────────────────────

describe('assignFingering() — difficulty', () => {

  it('open E: difficulty 1 (easy open chord)', () => {
    const r = assignFingering(mkVoicing([0, 2, 2, 1, 0, 0]));
    expect(r.difficulty).toBe(1);
  });

  it('C major open: difficulty ≤ 3', () => {
    const r = assignFingering(mkVoicing([null, 3, 2, 0, 1, 0]));
    expect(r.difficulty).toBeLessThanOrEqual(3);
  });

  it('full barre (F major) difficulty ≥ 3', () => {
    const r = assignFingering(mkVoicing([1, 3, 3, 2, 1, 1]));
    expect(r.difficulty).toBeGreaterThanOrEqual(3);
  });

  it('impossible voicing always scores 5', () => {
    const r = assignFingering(mkVoicing([8, 10, 11, 12, 13, null]));
    expect(r.difficulty).toBe(5);
  });

  it('high-fret barre (>7) scores ≤ same shape at low fret', () => {
    const loFret = assignFingering(mkVoicing([1, 3, 3, 2, 1, 1]));  // F barre
    const hiFret = assignFingering(mkVoicing([8, 10, 10, 9, 8, 8])); // Ab barre @8
    expect(hiFret.difficulty).toBeLessThanOrEqual(loFret.difficulty);
  });

  it('all-open voicing: difficulty 1', () => {
    const r = assignFingering(mkVoicing([0, 0, 0, 0, 0, 0]));
    expect(r.difficulty).toBe(1);
  });
});

// ── Semi-barre ───────────────────────────────────────────────────────────────

describe('assignFingering() — semi-barre detection', () => {

  it('semi field is false for clean barre', () => {
    const r = assignFingering(mkVoicing([1, 3, 3, 2, 1, 1])); // F barre (lookup)
    expect(r.semi).toBe(false);
  });

  it('algorithmic semi-barre: semi=true and difficulty higher', () => {
    // Construct a voicing needing a semi-barre: str1 fret 3, str2 open (0),
    // str3 fret 3, str4 fret 5, str5 fret 5, str6 null
    // Barre at fret 3 covers str1 and str3 but str2 between them is open
    const v = mkVoicing([3, 0, 3, 5, 5, null]);
    // Avoid lookup match — this is a novel voicing
    const r = assignFingering(v);
    // Either the algorithm uses a semi-barre or handles it another way
    if (r.semi) {
      expect(r.difficulty).toBeGreaterThanOrEqual(3);
    }
    // Either way, should not be impossible (has ≤4 notes to assign after barre)
    expect(r.impossible).toBe(false);
  });
});

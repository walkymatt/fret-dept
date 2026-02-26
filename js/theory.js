/**
 * theory.js — Pure music theory, instrument-agnostic.
 *
 * All notes are anchored to MIDI note numbers (middle C = C4 = MIDI 60).
 * Pitch classes are integers 0–11 (C=0, C#=1, … B=11).
 *
 * Nothing in this file knows about guitars, strings, or frets.
 */

// ---------------------------------------------------------------------------
// Note names & pitch classes
// ---------------------------------------------------------------------------

const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_NAMES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

/** Map common note name spellings → pitch class 0-11 */
const NOTE_NAME_TO_PC = (() => {
  const map = {};
  NOTE_NAMES_SHARP.forEach((n, i) => { map[n] = i; });
  NOTE_NAMES_FLAT.forEach((n, i)  => { map[n] = i; });
  // Extra enharmonics
  map['Cb'] = 11; map['Fb'] = 4;
  map['B#'] = 0;  map['E#'] = 5;
  return map;
})();

/**
 * Return the pitch class (0–11) for a MIDI note number.
 */
export function pitchClass(midi) {
  return ((midi % 12) + 12) % 12;
}

/**
 * Return the octave number for a MIDI note number (C4 = MIDI 60 → octave 4).
 */
export function octave(midi) {
  return Math.floor(midi / 12) - 1;
}

/**
 * Convert a pitch class to a note name string.
 * @param {number} pc        - Pitch class 0–11
 * @param {boolean} useFlats - Prefer flat spelling (default: sharp)
 */
export function pcToName(pc, useFlats = false) {
  return useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
}

/**
 * Convert a note name (e.g. "C#", "Eb") to its pitch class.
 * Throws if unrecognised.
 */
export function nameToPc(name) {
  const pc = NOTE_NAME_TO_PC[name];
  if (pc === undefined) throw new Error(`Unknown note name: "${name}"`);
  return pc;
}

/**
 * Convert a MIDI number to a human-readable note name with octave,
 * e.g. MIDI 60 → "C4".
 */
export function midiToName(midi, useFlats = false) {
  return `${pcToName(pitchClass(midi), useFlats)}${octave(midi)}`;
}

/**
 * Convert a note name + octave to a MIDI number, e.g. ("C", 4) → 60.
 */
export function nameToMidi(noteName, oct) {
  return (oct + 1) * 12 + nameToPc(noteName);
}

// ---------------------------------------------------------------------------
// Intervals (semitone distances from root)
// ---------------------------------------------------------------------------

export const INTERVALS = Object.freeze({
  UNISON:           0,
  MINOR_SECOND:     1,
  MAJOR_SECOND:     2,
  MINOR_THIRD:      3,
  MAJOR_THIRD:      4,
  PERFECT_FOURTH:   5,
  TRITONE:          6,
  PERFECT_FIFTH:    7,
  MINOR_SIXTH:      8,
  MAJOR_SIXTH:      9,
  MINOR_SEVENTH:   10,
  MAJOR_SEVENTH:   11,
  OCTAVE:          12,
});

// ---------------------------------------------------------------------------
// Scale definitions
// ---------------------------------------------------------------------------

/**
 * Each scale is defined as an array of semitone intervals from the root.
 * Index 0 is always 0 (the root itself).
 */
export const SCALES = Object.freeze({
  major:              [0, 2, 4, 5, 7, 9, 11],
  natural_minor:      [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor:     [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:      [0, 2, 3, 5, 7, 9, 11],   // ascending form
  pentatonic_major:   [0, 2, 4, 7, 9],
  pentatonic_minor:   [0, 3, 5, 7, 10],
  blues:              [0, 3, 5, 6, 7, 10],
  dorian:             [0, 2, 3, 5, 7, 9, 10],
  phrygian:           [0, 1, 3, 5, 7, 8, 10],
  lydian:             [0, 2, 4, 6, 7, 9, 11],
  mixolydian:         [0, 2, 4, 5, 7, 9, 10],
  locrian:            [0, 1, 3, 5, 6, 8, 10],
  whole_tone:         [0, 2, 4, 6, 8, 10],
  diminished_wh:      [0, 2, 3, 5, 6, 8, 9, 11],  // whole-half
  diminished_hw:      [0, 1, 3, 4, 6, 7, 9, 10],  // half-whole
});

/** Human-readable display names for scale keys */
export const SCALE_LABELS = Object.freeze({
  major:            'Major',
  natural_minor:    'Natural Minor',
  harmonic_minor:   'Harmonic Minor',
  melodic_minor:    'Melodic Minor (asc.)',
  pentatonic_major: 'Major Pentatonic',
  pentatonic_minor: 'Minor Pentatonic',
  blues:            'Blues',
  dorian:           'Dorian',
  phrygian:         'Phrygian',
  lydian:           'Lydian',
  mixolydian:       'Mixolydian',
  locrian:          'Locrian',
  whole_tone:       'Whole Tone',
  diminished_wh:    'Diminished (W-H)',
  diminished_hw:    'Diminished (H-W)',
});

/**
 * Return the pitch classes that make up a scale.
 *
 * @param {number} rootPc  - Root pitch class (0–11)
 * @param {string} scaleName - Key from SCALES
 * @returns {number[]} Array of pitch classes (0–11), starting from root
 */
export function getScalePitchClasses(rootPc, scaleName) {
  const intervals = SCALES[scaleName];
  if (!intervals) throw new Error(`Unknown scale: "${scaleName}"`);
  return intervals.map(i => (rootPc + i) % 12);
}

/**
 * Return the scale degree (1-indexed) of a pitch class within a scale,
 * or null if it is not in the scale.
 */
export function scaleDegree(pc, rootPc, scaleName) {
  const pcs = getScalePitchClasses(rootPc, scaleName);
  const idx = pcs.indexOf(((pc % 12) + 12) % 12);
  return idx === -1 ? null : idx + 1;
}

// ---------------------------------------------------------------------------
// Chord definitions
// ---------------------------------------------------------------------------

/**
 * Each chord is defined as:
 *   intervals: semitones from root for each chord tone
 *   degrees:   scale-degree label for each tone (for display)
 */
export const CHORDS = Object.freeze({
  major:       { intervals: [0, 4, 7],        degrees: ['1','3','5'] },
  minor:       { intervals: [0, 3, 7],        degrees: ['1','b3','5'] },
  diminished:  { intervals: [0, 3, 6],        degrees: ['1','b3','b5'] },
  augmented:   { intervals: [0, 4, 8],        degrees: ['1','3','#5'] },
  sus2:        { intervals: [0, 2, 7],        degrees: ['1','2','5'] },
  sus4:        { intervals: [0, 5, 7],        degrees: ['1','4','5'] },
  dominant7:   { intervals: [0, 4, 7, 10],   degrees: ['1','3','5','b7'] },
  major7:      { intervals: [0, 4, 7, 11],   degrees: ['1','3','5','7'] },
  minor7:      { intervals: [0, 3, 7, 10],   degrees: ['1','b3','5','b7'] },
  minorMajor7: { intervals: [0, 3, 7, 11],   degrees: ['1','b3','5','7'] },
  diminished7: { intervals: [0, 3, 6, 9],    degrees: ['1','b3','b5','bb7'] },
  halfDim7:    { intervals: [0, 3, 6, 10],   degrees: ['1','b3','b5','b7'] },
  augmented7:  { intervals: [0, 4, 8, 10],   degrees: ['1','3','#5','b7'] },
  dominant9:   { intervals: [0, 4, 7, 10, 14], degrees: ['1','3','5','b7','9'] },
  major9:      { intervals: [0, 4, 7, 11, 14], degrees: ['1','3','5','7','9'] },
  minor9:      { intervals: [0, 3, 7, 10, 14], degrees: ['1','b3','5','b7','9'] },
  add9:        { intervals: [0, 4, 7, 14],   degrees: ['1','3','5','9'] },
  dominant6:   { intervals: [0, 4, 7, 9],    degrees: ['1','3','5','6'] },
  minor6:      { intervals: [0, 3, 7, 9],    degrees: ['1','b3','5','6'] },
  power:       { intervals: [0, 7],           degrees: ['1','5'] },
});

/** Human-readable display names for chord keys */
export const CHORD_LABELS = Object.freeze({
  major:       'Major',
  minor:       'Minor',
  diminished:  'Diminished',
  augmented:   'Augmented',
  sus2:        'Sus2',
  sus4:        'Sus4',
  dominant7:   'Dominant 7th',
  major7:      'Major 7th',
  minor7:      'Minor 7th',
  minorMajor7: 'Minor/Major 7th',
  diminished7: 'Diminished 7th',
  halfDim7:    'Half-Diminished 7th',
  augmented7:  'Augmented 7th',
  dominant9:   'Dominant 9th',
  major9:      'Major 9th',
  minor9:      'Minor 9th',
  add9:        'Add 9',
  dominant6:   'Dominant 6th',
  minor6:      'Minor 6th',
  power:       'Power Chord',
});

/**
 * Return the pitch classes for a chord.
 *
 * @param {number} rootPc   - Root pitch class (0–11)
 * @param {string} chordName - Key from CHORDS
 * @returns {{ pitchClasses: number[], degrees: string[] }}
 */
export function getChordPitchClasses(rootPc, chordName) {
  const chord = CHORDS[chordName];
  if (!chord) throw new Error(`Unknown chord: "${chordName}"`);
  return {
    pitchClasses: chord.intervals.map(i => (rootPc + i) % 12),
    degrees: chord.degrees,
  };
}

/**
 * Return a chord inversion.
 *
 * Inversion 0 = root position, 1 = first inversion (3rd in bass),
 * 2 = second inversion (5th in bass), etc.
 *
 * Returns the same structure as getChordPitchClasses but with the
 * degrees array rotated so callers know which degree is the bass note.
 */
export function getChordInversion(rootPc, chordName, inversion) {
  const chord = CHORDS[chordName];
  if (!chord) throw new Error(`Unknown chord: "${chordName}"`);
  const n = chord.intervals.length;
  const inv = ((inversion % n) + n) % n;

  // Rotate intervals: the chosen tone becomes the new bass (interval 0),
  // tones below it are bumped up an octave.
  const rotated = [...chord.intervals.slice(inv), ...chord.intervals.slice(0, inv)];
  const bassInterval = rotated[0];
  const normalised = rotated.map(i => (i - bassInterval + 12) % 12);

  const degreesRotated = [...chord.degrees.slice(inv), ...chord.degrees.slice(0, inv)];

  return {
    pitchClasses: normalised.map(i => (rootPc + i) % 12),
    degrees: degreesRotated,
    bassNote: (rootPc + chord.intervals[inv]) % 12,
  };
}

// ---------------------------------------------------------------------------
// Key relationships
// ---------------------------------------------------------------------------

/**
 * Return the pitch class of the relative minor for a major key root.
 * (Down a minor third / up a major sixth — the 6th degree.)
 */
export function relativeMinor(majorRootPc) {
  return (majorRootPc + 9) % 12;
}

/**
 * Return the pitch class of the relative major for a minor key root.
 * (Up a minor third — the 3rd degree.)
 */
export function relativeMajor(minorRootPc) {
  return (minorRootPc + 3) % 12;
}

/**
 * Return the pitch class of the parallel minor (same root, minor scale).
 * Trivially the same root; included for symmetry and explicitness.
 */
export function parallelMinor(majorRootPc) {
  return majorRootPc;
}

/**
 * Return the diatonic chords (triads) for a major or natural minor scale.
 * Returns an array of { degree, romanNumeral, rootPc, chordName } objects.
 */
export function diatonicChords(rootPc, scaleName = 'major') {
  const pcs = getScalePitchClasses(rootPc, scaleName);
  if (pcs.length < 7) throw new Error(`Scale "${scaleName}" does not support diatonic chord analysis`);

  // For each scale degree, determine whether the triad is major/minor/diminished
  // by checking the third and fifth against the scale.
  return pcs.map((degRoot, idx) => {
    const third = (degRoot + 3) % 12;
    const majorThird = (degRoot + 4) % 12;
    const fifth = (degRoot + 7) % 12;
    const dimFifth = (degRoot + 6) % 12;

    const hasMajorThird = pcs.includes(majorThird);
    const hasMinorThird = pcs.includes(third);
    const hasPerfectFifth = pcs.includes(fifth);
    const hasDimFifth = pcs.includes(dimFifth);

    let chordName;
    if (hasMajorThird && hasPerfectFifth) chordName = 'major';
    else if (hasMinorThird && hasPerfectFifth) chordName = 'minor';
    else if (hasMinorThird && hasDimFifth) chordName = 'diminished';
    else chordName = 'unknown';

    const ROMAN = ['I','II','III','IV','V','VI','VII'];
    const roman = chordName === 'minor' || chordName === 'diminished'
      ? ROMAN[idx].toLowerCase()
      : ROMAN[idx];
    const suffix = chordName === 'diminished' ? '°' : '';

    return { degree: idx + 1, romanNumeral: roman + suffix, rootPc: degRoot, chordName };
  });
}

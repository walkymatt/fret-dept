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

export const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const NOTE_NAMES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

const NOTE_NAME_TO_PC = (() => {
  const map = {};
  NOTE_NAMES_SHARP.forEach((n, i) => { map[n] = i; });
  NOTE_NAMES_FLAT.forEach((n, i)  => { map[n] = i; });
  map['Cb'] = 11; map['Fb'] = 4;
  map['B#'] = 0;  map['E#'] = 5;
  return map;
})();

export function pitchClass(midi) {
  return ((midi % 12) + 12) % 12;
}

export function octave(midi) {
  return Math.floor(midi / 12) - 1;
}

export function pcToName(pc, useFlats = false) {
  return useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
}

export function nameToPc(name) {
  const pc = NOTE_NAME_TO_PC[name];
  if (pc === undefined) throw new Error(`Unknown note name: "${name}"`);
  return pc;
}

export function midiToName(midi, useFlats = false) {
  return `${pcToName(pitchClass(midi), useFlats)}${octave(midi)}`;
}

export function nameToMidi(noteName, oct) {
  return (oct + 1) * 12 + nameToPc(noteName);
}

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

export const INTERVALS = Object.freeze({
  UNISON:          0,
  MINOR_SECOND:    1,
  MAJOR_SECOND:    2,
  MINOR_THIRD:     3,
  MAJOR_THIRD:     4,
  PERFECT_FOURTH:  5,
  TRITONE:         6,
  PERFECT_FIFTH:   7,
  MINOR_SIXTH:     8,
  MAJOR_SIXTH:     9,
  MINOR_SEVENTH:  10,
  MAJOR_SEVENTH:  11,
  OCTAVE:         12,
});

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

export const SCALES = Object.freeze({
  major:              [0, 2, 4, 5, 7, 9, 11],
  natural_minor:      [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor:     [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:      [0, 2, 3, 5, 7, 9, 11],
  pentatonic_major:   [0, 2, 4, 7, 9],
  pentatonic_minor:   [0, 3, 5, 7, 10],
  blues:              [0, 3, 5, 6, 7, 10],
  dorian:             [0, 2, 3, 5, 7, 9, 10],
  phrygian:           [0, 1, 3, 5, 7, 8, 10],
  lydian:             [0, 2, 4, 6, 7, 9, 11],
  mixolydian:         [0, 2, 4, 5, 7, 9, 10],
  locrian:            [0, 1, 3, 5, 6, 8, 10],
  whole_tone:              [0, 2, 4, 6, 8, 10],
  diminished_wh:           [0, 2, 3, 5, 6, 8, 9, 11],
  diminished_hw:           [0, 1, 3, 4, 6, 7, 9, 10],
  phrygian_dominant:       [0, 1, 4, 5, 7, 8, 10],
  double_harmonic_major:   [0, 1, 4, 5, 7, 8, 11],
  double_harmonic_minor:   [0, 2, 3, 6, 7, 8, 11],
});

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
  whole_tone:             'Whole Tone',
  diminished_wh:          'Diminished (W-H)',
  diminished_hw:          'Diminished (H-W)',
  phrygian_dominant:      'Phrygian Dominant',
  double_harmonic_major:  'Double Harmonic Major',
  double_harmonic_minor:  'Double Harmonic Minor',
});

export function getScalePitchClasses(rootPc, scaleName) {
  const intervals = SCALES[scaleName];
  if (!intervals) throw new Error(`Unknown scale: "${scaleName}"`);
  return intervals.map(i => (rootPc + i) % 12);
}

export function scaleDegree(pc, rootPc, scaleName) {
  const pcs = getScalePitchClasses(rootPc, scaleName);
  const idx = pcs.indexOf(((pc % 12) + 12) % 12);
  return idx === -1 ? null : idx + 1;
}

// ---------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------

export const CHORDS = Object.freeze({
  major:       { intervals: [0, 4, 7],         degrees: ['1','3','5'] },
  minor:       { intervals: [0, 3, 7],         degrees: ['1','b3','5'] },
  diminished:  { intervals: [0, 3, 6],         degrees: ['1','b3','b5'] },
  augmented:   { intervals: [0, 4, 8],         degrees: ['1','3','#5'] },
  sus2:        { intervals: [0, 2, 7],         degrees: ['1','2','5'] },
  sus4:        { intervals: [0, 5, 7],         degrees: ['1','4','5'] },
  dominant7:   { intervals: [0, 4, 7, 10],     degrees: ['1','3','5','b7'] },
  major7:      { intervals: [0, 4, 7, 11],     degrees: ['1','3','5','7'] },
  minor7:      { intervals: [0, 3, 7, 10],     degrees: ['1','b3','5','b7'] },
  minorMajor7: { intervals: [0, 3, 7, 11],     degrees: ['1','b3','5','7'] },
  diminished7: { intervals: [0, 3, 6, 9],      degrees: ['1','b3','b5','bb7'] },
  halfDim7:    { intervals: [0, 3, 6, 10],     degrees: ['1','b3','b5','b7'] },
  augmented7:  { intervals: [0, 4, 8, 10],     degrees: ['1','3','#5','b7'] },
  dominant9:   { intervals: [0, 4, 7, 10, 14], degrees: ['1','3','5','b7','9'] },
  major9:      { intervals: [0, 4, 7, 11, 14], degrees: ['1','3','5','7','9'] },
  minor9:      { intervals: [0, 3, 7, 10, 14], degrees: ['1','b3','5','b7','9'] },
  add9:        { intervals: [0, 4, 7, 14],     degrees: ['1','3','5','9'] },
  dominant6:   { intervals: [0, 4, 7, 9],      degrees: ['1','3','5','6'] },
  minor6:      { intervals: [0, 3, 7, 9],      degrees: ['1','b3','5','6'] },
  power:       { intervals: [0, 7],            degrees: ['1','5'] },
});

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

export function getChordPitchClasses(rootPc, chordName) {
  const chord = CHORDS[chordName];
  if (!chord) throw new Error(`Unknown chord: "${chordName}"`);
  return {
    pitchClasses: chord.intervals.map(i => (rootPc + i) % 12),
    degrees: chord.degrees,
  };
}

export function getChordInversion(rootPc, chordName, inversion) {
  const chord = CHORDS[chordName];
  if (!chord) throw new Error(`Unknown chord: "${chordName}"`);
  const n   = chord.intervals.length;
  const inv = ((inversion % n) + n) % n;

  const originalPcs = chord.intervals.map(i => (rootPc + i) % 12);
  const pitchClasses = [...originalPcs.slice(inv), ...originalPcs.slice(0, inv)];
  const degrees      = [...chord.degrees.slice(inv), ...chord.degrees.slice(0, inv)];

  return { pitchClasses, degrees, bassNote: originalPcs[inv] };
}

// ---------------------------------------------------------------------------
// Key relationships
// ---------------------------------------------------------------------------

export function relativeMinor(majorRootPc) {
  return (majorRootPc + 9) % 12;
}

export function relativeMajor(minorRootPc) {
  return (minorRootPc + 3) % 12;
}

export function parallelMinor(majorRootPc) {
  return majorRootPc;
}

export function diatonicChords(rootPc, scaleName = 'major') {
  const pcs = getScalePitchClasses(rootPc, scaleName);
  if (pcs.length < 7) throw new Error(`Scale "${scaleName}" does not support diatonic chord analysis`);

  return pcs.map((degRoot, idx) => {
    const majorThird   = (degRoot + 4) % 12;
    const minorThird   = (degRoot + 3) % 12;
    const perfectFifth = (degRoot + 7) % 12;
    const dimFifth     = (degRoot + 6) % 12;

    const hasMajorThird   = pcs.includes(majorThird);
    const hasMinorThird   = pcs.includes(minorThird);
    const hasPerfectFifth = pcs.includes(perfectFifth);
    const hasDimFifth     = pcs.includes(dimFifth);

    let chordName;
    if      (hasMajorThird && hasPerfectFifth) chordName = 'major';
    else if (hasMinorThird && hasPerfectFifth) chordName = 'minor';
    else if (hasMinorThird && hasDimFifth)     chordName = 'diminished';
    else                                        chordName = 'unknown';

    const ROMAN  = ['I','II','III','IV','V','VI','VII'];
    const roman  = (chordName === 'minor' || chordName === 'diminished')
      ? ROMAN[idx].toLowerCase() : ROMAN[idx];
    const suffix = chordName === 'diminished' ? '°' : '';

    return { degree: idx + 1, romanNumeral: roman + suffix, rootPc: degRoot, chordName };
  });
}

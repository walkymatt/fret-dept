import { describe, it, expect } from 'bun:test';
import {
  NOTE_NAMES_SHARP, NOTE_NAMES_FLAT,
  pitchClass, octave, pcToName, nameToPc, midiToName, nameToMidi,
  INTERVALS,
  SCALES, SCALE_LABELS, getScalePitchClasses, scaleDegree,
  CHORDS, CHORD_LABELS, getChordPitchClasses, getChordInversion,
  relativeMinor, relativeMajor, parallelMinor, diatonicChords,
} from '../js/theory.js';

describe('NOTE_NAMES_SHARP / NOTE_NAMES_FLAT', () => {
  it('has 12 sharp note names', () => expect(NOTE_NAMES_SHARP.length).toBe(12));
  it('has 12 flat note names',  () => expect(NOTE_NAMES_FLAT.length).toBe(12));
  it('sharp: C…B', () => { expect(NOTE_NAMES_SHARP[0]).toBe('C'); expect(NOTE_NAMES_SHARP[11]).toBe('B'); });
  it('flat:  C…B', () => { expect(NOTE_NAMES_FLAT[0]).toBe('C');  expect(NOTE_NAMES_FLAT[11]).toBe('B'); });
  it('sharp contains C# not Db', () => { expect(NOTE_NAMES_SHARP).toContain('C#'); expect(NOTE_NAMES_SHARP).not.toContain('Db'); });
  it('flat contains Db not C#',  () => { expect(NOTE_NAMES_FLAT).toContain('Db');  expect(NOTE_NAMES_FLAT).not.toContain('C#'); });
});

describe('pitchClass()', () => {
  it('MIDI 60 → 0',  () => expect(pitchClass(60)).toBe(0));
  it('MIDI 61 → 1',  () => expect(pitchClass(61)).toBe(1));
  it('MIDI 71 → 11', () => expect(pitchClass(71)).toBe(11));
  it('MIDI 72 → 0',  () => expect(pitchClass(72)).toBe(0));
  it('MIDI 0  → 0',  () => expect(pitchClass(0)).toBe(0));
  it('MIDI 11 → 11', () => expect(pitchClass(11)).toBe(11));
  it('MIDI 12 → 0',  () => expect(pitchClass(12)).toBe(0));
  it('negative wraps correctly', () => expect(pitchClass(-1)).toBe(11));
  it('MIDI 127 → 7 (G)',         () => expect(pitchClass(127)).toBe(7));
});

describe('octave()', () => {
  it('MIDI 60 → 4',  () => expect(octave(60)).toBe(4));
  it('MIDI 48 → 3',  () => expect(octave(48)).toBe(3));
  it('MIDI 72 → 5',  () => expect(octave(72)).toBe(5));
  it('MIDI 0  → -1', () => expect(octave(0)).toBe(-1));
  it('MIDI 12 → 0',  () => expect(octave(12)).toBe(0));
  it('MIDI 24 → 1',  () => expect(octave(24)).toBe(1));
});

describe('pcToName()', () => {
  it('pc 0 sharp → C',   () => expect(pcToName(0)).toBe('C'));
  it('pc 1 sharp → C#',  () => expect(pcToName(1)).toBe('C#'));
  it('pc 1 flat  → Db',  () => expect(pcToName(1, true)).toBe('Db'));
  it('pc 11 sharp → B',  () => expect(pcToName(11)).toBe('B'));
  it('pc 10 flat  → Bb', () => expect(pcToName(10, true)).toBe('Bb'));
  it('pc 10 sharp → A#', () => expect(pcToName(10)).toBe('A#'));
  it('all 12 sharp names are distinct', () => {
    expect(new Set(Array.from({length:12}, (_,i) => pcToName(i))).size).toBe(12);
  });
});

describe('nameToPc()', () => {
  const cases = [
    ['C',0],['C#',1],['Db',1],['D',2],['D#',3],['Eb',3],
    ['E',4],['F',5],['F#',6],['Gb',6],['G',7],['G#',8],['Ab',8],
    ['A',9],['A#',10],['Bb',10],['B',11],
    ['B#',0],['Cb',11],['E#',5],['Fb',4],
  ];
  cases.forEach(([name, pc]) => {
    it(`${name} → ${pc}`, () => expect(nameToPc(name)).toBe(pc));
  });
  it('throws on unknown name', () => expect(() => nameToPc('X')).toThrow());
});

describe('midiToName()', () => {
  it('60 → C4',       () => expect(midiToName(60)).toBe('C4'));
  it('61 → C#4',      () => expect(midiToName(61)).toBe('C#4'));
  it('61 flat → Db4', () => expect(midiToName(61, true)).toBe('Db4'));
  it('69 → A4',       () => expect(midiToName(69)).toBe('A4'));
  it('48 → C3',       () => expect(midiToName(48)).toBe('C3'));
  it('127 → G9',      () => expect(midiToName(127)).toBe('G9'));
});

describe('nameToMidi()', () => {
  const cases = [['C',4,60],['A',4,69],['E',2,40],['A',2,45],['D',3,50],['G',3,55],['B',3,59],['E',4,64]];
  cases.forEach(([n,oct,midi]) => it(`${n}${oct} → ${midi}`, () => expect(nameToMidi(n,oct)).toBe(midi)));
  it('round-trips with midiToName for MIDI 21–108', () => {
    for (let m = 21; m <= 108; m++) {
      const name     = midiToName(m);
      const notePart = name.replace(/-?\d+$/, '');
      const octPart  = parseInt(name.match(/-?\d+$/)[0], 10);
      expect(nameToMidi(notePart, octPart)).toBe(m);
    }
  });
});

describe('INTERVALS', () => {
  it('UNISON=0',        () => expect(INTERVALS.UNISON).toBe(0));
  it('PERFECT_FIFTH=7', () => expect(INTERVALS.PERFECT_FIFTH).toBe(7));
  it('OCTAVE=12',       () => expect(INTERVALS.OCTAVE).toBe(12));
  it('MAJOR_THIRD=4',   () => expect(INTERVALS.MAJOR_THIRD).toBe(4));
  it('MINOR_THIRD=3',   () => expect(INTERVALS.MINOR_THIRD).toBe(3));
  it('TRITONE=6',       () => expect(INTERVALS.TRITONE).toBe(6));
});

describe('getScalePitchClasses()', () => {
  it('C major = [0,2,4,5,7,9,11]',     () => expect(getScalePitchClasses(0, 'major')).toEqual([0,2,4,5,7,9,11]));
  it('G major = [7,9,11,0,2,4,6]',     () => expect(getScalePitchClasses(7, 'major')).toEqual([7,9,11,0,2,4,6]));
  it('A nat.minor = [9,11,0,2,4,5,7]', () => expect(getScalePitchClasses(9, 'natural_minor')).toEqual([9,11,0,2,4,5,7]));
  it('C harm.minor = [0,2,3,5,7,8,11]',() => expect(getScalePitchClasses(0, 'harmonic_minor')).toEqual([0,2,3,5,7,8,11]));
  it('C maj.pent = [0,2,4,7,9]',        () => expect(getScalePitchClasses(0, 'pentatonic_major')).toEqual([0,2,4,7,9]));
  it('A min.pent = [9,0,2,4,7]',        () => expect(getScalePitchClasses(9, 'pentatonic_minor')).toEqual([9,0,2,4,7]));
  it('C blues = [0,3,5,6,7,10]',        () => expect(getScalePitchClasses(0, 'blues')).toEqual([0,3,5,6,7,10]));
  it('C dorian = [0,2,3,5,7,9,10]',     () => expect(getScalePitchClasses(0, 'dorian')).toEqual([0,2,3,5,7,9,10]));
  it('C mixolydian = [0,2,4,5,7,9,10]', () => expect(getScalePitchClasses(0, 'mixolydian')).toEqual([0,2,4,5,7,9,10]));
  it('all scales start at rootPc', () => {
    for (const name of Object.keys(SCALES)) expect(getScalePitchClasses(3, name)[0]).toBe(3);
  });
  it('all pcs in 0–11', () => {
    for (const name of Object.keys(SCALES))
      expect(getScalePitchClasses(0, name).every(pc => pc >= 0 && pc <= 11)).toBe(true);
  });
  it('throws on unknown scale',               () => expect(() => getScalePitchClasses(0, 'noscale')).toThrow());
  it('every scale has a SCALE_LABELS entry',  () => {
    for (const name of Object.keys(SCALES)) expect(SCALE_LABELS[name]).toBeTruthy();
  });
});

describe('scaleDegree()', () => {
  it('C=1 in C major',       () => expect(scaleDegree(0, 0, 'major')).toBe(1));
  it('D=2 in C major',       () => expect(scaleDegree(2, 0, 'major')).toBe(2));
  it('E=3 in C major',       () => expect(scaleDegree(4, 0, 'major')).toBe(3));
  it('G=5 in C major',       () => expect(scaleDegree(7, 0, 'major')).toBe(5));
  it('B=7 in C major',       () => expect(scaleDegree(11, 0, 'major')).toBe(7));
  it('C# not in C major → null', () => expect(scaleDegree(1, 0, 'major')).toBe(null));
  it('Bb not in C major → null', () => expect(scaleDegree(10, 0, 'major')).toBe(null));
  it('A=1 in A min pent',    () => expect(scaleDegree(9, 9, 'pentatonic_minor')).toBe(1));
});

describe('getChordPitchClasses()', () => {
  it('C major → [0,4,7] degrees [1,3,5]', () => {
    const r = getChordPitchClasses(0, 'major');
    expect(r.pitchClasses).toEqual([0,4,7]);
    expect(r.degrees).toEqual(['1','3','5']);
  });
  it('C minor → [0,3,7]',             () => expect(getChordPitchClasses(0,'minor').pitchClasses).toEqual([0,3,7]));
  it('G major → [7,11,2]',            () => expect(getChordPitchClasses(7,'major').pitchClasses).toEqual([7,11,2]));
  it('A minor → [9,0,4]',             () => expect(getChordPitchClasses(9,'minor').pitchClasses).toEqual([9,0,4]));
  it('C dim → [0,3,6]',               () => expect(getChordPitchClasses(0,'diminished').pitchClasses).toEqual([0,3,6]));
  it('C dom7 → [0,4,7,10]',           () => expect(getChordPitchClasses(0,'dominant7').pitchClasses).toEqual([0,4,7,10]));
  it('C maj7 → [0,4,7,11]',           () => expect(getChordPitchClasses(0,'major7').pitchClasses).toEqual([0,4,7,11]));
  it('C power → [0,7]',               () => expect(getChordPitchClasses(0,'power').pitchClasses).toEqual([0,7]));
  it('Bb dom7 wraps → [10,2,5,8]',    () => expect(getChordPitchClasses(10,'dominant7').pitchClasses).toEqual([10,2,5,8]));
  it('all pcs in 0–11',               () => {
    for (const name of Object.keys(CHORDS))
      expect(getChordPitchClasses(0,name).pitchClasses.every(pc=>pc>=0&&pc<=11)).toBe(true);
  });
  it('every chord has a CHORD_LABELS entry', () => {
    for (const name of Object.keys(CHORDS)) expect(CHORD_LABELS[name]).toBeTruthy();
  });
  it('throws on unknown chord', () => expect(() => getChordPitchClasses(0,'nochord')).toThrow());
});

describe('getChordInversion()', () => {
  it('inv 0 = root position',                    () => { const r = getChordInversion(0,'major',0); expect(r.pitchClasses).toEqual([0,4,7]); expect(r.bassNote).toBe(0); });
  it('inv 1 C major: E bass → [4,7,0]',          () => { const r = getChordInversion(0,'major',1); expect(r.pitchClasses).toEqual([4,7,0]); expect(r.bassNote).toBe(4); expect(r.degrees[0]).toBe('3'); });
  it('inv 2 C major: G bass → [7,0,4]',          () => { const r = getChordInversion(0,'major',2); expect(r.pitchClasses).toEqual([7,0,4]); expect(r.bassNote).toBe(7); expect(r.degrees[0]).toBe('5'); });
  it('inv 3 wraps to inv 0 for triad',           () => expect(getChordInversion(0,'major',3).pitchClasses).toEqual(getChordInversion(0,'major',0).pitchClasses));
  it('inv 1 C minor7: Eb bass → [3,7,10,0]',    () => { const r = getChordInversion(0,'minor7',1); expect(r.pitchClasses).toEqual([3,7,10,0]); expect(r.bassNote).toBe(3); });
  it('inv 3 C dom7: Bb bass → [10,0,4,7]',      () => { const r = getChordInversion(0,'dominant7',3); expect(r.pitchClasses).toEqual([10,0,4,7]); expect(r.bassNote).toBe(10); });
  it('all pcs remain in 0–11',                   () => expect(getChordInversion(9,'dominant7',2).pitchClasses.every(pc=>pc>=0&&pc<=11)).toBe(true));
});

describe('relativeMinor()', () => {
  it('C→A(9)',    () => expect(relativeMinor(0)).toBe(9));
  it('G→E(4)',    () => expect(relativeMinor(7)).toBe(4));
  it('F→D(2)',    () => expect(relativeMinor(5)).toBe(2));
  it('Bb→G(7)',   () => expect(relativeMinor(10)).toBe(7));
  it('always 0–11', () => { for(let p=0;p<12;p++) expect(relativeMinor(p)>=0&&relativeMinor(p)<=11).toBe(true); });
});

describe('relativeMajor()', () => {
  it('A→C(0)',  () => expect(relativeMajor(9)).toBe(0));
  it('E→G(7)',  () => expect(relativeMajor(4)).toBe(7));
  it('D→F(5)',  () => expect(relativeMajor(2)).toBe(5));
  it('is inverse of relativeMinor', () => { for(let p=0;p<12;p++) expect(relativeMajor(relativeMinor(p))).toBe(p); });
});

describe('parallelMinor()', () => {
  it('returns same pitch class', () => { for(let p=0;p<12;p++) expect(parallelMinor(p)).toBe(p); });
});

describe('diatonicChords()', () => {
  it('C major: 7 chords', () => expect(diatonicChords(0,'major').length).toBe(7));
  it('C major: roman numerals', () => expect(diatonicChords(0,'major').map(c=>c.romanNumeral)).toEqual(['I','ii','iii','IV','V','vi','vii°']));
  it('C major: chord types',    () => {
    const dc = diatonicChords(0,'major');
    ['major','minor','minor','major','major','minor','diminished'].forEach((t,i)=>expect(dc[i].chordName).toBe(t));
  });
  it('C major: root pcs', () => {
    const dc = diatonicChords(0,'major');
    [0,2,4,5,7,9,11].forEach((pc,i) => expect(dc[i].rootPc).toBe(pc));
  });
  it('A nat.minor: roman numerals', () => expect(diatonicChords(9,'natural_minor').map(c=>c.romanNumeral)).toEqual(['i','ii°','III','iv','v','VI','VII']));
  it('A nat.minor: chord types',    () => {
    const dc = diatonicChords(9,'natural_minor');
    ['minor','diminished','major','minor','minor','major','major'].forEach((t,i)=>expect(dc[i].chordName).toBe(t));
  });
  it('G major V = D(2)',            () => expect(diatonicChords(7,'major')[4].rootPc).toBe(2));
  it('throws for pentatonic',       () => expect(()=>diatonicChords(0,'pentatonic_major')).toThrow());
  it('degree is 1-indexed',         () => diatonicChords(0,'major').forEach((c,i)=>expect(c.degree).toBe(i+1)));
});

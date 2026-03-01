import { describe, it, expect } from 'bun:test';
import {
  parseTuning, buildFretboardMap, findPositions,
  findBoxVoicing, filterByFretRange,
  scoreVoicing, findBestVoicingInWindow,
  findVoicingsAcrossNeck, identifyCagedShape,
  findScalePositions,
  TUNINGS, TUNING_LABELS,
} from '../js/fretboard.js';
import { getScalePitchClasses, nameToPc } from '../js/theory.js';

const STD = TUNINGS.standard;

describe('parseTuning()', () => {
  it('accepts 6 MIDI numbers',   () => expect(parseTuning([40,45,50,55,59,64])).toEqual([40,45,50,55,59,64]));
  it('parses standard as MIDI',  () => expect(parseTuning(STD)).toEqual([40,45,50,55,59,64]));
  it('parses C#2 = MIDI 37',     () => expect(parseTuning(['C#2','A2','D3','G3','B3','E4'])[0]).toBe(37));
  it('parses Eb2 = MIDI 39',     () => expect(parseTuning(['Eb2','Ab2','Db3','Gb3','Bb3','Eb4'])[0]).toBe(39));
  it('throws for <6 elements',   () => expect(()=>parseTuning(['E2','A2'])).toThrow());
  it('throws for bad note name', () => expect(()=>parseTuning(['E2','A2','D3','G3','B3','ZZ4'])).toThrow());
  it('C0 = MIDI 12',             () => expect(parseTuning(['C0','C0','C0','C0','C0','C0'])[0]).toBe(12));
});

describe('TUNINGS', () => {
  it('standard exists',              () => expect(TUNINGS.standard).toBeDefined());
  it('all have 6 strings',           () => { for(const s of Object.values(TUNINGS)) expect(s.length).toBe(6); });
  it('every key has a label',        () => { for(const k of Object.keys(TUNINGS)) expect(TUNING_LABELS[k]).toBeTruthy(); });
  it('standard MIDI = [40,45,50,55,59,64]', () => expect(parseTuning(STD)).toEqual([40,45,50,55,59,64]));
  it('drop_d string 1 = std-2, rest same', () => {
    const s = parseTuning(STD), d = parseTuning(TUNINGS.drop_d);
    expect(d[0]).toBe(s[0]-2);
    for(let i=1;i<6;i++) expect(d[i]).toBe(s[i]);
  });
  it('half_step_down = std-1 each',  () => { const s=parseTuning(STD),h=parseTuning(TUNINGS.half_step_down); for(let i=0;i<6;i++) expect(h[i]).toBe(s[i]-1); });
  it('full_step_down = std-2 each',  () => { const s=parseTuning(STD),f=parseTuning(TUNINGS.full_step_down); for(let i=0;i<6;i++) expect(f[i]).toBe(s[i]-2); });
});

describe('buildFretboardMap()', () => {
  it('returns 6 strings',                () => expect(buildFretboardMap(STD,12).length).toBe(6));
  it('each string has maxFret+1 entries',() => { for(const s of buildFretboardMap(STD,12)) expect(s.length).toBe(13); });
  it('fret 0 = open MIDI',              () => { const midi=parseTuning(STD),map=buildFretboardMap(STD,12); for(let s=0;s<6;s++) expect(map[s][0]).toBe(midi[s]); });
  it('each fret +1 semitone',           () => { for(const s of buildFretboardMap(STD,12)) for(let f=1;f<s.length;f++) expect(s[f]).toBe(s[f-1]+1); });
  it('str0 fret5 = A2 = 45',           () => expect(buildFretboardMap(STD,12)[0][5]).toBe(45));
  it('str0 fret12 = E3 = 52',          () => expect(buildFretboardMap(STD,12)[0][12]).toBe(52));
  it('str5 fret0 = E4 = 64',           () => expect(buildFretboardMap(STD,12)[5][0]).toBe(64));
  it('str5 fret12 = E5 = 76',          () => expect(buildFretboardMap(STD,12)[5][12]).toBe(76));
  it('respects maxFret',                () => { for(const s of buildFretboardMap(STD,5)) expect(s.length).toBe(6); });
  it('custom MIDI tuning',              () => { const m=buildFretboardMap([38,45,50,55,59,64],3); expect(m[0][0]).toBe(38); expect(m[0][2]).toBe(40); });
});

describe('findPositions()', () => {
  it('returns array',                   () => expect(Array.isArray(findPositions([0],STD,12))).toBe(true));
  it('C on all 6 strings ≤12 fret',    () => expect(new Set(findPositions([0],STD,12).map(p=>p.string)).size).toBe(6));
  it('strings in 1–6',                 () => expect(findPositions([0,4,7],STD,12).every(p=>p.string>=1&&p.string<=6)).toBe(true));
  it('frets in 0–maxFret',             () => expect(findPositions([0,4,7],STD,12).every(p=>p.fret>=0&&p.fret<=12)).toBe(true));
  it('all pc match targetPcs',         () => { const pcs=[0,4,7]; expect(findPositions(pcs,STD,12).every(p=>pcs.includes(p.pc))).toBe(true); });
  it('degreeIndex = indexOf in target',() => { const pcs=[9,0,4]; findPositions(pcs,STD,12).forEach(p=>expect(p.degreeIndex).toBe(pcs.indexOf(p.pc))); });
  it('C major >10 positions',          () => expect(findPositions([0,4,7],STD,12).length).toBeGreaterThan(10));
  it('open high E: string6 fret0 pc4',() => { const p=findPositions([4],STD,12).find(p=>p.string===6&&p.fret===0); expect(p).toBeDefined(); expect(p.pc).toBe(4); });
  it('open low E: string1 fret0 pc4', () => { const p=findPositions([4],STD,12).find(p=>p.string===1&&p.fret===0); expect(p).toBeDefined(); expect(p.pc).toBe(4); });
  it('midi consistent with map',       () => { const map=buildFretboardMap(STD,12); findPositions([0],STD,12).forEach(p=>expect(p.midi).toBe(map[p.string-1][p.fret])); });
  it('empty targetPcs → []',           () => expect(findPositions([],STD,12)).toEqual([]));
  it('respects maxFret',               () => expect(findPositions([0,4,7],STD,5).every(p=>p.fret<=5)).toBe(true));
  it('larger maxFret → more results',  () => expect(findPositions([0],STD,12).length).toBeGreaterThan(findPositions([0],STD,5).length));
  it('drop D: D pc2 at str1 fret0',   () => { const p=findPositions([2],TUNINGS.drop_d,12).find(p=>p.string===1&&p.fret===0); expect(p).toBeDefined(); expect(p.pc).toBe(2); });
  it('E found at both open E strings', () => { const ps=findPositions([4],STD,12); expect(ps.find(p=>p.string===1&&p.fret===0)).toBeDefined(); expect(ps.find(p=>p.string===6&&p.fret===0)).toBeDefined(); });
});

describe('findBoxVoicing()', () => {
  const PCS = [0,4,7];
  it('returns 6 entries',              () => expect(findBoxVoicing(PCS,STD,0,4).length).toBe(6));
  it('entries are null or objects',    () => findBoxVoicing(PCS,STD,0,4).forEach(v=>{ if(v!==null){expect(typeof v.string).toBe('number');expect(typeof v.fret).toBe('number');} }));
  it('non-null pcs in targetPcs',      () => findBoxVoicing(PCS,STD,0,4).filter(Boolean).forEach(v=>expect(PCS).toContain(v.pc)));
  it('frets in window',                () => findBoxVoicing(PCS,STD,3,4).filter(Boolean).forEach(v=>{ expect(v.fret).toBeGreaterThanOrEqual(3); expect(v.fret).toBeLessThanOrEqual(7); }));
  it('open window has some open hits', () => expect(findBoxVoicing(PCS,STD,0,4).filter(v=>v&&v.fret===0).length).toBeGreaterThan(0));
});

describe('filterByFretRange()', () => {
  const all = () => findPositions([0,4,7],STD,12);
  it('removes out-of-range',           () => expect(filterByFretRange(all(),3,7).every(p=>p.fret>=3&&p.fret<=7)).toBe(true));
  it('empty when range beyond map',    () => expect(filterByFretRange(all(),13,20).length).toBe(0));
  it('full set when range = full map', () => { const a=all(); expect(filterByFretRange(a,0,12).length).toBe(a.length); });
  it('endpoints inclusive',            () => { const a=all(),f=filterByFretRange(a,0,12); a.filter(p=>p.fret===0||p.fret===12).forEach(p=>expect(f).toContain(p)); });
  it('does not mutate input',          () => { const a=all(),len=a.length; filterByFretRange(a,3,7); expect(a.length).toBe(len); });
});

// ---------------------------------------------------------------------------
// Helpers for voicing tests
// ---------------------------------------------------------------------------

// Build a minimal position object
const pos = (strIdx, fret, pc, di) => ({ string: strIdx+1, fret, pc, degreeIndex: di });

// C major pitch classes: C=0, E=4, G=7
const C_PCS = [0, 4, 7];
// E major pitch classes: E=4, G#=8, B=11
const E_PCS = [4, 8, 11];
// A major pitch classes: A=9, C#=1, E=4  (targetPcs order: root first)
const A_PCS = [9, 1, 4];
// D major pitch classes: D=2, F#=6, A=9
const D_PCS = [2, 6, 9];

// G major pitch classes: G=7, B=11, D=2
const G_PCS = [7, 11, 2];

// Hand-checked open voicings (x32010, x02220, xx0232, 022100)
const C_OPEN_VOICING = [
  null,
  pos(1, 3, 0, 0),  // A string fret 3 = C, root
  pos(2, 2, 4, 1),  // D string fret 2 = E
  pos(3, 0, 7, 2),  // G string open   = G
  pos(4, 1, 0, 0),  // B string fret 1 = C
  pos(5, 0, 4, 1),  // high-e open     = E
];

const A_OPEN_VOICING = [
  null,
  pos(1, 0, 9, 0),  // A string open   = A, root
  pos(2, 2, 4, 2),  // D string fret 2 = E
  pos(3, 2, 9, 0),  // G string fret 2 = A
  pos(4, 2, 1, 1),  // B string fret 2 = C#
  pos(5, 0, 4, 2),  // high-e open     = E
];

const D_OPEN_VOICING = [
  null,
  null,
  pos(2, 0, 2, 0),  // D string open   = D, root
  pos(3, 2, 9, 2),  // G string fret 2 = A
  pos(4, 3, 2, 0),  // B string fret 3 = D
  pos(5, 2, 6, 1),  // high-e fret 2   = F#
];

const E_OPEN_VOICING = [
  pos(0, 0, 4, 0),  // low-E open      = E, root
  pos(1, 2, 11, 2), // A string fret 2 = B  (5th) ← distinguishes E shape from G shape
  pos(2, 2, 4, 0),  // D string fret 2 = E
  pos(3, 1, 8, 1),  // G string fret 1 = G#
  pos(4, 0, 11, 2), // B string open   = B
  pos(5, 0, 4, 0),  // high-e open     = E
];

// G major open (320003): G=7, B=11, D=2
// A string carries the 3rd (B) ← distinguishes G shape from E shape
const G_OPEN_VOICING = [
  pos(0, 3,  7, 0),  // low-E fret 3  = G, root
  pos(1, 2, 11, 1),  // A fret 2      = B, 3rd  ← key: 3rd on A → G shape
  pos(2, 0,  2, 2),  // D open        = D, 5th
  pos(3, 0,  7, 0),  // G open        = G, root
  pos(4, 0, 11, 1),  // B open        = B, 3rd
  pos(5, 3,  7, 0),  // high-e fret 3 = G, root
];

// ---------------------------------------------------------------------------

describe('scoreVoicing()', () => {
  it('empty voicing scores 0',          () => expect(scoreVoicing([null,null,null,null,null,null], C_PCS)).toBe(0));
  it('missing chord tone scores 0',     () => {
    // C and E present but no G
    const v = [null, pos(1,3,0,0), pos(2,2,4,1), null, null, null];
    expect(scoreVoicing(v, C_PCS)).toBe(0);
  });
  it('complete triad scores > 0',       () => expect(scoreVoicing(C_OPEN_VOICING, C_PCS)).toBeGreaterThan(0));
  it('complete triad contains base',    () => expect(scoreVoicing(C_OPEN_VOICING, C_PCS)).toBeGreaterThanOrEqual(300));
  it('more strings → higher score',    () => {
    // 5-string vs 3-string, both complete
    const v3 = [null, null, null, pos(3,0,7,2), pos(4,1,0,0), pos(5,0,4,1)];
    // add root first so completeness still holds — actually v3 is missing root 0... let me add it
    const v3c = [null, null, pos(2,2,4,1), pos(3,0,7,2), pos(4,1,0,0), null];
    // still missing root → 0.  let me build a minimal 3-string complete voicing
    const v3ok = [null, pos(1,3,0,0), pos(2,2,4,1), pos(3,0,7,2), null, null];
    expect(scoreVoicing(C_OPEN_VOICING, C_PCS)).toBeGreaterThan(scoreVoicing(v3ok, C_PCS));
  });
  it('root on lowest string gives bonus', () => {
    // Swap C_OPEN_VOICING to have non-root on lowest sounding string (strIdx 1 has 3rd instead of root)
    const noRootBass = [
      null,
      pos(1, 2, 4, 1),  // E (3rd) on A string instead of root C
      pos(2, 3, 0, 0),  // C (root) on D string
      pos(3, 0, 7, 2),
      pos(4, 1, 0, 0),
      pos(5, 0, 4, 1),
    ];
    expect(scoreVoicing(C_OPEN_VOICING, C_PCS)).toBeGreaterThan(scoreVoicing(noRootBass, C_PCS));
  });
  it('voicing with gap scores less', () => {
    // Same notes as C_OPEN but with a null gap in the middle
    const gapped = [
      null,
      pos(1, 3, 0, 0),
      null,              // gap
      pos(3, 0, 7, 2),
      pos(4, 1, 0, 0),
      pos(5, 0, 4, 1),
    ];
    expect(scoreVoicing(C_OPEN_VOICING, C_PCS)).toBeGreaterThan(scoreVoicing(gapped, C_PCS));
  });

  // requiredBassPc
  it('wrong requiredBassPc → 0 (hard gate)', () => {
    // C_OPEN lowest sounding string = A string with C (pc 0); require E (pc 4) → gate fails
    expect(scoreVoicing(C_OPEN_VOICING, C_PCS, 4)).toBe(0);
  });
  it('correct requiredBassPc → score > 0', () => {
    // C_OPEN lowest string has C (pc 0); requiring C passes the gate
    expect(scoreVoicing(C_OPEN_VOICING, C_PCS, 0)).toBeGreaterThan(0);
  });
  it('requiredBassPc=root gives same score as unconstrained (both award bass bonus)', () => {
    // C_OPEN has root on lowest string, so both paths award the +30 bass bonus
    expect(scoreVoicing(C_OPEN_VOICING, C_PCS, 0)).toBe(scoreVoicing(C_OPEN_VOICING, C_PCS));
  });
  it('null requiredBassPc still awards root-bass bonus over non-root bass', () => {
    const thirdBassVoicing = [
      null,
      pos(1, 2, 4, 1),  // E (3rd) on A string — not the root
      pos(2, 3, 0, 0),  // C (root) on D string
      pos(3, 0, 7, 2),  // G on G string
      null, null,
    ];
    expect(scoreVoicing(C_OPEN_VOICING, C_PCS)).toBeGreaterThan(
      scoreVoicing(thirdBassVoicing, C_PCS)
    );
  });
});

describe('findBestVoicingInWindow()', () => {
  it('returns array of 6',              () => expect(findBestVoicingInWindow(C_PCS,STD,0,4).length).toBe(6));
  it('C major open has all 3 pcs',      () => {
    const v = findBestVoicingInWindow(C_PCS, STD, 0, 4);
    const pcs = new Set(v.filter(Boolean).map(x => x.pc));
    expect(pcs.has(0)).toBe(true);
    expect(pcs.has(4)).toBe(true);
    expect(pcs.has(7)).toBe(true);
  });
  it('non-null pcs are in targetPcs',   () => {
    const v = findBestVoicingInWindow(C_PCS, STD, 0, 4);
    v.filter(Boolean).forEach(x => expect(C_PCS).toContain(x.pc));
  });
  it('frets in window',                 () => {
    const v = findBestVoicingInWindow(C_PCS, STD, 5, 4);
    // Open strings (fret 0) are always valid candidates even outside the window.
    v.filter(Boolean).forEach(x => {
      expect(x.fret === 0 || x.fret >= 5).toBe(true);
      expect(x.fret === 0 || x.fret <= 8).toBe(true);
    });
  });
  it('returns null when unreachable',   () => {
    // Window frets 1–5 for a chord whose pcs don't all appear there
    // Use a single-note "chord" that only appears at fret 0 (open E)
    // With windowStart=1 those open strings are excluded
    const v = findBestVoicingInWindow([4], STD, 13, 4); // E at frets 13–17
    // E appears at fret 14 on B string (64+14-1... let me not assume) — just check it's valid or null
    // Actually E (pc4) does appear in frets 13-17, so this won't be null.
    // Instead use an impossible combo: all six pcs that can't all appear in 1-fret window
    expect(findBestVoicingInWindow([0,1,2,3,4,5,6], STD, 1, 1)).toBeNull();
  });
  it('score of result is positive',     () => {
    const v = findBestVoicingInWindow(C_PCS, STD, 0, 4);
    expect(scoreVoicing(v, C_PCS)).toBeGreaterThan(0);
  });
  it('G major open has all 3 pcs',      () => {
    const G_PCS = [7, 11, 2]; // G, B, D
    const v = findBestVoicingInWindow(G_PCS, STD, 0, 4);
    const pcs = new Set(v.filter(Boolean).map(x => x.pc));
    expect(pcs.has(7)).toBe(true);
    expect(pcs.has(11)).toBe(true);
    expect(pcs.has(2)).toBe(true);
  });
  it('A minor open has all 3 pcs',      () => {
    const Am_PCS = [9, 0, 4]; // A, C, E  (minor: root, b3, 5)
    const v = findBestVoicingInWindow(Am_PCS, STD, 0, 4);
    const pcs = new Set(v.filter(Boolean).map(x => x.pc));
    [9, 0, 4].forEach(pc => expect(pcs.has(pc)).toBe(true));
  });

  // requiredBassPc
  it('requiredBassPc=4: C 1st inv — lowest sounding string has pc 4 (E)', () => {
    const v = findBestVoicingInWindow(C_PCS, STD, 0, 4, 4);
    expect(v).not.toBeNull();
    const played = v.filter(Boolean).sort((a, b) => a.string - b.string);
    expect(played[0].pc).toBe(4);
  });
  it('requiredBassPc=7: C 2nd inv — lowest sounding string has pc 7 (G)', () => {
    const v = findBestVoicingInWindow(C_PCS, STD, 0, 4, 7);
    expect(v).not.toBeNull();
    const played = v.filter(Boolean).sort((a, b) => a.string - b.string);
    expect(played[0].pc).toBe(7);
  });
  it('requiredBassPc not in chord → null (impossible)', () => {
    // F (pc 5) is not a chord tone of C major — no valid voicing can have F in the bass
    expect(findBestVoicingInWindow(C_PCS, STD, 0, 4, 5)).toBeNull();
  });
});

describe('findVoicingsAcrossNeck()', () => {
  it('returns an array',                () => expect(Array.isArray(findVoicingsAcrossNeck(C_PCS, STD))).toBe(true));
  it('C major has 4+ voicings',         () => expect(findVoicingsAcrossNeck(C_PCS, STD, 22, 4).length).toBeGreaterThanOrEqual(4));
  it('E major has 4+ voicings',         () => expect(findVoicingsAcrossNeck(E_PCS, STD, 22, 4).length).toBeGreaterThanOrEqual(4));
  it('each voicing contains all pcs',   () => {
    findVoicingsAcrossNeck(C_PCS, STD, 22, 4).forEach(({ voicing }) => {
      const pcs = new Set(voicing.filter(Boolean).map(v => v.pc));
      C_PCS.forEach(pc => expect(pcs.has(pc)).toBe(true));
    });
  });
  it('windowStarts are ascending',      () => {
    const results = findVoicingsAcrossNeck(C_PCS, STD, 22, 4);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].windowStart).toBeGreaterThan(results[i-1].windowStart);
    }
  });
  it('no duplicate fingerings',         () => {
    const results = findVoicingsAcrossNeck(C_PCS, STD, 22, 4);
    const fps = results.map(r => r.voicing.map(v => v ? v.fret : 'x').join(','));
    expect(new Set(fps).size).toBe(fps.length);
  });
  it('each result has score > 0',       () => {
    findVoicingsAcrossNeck(C_PCS, STD, 22, 4).forEach(r => expect(r.score).toBeGreaterThan(0));
  });
  it('cagedShape is string or null',    () => {
    findVoicingsAcrossNeck(C_PCS, STD, 22, 4).forEach(r => {
      expect(r.cagedShape === null || typeof r.cagedShape === 'string').toBe(true);
    });
  });
  it('diminished chord has voicings',   () => {
    const dim = [0, 3, 6]; // C diminished
    expect(findVoicingsAcrossNeck(dim, STD, 22, 4).length).toBeGreaterThanOrEqual(2);
  });

  // requiredBassPc (inversion constraint)
  it('requiredBassPc=11 (B): G 1st inv — every voicing has B on lowest string', () => {
    const results = findVoicingsAcrossNeck(G_PCS, STD, 22, 4, 11);
    expect(results.length).toBeGreaterThan(0);
    results.forEach(({ voicing }) => {
      const played = voicing.filter(Boolean).sort((a, b) => a.string - b.string);
      expect(played[0].pc).toBe(11); // B
    });
  });
  it('requiredBassPc=2 (D): G 2nd inv — every voicing has D on lowest string', () => {
    const results = findVoicingsAcrossNeck(G_PCS, STD, 22, 4, 2);
    expect(results.length).toBeGreaterThan(0);
    results.forEach(({ voicing }) => {
      const played = voicing.filter(Boolean).sort((a, b) => a.string - b.string);
      expect(played[0].pc).toBe(2); // D
    });
  });
  it('impossible requiredBassPc → empty result set', () => {
    // Bb (pc 10) is not in C major — no voicing can satisfy the bass constraint
    const results = findVoicingsAcrossNeck(C_PCS, STD, 22, 4, 10);
    expect(results.length).toBe(0);
  });
});

describe('identifyCagedShape()', () => {
  it('E major open → E',   () => expect(identifyCagedShape(E_OPEN_VOICING)).toBe('E'));
  it('A major open → A',   () => expect(identifyCagedShape(A_OPEN_VOICING)).toBe('A'));
  it('C major open → C',   () => expect(identifyCagedShape(C_OPEN_VOICING)).toBe('C'));
  it('D major open → D',   () => expect(identifyCagedShape(D_OPEN_VOICING)).toBe('D'));
  it('no root → null',      () => {
    // Voicing where no note has degreeIndex 0
    const v = [null, pos(1,2,4,1), pos(2,0,7,2), null, null, null];
    expect(identifyCagedShape(v)).toBe(null);
  });
  it('G major open → G', () => expect(identifyCagedShape(G_OPEN_VOICING)).toBe('G'));
  it('root on strIdx 0, 5th on A string → E (not G)', () => {
    // E shape: A string carries the 5th.  E_OPEN_VOICING has B (5th of E) on A string.
    expect(identifyCagedShape(E_OPEN_VOICING)).toBe('E');
  });
  it('root on strIdx 0, A and high-e both null → falls back to E (ambiguous)', () => {
    // Without A-string or high-e info the shape cannot be distinguished; defaults to E.
    const v = [pos(0, 5, 9, 0), null, null, null, null, null];
    expect(identifyCagedShape(v)).toBe('E');
  });
  it('A shape: root on strIdx 1, string 0 muted, inner strings same fret → A', () => {
    // Simulate A-shape barre at fret 7 for E major (root E = pc 4)
    const v = [
      null,
      pos(1, 7, 4, 0),  // root on A string fret 7
      pos(2, 9, 11, 2), // fret 9
      pos(3, 9, 4, 0),  // fret 9
      pos(4, 9, 8, 1),  // fret 9
      null,
    ];
    expect(identifyCagedShape(v)).toBe('A');
  });
  it('C shape: root on strIdx 1, string 0 muted, inner strings diff frets → C', () => {
    expect(identifyCagedShape(C_OPEN_VOICING)).toBe('C');
  });
  it('D shape: root on strIdx 2, strings 0&1 muted → D', () => {
    expect(identifyCagedShape(D_OPEN_VOICING)).toBe('D');
  });
  it('root on strIdx 1 but string 0 not muted → null', () => {
    const v = [
      pos(0, 0, 4, 2),  // low E has a non-root note (5th)
      pos(1, 3, 0, 0),  // root on A string
      pos(2, 2, 4, 1),
      pos(3, 0, 7, 2),
      null,
      null,
    ];
    expect(identifyCagedShape(v)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Helpers shared by findScalePositions tests
// ---------------------------------------------------------------------------

const C_MAJOR_PCS  = getScalePitchClasses(nameToPc('C'), 'major');         // 7 notes
const AM_PENTA_PCS = getScalePitchClasses(nameToPc('A'), 'pentatonic_minor'); // 5 notes
const STD_TUN  = TUNINGS.standard;
const DROPD_TUN = TUNINGS.drop_d;

describe('findScalePositions()', () => {

  // ── Basic contract ──────────────────────────────────────────────────────

  it('returns an array', () => {
    expect(Array.isArray(findScalePositions(C_MAJOR_PCS, STD_TUN))).toBe(true);
  });

  it('C major standard has 8 positions', () => {
    expect(findScalePositions(C_MAJOR_PCS, STD_TUN).length).toBe(8);
  });

  it('Am pentatonic standard has 6 positions', () => {
    expect(findScalePositions(AM_PENTA_PCS, STD_TUN).length).toBe(6);
  });

  it('every position covers all scale degrees', () => {
    for (const pcs of [C_MAJOR_PCS, AM_PENTA_PCS]) {
      const positions = findScalePositions(pcs, STD_TUN);
      for (const p of positions) {
        const present = new Set(p.notes.map(n => n.pc));
        expect(pcs.every(pc => present.has(pc))).toBe(true);
      }
    }
  });

  it('each note has string 1–6, non-negative fret, valid degreeIndex', () => {
    for (const p of findScalePositions(C_MAJOR_PCS, STD_TUN)) {
      for (const n of p.notes) {
        expect(n.string).toBeGreaterThanOrEqual(1);
        expect(n.string).toBeLessThanOrEqual(6);
        expect(n.fret).toBeGreaterThanOrEqual(0);
        expect(n.degreeIndex).toBeGreaterThanOrEqual(0);
        expect(n.degreeIndex).toBeLessThan(C_MAJOR_PCS.length);
        expect(n.pc).toBe(C_MAJOR_PCS[n.degreeIndex]);
      }
    }
  });

  it('positions are sorted by windowStart ascending', () => {
    const pos = findScalePositions(C_MAJOR_PCS, STD_TUN);
    for (let i = 1; i < pos.length; i++)
      expect(pos[i].windowStart).toBeGreaterThanOrEqual(pos[i - 1].windowStart);
  });

  it('windowSize matches actual fret span of notes', () => {
    for (const p of findScalePositions(C_MAJOR_PCS, STD_TUN)) {
      const frets   = p.notes.map(n => n.fret);
      const span    = Math.max(...frets) - Math.min(...frets) + 1;
      expect(p.windowSize).toBe(span);
    }
  });

  it('no position spans more than 5 frets', () => {
    for (const p of findScalePositions(C_MAJOR_PCS, STD_TUN))
      expect(p.windowSize).toBeLessThanOrEqual(5);
  });

  it('no fingerprint duplicates across positions', () => {
    const pos = findScalePositions(C_MAJOR_PCS, STD_TUN);
    const fps = pos.map(p => p.notes.map(n => `${n.string}:${n.fret}`).join(','));
    expect(new Set(fps).size).toBe(fps.length);
  });

  // ── MIDI-duplicate span minimisation ───────────────────────────────────

  it('C major open position: B assigned to B-string (smaller span) not G-string', () => {
    // B3 = MIDI 59 appears at both G-string fret 4 and B-string fret 0.
    // Assigning to B-string keeps the span within frets 0–3 (size 4);
    // assigning to G-string would require frets 0–4 (size 5).
    const p = findScalePositions(C_MAJOR_PCS, STD_TUN)[0]; // anchor 0
    const gStrNotes = p.notes.filter(n => n.string === 4);
    const bStrNotes = p.notes.filter(n => n.string === 5);
    // G-string should NOT have B (degreeIndex 6)
    expect(gStrNotes.some(n => n.degreeIndex === 6)).toBe(false);
    // B-string SHOULD have B at fret 0
    expect(bStrNotes.some(n => n.fret === 0 && n.degreeIndex === 6)).toBe(true);
    // Span ≤ 4 (not 5)
    expect(p.windowSize).toBeLessThanOrEqual(4);
  });

  it('no two notes share the same MIDI pitch across adjacent strings', () => {
    const map = buildFretboardMap(STD_TUN, 22);
    for (const p of findScalePositions(C_MAJOR_PCS, STD_TUN)) {
      const midiByString = new Map();
      p.notes.forEach(n => {
        if (!midiByString.has(n.string)) midiByString.set(n.string, new Set());
        midiByString.get(n.string).add(map[n.string - 1][n.fret]);
      });
      for (let s = 1; s <= 5; s++) {
        const lo = midiByString.get(s) ?? new Set();
        const hi = midiByString.get(s + 1) ?? new Set();
        for (const m of lo) expect(hi.has(m)).toBe(false);
      }
    }
  });

  // ── Connectivity ────────────────────────────────────────────────────────

  it('all standard-tuning C major positions are fully connected across strings', () => {
    const N = C_MAJOR_PCS.length;
    for (const p of findScalePositions(C_MAJOR_PCS, STD_TUN)) {
      const byStr = new Map();
      p.notes.forEach(n => {
        if (!byStr.has(n.string)) byStr.set(n.string, []);
        byStr.get(n.string).push(n);
      });
      byStr.forEach(ns => ns.sort((a, b) => a.fret - b.fret));
      const active = [1,2,3,4,5,6].filter(s => byStr.has(s));
      for (let i = 0; i + 1 < active.length; i++) {
        const last  = byStr.get(active[i]).at(-1).degreeIndex;
        const first = byStr.get(active[i + 1])[0].degreeIndex;
        expect(first).toBe((last + 1) % N);
      }
    }
  });

  // ── Drop-D tuning: connectivity trimming ────────────────────────────────

  it('Drop-D C major pos 1: string 1 (low D) is trimmed — gap between deg 4→6', () => {
    const pos = findScalePositions(C_MAJOR_PCS, DROPD_TUN);
    // The first anchor (fret 0 on low D = D = deg 2 of C major) should
    // produce a diagram that omits string 1 because deg 5 (G) is unreachable
    // within the 5-fret window on string 1 or 2.
    const p = pos[0];
    const strings = new Set(p.notes.map(n => n.string));
    expect(strings.has(1)).toBe(false);          // str1 trimmed
    expect(strings.has(2)).toBe(true);           // str2 onwards retained
    const present = new Set(p.notes.map(n => n.pc));
    expect(C_MAJOR_PCS.every(pc => present.has(pc))).toBe(true); // still complete
  });

  it('Drop-D positions are all connected after trimming', () => {
    const N = C_MAJOR_PCS.length;
    for (const p of findScalePositions(C_MAJOR_PCS, DROPD_TUN)) {
      const byStr = new Map();
      p.notes.forEach(n => {
        if (!byStr.has(n.string)) byStr.set(n.string, []);
        byStr.get(n.string).push(n);
      });
      byStr.forEach(ns => ns.sort((a, b) => a.fret - b.fret));
      const active = [1,2,3,4,5,6].filter(s => byStr.has(s));
      for (let i = 0; i + 1 < active.length; i++) {
        const last  = byStr.get(active[i]).at(-1).degreeIndex;
        const first = byStr.get(active[i + 1])[0].degreeIndex;
        expect(first).toBe((last + 1) % N);
      }
    }
  });

  it('Drop-D C major: all retained positions still cover every degree', () => {
    const pos = findScalePositions(C_MAJOR_PCS, DROPD_TUN);
    expect(pos.length).toBeGreaterThan(0);
    for (const p of pos) {
      const present = new Set(p.notes.map(n => n.pc));
      expect(C_MAJOR_PCS.every(pc => present.has(pc))).toBe(true);
    }
  });
});

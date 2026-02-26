import { describe, it, expect } from 'bun:test';
import {
  parseTuning, buildFretboardMap, findPositions,
  findBoxVoicing, filterByFretRange,
  TUNINGS, TUNING_LABELS,
} from '../js/fretboard.js';

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

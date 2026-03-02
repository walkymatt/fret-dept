# Fret Department — Guitar Chords & Scales

Pure client-side web app. Runtime has zero external dependencies.
Primary distribution target: `fret-department-standalone.html` — a single self-contained
file with all CSS and JS inlined. Must work when opened from `file://`.

## Architecture

Five cleanly separated modules in `js/` plus a curated data file:

### `js/theory.js` — Music theory (instrument-agnostic)
- MIDI-anchored note system (C4 = MIDI 60). Pitch classes 0–11.
- Scale definitions in `SCALES` — add new ones as `name: [intervals]`
- Chord definitions in `CHORDS` — add new ones as `name: { intervals, degrees }`
- Key exports:
  - `getScalePitchClasses(rootPc, scaleName)` → pitch class array
  - `getChordPitchClasses(rootPc, chordName)` → `{ pitchClasses, degrees }`
  - `relativeMinor(pc)` / `relativeMajor(pc)` / `parallelMinor(pc)`
  - `diatonicChords(rootPc, scaleName)` → roman-numeral analysis

### `js/fretboard.js` — Fretboard layout (guitar-specific)
- Strings numbered 1–6 (1 = low E). Fret 0 = open string.
- Tuning definitions in `TUNINGS` (MIDI ints or note-name strings, e.g. `'E2'`).
- Key exports:
  - `parseTuning(spec)` → `number[]` MIDI values
  - `buildFretboardMap(tuningSpec, maxFret)` → `number[][]` MIDI at `[string][fret]`
  - `findPositions(targetPcs, tuningSpec, maxFret)` → all matching positions
  - `scoreVoicing(voicing, targetPcs, requiredBassPc?)` → numeric quality score.
    `requiredBassPc` is a **hard gate**: voicing whose lowest-string pc ≠
    requiredBassPc returns 0.
  - `findBestVoicingInWindow(targetPcs, tuning, windowStart, windowSize, requiredBassPc?)`
    — searches exactly `windowSize` frets `[windowStart, windowStart+windowSize)`.
    Open strings (fret 0) are offered as candidates **only** when a string has no
    chord tone inside the window — preventing open strings from displacing barre shapes.
  - `findVoicingsAcrossNeck(targetPcs, tuning, maxFret, windowSize, requiredBassPc?)`
    → `{ windowStart, voicing, score, cagedShape }[]`
  - `identifyCagedShape(voicing)` → `'E'|'A'|'C'|'D'|'G'|null`
    When low strings are muted and root is on D string, distinguishes E-shape
    (root is highest-fret string of top-4, i.e. sits above the barre) from
    D-shape (root is lowest-fret string of top-4, i.e. it is the barre).
  - `findScalePositions(targetPcs, tuning, maxFret?)` → `{ windowStart, windowSize, notes }[]`
    — 5-fret box patterns; resolves cross-string MIDI duplicates by span minimisation.

### `js/fingering.js` — Finger assignment
- **Lookup path**: matches voicing shape against `data/fingerings.json` (32 curated
  entries — open-position and moveable shapes). Keys are relative fingerprints so one
  entry covers all transpositions of a moveable shape.
- **Algorithm path**: direct assignment (≤4 notes) → thumb on low E → clean barre →
  semi-barre → impossible.
- Key export:
  - `assignFingering(voicing)` → `{ fingers, barre, difficulty, impossible, semi, source }`
    - `fingers`: 6-element array of `0|1|2|3|4|'T'|'?'|null`
    - `barre`: `{ finger, fromString, toString }` or `null` (1-indexed strings)
    - `impossible`: `true` when no valid ≤4-finger assignment exists
- `data/fingerings.json`: 32 shapes — 20 open-position + 12 moveable (E/A/D-shape
  major, minor, dom7, maj7, min7 barre forms; power chords).

### `js/renderer.js` — SVG renderer (presentation only, browser DOM)
- All drawing is inline SVG via helper functions (`svgRect`, `svgCircle`, etc.).
- Colour scheme and layout in `DEFAULTS`; overridable via `opts`.
- Key exports:
  - `renderFretboard(container, positions, degreeLabels, opts)` — main fretboard.
    `opts.activeKeys` is a `Set<"string:fret">` — matching positions get a gold ring.
  - `renderChordDiagram(container, voicing, degreeLabels, opts?)` — compact chord card.
    - `opts.fingering`: if provided (result of `assignFingering`), draws a left column
      of finger-number labels (grey `o` for open, black `1–4`/`T`) and a barre bar
      inscribed in the fret (dark rounded rect spanning `fromString` → high e).
    - Anchors at nut automatically when the voicing has open strings and all fretted
      notes ≤ `FRETS` (4) frets from the nut — so standard open shapes (G, D, A, etc.)
      always display from the nut rather than from their minimum fret.
    - Barre bar always extends to the high e string regardless of `barre.toString`.
  - `renderScaleDiagram(container, notes, windowStart, windowSize)` — compact scale box.
  - `renderLegend(container, degreeLabels, noteNames, opts?)` — colour swatches.

### `js/app.js` — Application shell
- State: `{ mode, rootName, chordName, scaleName, tuningKey, inversion,
  positionIndex, voicings, scalePositionIndex, scalePositions }`.
- **Chord voicing pipeline** (`computeVoicings`):
  1. `findVoicingsAcrossNeck` → raw voicings
  2. For each voicing: run `assignFingering`; if `impossible`, try
     `fixImpossibleVoicing` (mute high/low strings until playable, or drop)
  3. Recompute `cagedShape` on any fixed voicing (muting can change the shape)
  4. Deduplicate by fret fingerprint (muting can produce identical shapes from
     originally distinct windows)
- **Chord rendering**: each card in the gallery calls `assignFingering` and passes the
  result as `opts.fingering` to `renderChordDiagram`.
- **Scale mode**: `findScalePositions` → `renderScaleDiagram` gallery.
- Inversion dropdown constrains `requiredBassPc`.

## Voicing pipeline details

### `fixImpossibleVoicing(voicing, requiredPcs, bassPc)`
Tries muting string combinations in priority order — outer strings first:
`[5]`, `[0]`, `[5,4]`, `[0,1]`, `[5,0]`, `[5,4,0]`, `[5,0,1]`, `[5,4,3]`.
Accepts a candidate only when:
- ≥ 3 voices remain
- All required pitch classes still present
- Bass inversion constraint (if any) still satisfied
- `assignFingering` returns `impossible: false`

## Extending

- **New chord**: add to `CHORDS` + `CHORD_LABELS` in `theory.js`
- **New scale**: add to `SCALES` + `SCALE_LABELS` in `theory.js`
- **New tuning**: add to `TUNINGS` + `TUNING_LABELS` in `fretboard.js`
- **New fingering shape**: add an entry to `data/fingerings.json`

## Build & run

```bash
make bundle      # bun build js/app.js → bundle.js
make standalone  # bundle + inline CSS → fret-department-standalone.html (primary target)
make serve       # bundle then python3 -m http.server 5050
make test        # bun test tests/
make clean       # remove bundle.js and fret-department-standalone.html
```

`bundle.js` and `fret-department-standalone.html` are committed. **Rebuild after every
source change:** `make standalone`.

Server: `tmux new-session -d -s guitar-server -c /workspace/guitar 'python3 -m http.server 5050'`

## Tests

Three test files using `bun:test`:

| File | Covers |
|------|--------|
| `tests/theory.test.js` | theory.js — scales, chords, inversions, diatonic analysis |
| `tests/fretboard.test.js` | fretboard.js — map, scoring, voicing search, CAGED, scale positions |
| `tests/fingering.test.js` | fingering.js — lookup, algorithm, barre, thumb, impossible |

```bash
make test   # 288 tests, 0 failures
```

## Key constraints & invariants

- No runtime external dependencies — no CDN, no fonts, no network requests.
- All features must work in `fret-department-standalone.html` (offline, `file://`).
- Run `make standalone` after every source change.
- Server must be launched non-blocking (via `tmux`).
- `findBestVoicingInWindow` window is **exclusive** upper-bound: frets
  `[windowStart, windowStart+windowSize)` — exactly `windowSize` fret slots,
  matching the `FRETS=4` display in `renderChordDiagram`.
- Open strings are candidates **only** as fallback (no in-window chord tone on
  that string), preventing open strings from displacing barre shapes.
- `cagedShape` must be **recomputed** after any voicing mutation (e.g. muting
  fixes) — do not spread a stale `cagedShape` from the original voicing.

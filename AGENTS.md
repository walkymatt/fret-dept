# Guitar — Chords & Scales

Pure client-side web app. Runtime has zero external dependencies.
Primary distribution target: `guitar-standalone.html` — a single self-contained
file with all CSS and JS inlined. Must work when opened from `file://`.

## Architecture

Four cleanly separated modules in `js/`:

### `js/theory.js` — Music theory (instrument-agnostic)
- MIDI-anchored note system (C4 = MIDI 60). Pitch classes 0–11.
- Scale definitions in `SCALES` — add new ones as `name: [intervals]`
- Chord definitions in `CHORDS` — add new ones as `name: { intervals, degrees }`
- Key exports:
  - `getScalePitchClasses(rootPc, scaleName)` → pitch class array
  - `getChordPitchClasses(rootPc, chordName)` → `{ pitchClasses, degrees }`
  - `getChordInversion(rootPc, chordName, inversion)` → rotated voicing
  - `relativeMinor(pc)` / `relativeMajor(pc)` / `parallelMinor(pc)`
  - `diatonicChords(rootPc, scaleName)` → roman-numeral analysis

### `js/fretboard.js` — Fretboard layout (guitar-specific)
- Strings numbered 1–6 (1 = low E). Fret 0 = open string.
- Tuning definitions in `TUNINGS` (MIDI ints or note-name strings, e.g. `'E2'`).
- Key exports:
  - `parseTuning(spec)` → `number[]` MIDI values
  - `buildFretboardMap(tuningSpec, maxFret)` → `number[][]` MIDI at `[string][fret]`
  - `findPositions(targetPcs, tuningSpec, maxFret)` → all matching `{ string, fret, midi, pc, degreeIndex }` positions
  - `filterByFretRange(positions, lo, hi)` → filtered subset
  - `scoreVoicing(voicing, targetPcs, requiredBassPc?)` → numeric quality score.
    `requiredBassPc` is a **hard gate**: if set, any voicing whose lowest-string
    pc ≠ requiredBassPc returns 0.
  - `findBestVoicingInWindow(targetPcs, tuning, windowStart, windowSize, requiredBassPc?)` → best single voicing or `null`
  - `findVoicingsAcrossNeck(targetPcs, tuning, maxFret, windowSize, requiredBassPc?)` → `{ windowStart, voicing, score, cagedShape }[]`
  - `identifyCagedShape(voicing)` → `'E'|'A'|'C'|'D'|'G'|null`
  - `findScalePositions(targetPcs, tuning, maxFret?)` → `{ windowStart, windowSize, notes }[]`
    — 5-fret box patterns anchored on scale tones of the lowest string (frets 0–12).
    Resolves cross-string MIDI duplicates by choosing the assignment that minimises
    the total fret span. Trims disconnected fragments from each position and drops
    any position that cannot form a gapless run covering all scale degrees.

### `js/renderer.js` — SVG renderer (presentation only, browser DOM)
- All drawing is inline SVG via helper functions (`svgRect`, `svgCircle`, etc.).
- Colour scheme and layout in `DEFAULTS`; overridable via `opts`.
- Key exports:
  - `renderFretboard(container, positions, degreeLabels, opts)` — main fretboard.
    `opts.activeKeys` is a `Set<"string:fret">` — matching positions get a gold ring.
  - `renderChordDiagram(container, voicing, degreeLabels, opts?)` — compact horizontal
    mini-fretboard for one chord voicing (one dot per string).
  - `renderScaleDiagram(container, notes, windowStart, windowSize)` — compact horizontal
    mini-fretboard for one scale box position. Open strings (fret 0) appear to the left
    of the nut. Every dot shows its scale degree number.
  - `renderLegend(container, degreeLabels, noteNames, opts?)` — colour swatches.

### `js/app.js` — Application shell
- Manages state: `{ mode, rootName, chordName, scaleName, tuningKey, inversion,
  positionIndex, voicings, scalePositionIndex, scalePositions }`.
- **Chord mode**: computes voicings via `findVoicingsAcrossNeck`, shows a scrollable
  gallery of `renderChordDiagram` cards with ◀▶ navigator. Active voicing is
  highlighted on the main fretboard (`activeKeys`). Inversion dropdown constrains
  `requiredBassPc`.
- **Scale mode**: computes positions via `findScalePositions`, shows a scrollable
  gallery of `renderScaleDiagram` cards with ◀▶ navigator. Selected position is
  highlighted on the main fretboard.
- No music theory or fretboard logic here — delegate to the other modules.

## Extending

- **New chord**: add to `CHORDS` + `CHORD_LABELS` in `theory.js`
- **New scale**: add to `SCALES` + `SCALE_LABELS` in `theory.js`
- **New tuning**: add to `TUNINGS` + `TUNING_LABELS` in `fretboard.js`
- **New renderer**: import `renderFretboard` / `renderLegend` from `renderer.js`,
  add a panel in `index.html`

## Build & run

```bash
make bundle      # bun build js/app.js → bundle.js
make standalone  # bundle + inline CSS → guitar-standalone.html (primary target)
make serve       # bundle then python3 -m http.server 5050
make test        # bun test tests/
make clean       # remove bundle.js and guitar-standalone.html
```

`bundle.js` and `guitar-standalone.html` are committed to the repo so the app
is immediately usable after cloning. **Rebuild after every source change:**
`make standalone`.

## Tests

`tests/theory.test.js` and `tests/fretboard.test.js` use `bun:test` (Jest-like).
Run against ES module source files directly (no bundle needed).

```bash
make test   # 244 tests, 0 failures
```

## Constraints

- No runtime external dependencies — no CDN, no fonts, no network requests.
- All features must work in `guitar-standalone.html` (offline, `file://`).
- Run `make standalone` after every code change.
- Server must be launched non-blocking (e.g. via `tmux`).

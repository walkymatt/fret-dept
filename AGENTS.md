# Guitar — Chords & Scales

Pure client-side web app. Runtime has no external dependencies (pure JS/CSS/HTML).
Requires one build step to produce `bundle.js` before opening in a browser.

## Architecture

Three cleanly separated modules in `js/`:

### `js/theory.js` — Music theory (instrument-agnostic)
- MIDI-anchored note system (C4 = MIDI 60)
- Pitch class arithmetic (0–11)
- Scale definitions in `SCALES` — add new ones as `name: [intervals]`
- Chord definitions in `CHORDS` — add new ones as `name: { intervals, degrees }`
- Key functions:
  - `getScalePitchClasses(rootPc, scaleName)` → pitch class array
  - `getChordPitchClasses(rootPc, chordName)` → `{ pitchClasses, degrees }`
  - `getChordInversion(rootPc, chordName, inversion)` → inverted voicing
  - `relativeMinor(majorRootPc)` / `relativeMajor(minorRootPc)`
  - `diatonicChords(rootPc, scaleName)` → roman-numeral analysis

### `js/fretboard.js` — Fretboard layout (guitar-specific)
- Tuning definitions in `TUNINGS` (MIDI or note-name strings)
- Key functions:
  - `buildFretboardMap(tuningSpec, maxFret)` → 2D MIDI array [string][fret]
  - `findPositions(pitchClasses, tuningSpec, maxFret)` → position list
  - `findBoxVoicing(pitchClasses, tuningSpec, windowStart, windowSize)`
  - `filterByFretRange(positions, minFret, maxFret)`

### `js/renderer.js` — SVG fretboard renderer (presentation only)
- Pure SVG, no canvas
- Key functions:
  - `renderFretboard(container, positions, degreeLabels, opts)`
  - `renderLegend(container, degreeLabels, noteNames, opts)`
- Colour scheme and layout tweakable via `opts` object (see DEFAULTS)
- Dots are coloured by degree index; root is always red

### `js/app.js` — Application shell
- Wires UI dropdowns → state → render cycle
- No music theory or fretboard logic here

## Extending

- *New chord type*: add entry to `CHORDS` and `CHORD_LABELS` in `theory.js`
- *New scale*: add entry to `SCALES` and `SCALE_LABELS` in `theory.js`
- *New tuning*: add entry to `TUNINGS` and `TUNING_LABELS` in `fretboard.js`
- *New view*: import `findPositions` from `fretboard.js` and `renderFretboard`
  from `renderer.js`, add a new panel in `index.html`

## Build & run

The source files (`js/*.js`) are ES modules with `import`/`export`. Browsers
block cross-file ES module loads from `file://` URLs due to CORS, so they must
be bundled into a single self-contained script first.

```bash
# One-time (or after any source change): produces bundle.js
make bundle        # runs: bun build js/app.js --outfile=bundle.js --target=browser

# Build + serve on port 5050
make serve

# Open locally without a server (bundle.js must exist)
open index.html    # or just double-click it
```

`bundle.js` is committed to the repo so the app can be opened immediately after
cloning without running `make bundle`, but it must be rebuilt whenever source
files change.

## Tests

Source files are tested directly as ES modules (no bundle needed):

```bash
make test    # runs: bun test tests/
```

## Future ideas
- Chord diagram view (vertical, first-position only)
- Position / CAGED system highlighting
- Side-by-side scale vs chord comparison
- Relative minor/major quick-switch button
- Note audio playback (Web Audio API)
- Diatonic chord browser for a key

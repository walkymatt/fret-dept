# Guitar — Chords & Scales

Pure client-side web app. No build step, no external dependencies.
Open `index.html` directly in a browser (or serve with any static server).

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

## Running

```bash
# Any static file server works, e.g.:
python3 -m http.server 8080
# or:
npx serve .
```

## Future ideas
- Chord diagram view (vertical, first-position only)
- Position / CAGED system highlighting
- Side-by-side scale vs chord comparison
- Relative minor/major quick-switch button
- Note audio playback (Web Audio API)
- Diatonic chord browser for a key

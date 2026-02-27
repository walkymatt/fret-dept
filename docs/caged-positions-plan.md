# CAGED / Position Voicings — Design Plan

Goal: in chord mode, let the user browse practical fingerings at different
positions across the neck, with optional CAGED shape labelling.

---

## 1. What problem are we solving?

`findBoxVoicing` already picks one note per string inside a fret window,
but it has two weaknesses:

1. It takes the *first* matching note per string — no scoring, so the result
   is often incomplete or awkward.
2. There is no way to discover *which* positions on the neck yield a good
   complete voicing for a given chord.

The feature adds: smart voicing selection + neck-wide position discovery +
UI to navigate between positions.

---

## 2. New logic in fretboard.js

### 2a. `scoreVoicing(voicing, targetPcs)`

Scores a candidate voicing (array of 6 positions-or-null from
`findBoxVoicing`).  Returns a numeric score; higher is better.

Criteria (each independently additive):

| Criterion | Points |
|---|---|
| All chord tones present (completeness) | +100 per tone, hard gate: 0 if any tone missing |
| Number of strings used | +10 per string |
| Fret span ≤ 3 | +20 |
| Fret span ≤ 4 | +10 |
| Root note on lowest sounding string | +30 |
| No muted strings in the middle of the voicing | +10 |

Completeness is a hard gate: a voicing that omits any chord tone scores
zero and is excluded from results.  (Power chords and 9ths are already
defined with their full interval set — no special-casing needed.)

### 2b. `findBestVoicingInWindow(targetPcs, tuningSpec, windowStart, windowSize=4)`

Replaces the single-pass logic of `findBoxVoicing`.  For each string,
collect *all* matching notes in the window (not just the first).  Then
try every combination (one choice per string, including mute) and return
the highest-scored non-zero voicing, or null if no complete voicing exists.

Combinatorial explosion is bounded: 6 strings × ~3 candidates each =
≤ 3^6 = 729 combinations, fast enough synchronously.

### 2c. `findVoicingsAcrossNeck(targetPcs, tuningSpec, maxFret=22, windowSize=4)`

Slides the window across frets 0 to maxFret-windowSize, calls
`findBestVoicingInWindow` at each position, deduplicates adjacent windows
that produce identical fingerings, and returns:

```js
[
  { windowStart: 0,  voicing: [...], score: 190, cagedShape: 'E' },
  { windowStart: 5,  voicing: [...], score: 170, cagedShape: 'A' },
  { windowStart: 7,  voicing: [...], score: 160, cagedShape: 'G' },
  ...
]
```

Typically 4–6 results for major/minor chords.  For unusual chord types
(aug7, halfDim7, etc.) there may be fewer.

### 2d. `identifyCagedShape(voicing, targetPcs)` (major/minor only)

CAGED shapes in standard tuning are identified by which string carries the
*root note* in the lowest position of the voicing:

| Root on string | Shape |
|---|---|
| 6 (low E), fret ≥ nut | E shape |
| 5 (A) | A shape |
| 5 (A), open + partial barre | C shape — distinguished from A by having no note on string 6 |
| 4 (D) | D shape |
| 6 (low E), but root also appears on string 1 and strings 6/1 fret the same | G shape |

The G/C distinction is the awkward one.  Practical heuristic:

- If root is on string 5 and string 6 is muted → A or C shape.
  - A shape: string 6 is muted, strings 4-2 are fretted at the same fret.
  - C shape: string 6 is muted, strings 4-2 spread across multiple frets.
- If root is on string 6 and root also appears on string 1 within the same
  window → G shape; else E shape.

Returns `'E' | 'A' | 'G' | 'C' | 'D' | null`.  Returns null for non-major/
minor chords or ambiguous shapes — no false labels.

---

## 3. New rendering in renderer.js

### `renderChordDiagram(container, voicing, degreeLabels, opts)`

A traditional vertical chord box (like in any songbook):

- Fixed 4 frets × 6 strings grid, drawn as SVG.
- Nut drawn at top if windowStart === 0; else a thick horizontal bar with
  the fret number shown to the left.
- Filled circle = fretted note, coloured by degree (same palette as main
  fretboard).
- × above a string = muted.
- ○ above a string = open note.
- Degree label inside each filled dot.

This is the "Chord diagram view (vertical, first-position only)" item from
the future-ideas list — we get it for free as part of this feature.

opts additions:
```js
{
  diagramFretCount: 4,
  diagramStringSpacing: 20,
  diagramFretHeight: 22,
  diagramDotRadius: 9,
}
```

---

## 4. UI changes (app.js + index.html)

### Proposal A — Position Navigator (recommended)

Add a compact control row in chord mode:

```
Position:  ◀  E shape · fret 0  ▶   (1/5)
```

- State: `positionIndex` (index into the array from
  `findVoicingsAcrossNeck`), computed once per chord/tuning change.
- ◀ / ▶ buttons cycle through positions.
- The main fretboard zooms to show only the active window: `maxFret` is
  temporarily overridden to `windowStart + windowSize`, and fret numbers
  still show true fret values.
- CAGED shape label shown only for major/minor.
- When maxFret slider is dragged, positions are re-computed up to that fret.

*Pros:* minimal HTML/CSS change; works entirely within the existing single-
fretboard layout; no new panel needed.

*Cons:* user can only see one voicing at a time.

### Proposal B — Voicing Gallery (more visual)

Below the main fretboard, show a scrollable horizontal strip of small chord
diagrams (using `renderChordDiagram`) — one per position found across the
neck.  Clicking a diagram highlights it (border) and scrolls/zooms the main
fretboard to that window.

- Each card: ~90 × 120 px, the title shows fret position + CAGED shape label.
- Active card is outlined in red.
- Gallery only visible in chord mode.

*Pros:* user sees all positions at a glance; intuitive.
*Cons:* more HTML; standalone file grows but still well under 50 KB.

### Recommendation

Start with Proposal A (simpler, lower risk), then add Proposal B's gallery
on top once A is working and tested.  The renderer function needed for B is
also useful standalone, so it makes sense to build it regardless.

---

## 5. Test plan

New tests in `tests/fretboard.test.js`:

- `scoreVoicing`: complete vs incomplete voicings, root-in-bass bonus.
- `findBestVoicingInWindow`: C major at fret 0 produces a recognisable open
  C voicing; G major at fret 3 produces a known G barre shape.
- `findVoicingsAcrossNeck`: C major / standard tuning → 5 voicings; a
  diminished chord → at least 2 voicings.
- `identifyCagedShape`: E major fret 0 → 'E'; A major fret 0 → 'A'; etc.

Target: ~30 new tests, keeping existing 179 green.

---

## 6. What stays the same

- Scale mode is unaffected.
- `findPositions` (all-positions view) is unchanged.
- Standalone build constraint: everything is pure JS, no new dependencies.
- Existing `findBoxVoicing` kept for backwards compatibility (tests cover it).

---

## 7. Suggested implementation order

1. `scoreVoicing` + `findBestVoicingInWindow` + tests
2. `findVoicingsAcrossNeck` + `identifyCagedShape` + tests
3. `renderChordDiagram` in renderer.js
4. Proposal A UI (position navigator) in app.js + index.html
5. Proposal B gallery strip (optional follow-up)

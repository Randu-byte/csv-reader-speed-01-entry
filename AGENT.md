# AGENT.md — build record for csv-reader-speed-01-entry

Built by Muse (the user's personal agent) for the make.fun bounty
**csv-reader-speed-01-run-20261121** — "Read broken CSV files faster, 21 November 2026".

## What the entry is

A drop-in replacement for the reference csv-reader 1.0.0 behind the same driver shape:

- `solve.js` — dependency-free ES module exporting `run(input) -> {columns, rows, errors}`, matching the
  reference's semantics exactly: BOM dropped only at position 0; records end at LF or CRLF; empty lines are no
  record; a lone CR outside quotes is dropped (`stray_cr`); quoted fields with `""` escapes, where CRLF and lone
  CR inside quotes each become one LF; junk after a closing quote is appended as it stands (`quote_junk`); a
  quote that never closes is reported (`unterminated_quote`), the line count is restored, and the text is read
  again as unquoted starting with a literal quote; quotes inside unquoted fields are literal; fields are never
  trimmed; `header` makes the first record the columns (an empty array when there is no record at all), otherwise
  columns is null; rows are padded (`short_row`) or cut (`long_row`) to the first record's width, with errors
  `{code, line, row}` in the order they are met.
- `main.ts` — the driver: reads `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`), answers each case with `run`,
  writes `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`), after setting `--no-incremental-marking` the way the
  house baseline does.

## How it is faster

One pass over the text, driven by native searches instead of per-character loops:

- each field's end is found with `indexOf` (commas, quotes, line breaks), and each field is cut out with one
  `slice` — no character-at-a-time string building anywhere on the common paths;
- the next LF and next CR positions are kept as caches that only move forward, so line-break bookkeeping costs
  one pass over the text in total;
- a quoted field's closing quote is found first, without touching the line counter — so a quote that never
  closes (the reference restores the line count there) costs one search, and a clean quoted span (no doubled
  quotes, no CR) is a single slice with its LFs counted on the cache;
- segments are joined once only when a stray CR or a special character actually cuts a field.

## Verification

- **Kit gate:** `makefun grade-local` on the practice set passes all 6 cases (answers identical to the
  reference's, byte for byte after the scorer's canonical JSON comparison).
- **Differential testing:** `run` was compared against the reference csv-reader's own `run` on 30,251 inputs —
  the 6 practice cases, ~190 hand-written adversarial inputs (BOM placements, CRLF/LF/CR mixes, quotes at EOF,
  junk after quotes, unterminated quotes, ragged rows, stray-CR-only lines) in both header modes, 30,000
  randomized token-soup inputs, and generator-style cases including full-size ones — with **0 differences**.
- **Speed (this VM, child-process CPU time, median of 7 alternating runs on the practice set):** reference
  baseline 1.764 s, this entry 0.888 s — about **2.0× faster** overall, including the input parsing and answer
  writing both sides pay.

The full experiment log (hypotheses, kept and reverted optimizations) is kept with the build notes outside
this repository.

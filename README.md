# csv-reader-speed-01-entry

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Randu-byte/csv-reader-speed-01-entry/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Randu-byte/csv-reader-speed-01-entry/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in replacement for make.fun's csv-reader 1.0.0, written for the make.fun bounty "Read broken CSV files faster, 21 November 2026". `solve.js` exports `run(input)`, which returns exactly csv-reader's answer — the JSON value `{columns, rows, errors}` — for every input `{text, header}`: the same broken-row policy (stray CRs, junk after a closing quote, quotes that never close, ragged rows) and the same errors in the same order, produced by scanning with native searches and slicing fields out of the text instead of building them a character at a time. `main.ts` is the harness driver: it reads every case from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`) and writes the answers to `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`).

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=bq2mqb86&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>

# Report: L-smoke

Worker: `L-smoke`. Instance `lab-smoke`, target `isolated` throughout. Three
bench invocations: two clean and identical, one that failed for a cause outside
this repository and is explained below.

## Outcome

**Done.** **Nothing regressed.**

Every difference between the new runs and the eight historical baselines is
accounted for, and each is one of two kinds: a deliberate change in what the
bench *measures* (the honesty work in `1b6f5df`), or wall-clock timing noise on
a loaded machine. No product behaviour changed: both corpus rows still pass on
every repeat, FluxIQ still executes the same two actions on the same row and
none on the other, and no failure, false failure, or harness activation
appeared that was not there before.

The one thing the green does **not** do is validate today's largest changes —
see "What this run did not exercise". Reading it as coverage of the redaction
fixes, the Level 1 veto, the failure-code set, or the page-evidence rewrite
would be wrong.

## Commands run and observed results

Every command carried `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=lab-smoke`.
Exit status was captured by appending to a redirected log, never through a pipe.
Run evidence went to `test-runs/instances/lab-smoke/`, confirmed isolated from
the shared `test-runs/bench/` (still eight directories, untouched).

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `pnpm lab bench --corpus smoke --repeat 2 --target isolated` | **0** | `bench-mtz3dnux-d8f9e7f1` — 4 runs, 4 passed, 0 skipped, notExecuted 2, actionsExecuted 4 |
| 2 | same | **1** | `bench-mtz3zan8-d6ce4aae` — 4 runs, **0 passed**, 0 skipped, notExecuted 4, actionsExecuted 0 |
| 3 | same | **0** | `bench-mtz4cxii-de62d744` — 4 runs, 4 passed, 0 skipped, notExecuted 2, actionsExecuted 4 |
| 4 | `pnpm lab compare test-runs/bench/bench-mtxoim0b-8ca4952c bench-mtz3dnux-d8f9e7f1` | **0** | `"outcome":"equivalent"` |
| 5 | `pnpm lab compare test-runs/bench/bench-mtxgwjhb-ef82e30e bench-mtz3dnux-d8f9e7f1` | **0** | `"outcome":"equivalent"` |
| 6 | `pnpm lab compare bench-mtz3dnux-d8f9e7f1 --halves` | **0** | `"outcome":"equivalent"` |
| 7 | `pnpm lab compare test-runs/bench/bench-mtxoim0b-8ca4952c bench-mtz4cxii-de62d744` | **0** | `"outcome":"equivalent"` |
| 8 | `pnpm lab compare bench-mtz3dnux-d8f9e7f1 bench-mtz4cxii-de62d744` | **0** | `"outcome":"equivalent"` |

`lab compare` exits 1 when any metric regresses, so every exit 0 above is the
tool's own verdict, not my reading of it.

I also drove `compareBenchReports` directly over **all eight** baselines against
each new report, via a scratch script importing
`packages/test-contracts/dist/bench-report.js`. Result:

```
run 1: equivalent x7, regressed x1
run 3: equivalent x6, improved x1, regressed x1
```

The single `regressed` in each is `run-duration-p95` against
`bench-mtxju6eb-7aacdf7a`, the fastest baseline ever recorded. Section 6 shows
why that is noise.

## Per-run detail

Both good runs produced the same shape, and the same shape as the newest
baseline:

| Run | Row | Repeat | verdict | oracle | reported | actions | duration ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | W01 basic-form | 0 | passed | passed | **passed** | 2 | 50932 |
| 1 | W28 iframe-checkout | 0 | passed | passed | **null** | 0 | 69871 |
| 1 | W01 basic-form | 1 | passed | passed | **passed** | 2 | 64430 |
| 1 | W28 iframe-checkout | 1 | passed | passed | **null** | 0 | 55176 |
| 3 | W01 basic-form | 0 | passed | passed | **passed** | 2 | 61243 |
| 3 | W28 iframe-checkout | 0 | passed | passed | **null** | 0 | 49789 |
| 3 | W01 basic-form | 1 | passed | passed | **passed** | 2 | 47503 |
| 3 | W28 iframe-checkout | 1 | passed | passed | **null** | 0 | 65979 |

The newest baseline `bench-mtxoim0b-8ca4952c` has exactly this pattern:
basic-form reports `passed` with 2 actions, iframe-checkout reports `null` with
0 actions, on both repeats. **The underlying behaviour is unchanged.**

## Every difference, and which kind it is

### 1. `initialExecutionSuccess` 1.000 -> 0.500 — INTENDED, the metric telling the truth

`aggregate-report.ts`'s `executed` predicate changed in `1b6f5df` from
`reportedVerdict !== "failed"` to `reportedVerdict === "passed"`. A run in which
FluxIQ executed no action reports `null`, and `!== "failed"` scored that as a
hit.

On the smoke corpus, W28 iframe-checkout is exactly such a row. I confirmed this
in the **baseline's own** evaluation files: `bench-mtxoim0b-8ca4952c` recorded
`reported null, actions 0` for both iframe-checkout repeats and still published
`initialExecutionSuccess = 1.000`. Nothing about that row got worse today; the
old predicate was crediting it for doing nothing, and the new one does not.

`1/2` is the honest number, and the honest sentence is: **initialExecutionSuccess
1 of 2, with 1 of that population executing no FluxIQ action at all.** The
report now prints both figures side by side.

**Not a regression.**

### 2. `deterministicReplaySuccess` 1.000 -> 0.500 — INTENDED, same cause

Same `hit: executed` predicate, same W28 row, applied to the later repeats.
Identical reasoning. **Not a regression.**

### 3. `notExecutedRuns: 2` and `actionsExecuted: 4` are new in `report.json` — INTENDED

Both absent from all eight baselines. They are optional in the schema
(`notExecutedRuns?: number`), so the baselines still parse and still compare —
which is why commands 4-8 worked at all. `compareBenchReports` does not compare
them. Schema version is unchanged at `0.1` on both sides.

### 4. `report.md` gained structure — INTENDED

Diffing baseline against candidate markdown with ids, dates and numbers masked
shows only additions from the honesty work:

- a new **"FluxIQ execution"** section stating actions executed and how many
  runs executed nothing;
- a **"Not executed"** column in the Rates table;
- **"Lane"** and **"Actions FluxIQ executed"** columns in the Runs table;
- header **"Lane" -> "Lanes"**;
- a **"### Recording lane"** subheading under Measurement sources;
- reworded populations for `initialExecutionSuccess` ("FluxIQ executed and
  reported success. A run in which FluxIQ executed nothing is a miss, not an
  exclusion") and `failureClassificationAccuracy` ("a run that reported no
  failure at all is a miss").

No line was removed. The `failureClassificationAccuracy` rewording has no
numeric effect here: smoke has no negative rows, so that population is 0.

### 5. Action latency p95 rose in run 1 and returned in run 3 — ENVIRONMENTAL

| Metric | Newest baseline | Run 1 | Run 3 |
| --- | --- | --- | --- |
| `web.browser.navigate` p95 | 1684 | 1865 | **1679** |
| `web.dom.type` p95 | 1432 | 1660 | **1441** |

Run 3 lands within 5 ms and 9 ms of baseline. Run 1's rise was machine load —
50 Chromium and 19 Node processes were live, with other Lab instances active.
Every latency comparison was inside the 25% tolerance in all eight baseline
pairings for both runs.

### 6. `run-duration-p95` flagged `regressed` against one baseline — ENVIRONMENTAL, and the metric cannot discriminate here

Run 1 p95 69871, run 3 p95 65979, newest baseline 57213. Equivalent against
seven of eight baselines; `regressed` only against `bench-mtxju6eb-7aacdf7a`
(44364), and `improved` against `bench-mtxgozcb-fbc5f35c` (91457).

The decisive evidence is that the baselines fail this test against **each
other**, before my run exists:

```
baseline run-duration p95: 91457 56431 61395 67894 73898 62678 44364 57213
min 44364  max 91457  ratio 2.06
baseline-vs-baseline ordered pairs: 56; outside the +/-25% tolerance: 24 (43%)
```

Forty-three percent of historical pairs already breach the tolerance. At four
samples on a shared machine, `run-duration-p95` measures load, not the product.
Both of my runs sit comfortably inside the baseline range. **Not a regression.**

### 7. Everything else is identical in meaning

Pass rate 1.000 and `stable-pass` on both rows; `falseFailure` 0.000 (0/2 over
1 workflow); `harnessActivation` 0.000 (0/4); `truncationCount` 0;
`sanitizedPacketBytes` and `rawSnapshotBytes` 0 samples; `llm` disabled with 0
calls; 0 results skipped. All match the baselines exactly.

The `--halves` check on run 1 returned `equivalent`, so the run was
self-consistent between its own repeats as well.

## The failed run, chased to its cause

Run 2 failed **uniformly**: all four runs, `verdict failed`, `oracle null`,
0 actions, and durations of **822, 98, 259 and 108 ms** against a normal 45-70
seconds. Nothing reached the fixture; these were startup deaths.

`report.json` and `report.md` gave no cause — `failureCategory: unknown`, the
Problems column empty. The message is only in each run's `events.ndjson`, and
all four carry the same one:

```
Cannot find module 'F:\!FluxIQ\packages\fluxiq\node_modules\@fluxiq\contracts\dist\automation-studio.js'
  imported from F:\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\runtime\llm\harness\context-packet.js
```

That is a **FluxIQ Core build artifact in the sibling `F:\!FluxIQ` checkout**,
not anything in this repository. It was missing because Core was being rebuilt
underneath the run: a clean-then-emit build deletes the file and re-emits it.

Confirmed by timestamps rather than inferred:

- the failing bench ran at **18:01:39-18:01:43** local;
- `packages/contracts/dist/automation-studio.js` has mtime **18:09:39** —
  eight minutes *after* the failure;
- 1988 files under Core's `contracts/dist` and `fluxiq/dist` were rewritten in
  that same burst, settling at **18:09:49**;
- once quiet, run 3 passed 4/4 with the identical shape to run 1.

So this is **not** the faulty RAM, and **not** a product defect. It is a
cross-repository build race: another agent rebuilding FluxIQ Core while a Lab
run imports Core's `dist`. The Lab's own build lock does not cover it, because
the lock serialises builds *within this repository* only.

## Findings for the supervisor (reported, not fixed)

1. **A Core rebuild during a Lab run kills every run in the bench, and the
   bench report does not say why.** The startup error is recorded as
   `failureCategory: unknown` with an empty Problems column; only
   `events.ndjson` carries the message. Surfacing the startup error text in the
   Problems column would turn a ten-minute diagnosis into a glance. I did not
   change any source.
2. **`run-duration-p95` should not gate anything at `--repeat 2`.** With 43% of
   historical baseline pairs already outside its own tolerance, it will produce
   `regressed` verdicts at random. Either raise the repeat count for that metric
   or stop treating it as a gate.
3. **A cross-repository build race exists with no guard.** Concurrent Lab
   instances are protected from each other; none is protected from a FluxIQ Core
   rebuild in `F:\!FluxIQ`.

## What this run did not exercise

The smoke corpus is two recording-lane rows and it does **not** reach most of
what changed since the baselines. Stated explicitly so the green is not
over-read:

- **The six redaction fixes and the rewritten page-evidence pipeline** —
  untouched. `sanitizedPacketBytes` and `rawSnapshotBytes` both have **0
  samples**; the recording lane's bundle holds neither, as the report's own
  Measurement sources section states.
- **The closed failure-code set** — untouched. `failureClassificationAccuracy`
  has a population of **0**; smoke carries no row with an expected failure.
- **Core's element matcher weights and the Level 1 veto** — untouched. The only
  actions FluxIQ executed were W01's two-action Core round-trip probe. No
  workflow was executed against an ambiguous target, which is the only place the
  veto can fire.
- **The Flow lane** — the smoke corpus declares `lanes: ["recording"]` only, so
  `flowCreationSuccess` and `fuzzyRecovery` are `null` on both sides.

## Not verified

- That anything above holds on the `week1` corpus, on `persistent-isolated`, or
  on the Flow lane. Smoke only.
- That the two rows would still pass on an unloaded machine at their historical
  speed. Both good runs were slower than the median baseline; I attribute that
  to load, supported by run 3's latencies returning to baseline, but I did not
  run on a quiet machine to prove it.
- **Single-observation findings**, per the brief:
  - The **Core rebuild race** rests on one occurrence. The mtime evidence is
    strong and the mechanism is clear, but I did not reproduce it deliberately.
  - Run 1's **elevated action latency** rests on one occurrence, though run 3
    returning to baseline is corroborating evidence that it was load.
  - Everything else — the two intended metric changes, the report-format
    additions, and the unchanged pass/failure/activation figures — rests on
    **two independent runs**, and the metric changes additionally on reading the
    baselines' own evaluation files.
- I did not run `pnpm check`, `pnpm test`, or `pnpm build`; the brief scoped me
  to the Lab.

## Open questions or contradictions found

- **None in the product.** The bench's numbers moved exactly where the honesty
  work said they would move, and nowhere else.
- One question for the supervisor: the historical baselines in
  `test-runs/bench/` were all measured under the **old** `initialExecutionSuccess`
  definition. They remain comparable — `compareBenchReports` runs cleanly and the
  optional new fields do not break parsing — but any future report quoting a
  baseline's `1.000` should say which definition produced it, or the number will
  be read as a fall from 100% to 50%.
- Nothing was committed. No source file was modified. No pairing token, bearer
  token, recorded page content, or `.fluxiq` material appears in this report.

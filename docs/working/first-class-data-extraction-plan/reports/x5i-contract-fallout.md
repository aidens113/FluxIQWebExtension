# x5i-contract-fallout

## Outcome

**Partial.** All five locations the brief names are fixed, and the first
acceptance command is green: `test-contracts` is now **91 tests, 91 pass, 0
fail** (was 91/89/2).

It is Partial because the second acceptance command does **not** reach green.
`test-runner` went from **856 pass / 3 fail** to **857 pass / 2 fail**: my row
(`week1-corpus`) passes, and the two that remain are in files outside my "Owns"
list. One is genuine fallout from the reversed contract; the other is not caused
by this change at all. Neither is mine to edit, so both are reported below with
the precise fix identified. This is the same class of omission x5g hit, one
layer further down.

## The predicted failure: run, not assumed

The brief required me to run the prediction rather than act on it. x5g predicted
**one** test-runner failure, in `week1-corpus.test.ts`. **I observed three.** The
prediction was correct about its own row and silent about the other two.

**1. `week1-corpus.test.ts` — predicted and confirmed.**
`dist/bench/tests/week1-corpus.test.js:86`, asserting at `:95`:

```
+ actual - expected
  [
+   67,      -   63,
    23,
    0,
+   23,      -   21,
+   21       -   19
  ]
```

with the test's own diagnostic:
`runnable: 67 (23 recording; 44 flow, 23 unarmed and 21 variants); skipped: 0`.

This is exactly **D7** ("the week1 corpus grows from 63 to 67 runnable results"),
so the observed numbers are the decided target, not a surprise. The assertion at
`:100` aborted the test, so `:102-109` were never evaluated on the old run; I
reasoned them through and re-ran.

**2 and 3 were not predicted** — see "Open questions" below.

## What changed and why

### `packages/test-contracts/tests/scenario-validation.test.mjs` (the 2 failures)

- **`:189` (was `not ok 79`).** Its `unmeetable` fixture pins `web.dom.extract`
  on a workflow whose script *does* contain an extract step, so that pin is now
  legitimately meetable and its issue disappeared. I kept the pin — it is now a
  useful positive control — and moved the unmeetable-extract case onto the
  `scroll-only` workflow, which extracts nothing, by adding a third
  `{ action: "web.dom.extract" }` to its expectations. The path list therefore
  still has three entries, and the `assert.match` moved from `issues[0]` to
  `issues[2]`, which is that extract issue. The test keeps its original purpose:
  an extract pinned where no recording holds it is still refused.
- **`:211` (was `not ok 80`).** Its `readsPages` helper pinned `web.dom.click` on
  an extract-only workflow and expected the **paginated** case to be valid, which
  was true only because of the paginated-click branch x5g deleted. `readsPages`
  now takes the pinned action as a parameter, so the case is inverted and
  strengthened: a paginated extract pinning `web.dom.extract_list` is **valid**,
  and `web.dom.click` is **refused in both** the paginated and unpaginated forms.
- **Doc comment `:184-187`** rewrote the false clause ("because an extract step
  is the runner's own check").

### `packages/test-runner/src/bench/tests/week1-corpus.test.ts`

- `NO_FLOW_LANE_ROWS` **deleted** (declaration and all three uses): no week1
  workflow is Flow-lane-excluded any more, so the set had no members.
- Counts `[63, 23, 0, 21, 19]` → `[67, 23, 0, 23, 21]`, per the observed run.
- The Flow lane now runs **every** unarmed workflow the recording lane runs, so
  `criterionOne` is the whole of W01-W18 and the two filtered comparisons became
  direct ones. I kept a W04/W08 row, inverted: they now **reach** the Flow lane,
  which is the fact D7 and D14 turn on.
- The four-skip assertion became `skippedResolved === []`, and the
  `skipReason` regex loop was dropped with it (it would have been vacuous).
- The test name ("plans 63 ... which the Flow lane skips") and the doc comment
  were rewritten; the comment keeps the history of why W04/W08 were excluded and
  says what changed.

### Three stale comments (comment-only, as specified)

- `packages/test-contracts/src/validation.ts:230-238` — kept the W11/W15 history,
  corrected the rule: an unmeetable entry is now one no step yields at all, such
  as a `web.dom.click` pinned on a workflow that only extracts.
- `packages/test-contracts/src/scenario.ts:21-27` — `extract` is no longer "the
  runner's own data-extraction check, never recorded"; pagination belongs to the
  one recorded node, so a paginated step yields no `web.dom.click`.
- `apps/scenario-lab/src/scenarios/admin-console/tests/scenario.test.ts:232` —
  the assertion (that this workflow pins no `actions`) is still true and
  untouched; only the false reason was replaced.

### One self-inflicted regression, fixed

My first pass took `scenario-validation.test.mjs` from **399 to 405 lines**,
crossing the audit's 400-line advisory threshold and adding a `[file-lines]`
warning that HEAD did not have. I trimmed my own added comments and collapsed
the new loop back to **399 lines**, keeping every assertion. The audit now
reports **no finding** against that file.

## Commands run and observed results

Run one at a time, never concurrently (the brief says run alone, and this
machine's RAM fault makes parallel heavy gates unreliable).

1. **`pnpm --filter @fluxiq-web-extension/test-runner test`, before any edit** —
   `# tests 859`, `# pass 856`, `# fail 3`. (My first attempt piped this through
   `tail -60`, which discarded the failure detail; I re-ran capturing the whole
   output rather than report from the summary line.)
2. **`pnpm --filter @fluxiq-web-extension/test-contracts test`, before** —
   `# tests 91`, `# pass 89`, `# fail 2`, matching x5g's hand-off exactly.
3. **`pnpm --filter @fluxiq-web-extension/test-contracts test`, after** —
   `# tests 91`, `# pass 91`, `# fail 0`, **exit 0**. Zero `not ok` lines.
4. **`pnpm --filter @fluxiq-web-extension/test-runner test`, after** —
   `# tests 859`, `# pass 857`, `# fail 2`, exit 1.
   `ok 136 - week1 plans 67 runnable results per repeat: ...` with
   `# runnable: 67 (23 recording; 44 flow, 23 unarmed and 21 variants); skipped: 0`.
   The 2 remaining failures are items 2 and 3 in "Open questions".
5. **`pnpm structure:check`** — before: `2 violation(s)`, both `[working-docs]`
   on the supervisor's own documents. After: **`1 violation(s)`** —
   `docs/working/README.md is out of date`. (The plan document's 1300-line
   compaction FAIL present in my earlier run was gone by the final run; that
   document is not mine and was being edited concurrently.) No `[file-lines]`,
   `[exported-values]` or other finding names any file I touched.
6. **`git show HEAD:...scenario-validation.test.mjs | wc -l`** → 399, against 405
   in my working tree mid-task, which is how I caught the threshold crossing;
   final `wc -l` → **399**.
7. **Built contract confirmed before trusting any run:**
   `packages/test-contracts/dist/recordable-actions.js:51` reads
   `extract: ["web.dom.extract_list", "web.dom.extract"]`, so every observation
   above is against x5g's landed contract, not a stale dist.

## Not verified

- **`test-runner` is not green**, and cannot be made green from my owned files.
  Two failures remain, both outside my "Owns" list.
- **No browser, no Lab, no Playwright, no bench.** That the extension really
  records an extract node as `web.dom.extract_list` is the X4/X5.3 seam's claim;
  nothing here is evidence about a live recording. The 67-result plan is a
  *plan*, not a measured bench — W04's and W08's four restored Flow-lane results
  have never actually been executed.
- **The scenario-lab suite was not run.** My admin-console edit is a comment, so
  it has no runtime effect, but I did not type-check or run that package: it is
  owned by the fixture workers and a run would race their edits.
- **Root `pnpm check`, `pnpm test`, `pnpm build` were not run** — other packages
  are owned by workers still in flight.
- The final `test-runner` run predates nothing of mine: my last trims touched
  only `tests/*.mjs` in test-contracts, which test-runner does not consume (it
  reads that package's `dist`, built from `src`, and my `src` edits were
  comment-only and already compiled into run 4).

## Open questions or contradictions found

1. **`run-evaluation/tests/runner-wiring.test.ts:245` is unowned and fails — real
   fallout from this contract change.** Observed: expected `'fixture.invalid'`,
   actual `'environment.missing'`. The test performs a live `runScenario` on
   `product-catalog` with `flow: true`, expecting `flowLaneExclusion` to refuse
   it "before a bundle, Core or a browser exists". W04 is extract-only, so it is
   no longer excluded; the run proceeds and dies at `requireExtension` instead.
   Its first four assertions (the runner's source shape, `:247-257`) still pass —
   only the live half at `:262-265` breaks. **No week1 fixture is an example of a
   no-action workflow any more**, so the fix is either a fixture whose script is
   only `waitForState`/`checkpoint`/`waitForDownload`, or dropping the live half
   and keeping the source-shape assertions. Its doc comment (`:239-243`, "W04 ...
   only reads the page") is stale either way. This needs an owner.
2. **`run-expectations/tests/recording-event-types.test.ts` fails for an
   unrelated reason — not this change.** The brief told me to report rather than
   edit such a case, and `run-expectations/**` is in my "Must not touch" list.
   The mirror compares test-runner's `recordingEventTypesByKind` against the
   domain source. The **domain has** `data.extract` → `web.data.extraction_defined`
   (`domain/src/constants.ts:18`, `domain/src/io/input-model.ts:70`); the
   **test-runner mirror lacks that row**. This is X4.1 / `x4a-domain-recorded-extraction`
   landing the domain side ahead of its mirror, and it would fail with or without
   x5g's `recordable-actions.ts` edit. Fix: add the `data.extract` row to
   `packages/test-runner/src/run-expectations/recording-event-types.ts`.
3. **`packages/test-runner/src/bench/corpus/week1.ts:19-21` is now stale** and is
   not in my "Owns" (I own only `week1-corpus.test.ts`). It still says W04's and
   W08's "four Flow-lane entries are planned as skipped ... That leaves 63
   runnable results per repeat, 23 on the recording lane and 40 on the Flow lane
   (21 unarmed, 19 variants)". Correct values are 67, 23, and 44 (23 unarmed, 21
   variants). It is a doc comment, so nothing fails on it — which is exactly why
   it will survive unnoticed.
4. **`expand-corpus.ts` needs no change.** Its comments (`:28-30`, `:63-67`)
   state the rule generically rather than naming W04/W08, so they stay true.
5. **D7 is now satisfied on the planning side.** The corpus plans 67 runnable
   results, which is the "new baseline" D7 called for; the A/B pair that makes it
   a baseline still has to be run.

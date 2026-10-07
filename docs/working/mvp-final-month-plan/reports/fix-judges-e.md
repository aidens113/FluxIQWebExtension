# fix-judges-e: lane C R3-3, the named rows after a rerun of a blamed read

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t286/!FluxIQ` (branch `task/t286-fix-judges`).
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Partial. Steps 1 and 2 are done and tested: the rows are carried in structured form, and the pure function is written.
Step 3, the wiring, is in `R/llm/evidence-loop.ts`, which another stream owns, so I did not edit it. The exact change
is written out below. I also found one dependency for that wiring that nobody has built yet: a live rerun's answer does
not carry `readRows` (see Open questions).

## What changed and why

- `R/result-verification/request-rows/types.ts`: new types `AutomationStudioRequestRowsNamed`
  (`{ step? | nodeId?, condition, rows: { label, ids? }[] }`) and `AutomationStudioRequestRowsAfterRerun`
  (`{ kept, stillLeftOut, said }`).
- `R/result-verification/request-rows/checked-rows-named.ts` (new):
  `automationStudioResultCheckedRowsNamed(summary, checked)`.
  - It reads the rows that Core's `checked` lines name, per read and condition, back against the summary the lines
    were made from. The build-test judge holds the lines and the summary, but not the judge's reply text.
    `checked-rows.ts` matched rows against that reply text inside `verdict.ts`, and I do not own that file.
  - A row counts as named for a condition when all of these hold:
    - a line names its read (`Step N` as a whole number, or `Read <node>`) and contains `the condition "<c>"`;
    - the line lists the row's full label after `: ` or `; `;
    - after the label (and after any parentheses holding ids or "also in the result") comes the line's end, `;`, `.`
      or ` —`.
  - This works for both of Core's line formats: the `checked-rows.ts` lines, and `verdict.ts`'s line for a downgraded
    yes.
  - A label that only starts a longer listed label is not taken.
  - `checked-rows.ts` and its lines are unchanged.
- `R/result-verification/request-rows/rerun-rows.ts` (new):
  `automationStudioRequestRowsAfterRerun(named, labels, step?)` is the pure function from step 2.
  - It returns `{ kept, stillLeftOut, said }`, or `undefined` when no rows were named.
  - A named row counts as kept when any of these holds:
    - a rerun label matches it word for word (case, punctuation and plurals ignored, by `words.ts`);
    - an id the row was named by, or carries, is held by exactly one rerun label;
    - its distinguishing prefix of at least 4 words (`row-naming.ts`, pool = named plus rerun labels) starts exactly
      one rerun label.
  - Rerun labels are first passed through `automationStudioRequestRowLabel` to strip `— column: value`, and
    `(withheld)` is ignored.
  - The sentence is in Core's words.
    - All kept: "Core's check of the Flow's last test named 3 rows that the condition "name" of step 9 alone left out
      (judgement.judge.checked). This rerun of step 5 keeps all 3: …. None of the rows the check named is left out now:
      complete, so the Flow is tested again from its start and judged on what it does now."
    - Some kept: it names the kept rows and the ones still left out, and does not say to complete.
    - None kept: "still leaves out all N: …".
- `R/result-verification/request-rows/named-of.ts` (new): `automationStudioRequestRowsNamedOf(value)` reads
  `judgement.judge.checkedRows` back from the JSON value. The repair loop holds the judgement only as a `JsonObject`.
- `R/result-verification/request-rows/index.ts`: the barrel exports the three new files, and its header lists them.
- `R/result-verification/build-test/judge.ts`: the `no` verdict type gains `checkedRows?`. The no computes it with
  `automationStudioResultCheckedRowsNamed(input.summary, outcome.repair?.checked ?? [])` and includes it only when it
  is non-empty. The header says why.
- `R/flow-bootstrap/unfinished-build/contracts.ts`: `checkedRows?: AutomationStudioRequestRowsNamed[]` is added to the
  `no` verdict and to `AutomationStudioFlowBootstrapJudgedWrong`. It is a type-only import from `request-rows`.
- `R/flow-bootstrap/unfinished-build/judgement.ts`:
  - `judgedWrong` copies `checkedRows`;
  - `judgeValue` writes `judge.checkedRows` as `[{ step | nodeId, condition, rows: [{ label, ids? }] }]` (new local
    `namedValue`);
  - `checked` is unchanged.
- Tests:
  - `request-rows/tests/checked-rows.test.ts`: 3 new cases.
    - The structured rows agree with the lines: one entry per "alone left out" line, with exactly its rows and ids, on
      the run-muw60j7c run summary.
    - A build test's step 10 "name" gives exactly the 3 pairs.
    - No lines gives nothing, and a label that only starts a listed one is not taken.
  - `request-rows/tests/rerun-rows.test.ts` (new): 6 cases.
    - All kept (13 rows).
    - Some still out.
    - None kept.
    - Matching: word-for-word label, tested-value suffix, id, 4-word prefix, `(withheld)`.
    - No match on a prefix under 4 words, or on one that two rerun rows start with.
    - No named rows gives `undefined`.
  - `request-rows/tests/named-of.test.ts` (new): 2 cases.
  - `build-test/tests/judge-rows.test.ts`: 2 cases. The no carries `checkedRows`, both from a yes that Core
    downgraded and from a judge's no that names the rows (`Step 10: the condition "name" alone left out …`).
  - `unfinished-build/tests/judged-wrong-rows.test.ts`: the judgement value's `judge.checkedRows` equals step 10
    "name" with the 3 pairs. No file was added to that folder; it still holds 25.

## Commands run and observed results

All commands were run from `packages/fluxiq`.

- Red, before the barrel exports and the judge and judgement edits:
  `npx vitest run …/request-rows/tests/checked-rows.test.ts …/request-rows/tests/rerun-rows.test.ts …/build-test/tests/judge-rows.test.ts …/unfinished-build/tests/judged-wrong-rows.test.ts`
  -> `Test Files 4 failed (4)`, `Failed Tests 12`.
  - checked-rows and rerun-rows failed with `TypeError: automationStudioResultCheckedRowsNamed is not a function` and
    `automationStudioRequestRowsAfterRerun is not a function`.
  - judge-rows (×2) and judged-wrong-rows failed with
    `AssertionError: expected undefined to deeply equal [ { step: 10, …(2) } ]`.
- Green:
  `npx vitest run …/result-verification/request-rows/tests …/build-test/tests/judge-rows.test.ts …/build-test/tests/judge.test.ts …/unfinished-build/tests/judged-wrong-rows.test.ts …/unfinished-build/tests/judgement-value.test.ts …/unfinished-build/tests/judged.test.ts`
  -> `Test Files 9 passed (9)`, `Tests 82 passed (82)`.
- Typecheck:
  `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-t286e.tsbuildinfo`
  -> exit 2, with 6 errors, all syntax errors (TS1002, TS1434, TS1127) in
  `result-verification/tests/judge-sees-the-end.test.ts`. That file is another worker's and is being edited now.
  - Syntax errors stop the semantic check, so I re-ran with a temporary `tsconfig.t286e-scratch.json` that excludes
    only that file, and deleted it afterwards.
  - That run gave exit 2 with 8 errors, all `startView` (TS2339, TS2353) in `llm/node-tools/tests/dry-run-gate-end-view.test.ts`,
    `build-test/tests/end-view.test.ts` and `service/flow-bootstrap-commands/tests/build-judge.test.ts`. Those are
    other workers' fail-first tests.
  - There were 0 errors in my files.

## Not verified

- The wiring (step 3) is not applied, so the model being told the result after a rerun is not exercised end to end.
- No live or Lab run.
- I did not run the structure audit, `fluxiq:check` or `pnpm build`, as the brief instructs.
- I wrote `named-of.test.ts` after `named-of.ts`. I added that reader while working out the wiring, so it has no red
  run recorded.

## Wiring to apply (step 3): `R/llm/evidence-loop.ts`, another stream's file

The rerun's answer is put together in `runCall` (around lines 409-470):
`automationStudioNodeRerunAnswer` gives `ran`, which is parsed into `execution`, and the answer reaches the model at
`evidence.push({ callId, toolId: decision.toolId, value })`. `rerun-check.ts` is a poorer place for this, because it
has neither the judgement nor the read's rows. Apply this change in `runCall`, directly after
`const { evidence: value, effectApplied, resultCode } = execution;`:

```ts
// A rerun of a read after a judged test: which rows Core's check named it keeps now, in Core's words (R3-3, `../result-verification/request-rows/rerun-rows.ts`).
const judged = input.draft === false ? undefined : input.draft?.resume?.judgement; // not the later `resume` const: the arrival call runs before it is declared
const named = rerunReplaces?.effect === "observe" && isObject(judged?.judge) ? automationStudioRequestRowsNamedOf(judged.judge.checkedRows) : [];
const rerunRows = named.length ? automationStudioBuildTestReadRows(value, <the loop's denied evidence keys>).value : undefined;
const labels = isObject(rerunRows) && isObject(rerunRows.readRows) && Array.isArray(rerunRows.readRows.rows) ? rerunRows.readRows.rows.filter((row): row is string => typeof row === "string") : undefined;
const afterRerun = labels ? automationStudioRequestRowsAfterRerun(named, labels, rerunReplaces!.position) : undefined;
const answered = afterRerun && isObject(value) ? { ...value, checkedRowsNow: { kept: afterRerun.kept, stillLeftOut: afterRerun.stillLeftOut, said: afterRerun.said } } : value;
```

Then push `answered` in place of `value` at `evidence.push(...)`, and use it for `noProgress.answerRepeats({ answer })`
so that the model and the repeat checks see the same answer.

- Imports: `automationStudioRequestRowsNamedOf`, `automationStudioRequestRowsAfterRerun` and
  `automationStudioBuildTestReadRows` from `../result-verification/index.ts`, or from `request-rows` and `build-test`
  if the barrel order causes a cycle. `judged-wrong-rows.test.ts` notes that the judge has to load before the
  evidence loop.
- `named` is deliberately not filtered by step number. The judgement's step numbers are the judged round's draft
  positions, while the repair seed renumbers (run mux6naez: `checked` said "Step 9", the rerun was step 5).
- Test to add: `R/llm/tests/` or `R/llm/evidence-loop/tests/`, `rerun-checked-rows.test.ts`.
  - Set up a loop with `draft.resume.judgement.judge.checkedRows = [{ step: 9, condition: "name", rows: [3 labels] }]`
    and a seeded observe step 5.
  - Script a rerun of step 5 whose `executeTool` answer carries `readRows.rows` holding 10 other labels plus the 3.
  - Assert that the evidence entry for that call has `checkedRowsNow.kept` equal to the 3 labels and that `said`
    contains "complete, so the Flow is tested again".
  - Second case: an answer without one of the 3. Assert that `stillLeftOut` names it and that `said` has no
    "complete".
- `R/llm/evidence-loop/resume.ts`, also another stream's: `CORE_ON_ROWS` should add one sentence. Suggested
  wording: "judgement.judge.checkedRows lists the same rows by read and condition; after a rerun of such a read, its
  answer's checkedRowsNow says which of them it keeps now." Otherwise `checkedRows` (now in the judgement value the
  model sees) is unexplained. The alternative is to strip it from the resume entry and keep it only for the loop.

## Open questions or contradictions found

1. **A live rerun's answer carries no `readRows`.** In the downstream domain, `readRows` is attached only to replay
   answers (`domain/src/runtime/llm-evidence/node-run/replay.ts:406`, `replay-answer.ts`). A repair's rerun of a read
   runs live (`rerun-check.ts` turns it into `replay: "verify"` only for a lasting act that is already done). So the
   wiring above finds no labels until either:
   - the web domain adds `readRows.rows` (and `leftOutOnlyByThis`) to a live list read's answer, which is a
     cross-repo, downstream change and the better route, because `read-rows.ts`'s screening then applies unchanged; or
   - the loop takes labels from the answer's array output by the read's label column.
   The debug's answer text ("13 records from 5 pages") suggests the live answer gives counts, not labels. This needs a
   decision and an owner.
2. **Step numbers disagree between `checked` and `whereToFix`.** The build-test summary numbers steps by the judged
   round's draft positions, which include exploratory steps (the "Step 9" in `checked`). `whereToFix` and the repair
   seed use the renumbered positions (step 5). The model is told the same read under two numbers. This is not fixed
   here; the structured rows keep the test's number, and the wiring does not filter by it.
3. I edited no other file under `request-rows/tests/`, but `left-out-naming-the-item.test.ts` there shows as modified
   in `git status`. Someone else changed it, inside the folder this brief gives me.
4. Run mux6naez's repair also hit R3-2 (an unchanged rerun answered `applied` / `draftState: changed`). That is
   separate from this brief and untouched.

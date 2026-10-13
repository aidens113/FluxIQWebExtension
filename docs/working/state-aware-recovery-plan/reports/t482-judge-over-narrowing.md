# t482 judge-over-narrowing: worker report

Worker: t482 (Core tree `fxwork/t482/!FluxIQ`, branch `task/t482-judge-over-narrowing`). Nothing was committed. All edits are in Core, inside the owned paths.

## Outcome

**Done.** This covers the brief's three goals and the coordinator's two mid-task additions:

- the record-set card wording;
- the D3 cause location;
- the N3 condition wording.

Every new or changed test failed on the HEAD sources and passes on the new ones. Typecheck is clean and the structure audit passes.

## What changed and why

### 1. Every read names the steps that acted on the page before it (`narrowedBefore`)

- **New: `runtime/result-verification/narrowed-before.ts`** (`automationStudioResultNarrowedBefore`).
  - For each read, it lists every step that ran before the read's first attempt and acted on the page, in run order.
  - It names each step once, by `nodeId`, `label`, `control` and `effect`:
    - `control` is the control's sayable words, from the existing single owner `llm/model-facing/control-words.ts`.
    - `effect` is `new_page`, `same_page` or `already_shown` (from `stateHeld`). It is absent when the step had page refs but no diff.
  - It leaves out:
    - a step whose diff says nothing changed;
    - skipped steps;
    - tries that did not settle;
    - other reads.
  - The read's own next page runs after its first attempt, so it is never listed.
  - Without a denied-keys declaration no control words are carried. A control word that is a denied key or credential-shaped is dropped. Either case sets `withheld`.
  - This closes the exact gap from the debug: `step-changes.ts` drops page moves.
- **Owner choice: `result-summary.ts`, not `build-test/summary.ts`.**
  - The candidate-trial judges and the final check both use `summarizeAutomationStudioRunResult`. The trial's summary is built from the trial run's own trace (`service/candidate-trial/summary.ts`).
  - The debug confirms those trial judges carried no `buildTest`.
  - The legacy build-test path has no session trace, so it gets nothing.
  - `narrowedBefore` is attached only to reads whose `nodeId` and `definitionId` match one of the Flow's own nodes, so a called part's read is never paired with a parent step.
- **`contracts.ts`:**
  - added `AutomationStudioResultReadAccount.narrowedBefore`;
  - added the new type `AutomationStudioResultNarrowingStep`;
  - the barrel `index.ts` exports the new modules.
- **Trial feedback for the model: `service/candidate-trial/reads.ts`.**
  - Each read carries `narrowedBefore`, plus one `beforeRead` sentence: rows a site step removed never reached the read, and a step that keeps less than asked should be removed, or replaced by a condition on the read.
  - The existing `said` text is unchanged.

### 2. Judge instruction (`runtime/llm/diagnosis-instructions.ts`)

- **One abstract rule after the `leftOutOnlyByThis` sentences.** It says:
  - `reads[].narrowedBefore` lists the steps before the read;
  - the rows such a step removed have no witness;
  - a step whose words keep less than the request asks (a narrower range or bound, or a category, option or value the request does not name) means rows may be missing, so answer no, say which step and which of its words, and name the step by nodeId in `changed`;
  - a step that keeps exactly a clause of the request, or narrows nothing, is correct.
- **The example uses another kind of site.** It is a library catalogue: books "since 2000" read after "2010 and later". It has no price, currency, shop or product.
- **The no-list now has the converse clause:** "... a Flow with no step that could have narrowed ..., or a step before a read that keeps less than the request asks".
- **Re-pinned:** `llm/deepseek/tests/system-prompt-pins.json`, `loop_verification` and `loop_verification_build_test`.
  - Only these two values changed (2 lines).
  - They were produced by applying the same two textual changes to the old pins, asserting that each new pin contains the new instruction verbatim. The pin test passes.

### 3. D3: `rowsActedOn` reached the judges as `{}` (coordinator addition (a))

- **Cause location: `result-verification/step-rows.ts`, `rowFields`.**
  - Both the trial and the final check build the summary from the saved trace:
    - `runAutomationStudioDetachedCandidate` returns `runCanonicalAutomationStudioFlow`'s saved trace;
    - `run-outcome.ts` passes `session.trace`.
  - The saved trace replaces every captured row with `{ $datasetRow: { datasetId, ordinal } }` (`executor/record-summary.ts`).
  - For Each hands its passes the read's rows by reference, so each pass's `outputs.item` is that marker.
  - `rowFields` dropped every `$`-prefixed key as "minted", which left `{}`.
  - I matched this to the source; I did not trace it on the live run itself, because the run's trace is not on disk.
- **New: `result-verification/captured-rows.ts`.** It reads a marker back as the stored row only where the stored rows still stand in capture order:
  - the set is unprocessed; or
  - processing kept every row it collected (`collected === kept === rows.length`), and every writing node is a Flow node that declares no sort (in `recordOutput.process.sort`, or in the read's own parameters).
- **Otherwise the row is named by its place:** "row N collected into <datasetId>". It is never empty, and never possibly another row.
- `step-rows.ts` takes an optional `capturedRow` resolver. Screening of the resolved row is unchanged.

### 4. Record-set card wording (coordinator addition)

- **`verdict.ts` `eachSet`.** The observation now appends `; the same rows in each` or `; N distinct`.
  - The rows are compared by the columns every set stores.
  - Nothing is said when anything is withheld or truncated, when not every row was sent, or when the sets share no column.
- **`check-words.ts` `setsWords`.** The card says:
  - "4 rows came back (the same rows in both record sets)" ("all N" when there are more than two sets);
  - "6 rows came back across 2 record sets (4 and 4 rows, some rows in more than one set)";
  - "... no row in more than one set";
  - otherwise each set's count. "in each of" is gone.

### 5. N3: a presence condition on the item's own read (coordinator addition (b))

- **`read-account/condition.ts`.** An `is: absent` condition is now worded by the words that read found on a row it left out, e.g. `the item's text "Accept" is absent (a row is kept only when it has no "Accept")`, when the condition:
  - reads something no column makes and no attribute names;
  - has no other relation and no `not`.
- **The word source:** the screened `leftOutObservations`, which `accounts.ts` now computes before it words the condition.
- **Fallbacks:** with no sayable witness, or a locator-shaped one, the condition is worded as before.

### Docs

`docs/architecture/automation-studio.md`, in the result-verification section after the `changed` paragraph: two paragraphs covering `narrowedBefore` and the judge rule, the row markers, N3, and the card wording.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t482/!FluxIQ`.

- **Typecheck:** `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` (in `packages/fluxiq`).
  - It printed nothing, after the first edits and again at the end.
- **Touched test folders, first batch:** `npx vitest run` over `result-verification/tests`, `result-verification/read-account/tests`, `service/candidate-trial/tests`, `llm/tests/diagnosis-channel.test.ts` and `llm/deepseek/tests/system-prompt.test.ts`.
  - Result: `Test Files 51 passed (51)`, `Tests 520 passed (520)`.
- **Touched test folders, second batch:** `npx vitest run` over `llm/tests`, `llm/deepseek/tests`, `result-verification/build-test/tests`, `result-verification/request-rows/tests` and `result-verification/condition-observation/tests`.
  - Result: `Test Files 58 passed (58)`, `Tests 742 passed (742)`.
- **Fail-first check:**
  - I copied the HEAD versions of the 8 changed source files over mine (backups in scratchpad), then ran the 7 new or changed test files.
  - Result: `Test Files 7 failed (7)`, `Tests 17 failed | 50 passed (67)`.
  - Every failure was a new or changed case: narrowed-before ×3, the marker rows ×2, check-words ×3, condition-lacking ×1, trial reads ×1, the narrowing rule ×3, and the pins ×4.
  - After restoring my versions, they passed: `6 passed (6), 62 passed`, plus `narrowed-before` `5 passed`.
- **After moving the instruction tests into `diagnosis-channel.test.ts` and replacing an `as never` stub:** `diagnosis-channel` + `narrowed-before` gave `Test Files 2 passed (2)`, `Tests 31 passed (31)`.
- **Structure audit:** `node scripts/structure-audit.mjs` printed `structure-audit: passed (337 warning(s), 1159 baselined)`, plus "2 baseline entries can be lowered".
  - An earlier run failed on two violations of mine, both fixed before that pass:
    - an `[as-never]` cast in the new test;
    - `[directory-files]` llm/tests at 26 > 25 files.
- **Docs links:** `node scripts/structure-audit.mjs --rule docs-links` printed `passed`.

## Not verified

- **No Lab, provider or live run.** Whether deepseek-flash judges now refuse an over-narrowing filter, and name it, is untested. The proof is the next lane C round.
- **The real trial's filter clicks carry a stateDiff.** I did not confirm on that trace that they carry `documentChanged: true`.
  - If a click carried no diff but did carry page refs, it is still listed, without `effect`.
  - If it carried no `stateRefs` at all, it is not listed.
- **D3 on the live run.** The fix matches the source; the saved trace of `run-mv62icw0` is not on disk.
  - Whether the store returns unprocessed collected rows in ordinal order is assumed from "an unprocessed dataset reads as its collected rows". I did not test it against the SQLite store.
- **The structure-audit note "2 baseline entries can be lowered".** I did not run `pnpm structure:baseline`; `.structure-baseline.json` is not owned. I did not check whether the note predates my change.
- **No full suites**, per the brief.

## Open questions or contradictions found

- **No deterministic Core gate refuses a yes over an over-narrowing step.** Only the judge rule refuses it. Core cannot tell "2010 and later" from a correct category filter without reading meaning.
  - Two options, neither built:
    - require a yes to mention each `narrowedBefore` step, as `leftOutNamingTheItem` is required;
    - the debug's `alsoTestedBy` hint.
- **Feedback wording is mixed.** The model's trial feedback names steps by `nodeId`, as the existing reads feedback already does. The script vocabulary the model writes may use other step names; unchanged here.
- **D3 can fall back to place-only rows.** A processed set that dropped repeats, or a read with a sort, now gets "row N collected into X" rather than the row's content. Giving the row itself would need the executed (unmarked) trace, or a collected-rows read from the store. Both are outside the owned paths:
  - `flow-bootstrap/verification/detached-execution.ts`;
  - `service/datasets`.

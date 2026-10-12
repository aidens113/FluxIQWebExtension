# t464 report: quoted script values, option not offered, unchanged resubmissions

Worker report. Core-paired: both worktrees are on `task/t464-quoted-values-and-unchanged-resubmits`. Nothing was committed.

## Outcome

Done. All three items are in, plus the supervisor's addendum (lane C round 8: a refuted Flow submitted again). The narrow checks pass in both repositories. No live or browser run was made.

## What changed and why

### 1. A quoted script value is its value (Core)

- **New `authoring/quoted-value.ts`** exports `authoringQuotedValue(text)`. A value wrapped in one matching pair of `"`, `'` or a backtick returns the text inside the pair; anything else returns `undefined`, and the caller keeps the text as written.
  - Double quotes are read with `JSON.parse` first, so JSON escapes keep their meaning.
  - Otherwise, a backslash before the same quote mark, or before another backslash, is read as that character, and any other backslash is kept.
  - A quote mark inside the value stays: `'a "b" c'` → `a "b" c`, `'What's new'` → `What's new`, `"say "hi""` → `say "hi"`.
  - A closing mark escaped by a backslash means the value never closed, so it is not read as quoted.
  - The file is not exported from the authoring barrel, following the barrel's stated policy for `values.ts`.
- **`authoring/values.ts`** now uses the reader for:
  - the string default (the defect: `value: "2"` now sends `2`);
  - the number test (`timeoutMs: "2000"` → 2000);
  - a record-output name;
  - `authoringNestedValue`, where a quoted item is its text, as a string.

  State bindings, JSON objects and lists are unchanged. Options and booleans already ignored quotes through `authoringKey`.
- **`authoring/condition.ts`**: `unquoted()` now calls the same reader and then trims, as before. One behaviour difference: escapes inside a quoted condition value are now honoured.

### 2. A select asked for an option it does not offer (downstream)

- **`domain/src/runtime/failure/codes.ts`** has a new code, `OPTION_NOT_OFFERED: "web.validation.option_not_offered"`, defined as `{ category: "output_not_observed", retryable: false, stage: "verification" }`. `OUTPUT_NOT_OBSERVED` keeps `retryable: true`. That code still covers list reads and clicks, and changing it would bring back the "11 of 18 runs" problem. The category is unchanged, so Core's category-keyed routing behaves as before. The only difference is that the producer now answers "not retryable".
- **`apps/extension/src/content/actions/select.ts`**:
  - When no option matches, the verb now re-reads the select every 100 ms for up to 2 s (`OPTION_WAIT_MS`) before calling the option missing. A dependent select whose options load late still works, even though the code is no longer retried. This protects the user's "every node retries" rule: the wait is bought once, inside the verb.
  - The failure is then reported as `OPTION_NOT_OFFERED`, and its `actual` reads like this: `no option matched: the value sent was "\"2\"" (3 characters); the closest options offered are "2" (2), ...; "2" differs from it only by quote marks, spaces or letter case, so send exactly "2"; the select still holds ... and offers ...`. The value sent is printed as JSON, so its own quote marks are visible.
  - Only the select's own options are used, and they are the ones the full list already shows.
  - Nothing is added for a sensitive (withheld) select, or for an index request. A withheld select still gets the non-retryable code.
  - `selectAction` is now `async`; `execute.ts` already awaited it.
- **New `apps/extension/src/content/actions/closest-options.ts`**, pure and with unit tests. It ranks options by three tiers: (0) the same once quotes, spaces and letter case are ignored; (1) one contains the other; (2) edit distance. Ties keep page order. It returns the top 5 and the tier-0 match, if there is one.
- **Wiring outside the brief's explicit file list, needed for the code to reach the wire:**
  - `apps/extension/src/content/action-runtime/results.ts`: `success()` takes an optional sixth argument, `failureCode`, which defaults to the old behaviour.
  - `apps/extension/src/content/actions/types.ts`: the `success` signature has the same optional parameter.
  - `domain/src/runtime/llm-evidence/action-failure/refusal.ts`: the new code maps to the model-facing `output_not_observed`, like `STATE_MISMATCH`. Without this mapping it would fall to `action_failed` in exploration.

### 3. An unchanged resubmission is not a new revision (Core), including the lane C addendum

- **`candidate/submission.ts`**: `submit(result, history?)` refuses a submission that changes nothing, in three cases, and the current revision keeps standing:
  - (a) Its script reads the same as the current revision's (`submissionText`). The comparison ignores line endings, spaces around each line, blank lines, whole-line `#` and `//` comments, and `summary`; a JSON `plan` is compared as canonical JSON. This check runs before any validation, so lane B's identical script with a moved digest (rev 4 → 5) is caught.
  - (b) Its resolved plan has the current revision's digest. This catches a differently written script that reads to the same plan, for example `text: "hello"` against `text: hello`.
  - (c) Its digest is one the judge refuted (`history.refuted`). This is the lane C round 8 addendum: rev 10 → 11 at `authoring-loop.ts:76-79`. It is also refused when the refuted Flow is not the current revision (a revert).

  In these three cases the refusal does not use up a revision number. Every other refusal still clears the current revision, as before.
- **New `candidate/unchanged-submission.ts`** builds the refusal check:
  - code `candidate.unchanged_submission`, or `candidate.unchanged_after_no` when the Flow was refuted;
  - `unchanged: true`;
  - the standing `revision` and `digest`;
  - `lastTrial: { verdict, feedback }` from the gate (what failed last);
  - `judged` with the judge's finding;
  - an `instruction` that opens with "Nothing changed: …", says what failed last, and gives the way out. The way out differs for untested, yes, failed and refuted. It never says "test next", and for a refuted Flow it says the Flow cannot be tested again.

  The module is exported from the candidate barrel.
- **`candidate/contracts.ts`** adds the type `AutomationStudioFlowCandidateSubmissionHistory` (`trialOf`, `refuted`).
- **`candidate/trial-gate.ts`** adds `refuted(digest)`, a copy of the closed-digest feedback.
- **`candidate/authoring-loop.ts`** passes `{ trialOf: gate.standing, refuted: gate.refuted }` to `submit`.
- **`candidate/submission-refusal.ts`**: for `feedback.unchanged === true`, `next` is the refusal's own instruction plus the usual RESUBMIT warning. It is not the GENERAL_NEXT text ("Correct every listed issue"), because there are no issues. The run-of-refusals key (`refusalCode`, t442) is untouched. An unchanged refusal has no issues, so its key is its category, and two in a row count as the same refusal.

### Tests changed because they encoded the old behaviour

- **`candidate/tests/trial-gate.test.ts`**
  - "does not let a yes on R1 complete R2, even when R2 is the same Flow" became "… a changed R2". A new test checks that the same Flow sent again leaves R1 and its yes standing, and that the refusal carries `lastTrial`.
  - "after a no, refuses completing or retesting the unchanged Flow until it changes": the resubmission is now refused `candidate.unchanged_after_no` with `judged`, and no "Test next" is given. The revised Flow is revision 2, where it used to be 3.
- **`service/flow-bootstrap-commands/tests/candidate-generation.test.ts`** (outside the owned list) submitted the identical plan twice and expected revision 2. The second submission now changes the router's name.
- **`apps/extension/e2e/content/tests/select.spec.ts`**: the missing-value expectation now has the new `actual` and code `web.validation.option_not_offered`, `retryable: false`. This was not run (see Not verified).

### New tests

- `authoring/tests/quoted-value.test.ts` (9): the reader's rules; select and type values through the acceptor; a quoted number; a state binding kept; condition values.
- `candidate/tests/unchanged-submission.test.ts` (5): a same-reading script is refused without re-checking (the binding resolver is not called) and the revision stands; a quoted spelling reads to the same digest; `lastTrial` reaches `next`; a refuted earlier Flow is refused while the current revision stands; a refusal of another kind still clears the current revision.
- `domain/src/runtime/failure/tests/codes.test.ts`: a table row for `OPTION_NOT_OFFERED`. The existing rows also run it through Core's parser.
- `apps/extension/src/content/actions/tests/closest-options.test.ts` (5).

## Commands run and observed results

Core (`C:/Users/osrs_/FluxStuff/fxwork/t464/!FluxIQ`):
- `npx vitest run …/flow-bootstrap/candidate …/flow-bootstrap/authoring …/service/flow-bootstrap-commands`, run from `packages/fluxiq`, printed `Test Files 54 passed (54)` and `Tests 463 passed (463)`.
- A wider run over `runtime/activity`, `llm/candidate-receipt`, `llm/repeat-guard`, `service/candidate-failure` and all of `flow-bootstrap` failed only `plan/tests/extraction-vocabulary.test.ts` (1 test, "expected 3769 to be less than or equal to 3000") and `verification/tests/durable-session.test.ts` (10 tests, "Automation Studio migrations must have unique, ascending IDs"). Both fail the same way on the clean base checkout `C:/Users/osrs_/FluxStuff/!FluxIQ` at `aca9f088`: `Test Files 2 failed`, `Tests 11 failed | 4 passed`. They are not caused by this change.
- `npx tsc --noEmit -p tsconfig.json`, run from `packages/fluxiq`, exited 0 with no output, after one test type fix.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (331 warning(s), 1159 baselined)`. It also printed "2 baseline entries can be lowered". I did not run `pnpm structure:baseline`, because the baseline is a shared file.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t464/!FluxIQWebExtension`):
- `DOMAIN_TEST_BUILD_LABEL=t464 node scripts/test-domain.mjs runtime/failure/tests runtime/llm-evidence/action-failure/tests` printed `# tests 47`, `# pass 47`, `# fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t464 node scripts/test-extension.mjs content/actions/tests content/action-runtime/recovery/tests content/action-runtime/tests` printed `# tests 335`, `# pass 335`, `# fail 0`. This includes the recovery-fault totality test, which holds because the new code is not retryable.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `domain` both exited 0.
- `node scripts/check-extension.mjs` in `apps/extension` exited 0 with no output.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (184 warning(s), 646 baselined)`.

## Not verified

- **No browser run.** The select verb's DOM behaviour, the 2 s late-option wait and the new `actual` string were not exercised on a page. The edited `e2e/content/tests/select.spec.ts` was not run, because Playwright runs are restricted to the ten realistic scenarios and that spec uses the `basic-form` harness. The closest-order string in it was computed by hand with the same edit distance, giving team 6, starter 7, enterprise 10. The missing-value cases in `select.spec.ts` and `actions.spec.ts` now take about 2 s longer each, because of the wait.
- **No Lab or paid run.** Whether the model corrects the value once it is told "send exactly "2"" is a model outcome.
- **Repeat guard.** I did not trace how the generic repeat guard (`llm/repeat-guard`) and the new unchanged refusal interact over a run. Same page with the same input is still refused by the guard first; a changed page reaches the controller, which now refuses it.
- **Full suites** were not run, by rule.

## Open questions or contradictions found

- **Retryability and the user's "every node retries" rule.** The brief says a no-option match is not retryable. Core's defensive assessment honours `retryable: false` and refuses node retries, so a select whose options load late would have lost its 3 retries. I bought the same protection inside the verb with a 2 s bounded wait. The supervisor may prefer a different wait length.
- **Files edited outside the brief's explicit list**, each needed for the owned change to work or for its tests to pass:
  - `apps/extension/src/content/action-runtime/results.ts`
  - `apps/extension/src/content/actions/types.ts`
  - `domain/src/runtime/llm-evidence/action-failure/refusal.ts`
  - `apps/extension/e2e/content/tests/select.spec.ts`
  - Core `service/flow-bootstrap-commands/tests/candidate-generation.test.ts`
- **Docs not updated.** `docs/architecture/failure-taxonomy.md` has the code table (line 28) and needs a row: `OPTION_NOT_OFFERED | web.validation.option_not_offered | output_not_observed | no | verification`. The candidate submission docs, if any, should say that an unchanged or refuted resubmission is refused. I left these to the supervisor as shared documents.
- **Refusals carry no top-level `digest`.** An unchanged refusal has a top-level `revision` but no top-level `digest` (it is under `diagnostics`). A model that copies the receipt from the latest submit evidence must use `diagnostics.digest`, or the earlier accepted receipt. The new trial-gate test completes with the accepted receipt.
- **Chat wording.** `activity/decision-answer/refused-call.ts` has chat wording for a repeat-guarded submit only. The new codes `candidate.unchanged_submission` and `candidate.unchanged_after_no` get the generic refused-submission card.

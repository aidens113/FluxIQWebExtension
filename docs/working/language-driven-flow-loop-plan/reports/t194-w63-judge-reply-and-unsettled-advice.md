# t194-w63: a long judge text no longer voids the reply; an unsettled judge's advice reaches the repair

Brief t194-w63 (lead t194-lead-1002M). Core tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`.
R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`. Evidence: live run
`run-murwcmx2-a1c6edf7`, steps 0032 to 0035.

## Outcome

Done. Both causes fixed. The tests failed first, then passed. Typecheck is clean, and the structure
audit passes with no new warning.

What the evidence showed: in 0032 the judge's first call said `no`, with `changed` at 270 characters
("narrow the name condition..."). In 0033 the second call also said `no`, but its `changed` ran to
581 characters. Under C-A, that pair is now two agreeing `no`s, so the result is refuted and the
repair gets the first call's advice as a real `no`. Under C-B, if a second call really does fail to
confirm a `no`, the `no` call's reading still reaches the repair.

## What changed and why

**C-A: an over-long diagnosis text is read clipped and never voids the reply** (`R/llm/harness/provider-result.ts`)
- `validateUnknownDiagnosisFields`: a text that is not a string is still the error
  `llm_output.invalid_diagnosis_text`. A string whose trimmed length is over
  `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH` (500) now adds a **warning**,
  `llm_output.diagnosis_text_clipped`. Its path is `response.diagnosis.<field>`, and its message names
  the field and its length. `run.ts` only counts errors as failures, so the reply stands.
- `withoutBlankDiagnosisText` is renamed `readDiagnosisText`. It is the same normalization step that
  1002-L's C2 used to drop blank texts, so every consumer gets the clipped text. A text over the bound
  is cut to at most 500 characters, mark included: at the last whitespace in the second half of the
  room, or hard at the room if there is none there, then `… [clipped]` is appended. A text that is
  only over the bound because of surrounding whitespace is trimmed, not clipped, and gets no warning.
  The work is done on a copy, so the provider's reply is untouched.
- Because the clipped text is at most 500 characters, the later reader
  (`recovery/structured-diagnosis.ts`, which also enforces 500) accepts it.
- The bound is still 500 in `structured-response.ts`, in the DeepSeek output schema and in the
  prompt. No prompt changed, and the pins are untouched.

**C-B: an unsettled verification keeps the reading of the call that judged `no`**
- `R/result-verification/contracts.ts`: adds an optional field
  `AutomationStudioResultVerification.unconfirmedReading` (`{ expected?, observed?, advice? }`, typed
  as `NonNullable<AutomationStudioResultRepairDirective["judgement"]>` so no new export was needed).
  Its doc comment says it is never a `repair` and never a `failure` record. `run-outcome.ts` records
  named fields only, so it is not written onto run records.
- `R/result-verification/agreement.ts`: `unsettled()` now receives the second call as well. It copies
  `repair.judgement` from whichever call has `verdict === "does_not_answer"` (the first, or the
  second after an `unknown`), keeping only the parts that are present. At most one call can have
  judged `no` here, because two `no`s are a refutation, so nothing is combined. `failure` and
  `repair` stay absent, and `automationStudioResultVerificationFailsRun` still returns false.
- `R/result-verification/build-test/judge.ts`: the `unknown` mapping copies
  `outcome.unconfirmedReading` onto `AutomationStudioBuildTestVerdict` as `unconfirmedReading` (an
  optional field on the unknown/not_judged variant, documented as unknown-only).
  `service/flow-bootstrap-commands/build-judge.ts` already spreads the verdict, so the field gets
  through without any change there.
- `R/flow-bootstrap/unfinished-build/contracts.ts`: adds the type
  `AutomationStudioFlowBootstrapJudgeReading`. `AutomationStudioFlowBootstrapTestVerdict`'s
  unknown/not_judged variant and `AutomationStudioFlowBootstrapJudgedWrong` both gain an optional
  `unconfirmedReading`. It is kept apart from a `no`'s `expected`/`observed`/`advice`, so
  `not-done.ts`, `not-doable.ts` and `progress.ts` (not mine) never mistake it for a `no`.
- `R/flow-bootstrap/unfinished-build/judgement.ts`: `judgedWrong` copies the reading for `unknown`
  only, and drops an empty one. `judgeValue` sends it to the repair as `judge.unconfirmedReading`.
- `R/llm/evidence-loop/resume.ts`: a new sentence, `UNCONFIRMED_READING`, is appended to
  `UNJUDGED_INSTRUCTION` (and to the explore-again-after-judge text) only when the judge is not a
  `no` and carries a non-empty `unconfirmedReading`. It says: "judgement.judge.unconfirmedReading is
  one judge call's reading that the second check did not confirm: what it took the instruction to ask
  (expected), what it saw the test do (observed) and what it advised changing (advice). It is not a
  verdict: check it against the rows and the test, act on its advice where the rows and the test
  bear it out, and leave alone what they do not." The instruction without a reading is byte-for-byte
  unchanged.
- I did not need to change `verdict.ts` or `structured-response.ts`.

**Tests** (each in its directory's `tests/`)
- New `llm/harness/tests/long-diagnosis-text.test.ts`, 5 tests. It uses step 0033's exact 581-character
  `changed` and checks: the reply stands; the verdict and other fields are whole; the clipped text is
  at most 500 characters, is the original's start cut at a word boundary, and ends with `[clipped]`;
  exactly one warning with the field's path; each field is clipped independently; a 500-character text
  is kept as is; a text with no spaces is cut hard and marked; whitespace-only overflow is trimmed,
  not clipped.
- `llm/harness/tests/empty-diagnosis-text.test.ts`: the "too long is refused" case became "not a string
  is refused" (3, null, array, object). This is an intended rule change.
- `result-verification/tests/agreement.test.ts`, 4 tests: the murwcmx2 pair (`no` then unavailable)
  carries the reading with no failure or repair; the reading comes from whichever call said `no`
  across four pairs (including disagreed and unknown-then-no); no reading when no call said `no` or
  the `no` was bare; the reading is a copy.
- `result-verification/build-test/tests/judge.test.ts`, 3 tests, through the real verify and harness
  with a provider scripted per call: `no` plus a `no` with 581-character advice gives verdict `no` with
  the first call's reading; `no` then `unknown` gives `unknown` with `unconfirmedReading` and no
  top-level `advice`; `unknown`/`unknown` gives no reading.
- `flow-bootstrap/unfinished-build/tests/judgement-value.test.ts`, 2 tests: the reading reaches
  `judgement.judge` and the judgement value as `unconfirmedReading`, never as top-level fields; it is
  absent when missing or empty.
- `llm/evidence-loop/tests/resume.test.ts`, 1 test: the instruction includes the reading sentence
  only when the judge carries a reading.

## Commands run and observed results

Every command was run in the Core tree.

1. Failing first. Command: `npx vitest run` over the 6 new or edited test files, from `packages/fluxiq`.
   - Output: `Test Files 4 failed | 2 passed (6)`, `Tests 11 failed | 45 passed (56)`.
   - The failures were all the new behaviour: `expected [ { severity: 'error', …(3) } ] to deeply equal []`,
     `expected undefined to deeply equal { …(3) }`, and
     `expected { verdict: 'unknown', …(2) } to match object { verdict: 'no', …(3) }`.
   - The resume test was added after that run and failed on its own:
     `Tests 1 failed | 16 passed (17)`, `expected 'The Flow you said was ready was not j…' to contain 'judgement.judge.unconfirmedReading is…'`.
   - The three "carries none" or "absent" guard tests passed before the change, as guards should.
2. The brief's test directories. Command: `npx vitest run R/llm/harness R/result-verification R/flow-bootstrap/unfinished-build R/llm/evidence-loop R/service/flow-bootstrap-commands`.
   - First run: `Tests 3 failed | 790 passed (793)`. All 3 were in `llm/evidence-loop/tests/rerun-place.test.ts`
     and `service/flow-bootstrap-commands/tests/extend-subject.test.ts`. Another worker was editing those
     files and their sources at the same time (`loop-configuration.ts` and `extend-subject.ts` showed as
     modified, and `extend-subject.test.ts` was untracked); none of them is one of my files.
   - Rerun after my fixes: `Test Files 94 passed (94)`, `Tests 793 passed (793)`.
   - After the last comment trim, `R/llm/harness` alone: `Test Files 30 passed (30)`, `Tests 236 passed (236)`.
3. Typecheck. Command: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w63 pnpm check fluxiq" pnpm check`, from `packages/fluxiq`.
   - The first run showed my own error, `provider-result.ts(162,167): TS2339 'trim' on type 'never'`.
     A `value is string` guard narrowed the false branch to `never`; I changed the guard to return
     `boolean`. Two other errors were in files I do not own (`llm/evidence-loop.ts`,
     `service/runtime-adaptation/tests/step-failure-port.test.ts`).
   - Final run: no `error TS` lines,
     `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; stored in the shared store ..."}`,
     which means it passed and was stamped.
4. Structure audit. Command: `node scripts/structure-audit.mjs`, at the Core root.
   - `structure-audit: passed (223 warning(s), 349 baselined)`. The extra warning was my
     `provider-result.ts` reaching 401 lines. I trimmed it to 398, and the audit then printed
     `structure-audit: passed (222 warning(s), 349 baselined)`. `result-verification/contracts.ts` is
     still over 400 lines (509, up from 494), but it was already past the advisory line, so that is
     not a new warning.

## Not verified

- No live or Lab run, so I have not checked that a 1002-M style build now repairs the name
  condition. With C-A fixed, the murwcmx2 pair would be a refutation (a `no`). The C-B path only
  applies when a second call really does fail to confirm a `no`.
- I did not run the full suites (per the brief). I did not run the DeepSeek prompt-pin test, because
  no prompt changed.
- I did not check the extension side. The build-test judge verdict and the judgement value are
  Core-internal, and the new fields are optional.

## Open questions or contradictions found

- The brief says unfinished-build contracts "allow expected/observed/advice only on 'no' today". That
  is true of `AutomationStudioFlowBootstrapTestVerdict`. `AutomationStudioFlowBootstrapJudgedWrong`
  already typed those fields as optional for every verdict. I put the reading under its own key,
  `unconfirmedReading`, rather than reusing them, so `not-done.ts` (`judge.observed ?? findings[0]`)
  and `not-doable.ts` never present an unconfirmed reading as a refutation.
- The runtime (non-build) path now carries `unconfirmedReading` on unsettled verifications too, but
  nothing there reads it, and `recovery/refuted-result` still refuses to repair from an `unsure`. If
  a runtime repair should ever use it, that would be a separate decision.
- The clipped warning reaches `diagnostics` on the harness result. Nothing that consumes it treats a
  warning as failure, but warnings may now show in step logs (`llm_output.diagnosis_text_clipped`).
  That is intended, so the clipping can be seen.

## Doc paragraph for `docs/architecture/automation-studio/llm-flow-bootstrap.md` (the lead applies it)

> **A judge's reply is never thrown away for its length, and an unsettled judge's advice is passed on
> as exactly that (t194-w63, live run murwcmx2).** A diagnosis text (`expected`, `observed`,
> `changed`) that runs past its 500-character bound is read clipped to it, at a word boundary and
> ending `… [clipped]`, with a warning `llm_output.diagnosis_text_clipped` naming the field. The
> verdict and the other fields stand; only a text that is not a string is refused. The bound stays
> 500 in the instruction and the output schema. When the judge's two calls do not settle
> (`model_disagreed`, `model_unconfirmed`) but one of them judged the test not to do what was asked,
> that call's expected, observed and advice travel on the unsettled verification as
> `unconfirmedReading`, then on the build's `unknown` verdict, and into the repair's judgement as
> `judge.unconfirmedReading`. The repair is told it is one judge call's reading that the second check
> did not confirm, to act on where the rows and the test bear it out. It is never a failure record or
> a repair directive: an unsettled runtime verification still does not fail a run, and the reading is
> not recorded on run records.

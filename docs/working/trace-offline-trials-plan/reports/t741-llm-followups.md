# Report: t741-llm-followups (worker, Core)

## Outcome

Done, with both parts tested. (1) In a candidate's wrap-up, the `not_offered` refusal now tells the model that a call naming one of this build's own acts under `undoes` still runs. A draft wrap-up's refusal is word for word what it was. (2) The `already_answered` note and the `core.no_progress` note no longer tell the model to test a revision whose latest trial answered `no` or `execution_failed`, or one that a later refused submission cleared. Instead they say what the trial answered and, where it applies, that the trial gate would call the revision stale, and that a changed submission is needed (or, when the revision was only cleared, that it must be submitted again).

## What changed and why

All paths are in Core, R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **R `llm/candidate-receipt/receipt.ts`**
  - `automationStudioLlmEvidenceLatestCandidateReceipt` still returns the latest accepted receipt. It still passes over refusals: this is the D2 behaviour, and the receipt is still the Flow the model edits.
  - It now returns a new exported type, `AutomationStudioLlmEvidenceCandidateReceipt`, which adds two optional fields:
    - `lastTrial: "no" | "execution_failed"`: the latest trial of exactly that revision and digest, found anywhere in the evidence. It searches all the evidence because social 0155 re-accepted revision 5 under the same digest after its trial at 0133. A trial answer is any non-submit entry that carries a known verdict, the revision and the digest.
    - `stale: true`: a later refusal cleared the receipt. Each refusal is read the way `flow-bootstrap/candidate/submission.ts` treats it:
      - `candidate.unchanged_submission` puts the last accepted revision back;
      - `candidate.unchanged_after_no`, `kept_condition_dropped` and `kept_step_dropped` leave whatever stood;
      - any other refusal clears it (completion refusals, binding refusals, scope refusals and so on).
      - The newest refusal with a definite effect decides.
  - `unsure` and `not_judged` verdicts are not treated as failures, because the gate still retests those (`candidate/stall-retest.ts`, t477). This is my reading of "on record as not passing"; see open questions.
  - The cause is the one b4-numbering named: the function returned the last `ok: true` submit even after refusals had cleared it, with no check of that revision's trial.
- **R `llm/candidate-receipt/not-testable.ts`** (new; exported from the directory's `index.ts`)
  - `automationStudioLlmEvidenceUntestableReceiptWords(candidate, {submit, test})` returns the sentence to use in place of "Use <test> with that exact revision...", or `undefined` when the receipt is testable.
  - The words are generic. They name only the tools, the verdict and the receipt.
- **R `llm/evidence-loop/answered-request.ts`**
  - The discovery-only `not_offered` sentence gains: "A call that names one of this build's own lasting acts under undoes, to undo it before a trial, still runs." These are the same words a5-wrapup put in `loop-budget.ts`.
  - The non-discovery (draft) `not_offered` text in `ANSWERED_REQUEST` is unchanged.
  - The receipt sentence uses the untestable words when they apply.
  - The `candidate` input is widened to the receipt type. `candidate` in the note's JSON now also carries `lastTrial` and `stale` when they are set.
- **R `llm/evidence-progress/stall-redirect.ts`**: this is the no-progress note's file (`core.no_progress`). Its discovery-only receipt sentence was changed the same way, and its `candidate` input was widened.
- Callers were not touched. `llm/decision-handlers/answered-request.ts:55` and `llm/evidence-progress/redirect-facts.ts:23` pass the function's result straight through, so they pick up the new fields with no edit.
- Tests:
  - `candidate-receipt/tests/receipt.test.ts`: two existing assertions now expect `stale: true`. These are the D2 tests: a bare `{ok:false}` refusal clears the receipt. I added 4 tests:
    - the social shape: revision 5 tried `execution_failed`, then B, then re-accepted, then completion refusal, `unchanged_after_no`, completion refusal → `{lastTrial: "execution_failed", stale: true}`;
    - which trials count;
    - each refusal kind;
    - the words.
  - `evidence-loop/tests/wrap-up-not-offered.test.ts`: added 3 tests. That directory is at 25 files, so I added no new file there.
    - the undo sentence in candidate wrap-ups;
    - the draft wrap-up text is exact and unchanged;
    - the `already_answered` note never says to test a failed or stale receipt.
  - `evidence-progress/tests/stall-redirect.test.ts`: added 1 test covering failed, judged-no, stale-only and testable receipts.

Tests-first was not kept strictly. I wrote the code before the new tests, so I did not observe the new tests failing before the fix. The two updated D2 assertions would fail on the old code, because it never returned `stale`.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq`:

- `pnpm exec vitest run .../llm/candidate-receipt/tests/receipt.test.ts` → 1 file passed, 14 tests passed.
- `pnpm exec vitest run .../llm/candidate-receipt/tests/ .../llm/evidence-loop/tests/wrap-up-not-offered.test.ts .../llm/evidence-progress/tests/` → "Test Files 8 passed (8)", "Tests 73 passed (73)":
  - receipt: 14
  - stall-redirect: 19
  - no-progress: 3
  - refusal-run: 3
  - build-trace: 6
  - decision-dump: 3
  - progress-trace: 8
  - wrap-up-not-offered: 17
- Consumers and neighbours: `pnpm exec vitest run` on `llm/decision-handlers/tests/{candidate-repeat-told,decision-context-wiring,refusal-run-wording}.test.ts`, `llm/tests/{loop-budget,evidence-loop}.test.ts`, `llm/evidence-loop/tests/stall-guard.test.ts` and `flow-bootstrap/candidate/tests/authoring-loop.test.ts` → "Test Files 7 passed (7)":
  - refusal-run-wording: 2
  - candidate-repeat-told: 3
  - stall-guard: 14
  - decision-context-wiring: 12
  - evidence-loop: 40
  - loop-budget: 33
  - authoring-loop: 10
- `system-prompt-pins.json` holds neither changed phrase: a grep count gave 0.

## Not verified

- No typecheck and no structure audit (per the shared rules). The lead should check:
  - `answered-request.ts` and `stall-redirect.ts` now import from `../candidate-receipt/index.ts`. `evidence-loop/index.ts` already re-exports that directory, so there is no new cycle in value imports.
  - `receipt.ts` exports both the type and the function. The type sits beside the function as in other llm files.
  - `not-testable.ts` holds one exported function.
- No whole-package vitest run. No project-build or subflow-builder test drives a real stale receipt through the notes.
- I did not check the refusal-code reading against every refusal the scoped subflow controller can emit. Any code not in the three "leaves standing" codes or `unchanged_submission` is read as clearing. That matches `submission.ts` and `scoped-submission.ts` as I read them (a scope refusal sets `current = undefined`).
- No live run.

## Open questions or contradictions found

- Verdict scope: I treated only `no` and `execution_failed` as "not passing on record". `unsure` and `not_judged` keep the old "test it if its trial has not answered yes" words, because the gate and stall-retest still retest those. If the supervisor wants every non-yes verdict covered, add the verdict to `failedTrial` in `receipt.ts`.
- For a receipt that was only cleared (trial not failed), the words say to submit it again rather than "a changed submission is needed". An unchanged resubmission puts the revision back (`candidate.unchanged_submission`), so a change is not actually required there.
- `execution_failed` can sometimes be retested once by the gate, unless the same failure repeats. The brief asks never to recommend it, and the new words follow the brief.

# t354: a candidate build survives an unusable reply and accounts for its spend

Worker: t354-candidate-resilience. Core tree: `C:\Users\osrs_\FluxStuff\fxwork\t354\!FluxIQ`
(branch `task/t354-candidate-loop-resilience`, based on Core dev `1b9f15f7`). Not committed.

## Outcome

Done. A candidate build now asks again after a reply it can't use, under the same bound
and the same options as legacy. Both modes build those options in one shared helper. If
unusable replies keep coming until the build stops, the failure is staged
`provider_output_validation` and the chat says "the model's answer could not be used".
Every candidate failure that comes out of the authoring loop now carries the build's spend.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `service/flow-bootstrap-commands/unusable-decisions.ts` (new) is the shared helper
  `automationStudioFlowBootstrapUnusableDecisions`. It builds the loop's
  `unusableDecisions`. The bound is `min(maxConsecutiveUnusableDecisions, maxIterations)`.
  The build's own endings (a permission ask, a person needed) go first, then the caller's
  stall. Legacy and candidate both call it (C1: "shared, not copied").
- `service.ts`:
  - Legacy round: line ~1596 now calls the helper with exactly the arguments it had
    inline before (same bound, same `permissions.endedOnRequest ?? personNeeded.endedOnIntervention ?? stalled`).
    Behaviour is unchanged.
  - Candidate branch: passes `maxConsecutiveUnusableDecisions: bootstrapLoopLimits.maxConsecutiveUnusableDecisions`
    to `generateAutomationStudioFlowCandidateDraft`.
  - Import line 271 also imports the helper. Nothing else in the file changed.
- `service/flow-bootstrap-commands/candidate-generation.ts`:
  - C1: it now gives the candidate loop `unusableDecisions` through the shared helper.
    - The caller's ending is the service's existing `ending`, whose first parameter is
      widened from the loop result to `{ trace, accounting }`, the shape the permission
      and person-needed endings already take.
    - The stall is `flowBootstrapEvidenceUnusableDecisionFailure(progress, accounted(...))`:
      code `flow_bootstrap.evidence_unusable_decision`, stage `provider_output_validation`,
      provider attempted and received, with the build's accounting.
    - A new required input, `maxConsecutiveUnusableDecisions`, sets the bound. `loop` can
      no longer take `unusableDecisions` from outside.
  - C2: when a reply arrives, usable or not (unusable but not `providerUnanswered`), the
    progress stage becomes `provider_output_validation` rather than staying at
    `provider_request`. Legacy moves only on `decision.ok`, but its retry means an unusable
    error never reaches its outer catch. With the retry, the candidate's errors no longer
    reach it either; this is defence in depth.
  - C3: the authoring loop call is wrapped. Any build failure it throws goes through
    `automationStudioFlowBootstrapFailureWithSpend` with the build's running accounting:
    decisions, the instruction authority and the trial judges.
- `service/flow-bootstrap-commands/failure-spend.ts` (new):
  - A failure with no accounting gets the build's.
  - A harness failure keeps its request's identity fields (requestId, provider, model,
    status, refusal), and its tokens and cost are replaced by the build's totals. Figures
    are never lowered.
  - Some codes may name no cost, per `failure-state.ts`: pre-provider failures and
    `provider_request_failed`. Those failures are left alone, as are non-build throws and
    any result that would not parse back.
- `service/flow-bootstrap-commands/index.ts`: the barrel exports both new modules.
- Tests (all in `service/flow-bootstrap-commands/tests/`):
  - `candidate-unusable-reply.test.ts` (new) drives the actual service with the round 3
    reply (`kind: "callId"`, complete `core.submit_candidate` input, no callId):
    1. One malformed reply, then submit, test and complete, ends `proposed`. Accounting is
       5 decisions plus 2 judge calls ($0.006).
    2. Malformed replies in a row: 1 + bound calls, where the bound comes from
       `automationStudioFlowBootstrapEvidenceLoopLimits` (legacy's figure).
       - The diagnostic is `evidence_unusable_decision`, stage `provider_output_validation`,
         attempted/received, issue `llm_output.invalid_evidence_decision`, accounting $0.009.
       - `automationStudioConversationCallCause` gives "The build failed: the model's
         answer could not be used".
       - The creation purse's `spentUsd` is $0.009.
    3. A provider throw on decision 3: the harness failure `provider_transport_unknown`
       keeps its requestId and carries the build's spend ($0.002). The purse holds
       $0.003, because it settles the unanswered call at its hold.
  - `unusable-decisions.test.ts` (new): bound arithmetic; the caller's ending beats the stall.
  - `failure-spend.test.ts` (new): attach, overlay, never lower, codes left alone, non-build throws.
  - `candidate-generation.test.ts`: the existing `boundGeneration` fixture is given
    `maxConsecutiveUnusableDecisions: 3`, the new required input.

## Commands run and observed results

Run from `C:\Users\osrs_\FluxStuff\fxwork\t354\!FluxIQ\packages\fluxiq` unless noted.

- Fail-first, before any product change:
  `npx vitest run .../flow-bootstrap-commands/tests/candidate-unusable-reply.test.ts`
  gave 2 failed of 2.
  - Test 1 failed with "Flow Bootstrap generation failed (flow_bootstrap.unexpected_error)",
    the same code as the live run.
  - Test 2 failed with "expected 2 to be 9", meaning the build ended at the first malformed
    reply.
  - Test 3 was added after the first wrapper (missing-accounting only). It failed with an
    accounting of only `{requestId, estimatedInputTokens, provider, model}` and no cost,
    which led to the harness-overlay change.
- After the changes: `npx vitest run src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/`
  gave "Test Files 16 passed (16)". It ran twice; the second run was after the barrel
  import fix.
- Legacy and neighbouring suites:
  `npx vitest run $R/flow-bootstrap/candidate/tests $R/flow-bootstrap/unfinished-build/tests $R/tests/service-bootstrap $R/service/candidate-trial $R/conversations/commands/tests/build.test.ts`
  gave "Test Files 57 passed (57)".
- `npx vitest run $A/api/handlers/tests/llm-generation.test.ts $A/runtime/conversations/commands/tests/execute.test.ts $A/runtime/flow-bootstrap/generation-failure/tests`
  gave "Test Files 11 passed (11)".
- Core nonincremental typecheck: `npx tsc --noEmit -p tsconfig.json` (no `--incremental`;
  the include covers tests) exited 0 with no output. It ran twice; the second run was after
  the last test edit.
- Structure audit, from the Core root: `node scripts/structure-audit.mjs`.
  - The first run gave 1 FAIL `[imports]`: the new test imported
    `conversations/commands/progress.ts` directly. That was fixed by importing the barrel.
  - The second run gave "structure-audit: passed (288 warning(s), 508 baselined)", exit 0.
  - It also printed "1 baseline entries can be lowered". That entry is not mine: `service.ts`
    was already 4,381 lines (baseline 4,386) before my edits, and its line count is
    unchanged. I did not run `structure:baseline`; the baseline file is outside my brief.
- `git diff | grep -c "as never"` gave 0.

## Not verified

- No live or Lab run, and no provider call, as the brief requires. The fix has not run
  against the real DeepSeek flash reply. The mock reproduces it by shape (same
  `llm_output.invalid_evidence_decision` issue, same `unexpected_error` before the fix).
- The Lab side was not exercised:
  - The Lab's `flow-lane` build record reads `diagnostic.accounting`
    (`packages/test-runner/src/flow-lane/creation/build-proposal.ts:623`, read only).
  - From that I infer the Lab's per-build spend and ledger will now be non-zero for these
    endings. I did not run the Lab to see it.
- The chat's live wording: I checked the words through `automationStudioConversationCallCause`
  only, not in the panel. The activity layer's "Asking it again" line is now followed by a
  real retry. That was not seen in a browser.
- Full Core suites were not run (narrow gates only, per AGENTS).

## Open questions or contradictions found

1. C2 as the lead described it was partly wrong. The candidate path already moved the stage
   to `provider_output_validation` on `decision.ok`, in `candidate-generation.ts`, the same
   as legacy. The real cause was that the unusable error escaped while the stage was still
   `provider_request` (the reply was not `ok`). There, `flowBootstrapPhaseFailure` drops
   accounting by design, so C2 and C3 had one root. The retry (C1) removes the escape; the
   stage change on an arrived-but-unusable reply is defence in depth.
2. "Legacy's words": legacy no longer ends on a stall directly. Since t208 a stalled legacy
   round is tested, judged and repaired, then ends with a build-ending message ("too many
   attempts in a row went nowhere" or "replies could not be read").
   - The candidate has no draft steps to test, so it ends with the closed code legacy used
     for this stop before t208, `evidence_unusable_decision`. The chat words come from the
     stage: "the model's answer could not be used".
   - Unbroken unreadable replies, and a provider that stops answering, end through the
     existing `flowBootstrapEvidenceLoopFailure` mapping (`provider_response_malformed`,
     `provider_timeout`) without legacy's long ending messages.
   - If the candidate should use legacy's build-ending sentences, that needs a candidate
     variant in `flow-bootstrap/unfinished-build/`, which is outside this brief.
3. A stalled candidate build does not save its latest valid submission as a draft. The
   debug's "a stalled ending that keeps the draft" is not done: the draft is saved only when
   the loop completes, as before.
4. Spend figures differ when a call got no answer: the purse settles an unanswered call at
   its hold, while the failure reports what providers billed. In test 3 the purse held
   $0.003 and the failure said $0.002. Both are deliberate in Core. Which one the Lab's
   per-build check should read is a Lab decision.
5. The same harness-failure accounting gap (a mid-build provider failure reporting one
   request's figures instead of the build's) exists on the legacy path. I left it alone:
   legacy behaviour unchanged was part of the definition of done.

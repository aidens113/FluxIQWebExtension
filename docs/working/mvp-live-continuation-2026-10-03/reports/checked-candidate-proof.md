# Checked candidate proof — worker report

## Current State

Implementation complete in the exact released Core partition; source frozen for supervisor integration. Seven owning test files, 87 tests passed through the heavy wrapper; final wording correction then passed the 12-test rerun-check owner. Core `git diff --check` passed. Supervisor independently reports combined 18 files / 383 tests and Core package check passed before the wording refinement; supervisor reobservation/builds/audits and subsequent live acceptance remain pending. This report does not claim a live pass. No provider call, launch, runtime store/profile mutation, commit, push or shared-document edit occurred.

A single feedback wording refinement was released after the supervisor's validation sessions exited: after a candidate changes its act claim, feedback now attributes the performed lasting effect only to the original configuration and explicitly says that history does not prove the replacement or its current claims were performed. Focused owner result: 12 tests passed, heavy label `t262 checked-wording`.

## Reproduced defects

- Before the proof correction, the new direct rerun regression failed with replacement input but `effectApplied=true`, no checked marker, and no original execution record. Nine existing tests passed, one new test failed.
- After introducing candidates, the new zero-row regression failed: an unexercised candidate passed the gate instead of being reported `not_reached` (12 existing tests passed).
- The released amendment regression failed because routing a candidate was refused as `did_not_work` (24 existing tests passed). Reading that owner also confirmed binding would fabricate `instance` proof for a never-performed candidate.
- A preliminary dependent-mark test fixture was unreachable because its put-back prerequisites did not reproduce. It was corrected to isolate mark invalidation with no start-page reset. That fixture failure is not claimed as evidence of the production defect; the final integration assertion verifies prior marks retained and following marks invalidated.

## Implemented semantics

Core runtime root: `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `flow-draft/step.ts` adds `checkedCandidate: {callId, code}` and a private `priorExecution` record of the original configuration with `lasting:true`. The latter preserves original arguments, resolved arguments, execution identity, state transition, output/replay evidence and act claims without relabelling them as the replacement's.
- `llm/node-tools/rerun-check.ts` accepts verified/present replacements as candidates with `effectApplied=false`. It snapshots original execution once, retains it through later checks, removes current original call/state/control/instance/toggle/interruption/cancellation/route proof, drops old `replay.produced`, retains placement `replay.from`, and clears old test marks. New resolved parameters and words come solely from the new check. It never fabricates `written=true`.
- `flow-draft/verify-only.ts` independently protects a historical performed lasting effect on later reruns, even after current claims/configuration change. Clearing current `effectApplied` therefore cannot reopen a second press. Refused checks leave configuration and history unchanged. Ordinary explicit calls and never-performed reruns retain their existing behavior.
- `flow-draft/entry.ts` exposes current checked/not-performed provenance and marks current act claims as intentions. Original provenance exposes only original call identity and that its configuration was original; private resolved arguments, state and output remain internal. Candidate dispositions stay kept/taken according to the model's choice, instead of `did_not_work`; candidates remain proposable.
- Released `flow-draft/amendment.ts` allows existing amendments on a candidate and prevents `bind` from inventing its executed `instance`. Original historical bindings remain untouched.
- Released `llm/evidence-loop.ts` passes draft steps to the checked replacement helper. That helper invalidates replaced and following `replayed` marks after an accepted check; earlier marks remain intact. Optional callers without a draft still clear the replaced record's mark. A record absent from the supplied draft never clears unrelated trailing marks.
- Released `llm/node-tools/dry-run-gate.ts` treats an unexercised candidate as not reached under the existing repeat rule. It does not invent execution or a passing report for zero rows.

No domain target equivalence, selector interpretation, authenticated host identity or new model permission restriction was introduced. A same-input or `present` check is still a check; neither establishes execution of the replacement configuration. Full tests retain the existing lasting-action verify semantics and conditional evidence; a passing verification is not a measured execution of the candidate's effect.

## Validation observed

Heavy-wrapper label `t262 checked-final`, Core cwd:

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/node-tools/tests/rerun-check.test.ts src/programs/automation-studio/runtime/flow-draft/tests/step.test.ts src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts src/programs/automation-studio/runtime/flow-draft/tests/amendment.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/lasting-acts.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/dry-run-gate-loop.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/replay-draft-acts.test.ts
```

Observed result: 7 files / 87 tests passed. Counts: rerun-check 12, step 4, entry 19, amendment 25, lasting-acts 7, dry-run-gate-loop 14, replay-draft-acts 6.

New coverage verifies original performed proof stays bound to original input, replacement current state contains no old proof, both verified and present accept truthful candidates, second rerun remains verify despite changed act claims/input test values, refused later check preserves history, candidate can be proposed without written, model-facing entry contains no private resolved/state values, routing/binding does not invent instance, dependent test marks clear, zero-row candidate is not reached, per-row bound candidate tests preserve build provenance, and full-test lasting candidate does not grow the synthetic cart. Existing tests preserve written-step semantics, ordinary explicit execution, consequence/lasting distinctions and repeat behavior.

No full suite or package-wide build was run by this worker. Browser behavior and live retarget acceptance remain unverified. Supervisor owns integration verification and architecture/current-state documentation.

## Exact source ownership

Changed only released Core files:

```text
flow-draft/{step.ts,entry.ts,verify-only.ts,amendment.ts}
flow-draft/tests/{step,entry,amendment}.test.ts
llm/node-tools/{rerun-check.ts,dry-run-gate.ts}
llm/node-tools/tests/{rerun-check,dry-run-gate-loop,replay-draft-acts}.test.ts
llm/evidence-loop.ts
```

`llm/node-tools/tests/lasting-acts.test.ts` was read/run but required no edit. No changes to downstream source, provider/runtime ownership or verdict/status semantics.

## Structural integration follow-up

Supervisor structure audit found the initial added loop block exceeded the existing 800-line budget (804 lines), and two newly introduced test imports bypassed the flow-draft barrel. Under an exact follow-up release, moved dependent-mark invalidation into the existing checked-replacement helper alongside its own mark invalidation, passed `steps:draftSteps` on the existing loop call, removed the four-line loop block and used the flow-draft barrel in the test. No baseline exception, line compaction or new catch-all module. The loop is again 800 lines. Seven-owner rerun under `t262 checked-structure-fix`: 87 tests passed. Source frozen for supervisor independent revalidation.

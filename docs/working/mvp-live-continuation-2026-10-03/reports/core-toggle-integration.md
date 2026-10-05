# Core toggle and stale-mark integration

Worker: resume-ab. Date: 2026-10-03. Status: implemented; focused regressions passed; source frozen for supervisor review.

## Implementation

Ported exactly the released A group-2 Core source/test diffs into t262, checked with `git apply --check` before applying. The A `evidence-loop.ts` diff contained only its reversal import and two authoring hooks; no build-trace/activity/per-act dependencies were imported. Budget/t261 instructed-choice modules are untouched. Existing source remained compatible without conflict.

Changed Core runtime files:

- `flow-draft/{reversal.ts,index.ts,step.ts,entry.ts,amendment.ts,dry-run.ts}`.
- `flow-draft/tests/{reversal,entry,amendment,dry-run}.test.ts`.
- `llm/{evidence-loop-decision.ts,evidence-loop.ts}`.
- `llm/evidence-loop/{tool-execution.ts,call-record.ts,tests/authored-draft.test.ts}`.
- `llm/node-tools/{step-place.ts,rerun-check.ts,tests/step-place.test.ts,tests/rerun-check.test.ts}`.

The strict host statement accepts a screened `toggle {key,to}` only on mutate calls, carrying it into draft steps. Opposite same-control presses can leave the authored Flow together; an `out` explanation records why and cleared act claims prevent a removed press from still claiming completion. A model explicitly adding a removed half back keeps its decision.

Moves invalidate replay marks from the changed position onward; successful checked reruns clear the old mark and old control description. Refused reruns after a reset explain that the reset loaded the target again and name the intended control. Failed dry-run rows carry opaque `actedOn`; `ranOn` remains unimplemented and is not claimed as fixed.

## Additional safety correction

A's original reversal implementation dropped opposite toggles across any intervening actions. A meaningful regression demonstrated that toggles surrounding a required act both disappeared: this changes the temporary state under which the act runs. First run: 1 failed / 8 passed, the failed expected-empty cancellation returned two dropped toggles.

Restricted pairing when any intervening kept proposable step exists. Such a step may mutate using the temporary state or read/return it; Core has no dependency proof to erase the surrounding toggles. Added mutation and read regressions. The adjacent run-musp8nz1 pair is still eliminated; the older murwd8le nonadjacent example is retained instead of claiming speculative equivalence. Its regression now documents that conservative outcome.

One intermediate rerun failed because the model-override fixture's opener retention re-added its middle step; corrected the expected kept list to reflect existing opener behavior. A second fixture incorrectly modeled an exported read without `proposes=true`; corrected that fixture. These were test fixtures, not new source defects.

## Run-3 retarget finding within owned code

`automationStudioNodeRerunAnswer` decides whether a rerun is a verification from the replaced step's prior effect-applied/replay/act state before considering the new target. `checked` then replaces `step.input` and deletes the old control after a verified/present answer. Thus a Spain/colour step wrongly carrying cart act a1 can be rerun with Add-to-cart as its new target, checked without pressing, and replace the old argument while the new needed cart act never occurs.

Reported this mechanism to supervisor. No speculative retarget change implemented: replacing an already-performed lasting act's argument must not automatically repeat it, while a newly needed act must actually run. Correct handling needs a generic claim/target-identity decision plus a domain-authenticated identity seam, rather than relying on arbitrary input object inequality or target-label substring. Follow-up scope/design is owned by supervisor.

## Validation

- No full suites, builds, provider or browser run by worker.
- Focused 7-file command through `heavy.sh` / `pnpm --filter fluxiq exec vitest run`: **7 test files passed, 140 tests passed**, exit 0. Files: flow-draft reversal/entry/amendment/dry-run, llm authored-draft, node-tools step-place/rerun-check. The safety regression first failed against A's implementation (1 failed / 8 passed) before the guarded behavior.
- Scoped `git diff --check`: exit 0, no diagnostics.
- Supervisor owns affected package typecheck, Core build, paired domain integration, full structure audit, live verification and commits.

## Not verified

No live toggle behavior, target-handle identity stability, observer rendering or cost savings is proven. A new domain `toggle` member must ship only with this Core strict-key extension. Stable handles and domain emission belong to supervisor. Drop/withdraw and plain rerun-replacement downstream mark invalidation remain outside this brief; actual replay-place token remains absent.

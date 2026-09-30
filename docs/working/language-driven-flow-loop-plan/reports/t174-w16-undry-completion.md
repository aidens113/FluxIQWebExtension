# t174-w16: why completion 48 was accepted without a dry run

Worker t174-w16, 2026-09-30. Core tree `fxwork/t174/!FluxIQ` (task/t174-live-lane). Evidence: live
run 18, `run-munpwa5r-e7aefe04`. `P` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. I found the cause and it is **not a defect**. Two documented rules together accepted the draft,
and a test pins the main one. As the brief says to for a deliberate skip, I changed no product code.
I state the rule below and recommend what to do instead. The rule lives in `P/flow-draft/dry-run.ts`,
which is lane t189's area, so the call belongs to the supervisor.

## What changed and why

No repository files changed; this report is the only file written. There is also a scratch
reproduction script in my scratchpad (`w16-gate-repro.mts`), outside the repository.

### The mechanism, from the evidence

| Decision | Check | Dry run | What the gate did | Result |
| --- | --- | --- | --- | --- |
| 46 (complete #4) | ok | 4: d26 `core.replay.unreproducible` | d26 was not yet in `asked`, so it **blocks**. The verdict and page were shown to the model, and d26's key went into `asked`. | refused `llm_evidence_loop.dry_run_refused` |
| 47 (complete #5) | `bootstrap.instructed_act_missing` | 5: d26 `core.replay.unreproducible` again | d26 is now in `asked`, so it **does not block**. The verdict is `ok`, nothing is shown, and `cleanSignature` is set to revision 30's signature. | refused, for the check only. The flow-lane step at 47 carries `bootstrap.instructed_act_missing` and no `dry_run_refused`. |
| 48 (complete #6) | ok | none | `signature === cleanSignature`, so the gate returns `undefined` **without replaying** | accepted, outcome `proposed` |

The draft was the same at all three decisions: `draftRevisionBefore/After` is 30 at 46, 47 and 48 in
`snapshots/flow-lane.json`.

### The rules that produce it

1. **An unreproducible step is asked about once.** In `P/flow-draft/dry-run.ts`,
   `automationStudioFlowDraftReplayOutcomeBlocks` does not block an `unreproducible` outcome whose
   `<position>:<actionId>` is in `asked`. The gate (`P/llm/node-tools/dry-run-gate.ts`) adds every
   unreproducible outcome to `asked` once the replay is done. The model-facing instruction says:
   "If the Flow truly does need it on every fresh start, finish again with it kept and it will be
   accepted." Completion 47 was that "finish again", so dry run 5 passed by design. The test
   `flow-draft/tests/dry-run.test.ts` "asks about a step the reset could not undo once, and takes
   the answer" pins this.
2. **A draft that replayed clean is not replayed again unchanged.** `dry-run-gate.ts` caches
   `cleanSignature`, the proposed steps and their `ranWith`, in order. Completion 48's draft had
   the same signature as dry run 5's "clean" verdict, so nothing was replayed.

The cache is not the root. Had completion 47's check passed, 47 would have been accepted on dry
run 5's verdict. Decision 48 only reused that verdict. What accepted the Flow is rule 1.

### Branches the brief listed

- **Final or budget decision**: not the cause. `automationStudioLlmEvidenceHandleCompletion`
  (`P/llm/decision-handlers/completion.ts`) and `automationStudioLlmEvidenceCompletionAttempt`
  (`P/llm/evidence-loop/completion-attempt.ts`) do not branch on `finalDecision` or on the wrap-up.
  Every completion runs the check and then `dryRun()`.
- **Whether 48 was the budget's final decision cannot be confirmed from the bundle.** Nothing in
  `core.log`, `flow-lane.json`, `decision-trace.json` or `live-llm.json` records `decisionsLeft`,
  `limitedBy` or the wrap-up. Decisions 45 to 48 were one amend and three completes, with no tool
  calls, which fits a wrap-up but does not prove one. It does not matter to the mechanism.
- **Gate disabled**: no. The gate ran 5 times and was enabled.
- **Draft judged unchanged since an earlier replay**: yes. This is rule 2, and it rests on rule 1's
  `ok`.

### Why rule 1 is unsound here (the real fault)

- `unreproducible` was designed for a control the site *remembers*, such as a consent banner
  answered once.
- The domain classifies any `web.target.not_found` on a replayed step as unreproducible
  (`domain/src/runtime/llm-evidence/node-run/replay.ts:211`, found by grep only).
- d26 (s8, the product page's add-to-cart button) was absent for a different reason. The amendment
  at 40 withdrew the steps that reach the product page (d20, d21), so the replay reached s8 on the
  search results page (debug Stage 2).
- Neither Core nor the domain can tell "the site remembered it" apart from "the draft no longer
  reaches this page". So one insisting completion let a genuinely broken step through.

The playback failure of run 18 is **not** caused by this. Playback died at s2 under the consent
dialog (debug cause 1) before it reached s8. s8 would most likely have failed next.

### Recommendation (not implemented)

1. **Core, `P/flow-draft/dry-run.ts`, owned by lane t189.** Drop the "asked once, then waved
   through" escape. An `unreproducible` step should keep blocking unless it is conditional: marked
   with `amend_draft optional` or `only_if`, which the verdict already exempts through
   `conditional`.
   - The instruction's sentence "finish again with it kept and it will be accepted" goes with it.
   - The honest answer for a remembered banner is `optional`. Run 18 shows playback *starts* with
     the dialog open while every reset keeps it answered (cause 2).
   - `dry-run.ts`'s own comment already calls routing "the honest closure of the question
     `unreproducible` could only ask".
   - Cost: a model that keeps insisting instead of marking the step optional spends decisions until
     the budget ends the build. That is better than a silently broken Flow.
   - The test "asks about a step the reset could not undo once, and takes the answer" would be
     inverted. `asked` and `automationStudioFlowDraftReplayOutcomeKey` would then only serve
     feedback, if anything.
2. **Domain (extension repo, `node-run/replay.ts`).** Before calling a missing target
   `unreproducible`, compare the page the replay reached with the step's recorded `stateBefore`. A
   different page means `changed` or `failed`, not memory. This narrows rule 1 without removing it,
   and complements recommendation 1.
3. **Instrumentation.**
   - `completion.ts` `dryRunSaid` records `"clean"` for completion 47, although d26 was
     unreproducible and waved through. It should record the waved-through steps.
   - `progress-trace.ts` prints no line when the gate reuses a clean signature, so completion 48's
     skip was invisible (debug instrumentation gap 1). A trace line such as
     `dry run reused signature-of=dryrun.5` would have answered this brief from the log.

## Commands run and observed results

- `grep` on the bundle's `logs/core.log` confirmed:
  - `completion check ok=true` for 46, then `dryrun.4.*` with `dryrun.4.26 ... core.replay.unreproducible`;
  - `ok=false issues=bootstrap.instructed_act_missing` for 47, then `dryrun.5.*` with
    `dryrun.5.26 ... core.replay.unreproducible`;
  - `decide end iteration=48 ... kind=complete`, then `completion check ok=true issues=-` and no
    `dryrun.6` line.
- Reading `snapshots/flow-lane.json` with node: the step at 46 carries `llm_evidence_loop.dry_run_refused`,
  the step at 47 carries `bootstrap.instructed_act_missing`, and the step at 48 is
  `core.decision_complete`. Revision 30 throughout.
- Scratch reproduction against the real gate: `node --experimental-strip-types` on `w16-gate-repro.mts`
  in my scratchpad, which imports `P/llm/node-tools/dry-run-gate.ts`. It uses two kept mutate steps,
  and its fake executor answers `core.replay.unreproducible` for position 26. Output:
  ```
  completion 46 (dry run 4) -> {"issueCodes":["llm_evidence_loop.dry_run_refused","core.replay.unreproducible"]} replay calls: dryrun.1.reset,dryrun.1.2,dryrun.1.26
  completion 47 (dry run 5) -> undefined replay calls: dryrun.2.reset,dryrun.2.2,dryrun.2.26
  completion 48 -> undefined replay calls: none
  ```
  This matches the run exactly.
- `npx vitest run --minWorkers=1 --maxWorkers=2 P/flow-draft/tests/dry-run.test.ts P/llm/evidence-loop`
  (from `packages/fluxiq`) -> `Test Files 12 passed (12)`, `Tests 91 passed (91)`.

## Not verified

- I did not run `tsc`, `structure-audit` or `P/llm/tests`, because no code changed.
- Whether decision 48 was the budget's last cannot be confirmed; the bundle does not record it.
- I have not tested the recommended change. I did not read `domain/.../replay.ts` beyond the grep
  lines.

## Open questions or contradictions found

- The brief's target invariant ("a draft whose latest replay on that revision failed is never
  accepted without passing one") contradicts the deliberate asked-once rule. Under that rule, dry
  run 5 *passed*. Adopting the invariant is the design change in recommendation 1, and it needs
  lane t189's agreement.
- The debug's cause 3 named `runtime/llm/harness-options/bootstrap-completion.ts` as a suspect. It
  plays no part in the skip; the owning lines are `P/flow-draft/dry-run.ts`
  (`automationStudioFlowDraftReplayOutcomeBlocks`) and `P/llm/node-tools/dry-run-gate.ts`
  (`asked`, `cleanSignature`).

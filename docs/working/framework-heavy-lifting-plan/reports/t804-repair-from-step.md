# t804: a failed build test is repaired on the failing step

Lane t804, branch `task/t804-repair-from-failing-step` in both repositories. Sub-supervisor report.
Nothing is committed. Worker reports are under `reports/t804/`.

## Outcome: Partial

Core can now run a builder's part from a chosen step. It also holds a failed whole test's repair
and refuses another whole test until a run from the failing step has passed that step. Unit tests
for all of it pass, and Core's typecheck passes.

On the real gateway project-build path the rule does not take effect yet. That path builds the
subflow trial port in `service/project-build/subflow-trials.ts:142-144`, a forbidden file (t795).
It copies `environmentKind`, `offlineFirst` and `prepareStart` onto the port it hands the gate,
but not `fromStep`. Without `fromStep` the gate keeps its old behaviour by design, so:

- `from` answers `subflow.from_step_unavailable`;
- a second whole test is not refused.

The headed photo-social spec is written and stops at exactly that point. The fix is one line in that
file, after line 144:

```ts
if (trials.port.fromStep) port.fromStep = trials.port.fromStep;
```

I did not make it, because the brief puts `service/project-build/**` off limits. Once it is made,
the spec should be re-run as it stands.

## Step 1: trace

The full trace, with file:line citations, is in `reports/t804/trace.md`.

1. **Why `core.test_subflow` always runs the part from its start.**
   - The tool took only `revision`, `digest` and `cannotUndo` (`subflow-trial-gate.ts:434-437`).
   - Every trial went through `runAutomationStudioDetachedSubflow`. That runs start, arrival, the
     earlier subflows and then the target, and calls `runAutomationStudioDetachedCandidate`, which
     refused any start node (`flow-bootstrap/verification/detached-execution.ts:53`,
     `candidate.partial_execution_unsupported`).
2. **Whether a run-from-a-node test existed for project and subflow builders.** No.
   - The t244 `core.run_flow` replays draft steps through the loop's own tool calls
     (`run-flow-part.ts:76-136`). A builder has no draft (`builder-loop.ts:341`), and the tool is
     excluded by name (`role-tools.ts:9`).
   - The executor could already start at a node (`startNodeId`), but only on a root graph.
3. **What a failed test told the builder.** Every message sent it back to a whole test:
   - "correct the step that caused the failure, submit the subflow with core.submit_subflow, then
     test the new revision" (`subflow-trial-gate.ts:422` plus `trial-stop.ts`);
   - for a no, `INSTRUCTIONS.no`;
   - after every submit, "This test runs the whole Flow from its start" (`builder-loop.ts:388`).

   In the evidence run (E) the builder did exactly this: five whole tests between steps 0051 and
   0113.
4. **Why reset, offline, reset.** No site reset happened in E: every check answered admit, with the
   site not reset.
   - The first "reset" is the builder gate's site check: admission, then 13-24 seconds of
     before-state readings.
   - The "offline" step is the whole gate's recording check. It runs second only because
     `WholeTestPort` never hands its `offlineFirst` to the builder gate.
   - The second "reset" is the whole gate's own check, about 2 ms.

## Step 2: build

### (a) A from-step run

`core.test_subflow` takes an optional `from: "<step key>"`, offered only where the port can run from
a step. Such a run:

- runs the latest proposal's own subflow as the root, from that step, on the page as it stands;
- runs no start hook, reset, arrival, earlier subflows, offline check, readings or judge;
- answers `fromStep: true` with `passed`, `passedKeys`, `stoppedAt` and the steps it ran, and says it
  is not the part's test;
- records its acts through the gate's `reset.trialRan`, so the next whole test's before-state
  includes them.

A from-step run is refused in three cases, and nothing runs:

- `subflow.from_step_unbound` when a step from `from` on reads a value an earlier step made, for
  example a row of a list read before it; the answer names the step to start from;
- `subflow.from_step_unknown` for a step the proposal does not have;
- `candidate.from_node_*` for a key that cannot be resolved.

### (b) The gate

`pending-repair.ts` holds the repair. Two kinds of whole test set it, and only where the test's
entry was prepared:

- one answering `execution_failed` (not Core's own trial runner failing);
- one answering `no`.

The step it names:

- for a stop, the trial's `stoppedAtKey`;
- otherwise, the first step in plan order that changed since the failed revision. This covers a no,
  a stop whose step was renamed, and a stop the port could not name. I added the last case at
  integration: the single-subflow whole test names steps only by number.

While the repair stands, a whole test and a completion are both refused `subflow.trial_from_step_first`.
The refusal carries `repairStep` and the exact `{revision, digest, from}` call to make. The repair clears
when a from-step run of the latest revision, starting at or before that step, has it in `passedKeys`.
With no step named, it clears on a run that reaches the part's end. A no's repair is not cleared by
the judged revision itself.

There are three exceptions:

- the builder passes `fromStepImpossible: "<why>"` (an empty reason is refused);
- the failing step is the part's first step;
- the verdict was unsure or not_judged, which stay ungated.

The repair also carries across briefs of the same subflow and plan, through a `REPAIRS` map in
`dispatch/run-brief.ts`, as `STANDING` does.

### (c) Only a judged whole run counts for finishing

A from-step answer never carries `partial` and is never kept as a trial. `completion()` never accepts
it; it still needs a judged yes for the latest revision.

### (d) Reset

The reset logic is unchanged. The before-state check before a whole test is admission and readings,
not a site reset, and it fits the minimal-reset rule; in E it never reset the site. Two
inefficiencies on the single-subflow whole path remain:

- The 20-second builder check runs before the recording check that can make the live run
  unnecessary. In E the recording kept the no at 0084 and 0115, so those two checks were paid for
  nothing.
- The second check is redundant but costs about 2 ms.

Moving the recording check first needs `service/project-build/whole-trials.ts` (forbidden) or would
run it twice. W1 recorded why in the header of `whole-test-port.ts`. A from-step run makes neither
check, so the repair loop no longer pays them at all.

### Model-facing words

The words are in `repair-words.ts` and are generic, with no site, product or task words. They are
appended to:

- the test tool's description;
- failed-test instructions;
- the submit answer's `next`.

They appear only where the port has `fromStep`. No pinned description changed: the
`system-prompt.test.ts` pins, `loop-budget.test.ts` and `person-facing-sweep.test.ts` all pass
unedited, so there is no pin drift to resolve. Downstream `model-text.mjs` passes.

## Shape for P1b (fold submit and test)

The gate exposes what a folded submit needs:
`AutomationStudioSubflowTrialGate.test({revision, digest, from?, fromStepImpossible?})` and
`completion(latest)`. A P1b `core.submit_subflow` can take one optional field, for example
`then: "test_whole" | {from: "<key>"}`:

- **`test_whole`** ("the part is ready"): submit, then the judged whole test from the start. It is
  refused with `subflow.trial_from_step_first` while a repair stands, unless `fromStepImpossible` is
  given or the step is the first.
- **`{from}`** (during repair): submit, then the from-step check. It is never judged.
- **Absent**: save only.
- **A yes on the latest revision**: the fold calls `completion(latest)` in the same call and
  completes, with no further decide.

Neither field ever turns a submit into a whole test on its own.

## Workers

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| trace | worker-heavy | the four trace questions and a design (read-only) | Done | read §1-6; confirmed run.ts:247-250 and subflow-trials.ts:142-144 myself |
| W1 from-step runner | worker-heavy | runner, `fromNodeKey`, ports, `stoppedAtKey`, binding check | Partial (tsc not run: lock) | Core tsc passed; tests in the acceptance run |
| W2 repair gate | worker-heavy | gate, words, cross-brief memory | Partial (tsc not run: lock) | read pending-repair.ts and repair-words.ts; the gate tests pass; tsc passed |
| W3 photo spec | worker | headed photo-social spec | Blocked by the forbidden-file gap | read its report and observed calls; the cause is confirmed in source |

No escalations. Four workers: three Opus, one Sonnet.

## Integration changes I made

- `subflow-candidate/contracts.ts`: the stable interface, written before dispatch.
  - `AutomationStudioSubflowFromStepRequest`, `AutomationStudioSubflowFromStepResult` and
    `AutomationStudioSubflowFromStepPort`;
  - `fromStep?` on the trial port;
  - `stoppedAtKey?` on the trial result.

  This is additive and in a different region from t800's hunk in this file.
- `subflow-candidate/pending-repair.ts`: a failed test whose stop has no plan key now falls back to
  the first changed step. Before, any run that ended cleared it.
  - Test: `tests/from-step/tests/from-step-repair.test.ts`, "names the first changed step for a stop
    the port could not name".

I did not touch t800's files: `scoped-submission.ts` and `dispatch/scope.ts` are unedited.

## Files outside the named owned dirs (not forbidden)

W1 changed these, for the lead to accept:

- `flow-bootstrap/verification/detached-execution.ts`: a small edit adding a validated `fromNodeKey`.
  A caller's own `startNodeId` is still refused.
- new `verification/from-node.ts` and `verification/detached-subflow-from.ts`, with tests;
- `verification/index.ts` (barrel).

`detached-subflow-from.ts` copies `rootPlan` from `detached-subflow.ts`, which was not ours. Exporting
it from there later removes the copy.

## Commands run and observed

All of these ran under `heavy-check.lock`. The lock was taken at 18:09:46 and the run finished at
18:16:51.

**Core typecheck.** `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .`
in `packages/fluxiq` exited 0 with no errors. It ran at 13:47, after both builders and my
`pending-repair.ts` edit. `pnpm check` below re-ran it on the final tree.

**Tests (vitest).** `FLUXIQ_TEST_GROUP=parallel npx vitest run` covered:

- `subflow-candidate`, `verification`, `service/subflow-trial`, `single-subflow` and `dispatch`;
- the prompt-contract tests: `llm/deepseek/tests/system-prompt.test.ts`, `llm/tests/loop-budget.test.ts`
  and `activity/tests/person-facing-sweep.test.ts`.

| Group | Result |
| --- | --- |
| parallel | 88 files passed, 1 skipped; 591 tests passed, 2 skipped |
| real-sql (same paths) | 1 file and 10 tests passed |

**Core checks.**

| Command | Result |
| --- | --- |
| `pnpm check` | exit 0. Structure audit passed (455 warnings, 1152 baselined); fluxiq, contracts, client-gateway-websocket and web checks passed. |
| `pnpm docs:reference` | Wrote both `framework-reference.md` copies (4283 public declarations). This is a generated update, 10 lines per copy, for the new exports; it is left in the tree to commit. |
| `pnpm docs:check` | exit 0: "Deterministic framework reference is current." |
| `pnpm structure:check` | passed (455 warnings, 1152 baselined) |

**Downstream checks.**

| Command | Result |
| --- | --- |
| `node scripts/structure-audit.mjs` | passed (232 warnings, 616 baselined) |
| `node scripts/check/model-text.mjs` | ok: 208 scenario tokens, 378 model-facing Core files, 11888 string literals |

**Headed spec (run by W3).** `pnpm test:e2e site-reset/tests/photo-repair-from-step.spec.ts` ran
headed and failed. Its count line was `{"wholeRuns":1,"fromStepRuns":0}`, against the 2 and 1 the
spec expects. The counter skips `ok:false` answers.

- The first whole test failed at the second step, as designed.
- The second whole test, sent at once, was not refused.
- `from` answered `subflow.from_step_unavailable`.
- The third whole test answered yes and the brief completed.

The cause is the open question below.

**Gate unit test (W2, my fallback edit).** `npx vitest run .../tests/from-step` passed 2 files and
14 tests.

I did not re-run Core's whole `pnpm test`, because full suites run at most twice a day.

## Not verified

- **The end-to-end headed spec past the second test.** It is blocked on the
  `subflow-trials.ts` line. W3 also did not re-run the spec after its last assertion edit.
- **`stoppedAtKey` on a real two-subflow trial.** The source sets it (run.ts:247-250), but the
  model-facing answer shows it only through the repair words, which need `fromStep`. So W3's "absent"
  observation does not decide it either way.
- **From-step runs on real compiled plans** with handlers or End nodes, and toggle-like acts repeated
  by a from-step run.
- **Whether a from-step run should exist on an offline port.** It does not: W1 offers it on live
  ports only. That is right, since an offline port has no page.

## Open questions for the lead

1. Add `if (trials.port.fromStep) port.fromStep = trials.port.fromStep;` after
   `service/project-build/subflow-trials.ts:144` (t795's area), then re-run
   `apps/extension/e2e/site-reset/tests/photo-repair-from-step.spec.ts` headed.
2. Keep or change two choices:
   - a failure kept from the recording (offline-first) sets a repair;
   - the cross-brief memory is keyed by plan digest, so a plan amendment drops it.

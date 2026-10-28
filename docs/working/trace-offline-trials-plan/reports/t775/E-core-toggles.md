# t775-E-core: idempotent toggle steps (Core half)

## Outcome

Done. Core records explored presses the domain answered `toggle`. It gives a model's repeating
`modify_existing` press `ensureState`, or refuses it `candidate.toggle_not_idempotent` naming the
node. It marks an attempt whose domain output says `skipped: "already_in_state"` as succeeded and
skipped. It lists that attempt apart from landed acts. All checks the brief asked for pass.

## What changed and why

Discovery: where explored calls and their targets are recorded.
- The candidate submission controller (`flow-bootstrap/candidate/submission.ts`) sees no draft steps.
  ("No draft stands behind a candidate".)
- Every build's exploration call does go through the permission wrapper's `executeTool`
  (`flow-bootstrap/action-permissions.ts`). It is built in `service.ts` (candidate builds) and
  `service/project-build/brief-ports.ts` (project builders). Both also build the submission port
  (`permissionFor: permissions.planStep`).
- At submission, the resolved plan carries `verdict.handleViews` (`{node: "<subflow>.<node>", handle}`),
  because candidate submissions resolve with `handleReach: "view_history"`.
- So the wrapper is the explored-call record I extended. The hook point is `submitChecked` in
  `submission.ts`, after the way-out and optional-act checks and before the digest. None of these
  are on the must-not-touch list. t772's directories are untouched.

Files:
- NEW `flow-bootstrap/explored-toggles.ts`: class `AutomationStudioExploredToggles`.
  - `explored(call, execution)` records a `core.run_node` call whose execution result
    (`kind: "llm_evidence_tool_execution"`, evidence not `ok:false`) carries
    `outputs.toggle = { signature: <non-empty JsonObject ≤4096 chars>, idempotentWith?: <node id> }`.
  - Each record keeps: the node, the written `parameters.target.handle`, the resolved
    `draft.ranWith.parameters.target`, the signature, and `idempotentWith`.
  - At most 256 records are kept. A malformed answer is not recorded, and nothing is refused for it.
- `flow-bootstrap/action-permissions.ts`:
  - Builds one record per wrapper and tells it every executed call, in both the plain and the
    site-reset branches.
  - Exposes it as the new member `exploredToggles` on `AutomationStudioFlowBootstrapActionPermissions`.
  - Header note added.
- NEW `flow-bootstrap/script-statements/toggle-idempotent.ts` (exported from its barrel): type
  `AutomationStudioExploredToggle` and the pure function `automationStudioFlowPlanToggleSteps({plan, handleViews, explored})`.
  - It first strips any `ensureState` the model wrote.
  - For a node whose `consequences` are exactly `["modify_existing"]`, it looks for the newest explored
    press with the same node id whose handle is among the node's `handleViews`, or whose resolved
    target is equal when compared whole (canonical JSON, never read inside).
  - Match with `idempotentWith`: an error `candidate.toggle_not_idempotent` at
    `plan.subflows.S.nodes.N`. The wording is generic and names only that node id.
  - Match without it: the node parameter `ensureState: <signature>`. It sits on the node, so every
    loop pass carries it.
- `flow-bootstrap/candidate/submission.ts` (THE HOOK):
  - New optional controller input `exploredToggles?: { list() }`.
  - Applied only to model submissions (`holdKept`, that is `submit()`), not to `submitComposed`.
  - A refusal goes through `bindingRefusal(..., "candidate.toggle_not_idempotent")`.
  - The digest is taken from the toggled plan.
- `service.ts` (1 line) and `service/project-build/brief-ports.ts` (1 line): pass
  `exploredToggles: permissions.exploredToggles` into the submission port. `scoped-submission.ts`
  spreads that port into its inner controller.
- `executor/contracts.ts`: new skip variant `{ reason: "already_in_state"; code: string; row?: string }`.
  The file is now 798 lines of its 800.
- NEW `executor/node-execution/already-in-state.ts`: `automationStudioAttemptAlreadyInState(attempt)` marks
  a succeeded attempt whose `outputs.skipped === "already_in_state"` with
  `skipped: { reason: "already_in_state", code: "executor.act.already_in_state" }`.
  - Wired at the start of `finishAttempt` in `node-execution/attempt.ts` (the existing attempt path).
    Because the skip is set first, `recorded-effect.ts` does not hold it to an effect, and the
    completed-act ledger does not record it.
  - Exported from the `node-execution` barrel.
  - `executor/step-loop/` already holds 25 files, the hard limit, so no new file could go there.
- `executor/step-loop/already-done.ts`: new `automationStudioStepSaidAlreadyInState(ctx, node, attempt)`.
  - It adds the loop pass's row to `skipped.row` and writes the attempt message.
  - It emits the chat row "Already so for <row>" or "Already so: <label>" through
    `emitAutomationStudioActivityStepSkipped`, with the step numbers.
  - It is exported from the `step-loop` barrel, and `executor/graph-run.ts` calls it just before the
    attempt is pushed.
- `service/candidate-trial/landed-acts.ts`: new `automationStudioCandidateTrialAlreadyInState(trace, graph)`.
  It returns `{ step, definitionId, label?, control?, outcome: "already_in_state", pass?, row? }`,
  numbered as the trial feedback numbers steps. Landed acts already excluded skipped attempts, and a
  test now proves it for this case. Header note added. The barrel uses `export *`.

## Commands run and observed results

- Fail-first: I disabled the two hooks temporarily (the submission `toggled` and the finishAttempt
  marking), ran the new tests, then restored the files.
  - Observed: `submission-toggles.test.ts (5 tests | 4 failed)`, `already-in-state.test.ts (3 tests | 1 failed)`.
  - After the restore, every new test passed.
- From `packages/fluxiq`: `node ../../scripts/vitest-groups.mjs --groups=parallel` over
  `flow-bootstrap/tests`, `flow-bootstrap/script-statements/tests`, `flow-bootstrap/candidate/tests`,
  `executor/node-execution/tests`, `executor/step-loop/tests`, `service/candidate-trial/tests`,
  `flow-bootstrap/plan/tests/issue-feedback.test.ts` and `llm/deepseek/tests/system-prompt.test.ts`.
  - Observed: `Test Files 104 passed (104)`, `Tests 913 passed (913)`, `[vitest-groups] all groups passed: parallel`.
  - Within that run: `system-prompt.test.ts (43 tests)` passed and `issue-feedback.test.ts (20 tests)` passed.
- The same command over `executor/tests` and `executor/lifecycle-run/tests` (because `graph-run.ts`
  changed): `Test Files 47 passed (47)`, `Tests 439 passed (439)`.
- After the move to nested test folders: `toggles/tests/submission-toggles.test.ts (5 tests)` and
  `already-in-state/tests/landed-acts-already-in-state.test.ts (3 tests)` passed (`Tests 8 passed`).
- `pnpm check` in `packages/fluxiq`: it finished with no TypeScript errors, three times (the last
  after the test move). There were no foreign errors to report.
- `pnpm structure:check` at the Core root:
  - First run: 2 FAILs from `directory-files`. My new tests had pushed `candidate/tests/` and
    `candidate-trial/tests/` to 26 files each.
  - I moved them into `candidate/tests/toggles/tests/` and `candidate-trial/tests/already-in-state/tests/`,
    following the existing nested pattern.
  - Re-run: `structure-audit: passed (443 warning(s), 1152 baselined).`

## Not verified

- The live domain-to-Core path. The tests use a stand-in domain and the recorder directly.
- No live browser run or Lab run.
- The project-builder path (`brief-ports.ts`) is checked by typecheck only. I did not run the
  `service/project-build/tests` suites.
- The `service.ts` wiring is checked by typecheck only.

## Open questions or contradictions found

1. **Where the domain puts `toggle` (needs a check).** Core reads `outputs.toggle` on the tool's
   execution result (`{kind: "llm_evidence_tool_execution", outputs: {...}}`), and only there.
   - The downstream report (`E-domain-toggles.md`) says `toggle` sits "on the node outcome (shown to
     the model too)".
   - If that reaches Core only inside `evidence` and not in the execution result's `outputs` member,
     Core will record nothing, and no step will get `ensureState` or be refused.
   - Similarly, the executor reads `attempt.outputs.skipped === "already_in_state"`. The domain says
     `gateway-mapping.ts` carries `skipped` "in the payload". It must reach the dispatch result's
     `outputs`.
2. **Chat skip reason.** The client contract `CLIENT_GATEWAY_ACTIVITY_SKIP_REASONS` (`packages/contracts`)
   has no `already_in_state` reason. Adding one is a wire change: it needs a contracts build, and the
   test `activity/step/tests/skipped.test.ts` pins the list. So the chat row uses the closed reason
   `already_done`, with Core's own wording "Already so ...". Adding a dedicated reason is a separate decision.
3. **Other readers of skips still lack this reason.** These are outside my owned paths, so I did not change them:
   - `service/summaries/skipped.ts` (the run detail) and `model/flow-adaptation.ts` (the record type)
     know no `already_in_state`, so the run detail shows the attempt as `target_absent`.
   - `service/candidate-trial/feedback.ts` `skippedSaid` tells the model "The page was already at
     another step" for any reason other than `target_absent`, which is wrong for this one.
   - `llm/harness/context-packet.ts` drops it as no skip, which is harmless.
   - Each fix is one or two lines in those files.
4. **Where the separate list is used.** `automationStudioCandidateTrialAlreadyInState` is exported but
   not yet consumed. `service/candidate-trial/summary.ts` (owned by another worker) is where the trial
   would report it.

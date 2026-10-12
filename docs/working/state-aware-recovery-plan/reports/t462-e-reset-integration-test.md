# t462-e: site-reset integration test (worker report)

## Outcome

Done. All five scenarios pass with the real ledger, permission wrapper and candidate authoring loop composed together. No Core defect was found.

## What changed and why

Added one file: `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/site-reset-build.test.ts` (206 lines, 6 tests), in Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t462/!FluxIQ`.

The harness is wired the way `service.ts` wires it:
- a real `AutomationStudioSiteResetLedger`;
- the real `automationStudioFlowBootstrapActionPermissions`, with `permittedConsequences: []`, `authoringMode: "candidate"`, `siteReset: ledger`, `deriveInstructed: async () => []`, and a `say` spy;
- the real `runAutomationStudioFlowCandidateAuthoringLoop`, with `siteReset: ledger`, `loop.executeTool` set to the wrapper's `executeTool`, a scripted `decide`, and `submission.binding.startState` from the fake domain.

The fake domain behaves like a real one:
- It refuses any input key other than node, parameters and consequences.
- It calls `permission({ consequences, control: { name, kind: "button" }, verb: "press" })` before any lasting act, and acts only on `permitted: true`.
- It counts lines: a `create_new` adds one and a `delete` removes one.
- `startState` reports `differs` while the count differs from the start.
- Its evidence lists the control names (Add, Remove, Edit), so the gate carries those names.

The trial port adds one line, as the trial's own act would, and reports that act (`create_new`).

Tests, one per scenario:
1. An explored add, then submit, then test is refused as `candidate.trial_reset_required`. `actsToUndo` is `[{act:"act-1", did:"press \"Add\" button", call:"call.add"}]` and `differs` is `["1 lines where the start had 0"]`. The port is never asked.
2. A remove with `undoes:"act-1"` and `["delete"]`:
   - No domain input ever has an `undoes` key, and the remove acts.
   - `wrapper.request()` is undefined.
   - The undo record is `{consequences:["delete"], permitted:true, undoes:"act-1", control:{name:"Remove"}}`.
   - The next test runs as `trial.1` with no `startedWith`, and `leftOnSite` is `[{act:"act-2", did:"trial step 1 \"Inspect\""}]`.
   - `startState` was read with start `[undefined, {lines:0}, {lines:0}]`, and the comparisons gave `[["1 lines..."], []]`.
3. (a) A delete with no `undoes` raises request `permission-request:1` with `missing:["delete"]`; the domain does not act and the line count stays at 1. (b) After an edit (`modify_existing`, recorded as act-1), a delete naming `undoes:"act-1"` still raises the request and does not act. Its record carries `undoes:"act-1", permitted:false, missing:["delete"]`.
4. After trial 1, the next test is refused, listing `act-2` (the trial's act, with no `call`) and the difference. Once act-2 is undone, `trial.2` runs and `leftOnSite` is `[{act:"act-3"}]`. No request is raised.
5. `wrapper.crossCheck()` after the scenario-2 build gives `declared:["create_new"]` (no delete), `undeclared:[]`, and `actions` equal to the number of non-undo records. The verdict is not `undeclared`, and nothing was said in the thread.

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/tests/site-reset-build.test.ts` (from the Core root):
  - First run: 5 passed, 1 failed. My test assumed the opening call was `demo.look`, but the loop's opening call is the arrival `demo.go`. That was my harness's mistake, not Core's, and I changed the assertion to `toContain("demo.edit")` / `not.toContain("demo.remove")`.
  - Rerun: `Test Files 1 passed (1)`, `Tests 6 passed (6)`.
- `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: passed (331 warning(s), 1159 baselined).` A grep of its output for `site-reset-build` found nothing, so the new file has no warnings.

## Not verified

- No typecheck (`tsc`) of the package was run. Vitest transpiles without type-checking, so the test's types are unchecked.
- Nothing beyond this one test file was run.

## Open questions or contradictions found

- The loop's opening call (`initial.core.run_node`) runs the run-node tool's `arrival` (`demo.go`), not `initialObservation.input` (`demo.look`). This is consistent with `trial-gate-reset.test.ts`, which expects `site-reset.N.arrival` call ids. It is only worth knowing for anyone writing a similar harness.

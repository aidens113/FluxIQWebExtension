# t462-a: site reset gate (worker A report)

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t462/!FluxIQ`, branch `task/t462-build-resets-site-before-rerun`. Nothing committed.
AS = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. The ledger, the gate policy, the start check, the `undoes` schema, the trial-gate reset and the loop and generation wiring are implemented and tested. The check, the tests and the structure audit pass.

## What changed and why

- `AS/flow-bootstrap/site-reset/contracts.ts`: extended only, nothing removed. It adds `AutomationStudioSiteResetNamedAct`, `...Comparison` (`{ moved; differs? }`, where `differs` is absent when unknown), `...Decision` (admit with an optional `startedWith`, or refuse with `evidence` and `moved`), `...TrialAct` (a structural copy of `AutomationStudioCandidateTrialAct`, so site-reset never imports candidate), and `...TrialReset` (`beforeTrial(signal)` and `trialRan(acts, trialRunId)`), which is what the trial gate takes.
- `site-reset/ledger.ts` defines `AutomationStudioSiteResetLedger implements AutomationStudioSiteResetCalls`:
  - Acts are numbered `act-N` and a number is never reused. Numbering stops at 9999 to match the pattern.
  - `explored`: a call that landed with `undoes` marks that act undone. Otherwise a call that landed, was permitted, has effect `mutate` and declares a lasting class becomes an act: did = verb + `"name"` (left out when withheld) + kind, and ref = callId. An act that declares `move_money` or `send_or_publish` is recorded as not undoable. It is never demanded and never claimable.
  - `claim`: `none` for `undefined`. An act is claimable when it is in place, or when it was undone in the current phase. The answer is `allowed: ["delete"]` only if the act declared `create_new`, otherwise `[]`. Anything else gets the refused evidence `{ok:false, code:"candidate.undo_unknown_act", instruction, actsToUndo}`.
  - `beforeTrial(compare)` applies the policy. On a refusal it bumps the phase's refusal count, signature and start-differs flag. When the site is back, it marks every act undone.
  - `trialRan` starts a new phase and records the trial's acts. did = `trial step N "label" on "control"` and ref = `<trialRunId>#step-N`. It returns the in-place undoable acts as `leftOnSite`.
- `site-reset/trial-policy.ts` is the pure policy:
  - Not due (no act recorded this phase): admit, with no compare.
  - Due, and `differs` is `[]`: admit and mark everything undone.
  - Acts in place: refuse with `candidate.trial_reset_required` (`actsToUndo` plus any `differs`).
  - No acts in place but known `differs`: refuse with `candidate.trial_start_differs`, at most once per phase.
  - No deadlock: when the signature (in-place ids + differs) matches the last refusal, or 3 refusals have already been made in the phase, it admits with `startedWith {acts?, differs?}` instead.
  - Unknown `differs` with nothing in place: admit.
- `site-reset/start-check.ts` defines `AutomationStudioSiteResetStartCheck`:
  - `capture()` is attempted once. It calls `binding.startState` with no start, callId `site-reset.start`, under `automationStudioActionPermissionDenied`. A failure is stored in `failure` and not retried.
  - `compare()` needs `startState`, a start, and `core.run_node`'s `initialObservation.arrival`. It runs the arrival through the loop's inner `executeTool` (`site-reset.<n>.arrival`), then calls `startState({start})` (`site-reset.<n>.start`). It always returns `moved` (arrival `effectApplied`).
  - `differs` is absent when there is no start, no arrival or no `startState`, when the arrival returned `ok:false`, when the answer is malformed, or when something throws. A throw is stored, and an abort is rethrown.
- `site-reset/undoes-tool.ts`: `automationStudioSiteResetUndoesTool` adds `undoes` (string, `^act-[1-9][0-9]{0,3}$`, with the brief's description) to the properties of `core.run_node` and leaves other tools unchanged.
- `site-reset/words.ts`: generic instructions for reset-required, start-differs and unknown-act. They name no site, product or task, and a test asserts that.
- `site-reset/index.ts`: the barrel now re-exports all of the above.
- `candidate/trial-gate.ts`:
  - Header paragraph added, and the constructor takes an optional `reset`.
  - In `test()`, `beforeTrial` runs after the existing refusals and the retest-limit check, and before the trial is counted. A refusal returns `effectApplied: moved`, `targetsUnchanged: !moved`, `resultCode: evidence.code` and `resultReason: "retry_allowed"`, and it is not counted.
  - After `ask()`, `trialRan(answer.acts ?? [], trialRunId)` runs, and the evidence gains `startedWith` and `leftOnSite`.
  - `ask()` validates and copies `acts` (`trialActs()`). It drops an entry with a non-integer step, an empty definitionId, unknown or empty consequences, or a non-string label or control, and it de-duplicates consequences.
  - The tool description gains one sentence about resetting first.
- `candidate/authoring-loop.ts`:
  - The `submission` type is widened with `binding?: Pick<Binding,"startState">`, which `service.ts` already passes as `this.llmEvidenceRuntime`. It also takes `siteReset?: AutomationStudioSiteResetLedger`.
  - Only with both a trial port and a ledger: it builds the start check (from `submission.binding`, `projectId`, `flowId`, `loop.tools` and `loop.executeTool`), maps the offered tools through `automationStudioSiteResetUndoesTool`, and captures the start, either right after an `initial.*` call or lazily before any other call. It then passes the reset to the gate.
- `service/flow-bootstrap-commands/candidate-generation.ts`: accepts `siteReset?` and passes it to the loop. Wiring it from `service.ts` is the lead's job.

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/site-reset src/programs/automation-studio/runtime/flow-bootstrap/candidate src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/candidate` printed `Test Files 20 passed (20)`, `Tests 147 passed (147)`.
  - New test files: `site-reset/tests/{ledger,trial-policy,start-check}.test.ts` (10, 8 and 5 tests), `candidate/tests/trial-gate-reset.test.ts` (7) and `service/flow-bootstrap-commands/tests/candidate-generation-site-reset.test.ts` (2).
- `pnpm --filter fluxiq check` printed no `error` lines; build-cache said "stored in the shared store". An earlier run had shown errors in other workers' files (`action-permissions/tests/undo.test.ts` and `flow-bootstrap/tests/site-reset-calls.test.ts`). Those were gone in the final run.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (331 warning(s), 1159 baselined)`. An earlier run caught `as never` casts and packed statements in my new tests, which I fixed.

## Not verified

- I did not check the end-to-end wiring through `service.ts`, because that belongs to the lead and does not exist yet. The tests stand in a fake for worker B's permission wrapper, though I read B's `flow-bootstrap/action-permissions.ts` and the contract calls match.
- I ran no live or browser test, and no real web-domain `startState` (worker D).
- I did not run whole-package suites, per the narrow-check rule.

## Open questions or contradictions found

- "Due" follows the brief literally: an act recorded since the build began or since the last trial. Leftovers of an admitted trial do not make the next trial due by themselves, so it runs without a comparison unless the model or that trial makes a new act.
- In the Lab, the arrival in `compare` takes the target back to the start, and then the trial's own start hook resets the fixture as well. That is harmless, but the double reset means a live run does not measure the model's reset (as the lane report notes).
- The `startState` permission is `automationStudioActionPermissionDenied`, as the brief says. The arrival itself runs through the build's normal permission wrapper (the loop's inner executor), not the denied check.

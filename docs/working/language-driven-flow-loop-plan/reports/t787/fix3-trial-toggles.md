# t787 fix 3: trial toggles (Partial)

## Outcome
Partial. Core side built and tested. The domain does not yet put a `toggle` answer on a trial pass, so nothing records one in a real run until the domain change and the wiring below are made.

## Finding that limits the fix
The brief says the trial trace carries each pass's control before/after. It does: `stateDiff.controls` counts (read by `landed-acts.ts`). But `ensureState` needs the domain's opaque `toggle.signature` (via attribute / name gains-loses / class gains-loses, built in `domain/src/runtime/llm-evidence/node-run/press-effect/toggle-signature.ts` from element snapshots). Only an exploration `core.run_node` press produces it. The extension's `clickAction` result (apps/extension/src/content/actions/click.ts) carries no toggle, so a trial attempt's `outputs` has none. Core cannot derive a signature from state counts (it never reads inside one). Needed in the domain repo (not owned): make the click result carry `toggle` ({signature, idempotentWith?}) for a press that flipped its own control, so it lands under the attempt's `outputs.toggle` or `outputs.result.toggle`.

## What changed
- `flow-bootstrap/explored-toggles.ts`: new `trial(attempts)` records each succeeded, unskipped attempt whose `outputs.toggle` or `outputs.result.toggle` is well formed, as `{node: definitionId, handles: [], trialNodes: [attempt.nodeId], signature, idempotentWith?}`; deduped per node+signature. Existing shape unchanged (additive).
- `script-statements/toggle-idempotent.ts`: `AutomationStudioExploredToggle` gains optional `trialNodes`; a step `<subflow>.<node>` matches a press whose `trialNodes` has an id ending `.<subflow>.<node>` (executed ids look like `node.trial.<subflow>.<node>`, `node.bootstrap.<id>.<subflow>.<node>`).
- `service/candidate-trial/contracts.ts`: optional port `exploredToggles?: { trial(attempts) }` (subflow-trial ports inherit it via Omit). `candidate-trial/run.ts` and `subflow-trial/run.ts` call `ports.exploredToggles?.trial(frames.attempts)` right before `automationStudioCandidateTrialLandedActs`.
- Tests: explored-toggles.test.ts (2 new), toggle-idempotent.test.ts (2 new: only-trial-press step gets ensureState and neighbours `b`/`aa` do not; idempotentWith refusal), new `executor/node-execution/tests/already-in-state-rerun.test.ts` (stateful toggling dispatcher: first run presses 3, second presses 0, all three skipped already_in_state, no completed acts).

## Wiring needed (forbidden files, exact edits)
Pass the build's record to the trial ports where they are built (service.ts near line 1588 and project-build/brief-ports.ts near line 262/335): add `exploredToggles: permissions.exploredToggles` (the same `AutomationStudioExploredToggles` instance submission already reads) to the candidate-trial / subflow-trial ports object. I did not locate the exact trial-ports construction site (likely `service/trial-ports/`); search for where `graphOptions`/`recordSets` ports are assembled.

## Commands
- `pnpm test` on flow-bootstrap/tests/explored-toggles.test.ts, script-statements/tests, executor/node-execution/tests (first run: 84 pass, 1 fail = my new test's first draft using a fixture that cannot model state; rewritten). New executor test then: 1 passed.
- `pnpm test` candidate-trial, subflow-trial, explored-toggles, script-statements: 53 files, 408 tests passed.
- `pnpm check` (packages/fluxiq): finished, no tsc errors printed.
- `pnpm structure:check` (C): "passed (449 warning(s), 1152 baselined)".

## Not verified
- No test drives `run.ts` end to end to show the port call is made (trivial one-line call; not covered).
- The domain-side answer on trial attempts does not exist yet; field location (`outputs.toggle` / `outputs.result.toggle`) is my contract choice to match the exploration answer.
- Trial attempt ids across revisions are assumed to end `.<subflow key>.<node key>` (seen in the evidence: `node.bootstrap.6c9b47feace1aec3.like_recent_posts.s6`).
- Saved-trace value withholding might blank `outputs`; not checked.

## Stale docs
Any architecture sentence saying toggles are "recorded only from exploration presses" (explored-toggles / t775 text) is now stale.

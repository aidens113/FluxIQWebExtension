# Fix F3: reset-brief preflight (t563 Core)

## Outcome

Done. Reproduced without a provider, root-caused, fixed on the composer side, and covered by tests. No commits.

## Which check failed and why

It was `validEvidenceLoopContext` in `runtime/llm/deepseek/preflight.ts`, not the gathered-evidence check in
`request-evidence-check.ts`. That check rebuilds the decision schema from the `completionSchema` the request carries
and requires it to equal the request's `decisionSchema`. A reset brief's two schemas came from two different copies
of `RESET_COMPLETION`:

- the evidence loop built `decisionSchema` from `project-agents/dispatch/reset-loop.ts`'s copy;
- `decisions.decide` sent `completionSchema` from `service/project-build/brief-ports.ts`'s copy.

Commit `4bb74570` ("Require complete pre-act witnesses for subject reset inverses", 2026-10-17) reworded
`cannotUndo.description` in the brief-ports copy only. From then on the two schemas could never match, so every reset
brief's first decision was refused `llm.provider_evidence_loop_context_invalid` before any provider call. That code maps
to `flow_bootstrap.provider_evidence_loop_context_invalid`. The check was right and the composer was wrong, so
validation was not weakened.

The project-build tests never caught it because `mockProvider` does not run DeepSeek's pre-send checks.

## What changed and why

- New file `runtime/project-agents/dispatch/reset-completion.ts` exports `AUTOMATION_STUDIO_PROJECT_RESET_COMPLETION`,
  now the only reset completion schema. It keeps the newer wording from `4bb74570` ("report these as unresolved...").
  It is exported through `project-agents/dispatch/index.ts`.
- `project-agents/dispatch/reset-loop.ts` and `service/project-build/brief-ports.ts` both import this schema. Each local
  copy was removed.
- `service/project-build/tests/project-build-reset.test.ts`:
  - `throughDeepSeek(scripted, { only, altered })` sends model decisions through the real
    `createAutomationStudioDeepSeekProvider`. Its pre-send checks run on the request exactly as built, and a stub `fetch`
    returns the scripted reply. `cartBuild` gains `preflight: true`; `recipeBuild` gains `resetSentAs`.
  - New test "pass from its first decision...": a full project build in which a reset is dispatched after a builder's
    evidence loop, with every decision going through DeepSeek's checks. The reset makes 2 decisions and comes back `done`.
    Negative case: the reset's own captured first request, with only `cannotUndo.description` changed, is still refused
    `llm.provider_evidence_loop_context_invalid` and `fetch` is never called.
  - New test "end through the supervisor's honest ending...": the reset's requests are made genuinely invalid. The
    reset comes back `blocked` with the refusal code in its reason. The supervisor still ends blocked: the record's
    ending is `blocked`, the person is shown "FluxIQ could not finish the Flow.", and the build fails with
    `{ code: flow_bootstrap.post_provider_validation_failed, issueCodes: [project.build_blocked] }`.

### Part 3: the "thrown `post_provider_validation_failed`"

This was already the normal honest ending, not a separate defect. In office r1:

1. The refused reset came back `blocked` (step 0060 `result.json`).
2. The supervisor ended `blocked` (step 0062), and the completion check passed.
3. `run.ts` raises `post_provider_validation_failed` with `project.build_blocked` for every supervisor ending recorded
   `blocked` that has no candidate. The run's `snapshots/live-llm.json` shows the issue codes
   `["flow_bootstrap.post_provider_validation_failed", "project.build_blocked"]`, and the existing test "tells the person,
   when it ends with the save still in the box..." asserts the same thing.

So `run.ts` and the ending path were not changed. The new test holds that path for a refused reset.

## Commands run and observed results

- Before the fix, in Core worktree `packages/fluxiq`:
  `npx vitest run src/programs/automation-studio/runtime/service/project-build/tests/project-build-reset.test.ts -t "pre-send"`
  - Result: 1 failed. The reset dispatch returned
    `{"outcome":"blocked","reason":"The builder failed: Flow Bootstrap generation failed (flow_bootstrap.provider_evidence_loop_context_invalid).","calls":0,...}`
    and the reset agent received 0 requests. This is the office r1 result.
- After the fix:
  `npx vitest run .../project-build-reset.test.ts src/programs/automation-studio/runtime/project-agents/dispatch/tests/ .../project-build/tests/project-build-brief-ports.test.ts`
  - Result: `Test Files 20 passed (20)`, `Tests 121 passed (121)`. The reset file shows 10 passed, including both new tests.
- `pnpm check` in `packages/fluxiq` (the tsc typecheck through build-cache): exit 0, with the line
  `{"build-cache":"build","step":"fluxiq:check",...}` and no errors.
- `node scripts/structure-audit.mjs` at the Core root: `structure-audit: passed (405 warning(s), 1152 baselined).` with
  exit 0. All warnings are advisory and pre-existing.

## Not verified

- No live or Lab rerun, by design. No whole suites were run.
- The live web domain declares denied evidence keys. The test domains declare `[]`, so the gathered-evidence check
  passed trivially here. The live refusal is fully explained by the schema mismatch, which refuses whatever the evidence
  holds.
- In the honest-ending test the reset reports `calls: 1`, while live it was 0. That counter was not investigated.

## Open questions or contradictions found

- **Ownership.** The brief named "the reset-brief composer". It lives in `service/project-build/brief-ports.ts` and
  `project-agents/dispatch/reset-loop.ts`, not under `runtime/flow-bootstrap/`, so I edited those two files plus one new
  file and a barrel line in `project-agents/dispatch/`. None of them is on the must-not-touch list.
- **Wording.** The model now sees the newer `cannotUndo` wording ("report these as unresolved...") in both schemas.
  Before, its decision schema carried the older "each is then kept, trials run with it already done, and the judge is
  told". The header of `reset-loop.ts` (t591) still describes the "kept" behaviour, and F1 (t719 reset ledger) may move
  the semantics again. The schema now has one owner, so a future rewording cannot drift.
- **Observation, not fixed.** In the cart repro before the fix, once the reset came back `blocked` with 2 acts in place,
  the supervisor's next whole trial ran (verdict yes, `start: not_reset`) and the build proposed the Flow. That looks
  intended: after a reset returns, nothing holds the trial back. It does mean a whole trial can run on the build's
  leftovers after a failed reset. The supervisor may want to check this against the "build resets site state before
  rerun" rule.

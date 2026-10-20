# l1-c2-plumbing report

## Outcome

Done. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ`, nothing committed.

## What changed and why

`RT/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `RT/service/candidate-trial/landed-acts.ts`: `spotOf` now reads every spot token
  (`item, dialog, subject, page, scope, resource, place, state`) from `SPOT_KEYS`, each checked
  against the existing `PLACE_TOKEN`. New `controlsOf`/`countsOf` read `stateDiff.controls = { page, before, after }`.
  `page` and every state key must be tokens, every count a positive safe integer, and each side
  holds at most 2,000 entries. If any part is malformed, `controls` is dropped and the act is kept.
  The act now carries `controls`. The header comment was updated.
- `RT/flow-bootstrap/candidate/trial-gate.ts` (carry-through only): `trialActs` kept only
  `spot.item`/`spot.dialog` and dropped `controls`, so the new fields never reached `trialRan` in
  candidate mode. `spotOf` now keeps all eight spot tokens, and a new `controlsOf` copies well-formed
  `controls`. The file is now 784 lines, under the 800 limit.
- `RT/flow-bootstrap/candidate/contracts.ts`: unchanged. `AutomationStudioCandidateTrialAct` is
  only a type, and the gate reads acts from `unknown`, so the type drops nothing at runtime.
  `AutomationStudioCandidateTrialAct` is assignable to `AutomationStudioSiteResetTrialAct`.
- `RT/flow-bootstrap/candidate/authoring-loop.ts`: the ledger's `beforeTrial` checks now include
  `lookAt: async (location) => { const read = await startCheck.lookAt(location, resetSignal); if (!("unread" in read)) ledger.observed(read); }`.
- Tests:
  - `RT/action-permissions/tests/declaration.test.ts`: reads place/state, null when absent;
    malformed place/state refused with code `control_place_invalid`.
  - `RT/flow-bootstrap/tests/action-permissions.test.ts`: the ledger's `explored` call carries
    `place`/`state` on `declared.control`, and has neither key when the domain gave none.
    The name is withheld (null) by design, so the test asserts `kind` and the tokens.
  - `RT/service/candidate-trial/tests/landed-acts.test.ts`: spot resource/place/state and
    controls are carried. Seven malformed `controls` shapes (word page, 0 count, fractional
    count, bad state token, 2,001 entries, missing side, array side) drop `controls` and keep the act.
  - `RT/flow-bootstrap/site-reset/tests/start-check.test.ts`: `lookAt` runs the arrival
    `site-reset.look.1.arrival` with `{ to: location }` and reads twice (settled), answering with
    `controls`; malformed `controls` are omitted and the read is kept; with no reader it answers
    `{ unread: "no_reader" }` and runs nothing.
  - `RT/flow-bootstrap/candidate/tests/trial-gate-reset.test.ts`: two new tests. (1) In the real
    authoring loop, the ledger's `beforeTrial` gets `lookAt`; calling it goes to the location, and
    the settled read with `controls` reaches `ledger.observed`. The test spies on instance methods,
    so it does not depend on the ledger rewrite. (2) The gate carries all spot tokens and
    `controls` to `trialRan`, drops an unknown spot key, and drops malformed controls and spot
    tokens while keeping the act.
    These were first in a new file, but that put `candidate/tests/` at 26 files, over the audit's
    limit of 25, so they were moved into this existing file.

## Commands run and observed results

- `npx vitest run RT/action-permissions/tests RT/flow-bootstrap/tests/action-permissions.test.ts RT/service/candidate-trial/tests RT/flow-bootstrap/site-reset/tests/start-check.test.ts RT/flow-bootstrap/candidate/tests`
  -> 59 passed, 1 failed (my action-permissions assertion expected the withheld name). After the
  fix, `action-permissions.test.ts` -> 26 passed.
- `npx vitest run RT/flow-bootstrap/tests/ RT/flow-bootstrap/site-reset/tests/` -> 27 files, 368 tests passed.
- After the move and the typing fix: `npx vitest run .../candidate/tests/trial-gate-reset.test.ts .../site-reset/tests/start-check.test.ts`
  -> 2 files, 31 tests passed.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> exit 0, no output. The first run flagged
  my start-check fixture (`controls: unknown`); I fixed it with a cast in the test.
- `node scripts/structure-audit.mjs` -> exit 0, "structure-audit: passed (409 warning(s), 1152 baselined)".
  An earlier run showed `llm/tests/` at 26 files. That folder is not mine, and the check passed on the rerun.

## Not verified

- I did not rerun the whole `candidate/tests` folder after moving the tests (it passed before
  the move, and the only file that changed passed afterwards).
- The ledger currently being rewritten never calls `lookAt` on its own. My test calls it from a
  spied `beforeTrial`. The real decision on when to look belongs to l1-c1.
- I did not exercise the project-build or subflow trial paths. `subflow-trial-gate.ts`
  structuredClones acts, so it should carry the new fields.

## Open questions or contradictions found

- `trial-gate.ts` `trialActs` still drops `collections` and `possible` (an act with empty
  consequences is dropped). The header says the gate keeps declared acts only. `collections`
  being dropped in candidate mode looks like the same defect t609 fixed for `spot`. It is outside
  this brief, so I left it.
- `AutomationStudioSiteResetChecks.lookAt` is typed `Promise<void>` and the start check's own
  `lookAt` returns a read. The brief's wiring matches the contract.

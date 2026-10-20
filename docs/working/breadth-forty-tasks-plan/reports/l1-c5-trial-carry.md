# l1-c5-trial-carry report

## Outcome

Done. The only path that still dropped a field was the whole-candidate gate's `trialActs`, which dropped
`collections`. It now keeps them. Every other path passes the port's act objects through unchanged at runtime;
two result contracts were narrower than that and have been widened.

## Path map (`automationStudioCandidateTrialLandedActs` -> `trialRan`)

All paths are relative to `RT/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

1. **Candidate build, whole trial.** `service/candidate-trial/run.ts:138` -> `answerFor(...).result.acts`
   (same objects) -> `flow-bootstrap/candidate/trial-gate.ts` `ask()` -> `trialActs` (re-validates field by
   field) -> `this.input.reset.trialRan` -> `flow-bootstrap/candidate/authoring-loop.ts:120` -> the
   `ledger.trialRan`. **Dropped `collections`; fixed.**
2. **Project build, whole trial.** `service/candidate-trial/run.ts` -> `service/project-build/whole-trials.ts:70-71`
   `ledger.forBrief(SUPERVISOR).trialRan(result.acts)` and `ActsRecord.trialRan(result.acts)`. These take the
   port's result directly, with nothing dropped. The supervisor's gate then sends the result through
   `trial-gate.ts` `trialActs`, but `project-agents/supervisor/whole-trial.ts:160` `trialRan: (_acts, id) => shared.trialRan([], id)`
   ignores the acts by design, because they were already recorded at step 2. `project-agents/single-subflow/single-subflow-trial.ts`
   carries no acts ("the whole trial port records them"), so it does not reach `trialRan`.
3. **Project build, builder's subflow trial.** `service/subflow-trial/run.ts:185` -> `answerFor(...).result.acts`
   (same objects) -> `service/project-build/subflow-trials.ts` port (spreads `...result`, acts untouched) ->
   `project-agents/dispatch/trial-port.ts` (not mine; it was read only through grep and has no act handling) ->
   `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts:615` `kept.acts = structuredClone(result.acts)`, a whole copy ->
   `:497` `reset.trialRan(answer.acts)` -> `service/project-build/brief-ports.ts:258` (not mine) -> the
   build reset ledger and `ActsRecord`. Nothing is dropped.
4. **Project build, entry preparation.** `service/project-build/entry-preparation.ts:131` -> `phase-start.ts:166-167`
   `own.trialRan(entry.acts)`. Same objects, nothing dropped. The type is narrowed to `AutomationStudioCandidateTrialAct[]`
   (types only). That file was not in my list, so I left it.

## What changed and why

- New `RT/flow-bootstrap/candidate/trial-acts.ts` (`automationStudioCandidateTrialActs`): the gate's act copier,
  moved out of `trial-gate.ts` so that file stays under 800 lines (it would have been about 805), plus a new `collections`
  validator. The validator applies the same rule as `landed-acts.ts` `collectionsOf`: both sides must be complete,
  every scope, group, subject and state must be an opaque token, scopes must be distinct, subjects must be distinct,
  and every subject must have exactly one state. Otherwise the act keeps no `collections`, and the act itself is still kept. Which acts are kept is
  unchanged: declared consequences only. The barrel `candidate/index.ts` exports it.
- `trial-gate.ts`: uses the new module, the old helpers and the unused imports are removed, and the header line now names `collections`.
  The file went from 784 to 737 lines.
- `candidate/contracts.ts` `AutomationStudioCandidateTrialResult.acts` and `subflow-candidate/contracts.ts`
  `AutomationStudioSubflowTrialResult.acts`: widened to `AutomationStudioCandidateTrialAct & AutomationStudioSiteResetTrialActPlace`
  (a type import from `../site-reset/index.ts`; site-reset imports neither of these, so there is no cycle). These are types only.
- `service/subflow-trial/run.ts` `answerFor`'s `acts` parameter: changed to `AutomationStudioCandidateTrialLandedAct[]`. This is a type change only.
- No runtime change was needed in `subflow-trial-gate.ts`, `subflow-trials.ts`, `whole-trials.ts`, `supervisor/whole-trial.ts` or
  `single-subflow-trial.ts`.

## Tests

- `candidate/tests/trial-gate-reset.test.ts` (the folder has 27 files, so I extended the existing L1 test): an act with every spot token,
  `controls` and two-scope `collections` reaches `trialRan` exactly. A second act's partial inventory (one subject
  without a state) loses its `collections`, and the act itself is still kept.
- `subflow-candidate/tests/subflow-trial-gate.test.ts`: new describe. An act with every spot token, `controls`, `collections`
  and `created` reaches the reset's `trialRan` deep-equal. This guards path 3 even though that path's runtime code did not change.

## Commands run and observed results

- `npx vitest run` over `RT/flow-bootstrap/candidate`, `RT/flow-bootstrap/subflow-candidate`, `RT/service/subflow-trial`,
  `RT/service/project-build`, `RT/project-agents/supervisor` and `RT/project-agents/single-subflow`: printed `Test Files 108 passed (108)`, `Tests 628 passed (628)`.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` exited 0 with no output.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (409 warning(s), 1152 baselined)`. The only warnings on my files are the advisory
  400-line `file-lines` warnings on `trial-gate.ts` (737) and `subflow-trial-gate.ts` (741, untouched).

## Not verified

- There is no new end-to-end test that drives a project build's whole trial or entry preparation (paths 2 and 4) with a trace carrying
  `collections`. Those paths pass the same objects through, so a test would need a stateDiff fixture through the real trial port.
- No live run was done.

## Open questions or contradictions found

- `service/project-build/entry-preparation.ts` still types its acts as `AutomationStudioCandidateTrialAct[]`. The runtime is unaffected,
  but a future copy-by-field there would silently drop the place fields. Widening it is a one-line change in a file outside this brief.
- The validation rules now live in two places: `landed-acts.ts` (service) and `trial-acts.ts` (flow-bootstrap). Flow-bootstrap cannot import
  from service (dependency direction), so sharing them would need a validator under `flow-bootstrap/site-reset/` (owned by another worker now).

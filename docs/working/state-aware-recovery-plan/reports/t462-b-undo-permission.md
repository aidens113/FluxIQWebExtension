# t462-b: undo permission (worker report)

## Outcome

Done. A candidate build can now undo its own lasting acts without a new permission question. Any act on something that was already there is still gated exactly as before. All the brief's done-criteria have tests, and those tests pass.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t462/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime` (AS).

- `AS/action-permissions/request.ts`: `AutomationStudioActionPermissionAction` has a new optional field, `undoes?: { act; allowed }`. It has the same shape as `AutomationStudioSiteResetUndo`, written out here so this module does not import upward. The request a person sees still builds `action` field by field, so `undoes` never reaches a request.
- `AS/action-permissions/gate.ts`:
  - In `checkFor`, any class listed in `action.undoes.allowed` (filtered to recognised classes, so unknown words fail closed) is excluded from `missing` for this one check only. It is never added to `this.permitted`.
  - The declined-question check still runs first, so a person's earlier no wins.
  - Each record gets `undoes: <act>` when the action carries one.
  - New public method `carriedControlName(name)`. It returns the name the way the gate would carry it to a person, or null when withheld. The wrapper uses it so the ledger's `declared.control.name` follows the same evidence rule.
- `AS/action-permissions/declared.ts`: `AutomationStudioActionDeclarationRecord` has a new optional field, `undoes?: string`.
- `AS/action-permissions/cross-check.ts`: records that carry `undoes` are filtered out before anything is computed, including `actions` and the `not_comparable` verdict. A reset therefore never produces a finding or a question.
- `AS/flow-bootstrap/action-permissions.ts`:
  - New input `siteReset?: AutomationStudioSiteResetCalls`.
  - Without `siteReset`, `executeTool` runs the original code path unchanged. The only shared change is `crossCheck()`, which now returns `undefined` when every record is an undo. Without a ledger there are no undo records, so that case cannot arise.
  - With `siteReset`, `executeTool` works like this:
    - If the call input has its own `undoes` key, the ledger's `claim(value.undoes)` reads it, and the key is stripped before the lasting-read check and before `input.executeTool`.
    - A refused claim returns `{kind: "llm_evidence_tool_execution", evidence, effectApplied: false, targetsUnchanged: true, resultCode: evidence.code (when a string)}` without running anything and without calling `explored`.
    - An accepted claim passes `undoes` to the gate's action.
    - The permission check given to the domain is wrapped so that it records the last verdict and declaration. That record holds:
      - the effect;
      - the consequences in Core order, or `[]` for an observing action;
      - the control, with the name as carried;
      - the verb.
    - After the call, `explored({callId, toolId, undoes?, declared?, landed})` is called.
    - `landed` is true only when the result is an `llm_evidence_tool_execution` with `effectApplied === true` and evidence that is not `ok: false`. This is a small local helper: the closest existing parser, `automationStudioLlmEvidenceNothingHappened` in `llm/repeat-policy.ts`, has different semantics.
    - `planStep` is untouched.
  - The site-reset types and key are imported from `./site-reset/contracts.ts`, not from the `./site-reset/index.ts` barrel the brief named. The barrel now also exports worker A's `start-check.ts` and `undoes-tool.ts`, which import `llm/index.ts`. That closed an import cycle back through `flow-bootstrap/index.ts`, and the structure audit failed on it. `contracts.ts` is the module that owns these exports.
- New tests:
  - `AS/action-permissions/tests/undo.test.ts`, 8 tests:
    - an undo of a `create_new` act deletes unasked, and its record carries `undoes`;
    - the allowance does not carry over to the next delete;
    - `allowed: []` still raises the request;
    - a class outside `allowed` is still asked about;
    - a decline wins;
    - an unrecognised allowed word permits nothing;
    - the cross-check ignores undo records, and returns `not_comparable` when every record is an undo.
  - `AS/flow-bootstrap/tests/site-reset-calls.test.ts`, 7 tests:
    - the wrapper strips `undoes` and the undo deletes unasked;
    - `explored` receives `landed` and the declaration (name withheld when it was never shown);
    - a refused claim is answered without running;
    - a call with no claim is asked about as before and reported as not landed;
    - a key the ledger reads as `none` is still stripped;
    - `ok:false` evidence and plain answers do not count as landed;
    - without `siteReset`, the key passes through unchanged and the delete is asked about;
    - `crossCheck` returns `undefined` when every action was an undo.

**Stored-record validator:** there is none to update. `AutomationStudioActionDeclarationRecord` is stored on proposals as `declaredConsequences` by `service/flow-bootstrap-commands/permission-outcome.ts`, `flow-bootstrap/review-projection.ts` and `service.ts:1796`. All three copy it with `structuredClone` or a spread and do not check its fields. A `git grep` found no schema or parser for it outside TypeScript source either.

## Commands run and observed results

All commands were run from `C:/Users/osrs_/FluxStuff/fxwork/t462/!FluxIQ`.

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/action-permissions src/programs/automation-studio/runtime/flow-bootstrap/tests` printed `Test Files 23 passed (23)` and `Tests 278 passed (278)`.
- `pnpm --filter fluxiq check` printed no `error TS` lines and exited 0 on the final run.
  - An earlier run showed errors in my two new test files (missing `instructionDigest`, possibly-undefined `call.permission`), which I fixed.
  - The same run also showed errors in `service/candidate-trial/tests/landed-acts.test.ts` and `run.test.ts`, which belong to worker C. Those errors were gone on the final run.
- `node scripts/structure-audit.mjs`:
  - My files are clean: the earlier import cycle, the `as-never` cast, the `contract-spread` violation and the statement-packing violation in my files are all fixed.
  - 3 statement-packing violations remain, all in worker A's files: `flow-bootstrap/site-reset/tests/ledger.test.ts:92`, `start-check.test.ts:82` and `trial-policy.test.ts:16`.
  - The audit also reported "2 baseline entries can be lowered", which I did not act on.

## Not verified

- I did not test the wrapper against worker A's real ledger. The tests use a scripted stand-in for `AutomationStudioSiteResetCalls`.
- I did not check wiring from the service: whether `candidate-generation.ts` passes `siteReset`.
- No live run.
- I did not run the full package suite, per the brief and AGENTS.md.

## Open questions or contradictions found

1. The brief said to import from `./site-reset/index.ts`. The import comes from `./site-reset/contracts.ts` instead, because the barrel import closes an import cycle (see above). Any other consumer that imports values from the site-reset barrel inside `flow-bootstrap/` may hit the same cycle.
2. An undo of a gated class still calls the gate's `instructedFor()`, and so may trigger the build's one read of the instruction, the same as any lasting declaration. That is unchanged behaviour, noted here because a reset that would otherwise have paid for nothing can now cause that read.
3. `flow-bootstrap/review-projection.ts` (not mine) copies `declaredConsequences`, undo records included, into the review. It shows them as records, not as a question or a finding. If the panel should hide reset actions, that file is where to do it.
4. `declared.control.name` is null when the model was never shown the name, matching how the gate carries names to a person. The ledger's act descriptions will therefore have a null name for controls the model never saw in evidence.

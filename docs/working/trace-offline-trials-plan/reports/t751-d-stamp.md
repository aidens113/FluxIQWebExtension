# Report: t751-d-stamp (worker D, plan-step witness stamp)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ` (task/t751-reset-by-observed-state). RT = `packages/fluxiq/src/programs/automation-studio/runtime/`, R = `RT/flow-bootstrap/`. No commits, no full suites, no live runs.

## Outcome

Done, with two small edits outside the listed ownership (see Open questions). A reversible lasting step's witness stamp now goes from submission to the plan node (`resetWitness`), then to the Flow node metadata (`resetWitness` key), then to the trial act (`witness`). A model can never write it. A resubmission whose stamp changed is a new revision, and a composed whole candidate keeps every node's stamp. All of this is tested.

## What changed and why

1. **Plan field, Core-derived only.**
   - `R/plan/contracts.ts`: the node gains `resetWitness?: AutomationStudioSiteResetWitnessStamp`.
   - `R/plan/parsing.ts`: `resetWitness` is an allowed node field, accepted only when `automationStudioSiteResetWitnessStampValid` passes. Anything else is refused with `bootstrap.invalid_reset_witness` at the node's path.
   - `R/authoring/keys.ts`: new `authoringCoreDerivedKey` (matches `resetWitness` however it is spelled).
   - `R/authoring/assemble.ts` (script lines) and `R/authoring/normalise.ts` (JSON-plan parameters): such a key is refused as `bootstrap.unknown_parameter`. It never goes through containment or `automationStudioMatchWrittenParameterName` nearness matching.
   - The JSON-plan normaliser already builds nodes fresh, so a node-level `resetWitness` field is dropped there.
   - `RT/llm/harness-options/bootstrap-completion.ts`: `withoutRouteSignatures` became `withoutCoreDerived`. It now also strips `resetWitness` from a reply's plan, following the `routeSignatures` precedent.
   - `assemble.ts` stays at 800 lines: the comment was put on the same line as the code.
2. **Stamped at submission.**
   - `R/action-permissions.ts`: `planStep` takes an optional `witnessed` callback. For a permitted declaration whose effect is `mutate` and whose classes are all create_new / modify_existing / delete, it calls `siteReset.admitStep?.(declared, definitionId)`.
     - `declared` is `{effect, consequences, control: {name: null, kind: null, ...tokens}}`, the same form `createBaseline` gets.
     - The call goes through a local structural type (`StepAdmitting`), and the answer is normalised by `stepWitness`. It accepts either a stamp or an `{kind: "admit", witness}` verdict, and returns only a valid stamp, otherwise `undefined`.
     - A refused gate decision, a non-reversible declaration and an observe declaration are not stamped. Submission never refuses for a missing witness.
   - `RT/llm/harness-options/plan-parameter-resolution.ts`: `permissionFor` now also receives `witnessed`. The resolver is the only writer of the stamp. Each node it asks about is cleared first, then given the stamp its check was told (for resolved and unchanged outcomes alike). So a stamp the plan arrived with, model-written or not, never survives resolution. File is now 562 lines.
   - While I worked, the other worker added `admitStep?(declared, operation?): AutomationStudioSiteResetWitnessStamp | undefined` to `AutomationStudioSiteResetCalls`. My code compiles against it; the structural type is now redundant but harmless.
3. **Flow node and trial act.**
   - New `R/candidate/reset-witness-key.ts`, exporting `AUTOMATION_STUDIO_RESET_WITNESS_METADATA_KEY = "resetWitness"`, with a barrel line in `R/candidate/index.ts`.
   - `R/adaptation.ts` writes a copy of a valid stamp under that metadata key.
   - `RT/service/candidate-trial/landed-acts.ts` reads it, validates it, and sets `witness` on the act. A malformed value is dropped and the act kept.
   - `R/candidate/contracts.ts`: `AutomationStudioCandidateTrialAct.witness?`.
   - `R/candidate/trial-acts.ts` copies a valid `witness`.
4. **Resubmission and composition.**
   - The digest and `automationStudioCandidateSameBehaviour` already include every node field except `label`, so a stamp change already counts as a behaviour change.
   - What blocked it was the same-text shortcut in `R/candidate/submission.ts`: it refused a resubmission before the check ran, so nothing could be re-stamped (proven: the new test fails against HEAD's `submission.ts`).
   - That shortcut now applies only when the last accepted plan has no step declaring a reversible class (`restampable`). Such a Flow is checked again, and the digest comparison decides.
   - Composition needed no code: assembly carries the proposals' nodes whole, the parser keeps a valid stamp, and validation/layout spread the node.
5. **Project builds.** Builders and the reset brief both reach `action-permissions` through `automationStudioProjectBuildResetCalls(project, own)`, and builders then also go through `acts.calls(...)`.
   - `RT/service/project-build/reset-calls.ts` forwards `admitStep` to the brief's own ledger (`own`).
   - `RT/service/project-build/acts-record.ts` `calls()` forwards it to the ledger it wraps.
   - Both use `.bind(...)`, so they type-check whether or not the contract declares `admitStep`.
6. **`R/tests/action-permissions.test.ts:127`.** Rewritten to the new rule: after the first lasting act, a ref-less press that repeats nothing explored is refused unrun (`candidate.reset_witness_required`) and recorded nowhere, and the trial is then admitted.
   - With the other worker's current ledger, the old "save-again" press (same node, same control) is now admitted as `repeats`. The test asserts that too.

Tests added:
- `R/plan/tests/parsing.test.ts`: reset witness describe.
- `R/authoring/tests/stray-parameter-key.test.ts`: script, JSON parameter and JSON field cases, including one-letter-off nearness.
- `RT/llm/harness-options/tests/plan-parameter-resolution.test.ts`: stamp written; arriving stamp dropped for model and host plans; never refuses.
- `R/tests/action-permissions.test.ts`: planStep witness describe.
- `R/tests/adaptation.test.ts`: metadata.
- `RT/service/candidate-trial/tests/landed-acts.test.ts`: act witness.
- `RT/service/project-build/tests/project-build-acts-record.test.ts` and `reset-calls.test.ts`: forwarding.
- New `R/candidate/tests/reset-witness/tests/reset-witness-stamp.test.ts`, following the `tests/kept-condition/tests/` precedent because `candidate/tests` has 25 files: resubmission restamp, composed keeps stamps, composed malformed refused, trial-acts copy.

On test-first: I wrote each test alongside its code. To show they test the change, I put HEAD's version back for the guarded files and the new tests failed:
- `assemble.ts`/`normalise.ts` → 2 failures.
- `submission.ts` → the resubmission test failed with `candidate.unchanged_submission`.
- `reset-calls.ts` → the forwarding test failed.

## Commands run and observed results

All tests ran from `packages/fluxiq`.

- `pnpm exec tsc --noEmit -p .`
  - After my files compiled: no output, exit 0.
  - Final run: exit 2, with 4 errors, all in other workers' in-progress files: `R/site-reset/tests/trial-witness.test.ts`, `R/site-reset/tests/undo-admission.test.ts` (2), and `R/reset-answers/tests/refusal.test.ts`. None of the errors is in a file I own or touched.
- `pnpm test` over: `R/plan/tests/parsing.test.ts`, `R/authoring/tests`, `RT/llm/harness-options/tests/{plan-parameter-resolution,plan-parameter-unresolved,bootstrap-completion,bootstrap-completion-composed}.test.ts`, `R/tests/{action-permissions,adaptation}.test.ts`, `R/candidate/tests`, `RT/service/candidate-trial/tests/landed-acts.test.ts`, `RT/service/project-build/tests/{project-build-acts-record,reset-calls}.test.ts`.
  - parallel group: `Test Files  1 failed | 62 passed (63)`, `Tests  2 failed | 624 passed (626)`.
  - real-sql group: `No test files found, exiting with code 0` (no Test Files line).
  - The 2 failures are in `reset-calls.test.ts` ("lists every brief's open act…" and "answers an unknown act…": `expected [ 'act-1' ] to deeply equal [ 'act-1', 'act-2' ]`). They also failed with `reset-calls.ts` put back to HEAD. They come from the other workers' in-progress site-reset changes, not from this unit.
- `node scripts/structure-audit.mjs` (Core root) → `structure-audit: passed (439 warning(s), 1152 baselined).`
  - The first run failed on one `as never` in my new test. I replaced it with a typed `Resolver` stub.

## Not verified

- The stamp has not been carried end to end through a real trial run (adaptation → executor → trace → `landed-acts`). Each link is tested separately.
- The real ledger `admitStep` together with `planStep` has not been run: my tests use fakes, and the ledger is still being edited.
- No live or browser run, no full suite.
- Whether the subflow trial path and entry preparation read acts through `landed-acts.ts` (the header says every caller does) and then hand the stamp to the trial gate is E's unit; I did not verify it.

## Open questions or contradictions found

- **Edits outside the listed ownership:**
  - `R/candidate/submission.ts`: the same-text shortcut. Without it, item 4 cannot be met.
  - `R/candidate/index.ts`: one barrel line for the new key file.
  - Neither file is on the must-not-touch list.
- **Same-text resubmission cost.** A same-text resubmission of a Flow with a reversible lasting step now re-runs the completion check: domain resolution plus the gate, with no provider call. It uses up a revision number, as a reworded same-plan submission already did.
- **Legacy reply path.** The legacy bootstrap path (`RT/service.ts:1699`, provider plan parsed by `response-envelope.ts` / `provider-result.ts`) still accepts a model-written stamp at parse. Resolution then deletes it, because the resolver is the only writer. Any plan that reaches persistence without passing through resolution (composed only) keeps whatever stamp the parser accepted.
- **`definitionId` as operation.** `admitStep` is called with the plan step's `definitionId` as its `operation` argument, as the brief says. Whether a definition id matches an explored act's landed `operation` (`value.node`) for `repeats` is the admission's rule, not checked here.

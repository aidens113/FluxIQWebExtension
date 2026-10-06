# t193-1003-w2 lasting acts by kind -- report

## Outcome

Done.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime`.

- `R/flow-bootstrap/action-permissions.ts`
  - `instructedLastingActs` now takes acts typed `{ id; quote; kind?: AutomationStudioInstructedActKind }` (type-only import from `./instructed-acts/index.ts`). `kind` is optional, so existing callers and tests without it still compile. service.ts l.1571 already passes `automationStudioInstructedActs(...)`, which carries `kind`; service.ts was not edited.
  - New module-private `LASTING_KINDS = {add_to, save, claim, move, submit}`, the same kinds `PLURAL_KINDS` names in instruction-acts.ts. An own act (id without `.`) of one of those kinds is lasting whatever the read quoted. `set` and `open` keep the folded quote-containment match.
  - The read is still forced on every call that has own acts, even when all of them are kind-lasting. That keeps `instructed()` known before the build ends and gives the cross-check one shared provider call. A read that fails resolves to `[]` at the gate, so the kind-lasting acts are still named and nothing is named by quote.
  - I rewrote the doc comment on `instructedLastingActs` (formerly l.120-136) to describe the rule, cite run-musp4h2f-72e8ed99, and explain the failed-read behaviour.
- `R/flow-draft/verify-only.ts`: wording only. The header paragraph "An instructed act is checked whatever the step declares" and the `automationStudioFlowDraftStepReplayMode` doc now say that an add, save, claim, move or submit lasts by its kind, and that a setting or an open lasts only when the read quotes it.
- `R/flow-bootstrap/tests/action-permissions.test.ts`
  - New describe "an act whose kind lasts, whatever the read quoted", with three cases:
    1. The exact run-B instruction (RUN_6 text from check.test.ts) gives acts `[a1 set, a2 add_to, a3 add_to]`. The read quotes the store switch plus the coordinated "add two packs ... and one pack ... to my cart" sentence. Expected result: `{a1, a2, a3}`.
    2. An `open` act "open my saved items" that the read does not quote is not lasting, and the choice id `a2.quantity` (even typed `add_to`) is never named.
    3. When the read fails, `{a2, a3}` is still named.
  - I renamed the existing failed-read test to "names nothing by quote when the read fails". Its acts carry no kind, so it still expects `[]`.

## Commands run and observed results

- Red, before the fix: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts` (in packages/fluxiq) -> `Tests 2 failed | 15 passed (17)`. Case 1 did not include a2/a3. Case 3 printed `expected [] to deeply equal [ 'a2', 'a3' ]`. Case 2 passed before and after, as a guard against regressions.
- Green: the same command -> `Tests 17 passed (17)`.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts src/programs/automation-studio/runtime/flow-draft` -> `Test Files 20 passed (20)`, `Tests 189 passed (189)`.
- From the Core root: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w2 tsc" npx tsc --noEmit -p packages/fluxiq` -> printed only `[heavy] t193 w2 tsc holds b1`, with no diagnostics and exit 0.

## Not verified

- No live run.
- I did not run the tests of other modules that consume `lastingActs`: `llm/node-tools/dry-run-gate.ts`, `replay-draft.ts`, and `service/flow-bootstrap-commands`. They receive the Set and their code did not change.
- No structure audit run.

## Open questions or contradictions found

- `git diff --stat` in the Core tree also shows `result-verification/build-test/tests/summary.test.ts` as modified. I did not touch that file; another worker presumably did.
- The comments in `llm/loop-configuration.ts:332`, `llm/node-tools/dry-run-gate.ts:252` ("a read that fails answers no acts") and `llm/node-tools/replay-draft.ts:96` still describe lasting acts as read-derived. The dry-run-gate one is now inaccurate for kind-lasting acts. I left it alone because `R/llm/**` is must-not-touch.

# t203: robot-check allowance for model-built clicks and navigations

Worker report. Branch `task/t203-robot-check-allowance-model-clicks`, downstream tree only; the Core tree is unchanged.

## Outcome

Done, with one gap named below: Core's own recording fallback for an unlinked recorded click still gets no allowance.

## What changed and why

**Root cause, confirmed from the code.** A model-built Flow node is a web output node (`web.output.dom-click` and the others), not Core's Run Output node. Its dispatch effect carries no top-level `timeoutMs`, so the page's check wait was bounded by `parameters.timeoutMs`:
- the model's own value, for example 5 s, which leaves about 3 s;
- or the node default of 10 s, which leaves about 8 s.

Build-time runs (`run.ts`, `replay.ts`) send the model's parameters straight to the gateway with no allowance. Either way bigbox's 8 s check ran the command out (`muoga8at`: 10.5 s). Only `web-panel-host.ts` `candidate()` added the allowance. Core `nodes/policy/action.ts:62` (a 5 s default) applies only to Run Output nodes and recorded nodes.

**One shared rule.** `domain/src/actions/check-wait.ts` gains two helpers. Both are built on `webAutomationBaseTimeoutMs`, so each is idempotent: a command that passes through two call sites carries the allowance once.
- `webAutomationCheckWaitNode(outputId, { parameters, timeoutMs })` covers nodes whose timeout Core reads off the node. It puts `checkWaitMs: 15000` in the parameters and sets the node timeout to (its own timeout, or Core's 5 s default) plus 15 s.
- `webAutomationCheckWaitParameters(outputId, parameters)` covers dispatched parameters. It adds `checkWaitMs`, and adds the 15 s to `parameters.timeoutMs` when one is named. When none is named it leaves the timeout unset: the page then waits the full 15 s, and Core's gateway waits its 30 s default.

**Call sites:**
- `domain/src/output-nodes/native-runtime.ts`: every web output node's click or navigate dispatch. This is the Flow-run path for model-built Flows.
- `domain/src/runtime/llm-evidence/tools.ts`: `createWebAutomationLlmEvidenceRuntime` wraps its gateway (`withCheckWait`), so every build-time command gets the allowance. That covers the run-node, replay reset navigate and replayed step. The step's recorded `ranWith` and draft are unchanged; the test checks this.
- `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`: a Run Output node naming a click or navigate gets the node-level allowance, even with no handle, and a second resolve returns `unchanged`. `run.ts` was not touched.
- `domain/src/web-panel-host.ts`: `candidate()` now uses the shared helper; its behaviour is unchanged. `linkedClickEntry` (a recorded click with a linked landing) also gets the allowance; before this change it had none.
- `docs/architecture/failure-taxonomy.md`: updated to say every click and navigation gets the allowance, where it is added, and what gap remains.

**Tests:**
- `actions/tests/check-wait.test.ts`: both helpers, including that a second pass changes nothing.
- `output-nodes/tests/native-runtime.test.ts`: a built click (10 s becomes 25 s, plus `checkWaitMs`) and a navigate (`checkWaitMs` only). Type, wait and scroll get no allowance. The row-scoping click expectations now include `checkWaitMs`.
- `plan-resolution/tests/resolve-plan-node.test.ts`:
  - a Run Output click, navigate or type: 20 s by default, 23 s from a model's 8 s, and a second resolve returns `unchanged`;
  - a build-time press, navigate and type through the runtime gateway: the press is 5 s plus 15 s with `checkWaitMs`, and the type has none.
- `node-run/tests/replay.test.ts`: the reset navigate and the replayed click now carry `checkWaitMs`.
- `tests/domain.test.ts`: the D1b linked click now carries the allowance, both mapped directly and through Core.
- `apps/extension/src/runtime/tests/landed-check-wait.test.ts` takes a built click through `webAutomationCheckWaitParameters`, then `webAutomationActionFromGatewayCommand`, then `checkWaitBudgetMs` and `waitOutLandedCheck`, on the test's simulated clock:
  - with the allowance, the 8 s self-clearing check clears (`cleared`, 8,500 ms);
  - the same click with no allowance gets a 3,000 ms budget and returns `not_cleared`;
  - a check that never clears returns `not_cleared` after the full 15 s, and the failure text says only a person can answer it;
  - a check that turns person-only returns `person_only`.

## Commands run and observed results

- `bash .../heavy.sh "t203 domain tsc" npx tsc -p tsconfig.test.json --noEmit` in `domain`: no output, clean. The same command with `tsconfig.json`: clean.
- `DOMAIN_TEST_BUILD_LABEL=t203 bash .../heavy.sh "t203 domain test" node scripts/test-domain.mjs`: exit 0, `# tests 991 / # pass 991 / # fail 0`, "Web automation domain smoke test passed."
  - Earlier runs failed until the D1b expectations in `domain.test.ts` were updated, because that entry failed to load. The final run has no load failures.
- `bash .../heavy.sh "t203 ext tsc" npx tsc -p tsconfig.json --noEmit` in `apps/extension`: clean.
- `EXTENSION_TEST_BUILD_LABEL=t203 bash .../heavy.sh "t203 ext test" node scripts/test-extension.mjs`: exit 0, `# tests 1490 / # pass 1490 / # fail 0`, including the 3 new rows.
- `node scripts/structure-audit.mjs` downstream: `passed (131 warning(s), 120 baselined)`. The first run failed `[contract-spread]` in `tools.ts`; fixed with `present<WebLlmEvidenceGateway>()`.
- Core, `npx tsc -p packages/fluxiq/tsconfig.json --noEmit`: clean. Core `node scripts/structure-audit.mjs`: `passed (199 warning(s), 354 baselined)`. No Core file was changed, so no Core vitest was run.

## Not verified

- No browser or Lab run (the brief forbids them). A live bigbox run meeting its check is the proof still owed.
- The check-wait timing was tested only with the test's simulated clock.
- The extension-side test was run after the last domain edit; the full domain suite was re-run after the final edit.

## Open questions or contradictions found

1. **Gap:** a recorded click that Core's own fallback proposes still carries Core's 5 s default and no `checkWaitMs`. That is an `action` entry with no linked landing; the mapper returns `null`, and the D1b through-Core row shows it. Recorded navigations proposed by Core's fallback have the same gap.
   - Fixing it means the mapper proposes every click or navigate action entry itself (breaking the "null so Core's fallback survives" rows in `domain.test.ts`, W25/D1b), or a Core change so a registered output can declare a timeout allowance.
   - Supervisor's call.
2. **Timeout ceiling:** when a web output node names `timeoutMs` above 15 s, the parameters timeout with the allowance exceeds the gateway's 30 s default wait. This matters only where Core sends no command timeout (native nodes, build calls). It is an edge case, not capped here.
3. **Possible merge conflicts:** `tools.ts` and `node-run/tests/replay.test.ts` are also touched by t200, `task/t174-live-lane` and `task/t196-state-digest-cost` (per audit A4). The changes here are small and local: an import, `withCheckWait`, and two assertions.

Ready to commit: apps/extension/src/runtime/tests/landed-check-wait.test.ts, docs/architecture/failure-taxonomy.md, domain/src/actions/check-wait.ts, domain/src/actions/tests/check-wait.test.ts, domain/src/output-nodes/native-runtime.ts, domain/src/output-nodes/tests/native-runtime.test.ts, domain/src/runtime/llm-evidence/node-run/tests/replay.test.ts, domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts, domain/src/runtime/llm-evidence/plan-resolution/tests/resolve-plan-node.test.ts, domain/src/runtime/llm-evidence/tools.ts, domain/src/tests/domain.test.ts, domain/src/web-panel-host.ts, docs/working/language-driven-flow-loop-plan/reports/t203-robot-check-allowance.md; validation: `node scripts/test-domain.mjs` -> 991/991 pass, exit 0; `node scripts/test-extension.mjs` -> 1490/1490 pass, exit 0; domain, extension and Core tsc clean; structure-audit passed in both.

## Follow-up: closing the Core-fallback gap (supervisor's call, after commit 9e3b398d)

**Outcome:** Done. Open question 1 is closed in the domain mapper, with no Core change.

**What changed:**
- `domain/src/web-panel-host.ts`: `linkedClickEntry` is now `recordedActionEntry`. Every recorded `web.dom.click` or `web.browser.navigate` `action` entry that Core's fallback would propose (`policyEligible` not false), linked or unlinked, is now proposed by the mapper.
  - It has the same fields as `recordingActionEntryCandidate`: output, parameters, source input, confirmation, confidence 0.95, and the `readableTokenValue` label. The labels are in `FALLBACK_LABELS`.
  - It goes through the one rule, `webAutomationCheckWaitNode`: `checkWaitMs` 15000 and node `timeoutMs` 20000.
  - A click whose landing names its event id also gets the landing claim.
  - Other action entries, and refused ones, still map to `null`, so Core's fallback handles them.
- The comments in `domain/src/actions/check-wait.ts` and the mapper's doc comment are updated. `docs/architecture/failure-taxonomy.md` no longer names the gap.

**Tests** (`domain/src/tests/domain.test.ts`):
- W25/t203: an unlinked recorded click (`lateClickEntry`, nothing after it) maps to Core's fallback candidate plus the allowance. It used to map to `null`.
- D1b/t203: two more unlinked cases get the allowance and no landing claim:
  - `signInEntry` with no following entries;
  - an entry whose landing names another click.
- t203: a navigation action entry gets the allowance with the label "Web Browser Navigate".
- Through Core (`createRecordingFlowProposals`):
  - Core's own fallback candidate has no `timeoutMs`;
  - the `web` mapper proposes the linked click with its landing claim and the allowance, and the unlinked click with the allowance.

**Commands run and observed results:**
- Domain `tsc -p tsconfig.test.json` and `tsc -p tsconfig.json`: no output.
- `DOMAIN_TEST_BUILD_LABEL=t203 node scripts/test-domain.mjs`: exit 0, 991/991 pass, no entry failed to load, smoke test passed.
- Extension `tsc`: clean. `node scripts/test-extension.mjs`: exit 0, 1490/1490 pass.
- `structure-audit` downstream: passed (131 warnings, 120 baselined).
- Core `tsc -p packages/fluxiq/tsconfig.json --noEmit`: clean. Core `structure-audit`: passed. The Core tree is unchanged.

**Not verified:** no live run. The navigate label is hard-coded to match `readableTokenValue`; only the click label is checked against Core's own fallback through Core.

Ready to commit: domain/src/web-panel-host.ts, domain/src/tests/domain.test.ts, domain/src/actions/check-wait.ts, docs/architecture/failure-taxonomy.md, docs/working/language-driven-flow-loop-plan/reports/t203-robot-check-allowance.md; validation: `node scripts/test-domain.mjs` -> 991/991 pass, exit 0; `node scripts/test-extension.mjs` -> 1490/1490 pass, exit 0; tsc clean (domain, extension, Core); structure-audit passed in both.

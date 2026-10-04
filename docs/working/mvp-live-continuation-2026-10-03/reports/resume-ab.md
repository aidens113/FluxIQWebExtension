# A/B reconciliation for MVP continuation

Worker: resume-ab. Date: 2026-10-03. Scope: read-only reconciliation of paired t174/t193 trees and current t262 counterparts; this report is the only edited file. No tests, builds, processes, provider calls, env reads, commits or source edits.

## Latest endings: lead documents are stale

| Lane | Newly located ending | Exact observed metadata |
| --- | --- | --- |
| A | Run 3 `run-musuq910-0e2ae903` | `run.json.status=failed`, `evaluation.json.failureCategory=runtime.behavior`, `flowCreated=false`, `llm.calls=41`, profile `lab-create-flow`; start 2026-10-03T20:35:46.374Z, finish 20:41:09.507Z. |
| B | Run 2 `run-mustzxhi-2e2cda87` | `run.json.status=failed`, `evaluation.json.failureCategory=runtime.behavior`, `flowCreated=false`, `llm.calls=40`, profile `production`; start 2026-10-03T20:15:18.358Z, finish 20:20:13.838Z. |

Evidence: each lane's `test-runs/instances/t174-slot-1/<run>/` or `t193-slot-2/<run>/`, respectively. Both have `bundle.complete.json`, evaluation, run/summary, logs/review/screenshots. A's lead still says run 3 in progress; B's lead ends at pre-run-2 validation. Searches of the lane reports/debug folders found no document naming either newer ID. These completed failures need a fresh supervisor debug before another paid run. No cost was extracted and no scenario/page data was printed; this inspection selected run status, category, times and call count only. No claim about functional root cause from metadata alone.

Earlier verified-by-lead claims remain historical, not fresh certification: A Flash run 1 passed 4/4 facts at $0.024166530/20 calls; A Pro comparison cost $0.212718924/31 calls and could not play back; B run 1 ended without a Flow at about $0.0920/68 calls. The newer A/B failures show that prepared fixes are not yet proven live.

## Recommended first coherent integration

1. Debug A run 3 first: read its complete ending, amendment refusals, draft, final tested definition and judge pair; record a named debug. Do not assume the failed build is the same cause as the prior Pro reorder.
2. Import A's **per-act instruction read** as one Core unit, then reconcile B's deterministic lasting-kind fallback into the same owner. This closes lost coupon/cart clauses and instruction-read overlap while avoiding broad UI/facility integration. Import source/tests listed below, preserving current t261 budget behavior. A's lead already fixed the confirm-requests fake reply; w107's report calls that test partial because it predates the lead fix.
3. Import A's **toggle + stale replay marks + stable handles** as a paired Core/domain unit if current debug still supports it. It changes the strict draft contract, so both sides must land together. Review reversal semantics before accepting: the current algorithm drops opposite same-control presses even if intervening steps need the intermediate state, trusting the model to put them back. Tests prove mechanics, not safe semantics across all user tasks. Add a regression for a required intervening act or restrict the drop before promotion.
4. Reconcile A/B **replayed mutation observations** serially: A's bounded prioritized `changed` lines and B's screened `changed`/`notice` evidence both edit summary/diagnosis/pins. Keep the security screen and essential quantity evidence, and preserve A's exploration-state warning. Do not choose a last-writer whole file.
5. Add B's **draft amendment signature** independently (acts and `ranWith`), then softened-judge progress. These repair false `draft_amendment_undone` and false no-progress stops. They require their owning regressions but do not need all UI changes.
6. Replay waits/tab cleanup is useful next; UI/refusal/record improvements should be integrated as their own coherent units. Do not let the broad A/B wording conflict delay the initial fresh honest A build after its actual newest failure is debugged.

Current t261 fixed Lab-only budget and page-aware reorder advice. A's older tree has its own richer choice-order function signature and navigation inference; port only incremental behavior, retaining current t261 tests and scope. A's old API ceiling comparison is unrelated to the desired $0.10 Flash test; it need not gate the next capped run.

## Exact source groups

Core shorthand `R/` means `packages/fluxiq/src/programs/automation-studio/runtime/`; downstream paths are repository-relative.

### A1: per-act instruction authority (w107 + lead fixture)

- `R/action-permissions/instructed.ts`, `action-permissions/tests/instructed.test.ts`.
- `R/service/instruction-authority.ts`, `service/tests/instruction-authority.test.ts` (new).
- `R/flow-bootstrap/action-permissions.ts`, `flow-draft/verify-only.ts`.
- Comment-only dependencies: `R/llm/node-tools/dry-run-gate.ts`, `service/flow-bootstrap-commands/permission-outcome.ts`.
- Integration fixture: `R/tests/service-authoring/tests/confirm-requests-build.test.ts`, fake read answers `acts: { a1: ["none"] }`.
- Architecture: Core `docs/architecture/automation-studio/{llm-flow-bootstrap,flow-authoring}.md` relevant hunks only.
- Per-act answer is non-enumerable array metadata: verify normal stored consequence records still round-trip unchanged. Missing/failing new read treats unanswered acts as lasting; legacy plain-array readers retain quote matching.

### A2: toggle/reversal contract and stale marks/handles (w103/w115)

- Core `R/flow-draft/{reversal.ts,index.ts,step.ts,entry.ts,amendment.ts,dry-run.ts}`; owning tests `{reversal,entry,amendment,dry-run}.test.ts`.
- Core `R/llm/{evidence-loop-decision.ts,evidence-loop.ts,evidence-loop/tool-execution.ts,evidence-loop/call-record.ts}` and `evidence-loop/tests/authored-draft.test.ts`.
- Core `R/llm/node-tools/{step-place,rerun-check}.ts`, tests `{step-place,rerun-check}.test.ts`.
- Domain `domain/src/runtime/llm-evidence/node-run/press-effect/{chosen-state.ts,toggle.ts,choice.ts,index.ts,tests/press-toggle.test.ts}`.
- Domain `.../node-run/{run.ts,written-step.ts,tests/draft-control.test.ts}`, `.../llm-evidence/{capture.ts,stable-handles.ts,tests/stable-handles.test.ts}`.
- Core accepts exactly `draft.toggle {key,to}` only on mutate statements; domain records the canonical target handle and before/after chosen facts. Stable handle fallback matches page/frame/record/tag/words only when unambiguous.
- Stale replay marks cleared on move/rerun; missing actual replay-place token remains partial and is not fixed by this unit.

### A3/B2: mutation observations and completion/checklist

- A `R/result-verification/build-test/{change-lines.ts,summary.ts,index.ts,tests/change-lines.test.ts,tests/summary.test.ts}`.
- A `R/llm/diagnosis-instructions.ts`, `deepseek/tests/system-prompt-pins.json`, `llm/tests/diagnosis-channel.test.ts`.
- A optional/claim unit: `R/flow-bootstrap/instructed-acts/{choice-order,checklist,check,index,claim-doubt,kind-words,optional-only}.ts`, tests `{choice-order,claim-doubt}.test.ts`, fixture `run-musq0b1m-draft.ts`; `R/flow-draft/act-claim.ts`; `R/llm/harness-options/bootstrap-completion.ts` + test.
- B observation owner: `R/result-verification/build-test/{observation.ts,summary.ts,tests/summary.test.ts}`, diagnosis instructions/pins.
- B strips replay outcome restatements and screens remaining mutation evidence; A caps/prioritizes change lines. Retain both protections and quantity proof.

### B1/B3/B4/B5/B8/B11: bounded functional units

- B lasting kinds: `R/flow-bootstrap/action-permissions.ts` + test, verify-only comments. `add_to/save/claim/move/submit` lasting regardless of read quote; `set/open` retain quote matching. Reconcile with A1 rather than replacing it.
- B softened progress: `R/flow-bootstrap/unfinished-build/{contracts,judgement,progress}.ts`, tests `{progress,judgement-value}.test.ts`; `R/result-verification/build-test/judge.ts` + test. `oneCallSaidYes` carries softened split verdict.
- B ending clarity: unfinished-build `{not-finished,not-done,budget-exhausted,replies-unreadable,phases}.ts` plus tests, `conversations/commands/create-here.ts` + execute/judged tests. Public refusal/wording contracts overlap A and other lanes.
- B amendment feedback: `R/flow-draft/{amendment,act-claim}.ts`, `R/llm/draft-amendment-feedback.ts` + tests; `R/llm/decision-handlers/{amendment,types}.ts` + `tests/moved-act-told.test.ts`.
- B amendment signature: `R/llm/evidence-loop/amendment-memory.ts` + `tests/stalled-amendments-replay.test.ts` includes sorted acts and `ranWith` so bind/act-only edits count.
- B own layers: `domain/src/runtime/llm-evidence/node-run/own-layers/{memory,index}.ts` + test; node-run `{press-effect/answered-layer,run,context,index}.ts`; `llm-evidence/tools.ts`; answered-layer/draft-control tests. Kind-recognized consent/promotion/robot/rate-limit/assistant layers never become owned. Serial merge with A's node-run toggle hunk.

### A4: replay tab cleanup and remembered waits

- Domain `domain/src/client/{close-opened-tabs-parameter.ts,index.ts}`, `.../node-run/replay.ts` + replay tests.
- Extension `apps/extension/src/runtime/{fluxiq-opened-tabs.ts,action-runner.ts,browser-tab.ts,click-landing.ts,command-options.ts}`; tests `{fluxiq-opened-tabs,click-landing-new-tab}.test.ts`.
- A Lab also closes leftover scenario tabs before playback (see complete inventory below). Product logic closes only FluxIQ-created tabs and drives their source tab.
- Replay target absent requires selector and identity-word evidence; no-identity step still presses. Lead corrected an earlier overly eager no-click branch. No browser proof of cleanup yet.

## Cross-lane conflict map

| Owner | Reconciliation required |
| --- | --- |
| Core flow-draft amendment/entry/act-claim | A reversal/stale replay marks and B moved-act/feedback wording; also C/D owners. |
| Core action-permissions + verify-only | A per-act/missing-read semantics vs B lasting-kind fallback. |
| Core build-test summary + diagnosis/pins | A bounded change lines/optional-only vs B mutation evidence; C read/paging evidence. |
| Core unfinished-build contracts/phases | A finishing-verdict object vs B oneCallSaidYes/progress/ending; C/D also touch stop semantics. |
| Core activity/UI action contracts | A retains/modifies old draft-edit/refused modules; B deletes/moves them into decision-answer and adds refusal cards. Choose the B structure, port A useful wording rather than restoring deleted modules. |
| Extension composer/pacer/overlay/shared display | A clears composer/removes dwell/1.6s pacing/person-input scroll; B adds start handshake/model thought filtering/placement and different pacing. Merge by hunk and verify both sets separately. |
| Domain node-run/run/tests | A toggle statements vs B owned-layer memory. |
| Architecture docs | Multiple lanes plus t261 budget/current-UI scope. Never copy their older full docs over current ones. |

## Commands and validation contract

No commands below were run by this worker. Execute under the machine heavy wrapper; Core commands from its root use `pnpm.cmd --filter fluxiq exec vitest run` with repository-relative package paths as accepted by that package's script. Use owning directories only; no full sweep.

- A1: vitest `src/programs/automation-studio/runtime/action-permissions/tests/instructed.test.ts`, `.../service/tests/instruction-authority.test.ts`, `.../flow-bootstrap/tests/action-permissions.test.ts`, `.../tests/service-authoring/tests/confirm-requests-build.test.ts`.
- A2: vitest owning `flow-draft/tests`, exact `llm/evidence-loop/tests/authored-draft.test.ts`, `llm/node-tools/tests/{step-place,rerun-check}.test.ts`; domain targeted press-effect, draft-control and stable-handles tests through repository scoped domain test script.
- A3/B2: vitest `result-verification/build-test/tests`, instructed-acts owning tests and `llm/{tests/diagnosis-channel.test.ts,deepseek/tests/system-prompt.test.ts,harness-options/tests/bootstrap-completion.test.ts}`.
- B3/B11: vitest unfinished-build progress/judgement-value, build-test judge, amendment-memory stalled-amendments-replay owning files.
- Typecheck each touched Core/domain/extension package; rebuild Core fluxiq before downstream build. Run both structure audits. Do not repeat the lane leads' 3,000-test broad checks simply to merge a small unit.
- Live A requires all 4 exact cart facts, final whole-Flow judged definition, persisted deterministic playback, honest ending and independent call/spend ledger. A creation pass alone is insufficient. Inspect screenshot checkpoints and new failure debug before relaunch.

## Remaining partial/unimplemented work

- A: no replay-place token on dry-run rows; finishing-verdict confidence/advice absent at judge transfer; chat ending not traced; facility reason remains unclassified; periodic flow-run screenshot tag does not prove execution. Bare Run finished/late start overlay were not fixed in A; B has its own start handshake.
- B: navigation-only act claims; fulfilment-choice parsing; dropped-path child steps; cache collapses; parameters-level consequences handling; display names glued to prices; unsure-ending wording. None is safe to call done.
- Both: newest failed runs un-debugged in named documents; prepared changes uncommitted in old trees. Worker/lead tests are historical claims. This worker did not reproduce any test or inspect screenshot/page content.

## Read coverage

Read continuation Current State/brief, prior handoff A/B sections, both complete round-1003 lead reports, A w103/w106/w107 reports, targeted A Core per-act/reversal/choice diffs, domain toggle/chosen-state/stable-handle diffs, targeted B lasting-kind/mutation-observation/amendment-memory diffs, four dirty-tree inventories, and safe run ending metadata. Broader files are inventoried below, not all semantically reviewed.

## Complete dirty path inventory

The following lists capture `git diff --name-only` and untracked paths for each paired tree at inspection time. They are inventory, not a prescription to copy whole trees. Generated/runtime paths excluded by git policy; no private data captured.


### t174 !FluxIQWebExtension

Tracked modifications/deletions:

```text
apps/extension/src/background/activity/headline.ts
apps/extension/src/background/activity/pacer.ts
apps/extension/src/background/activity/tests/activity-relay.test.ts
apps/extension/src/background/activity/tests/activity-replay.test.ts
apps/extension/src/background/activity/tests/pacer.test.ts
apps/extension/src/content/activity-overlay/index.ts
apps/extension/src/content/activity-overlay/overlay.ts
apps/extension/src/content/activity-overlay/status-dwell.ts
apps/extension/src/content/activity-overlay/tests/overlay.test.ts
apps/extension/src/content/activity-overlay/tests/status-dwell.test.ts
apps/extension/src/panel/chat/conversation/composer.ts
apps/extension/src/panel/chat/conversation/controller.ts
apps/extension/src/panel/chat/conversation/tests/composer-draft.test.ts
apps/extension/src/panel/chat/conversation/tests/composer-owner.test.ts
apps/extension/src/panel/chat/conversation/tests/controller.test.ts
apps/extension/src/panel/chat/stream/step/tests/card-words.test.ts
apps/extension/src/panel/chat/tests/fake-dom.ts
apps/extension/src/panel/chat/tests/navigation-focus.test.ts
apps/extension/src/panel/chat/view/scroll-follower.ts
apps/extension/src/panel/chat/view/tests/action-card-view.test.ts
apps/extension/src/panel/chat/view/tests/scroll-follow.test.ts
apps/extension/src/runtime/action-runner.ts
apps/extension/src/runtime/browser-tab.ts
apps/extension/src/runtime/click-landing.ts
apps/extension/src/runtime/command-options.ts
apps/extension/src/runtime/tests/click-landing-new-tab.test.ts
apps/extension/src/shared/activity/activity-display.ts
apps/extension/src/shared/activity/tests/wording.test.ts
apps/extension/src/shared/activity/wording.ts
docs/architecture/build-loop.md
docs/architecture/extension-client.md
docs/architecture/testing-facility.md
docs/architecture/web-capabilities.md
domain/src/client/index.ts
domain/src/runtime/llm-evidence/capture.ts
domain/src/runtime/llm-evidence/node-run/covered-target.ts
domain/src/runtime/llm-evidence/node-run/press-effect/choice.ts
domain/src/runtime/llm-evidence/node-run/press-effect/index.ts
domain/src/runtime/llm-evidence/node-run/replay.ts
domain/src/runtime/llm-evidence/node-run/run.ts
domain/src/runtime/llm-evidence/node-run/tests/covered-target.test.ts
domain/src/runtime/llm-evidence/node-run/tests/draft-control.test.ts
domain/src/runtime/llm-evidence/node-run/tests/replay.test.ts
domain/src/runtime/llm-evidence/node-run/written-step.ts
domain/src/runtime/llm-evidence/stable-handles.ts
domain/src/runtime/llm-evidence/tests/stable-handles.test.ts
packages/test-contracts/src/evaluation.ts
packages/test-runner/src/existing-fluxiq-control.ts
packages/test-runner/src/flow-lane/creation/build-proposal.ts
packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts
packages/test-runner/src/flow-lane/creation/chat/chat-record.ts
packages/test-runner/src/flow-lane/creation/chat/tests/build-from-chat.test.ts
packages/test-runner/src/flow-lane/creation/lane.ts
packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts
packages/test-runner/src/flow-lane/creation/tests/fake-creation-core.ts
packages/test-runner/src/flow-lane/creation/tests/lane.test.ts
packages/test-runner/src/flow-lane/lane-observation.ts
packages/test-runner/src/flow-lane/tests/lane-observation.test.ts
packages/test-runner/src/lab-runs/tests/write-playback-steps.test.ts
packages/test-runner/src/lab-runs/write-playback-steps.ts
packages/test-runner/src/live-llm/live-llm-run.ts
packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts
packages/test-runner/src/run-scenario.ts
packages/test-runner/src/run-scenario/ui-review/capture-scenario-tab.ts
packages/test-runner/src/run-scenario/ui-review/choose-scenario-tab.ts
packages/test-runner/src/run-scenario/ui-review/count-overlay-changes.ts
packages/test-runner/src/run-scenario/ui-review/index.ts
packages/test-runner/src/run-scenario/ui-review/read-overlay-sample.ts
packages/test-runner/src/run-scenario/ui-review/recorder.ts
packages/test-runner/src/run-scenario/ui-review/schedule.ts
packages/test-runner/src/run-scenario/ui-review/tests/count-overlay-changes.test.ts
packages/test-runner/src/run-scenario/ui-review/tests/read-overlay-sample.test.ts
packages/test-runner/src/run-scenario/ui-review/tests/ui-review-schedule.test.ts
packages/test-runner/src/run-scenario/ui-review/types.ts
packages/test-runner/src/run-scenario/ui-review/write-ui-review-sidecar.ts
packages/test-runner/src/tests/existing-fluxiq-control.test.ts
scripts/lab/live-campaign/row/reported-spend.mjs
scripts/lab/live-campaign/row/tests/reported-spend.test.mjs
```

Untracked authored files:

```text
apps/extension/src/runtime/fluxiq-opened-tabs.ts
apps/extension/src/runtime/tests/fluxiq-opened-tabs.test.ts
docs/working/language-driven-flow-loop-plan/debugs/run-musp8nz1-dbd3905a.md
docs/working/language-driven-flow-loop-plan/debugs/run-musq0b1m-0472cfa0.md
docs/working/language-driven-flow-loop-plan/reports/t174-w115.md
docs/working/language-driven-flow-loop-plan/reports/t174-w119.md
domain/src/client/close-opened-tabs-parameter.ts
domain/src/runtime/llm-evidence/node-run/press-effect/chosen-state.ts
domain/src/runtime/llm-evidence/node-run/press-effect/tests/press-toggle.test.ts
domain/src/runtime/llm-evidence/node-run/press-effect/toggle.ts
packages/test-runner/src/live-llm/call-rows.ts
packages/test-runner/src/live-llm/tests/call-rows.test.ts
packages/test-runner/src/run-scenario/ui-review/screen-overlay-text.ts
packages/test-runner/src/run-scenario/ui-review/tests/choose-scenario-tab.test.ts
reports/t174-lead-1003.md
reports/t174-w103.md
reports/t174-w104.md
reports/t174-w105.md
reports/t174-w106.md
reports/t174-w107.md
reports/t174-w108.md
reports/t174-w109.md
reports/t174-w110.md
reports/t174-w111-ui-musq0b1m.md
reports/t174-w112.md
reports/t174-w113.md
reports/t174-w114.md
reports/t174-w116.md
reports/t174-w117.md
reports/t174-w118.md
reports/t174-w92.md
reports/t174-w93.md
reports/t174-w94.md
reports/t174-w95.md
reports/t174-w96-ui-musp8nz1.md
```


### t174 !FluxIQ

Tracked modifications/deletions:

```text
docs/architecture/automation-studio/flow-authoring.md
docs/architecture/automation-studio/llm-flow-bootstrap.md
packages/fluxiq/src/programs/automation-studio/api/handlers/llm-execution-settings.ts
packages/fluxiq/src/programs/automation-studio/api/handlers/tests/llm-execution-settings.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/instructed.ts
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/tests/instructed.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/build.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/draft-edit.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/observer.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/observer.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/scope.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/wording.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/action.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/draft-edit-refused.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/reason-text.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/reasons.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/wording.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tool-call.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/command.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/create-here.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/explore.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/improve.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/run-flow.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/execute.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/conversations.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/respond.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/tests/respond-to-turn.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/action-permissions.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/check.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/checklist.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/choice-order.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/choice-order.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/contracts.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/phases.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/act-claim.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/amendment.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/dry-run.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/step.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/amendment.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/dry-run.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/verify-only.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/amendment.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt-pins.json
packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/draft-amendment-feedback.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/call-record.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/authored-draft.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tool-execution.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/progress-trace.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/bootstrap-completion.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/dry-run-gate.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/rerun-check.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/step-place.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/rerun-check.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/step-place.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/answer-step.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/tests/answer-step.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/summary.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/summary.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/build-judge.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/permission-outcome.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/build-judge.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/instruction-authority.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap/tests/answerability.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/service-authoring/tests/confirm-requests-build.test.ts
packages/fluxiq/src/ui/activity-action/action-of.ts
packages/fluxiq/src/ui/activity-action/failure-reason.ts
packages/fluxiq/src/ui/activity-action/index.ts
packages/fluxiq/src/ui/activity-action/tests/action-of.test.ts
packages/fluxiq/src/ui/activity-action/tests/failure-reason.test.ts
```

Untracked authored files:

```text
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/decision-words.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/reason-screen.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/site-name.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/tests/site-name.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/claim-doubt.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/kind-words.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/optional-only.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/claim-doubt.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/run-musq0b1m-draft.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/finishing-verdict.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/finishing-verdict.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/reversal.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/reversal.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/tests/amendment-told.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/build-trace.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/tests/build-trace.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/change-lines.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/change-lines.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/tests/instruction-authority.test.ts
```


### t193 !FluxIQWebExtension

Tracked modifications/deletions:

```text
apps/extension/src/background/activity/activity-relay.ts
apps/extension/src/background/activity/index.ts
apps/extension/src/background/activity/pacer.ts
apps/extension/src/background/activity/tests/pacer.test.ts
apps/extension/src/background/connection.ts
apps/extension/src/background/panel/panel-control-deps.ts
apps/extension/src/background/panel/panel-control.ts
apps/extension/src/background/panel/tests/panel-control.test.ts
apps/extension/src/content/activity-overlay/content-message.ts
apps/extension/src/content/activity-overlay/index.ts
apps/extension/src/content/activity-overlay/overlay.ts
apps/extension/src/content/activity-overlay/placement/anchor-style.ts
apps/extension/src/content/activity-overlay/placement/choose-placement.ts
apps/extension/src/content/activity-overlay/placement/page-probe.ts
apps/extension/src/content/activity-overlay/placement/placement-keeper.ts
apps/extension/src/content/activity-overlay/placement/tests/choose-placement.test.ts
apps/extension/src/content/activity-overlay/status-pill.ts
apps/extension/src/content/activity-overlay/tests/content-message.test.ts
apps/extension/src/content/activity-overlay/tests/overlay.test.ts
apps/extension/src/panel/chat/conversation/composer.ts
apps/extension/src/panel/chat/conversation/tests/composer-draft.test.ts
apps/extension/src/panel/chat/conversation/tests/composer-owner.test.ts
apps/extension/src/panel/chat/stream/step/action-card.ts
apps/extension/src/panel/chat/stream/step/card-words.ts
apps/extension/src/panel/chat/stream/step/tests/card-words.test.ts
apps/extension/src/panel/chat/stream/step/tests/messages.test.ts
apps/extension/src/shared/activity/activity-display.ts
apps/extension/src/shared/activity/index.ts
docs/architecture/build-loop.md
docs/architecture/extension-client.md
domain/src/runtime/llm-evidence/node-run/context.ts
domain/src/runtime/llm-evidence/node-run/index.ts
domain/src/runtime/llm-evidence/node-run/press-effect/answered-layer.ts
domain/src/runtime/llm-evidence/node-run/press-effect/tests/answered-layer.test.ts
domain/src/runtime/llm-evidence/node-run/run.ts
domain/src/runtime/llm-evidence/node-run/tests/draft-control.test.ts
domain/src/runtime/llm-evidence/tools.ts
```

Untracked authored files:

```text
apps/extension/src/background/activity/send-answer.ts
apps/extension/src/background/activity/send-start.ts
apps/extension/src/background/activity/tests/send-answer.test.ts
apps/extension/src/background/activity/tests/send-start.test.ts
apps/extension/src/content/activity-overlay/model-prose.ts
apps/extension/src/shared/activity/model-thought.ts
apps/extension/src/shared/activity/tests/model-thought.test.ts
docs/working/language-driven-flow-loop-plan/debugs/run-musp4h2f-72e8ed99.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w1-debug-run1.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w10-core-leftovers-and-docs.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w11-overlay-from-send-and-docs.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w2-lasting-acts-by-kind.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w3-replayed-press-observed.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w4-judge-softened-progress.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w5-amendment-answers.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w6-chat-refusals-and-claims.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w7-composer-overlay-labels.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w8-own-layer-not-interruption.md
docs/working/language-driven-flow-loop-plan/reports/t193-1003-w9-unfinished-ending-words.md
docs/working/language-driven-flow-loop-plan/reports/t193-lead-1003.md
domain/src/runtime/llm-evidence/node-run/own-layers/index.ts
domain/src/runtime/llm-evidence/node-run/own-layers/memory.ts
domain/src/runtime/llm-evidence/node-run/own-layers/tests/memory.test.ts
```


### t193 !FluxIQ

Tracked modifications/deletions:

```text
docs/architecture/automation-studio/client-gateway.md
docs/architecture/automation-studio/flow-authoring.md
docs/architecture/automation-studio/llm-flow-bootstrap.md
docs/reference/framework-reference.md
packages/fluxiq/docs/reference/framework-reference.md
packages/fluxiq/src/programs/automation-studio/runtime/activity/draft-edit.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/observer.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/observer.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/decision.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/draft-edit-refused.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/reasons.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/create-here.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/execute.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/action-permissions.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/budget-exhausted.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/contracts.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/judgement.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/not-doable.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/not-done.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/not-finished.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/phases.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/progress.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/replies-unreadable.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/budget-exhausted.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/judged.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/judgement-value.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/not-done.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/not-finished.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/phases.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/replies-unreadable.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/reserve-judging.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/act-claim.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/amendment.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/act-claim.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/amendment.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/verify-only.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/amendment.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/types.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt-pins.json
packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/draft-amendment-feedback.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/amendment-memory.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/authored-draft.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/stalled-amendments-replay.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/dry-run-gate.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/run-node.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/run-node.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/agreement.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/judge.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/observation.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/summary.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/judge.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/summary.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/check-activity.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/check-activity.test.ts
packages/fluxiq/src/ui/activity-action/action-of.ts
packages/fluxiq/src/ui/activity-action/index.ts
packages/fluxiq/src/ui/activity-action/names.ts
packages/fluxiq/src/ui/activity-action/record.ts
packages/fluxiq/src/ui/activity-action/tests/names.test.ts
packages/fluxiq/src/ui/activity-action/types.ts
```

Untracked authored files:

```text
packages/fluxiq/src/programs/automation-studio/runtime/activity/decision-answer/draft-edit.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/decision-answer/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/decision-answer/refused-call.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/in-build.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/refused-call.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/draft-edit-card.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/ending-fit.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/ending-never-cut.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/progress.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/tests/moved-act-told.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/unsettled/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/unsettled/unsettled-words.ts
packages/fluxiq/src/ui/activity-action/refusal-words.ts
packages/fluxiq/src/ui/activity-action/refusal.ts
packages/fluxiq/src/ui/activity-action/tests/refusal.test.ts
```

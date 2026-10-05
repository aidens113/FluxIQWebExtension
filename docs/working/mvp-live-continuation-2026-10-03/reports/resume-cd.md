# C/D lane resumption inventory

Status: Complete (read-only reconciliation; source acceptance and live retests pending)
Date: 2026-10-03
Worker: resume-cd
Scope: t194/t195 paired trees; only this report was written. No tests, provider calls, process management, environment edits, source edits, staging or commits.

## Current State

- C's latest documented run is closed: `run-mustvzvg-99695308`, failed/no Flow, $0.053622012 (27 build/judge calls plus chat; build accounting counts 25 decisions and includes judge spend). Earlier `run-musp39u8-9ac026ab` produced the correct 13 ordered records/52 fields but was falsely refuted; total $0.185891 across build, judgement and reauthor phases. These are historical artifact-debug measurements, not fresh supervisor validation.
- D's latest documented run is closed: `run-musr9pv3-f4bf6256`, no Flow/no playback, 75 total calls, $0.086979594. Core used 73 decisions across two rounds under $0.10; Lab rejected `performance.budget` because configured 64 calls is aggregate while Core's maxIterations is per round. Do not remove the Lab guard or call this a machine/load defect.
- C has coherent first-wave fixes plus w85/w86. It still lacks the actual initial pagination/default-bound clarification that caused run 2. w86 repairs a misplaced bound; it does not change `paginate:true` resolving to the detected one-page proposal.
- D w49's report is stale against source: it describes runtime route enforcement as blocked, but **w50-labelled source is already present**, including service wiring, async handler, route refusal union and three provider-free service tests. No w50 completion report exists in the inspected downstream report directory. Treat implementation as prepared/unverified, not absent or accepted.
- All lane changes remain dirty/uncommitted. t261 changed Core bootstrap architecture prose, ordinary/test budgets and instructed-choice feedback; preserve those dev changes when integrating older lane bases.

## Recommended integration order

1. For the first add-to-cart rerun, take only independently reviewed A/B blockers. C's provider/transport-only reauthor retry can follow as a small generic cost-waste fix if repair is reachable. Neither all C nor all D is prerequisite for A.
2. C first: result-verification paging words and provider/transport-only reauthor retry. Their main algorithms have small seams and recorded failing-first tests. Reconcile any shared check-activity wording from B separately.
3. C carried replay/join seeding: integrate its whole coherent source group, not just a misleading prompt change. Ensure changed/bound steps lose seed status and undeclared controls remain unseeded. Then import w85 rerun feedback serially with D's async route/rerun changes.
4. D row-aware assert plus stable rerun numbering; then repeat amendment grammar/revalidation/shown-number semantics, routing refusal words, and no-change repeat guards as one serial Core authoring unit. These groups share amendment/refusal/evidence-loop seams.
5. Complete D route group from the existing w50 source, retaining its shared memoized reading and no extra read when the start stays unchanged. Review fail-open reading behavior and standalone travel drops (below). Prompt/schema alone is insufficient.
6. Before C live retry, add the missing explicit pagination-bound behavior/wording regression: a handle with detected maxPages=1, `paginate:true`, and an every-page request must expose why only one page was read and exact `paginate.maxPages` correction. Preserve bounded exploration; do not simply raise every detection bound globally.
7. Re-run narrow owner checks and paired structure audits on frozen integrated source, rebuild Core exports before downstream checks, then use fresh isolated lane/slot and capped Flash. Debug each failure before changed-source retry.

## Exact coherent file groups

Paths below use Core prefix `R = packages/fluxiq/src/programs/automation-studio/runtime/`; downstream paths retain package roots. The complete dirty-file inventories and cross-lane overlaps follow later.

### C paging judgement, w73

- R/result-verification/read-account/{judge-paging.ts,index.ts,sentence.ts,tests/judge-paging.test.ts}; R/result-verification/{verify.ts,tests/judge-sees-the-read.test.ts}; R/llm/diagnosis-instructions.ts and its diagnosis-channel test/prompt pins.
- Source inspected: `verify.ts` now wraps the summary with paging words before unread-column wording. List-ended evidence omits the misleading pageLimit in the judge copy; it keeps the underlying runtime account unchanged. Validate page_limit remains a true truncation, disabled-next/list-ended does not become a guessed yes.

### C carried steps and joins, w72

- R/llm/node-tools/{draft-from-flow.ts,dry-run-gate.ts,run-flow-part.ts,tests/draft-from-flow.test.ts,tests/dry-run-gate.test.ts,tests/carried-as-stored.test.ts}. Filename verified directly in the untracked inventory.
- R/flow-draft/{full-run-required.ts,tests/full-run-required.test.ts}; R/flow-bootstrap/unfinished-build/not-run.ts; R/llm/evidence-loop/{resume.ts,tests/resume.test.ts}; R/recovery/refuted-result/{brief.ts,reauthor.ts,tests/brief-rerun-carried.test.ts,tests/brief.test.ts}.
- Carried nodes with declaredConsequences get stored ranWith and recorded start-page replay; carried merge joins are answered in Core. Must reconcile B/A done-act checking and D run-flow-part effect accounting instead of overwriting it.

### C retry/spend/trace, w74/w82

- R/service/runtime-adaptation/{reauthor-build.ts,tests/reauthor-build.test.ts,tests/refuted-result-port.test.ts}; R/tests/refuted-result/tests/repair-purse-chain.test.ts; R/llm/evidence-progress/{progress-trace.ts,tests/progress-trace.test.ts}.
- Downstream packages/test-runner/src/live-llm/{reauthor-record.ts,index.ts,tests/reauthor-record.test.ts,tests/live-llm-run.test.ts,tests/run-spend.test.ts}; lab-runs/{write-playback-steps.ts,tests/write-playback-steps.test.ts}.
- Source inspected: retryable alone no longer repeats an exhausted/unchanged build. Immediate second try only provider_unavailable or eligible pre-provider/provider transport stage; try2 recorded separately, start/end traced. This directly removes the repeated failed same-brief repair.

### C rerun kept-key feedback, w85

- R/llm/evidence-loop/{rerun-input.ts,rerun-request.ts,tests/rerun-input.test.ts,tests/rerun-request.test.ts}; R/llm/decision-handlers/amendment.ts.
- Reports observed failing-first3 tests, final owner union250 tests, check/audit green; not rerun here. It retains RFC7386 merge semantics and adds core.rerun_check only after refused/failed reruns, naming retained paths and explicit null-removal patch.
- Replace the local `RerunHeldWithKept` cast with optional typed `kept` in decision-handlers/types.ts during serial integration if warranted; existing edge case may issue a note after a successful checked done-act rerun because old step evidence was refused. Add regression before accepting that branch.
- C4 false 'already ran/result stands' wording for a failed step is **not fixed** by this group: C's draft-amendment-feedback.ts is unmodified. D's changes_nothing prose also still assumes a result. Fix disposition-sensitive wording separately.

### C extraction bound placement, w86

- domain/src/runtime/llm-evidence/plan-resolution/extraction/{slot.ts,tests/slot.test.ts}; plan-resolution/{resolve-plan-node.ts,tests/resolve-plan-node.test.ts}.
- Source inspected: only maxPages/maxScrolls are lifted beside paginate when paging exists; same duplicate accepted, conflicting values refused at both paths, paginate:false refused with exact nested-shape hint. Literal non-handle path not changed. Add absent-paginate/no-detected-pagination test; worker did not cover it.
- **Still pending:** apps/extension/src/content/extraction/detect-pagination.ts `PROPOSED_MAX_PAGES=1`; slot.ts keptPagination returns detected unchanged for absent/true; grammar does not document accepted true, read truncation sentence lacks exact nested correction. w86 cannot prove all-page read fixed.

### D row-scoped checks, w40

- apps/extension/src/content/actions/{assert.ts,tests/assert.test.ts}; content/action-runtime/tests/resolve-target.test.ts.
- Source group independent of Core rerun changes. Asserts with non-empty element.context.record.values resolve through deps.resolveTarget, as row actions do; unscoped asserts keep old behavior. Historical run2 shows absent Amara control as already-done while Lin/Freya are checked, not clicked. Whole-Flow result still failed.

### D rerun numbering/receipts, w41

- R/llm/evidence-loop/{rerun-replacement.ts,rerun-request.ts,tests/rerun-replacement.test.ts,tests/rerun-request.test.ts,tests/held-amendments.test.ts}; R/flow-draft/{step.ts,amendment.ts,entry.ts,tests/amendment.test.ts,tests/entry.test.ts}; R/llm/{draft-amendment-feedback.ts,tests/draft-amendment-feedback.test.ts}; R/tests/service-bootstrap/tests/extend.test.ts; R/tests/deepseek-bootstrap/tests/observation.ts.
- Source inspected rerun replacement: replacement gets original position, old attempt moves to end with replacedBy. Changing the wrong receipt names its replacement instead of silently refusing an already-result call.

### D repeat repair and unchanged-run guard, w45/w46

- R/flow-draft/{amendment.ts,routing.ts,entry.ts,tests/amendment.test.ts,tests/routing.test.ts,tests/entry.test.ts}; R/flow-bootstrap/evidence-loop-steps.ts; R/llm/{draft-amendment-feedback.ts,tests/draft-amendment-feedback.test.ts,tests/evidence-loop.test.ts}; R/activity/wording/{draft-edit-refused.ts,tests/reasons.test.ts}.
- R/llm/repeat-guard/{draft-key.ts,index.ts,outcomes.ts,feedback.ts,tests/outcomes.test.ts}; R/llm/evidence-loop.ts; R/llm/evidence-loop/tests/repeat-guard.test.ts; R/llm/node-tools/run-flow-part.ts.
- 'always' clears run condition; a move revalidates repeat source/span; all numbers refer to the shown pre-decision draft and renumber once. same_draft keys tool+input+page+Flow signature, refuses identical no-change runs; run-flow-part effectApplied requires a mutating step. Reads/checks no longer falsely count as page mutation.
- w46 audit/type errors arose during concurrent workers and were later cleared by w45/w49's reports. Those later passes are claims, not supervisor acceptance; freeze and rerun owners.

### D stopped-round judging, row logs, completion guidance, w42/w43/w47

- R/flow-bootstrap/unfinished-build/{phases.ts,reserve-judging.ts,judgement.ts,tests/judge-stopped-round.test.ts}; tests in that directory and service-bootstrap expectations.
- R/llm/step-log/{scope.ts,tool-step.ts,tests/tool-step.test.ts}; R/llm/node-tools/{replay-span.ts,tests/replay-span-step-log.test.ts}.
- R/flow-bootstrap/authoring/{draft-routing.ts,instruction-record-columns.ts,tests/draft-routing.test.ts,tests/instruction-record-columns.test.ts}; R/llm/harness-options/{bootstrap-completion.ts,draft-acts.ts,tests/bootstrap-completion.test.ts,tests/draft-acts.test.ts}; R/llm/deepseek/{request-body.ts,tests/request-body.test.ts}.
- Changed clean stopped-round test is judged only when completion can build the Flow. The invalid stray-repeat round2 correctly stayed unjudged. Record pass/of/screened row label, not row contents. New-read-after-act guidance leaves loop listing before act.
- Cleaner routing prose carry is adding six draft-routing codes to flow-bootstrap/plan/issue-feedback.ts AUTHORED_CODES, rather than retaining bootstrap-completion.ts's local remap workaround. Make this a reviewed focused change, not unexplained additional import.

### D named-route rule, w49 plus newer w50 source

- R/action-permissions/{instruction-quote.ts,instruction-route.ts,instructed.ts,index.ts,tests/instruction-route.test.ts}; R/service/{instruction-authority.ts,tests/instruction-authority.test.ts}.
- R/flow-draft/{amendment.ts,entry.ts,tests/entry.test.ts}; R/llm/{decision-handlers/amendment.ts,evidence-loop.ts,loop-configuration.ts,decision-context/shown.ts,harness/task-request.ts,harness/context-packet.ts,draft-amendment-feedback.ts,tests/draft-amendment-feedback.test.ts}; R/llm/evidence-loop/{rerun-request.ts,tests/rerun-request.test.ts}; R/llm/deepseek/{request-body.ts,tests/request-body.test.ts}; R/flow-bootstrap/evidence-loop-steps.ts; R/activity/wording/{draft-edit-refused.ts,tests/reasons.test.ts}; R/service.ts; R/tests/service-authoring/tests/route-named-build.test.ts.
- Direct rg/source inspection confirms actual production callers authority.route/routeRead, instructionRoute, startRoute; handler async and awaited by loop; route_named closed union with quoted route; route-safe prompt and shown draft after reading.
- Three scripted service tests exist: named route keeps travel/refuses deep rerun; open route allows deep start and travel drops; unchanged start never reads. No w50 report or validation output was found. No live model quoted route yet.
- Review two limits before declaring instruction preservation complete: routeOf converts failed reading to undefined (shortcut allowed, prompt caveat remains); a standalone drop of an intermediate travel step does not change first step and may not call the route reader. Existing described gate protects start-movement and companion drops, not necessarily all independent route erasures.

## UI/record groups and remaining findings

- C extension: pacer/unit-situation, chat composer/controller/core-thread/outgoing-turn and owner tests, card words/messages/view/thread/action-card tests; Core activity observer/draft-edit/run, completion-refusal/reason-text/run-ending wording, check-activity/check-words, UI failure-reason; Lab picture timing, reauthor traces, answer folders.
- D extension: headline/its new test, shared activity-display; Core create-here/execute/extension-chat tests, unfinished-build not-done/not-finished and string-pinning tests.
- Do not let D's older architecture file overwrite t261's Lab-only .10/ordinary .25 clarification. Merge authored doc hunks; regenerate references if needed via owning generator.
- Open C UI: absent overlay first second; missing counts beside claimed all-pages read; detect card label leakage; internal repair words/numbers; clipped status; missing final test cards/no result-or-blocker ending; 'Sending your message' under bubble. Artifacts do not prove why test cards disappeared.
- Open D UI: repeated row cards do not identify row; remaining budget/reply wording names internals. Keep these tracked separately from functional failure.
- Open evidence defects: C failed-build decision-trace adaptations empty and Core log lacks test2/end lines; aggregate call count excludes judges despite cost including them. D Lab performance verdict masks Core ending in evaluation. Preserve both authority and evaluation rather than changing budgets to hide failures.

## Exact regression command families (recommendations, not run)

From paired Core packages/fluxiq, replace R paths with `src/programs/automation-studio/runtime/`:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/read-account src/programs/automation-studio/runtime/result-verification/tests/judge-sees-the-read.test.ts
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-build.test.ts src/programs/automation-studio/runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts src/programs/automation-studio/runtime/tests/refuted-result/tests/repair-purse-chain.test.ts
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/node-tools src/programs/automation-studio/runtime/flow-draft/tests/full-run-required.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/resume.test.ts src/programs/automation-studio/runtime/recovery/refuted-result
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-request.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-input.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-replacement.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/held-amendments.test.ts src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/repeat-guard src/programs/automation-studio/runtime/llm/evidence-loop/tests/repeat-guard.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/draft-routing.test.ts
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/llm/step-log/tests/tool-step.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/replay-span-step-log.test.ts
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/action-permissions src/programs/automation-studio/runtime/service/tests/instruction-authority.test.ts src/programs/automation-studio/runtime/tests/service-authoring/tests/route-named-build.test.ts src/programs/automation-studio/runtime/llm/deepseek/tests/request-body.test.ts src/programs/automation-studio/runtime/tests/deepseek-bootstrap
```

Typecheck from Core root via heavy wrapper: `pnpm --filter fluxiq check`. Rebuild changed Core libraries before downstream consumers. No repository narrow-tests.mjs exists; current package test scripts discover every test, so do not use them for a narrow merge gate. Use esbuild on explicit owner entries with the exact existing runner settings, then Node test on those generated bundles:

From downstream `domain/`:

```powershell
pnpm.cmd exec esbuild src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts src/runtime/llm-evidence/plan-resolution/tests/resolve-plan-node.test.ts --bundle --platform=node --target=node22 --format=esm --external:fluxiq --external:fluxiq/* --external:@fluxiq/client-gateway-websocket --external:@fluxiq/client-gateway-websocket/* --outbase=src --outdir=.test-build-scratch/t262-cd --out-extension:.js=.mjs --sourcemap=linked
node --enable-source-maps --test .test-build-scratch/t262-cd/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.mjs .test-build-scratch/t262-cd/runtime/llm-evidence/plan-resolution/tests/resolve-plan-node.test.mjs
```

From downstream `apps/extension/`:

```powershell
pnpm.cmd exec esbuild src/content/actions/tests/assert.test.ts src/content/action-runtime/tests/resolve-target.test.ts --bundle --platform=node --target=node22 --format=esm --external:fluxiq --external:fluxiq/* --external:@fluxiq/client-gateway-websocket --external:@fluxiq/client-gateway-websocket/* --outbase=src --outdir=.test-build-scratch/t262-cd --out-extension:.js=.mjs --sourcemap=linked
node --enable-source-maps --test .test-build-scratch/t262-cd/content/actions/tests/assert.test.mjs .test-build-scratch/t262-cd/content/action-runtime/tests/resolve-target.test.mjs
```

Use a fresh per-unit label and only explicit bundles, so stale entries are never discovered. Package typechecks from downstream root: `pnpm.cmd --filter @fluxiq-web-extension/domain check`, `pnpm.cmd --filter @fluxiq-web-extension/extension check`. For Lab record changes build touched runner once (`pnpm.cmd --filter @fluxiq-web-extension/test-runner build`), then from its package:

```powershell
node --test dist/live-llm/tests/reauthor-record.test.js dist/live-llm/tests/live-llm-run.test.js dist/live-llm/tests/run-spend.test.js dist/lab-runs/tests/write-playback-steps.test.js
```

Commands are recommendations only; esbuild settings verified against existing package scripts, tests not executed by this worker.

Both roots: `node scripts/structure-audit.mjs`; `git diff --check`. No whole package vitest/root check sweep today.

## Validation performed by this worker

Read Current State/brief, prior handoff, C/D leads, w85/w86/w87, D w45/w46/w47/w48/w49 and latest debugs; inspected bounded dirty source diffs and rg for unresolved pagination/default, actual w50 production route callers, rerun replacement and mutating-only part-run accounting. Inventoried all modified/untracked authored/source/test files and computed overlap with A/B read-only. No tests or live artifacts were rerun. Report claims remain distinct from implementation review and supervisor verification.

## Complete dirty-file inventory: !FluxIQ

### t194: 69 files

```text
packages/fluxiq/src/programs/automation-studio/runtime/activity/draft-edit.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/observer.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/run.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/observer.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/scope.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/completion-refusal.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/draft-edit-refused.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/reason-text.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/run-ending.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/reasons.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/run-ending.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/not-run.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/full-run-required.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/full-run-required.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/amendment.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt-pins.json
packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/completion-attempt.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/decision-refusal.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/rerun-input.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/rerun-request.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/resume.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/completion-attempt.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-input.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-request.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/resume.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/trace.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/progress-trace.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/tests/progress-trace.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/draft-from-flow.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/dry-run-gate.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/run-flow-part.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/carried-as-stored.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/draft-from-flow.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/dry-run-gate.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/feedback.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/outcomes.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/tests/feedback.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/tests/outcomes.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/answer-step.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/tests/answer-feedback.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/unusable-decision.ts
packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/brief.ts
packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/reauthor.ts
packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/tests/brief-rerun-carried.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/tests/brief.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/check-activity.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/check-words.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/judge-paging.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/sentence.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/tests/judge-paging.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/check-activity.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/judge-sees-the-read.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verify.ts
packages/fluxiq/src/programs/automation-studio/runtime/service.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/reauthor-build.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-build.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/repair-purse-chain.test.ts
packages/fluxiq/src/ui/activity-action/failure-reason.ts
packages/fluxiq/src/ui/activity-action/tests/action-of.test.ts
packages/fluxiq/src/ui/activity-action/tests/failure-reason.test.ts
```

Overlaps (same file requires serial integration; file overlap does not imply hunk conflict):

- t174: 20 files.

```text
R/activity/draft-edit.ts
R/activity/observer.ts
R/activity/tests/observer.test.ts
R/activity/tests/scope.test.ts
R/activity/wording/draft-edit-refused.ts
R/activity/wording/reason-text.ts
R/activity/wording/tests/reasons.test.ts
R/llm/decision-handlers/amendment.ts
R/llm/deepseek/tests/system-prompt-pins.json
R/llm/diagnosis-instructions.ts
R/llm/evidence-loop-decision.ts
R/llm/evidence-loop.ts
R/llm/evidence-progress/progress-trace.ts
R/llm/node-tools/dry-run-gate.ts
R/llm/step-log/answer-step.ts
R/llm/tests/diagnosis-channel.test.ts
R/service.ts
packages/fluxiq/src/ui/activity-action/failure-reason.ts
packages/fluxiq/src/ui/activity-action/tests/action-of.test.ts
packages/fluxiq/src/ui/activity-action/tests/failure-reason.test.ts
```

- t193: 14 files.

```text
R/activity/draft-edit.ts
R/activity/observer.ts
R/activity/tests/observer.test.ts
R/activity/wording/draft-edit-refused.ts
R/activity/wording/index.ts
R/activity/wording/tests/reasons.test.ts
R/llm/decision-handlers/amendment.ts
R/llm/deepseek/tests/system-prompt-pins.json
R/llm/diagnosis-instructions.ts
R/llm/evidence-loop-decision.ts
R/llm/evidence-loop.ts
R/llm/node-tools/dry-run-gate.ts
R/result-verification/check-activity.ts
R/result-verification/tests/check-activity.test.ts
```

- t195: 11 files.

```text
R/activity/wording/draft-edit-refused.ts
R/activity/wording/tests/reasons.test.ts
R/llm/decision-handlers/amendment.ts
R/llm/evidence-loop.ts
R/llm/evidence-loop/rerun-request.ts
R/llm/evidence-loop/tests/rerun-request.test.ts
R/llm/node-tools/run-flow-part.ts
R/llm/repeat-guard/feedback.ts
R/llm/repeat-guard/outcomes.ts
R/llm/repeat-guard/tests/outcomes.test.ts
R/service.ts
```

### t195: 77 files

```text
docs/architecture/automation-studio/llm-flow-bootstrap.md
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/instructed.ts
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/instruction-quote.ts
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/instruction-route.ts
packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/tests/instruction-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/draft-edit-refused.ts
packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/reasons.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/create-here.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/execute.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/draft-routing.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/instruction-record-columns.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/draft-routing.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/instruction-record-columns.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/catalog.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/contracts.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/judgement.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/not-done.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/not-finished.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/phases.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/reserve-judging.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/judge-stopped-round.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/judged.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/no-progress-ending.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/not-done.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/not-finished.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/phases.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/repair-rounds.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/unchanged-complete.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/amendment.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/routing.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/step.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/amendment.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/routing.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/shown.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/amendment.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/request-body.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/request-body.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/draft-amendment-feedback.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/rerun-replacement.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/rerun-request.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/held-amendments.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/repeat-guard.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-replacement.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/rerun-request.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/bootstrap-completion.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/draft-acts.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/draft-acts.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/context-packet.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/task-request.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/loop-configuration.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/replay-span.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/run-flow-part.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/replay-span-step-log.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/draft-key.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/feedback.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/outcomes.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/tests/outcomes.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/scope.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/tests/tool-step.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/tool-step.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/instruction-authority.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/tests/instruction-authority.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap/tests/observation.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/service-authoring/tests/route-named-build.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/unfinished-build.test.ts
```

Overlaps (same file requires serial integration; file overlap does not imply hunk conflict):

- t174: 22 files.

```text
docs/architecture/automation-studio/llm-flow-bootstrap.md
R/action-permissions/instructed.ts
R/activity/wording/draft-edit-refused.ts
R/activity/wording/tests/reasons.test.ts
R/conversations/commands/create-here.ts
R/conversations/commands/tests/execute.test.ts
R/conversations/commands/tests/extension-chat.test.ts
R/flow-bootstrap/unfinished-build/phases.ts
R/flow-draft/amendment.ts
R/flow-draft/entry.ts
R/flow-draft/step.ts
R/flow-draft/tests/amendment.test.ts
R/flow-draft/tests/entry.test.ts
R/llm/decision-handlers/amendment.ts
R/llm/draft-amendment-feedback.ts
R/llm/evidence-loop.ts
R/llm/harness-options/bootstrap-completion.ts
R/llm/harness-options/tests/bootstrap-completion.test.ts
R/llm/tests/draft-amendment-feedback.test.ts
R/service.ts
R/service/instruction-authority.ts
R/service/tests/instruction-authority.test.ts
```

- t193: 22 files.

```text
docs/architecture/automation-studio/llm-flow-bootstrap.md
R/activity/wording/draft-edit-refused.ts
R/activity/wording/tests/reasons.test.ts
R/conversations/commands/create-here.ts
R/conversations/commands/tests/execute.test.ts
R/flow-bootstrap/evidence-loop-steps.ts
R/flow-bootstrap/unfinished-build/judgement.ts
R/flow-bootstrap/unfinished-build/not-done.ts
R/flow-bootstrap/unfinished-build/not-finished.ts
R/flow-bootstrap/unfinished-build/phases.ts
R/flow-bootstrap/unfinished-build/tests/judged.test.ts
R/flow-bootstrap/unfinished-build/tests/not-done.test.ts
R/flow-bootstrap/unfinished-build/tests/not-finished.test.ts
R/flow-bootstrap/unfinished-build/tests/phases.test.ts
R/flow-draft/amendment.ts
R/flow-draft/entry.ts
R/flow-draft/tests/amendment.test.ts
R/flow-draft/tests/entry.test.ts
R/llm/decision-handlers/amendment.ts
R/llm/draft-amendment-feedback.ts
R/llm/evidence-loop.ts
R/llm/tests/draft-amendment-feedback.test.ts
```

- t194: 11 files.

```text
R/activity/wording/draft-edit-refused.ts
R/activity/wording/tests/reasons.test.ts
R/llm/decision-handlers/amendment.ts
R/llm/evidence-loop.ts
R/llm/evidence-loop/rerun-request.ts
R/llm/evidence-loop/tests/rerun-request.test.ts
R/llm/node-tools/run-flow-part.ts
R/llm/repeat-guard/feedback.ts
R/llm/repeat-guard/outcomes.ts
R/llm/repeat-guard/tests/outcomes.test.ts
R/service.ts
```


## Complete dirty-file inventory: !FluxIQWebExtension

### t194: 32 files

```text
apps/extension/src/background/activity/pacer.ts
apps/extension/src/background/activity/tests/pacer.test.ts
apps/extension/src/background/activity/unit-situation.ts
apps/extension/src/panel/chat/chat.css
apps/extension/src/panel/chat/conversation/composer.ts
apps/extension/src/panel/chat/conversation/controller.ts
apps/extension/src/panel/chat/conversation/core-thread.ts
apps/extension/src/panel/chat/conversation/tests/composer-draft.test.ts
apps/extension/src/panel/chat/conversation/tests/composer-owner.test.ts
apps/extension/src/panel/chat/conversation/tests/outgoing-turn.test.ts
apps/extension/src/panel/chat/stream/step/card-words.ts
apps/extension/src/panel/chat/stream/step/tests/messages.test.ts
apps/extension/src/panel/chat/view/message-view.ts
apps/extension/src/panel/chat/view/tests/action-card-view.test.ts
apps/extension/src/panel/chat/view/tests/thread-view.test.ts
apps/extension/src/panel/chat/view/thread-view.ts
domain/src/runtime/llm-evidence/node-run/run.ts
domain/src/runtime/llm-evidence/node-run/tests/unwritten-consequences.test.ts
domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts
domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts
domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts
domain/src/runtime/llm-evidence/plan-resolution/tests/resolve-plan-node.test.ts
domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts
domain/src/runtime/llm-evidence/tool-rejection.ts
packages/test-runner/src/lab-runs/tests/write-playback-steps.test.ts
packages/test-runner/src/lab-runs/write-playback-steps.ts
packages/test-runner/src/live-llm/index.ts
packages/test-runner/src/live-llm/reauthor-record.ts
packages/test-runner/src/live-llm/tests/live-llm-run.test.ts
packages/test-runner/src/live-llm/tests/reauthor-record.test.ts
packages/test-runner/src/live-llm/tests/run-spend.test.ts
packages/test-runner/src/run-scenario/ui-review/recorder.ts
```

Overlaps (same file requires serial integration; file overlap does not imply hunk conflict):

- t174: 11 files.

```text
Ext/background/activity/pacer.ts
Ext/background/activity/tests/pacer.test.ts
Ext/panel/chat/conversation/composer.ts
Ext/panel/chat/conversation/controller.ts
Ext/panel/chat/conversation/tests/composer-draft.test.ts
Ext/panel/chat/conversation/tests/composer-owner.test.ts
Ext/panel/chat/view/tests/action-card-view.test.ts
domain/src/runtime/llm-evidence/node-run/run.ts
Lab/lab-runs/tests/write-playback-steps.test.ts
Lab/lab-runs/write-playback-steps.ts
Lab/run-scenario/ui-review/recorder.ts
```

- t193: 8 files.

```text
Ext/background/activity/pacer.ts
Ext/background/activity/tests/pacer.test.ts
Ext/panel/chat/conversation/composer.ts
Ext/panel/chat/conversation/tests/composer-draft.test.ts
Ext/panel/chat/conversation/tests/composer-owner.test.ts
Ext/panel/chat/stream/step/card-words.ts
Ext/panel/chat/stream/step/tests/messages.test.ts
domain/src/runtime/llm-evidence/node-run/run.ts
```

- t195: 1 files.

```text
Ext/background/activity/tests/pacer.test.ts
```

### t195: 10 files

```text
apps/extension/src/background/activity/headline.ts
apps/extension/src/background/activity/tests/headline.test.ts
apps/extension/src/background/activity/tests/pacer.test.ts
apps/extension/src/content/action-runtime/tests/resolve-target.test.ts
apps/extension/src/content/actions/assert.ts
apps/extension/src/content/actions/tests/assert.test.ts
apps/extension/src/shared/activity/activity-display.ts
docs/architecture/build-loop.md
docs/architecture/extension-client.md
docs/architecture/testing-facility.md
```

Overlaps (same file requires serial integration; file overlap does not imply hunk conflict):

- t174: 6 files.

```text
Ext/background/activity/headline.ts
Ext/background/activity/tests/pacer.test.ts
Ext/shared/activity/activity-display.ts
docs/architecture/build-loop.md
docs/architecture/extension-client.md
docs/architecture/testing-facility.md
```

- t193: 4 files.

```text
Ext/background/activity/tests/pacer.test.ts
Ext/shared/activity/activity-display.ts
docs/architecture/build-loop.md
docs/architecture/extension-client.md
```

- t194: 1 files.

```text
Ext/background/activity/tests/pacer.test.ts
```


## Next bounded C implementation partition (not released or edited)

Proposed owner files, disjoint from supervisor node-run/run.ts,capture.ts,stable-handles/press-effect and Core worker amendment/dry-run/evidence-loop:

- `domain/src/runtime/llm-evidence/tools.ts`
- `domain/src/runtime/llm-evidence/tests/tools.test.ts`
- `domain/src/runtime/llm-evidence/structure/packet.ts`
- `domain/src/runtime/llm-evidence/structure/tests/detect.test.ts`
- `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts` (test only; avoid source overlap with w86)
- `apps/extension/src/content/actions/extract-list.ts`
- `apps/extension/src/content/actions/tests/extract-list-paging-account.test.ts`

Root cause confirmed on t262: packet WebLlmRepeatingStructure shows only pagination mode; the handle retains bound1 out of model view. tools.ts docs currently show only `paginate?:false`; absent/true accepted by slot are undocumented. extract-list.ts PAGING_STOPPED.page_limit says only 'raise it', naming maxPages without nested path.

Minimal coherent behavior: preserve existing one-page proposal/reader bounds, expose screened numeric detected bound in the structure packet, document absent/true as keeping that bound and explicit `paginate:{maxPages:N}` (or maxScrolls for feed) as override, and have page_limit report actual effective bound plus exact `extractList.paginate.maxPages`/maxScrolls amendment shape. Numeric bounds are authored execution metadata, not secrets or raw row/page data. Do not change detector's PROPOSED_MAX_PAGES or Core instruction classifiers for this fix.

Failing-first regression set: detected next pager maxPages1 packet explicitly says one-page bound; tools description documents true/omission and nested bound form; `paginate:true` resolves1 (honest bound, not all-page inference), explicit `paginate:{maxPages:5}` resolves5; one-page nonterminal outcome reports incomplete with concrete nested correction; disabled-next end emits no misleading truncation warning; scroll bound uses maxScrolls. Run only those owner bundles, plus domain/extension typechecks and structure audit after source freeze. Fresh C live retest then measures whether model requests all-page bound before unnecessary filter rewrites; outcome and cost remain unproven until that run.

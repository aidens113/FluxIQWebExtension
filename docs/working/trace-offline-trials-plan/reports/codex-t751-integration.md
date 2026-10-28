# t751 integrated verification

## Current State

2026-10-21. Worker read integrated-verification brief, main hub Current State, recovery report and supervisor fixture report. Supervisor integrated accepted t752 and froze Core `f86901c5` / downstream `5309de5` (reference4135), then docs-only dev merges. Final owner gate found three failures: one reset-guidance contract now fixed and verified (seven files/91 tests, followed by final string-only three files/51 tests); two judge service fixtures assigned to t752. Core package tsc, both root audits and Core docs:check passed; generated reference4135 current. Production source frozen. Stamped build remains held by supervisor for accepted t754 export manifests. No build, browser, paid call or panel operation yet; no current-code browser acceptance claimed.

## Exact planned commands

All commands run only after supervisor freeze. Logs redirect outside authoring trees to `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-21/codex-t751-review/`, with native exit observed. No full suites. Do not regenerate docs or edit inputs while checks/build read them.

Core `packages/fluxiq`, one grouped owner selection (parallel then real-SQL through package runner):

```powershell
pnpm.cmd test src/programs/automation-studio/runtime/flow-bootstrap/reset-admission/tests src/programs/automation-studio/runtime/flow-bootstrap/reset-settlement/tests src/programs/automation-studio/runtime/flow-bootstrap/reset-answers/tests src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests src/programs/automation-studio/runtime/flow-bootstrap/plan/tests src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests/adaptation.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests src/programs/automation-studio/runtime/service/project-build/tests src/programs/automation-studio/runtime/service/candidate-trial/tests/landed-acts.test.ts src/programs/automation-studio/runtime/project-agents/supervisor/tests src/programs/automation-studio/runtime/project-agents/dispatch/tests/whole-trial-port.test.ts src/programs/automation-studio/runtime/project-agents/dispatch/tests/trial-port-check-rows.test.ts src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt.test.ts
pnpm.cmd exec tsc --noEmit -p .
```

This includes all three mandatory contract tests (system-prompt plus plan extraction-vocabulary and issue-feedback), source-derived stamp/model injection tests, schema/authoring and preflight assertions, integrated project-build ending conflict, supervisor helper consumers and affected dispatch trial-port. Scope is changed owners rather than all runtime/package tests.

Core root, gates then ONE stamped three-library build:

```powershell
node scripts/structure-audit.mjs
pnpm.cmd docs:check
node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build
```

Downstream root, after stamped Core build:

```powershell
node scripts/check/core-build.mjs
pnpm.cmd --filter @fluxiq-web-extension/domain build
pnpm.cmd --filter @fluxiq-web-extension/domain check
pnpm.cmd --filter @fluxiq-web-extension/extension check
pnpm.cmd --filter @fluxiq-web-extension/domain test runtime/llm-evidence/plan-resolution output-nodes/extract-list
node scripts/structure-audit.mjs
```

Downstream extension package, headed provider-free Chromium via owning harness (one worker):

```powershell
pnpm.cmd test:e2e e2e/site-reset --workers=1 --headed
```

The owning script builds extension output after checking Core currency. All twelve existing plus five new site-reset specs selected; actual test count recorded after run. Browser traces/screenshots copied externally before cleanup; no user data/profile resets. Tests use only realistic scenario fixtures. Job missing-witness and site-revert tests preserve existing fail-first evidence; photo page-order has pristine-pair fail-first; photo dialog/navigation remain preservation coverage, not claimed historical reproductions.

## Results

Started agreed commands against frozen paired refs above; native sessions: owner65115, tsc28341, Core audit70395, docs82519, downstream audit15370. Logs `integrated-core-owners.log`, `integrated-core-tsc.log`, `integrated-core-audit.log`, `integrated-core-docs.log`, `integrated-downstream-audit.log` in external review directory. No current-code browser acceptance claimed. Root's earlier integrated reset/trial two-file gate passed11 tests after expected-ending conflict resolution; final owner gate rechecks them with t752 source.

- Both structure audits and Core docs:check completed native exit0. Downstream224 warnings/651 baselined; Core detailed count in raw audit log; docs-links0 warnings/0 baselined and generated framework reference current. Owner tests and package tsc remain running without reported failure. No build launched.
- Final frozen-source Core package typecheck completed native exit0 with empty diagnostics (`integrated-core-tsc.log`). Core audit443 warnings/1155 baselined. Only grouped owning tests remain running; build still held for accepted t754 manifests.
- Parallel owner phase completed215 files:214 passed/one failed;2043 tests passed/one failed. Existing `reset-answers/tests/refusal-tools.test.ts` static scan reports `reset-admission/admission.ts:77: no words function builds this instruction` in latest project missing-original refusal. No edit made during running real-SQL phase. Reported exact failure/files to supervisor for bounded assignment. Raw log lines257 onward. Package tsc/audits/docs passed independently. Supervisor's later dev merges contain only working docs; no gate inputs changed.
- Owner gate stopped native1: real-SQL five files/33 tests passed, two files/two tests failed. Facade draft-ending test line282 expected judged-no but got not_judged; time-limit assembled-draft test line218 likewise expected candidate.trial_judged_no but got candidate.trial_not_judged. Reported exact two files to root for t752 fixture ownership; this worker did not edit them.
- Unchanged extraction narrow gate18760 stopped native1: six files/90 tests passed, one failed; scanner now reports WORDS.controlOriginalRequired() names no offered tool. This proves moving the string alone is insufficient for R5. Proposed minimal correction to root: name core.run_node in the existing stateful-controls read instruction, retaining this_page versus no_call. Scanner unchanged, no fixture bypass. Root assigned two real-SQL failures to t752; this worker retains only admission/words production scope.
- Root authorized precise tool-name addition; instruction now says read stateful controls with core.run_node. Final narrow grouped command (same four selections above, log integrated-refusal-words-final.log) passed seven files/91 tests, empty real-SQL group native0, all groups passed; native exit0. Production frozen and root/t752 notified. No rerun of214 passing owner files. Exported words method adds public declaration shape, so final reference regeneration23840 and package tsc70010 running; docs:check follows generator sequentially. Build still held.
- Public-shape tsc70010 and regenerated docs:check25246 completed native0; reference4135 declarations current. Root then found opening sentence falsely implied an act already happened even for a pre-effect refusal. Waited for all own gates and t752 SQL to stop, changed only opening to `This build has no proven original counts for this control.` Added meaningful pre-effect existing permission-test assertions: truthful instruction, no `build acted` wording, effects0 immediately on refusal. No state-policy/tool/canMeet change. Source frozen and t752 notified; final three-file grouped rerun66281 (action-permissions, refusal-tools, words), external integrated-refusal-pre-effect-final.log. No repeated typecheck for string/test-only edit per root instruction.
- Final factual-wording rerun66281 completed native0: three files/51 tests passed, empty real-SQL group0, all groups passed. All worker gates stopped. Source remains frozen for supervisor commit/export integration, then one stamped build and current-code browser acceptance. No broad rerun or unrelated production changes.
- After owner gate stopped, root-authorized two-file correction moved identical project control-original guidance from admission.ts to site-reset/words.ts `controlOriginalRequired()`. No semantic/canMeet change, scanner/test unchanged. Narrow grouped rerun started18760: refusal-tools.test.ts, words.test.ts, reset-admission/tests, action-permissions.test.ts. External integrated-refusal-words-fix.log. New exported words method requires generated-reference regeneration/check after narrow result; no build started.

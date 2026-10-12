# t457 trusted handler-scope feedback

Status: Source complete; all worker source/build gates passed. Supervisor post-sync independent compatibility/audit/probe verification pending.
Owner: a-review worker.

## Current State

Paired t457 unit at Core 3291fb25, source frozen. Product change is one explicit trusted code added to the existing feedback allowlist; no parser, compiler, trial, receipt or runtime guard change. Neutral fail-first initial feedback regressions reproduced and now pass; corrected explicit labels compile with required fixture handle bindings. Repeat transport preserves the explanation. Current 94 narrow tests, actual TypeScript command, fresh owning library build and compiled feedback/repeat proof passed. Core audit passed after test relocation; final audits follow supervisor repair of copied downstream working index/header staleness. No provider/browser launch, baseline expansion, commit, merge or push.

## Initial authorized paths

Relative to Core packages/fluxiq/src/programs/automation-studio/runtime:

- `flow-bootstrap/plan/issue-feedback.ts`
- `flow-bootstrap/plan/tests/issue-feedback.test.ts`
- `llm/harness-options/tests/bootstrap-completion.test.ts`
- `llm/repeat-guard/tests/candidate-feedback.test.ts`

Planned implementation: add only `flow_script.handler_invalid` to existing trusted authored-code allowlist. All producers of that exact code are Core handler assembler/static statements and quote only model-authored scopes/labels. Existing early completion mapper and repeat transport already retain message fields if owner emits them. No arbitrary prefix-based admission; explicit negative cases cover unlisted lookalike and domain codes.

Fail-first observed: 59 narrow tests / 3 files, 2 precise missing-message failures (direct owner and actual bootstrap completion) / 57 passed, exit 1. Repeat transport preserved supplied message already. Single authored-code allowlist entry plus owner comment implemented; post-fix checks running. No fixture failure counted as product evidence.


## Fixture diagnosis, structure and current validation

Post-fix missing-message checks passed; corrected-label acceptance initially hit unrelated bootstrap.handle_resolution_unavailable. This was a test-fixture omission: handler before/after facts and its action need domain handle bindings. New neutral test now uses the established resolvePlanNodeParameters callback for only its known t10/t11 fixture handles, asserting all three bindings and full corrected-script acceptance. No acceptance assertion removed and no compiler behavior changed. That fixture failure is not counted as product evidence.

Core first audit found existing bootstrap-completion.test.ts plus new regression at 802 > 800. Supervisor approved moving only new test to `llm/harness-options/tests/handler-scope-feedback.test.ts`; original bootstrap-completion.test.ts restored with no Git diff. No budget/baseline expansion or new source module. Final changed paths are source allowlist, its owner test, repeat transport test and new focused harness test; the original harness file remains validation-only.

Current four-file tests passed 59/59: issue-feedback 15, existing bootstrap-completion 37, new handler-scope-feedback 1, candidate-feedback 6, exit 0, 24.11s. Narrow candidate authoring/trial compatibility, current owning build, actual typecheck and final Core audit follow. Downstream audit earlier reports copied shared working index/header staleness; supervisor owns reconciliation, not worker. Source remains stable.


Final changed paths (Core runtime-relative):

- `flow-bootstrap/plan/issue-feedback.ts`
- `flow-bootstrap/plan/tests/issue-feedback.test.ts`
- `llm/repeat-guard/tests/candidate-feedback.test.ts`
- `llm/harness-options/tests/handler-scope-feedback.test.ts`

Compatibility: candidate authoring-loop 10 / trial-gate 25 passed, exit 0, 20.70s; 94 tests across six files in total. Core audit passed after relocation: 330 warnings / 1159 baselined. Actual intermediate typecheck passed; final cache-free-info-path tsc follows the fixture move. Owning library intermediate build passed (58.875s, 7218 outputs); Git diff whitespace then identified CR endings only in four inserted lines because existing source contains literal NUL and Git skips text normalization. After build ended, normalized only those four inserted line endings, preserving all original bytes. Final diff whitespace clean; source refrozen. Fresh owning build and actual tsc now run against final bytes. No baseline or structure-limit expansion.


## Final source and built proof

Ordered final four-file snapshot SHA256 `07dcd8e10655502d8b5f21833a3d17e89d7d683e12e22e3ec40b155159c1b4d6` (ordered paths: source allowlist, owner unit test, repeat transport test, new harness regression; hash each relative filename then raw bytes). Source owner 336 lines; new focused test 61 lines. Core HEAD `3291fb25cbfc38c6e4251c4f9a487eef5b1400cb` at worker checks. Only four owned source/test files differ; original bootstrap-completion.ts and its existing test remain unchanged.

Final owning build exit 0, actual command (not reused), 78.230s / 7218 outputs. Final actual tsc exit 0 with fresh build-info path. Current-dist probe (no browser/provider) used the actual parser/handler compiler on neutral authored notice script, passed its static issues through current built issue-feedback and candidate repeat transport. It proves valid rejection and message retention, retains code/path, rejects copying unlisted page messages, and leaves repeat limit 3. Stored proof `C:/Users/osrs_/FluxStuff/fxwork/t457/t457-built-feedback-proof.json`; runtime artifact digest `67f89085db93a86aa49a792ec395e9b1d7cafa770a13ab82856e9c5ac9993f96`, source allowlist hash `7c30d3fa37a0423a01e813294310b74d569756041f6e8d3b26716e477e0e45ce` equals built identity manifest. This compiled probe covers compiler/feedback/repeat owners; actual early bootstrap completion is separately covered by the source integration regression. It is not live model behavior proof.

Commands (t457 Core):

```powershell
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/issue-feedback.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/handler-scope-feedback.test.ts src/programs/automation-studio/runtime/llm/repeat-guard/tests/candidate-feedback.test.ts
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/trial-gate.test.ts src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/authoring-loop.test.ts
pnpm.cmd --filter fluxiq build
pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/t457-handler-feedback-final.tsbuildinfo
node scripts/structure-audit.mjs
git diff --check
```

## Compatibility, privacy and limits

Final worker handoff: current-byte Core structure audit observed exit 0 (330 warnings / 1159 baselined), diff whitespace clean. No check/build/probe remains running; source frozen. Supervisor now owns sync to docs-only Core dev `1a7e47c6` and downstream `b16ad470` (t456 tool source plus reconciled index), then independent tests/domain compatibility/audits/compiled proof. Worker makes no post-sync validation claim and starts no read/build during sync.

The compiled probe originally executed through stdin. Its same neutral logic is now saved, without rerunning, at `C:/Users/osrs_/FluxStuff/fxwork/t457/t457-built-feedback-probe.mjs`; module/source paths were anchored to that file so the supervisor can run it from any directory. Existing proof receipt above is the observed pre-sync run. No provider/browser or model access exists in this probe. Final owned source snapshot remains unchanged.

Message field already belongs to the feedback contract; this is additive explanation for one exact trusted Core-authored error code. Unknown/lookalike/domain codes remain code/path only. All producers audited: Core static handler assembly quotes model-authored labels/scopes, no arbitrary validator/provider/DOM messages admitted. Existing early located mapper and repeated-refusal channel retain the message without new source wiring. Invalid scope still rejected; explicit labels are the correction. Exact candidate revision/digest/receipt and acceptance gates remain unchanged; 35 candidate compatibility tests passed. No scenarios/oracles/task instructions, numeric parser, user data, .env, source peers or shared docs edited. No full suite or live proof; supervisor owns authored architecture updates, shared index reconciliation and independent final integration checks.

## Supervisor verification

Supervisor synced Core docs-only dev1a7e47c6 and downstream b16ad470 (numeric tool correction plus reconciled notes). Independently observed22tests/3files pass, reran actual compiled parser/refusal/repeat/privacy probe successfully, and verified byte comparison: all original17943source bytes preserved, exactly249inserted bytes. Actual current domain source/test check passed19.896s; both direct structure audits passed after sync. Cache-free-info-path Core typecheck passed exit0; authored refusal architecture updated. No provider/browser call, acceptance relaxation or raw page/provider-message disclosure.

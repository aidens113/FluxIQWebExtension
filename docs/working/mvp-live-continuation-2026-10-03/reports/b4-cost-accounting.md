# B4 cost accounting reconciliation

Worker resume-ab, 2026-10-03. Status: source cause established and serial Core usage fix implemented; 72 owning tests pass, source frozen; supervisor verification pending. No Lab source/arithmetic/provider/runtime/state/env/guard/commit/shared-document changes.

Read written brief/Current State, own checked-node-identity report, B4 full debug cost section. Initial eight source owners: downstream live-llm/{run-spend,step-log-spend,observed-usage,build-cost-ceiling,cost-ceiling-env}.ts; Core llm/harness/{run,provider-result}.ts and service/flow-bootstrap-commands/creation-purse.ts. No env files read; cap resolution code only.

## Facts and first confirmed projection seam

B4 run-mut8t1fk-e14fee21 central total 67 calls/$0.092695098. Snapshot runSpend phases: build65/$0.083475300 + chat1/$0.000173172 + read1/$0.000178392 = $0.083826864; difference $0.008868234. Seven unusable costs total $0.009046626; difference equals that minus read$0.000178392. Arithmetic alone is not cause proof.

runSpend total ALREADY reports the truthful raw$0.092695098: downstream run-spend.ts adds the step log residual under stepLog.unattributed={calls:0,estimatedCostUsd:0.008868234}. This is not discarded paid spend, but it is a phase-attribution gap. Counted build65 includes unusable calls despite lower supplied build cost; hence residual has zero calls. perBuild currently uses coreBuild$0.083475300 rather than the step log whole creation spend.

creationBuildSplit compares distances of supplied Core build cost from raw creation total versus raw creation excluding read/judge. Because missing unusable cost is far larger than read, this heuristic classifies read cost as not held, adds read as separate phase without subtracting from Core build. This explains why residual is missing unusable amount MINUS read, not the full unusable amount. Exact upstream seven-usage loss requires following the harness adapter/loop accounting source; requested six bounded reads before expanding.

Harness run currently parses bounded provider usage and settles reservation/build hold even when output diagnostics make ok:false. Thus malformed model decisions are paid and held against purse; malformed output is not free. creation-purse scopes instruction read/decisions/test/judges together, carries chat interpretation spend and prior continuation spend, and persists purse spend across unfinished continuation. Normal UI defaults are independent; Lab cost-ceiling-env opts in explicit test scope, env/.env.local-over-.env/default.10, flag only lowers configured amount. No env contents inspected or changed.

Snapshot active runSpend.perBuild.ceilingUsd=.1/overCeiling0. Declared profile maxEstimatedCostUsd10/maxCallsPerRun48 are separate metadata and do not establish effective creation cost/call enforcement. Need resolver/purse source proof before describing their precise remaining role.

## Confirmed usage loss and active authority

Approved extra source reads: Core llm/{loop-configuration,unusable-decision}.ts; llm/evidence-loop/accounting.ts; llm/build-purse/purse.ts; llm/flow-execution-limits/run-cost-ceiling.ts; service/flow-bootstrap-commands/harness-accounting.ts; exact evidence-loop.ts catch/usage ranges; model/run-cost-ceiling/run-cost-ceiling-env.ts. No extra source edits. Requested final bounded service.ts actual adapter/aggregate ranges before closing projection trace.

The error factory automationStudioLlmUnusableDecisionError(result) only carries issueCodes, an optional unreadable-reply account derived from diagnostic metadata, and newly integrated screened fieldIssues. It does NOT carry result.usage. evidence-loop catch line680 adds only thrown.reply?.usage and increments reportedDecisions only if that exists. For valid JSON rejected by schema (unexpected write field), no unreadable reply account exists, so paid usage disappears from aggregate/trace. Conversely ordinary decision usage and raw decision-refusal usage are explicitly added. This is the exact missing-feed seam, rather than a billing arithmetic issue.

Core accounting$0.083475300 equals full raw creation spend$0.092521926 (excluding initialchat, INCLUDING instructionread) minus the seven malformed-field calls$0.009046626. Token difference likewise exactly seven calls when read is included: input184683/output706. Core loop count65 still includes these seven iterations, but observed priced records58 omit them. This explains zero missing calls with nonzero unattributed dollars.

| Raw unusable step | Phase | Cost USD | Input / output tokens |
| --- | --- | --- | --- |
|0078-decide|explore/creation|.001238130|26023/105|
|0079-decide|explore/creation|.001191216|26232/100|
|0082-decide|explore/creation|.001601352|26308/106|
|0083-decide|explore/creation|.001250832|26524/95|
|0084-decide|explore/creation|.001256832|26528/104|
|0085-decide|explore/creation|.001252632|26532/96|
|0086-decide|explore/creation|.001255632|26536/100|

Central meta sum independently verified67/$0.092695098: chat1/.000173172, explore41/.057843336, read1/.000178392, repair24/.034500198. Meta statusok refers successful adapter transport/JSON response, not Core schema acceptance. Seven decision payloads specifically have misplaced outer write; no raw values copied.

Active purse is a different authority from the summary aggregate: harness/run settles hold with valid parsed usage BEFORE returning !ok; creation-purse scopes all instruction/decision/test/judge calls and carries initialchat/priorcontinuation cost; purse.hold.settle accumulates actual reported cost once, clears pending, counts reservation overshoot; spentUsd takes carried plus max(settled,reported aggregate). Therefore dropped aggregate usage does not lower its enforced spend. Future preflight hold checks enforce ceiling plus pending/judge reserve; unused judging reserve can cause an ending below .10, without a monetary cap breach. Reporting perBuild currently uses lower coreBuild; that field is observational and does not drive the active purse.

Scoped resolver source proves explicit FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test reads testdefault.10/env value; ordinary scope ignores test-env variable and uses default.25, with explicit user policies otherwise constrained by servermax10. Normal UI default unchanged. Snapshot declared profile10/48 are not the active purse setting; no generic48-globalcalls promise can be made from that metadata when creation has multiple rounds and helpercalls.

## Minimal proposed correction and regression partition

Preferred Core fix: add a separately typed, bounded numeric usage account to AutomationStudioLlmUnusableDecisionError and preserve result.usage in its factory; retain unreadable reply case metadata independently. Catch must add/trace that usage ONCE, preferring explicit usage then legacy reply.usage. Keep provider-unanswered/missing usage absence and strict permission/schema behavior. Do not synthesize unreadable case for a parsed-but-schema-invalid JSON response. Current parser/fieldIssues/settlement integrations must be preserved.

Minimum owners to release serially: llm/unusable-decision.ts and nearest tests; llm/evidence-loop.ts catch/unreadable trace only and nearest accounting/unusable real-loop tests. Service adapter likely only calls existing factory and needs no source edit; final read will confirm. No Lab arithmetic rewrite is justified before restoring missing Core usage. Downstream live-llm/tests/run-spend.test.ts should cover a complete repaired Core build aggregate and confirm read split, zero residual, truthful total; source run-spend.ts can remain unchanged if upstream restoration resolves attribution.

Fail-first tests: schema-invalid JSON with valid reported usage produces typed error carrying usage but no fake reply; real harness/service loop rejects decision/no host call then counts all failed+successful provider tokens/cost once; emitted unusable trace has numeric usage and screened fieldIssues; existing unreadable paid reply not double-counted; provider-unanswered/no usage does not invent zero-price or paidusage. Existing active-purse test should prove reported failure remains charged before next decision and refuses a call at .10; this is independent guard validation, not a loosened budget. No test run authorized in this read-only brief.

After restoring usage, expected reporting (NOT claimed actual new run): Core build inclread .092521926; phasebuild .092343534, read .000178392, chat .000173172; phase sum .092695098, residual0. perBuild still needs explicit distinction: creation purse includes carried initialchat, while Core buildaggregate excludes it. Prefer publishing actual authoritative purse figures when available over relabeling raw arithmetic as the enforced purse. No accounting-adjusted historical artifacts or guessed corrections authored.

## Final adapter and serial implementation release

Final service.ts bounded read confirms adapter line1612 throws automationStudioLlmUnusableDecisionError(decision) before successful line1614 attaches decision.usage. loopAccounting line1565 sums accumulated loop usage plus instruction-authority usage. This proves the read cost was retained and the seven schema-invalid paid decisions were lost through error conversion/catch, with exact token/cost correspondence above. No service edit necessary.

Root released serial Core unusable-decision/evidence-loop usage fix and existing nearest tests; existing parser-field feedback and retained-rerun settlement frozen. New fail-first tests use actual harness parser → factory → loop/no host call, constructor screening, explicit known usage on unanswered call, explicit usage preferred over legacy reply account. Observed before source edit: exit1, 2 files / 70 tests, 5 failures / 65 passes. Failures exactly missing error.usage, dropped schema-invalid aggregate/trace, missing constructor usage, dropped known unanswered usage, and incorrect legacy usage precedence. Existing reply fallback/fieldIssues cases pass.

Serial source plan: fourth constructor argument typed usage keeps original issueCodes/reply/fieldIssues compatibility; numeric account independent of optional unreadable reply; factory passes result.usage; catch adds known explicitusage or reply fallback once BEFORE provider-unanswered split, preserves its classification and never runs host; unusable/refusal/unreadable trace uses same chosen account. No purse, cap, parser permissiveness, or Lab arithmetic edits. Existing paidUsage helper screens fields but requires outputTokens even though parsed UsageSummary may be partial; root notified before choosing partial-report behavior, no fake output count to be invented.

## Implemented and validated

Root approved the partial-report boundary explicitly. provider-contract.ts automationStudioLlmProviderPaidUsage now has an additive second optional options argument {requireOutputTokens?:boolean}; default remains true for every existing caller. Explicit false screens partial known numeric fields and returns undefined for no valid numeric fields. It never adds synthetic token counts. Token fields remain nonnegative safe integers, cost finite/nonnegative, arbitrary extra fields discarded. Public constructor uses this explicit partial mode, stores a frozen numeric copy, and preserves issueCodes/reply/fieldIssues constructor positions. Factory forwards actual result.usage as fourth argument.

evidence-loop catch adds explicit error.usage or legacy reply.usage exactly once before unanswered/readable/unreadable disposition. Both unanswered and unreadable trace rows carry the same chosen account; schema-invalid refusal rows preserve existing screened fieldIssues. Provider-unanswered classification/backstop and host no-action behavior unchanged. No purse, schema acceptance, permissions or summary arithmetic edits.

Exact owning source partition: Core runtime/llm/{unusable-decision,evidence-loop,provider-contract}.ts. Exact tests: llm/tests/unusable-decision.test.ts and llm/evidence-loop/tests/unreadable-replies.test.ts. No new helper/file/barrel; llm/tests remains25files and existing unusable test755lines, under800. Helper coverage belongs to this nearest common owning test (harness/factory/loop/screening subjects), per explicit root approval; no baseline waiver.

Expanded fail-first (with partial screening/cost-only cases) before source edits: 2 files / 72 tests, 7 failed/65 passed, exit1. After source fix: 2 files / 72 passed, exit0,6.99seconds. Owning git diff check passes. Tests reproduce actual harness schema-invalid reply with valid usage and no unreadable account; actual factory/loop accounts and traces paid rejection then successful decision exactly once/no host action; constructor strips extras/keeps grammar metadata; no usage remains absent; explicit known paid unanswered accounted; legacy unreadable fallback intact; explicit preferred account not double counted; valid partial cost-only report preserved with no invented output tokens; strict helper default/invalid/empty/extras retained.

Exact reproduction from paired Core C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 unusable paid usage owners' pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/unreadable-replies.test.ts
```

Own source/test files frozen after observed pass; root may independently union/typecheck/audit and regenerate public reference docs for additive optional signature. Not run by worker: full suite, package typecheck/audit/build, live/provider/browser/replay, mutated historical artifacts or new paid run. Reporting correction will follow restored Core usage on future runs; historical raw bill/residual remain untouched and truthful. A separate observation remains: perBuild summary excludes carried initialchat whereas active purse includes it; this is reporting semantics, not an enforcement failure, and was not silently patched.

## Structure correction after combined integration

Root audit found combined evidence-loop coordinator806lines after all worker usage/field/rerun units. Explicitly released cohesive extraction to llm/evidence-loop/failed-decision/{usage,feedback,index}.ts plus existing evidence-loop/index.ts barrel and coordinator imports/calls. New usage selector gates by enabled/error type and picks existing screened explicit account before legacy reply usage; charges nothing. New feedback helper owns only the duplicated accountEvidence/supersede/push delivery of already-screened feedback. Caller still builds feedback and owns all progress/stall/accounting/permission decisions. The existing evidence-loop directory remains25directfiles; new coherent subdirectory has its own barrel. No baseline change or unrelated comment compression.

Selector alone reached803lines and owning72tests passed; root approved delivery extraction to reach799physical lines. Intermediate delivery check failed12tests because the decision-feedback constant was mistakenly removed from the coordinator import even though ordinary runCall still supersedes that feedback. Restored that existing constant in its existing import group; no behavior change. Final repeated owning command: exit0,2files/72passed,6.91seconds. Owning diff check passes; actual coordinator799lines, directowner25files. Source frozen after final observed pass; supervisor union/types/audit pending. This history is correction evidence, not a newly claimed fail-first product defect.

Final supervisor audit correction: nested failed-decision exceeded maximum path depth (10 segments >9); moved the complete cohesive directory to runtime/llm/failed-decision/{usage,feedback,index}.ts, removed old nested export, and coordinator imports its owning barrel directly. Helpers remain internal; no new public API required. Feedback uses actual existing context-window evidence type, matching established decision-context owners, rather than an invented llm barrel type export. Source remains behavior-identical.

Supervisor typecheck also found two exactOptionalPropertyTypes fixture errors and an incomplete schemaDecision harness context. Corrected the two fieldIssues fixture properties with conditional spreads; supplied the actual public decision schema builder, completion schema and canComplete in the harness fixture. Production validation/types were not weakened. Final observed narrow rerun: 2 files /72 passed, exit0,7.75seconds. Coordinator798physical lines; test756physical lines. Both source and tests frozen after this result. Root independently owns union/typecheck/audit/service integration and all live validation.

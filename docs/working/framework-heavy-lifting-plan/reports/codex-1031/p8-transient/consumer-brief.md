Role: heavy worker, gpt-6.1-sol max. Task t826 CC8 Core consumers; begin read-only, wait for lead interface release before source edits.
Core root C:/Users/osrs_/FluxStuff/fxwork/t826/!FluxIQ; report in paired Down p8-transient/consumer.md.
Read Core Current State, contract.md report, source below; root owns versions/docs/builds/git.
Owned: programs/automation-studio/runtime/llm/{repeat-guard/retry-later.ts,repeat-guard/outcomes.ts,evidence-loop.ts,decision-handlers/refusal-run.ts,decision-handlers/amendment.ts}; owning tests.
Also own evidence-progress/{progress-trace,decision-dump}.ts and owning tests; one focused local helper/barrel if needed (request exact path first).
Lead released implementation after interface verification; approved evidence-progress/tool-execution-control.ts and existing index.ts barrel.
Must not edit contracts/tool-execution/evidence-loop-decision/public barrels, downstream, package JSON, model guidance, executor retry policy, shared Current/Ledger or others' reports.
Stable API being verified: tool execution/parsed failure?:AutomationStudioFailureRecord; contracts transient?:true; public projectAutomationStudioFailureControlRecord strips all descriptive/comparison/digest fields, malformed->undefined.
Goal: typed temporary failure instead of web-English regex exemptions in BOTH authoring guards, including recorded calls/refused streaks/amendment reruns and all reconstructions needed by those paths.
Frozen gate: strict valid failure.transient===true AND retryable===true AND effect===unacted, actual effectApplied===false, no personNeeded/authoritative refusal/terminal uncertain fact. Temporary alone, retryable alone, stage alone, result code/reason/English never grant this exemption.
Missing/invalid signal stays cautious. Do not turn certainNoEffect's bounded one-extra rule into an unbounded exception; that field alone never qualifies. Do not add retries/dispatch or alter actual effectApplied/evidence.
Remove web-word interpretation from retry-later only; existing generic framework transport/status fallback elsewhere stays. Update fixtures that explicitly intended temporary behavior to supply typed facts; retain negative regex-matching cases.
Carry failure/resultReason/effectApplied/personNeeded truth through amendment paths using their real execution facts, not synthetic defaults. Inspect and request extra exact files if propagation requires them.
Privacy: raw progress dump sees executeTool result BEFORE parser. Sanitize only recognized llm_evidence_tool_execution envelopes' optional failure before BOTH step-log wrapper and raw dump serialization using shared projector; malformed/accessor metadata drops alone, preserve actual call/effectApplied/evidence and opaque non-tool results. No mutation of producer input; no invoking failure getter.
Tests: temporary-unacted admitted both guards; nontransient legacy English blocked; ambiguous/acted/nonretryable/policy/person-needed/malformed blocked; amendment propagation; raw dump JSON has no private failure markers/digest, originals unchanged and call evidence retained.
Run only named owning Vitest files max2workers. No whole suites (daily2already used), builds/typechecks/generated Down tests/API/browser/panel/git/agents or .env/.fluxiq/user data.
No edits while lead source-wide checks/builds run; announce source freeze. Source depth<=9segments/flat<=25; no baseline increase.
Report exact paths, commands/results, unverified cases. End required Outcome/Changed/Validation/Not verified/Report/Notes.

# t909 Codex continuation brief
Role: heavy worker; model gpt-6.1-sol; effort max.
Goal: finish the stopped FluxNode action scope lane, with verified root-cause behavior.
Phase now: read-only intake; do not edit source until lead syncs dev and confirms ownership.
Owned eventual paths: Existing t909 Core diff plus directly adjacent tests/docs; extension only your own report.
Context: Inspect latest Core WIP message/diff and locate its act-scope report; read relevant Core fluxnode-plan Current State and named report. Explain missing report explicitly if absent.
Read this lane's AGENTS.md/CODEX.md and Core's instructions before Core work.
Inspect git status and diff against dev, not just latest commit. WIP is unvalidated.
Return exact proposed edit paths, acceptance commands and remaining phases before source edits.
Report: docs/working/mvp-launch-plan/reports/codex-t909-resume.md in this extension lane.
Must not touch: shared Current State/ledger/index, another lane, t902, t898 private-run-context.md, main checkouts or user edits.
No git mutations, subagents, full suites, paid runs, panel management or external messages.
No symptom caps, arbitrary waits, extra retries, weak oracles or hidden failures.
Use isolated test data; never print secrets, tokens, profiles or recorded user data.
Heavy jobs must coordinate through fxwork/.tools/heavy-slot.mjs; ask lead before first heavy launch.
Narrow mocked unit tests may run serially without a heavy slot. Use pnpm.cmd in PowerShell.
End with Outcome / Changed / Validation(command and observed output) / Not verified / Report / Notes.
Implementation authorized after dev sync (lead, 2026-11-11):
Own the 17 WIP paths and adjacent additions listed in codex-t909-resume.md, including new focused files under fluxnode/act-scope/.
Reproduce both inferred gaps with failing tests first, then complete all four reported phases.
Persist act records by execution scope; retain continuation task identity; preserve legacy chat and permission boundaries.
Request exact additional generic-persistence paths before editing outside this ownership; other lanes may use them.
Run narrow unit/SQL suites, package check and structure; heavy jobs use coordinator, one per lane, >=2 GiB free, serialize if capacity is tight.
No paid calls or browser launch needed. Lead owns versions, shared docs, git and independent final checks.
Continuation scope (lead, late 2026-11-11):
- Approved runtime/answer-first/act-record/gate/act-gate.ts and adjacent tests, plus framework/automation-service/service/answer-first/run-acts/run-gate.ts and tests/settled-before-return.test.ts. Reproduced durable may_have_landed after settlement before next model decision; keep that observation and await flush at owning async doors.
- Approved act-scope execution-owner helper/tests, request identity and durable key allocation, and pipeline/fluxnode-pipeline-context.ts service port. Separate-process contention, dead-owner recovery, fail-closed unknown owners, concurrent resume joining and scope ownership across every child/resume are required.
- Lead transferred and locally committed snapshot-only 13-file dependency as Core9167d7141; do not rebuild or copy0036. Source API uses opaque immutable occurrence snapshots; secrets remain references.
- Create/run handoff to t907 requires coherent dependency manifest, focused behavior checks and packagecheck. Dynamic snapshot adapter remains separate so host integration can proceed when the stable seam passes.
- Approved after host transfer: act-scope/pipeline-source-reference.ts and pipeline-source-of.ts, task-memory snapshot-reference DTO, pipeline runner wiring and adjacent tests. Prove equal occurrences/reordered changed source/full Core restart: same parent key reuses immutable snapshot; fresh parents fetch current source. Keep create/run host files fixed.
- Approved corrupt-state continuation: act-scope/scoped-memory.ts and tests; strict scoped TaskMemory reads/updates and minimal create-service launch preflight plus run-attempt strict-update argument. Reproduce keyed A/B/restart corruption before fix; refuse before admission, preserve cause and owner cleanup. Lead merges these reopened seams into other lanes.
- Approved atomic task update: framework/persistence/program-state/document-transaction/{index.ts,transaction.ts,tests/transaction.test.ts,tests/process-writer.ts}; layout-v2 existing transaction, legacy per-document SQLite guard for RMW only. Prove independent processes retain acts+refs, crash release, independent documents and both layouts; no data duplication/global execution lock.
- Approved pin/restart identity fix after3vs2 act reproduction: act-scope/execution-task.ts and adjacent tests; bind original taskKey and resolved target identity under existing execution owner before admission, strict stored binding, minimal create delta only. Reuse caller-key/options/pin policy; run-fluxnode unchanged.

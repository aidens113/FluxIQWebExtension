# t907 Codex continuation brief
Role: heavy worker; model gpt-6.1-sol; effort max.
Goal: finish the stopped managed browser host lane, with verified root-cause behavior.
Phase now: read-only intake; do not edit source until lead syncs dev and confirms ownership.
Owned eventual paths: Existing t907 source diff in its paired Core and extension checkouts, plus directly adjacent tests/docs.
Context: Read docs/working/mvp-seal-plan/reports/t907-browser-host/{design,browser-host,enrolment}.md and relevant MVP seal Current State. Inspect reported IAM actor/headless route blockers.
Read this lane's AGENTS.md/CODEX.md and Core's instructions before Core work.
Inspect git status and diff against dev, not just latest commit. WIP is unvalidated.
Return exact proposed edit paths, acceptance commands and remaining phases before source edits.
Report: docs/working/mvp-launch-plan/reports/codex-t907-resume.md in this extension lane.
Must not touch: shared Current State/ledger/index, another lane, t902, t898 private-run-context.md, main checkouts or user edits.
No git mutations, subagents, full suites, paid runs, panel management or external messages.
No symptom caps, arbitrary waits, extra retries, weak oracles or hidden failures.
Use isolated test data; never print secrets, tokens, profiles or recorded user data.
Heavy jobs must coordinate through fxwork/.tools/heavy-slot.mjs; ask lead before first heavy launch.
Narrow mocked unit tests may run serially without a heavy slot. Use pnpm.cmd in PowerShell.
End with Outcome / Changed / Validation(command and observed output) / Not verified / Report / Notes.
Implementation authorized after dev sync (lead, 2026-11-11):
Own B1/B2/B4/B6 and actor/headless paths enumerated in codex-t907-resume.md; confirm exact IAM machine-identity/custody contract before new IAM edits.
B3 files create-fluxnode-service.ts/run-fluxnode.ts are temporarily owned by t909. Build disjoint hosts modules/tests, B5 and B7 scaffolding now; request lead handoff before editing those shared files.
Machine authority must be derived from stored enrolled trust + current run lease, domain/project scoped, evaluated by IAM; no fictitious person/admin, hello-derived authority or relaxed person checks.
Headless project context follows current lease; preserve Next/person behavior. Model calls stay in Core custody; no direct provider workaround.
Complete B1-B7; report exact new build-cache/proof/architecture paths before editing outside named scopes. Lead owns versions/lockfile integration and shared docs.
Heavy narrow checks/builds authorized through coordinator, one per lane, >=2GiB free. Coordinate other lanes; browser proofs only after unit/source gates and announced exact provider-free command.
No paid calls, panel management, git mutations or other-lane edits. Keep normal shutdown/hard-death/isolation acceptance concrete.
Continuation scope (lead, late 2026-11-11):
- Approved connection/session/{writes,index,tests/writes.test}.ts for ordered durable writes and generation checks across lease handoff; lead independently passed73 extension,16 browser-host and23 domain tests, plus40 Core host/auth/upload tests.
- Approved existing reaper IPC acknowledgments/loss cleanup. A real company-website lifecycle-only proof is authorized after package/build/currency gates, using two isolated hosts and zero engine/scripted/paid calls. Flow/continuation must be marked NOT RUN for that diagnostic. Do not launch old fake-gateway/blank-page headed test.
- Approved test-runner proof/CLI --lifecycle-only stage; fixture navigation belongs only in proof harness, never site-specific product launcher code.
- Approved scripts/lab/provider-free-run.mjs + tests/provider-free-run.test.mjs and scripts/lab/scenario-guard/lab-scenario-refusal.mjs + adjacent tests for new command protection before CLI/module setup. Preserve ten-scenario and no-credential guards.
- Lead synced extensiondev before lifecycle launch; Core already contains currentdev. create/run remains reserved for t909 coherent dependency handoff.
- Approved shutdown expansion: fluxnode/fluxnode-service.ts optional in-process close, run-registry.ts admission/stop/drain; owned create-service/run-dev integration; managed-hosts.test.ts and new run-registry-shutdown.test.ts, managed-hosts.md. Reproduce controller finalization race; drain in-flight admissions and all parent/leaf owner cleanup before instance close, without controller leases/time caps.
- Approved full-proof attribution: packages/test-runner/src/attempt-lane/scripted-model/model-server.ts and existing tests/model-server.test.ts; optional validated synthetic run correlation from owned host fetch. Count unattributed requests explicitly; preserve independent scripted state and zero-call continuation criteria, no provider/Core decoding changes.
- Correlation adjunct approved: scripted-model/correlation-header.ts and existing index.ts re-export; per-run scripted cursors/chat fallback, aggregate/unattributed reconciliation, interleaved two-run tests. No proof-consumer import from generic model server.
- Full-proof root correction approved (lead, 2026-11-12): scripted-model/scripts/company-website-apprentices.ts and scripts/tests/company-website-apprentices.test.ts; scripts/evidence.ts and its adjacent tests only if a generic helper is required. The failed full proof repeatedly sent legacy absolute y=4000 while the asynchronously growing grid needed delta scrolling followed by actual named batch readiness. Both attempts stopped before extraction/result verification; the untransferred t905 result-ledger binding is not this failure's first cause. Preserve the 24-reply diagnostic limit, task and exact four-row oracle; reproduce absolute-scroll stall and pending-load retry before fixing with supported delta/wait contracts, no fixed delay. Per-run refusal versus sibling cancellation attribution and its regression remain in owned fluxnode-host-proof/**. No relaunch before debug/gates and lead supervision.

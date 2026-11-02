# Remaining extension and runner sweep failures

Role: Heavy worker, gpt-6.1-sol, max effort.
Goal: Diagnose/repair 10 extension unit failures and one runner failure found by first full daily sweep; preserve meaningful safety/byte oracles.
Authoring: t843 downstream only. Read Current State and original downstream .fluxiq/runtime-refactor-sweep/downstream-test.log; parse bounded failure titles/locations.
Read-only baseline t844 has exact pre-refactor Core/downstream builds ready. Reproduce exact affected subjects there before claiming regression or stale tests; no baseline source changes.
Owned: apps/extension/src test subjects/helpers for failed recording-evidence-pipeline, pass-row-own-run, failure-record, frame dispatch/tab-switch/target resolution cases; packages/test-runner/src/live-llm/tests/live-llm-run.test.ts. Identify exact remaining paths from log before editing; tell lead ownership list.
Production extension/frame/identity/recording or runner live-cost changes need cause/plan reported before edit. No Core source, domain/runtime/**, package/config/audit/shared docs/indexes/other reports, providers, browsers/panels/full suites/git/spawning.
Preserve exact recording bytes with truthful frame-coverage evidence, correct row/control identity, no wrong action/duplicate dispatch, authoritative retry/effect facts and URL/secret redaction. Do not weaken score/ambiguity/privacy assertions.
Cost rule: live Claude tests default to $5 for the WHOLE build (explicit lower limits hold). Do not raise test/Lab allowance to $15 just to match Core's product default; inspect the actual configured Core-vs-Lab budget contract. Unit probes make zero provider calls.
Current t843 Core source changing; use ignored virtual TEST overlays against unchanged t844 production for fixture repairs, not current source aliases. Normal current package acceptance waits for lead's Core build-ready notice.
Return exact baseline comparison, cause and narrow fix; no updating an oracle merely to observed output. Real product defect needs owning structural fix.
Acceptance: affected unit tests and closest safety regression selection, not full suites; distinguish historical overlay from current integration.
Report: docs/working/runtime-ownership-refactor/reports/extension-sweep.md.
Return: Outcome; Changed; Validation exact observed commands/results; Not verified; Report; Notes <=3 lines.

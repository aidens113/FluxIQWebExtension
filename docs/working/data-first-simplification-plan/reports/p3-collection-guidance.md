# P3 / t989 collection guidance

Outcome: Partial
Changed: Core answer-first version answer-first.3, evidence-decision prose, saved-result/action-selection format and nested-loop refusal; Down web-14 paging, retained-field catalog grammar and owning assertions.
Reason: old web text told exploration to defer remaining pages, and Core wording presented manual per-read processing instead of the declared automatic path.
Validation: git diff --check passed for Down source. Grammar measured681 characters with a five-digit maxItems value, within700; owning tests still required.
Preparation: paired task start in progress. Its Core build reported inputs changed while running and correctly did not stamp fluxiq; root source edits overlapped preparation. This is not accepted compilation; run a frozen build/check after final edits. Root has frozen Core while remaining preparation reads it.
Current acceptance: Core105 unique owning tests, Down46/46 tests, Core types, both audits and frozen libraries pass. Down domain typecheck passed, exit0 (41619 ms), after confirming the Core build matches current source. Not verified: live prompt smoke and paired integration; no paid call or browser run in this task.
Next: sync compatible P2/P6 changes while preserving the ParsedToolExecution alias, and integrate after the offline source snapshot is pinned. Authored Core/downstream documentation and producer-generated pins are updated.

## Focused checks
Validation: six-file Core guidance/prompt/loop batch with explicit producer pin refresh and Vitest snapshot update ->104/105 passed,52.22s; one candidate-loop assertion still expected the former site-filter wording. Corrected that expectation to preserve the real-source condition requirement. Normal (no regeneration/update flags) pin/default-prompt/candidate-loop rerun ->74/74 passed,28.43s; the other three unchanged owners had already passed. Only evidence_tool_decision pin changed (6506 to7025 characters); no pin case removed. Explorer snapshot changed; judge snapshots did not.
Validation: three Down owners ->45/46 passed initially; the sole failure expected the old equivalent across-run wording. Corrected that assertion; rerun ->46/46 passed,5,229.384ms, exit0. Final grammar is680 characters for actual maxItems1000, within700. Existing selection and action-safety assertions remain.
Validation pending: frozen Core package check, Down audit, Down package check/frozen libraries, Core audit and paired integration. New prose has not had a live model smoke. A wrong-working-directory prelude was corrected before the relevant queued invocation executed; no pass was inferred from it.

Validation update: Core package check passed (117857 ms); both full structure audits passed (Core564 warnings/904 baseline, Down258/551). Frozen `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` exited0; fluxiq152793 ms and UI19921 ms. Down domain check initially refused stale dependency stamps before compilation; a current-stamp rerun is queued. No browser/model acceptance inferred.

Validation: `pnpm --filter @fluxiq-web-extension/domain check` through the normal gate -> exit0; current Core source guard passed, domain check41619 ms. Durable ignored log `.heavy-slots/t989-domain-check-current.log`. All scoped P3 static/owning checks now pass; integration/live prompt smoke remain outstanding.

# t839 company browser acceptance authoring

Outcome: Done — authored and ready for lead execution after the producer freezes. No browser, build, typecheck, test suite, provider or git operation was run by this worker.

Changed only `apps/extension/e2e/content/tests/extraction/tests/company-definition-fields.spec.ts` and this report.

The test replaces both manual loader clicks with production `webNodeDispatchWithRetries`. Its gateway invokes normal `harness.runAction` once per actual host dispatch and maps the real browser reply through production `gatewayActionResultFromBrowserResult`. Core supplies its normal retry policy and the Domain resolves the trusted Next-page committing effect; the test has no retry loop, fabricated failure, supplied no-effect proof or altered action-effect metadata.

Acceptance now requires:

- First actual browser receipt: canonical `NO_EFFECT`, execution stage, unacted, certainNoEffect and retryable.
- Second browser receipt: succeeded; production host result succeeded after exactly two dispatch attempts with no uncertain-lasting-act result.
- Exactly two click events on the actual loader, observed through a passive listener whose callback returns undefined and changes no DOM/proof state.
- Exactly one appended page: final raw-card count is `min(before + TEAM_BATCH_SIZE, TEAM.length)`, using the existing owning data barrel. This handles the final partial batch correctly: 24 → 28, not 32; positive progress is asserted separately.
- The existing terminal-page assertion and original detected fields remain. The unchanged extraction must still equal `GAS_ENGINEER_RECORDS` in full, with exactly eight records, all four columns and original order. No fixture, task or oracle changed; no later field re-detection replaces the initial proposal.

Scope: real company-website page, content script and normal page-world bundle, with production Domain/Core retry code in the test process. It does **not** load an installed extension background/service worker or run a live Core host. The producer's normal page-world observer entry must be included by the existing harness bundle; this test injects no observer/proof override.

Coordination: Extension worker confirmed one physical press per command and canonical NO_EFFECT returned to the host; Domain worker supplied the production retry/mapper seam and reported its separate provider-free adapter tests. Those reports are not browser validation.

Validation: static review of the authored path only. No commands run, per the author-only brief. Lead still must run this selected company content-harness spec, relevant types/checks and the producer/adapter acceptance. Physical click counts, actual retry receipts, bundle wiring and exact dataset are not yet observed.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/paging-progress/browser.md`.

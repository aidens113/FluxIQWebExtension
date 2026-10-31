Role: Heavy debugging worker, gpt-6.1-sol, Max. No spawning/git/source edits/full suites/provider calls.
Goal: find exact cause of t822 full domain process exit1 despite2488 node:test passes. Loader caught top-level assertion in src/tests/domain.test.ts, compiledline20378.
Baseline frozen pair (run completed): C:/Users/osrs_/FluxStuff/fxwork/t822/!FluxIQWebExtension and sibling !FluxIQ, Source Down9e485534/Coreb72e4214. Do not edit tracked files there.
Log MAIN downstream test-runs/2026-10-31-sweep-2/web-test.log lines3427-3439: missingSelectRegistry removes web.dom.select/check; incompleteBootstrapContext.catalogSelection.missingRequiredTerms.includes('choose') returnsfalse at source line301.
Read domain/src/tests/domain.test.ts around bootstrap setup/assertion and precise Core buildAutomationStudioFlowBootstrapContext/catalog essentials chain. Inspect relevant global state/cache or fixture only as needed.
Compare earlier t821 same Core commit/source domain file: full domain passed; latest t822 domain.top-level module load failed. Extension-only virtual-clock change runs in another process and should not affect domain. Do not guess scheduler or stale fixture without evidence.
User twice-daily full-suite cap is USED. Only named narrow checks allowed, never pnpm check/test/build whole suite or whole Core vitest.
You may reproduce ONE exact domain test entry with owner script filter src/tests/domain.test.ts and unique DOMAIN_TEST_BUILD_LABEL, provider keys/inherited FLUXIQ_* stripped and fresh ignored roots. No user real data/browser/panel/live API.
Determine product regression, shared-state/import-order interference, cache artifact issue or invalid assertion. Never weaken catalog capability guard to manufacture pass.
Return minimal exact fix ownership and meaningful narrow checks; source changes wait for lead brief/branch.
Report MAIN docs/working/framework-heavy-lifting-plan/reports/codex-1031/domain-catalog-failure.md; at most60lines, cause+distance and any reproduction limits.
End Outcome/Changed/Validation/Not verified/Report/Notes.

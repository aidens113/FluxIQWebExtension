# t1027 brief: the downstream failure of the 11-24 sweep (durable press made again)

Lead: Claude Code. Task t1027. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t1027-sweep-fix-durable-1124` (branch `task/t1027-sweep-fix-durable-1124`), downstream only. Fix the cause; never weaken a test to pass. Change a test only where it pins behaviour a named, intended commit changed, and cite that commit.

The full sweep of dev (downstream 6acba56f8-era dev; log `C:/Users/osrs_/FluxStuff/fxwork/t1021/!FluxIQWebExtension/test-runs/sweep-1124/down-test.log`) failed one test, `domain`: `io/tests/gateway-output-dispatcher-durable-reconcile.test.mjs`, "a lost durable press the browser never received is made again under a new attempt". The first error: "Outcome uncertain: ... it was not done again", expected 'succeeded', actual 'failed'.

This is lasting-act safety: a press that may have landed must never be repeated, and one the browser provably never received may be made again under a new attempt (AGENTS.md "Every node retries automatically": only a lasting act whose effect is uncertain is held back). Find which commit the failure began with (run the test at earlier dev commits if needed; today's downstream merges include t1013, t1019, t1017, t1020), and whether the product or the test is wrong, with evidence from the code paths. If the product now holds back a press that provably never reached the browser, fix the product so the proof is read again, never loosening the uncertain case. If the test's fixture no longer proves "never received" the way the product reads it, fix the fixture and cite why.

Owned: what the cause needs in `domain/src/**` (the gateway output dispatcher, durable reconcile, act outcome) and `apps/extension/src/**` only if the proof of "never received" comes from there, with tests beside each. Must not touch: `apps/extension/src/content/extraction/**` and `domain/src/runtime/llm-evidence/plan-resolution/extraction/**` (t1022), `scripts/lab/**`, the shared Core `fxwork/!FluxIQ`, `lab-slots/`, any Lab, browser or paid run.

Acceptance (quote outputs): `DOMAIN_TEST_BUILD_LABEL=t1027 node scripts/test-domain.mjs io/tests/gateway-output-dispatcher` (from `domain/`) passes, with the whole `io` directory's tests; `pnpm --filter @fluxiq-web-extension/domain check` exit 0; `node scripts/structure-audit.mjs` passes.

Report: `docs/working/data-first-simplification-plan/reports/t1027-sweep-fix-durable-1124.md` in your tree. No git (reading `git log`/`git show` is fine). No `node -e`. End with the return contract.

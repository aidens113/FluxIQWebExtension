# t1029 brief: the browser specs that fail on dev, triaged and fixed at the root

Lead: Claude Code. Task t1029, tree `C:/Users/osrs_/FluxStuff/fxwork/t1029-browser-spec-triage` (branch `task/t1029-browser-spec-triage`), downstream. Unknown causes; fix the root cause, never weaken an oracle, skip a spec or raise a timeout.

t1022's worker ran the extension's content harness (`apps/extension/scripts/test-content.mjs`, Playwright, provider-free, on the realistic scenario fixtures) and found failures that also fail with its changes switched off, so they predate it:
- content harness: everything-store-cart-names:76, company-definition-fields:55, item-conditions:262, social-read-completion:90, all 9 auction-marketplace tests, crossborder-marketplace-spain-hubs:358, local-classifieds-bike-search:302 and :316, professional-network:406;
- all 5 part-run tests: the scripted build's trial stops at step 1, a navigate, with `executor.fault.unclassified`, before any read.
auction-marketplace is one of the ten paid scoreboard tasks, and a navigate faulting as "unclassified" could hit live runs, so this blocks the rest of the paid round.

Do:
1. Run the content harness on current dev (`node scripts/test-content.mjs <spec filter>` from `apps/extension`, headed as AGENTS.md requires for browser runs; find the part-run specs and their runner) and list every failure with its first error.
2. Group them by cause. For each cause, find which commit introduced it (`git log` and `git bisect run` are allowed, read-only), and whether the product or the spec is wrong, with evidence.
3. Fix each cause where it belongs: `apps/extension/src/**`, `domain/src/**`, the specs under `apps/extension/e2e/**`, the part-run runner. Change a spec only where it pins behaviour a named, intended commit changed, and cite that commit. Model-facing words never mirror a realistic scenario.
Start with the part-run navigate fault and auction-marketplace, the two most likely to hit live runs. If a cause is in Core, stop and report it with evidence; do not edit Core.

Must not touch: `apps/extension/src/content/extraction/**` beyond what a cause needs (t1022 just changed it; say so before you touch it), `domain/src/runtime/llm-evidence/node-run/standing-choices/**`, `scripts/lab/run-watch/**` (t1031), the shared Core `fxwork/!FluxIQ`, `lab-slots/`, the lane `fxwork/t1015-paid-bigbox` (a paid run is live there), any Lab or paid run.

Acceptance (quote outputs): every listed spec passes headed, or is reported with its cause and why it is not yours to fix; the unit tests beside each change; `pnpm --filter @fluxiq-web-extension/extension check` and the domain check if the domain changed; `node scripts/structure-audit.mjs`.

Report: `docs/working/data-first-simplification-plan/reports/t1029-browser-spec-triage.md` in your tree. No git commits. No `node -e`. End with the return contract.

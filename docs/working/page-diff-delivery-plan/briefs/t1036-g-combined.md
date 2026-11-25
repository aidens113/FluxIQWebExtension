# Brief t1036-g: W1 and W2 combined, conflicts, broken tests, one scripted Lab run

**Goal.** The lead merged W2's branch (`task/t1038-native-decisions-one-read`) into W1's lane
(`task/t1036-page-diff-delivery`). Core merged clean. The downstream merge is **in progress** (MERGE_HEAD
set) with three conflicts, all in the scripted model:
`packages/test-runner/src/attempt-lane/scripted-model/{scripts/bigbox-retail-rated-delivery-towels.ts,
scripts/tests/bigbox-retail-rated-delivery-towels.test.ts, wire-request.ts}`. Make the combined tree work:
W1's page channel (keyed page views, the query-free page key, stable handles, no look or page search, compact
earlier rounds, judge before-state only after a lasting act) together with W2's native tool calls, one-call
list reads, the read-payload fix (`node-run/rejected-rows.ts`) and the continued-judge routing.

**Context to read.** Both reports, only their summaries and "departures"/"open questions" parts:
`docs/working/page-diff-delivery-plan/reports/t1036-page-diff-delivery.md` and (W2's, in its tree)
`C:/Users/osrs_/FluxStuff/fxwork/t1038/!FluxIQWebExtension/docs/working/page-diff-delivery-plan/reports/t1038-native-decisions-one-read.md`
plus `reports/t1038/c-scripted-lab.md` there (the script lines W2 changed). Read-only git (`git show`,
`git diff`, `git log`, `git diff --name-only --diff-filter=U`) is allowed to see both sides.

**Do.**
1. Resolve the three conflicts by combining both sides' intent; remove every conflict marker. The script
   must answer the requests the combined product now sends (native tool calls; single reads; page deltas).
2. Fix what the combination breaks, at the cause. Known: Core typecheck errors in
   `runtime/llm/anthropic/tests/asked-table-replies.test.ts`; four domain tests that minted handles through
   `find_on_page`; `domain/.../structure/tests/detect.test.ts` assuming a new handle where the same element
   now keeps its own. Then whatever the checks below show. Judge the right side of each failure: a test that
   asserts a removed behaviour is updated; a product regression is fixed in the product.
3. Checks (heavy steps through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1036g -- <cmd>`):
   - Core (`fxwork/t1036/!FluxIQ`): `pnpm --filter fluxiq check`; in `packages/fluxiq`
     `NODE_OPTIONS=--max-old-space-size=3072 node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql
     src/runtime/llm src/runtime/models src/runtime/result-verification src/runtime/answer-first
     src/framework/automation-service/service/answer-first src/runtime/project-agents`; `node scripts/structure-audit.mjs`;
     then `pnpm --filter fluxiq build`.
   - Downstream: in `domain/`, `DOMAIN_TEST_BUILD_LABEL=t1036 node scripts/test-domain.mjs llm-evidence output-nodes
     actions/extraction extraction runtime/tests element-fingerprint target-reacquire state-diff`;
     `pnpm --filter @fluxiq-web-extension/domain check`; `pnpm --filter @fluxiq-web-extension/extension test`
     (W1 changed content-script and e2e code); test-runner build then `node --test` over
     `dist/attempt-lane/scripted-model/**/tests/*.test.js` and `dist/flow-chart/tests/*.test.js`;
     `node scripts/structure-audit.mjs`; `node scripts/check/model-text.mjs`.
4. One scripted Lab run, lab slot 2, headed, with the run watcher, once the checks pass:
   `FLUXIQ_LAB_INSTANCE=t1036-lab node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1036-lab -- pnpm lab attempt bigbox-retail --task bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts 4`.
   Expected: attempt 1 is confirmed (no `read_invalid`, no `before_state_missing`) and attempts 2-4 run the
   saved Flow with their continuation proofs. Open each attempt's `flow.png` (attempt-N/) and say what it
   shows. If a later attempt needs model replies the script lacks, extend the script for what the product
   rightly asks, never to paper over a product defect. At most one relaunch per distinct, fixed cause.

**Owned.** The three conflicted files and everything under `packages/test-runner/src/attempt-lane/scripted-model/**`;
the broken tests named above and any test or product file the checks prove broken by the combination,
in both trees (`fxwork/t1036/!FluxIQ`, `fxwork/t1036/!FluxIQWebExtension`).
**Must not touch.** W3's files: Core `runtime/flow-authoring/**`, `decision-handlers/amendment.ts`,
`draft-amendment-feedback/**`, `evidence-loop/held-amendments.ts`. The shared Core `fxwork/!FluxIQ`. No
`git add/commit/merge/stash/checkout/reset`; the lead commits. No paid or live run. No `node -e`.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1036/g-combined.md`: each conflict's resolution,
each fix and its cause, every command with its observed result, the Lab run's verdict per attempt and what
each flow.png shows. End with the return contract.

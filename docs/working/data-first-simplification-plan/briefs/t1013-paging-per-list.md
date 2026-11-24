# Paging is settled per list, and a next-page with no list on the page is refused (t1013)

Lead: Claude Code session, 2026-11-24. Tier: worker-heavy.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t1013/!FluxIQ` (Core task branch) and `t1013/!FluxIQWebExtension` (downstream; you own its domain part).
Read: this brief; t1008's report "Open items" (paging) and t1011's report, open question 2 (`docs/working/data-first-simplification-plan/reports/`); Core `answer-first/result/header.ts`, `result-feed/feed.ts`; the domain's next-page output (`web.output.dom-next_page`) in `domain/src/**`; and the run below.

Evidence: bikes run-mwug2xjw-41f62603 (`C:/Users/osrs_/FluxStuff/lab-runs/2026-11-24/run-mwug2xjw-41f62603/steps/`; copy it to an ignored `test-runs/t1013-evidence/` first; never print page data).
- The result header kept saying "nothing has said whether a page follows". That pulled the model back to paging checks over and over.
- The `dom-next_page` at step 0089 ran on an item page under a chat dialog and came back "outcome uncertain". The "Load more" find (0093) ran on that same item page, not the list.
- So no evidence ever said anything about the list's own paging. t1008 judged, correctly, that treating it as the end would cut real lists short.

Lead's decision (t1008's recommendation):
1. The domain's next-page answer carries the `listKey` of the list it moved. A next-page whose list is not on the page is refused with a code saying so, not answered "outcome uncertain".
2. Core's feed (`feed.ts` `called`) records paging per list from those answers, and the result header states each read list's paging plainly: a page follows, the end was reached (a next control absent or disabled on that list's own page), or not yet checked. It never says "unsettled" after an observed end.
3. Guidance stays generic.

Steps: implement it across the domain and Core, keeping wire protocol changes synchronized (AGENTS.md: shared protocol types, background routing, domain gateway mappings, tests, docs). Write tests:
- a next-page on a page without the list is refused, naming it;
- a next-page answer carries its listKey;
- the header after an observed end, after a page that follows, and before any check;
- the bikes trail shape no longer reads as unsettled.

Bump `fluxiq` patch over dev's.

Checks, through the heavy gate, one at a time:
- Core named vitest files with their group;
- `pnpm --filter fluxiq check`;
- `DOMAIN_TEST_BUILD_LABEL=t1013 node scripts/test-domain.mjs <fragments>` and the domain check;
- extension tests for any changed content-script path (`node scripts/test-extension.mjs <fragments>`);
- both structure audits.
No full suites, no git mutations, no `node -e`, no provider or paid calls, no Lab runs. A browser spec, if one is needed, is visible, provider-free and on a realistic scenario only.

Owned: Core `answer-first/result/**`, `answer-first/result-feed/**`, the protocol types for next-page answers, and their tests; downstream `domain/src/**` next-page paths and `apps/extension/src/**` next-page paths with their tests, `docs/architecture/` paging docs; and your brief and report.
Must not touch: `answer-first/attempt/**`, `runtime/llm/**` (lane t1014), other worktrees, the shared Core.
Report: `reports/t1013-paging-per-list.md`. End with the return contract.

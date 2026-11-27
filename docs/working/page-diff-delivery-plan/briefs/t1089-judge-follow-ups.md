# Brief t1089: two judge follow-ups from t1084 and t1087

**Goal.** Finish two judge changes that crossed lane boundaries.

**1. Row handles reach the Flow-less judge's first ask (K5).**
- t1087 gave rows that share a label distinct handles:
  - `automationStudioResultSummaryWithRowHandles` in `result-verification/request-rows/summary/with/`;
  - the citation rule `AUTOMATION_STUDIO_RESULT_CITATION_RULE` in `result-verification/cited-yes/`.
- `result-verification/flow-less/judge.ts` does not apply them yet. It keeps a local `CITATION_RULE`, so the judge
  learns handles only from Core's refusal on a re-ask.
- **The change:**
  - apply the handles to the summary the judge is sent (t1087's report says after the line building `sent`);
  - use the shared rule instead of the local one.
- **Test:** the first ask of a Flow-less judge over rows that share a label carries the handles and the shared rule.
- Read `docs/working/page-diff-delivery-plan/reports/t1087.md`.

**2. A judge the provider ends up sending on its own request also gets the pages.**
- t1084 gives page views to every judge that does not continue a decider. That covers a judge marked
  `continuesDecider` only while it really continues.
- The Anthropic provider sends such a judge on its own request when:
  - it holds no decider prefix;
  - the continuation is past the window;
  - or the decider offered no answer tool.
- That request was built before the provider decided, so it carries no page views.
- **The change.** Where the provider decides to send the judge on its own request, the page views kept beside the
  summary go into it, under the same rules as t1084's:
  - within the page budget, whole lines, the same order;
  - screened;
  - never in the deciding digest.
- Find the seam that keeps both decisions in one place, rather than building the request twice.
- **Test:** each of the three fallbacks carries the pages; a judge that really continues does not.
- Read `docs/working/page-diff-delivery-plan/reports/t1084.md` ("Things you should know") and
  `result-verification/judge-evidence/page-views.ts`.

**Owned.** Core (`C:/Users/osrs_/FluxStuff/fxwork/t1089/!FluxIQ`):
- `runtime/result-verification/flow-less/**`;
- `runtime/result-verification/judge-evidence/**`;
- `runtime/llm/anthropic/**`;
- `runtime/models/providers/anthropic/continuation.ts` and its neighbours if the seam is there;
- their tests.

**Must not touch.**
- `framework/automation-service/service/answer-first/**` (t1091).
- `engine/**` and `domain/src/**`.
- `packages/test-runner/**` (t1090).
- The judge answer tool's strictness. It stays non-strict: the platform refused its strict grammar, as the header of
  `strict-answer-schema.ts` records.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1089-<label> -- <cmd>`.
- The tests beside the changed files: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dirs>` from
  `packages/fluxiq`, plus `src/runtime/result-verification` and `src/runtime/llm/anthropic` whole.
- `node scripts/structure-audit.mjs` (Core). Group by shared prefix; no one-file groups.
- `node scripts/check/model-text.mjs` (downstream tree).

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1089.md` in the downstream tree
(`C:/Users/osrs_/FluxStuff/fxwork/t1089/!FluxIQWebExtension`), ending with the return contract.

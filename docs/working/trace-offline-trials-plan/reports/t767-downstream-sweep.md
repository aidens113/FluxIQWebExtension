# t767 downstream sweep failures

## Outcome
Partial. 2 of 7 failures fixed (extension, test-runner). The 5 domain failures are caused by Core judging behaviour and were not changed here.

## What changed and why

| package | test | cause | commit | stale/regression | fix |
| --- | --- | --- | --- | --- | --- |
| packages/test-runner | only sanctioned files start a browser... | `offline-snapshot-page/open-web-snapshot-page.ts` launches Chromium directly and was never listed. It opens no page of its own: `open-snapshot-sandbox.ts` only creates `offline: true` contexts whose route answers every request from the recorded snapshot, so no request reaches a network | fc8370c3 (trace P5) | stale test list | added the file to `SANCTIONED` in `src/guarded-browser/tests/launch-containment.test.ts` with the reason |
| apps/extension | a change in the section that stays is an answer... | Timing flake under load, not a regression. Passes alone (0.9 s). The sweep ran it at 2.5 s against a 1.5 s bound, while the look settles by design at about 0.82 s (120 ms change + 700 ms HELD_MS). `settled-look.ts` has no recent change | none | flaky bound | window 5 s -> 10 s, bound 1.5 s -> 5 s in `ignored-press/tests/settled-look.test.ts`. Still proves "before the window ends" |
| domain | 5 repair tests (carried-service-repair x4 incl. missing declaration/start/unresolved binding, carried-row-service-repair x1) | Core refuses the fixture's judge "no". Run detail: `resultVerification.code = core.result.refutation_unsupported` ("both checks answered no without naming a defect Core can find in its own record... 0 records stored"). The saved run is never marked failed, so no repair (`evidence_tool_decision`) task is ever issued (only `loop_verification` x2..4 calls). The `core.check.authorization_absent` / `verdict_unavailable` codes in the sweep log are noise | Core 534c41fb (t752, 2026-10-21, "Require grounded judge defects") and its `runtime/result-verification/located-defects` + `agreement/unsupported-no.ts` | Core behaviour change; fixture stale in part | NOT fixed (Core). See below |

## Domain cause detail (for Core / t766)
1. Since 534c41fb a current negative verification reply must carry `diagnosis.defects` (schema `required: ["answersRequest","defects"]`). The fixtures in `domain/src/runtime/tests/carried-service-repair.test.ts:129` and `carried-row-service-repair.test.ts:147` reply `{answersRequest:"no", changed}` only.
2. I tried adding a well-formed defect (`wrong_value`, row/column "message", value "wrong", requestWords "set its message to right"). The reply is then accepted (still 5 failures), but `automationStudioResultDefectsLocated` finds nothing: these fixtures are act-only Flows that store 0 records, and a defect is located only in Core's stored answer rows or read records. The no is unsupported, re-asked once, and ends `unsure` / `refutation_unsupported`, never `does_not_answer`.
3. So the real question is a Core decision: should an act-only run (no records, page-state result) have any way for a judge's no to be supported (e.g. `kept_not_asked` / `wrong_value` locating against acts or observed page text), or should these fixtures store a record the defect can name? Either is Core's contract or a fixture redesign (store a row the judge can name), not a one-line domain fix. I reverted my fixture edit so the tree holds no half-fix.

## Commands run and observed results
- `DOMAIN_TEST_BUILD_LABEL=t767 node domain/scripts/test-domain.mjs carried-service-repair carried-row-service-repair` -> before and after the defects experiment: 5 not ok (same 5), 2 ok (adapter permission cases).
- Temporary dump of run `resultVerification` (removed): showed `refutation_unsupported`, `verdicts: [does_not_answer x4]`, `0 records stored`.
- `cd packages/test-runner && pnpm run build` then `node --test dist/guarded-browser/tests/launch-containment.test.js` -> ok 1-3, pass 3, fail 0.
- `EXTENSION_TEST_BUILD_LABEL=t767 node apps/extension/scripts/test-extension.mjs ignored-press/tests/settled-look.test` -> 12 pass, 0 fail (before edit also 12 pass alone; confirms flake).
- `pnpm exec tsc -p tsconfig.json --noEmit` in apps/extension -> no output (clean). `pnpm run build` in test-runner compiled with tsc, no errors.
- `node scripts/structure-audit.mjs` -> passed (226 warnings, 616 baselined).

## Not verified
- Domain typecheck not run (domain files net unchanged).
- The extension flake's cause under load is inferred from timings (2.5 s in sweep vs 0.9 s alone), not reproduced under load.
- Whether any other domain tests besides these 5 depend on the same Core rule.

## Open questions
- Core decision above (act-only no support). Cause commit attribution to 534c41fb is from reading the diff and the `unsupported-no.ts` rules; not bisected.

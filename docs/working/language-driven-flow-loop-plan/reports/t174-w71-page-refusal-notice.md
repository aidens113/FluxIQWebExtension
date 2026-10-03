# t174-w71-page-refusal-notice (F40) — worker report

Worker `t174-w71` (worker-high), brief in `reports/t174-lead-1002L.md`. Tree `fxwork/t174/!FluxIQWebExtension`. No live run, no provider call, no commit.

## Outcome

Done. **Ready to commit** (exact files under "What changed"). One file outside the brief's ownership was edited (`domain/src/runtime/llm-evidence/tool-rejection.ts`); see Open questions.

A press on a non-link control whose page then writes a short line in the control's own region saying it needs something first ("Please select a Color.", "is required", "purchase limit") now fails as `web.action.refused_by_page`. That code is not retryable, says `effect: "unacted"`, carries no page words, and is never pressed a second time. The domain reports it to the model and the card as `refused_by_page` / `page_needs_something_first`, not `action_failed`. The coupon's busy refusal (`web.action.rate_limited`) now also reaches the model as `refused_by_page` / `page_busy_try_later`, not as a bare `action_failed`.

## What changed and why

Root cause (confirmed live, see T2 failing-first). crossborder's Add to cart sits in a fixed `buyBar`, and `errorTip` sits under the options in `itemInfo`. The ignored-press scope (buy bar) therefore saw no sign of an answer, and the busy watch read only bounded region texts with a busy phrase list. So the click pressed again and passed on its hit test.

Extension (`apps/extension/src/content/`):
- `action-runtime/written-lines/{watch-written-lines.ts,index.ts}` (new): a MutationObserver over the pressed control's region. The region is its composed ancestors `REGION_LEVELS` (3) up, never body/html. For crossborder's Add to cart that is `main`, which contains the error line. It also observes shadow roots via `ignored-press/scope-roots`. It returns the short lines the press changed. A line is an element that got text, a child, or a `hidden`/`class`/`style`/`aria-hidden` change, and that is rendered, at most 200 characters long, and neither a control nor holding one. The control rule keeps "a panel the press opened" from reading as a refusal. The pressed control's own label is allowed. A line the page cleared and rewrote counts; an untouched old line does not. It is a new directory because `action-runtime/` already has 25 files, the directory limit.
- `action-runtime/interference/vocabulary.ts` and `index.ts`: `isPageRequirementText`. Its closed list is `please select|choose|pick|enter|fill in|fill out|provide|specify`, `is required` and `purchase limit`. It has no stock, price or availability words, no bare "Required", and no "are required" (a form legend).
- `action-runtime/rate-limit-notice.ts`: the watch takes the written lines at each look. A requirement line yields `{afterMs, needs: true}`, which settles at once and does not wait for a named wait. The existing overtime ("control still working": the spinner, then the purchase-limit line after the server) applies to it too. It is read before the `pressed.isConnected` check. `RateLimitNotice` gains `needs?: true`.
- `action-runtime/results.ts`: `actionRefusedByPage` builds REFUSED_BY_PAGE with fixed texts. `actions/types.ts` adds the `refusedByPage` dependency, and `action-runtime/execute-action.ts` wires it.
- `actions/click.ts`: `refusal()` sends `needs` to `deps.refusedByPage` and everything else to `deps.rateLimited`. This happens on both presses, before the ignored-press rule, so a refused press is never re-pressed. Because the code is not retryable, `recovery/fault.ts` returns no fault for it: no content-side retry.

Domain:
- `runtime/failure/codes.ts`: adds `REFUSED_BY_PAGE: "web.action.refused_by_page"` with `{ category: "unexpected_state", retryable: false, stage: "execution", effect: "unacted" }`, mapped the way TARGET_NOT_ACTIONABLE (the non-retryable precondition failure) is. Core's parser accepts `unacted` on a non-retryable record (`contracts/src/failure/parse-record.ts` forbids only a wait on a non-retryable one).
- `runtime/llm-evidence/action-failure/refusal.ts`: REFUSED_BY_PAGE maps to `refused_by_page` + `page_needs_something_first`, and RATE_LIMITED maps to `refused_by_page` + `page_busy_try_later`. `run_node`'s failure path (`node-run/run.ts:359`, unchanged) goes through `webActionFailureRefusal` and `pageRefusal`. The model therefore sees the code and reason plus the page carrying `t968 "Please select a Color."`, and the card reads `web.action.rejected.refused_by_page`.
- `runtime/llm-evidence/tool-rejection.ts` (outside ownership): adds the rejection code `refused_by_page`, the reasons `page_needs_something_first` and `page_busy_try_later`, and their documentation. It is unavoidable, because the closed code and reason lists live there.

**How `web.action.rate_limited` reaches Core, and where the new code lands.** The content verb builds the record with `webAutomationFailureRecord` (codes.ts row). It travels on `result.failure`, and Core reads it in `executor/defensive/assess.ts` `faultFromRecord`, where `retryable` decides the disposition. RATE_LIMITED is retryable, so it gets "retry", with `effect: "unacted"` letting a mutating node repeat and `retryAfterMs` as the wait. REFUSED_BY_PAGE is not retryable, so it gets **disposition `refuse`**, category **`unexpected_state`**, and effect `unacted`. In the recovery ladder, the `retry_node` rung is not offered (it needs `retryable`). Core's Stage A diagnosis gives **failureClass `unexpected_state`, resolution `model_required`, modelNeeded true**, which is asserted in `codes.test.ts`. In exploration, Core's repeat guard (`llm/repeat-guard/outcomes.ts` `RETRY_LATER`) blocks the identical press on the unchanged page for `page_needs_something_first`. It still allows a repeat for `page_busy_try_later` (it contains "busy"). This is asserted in `refusal.test.ts`.

## Commands run and observed results

Narrow unit runs used `scratchpad/t174-w71-run-tests.mjs`, which bundles the named test files as each package's runner does (own label dir, since removed).

Failing-first, run against my sources before the implementation (new test rows in place):
- domain `failure/tests/codes.test.ts` + `action-failure/tests/refusal.test.ts`: `# pass 12 # fail 5`. These were: closed set table, row categories, parser rows, "every failure code ... is named" (`expected 'refused_by_page' actual 'action_failed'`), and the new repeat-guard words row. The new Core-diagnosis row failed too (`# pass 8 # fail 4` on codes alone).
- extension `click.test.ts` + `rate-limit-notice.test.ts`: tests 32, 33 (click refused rows), 50, 52 and 53 (watch rows) failed with AssertionError. `vocabulary.test.ts` failed to build: `isPageRequirementText` was not exported.
- T2 failing-first: only `writtenLines` was disabled in `PAGE_PROBE`, then restored from a backup and confirmed with grep count 0. `test:content -- press-answers -g "colour un-chosen"` gave `1 failed`: `Expected "failed" Received "succeeded"` with actual "the page ignored the first press, so it was pressed once more; the execution recovered on attempt 3 after absorbing blocking_dialog, blocking_dialog, closing 2 dialogs". This is the run's defect, reproduced.

After:
- domain `failure/tests/*`, `action-failure/tests/*`, `llm-evidence/tests/*`: `# pass 234 # fail 1`. The one failure was `capture-after-action.test.ts` "the default wait is ended by cancellation..." ("the 250 ms wait was cut short"). That file is not mine and is unchanged; re-run alone it gave `# pass 6 # fail 0` (a timing flake under load).
- extension `actions/tests/click.test.ts`, `action-runtime/tests/*`, `interference/tests/*`, `written-lines/tests/*`, `recovery/tests/*`, `ignored-press/tests/*`: `# pass 283 # fail 0`.
- `heavy.sh ... domain check` printed `build-cache reuse` (stamp matched), so I also ran it uncached: `heavy.sh ... npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.test.json --noEmit` (domain), which produced no output (no errors).
- `heavy.sh ... node scripts/check-extension.mjs` (extension check): the first run gave TS2322 (`take()` readonly in a test probe). I fixed the `WrittenLines.take` type, and the re-run gave `exit=0`.
- `heavy.sh ... node scripts/structure-audit.mjs`: `structure-audit: passed (157 warning(s), 118 baselined)`.
- `heavy.sh ... pnpm --filter @fluxiq-web-extension/extension test:e2e:build`: `exit=0`. chrome, firefox and e2e-chromium each verified 22 files.
- T2 `heavy.sh ... test:content -- press-answers --workers=2`: **4 passed**:
  - the new row. Un-choosing Space Grey and pressing Add to cart fails with `web.action.refused_by_page`, retryable false, effect unacted, no "pressed once more", and no page words in expected/actual/message. `errorTip` reads "Please select a Color.", the cart is `[]` after 1.5 s, and the badge reads `0`. After choosing it again, Add to cart succeeds and the cart is `1005008123450 Space Grey x1`.
  - the existing coupon row, where the busy claim is still `web.action.rate_limited` and "busy".
  - the bigbox row.
  - the everything-store row, which is still "ignored twice" and `output_not_observed`.

## Not verified

- No live run (held by the supervisor), no Core tests, no full suites.
- `node-run/run.ts`/`outcome.ts` were not changed (run.ts is 792 of the 800-line limit). A refusal carries the page, but not F37 `changed` lines. If the model should also see `t968 "Please select a Color." appeared` on the refusal, that is a follow-up that needs `changed` added to `WebLlmToolRejection` (tool-rejection.ts).
- The dry-run/replay answer for a replayed press refused this way (w74's `replay.ts`/`replay-answer.ts`) was not checked.
- Core's card text: `activityActionFailureReason("web.action.rejected.refused_by_page")` matches `_refused_` and reads "it wasn't allowed" (Core `ui/activity-action/failure-reason.ts`, not editable here). That is better than "the step wasn't accepted" but not exact.
- Firefox build was not exercised in a browser.
- Firing on other pages was checked only by unit rows. A press that opens content with a short notice line holding no controls, such as "Please enter your email", would read as refused.

## Open questions or contradictions found

1. **Ownership**: the brief lists `llm-evidence/action-failure.ts`, which is now the directory `action-failure/` (I edited `action-failure/refusal.ts` and its test). The closed rejection codes and reasons live in `llm-evidence/tool-rejection.ts`, which the brief does not list. I added 17 lines there (1 code, 2 reasons, docs); the supervisor should confirm. No other worker's diff touches it (`git status` at report time).
2. The brief says `errorTip` is "beside the buttons". It is not: it sits in `itemInfo`, while the buttons sit in the fixed `buyBar`, and both are under `main`. Reading the bounded ancestor texts the way the busy check does would depend on `main`'s first 600 characters. That is why the line watch observes the region for mutations instead.
3. Docs not updated (not owned): `docs/architecture/failure-taxonomy.md` (and `web-capabilities.md` if it lists codes) should gain `web.action.refused_by_page`.
4. Core card wording for `refused_by_page` (see Not verified) is Core's, if wanted.

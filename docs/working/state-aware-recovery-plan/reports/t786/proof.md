# t786 proof: stale target re-acquire, end to end (matrix case 13c)

Worker report for brief t786-proof. Branch `task/t786-stale-target-reacquire`, tree
`C:/Users/osrs_/FluxStuff/fxwork/t786/!FluxIQWebExtension` with Core beside it (read only, not touched).

## Outcome

**Done.** Matrix case **13c** passed headed and provider-free on **photo-social**, on the first run of the final
Flow. Each of its two loop passes failed the bookmark target-not-found three times, re-acquired the row from the read,
and succeeded on the fourth attempt. Core accounted zero model calls. The site shows exactly the two intended posts
liked and saved, each once. The existing social-network-feed cases 13a and 13b still pass.

The vehicle moved from social-network-feed to photo-social, which the brief allows. No fixture was changed. Why social
could not do it is under "Open questions" (1).

## What changed and why

All of it is under `packages/test-runner/src/recovery-matrix/`, plus one paragraph of docs.

- **The Flow:** `flows/like-then-save.ts`, `LIKE_THEN_SAVE`, exported from `flows/index.ts`.
  - It answers the photo-social overlays (all optional): decline cookies, "Not Now", and the dock collapse inside
    `fl-dock`'s shadow root.
  - It then reads the feed's posts: `article:has(a[href$="/liked_by/"] > span)`, with fields `author`, `postLink`
    (a link field) and `likes`.
  - For each of the first two posts (`repeat most: 2`) it presses the heart (`Like`), then the bookmark (`Save`).
    Both clicks carry an `element` identity, because the row scope is written into a recorded element and a selector
    alone carries none.
  - The heart moves the post's own count by one once the server has the like (842 becomes 843). The bookmark's row
    scope then no longer matches any record, so its press fails target-not-found until the re-acquire.
- **The case:** row 13, case `13c` in `matrix-rows.ts`.
  - It is `ready` (`needs: []`), with check `row-reacquired`.
  - `reacquire: { step: "s11", source: "s7", passes: 2, reacquiredPasses: 2 }`.
  - Site expectation: `photo-liked-saved` for `D1OKDvAEHfa` and `D0eFDg0l9aY`.
  - Core keys a saved script's nodes by place, not by the script's step labels, so the case names `s7` and `s11`.
    A compile test now pins that `s7` is the list read and `s11` a lasting click.
- **Types** (`matrix-row.ts`): the check id `row-reacquired`, the capability word `reacquire` (a run with no
  re-acquire record is `not-proven`), the site expectation `photo-liked-saved`, and `RecoveryReacquireExpectation`.
- **The check** (`checks/matrix-checks.ts` `rowReacquired`, plus `checks/step-arrivals.ts`). It holds the floor: zero
  model calls, zero interventions, site as expected, and the run succeeded. It then requires all of these:
  - the step is reached exactly `passes` times;
  - every arrival ends succeeded within 4 attempts;
  - on at least `reacquiredPasses` arrivals, attempts 1 to 3 failed with category `target_not_found` and no record,
    and attempt 4 carries a `found` `row` re-acquire whose source is the read's node, and succeeded;
  - every re-acquire record on the step is `found`, and no other step carries one;
  - Core's activity holds exactly one succeeded `reacquire` recovery row on the step per `found` record, and no other
    reacquire row;
  - activity that was not collected fails the case.
- **The readers:**
  - `records/trace-attempts.ts` reads the runtime session's `trace.attempts` in closed words, with the `reacquire`
    record. Core's run detail (`get-flow-run-detail`, Core `runtime/service/summaries/conversions.ts`) does not carry
    `reacquire`, so the existing `attempt-records.ts` cannot see it.
  - `records/recovery-activities.ts` reads `get-activity` snapshots into recovery rows.
  - `run/activity-watch.ts` polls `get-activity` every 250 ms while the run is in flight, because Core keeps only the
    last 60 events in memory.
  - `run/run-matrix-case.ts` uses both readers only when a case names `reacquire`, so other cases run exactly as
    before.
- **Site** (`records/site-state.ts` `photoLikedSaved`): the liked set must be exactly the expected posts. Both posts
  must be in `saved`. The `like` and `save` operation counts must each equal the number of posts, and any excess is
  counted as duplicated acts. There must be no `collection-*` operation.
- **Tests:**
  - `checks/tests/row-reacquired.test.ts`: the pass case, `not-proven`, too-early, wrong failure, wrong source, fifth
    attempt, failed pass, missing pass, stray record, `gone`, activity missing or mismatched, and the floor.
  - `records/tests/trace-attempts.test.ts`, `records/tests/recovery-activities.test.ts` and
    `run/tests/activity-watch.test.ts`: the new readers and the watch.
  - New site-state case in `records/tests/site-state.test.ts`.
  - `tests/matrix-rows.test.ts`: 15 cases, ready list `1, 13a, 13b, 13c`, and a 13c spec test.
  - `compile/tests/compile-flow-script.test.ts`: the node-key guard.
- **Docs:** one paragraph on case 13c in `docs/architecture/testing-facility.md`, "The recovery acceptance matrix".

## Run evidence (13c, passing run)

- **Matrix run** `rmx-2026-10-28T23-19-52-510Z-e9e3ea`. Bundle:
  `test-runs/instances/t786/recovery-matrix/rmx-2026-10-28T23-19-52-510Z-e9e3ea/case-13c.json`.
- **Core run** `0d284aac-6758-46f2-a513-778bf4ee56fd`, status `succeeded`, 24 attempts, from 23:19:52 to
  23:23:33 UTC.
- **Browser:** Playwright Chromium, headed. `run-scenario/browser-session/launch-browser.ts` hard-codes
  `headless = false`, with a 1280x720 viewport. Build target: the `e2e-chromium` extension under
  `apps/extension/.lab-instances/t786/dist/e2e-chromium`. Lab instance `t786`, `FLUXIQ_TEST_ENV_FILES=none`. No lab
  slot was asked for.
- **Attempt sequence** (run detail, node keys):
  - s1 to s10 succeeded.
  - Pass 1 bookmark: s11 failed `target_not_found/web.target.not_found`, then failed (retry) the same way, then failed
    (retry) the same way, then **succeeded** (retry 4).
  - Pass 2: s8, s9 and s10 succeeded, then s11 failed three times the same way, then **succeeded** on attempt 4.
  - Then s8 and s9 succeeded, and the End (s12) succeeded.
- **Trace, per pass of s11:** `["failed:target_not_found/web.target.not_found" x3, "succeeded reacquire:found"]`,
  for both passes.
- **Re-acquire records, both passes:**
  `{ sourceNodeId: "node.bootstrap.d0cb05f7dcb8d965.main.s7", kind: "row", outcome: "found", reason: null, returned: false }`
  on the succeeded attempt 4.
- **Activity rows, two:** kind `reacquire`, outcome `succeeded`, step s11, subject
  "Found the item from “read the posts in the feed” again".
- **Model calls:** 0, source `cost-accounting`, 0 interventions, 0 itemized calls, 0 harness activations.
- **Site:** liked `D0eFDg0l9aY` and `D1OKDvAEHfa`; 2 like changes and 2 save changes; both saved; 0 collection
  changes; 0 duplicated acts.
- **Measures:** 6 retries, 0 true failures, 0 state routes, 0 false successes.

## Commands run and observed results

- `npx tsc -p packages/test-runner/tsconfig.json --noEmit`: no output, exit 0 (final tree).
- `pnpm --filter @fluxiq-web-extension/test-runner build`: built. `core-build` said Core's build is current with its
  source.
- `node --test $(find dist/recovery-matrix -name "*.test.js")` from `packages/test-runner`: `# tests 78`, `# pass 78`,
  `# fail 0`. That includes "LIKE_THEN_SAVE assembles, validates and is applied as a saved Flow through Core's own path"
  with the node-key guard. The test-runner has no build label, so this is the narrow run of the matrix's own tests.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (232 warning(s), 616 baselined)`, with no
  recovery-matrix finding. An earlier run failed `[imports]` on a cross-directory import; that file was later reverted.
- `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t786 pnpm lab recovery-matrix --case 13c`:
  - **Run 1, failed** (`rmx-2026-10-28T22-58-02-876Z-c56f3b`, social-network-feed, abandoned design). The See-more
    press failed target-not-found four times, because the read had already opened every post's text. Its workspace is
    retained at `test-runs/instances/t786/persistent-isolated/rmx-13c-909eeb5d`.
  - **Run 2, passed** (`rmx-2026-10-28T23-19-52-510Z-e9e3ea`, photo-social). Output
    `{"caseId":"13c","verdict":"passed","reasons":[]}`, exit 0.
- `... pnpm lab recovery-matrix --case 13a --case 13b`: both `passed`, exit 0 (`rmx-2026-10-28T23-25-06-057Z-7a2a85`).
  - 13a: run `4a66d230-…`, succeeded, 0 calls, 4 confirmed, 1 rate-limited, 1 retry.
  - 13b: run `080e03d7-…`, failed as authored, 0 calls (gate declined), 3 confirmed.

## Not verified

- **Only one passing run of 13c.** There is no repeat run, so flakiness is not measured.
- **No Firefox run.** Only the e2e-chromium build ran.
- **What the extension's chat card showed was not looked at.** The activity row is read from Core's stream, not from
  the panel.
- **Not exercised:** the `gone`, `unmatched` and `unavailable` outcomes live, a re-acquire on the exploration or
  draft-test path (D7 domain `node-run`), and an `output` lineage.
- **No photo-social regression case.** None exists in the matrix, so the regression rerun used social-network-feed's
  13a and 13b, which exercise the shared runner, site and check code I changed.
- **No full suites were run** (repository rule).

## Open questions or contradictions found

1. **Why the brief's social-network-feed shape cannot be built without a fixture change** (so no fixture was
   changed):
   - Its Like changes only the button's own `aria-label` ("Like" to "Remove Like") and a class. The post's text still
     contains "Like", and the page's row gate matches by substring (`content/identity/record.ts` `holdsRowValues`), so
     no value a read can take disappears. The other actions share the same class string, so a class column fails the
     same way.
   - The reactions count does not move on Like.
   - "See more" was the next candidate, but a list read discloses each kept row's collapsed text itself (t752, the
     default unless `discloseText: false`, which turns a cut field into a refusal). The read stored the whole text and
     had already pressed See more, so the Flow's own See-more press found nothing. This is product design, not a
     defect.
   - Hide replaces the article, so a re-read would answer `gone`, not `found`.
2. **The run detail drops `reacquire`.** Core's conversion (`runtime/service/summaries/conversions.ts`) does not copy
   the attempt's `reacquire` into `get-flow-run-detail`, so a run-detail reader cannot see it. The matrix reads the
   runtime session's trace instead.
   - Run 1 incidentally exercised the mechanism on the See-more step: re-acquire before attempt 4, re-read s9, then
     attempt 4 still failed. That is consistent with the read's rows holding whole text. Its record outcome was not
     captured; the check now lists every record's step and outcome.
3. **Positional node keys.** The case names `s7` and `s11` because Core keys a script's nodes by place. Inserting a
   step before them would shift the keys; the compile guard catches that.

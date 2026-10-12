# t417: matrix round 2 (worker report)

Trees: downstream `fxwork/t417/!FluxIQWebExtension` (dev `6033b50d`) and Core `fxwork/t417/!FluxIQ` (dev `c95e6563`),
both on `task/t417-matrix-round-2`. Nothing is committed. Core is unchanged.

Before the first launch, Core libraries, domain, the host bundle, extension, scenario-lab and test-runner went through
the build cache. Every step reused its stamp, except the domain host build, which rebuilt (no stamp).

Every launch was `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case <id>`:

- headed;
- provider-free;
- one case per launch;
- no `FLUXIQ_LAB_ALLOW_*` override;
- no `lab-slots/`.

## Outcome

**Done.** All 14 provider-free cases passed on their first launch: rows 1-11 and 13 with every case, and row 12
skipped as paid. Every case ran with zero model calls. No case failed, so nothing was debugged or rerun for a failure
and nothing was sent to main.

Row 10 was launched a second time, and it passed again. That launch was only to put handler timings in its bundle: the
first launch ran before the bundle carried attempt timings.

## Verdict per case (from each run's own records)

Bundles are `test-runs/recovery-matrix/<matrix run>/case-<id>.json`. Every passing case's workspace is removed by
design, so the bundle is the evidence. All runs are on 2026-10-10. The "Site acts" column is read from the scenario's
`/__control/final-state`.

| Case | Verdict | Matrix run / Core run id | Required behaviour, as the records show it | Lifecycle, entry, routing, skips | Failure class and stop | Site acts | Calls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | passed | `T09-35-02-266Z-b1fc40` / `60151ac0` | Began at s1, the primary's first step. No entry declared, no jump. | No lifecycle. No entry record. 0 state routes. s3 `target_absent` (optional overlay). | s14 `action_failed/web.action.rate_limited`, 1 retry. Succeeded, no stop code. | 3 pieces, 1 add, coupon held | 0 (cost-accounting) |
| 2 | passed | `T09-36-10-298Z-189842` / `e416d149` | First attempt s7 with an entry record `entry`. The store steps never ran. | Entry `s7:entry`. 0 routes. | None. Succeeded. | towels ×2 + soap, store 1187 | 0 |
| 3 | **passed** (round 1: not-proven) | `T09-37-00-088Z-885ab8` / `8930f125` | The primary ran s1-s12 and called `filtered-read`. The part's frame (depth 2) carries the entry record `default`. It re-ticked the 5 filters (part s1-s5) and read (s6). The `read` shortcut was not taken. | Entry `filtered-read.s1:default`. 0 routes. | **0 retries** (round 1: 7, cause C6). Succeeded. | cart unchanged (soap ×1) | 0 |
| 4a | passed | `T09-38-22-847Z-5879a6` / `9ae259b5` | The `on before` handler h1 closed the arrival deal before s1 (body h1-s2, h1-s3). The run carried on. | `s1:before:resume(h1-s1)` | s14 rate_limited, 1 retry | 3 pieces, 1 add, coupon | 0 |
| 4b | passed | `T09-39-24-883Z-81c203` / `687e9441` | Same handler, before s7 on the product page. | `s7:before:resume(h1-s1)` | s14 rate_limited, 1 retry | same | 0 |
| 5 | passed | `T09-40-30-023Z-84456e` / `ca57f09e` | The handler ran **3×** (round 1: 4×), each with completion check false. It did not run before the s9 merge node (C11 closed). No loop. | 3 × `before:unhandled:completion_check_not_true` (s7, s8, s10) | Honest end `unexpected_state/web.action.blocked_by_dialog`, failed. Most attempts on a node: 3. | cart 0, no coupon | 0 (gate declined, `llm.gate.training_mode`) |
| 6 | passed | `T09-41-31-579Z-8a55fa` / `ee425ba2` | Only the node-scoped `main.h1-s1` ran. The automation-wide one did not. | `s1:before:resume(h1-s1)` | s14 rate_limited, 1 retry | 3 pieces, 1 add, coupon | 0 |
| 7 | passed | `T09-42-33-931Z-797a63` / `5dbb27db` | The active block's `h2` answered consent. The inactive `store` block's handler never ran. Handler ids were read. | `s1:before:resume(h2-s1)` | None | soap only | 0 |
| 8 | passed | `T09-43-15-979Z-955fcd` / `ddfaa1e0` | Main s6 called `product-page`. The part's Add to cart (s2, depth 2) was missing under the redesigned buy box: first try plus 3 retries. The fail handler's call ran `quick-add` (depth 3: s1-s3) and resolved with `cart`. | `s6:fail:resolve(h1-s1)`. Part attempts at depth 2 and 3. | 4 × `target_not_found/web.target.not_found` on part s2 (`no_pre_states`). Succeeded. | soap ×2 | 0 |
| 9 | **passed** (round 1: failed) | `T09-44-30-336Z-68d8df` / `9d8a7761` | Jonas's confirm (s10, committing act 7) lost its acknowledgement (`fault.fired` 09:45:14.980). The attempt settled `succeeded` after 30.08 s. The next committing presses in the relay log are Lin's and Freya's only: there was **no second Jonas press**. | None | No failure. Stop code null. Succeeded. | 4 confirmed once each, rateLimited 0 | 0 |
| 10 | **passed** (round 1: failed) | `T09-31-05-322Z-45f320` / `643ac3cf`; timing launch `T09-50-22-526Z-5cdd3b` / `62abb69f` | Freya's confirm (s13) was refused for going too fast. The retry handler waited, closed the notice and routed to the checkpoint s9, the new requests-page wait. Amara, Jonas and Lin (s10-s12) were **skipped `already_done`**, then Freya was confirmed. | `s13:retry:route(h1-s1)`. Skips `s10, s11, s12: already_done`. 1 checkpoint route, 0 state routes. | s13 rate_limited, closed by the route. Succeeded. | 4 confirmed, 4 confirmations, rateLimited 1 | 0 |
| 11 | **passed** (round 1: failed) | `T09-46-02-636Z-835052` / `6de0c0bb` | The worker was stopped as add-to-cart reached the site. It restarted 1.8 s later (`worker.restarted`, `sameTarget: true`). The add landed once. s15 settled `succeeded` after 30.07 s, keeping `ambiguous_or_unknown/web.action.unknown`. | s3 `target_absent` | s14 rate_limited, 1 retry. s15 reconciled from the page. Stop code null. Succeeded. | 3 pieces, **1 add**, coupon | 0 |
| 13a | passed | `T09-47-34-254Z-2d5e2d` / `9e5ed3d0` | Freya's refused confirm (s12) was absorbed by the node's retry. | None | 1 retry | 4 confirmed, rateLimited 1 | 0 |
| 13b | passed | `T09-48-49-616Z-13ffc8` / `207cabbd` | The check s12 failed on all 4 attempts. Its failed path ended at the End s14, marked failed. | None | `timeout/web.action.timeout`, 3 retries, planned | 3 confirmed | 0 (gate declined, `llm.gate.deliberate_stop`) |

Chat recovery rows are not in any bundle. As in round 1, the matrix runs Flows through `executeRecordedFlowRun`, not
the chat.

## Measures against round 1

| Measure | Round 1 (t404) | Round 2 (this) |
| --- | --- | --- |
| Deterministic recovery rate | 15/18 = **0.83**. Open: row 5's intended end, and the uncertain stops of 9 and 11. | 16/17 = **0.94**. Open: only row 5's intended honest end. |
| True failures / retries / planned fails | 3 / 17 / 3 | 1 (row 5, intended) / 12 / 4 |
| Model calls | 0 | **0** in all 15 launches |
| Wrong routes | 0 | **0**. No state route in any run. The one checkpoint route (row 10) went where it was authored. |
| Duplicated acts | 0 | **0**. Every confirm and add landed once, rows 9-11 included. |
| False successes | 0 | **0** |
| Handler-check overhead | mean **+38 ms** per boundary (+3 to +81, 15 boundaries) | mean **−1 ms** (−11 to +9, 13 boundaries), row 6 vs row 11. Within the pacing noise. |
| Handler body time | row 5: 4.8-6.0 s per inert body; row 10: 27.8 s (16 s wait) | row 5: **2.0-2.25 s**; row 10: **24.6 s** (16.0 s wait) |

How each round-2 measure was read:

- **Recovery rate.** This is a per-incident count, the same method as round 1. The runner's own measure sums to 11/12
  = 0.92: it does not count a handler-closed popup, or a lost acknowledgement that settled `succeeded`, as an
  incident. The 17 incidents are:
  - rate-limit retries: rows 1, 4a, 4b, 6, 11 and 13a;
  - popups closed by a handler: rows 4a, 4b, 6 and 7;
  - row 5: the optional s8 (planned) and the s10 honest end;
  - row 8: the alternative part;
  - row 9: the reconciliation;
  - row 10: the route;
  - row 11: the worker restart;
  - row 13b: the authored stop.
- **Handler-check overhead.** This is the gap from one attempt's end to the next attempt's start, compared at the same
  steps between a Flow with handlers in scope and the same Flow without them. It covers only boundaries where no
  handler ran. Against row 1 (no handlers): row 6 −8 ms, 4a −6 ms, 4b −4 ms, 5 −11 ms. The pacing gap at these
  boundaries is ~1.06-1.18 s or ~0-70 ms, and ±60 ms is the run-to-run spread.
- **Handler body time** is from the first body attempt's start to the last one's end, from the attempts' own
  `startedAt`/`finishedAt` (t411 slimmed the body inputs). By row:
  - **Row 5:** 2.09, 2.01 and 2.25 s. The close press takes 0.94-1.19 s; the rest is the 1.1 s pace.
  - **Rows 4a, 6 and 7** (a body that cleared a popup): 2.87, 2.92 and 2.89 s. The press takes ~1.77 s, plus the
    pace.
  - **Row 10:** the body took 19.29 s: the authored wait 16.01 s, the close 2.24 s, and the handler end. A further
    5.30 s passed from the refused attempt's end to the body's first node. From the refusal to the checkpoint step
    took 24.62 s, against round 1's 27.8 s.
  - **Row 8:** the fail body (a call of `quick-add`, 3 nodes) took 6.62 s. It began 1.06 s after the part's fourth
    failed attempt.

## What changed and why

All changes are under `packages/test-runner/src/recovery-matrix/`. No product file was changed.

- **`flows/confirm/with-checkpoint.ts` (row 10, the brief's fixture fix).**
  - The checkpoint left "see all friend requests". That step is a press of a link only the Friends home shows, so
    the route back landed on a step that could not run there (t411).
  - The checkpoint is now a new step `requests: wait for the friend requests page`. It is a
    `web.dom.wait_for_selector` on `[role="main"] a[href$="/friends/requests/sent/"]` ("View sent requests"), which
    only the requests page has in its main column (`markup/friends.ts`). It is placed just before Amara's confirm.
  - The route back now runs there, and the ledger skips the three completed confirms. The live run shows exactly
    that.
- **`flows/confirm/tests/opening.test.ts`.**
  - Every friend-request Flow now includes the whole shared opening.
  - New test: row 10's single checkpoint is a requests-page wait with no consequences, directly before Amara's
    confirm.
- **`records/attempt-records.ts` (+ test).** Each attempt now also reads:
  - `skipped` (`target_absent | state_routed | already_done`, with its code; the row name is page text and is
    dropped);
  - the lifecycle's `unhandledReason` and `unhandledGuard` (t411's closed codes);
  - `startedAt` and `finishedAt`.
- **`checks/matrix-checks.ts` (+ tests).**
  - `checkpoint-route` (row 10) now requires each lasting act done before the route to be skipped `already_done`
    after it, and no lasting act to succeed twice. It reports `unhandled` reasons and guards.
  - `known-alternative` (row 8) now needs an attempt on a called part's own step in a nested frame. A handler body's
    nested frame no longer counts. This was round 1's open question 2. Row 8's run meets it: its depth-2 attempts are
    `product-page` steps.
- **`run/run-matrix-case.ts`.**
  - The bundle's per-attempt summary now carries `skipped`, `handler`, `frameDepth`, `startedAt` and `finishedAt`.
  - An unhandled lifecycle reads `event:unhandled:<reason>/<guard>`.
  - A passed case's workspace is removed, so without these the timing measures could not be read.
- **`matrix-rows.ts`.** Row 3's `needs` is now `["entries", "call-subflow"]` (round 1 Not verified). It affects
  `--ready` and the compile test's tolerance only.
- **`tests/measures.test.ts`.** Fixture fields only.

**Timing of the edits.** The edits to records and the runner summary were swapped in while case 10's first launch
ran, as one copy of staged files after a `tsc --noEmit` check. Case 1's prelude then rebuilt test-runner, and every
later launch ran on it. The verdict logic was the same for all 14 launches.

The row 3 and row 8 edits came after the launches. Row 8's verdict was re-read against the new rule from its bundle,
and it holds.

## Commands run and observed results

- **Builds.**
  - Core: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`. All three
    were `reuse` ("inputs and outputs match the stamp").
  - Downstream: the `domain:build`, `domain:host-build`, `extension:build`, `scenario-lab:build` and
    `test-runner:build` steps. All reused except `domain:host-build` (built, no stamp).
- **Matrix and perturbation tests.** `node --test dist/recovery-matrix/*/tests/*.test.js
  dist/recovery-matrix/tests/*.test.js dist/recovery-matrix/flows/*/tests/*.test.js dist/perturbations/tests/*.test.js`
  in `packages/test-runner`, run after the final `test-runner:build`. Result: `# tests 77 # pass 77 # fail 0`.
  - The suite includes the compile test, which saves every row's Flow through Core.
  - Before the row 3 and row 8 edits it read `# tests 76 # pass 76 # fail 0`.
- **Typecheck.** `npx tsc --noEmit -p tsconfig.json` in test-runner exited 0, after each edit.
- **Structure audit.** `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"` printed
  `structure-audit: passed (184 warning(s), 651 baselined).`
- **Launches.** 15 in all: 14 cases plus row 10's timing launch. Every launch exited 0 with verdict `passed`. Each
  took 43-209 s.

## Not verified

- **Row 9's reconciliation is shown by behaviour, not by a trace record.** The evidence is the attempt settling
  `succeeded` after the 30 s wait, and the relay log having no second Jonas press. Core's gateway tags the settled
  result `metadata.reconciled: "landed"` (Core
  `packages/fluxiq/src/client-gateway/service/command-reconcile/reconciled-result.ts:38`), and audits
  `command.reconciled`. Nothing under `programs/automation-studio` reads that tag, so the run detail does not show it,
  and the check cannot require it. The workspace is removed on a pass, so the audit was not read.
- **Row 11's "reconciled from the page"** is read from the attempt (`succeeded` with its `web.action.unknown` kept, 30
  s) and the site's single add. The effect-check record that decided it is not in the bundle.
- **`run.outcome_uncertain` was not exercised live.** Rows 9 and 11 now recover, so no run stopped uncertain.
- **The 5.3 s in row 10** between the refused confirm and the handler body's first node is not broken down. It is
  probably the batched fact check plus the effect check before the route, but nothing that would show it was kept.
- Chat recovery cards (not in bundles), full suites and paid runs (row 12) were not run, as required.

## Open questions or contradictions found

1. No product cause is open: no case failed.
2. **Trace gap (observation, not a failure).** The run detail does not carry the gateway's reconcile outcome. A
   reader of the run therefore cannot tell a reconciled act from an ordinary success. The files are Core
   `client-gateway/service/command-reconcile/reconciled-result.ts`, which writes the tag, and
   `programs/automation-studio/runtime/service/summaries/conversions.ts`, which does not project it. If the plan's
   "trace shows why" applies to row 9, this needs a projection, and then the row 9 check should require it.
3. **`docs/architecture/testing-facility.md` is still stale**, as in round 1: `flash-deal-stuck`'s code, the
   authoring-gap paragraph, and `drop-action-result` documented by count only. It is not my file.
4. The confirm site's rate limit again fell on the fourth confirm in rows 10 and 13a. Round 1's Lin-refused launch did
   not recur.

# Report: live-lane-3 (social-network-feed, photo-social)

Lead: `live-lane-3` (lead-xhigh). Lane tree `C:/Users/osrs_/FluxStuff/fxwork/t566`, slot `lab-slots/slot-3`,
instance `bf-slot-3`. Fixes 1-4 were committed by the coordinator in integration round 1 (downstream `8739b552`, Core
`ee1ebab2`) and merged to dev; the tree was then synced to dev `48cdbfee` / Core `c1ed1bdd` (lead rebuilt Core's dist).

**Stopped 2026-10-18 at the session wrap-up (coordinator).** Uncommitted in `fxwork/t566`: only
`docs/working/language-driven-flow-loop-plan/debugs/run-mvd94oxq-e2b9abb5.md` (run 5's debug) and this report's
update. Nothing uncommitted in Core.

**Scope (coordinator, from the user):** one full end-to-end pass per site: social-network-feed with
`recent-group-posts`, photo-social with `kiln-notes`; then rerun `hide-suggested-posts` until it passes, to prove
fix 4 live. Not reached before the stop: `kiln-notes` and the `hide-suggested-posts` rerun.

## Fix log

| # | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- |
| 1 | Extension `content/extraction/page-advance/`: `scroll-for-more.ts`, `step-page.ts`, `move-page.ts` (header), `list-loading.ts` (new), `found-way.ts` (new), `tests/scroll-loaded-list.test.ts` (new). Next page on a scroll-loaded list waits while the page shows the list loading (aria-busy, progressbar, placeholder added to the tail, tail still changing; at most 15 s a call) instead of answering `scrolled_to_end`; a list with no detected way scrolls when the page shows no Next | run-mvcvzwk1-c1d869e4 (read ended after page 1; Core told judges there was no further page) | `test-extension.mjs src/content/extraction src/content/actions/tests/scroll src/content/actions/tests/extract-list next-page` -> 376/376; `scroll-loaded-list` 9/9 (5 fail on old code); extension tsc (src and test) clean | **verified live**: run-mvczv4jn-1b61183c paged the feed by scroll to its end (3 pages, 71 items) |
| 2 | Core `runtime/flow-bootstrap/parameter-schema/{fit.ts,index.ts,tests/fit.test.ts}` (new), `plan/validation.ts`, `plan/issue-feedback.ts`, `plan/tests/validation.test.ts`, `activity/wording/issue-words.ts`: submit refuses a structured parameter that misfits the schema its node publishes (missing required, unknown key where closed, enum, type) as `bootstrap.parameter_schema_mismatch`, naming field and allowed fields; a domain's bound contract is asked first and the schema only holds a value the contract accepts (lead correction: the first version pre-empted `web.extract.unknown_mode` and its accepted-shape feedback). Downstream `apps/extension/src/content/actions/scroll.ts` + `tests/scroll.test.ts` (new): an unreadable scroll request is refused (INVALID_PARAMETER), never the legacy move to 0,0; `domain/src/actions/schemas.ts` (scroll request closed), `domain/src/client/gateway-action-parameters.ts` + `tests/gateway-command-parameters.test.ts` | run-mvcvzwk1-c1d869e4 (`scroll: {"until":"stopsGrowing"}` accepted, jumped to top 40 times a trial) | Core `vitest run runtime/flow-bootstrap/plan runtime/flow-bootstrap/parameter-schema` -> 21 files / 244 passed (after the correction); domain `test-domain.mjs src/output-nodes/extract/tests/parameter-contract` 6/6; extension scroll 7/7; domain `src/client/tests src/actions/tests src/output-nodes/next-page` 71/71 | tests pass; not exercised live (no invalid parameter written since) |
| 3 | Core `runtime/flow-bootstrap/candidate/{trial-gate.ts,trial-stop.ts (new),index.ts}`, `subflow-candidate/subflow-trial-gate.ts`, `activity/candidate/trial-words.ts`, `executor/graph-run.ts`, `executor/repeat-progress/{no-progress.ts,index.ts}` (new), `nodes/control-flow/repeat.ts` (header), tests beside: an execution-failed trial carries `stoppedBy` (step, limit or runner) and a repeat of it closes the revision; a Repeat stops as `repeat.no_progress` after 3 passes with no new rows and no page change | run-mvcvzwk1-c1d869e4 (two 500 s trials, feedback named no step) | Core vitest over the 8 changed folders 193 files / 1632 passed | **`stoppedBy` verified live** (run-mvd0qwhi-5f7dbf80 feedback named step 17, its pass and `web.target.ambiguous`); no-progress guard not exercised live |
| 4 | Domain `output-nodes/targets/row-scope.ts`, `actions/types.ts` (record `values` doc), tests `output-nodes/targets/tests/row-scope.test.ts`, `output-nodes/tests/native-runtime.test.ts`, `runtime/llm-evidence/node-run/tests/replay.test.ts`, `client/tests/gateway-mapping-identity.test.ts`; extension `content/action-runtime/resolve-target.ts`, `content/action-runtime/pass-row/{index.ts,resolved-for-pass.ts}` (new), `content/action-runtime/tests/pass-row-resolution.test.ts` (new), `content/identity/{record.ts,index.ts}`. A `repeat over` step's element target always carries the pass's row values; the page presses a control that sits in no repeated row as recorded, and otherwise resolves it only inside the pass's row (by its values), failing not-found rather than pressing another row's | run-mvd0qwhi-5f7dbf80 (pass 1 hid the post the build had looked at, not row 1; pass 2 met 11 identical "Hide post" buttons, `web.target.ambiguous`) | `test-extension.mjs content/action-runtime/tests content/identity/tests content/actions/tests` -> 447/447; `test-domain.mjs src/output-nodes/targets/tests src/output-nodes/tests/native-runtime src/runtime/llm-evidence/node-run/tests src/client/tests` -> 360/360 | tests pass; not yet live (the hide-suggested rerun was not reached) |

Checks over the whole lane tree (lead, 2026-10-17): extension `tsc -p tsconfig.json` and `tsconfig.test.json` clean
(after one lead fix: a TS2352 cast in `scroll-loaded-list.test.ts:314`); domain `tsc` (src and test) clean; Core
`tsc --noEmit -p tsconfig.json` clean; `node scripts/structure-audit.mjs` passed in both (downstream 205 warnings,
638 baselined; Core 397 warnings, 1155 baselined); Core dist rebuilt from the final source.

**Pre-existing failure, not this lane's:** `domain/src/runtime/tests/carried-service-repair.test.ts` "actual saved
repair refuses missing start before full-test actions" fails (status `succeeded`, repair ran click/type twice). The
lead bisected: it still fails with fix 4's domain files at HEAD, with fix 2's domain files at HEAD, and with every
lane-3 Core change at HEAD (Core rebuilt each time), so it predates lane 3 on dev `fb3919e2` / Core `76d66fe8`.

Run 5 (run-mvd94oxq-e2b9abb5, synced dev) verified live again: fix 1 (feed paged by scroll to its end, 4 pages) and lane 1 fix 2b (author and the full aria-label date read right in every template). Open product items it exposed: a dedupe by an excluded column whose value carries a per-showing tracking parameter did not collapse a repeated post (`dedupes: false`; not verified whether an excluded column can drive a dedupe), and reads cannot reveal an item's own truncated "See more" text.

Follow-ups noted, not done: Core `service/candidate-trial/run.ts` should catch a throw after execution and report the
steps run; `feedback.ts:211,320` should keep the stopping step when it cuts the list at 40; the one-page read's
reveal (`content/extraction/list-wait.ts awaitListComplete`) has the same 900 ms window as fix 1;
`apps/extension/src/shared/dom-element.ts` `record.values` doc wants one sentence matching `domain/src/actions/types.ts`.
Lane 4 owns the failed-build chat card wording (run 1's repeated "nothing was put into the Flow" lines). Lane 1 owns
the mixed-template column cause (its fix 2b), routed by the coordinator.

## Queue

| Task | Runs (run id: verdict, billed cost, calls) | Status |
| --- | --- | --- |
| social-network-feed-recent-group-posts | run-mvcvzwk1-c1d869e4: failed, $0.076, 55 calls (paging ended at page 1; invalid scroll; out of time). run-mvczv4jn-1b61183c: failed, $0.091, 74 calls (paging fixed, 3 pages / 71 items; positional column key read the author as `posted` in group posts). run-mvd94oxq-e2b9abb5 (synced dev, lane 1 fix 2b in): failed, $0.107, 66 calls (author and full date now right; recap post stored twice, dedupe by an excluded tracked URL reported `dedupes: false`; text cut at "See more"; group read as the audience label) | **open**: three failures on three different causes (paging, template columns, dedupe / truncated text) |
| social-network-feed-hide-suggested-posts | run-mvd0qwhi-5f7dbf80: failed, $0.114, 126 calls (row-bound click ambiguous on pass 2; fixed by fix 4) | rerun queued to prove fix 4 live; not run (stopped at wrap-up) |
| social-network-feed-delete-stranger-requests | run-mvd1j7jt-0c12a50c: **passed**, $0.028, 36 calls, oracle passed | passed |
| social-network-feed-claim-found-key | | out of scope now |
| photo-social-priya-tags | | out of scope now |
| photo-social-newest-likes | | out of scope now |
| photo-social-august-over-1300 | | out of scope now |
| photo-social-kiln-notes | | not run (stopped at wrap-up) |

Launch shape (each run): `pnpm.cmd lab run <site> --live-llm --llm-profile lab-create-flow --llm-provider deepseek
--llm-model deepseek-flash --authoring-mode project --llm-task create-flow --instruction-task <task> --target
persistent-isolated --workspace bf-<task> --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250
--llm-max-run-tokens 48000000`, with `FLUXIQ_TEST_TARGET=persistent-isolated`, `FLUXIQ_DEMO_HEADLESS=false`,
`FLUXIQ_LAB_INSTANCE=bf-slot-3`, `FLUXIQ_LAB_CORE_BRANCH=task/t566-a8-lane-4`, `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`.

Debugs: `docs/working/language-driven-flow-loop-plan/debugs/{run-mvcvzwk1-c1d869e4,run-mvczv4jn-1b61183c,
run-mvd0qwhi-5f7dbf80,run-mvd1j7jt-0c12a50c,run-mvd94oxq-e2b9abb5}.md`.

Total billed across the lane's five runs: $0.416 (0.076 + 0.091 + 0.114 + 0.028 + 0.107).

## Pre-checks

- Relative `url` oracles (`delete-stranger-requests`): same-origin absolute URLs already match a root-relative
  expected value (`packages/test-runner/src/run-expectations/extraction/judgement.ts:45,291`).
- Empty right answer (`august-over-1300`, also lane 4's `halvard-labs-office-jobs`), traced read-only: it can pass.
  Core stores a zero-row dataset when a read keeps no rows from a page that shows items
  (`record-capture.ts:69-81`, `run-dataset-store.ts:181-188`), and the Lab compares count 0 with 0. It fails when
  (a) the read itself fails (no batch, "stored no extraction records", `flow-lane/expectations.ts:267`); (b) an
  earlier read in the Flow stored rows, since with no expected keys the first dataset written is the one judged
  (`creation/judgement.ts:73-89`); (c) the playback result check answers no twice, which the build's yes cannot hold
  off on zero rows (`run-outcome.ts:323-329`, `same-stored-rows.ts:14,29`); (d) the final state does not hold.

# t194 live lane C: the Flow judges its own answer

Lane lead report. Trees: `C:\Users\osrs_\FluxStuff\fxwork\t194\!FluxIQWebExtension` and its Core
`C:\Users\osrs_\FluxStuff\fxwork\t194\!FluxIQ`, both on `task/t194-live-judge-answer`, cut from dev
`defcbe2d` (downstream) and `f0dbbd6` (Core). Slot `lab-slots/slot-3`, instance `t194-slot-3`, headed,
deepseek-flash, production profile, 48k in / 8k out / 56k per call, 48 calls, $0.25 cap.
Launcher: `scratchpad/live-run-c.sh` (t174's `live-run.sh` with slot-3, the t194 tree, and the full Lab
log kept under `scratchpad/t194/`).

Goal: the Flow built from language extracts exactly the scenario's expected dataset, judges its own
answer correctly, and when wrong is refuted, re-authored and re-run until right. Stay on a task until
it passes twice in a row. Task order: `everything-store-plus-earbuds-under-50`,
`local-classifieds-bike-search`, `auction-marketplace-kestrel-auctions`,
`crossborder-marketplace-spain-hubs`, `professional-network-rotterdam-data-engineers`, then the other
`judgeBy: "expected-dataset"` tasks.

## Fix log

Newest first. Status: validated (the named checks ran and passed), or in progress.

| Fix | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- |
| F16 G2: a malformed provider reply's decision record says which malformed case it was, why the provider stopped, and its length and tokens, never its content; malformed replies' tokens now count in the build's accounting and so against the $0.25 ceiling (t194-w17). Cause of the malformations not established | Core `runtime/llm/{reply-account.ts (new), deepseek/{response-envelope.ts, provider.ts, panel-command.ts}, provider-contract.ts, harness/run.ts, unusable-decision.ts, evidence-loop.ts, evidence-loop/progress-trace.ts}` + tests (`deepseek/tests/response-envelope.test.ts` new, `tests/unusable-decision.test.ts`, `harness/tests/run.test.ts`, `evidence-loop/tests/progress-trace.test.ts`), `runtime/tests/deepseek-bootstrap-exploration.test.ts` | run 7: 14 of 35 re-author replies malformed, code only recorded; run 8: 3 of 24 | wrap-up validation (below) | validated; cause open (Top causes #10) |
| F15 The Lab's observed spend counts every model call of the run (build, judge, re-author and its retries, runtime repair) with a per-phase breakdown; a finished repaired re-run's detail says its recovery ended and the Lab treats it as settled (no 306 s idle); a build that ended without a Flow is a product failure (`productFailure.code: flow_lane.flow_not_built`), not a facility failure (t194-w16) | test-runner `src/live-llm/{live-llm-run.ts, index.ts, reauthor-record.ts (new), run-spend.ts (new)}`, `flow-lane/terminal-run-wait.ts`, `run-scenario.ts` (classification lines), `run-scenario/{index.ts, product-failure.ts (new)}` + tests; Core `service/runtime-adaptation/repair-rerun.ts` + test | run 7: `live-llm.json` $0.0418 / 24 calls of a real $0.0861 / 60; 306 s idle; run 5 labelled `scenario.execute/unclassified` | wrap-up validation; run 7's numbers recomputed to 60 calls / $0.086099 (worker) | validated; `scripts/lab/.../reported-spend.mjs` (campaign) still sums build + repair only |
| F14 The judge is told what each condition with its own read actually read: the page reports, per condition, one value (60 characters) its read produced on a row it kept, carried across pages; the domain admits it inside `conditions`; Core renders e.g. `attribute aria-label (read "Brightaisle Plus" on a row it kept) is present`, screened, withheld when not sayable (t194-w15) | extension `content/extraction/{item-filter.ts, filtered-answer.ts, list-reader.ts}`, `content/actions/extract-list.ts`, `shared/extraction-continuation.ts`; domain `actions/extraction/{summary.ts, index.ts, seen-values.ts (new)}`; Core `service/summaries/extraction-summary.ts`, `result-verification/read-account/{condition.ts, accounts.ts}`; tests beside each | run 7: the Plus badge condition read "aria-label present" and the judge advised adding a Plus condition that existed | wrap-up validation | validated. **Decision for the supervisor:** this puts up to 60 characters of page text per condition into Core's stored run record on every read; w15's report gives the change to also screen it at the projection |
| F13 A `next` or numbered read reveals every page it reads to its end (the lazily loaded last results) before reading it, bounded by the deadline; a reveal the deadline cuts short ends the read `timedOut`/`deadline`, never a complete page. The extract dispatch sends its (scaled) `timeoutMs` at the payload top level too, so Core waits as long as the page may read (it waited the gateway's 30 s default) (t194-w13) | extension `content/extraction/{list-reader.ts, list-wait.ts}`, `tests/{store-pager.ts, list-reader-lazy-tail.test.ts}`; domain `output-nodes/extract-list/dispatch.ts` (+ `tests/dispatch-timeout.test.ts`) | run 7: 4 of 13 expected rows sat in pages' lazy tails; `list-reader.ts:487-505` revealed only a one-page read | worker: domain 987/987, extension 1493/1493, extension check rc 0, audit passed; reveal disabled -> 4 of 6 new tests fail | validated (worker); not yet live |
| F12 A re-run after a repair numbers its attempts after the first pass's (`priorAttemptCount`), so the run store no longer drops them as repeated ids; a child Flow numbers its own from one (w7 item 3, applied by the lead) | Core `runtime/executor/{contracts.ts, graph-run.ts, node-execution.ts}`, `service/runtime-adaptation/repair-rerun.ts` (+ `tests/repair-rerun.test.ts`) | runs 4, 6, 7: the re-run's s1-s3 attempts were missing from the bundle and `s3.attempt.3` showed the first pass's success | round-2 combined validation (below) | validated; not yet live |
| F11 A ladder retry, wait or cleared dialog does not spend the subflow recovery budget, so an optional press whose target is absent still takes its authored `failed` route on its third miss (lead) | Core `runtime/executor/recovery-budget.ts` (+ `executor/tests/optional-failed-route.test.ts`) | runs 4, 6, 7: the re-run stopped on the optional "Continue shopping" press | round-2 combined validation | validated; not yet live |
| F10 A `next` read finds the page's own Next when the authored selector names nothing or another page's control, and waits briefly for a pager drawn after the items (t194-w12) | extension `content/extraction/{detect-pagination.ts, pagination.ts}`, `tests/{store-pager.ts, pagination.test.ts, detect-pagination.test.ts}` | run 6: played `a:nth-of-type(6)` named nothing on page 1; run 7: `(4)` read pages 1, 2, 5, 3, 4 | round-2 combined validation | validated; not yet live |
| F9 One per-origin page-load pace (2.5 s spacing, cooled after a 429/503) for navigations and paginated loads, answered by the worker, and the pace noted on the result (t194-w10); the `rate_limited` stop word (w5 Diff B) and `paginationStop` in the Lab's read record (w5 Diff A) | extension `background/page-pace/*`, `runtime/{action-runner.ts, command-router.ts}`, `shared/protocol.ts`, `content/extraction/pagination.ts`; domain `actions/extraction/summary.ts`; `packages/test-contracts/src/extraction-read/*`, test-runner `flow-lane/extraction-read.ts` | run 5: the build's reruns met the 429 limiter three times and the session was flagged | round-2 combined validation | validated; live in run 7 (no 429 met) |
| F8 The judge and the re-author see how each read went (pages, stop, items seen, rows kept, each condition as written with its rejected count) (t194-w8); the exploring model sees up to 3 rows each `where` condition rejected (t194-w9); a re-author's seed keeps an optional press's route (t194-w7) | Core `result-verification/read-account/*`, `result-summary.ts`, `run-outcome.ts`, `verdict.ts`, `recovery/refuted-result/{brief,history}.ts`, `llm/diagnosis-instructions.ts`, `service/summaries/extraction-summary.ts`, `llm/node-tools/draft-from-flow.ts`, `flow-bootstrap/authoring/draft-routing.ts`; domain `actions/extraction/rejected-samples.ts`, `llm-evidence/node-run/*`; extension `extraction/rejected-samples.ts`, `list-reader.ts`, `actions/extract-list.ts`, `shared/extraction-continuation.ts` | run 4: judge advised a paging loop that existed; the "charging case" rule's victims were invisible; the re-author flattened the optional route | round-2 combined validation | validated; live in run 7 (w7 held; w8 faithful but see run 7 cause 4) |
| F7 An icon-only badge (an element with no text but a constant accessible name, like the store's `<i role="img" aria-label="Brightaisle Plus">`) is offered as an optional attribute column named by that name, so `where {field: <badge>, is: "present"}` expresses "Plus eligible"; a name that varies per item is never a label (t194-w6) | downstream `apps/extension/src/content/extraction/{infer-fields.ts, badge-name.ts (new)}` (+ `tests/badge-column.test.ts`), `domain/src/output-nodes/extract-list/catalog-text.ts` (+ test), `domain/src/runtime/llm-evidence/structure/packet.ts` (comment) (+ `structure/tests/badge-column.test.ts`), `docs/architecture/web-capabilities.md` (two rows) | runs 1, 3, 4: no Flow could say "Plus only"; detection offered only images, links, controls, test ids and text (`infer-fields.ts:333-372`) | combined round-1 suites: extension 1239/1239, domain 914/914 (both include the badge tests); structure audit passed | validated (not yet live) |
| F6 A list read that meets a 429/503 page mid-pagination waits a bounded backoff, reloads the same address and resumes with its records; if refused again, or if the list vanished mid-read, it ends `truncated: true` with the stop named, never `truncated: false` (t194-w5) | downstream `apps/extension/src/content/extraction/{pagination.ts, list-reader.ts}`, `apps/extension/src/content/actions/extract-list.ts`, `apps/extension/src/shared/extraction-continuation.ts`; tests `extraction/tests/{pagination.test.ts, list-reader-refused-page.test.ts}`, `actions/tests/extract-list-refused-page.test.ts`, `shared/tests/extraction-continuation.test.ts`; `docs/architecture/web-capabilities.md` (Pagination row) | run 1: the 5th results page was the store's 429 page; the read stopped `list_vanished` and reported success, `truncated: false`; 8 of 13 expected rows never read | combined round-1 extension suite 1239/1239 (includes the 6 refused-page tests); structure audit passed | validated (not yet live). Not applied, proposed in the w5 report: a `rate_limited` stop word in the domain (Diff B) and `paginationStop` in `packages/test-contracts` (Diff A) |
| F5 A multi-page read counts its filter conditions over the whole read, not its last page (t194-w3's diff, applied by the lead) | downstream `apps/extension/src/shared/extraction-continuation.ts` (+ test), `apps/extension/src/content/extraction/list-reader.ts` (+ test) | run 1 `run-munnhi5q`: s9 reported `conditions {applied: 0, kept: 0}` over 56 items, making it look like the two `where` filters did nothing; the counters restart on every page and the handover dropped them | extension suite `pnpm --filter @fluxiq-web-extension/extension test` (heavy.sh): 1223/1223 | validated |
| F4 The repair diagnosis keeps the Flow graph with the failing node and that node's parameters: lossless trims first, then largest-first trims, instead of dropping whole sections at the 8,000-byte budget (t194-w4) | Core `runtime/recovery/{context.ts, context-summary.ts}`, new `runtime/recovery/context-budget/*` (+ `tests/trims.test.ts`), new `runtime/recovery/tests/context-fit.test.ts` | run 1: context carried only `failure`; `flow_graph`, `step_parameters`, `subflow`, `route_context`, `recent_nodes` omitted `byte_budget` (measured 15,489 B against 8,000) | Core vitest `recovery` + harness-options + flow-bootstrap/authoring + draft-shown: 52 files, 664/664; Core `tsc --noEmit` rc 0; Core structure audit passed | validated |
| F3 The re-author can re-run and amend the Flow's own extraction: the repeat memory starts over when a loop opens, and an inherited literal extraction whose item is a list this Flow detected is accepted, its withheld field selectors restored by key (t194-w2) | downstream `domain/src/runtime/llm-evidence/{repeated-refusal.ts, tools.ts, structure/handles.ts, plan-resolution/resolve-plan-node.ts}`, new `plan-resolution/own-extraction-list.ts`; tests `tests/repeat-across-explorations.test.ts`, `tests/reauthor-reruns-own-extraction.test.ts`, `plan-resolution/tests/own-extraction-list.test.ts` | run 1 re-author: first detection `answered_the_same_again` (the build's answer was still remembered); rerun of f9 `extraction_handle_required` then `answered_the_same_again` ×3 | domain suite `pnpm --filter @fluxiq-web-extension/domain test` (heavy.sh): 911/911; downstream structure audit passed | validated |
| F2 A re-author's inherited, untouched presses are not sent back through the consequence gate (only steps the build adds or changes are gated; move money, delete, send/publish still need the person) (t194-w1) | Core `runtime/llm/harness-options/{inherited-plan-nodes.ts (new), plan-parameter-resolution.ts, bootstrap-completion.ts}` (+ `tests/inherited-plan-nodes.test.ts`), `runtime/flow-bootstrap/authoring/{contracts.ts, draft-routing.ts, assemble-draft.ts}` | run 1 re-author: 8 completions refused `web.step.consequences_undeclared` for Accept, Go and Continue shopping, steps it inherited and could not declare | as F4 (same Core run): 664/664, tsc rc 0, audit passed | validated |
| F1 `FLUXIQ_LAB_KEEP_RUN_STATE=1` keeps the run's `.work/<runId>` (Core workspace and database, Flow source with real parameters, logs) | downstream `packages/test-runner/src/run-scenario/keeps-run-state.ts` (+ test), `run-scenario/index.ts`, `run-scenario.ts:679` (line-neutral) | run 1: Stage 3's real parameters were unanswerable; the bundle screens them and the Lab deleted the workspace | test-runner build rc 0; `keeps-run-state.test.js` 2/2; used live in run 3 | validated |
| F0 t174's committed fixes applied as working-tree patches, byte-identical to `task/t174-live-lane` (as t193 and t195 did): network-guard start crash, gateway open timeout, draft-shown `did_not_work` throw, thrown-issue codes, build progress trace, summary bound, long build request | Core `f0dbbd6..task/t174-live-lane` (20 files); downstream `merge-base..task/t174-live-lane` minus docs (26 files) | run 2 `run-munoaqcn`: `page.goto: Page crashed` opening the side panel (t174's Fix 3 cause) | Core build rc 0; extension suite 1223/1223; domain 911/911 | validated (owned by t174; not t194's changes) |

**Round-2 combined validation (2026-09-30 18:25-18:37 UTC, after the dev merge; script `scratchpad/t194/validate-r2.sh`):** Core build rc 0; Core `tsc --noEmit` rc 0; Core vitest (executor, runtime-adaptation, result-verification, recovery, llm/node-tools, llm/harness-options, llm/harness, flow-bootstrap, service/summaries, flow-draft) 147 files, 2031/2031; Core structure audit passed (200 warnings, 354 baselined); domain check rc 0, suite 982/982; extension check rc 0, suite 1487/1487; test-contracts 156/156; test-runner check rc 0; downstream structure audit passed (128 warnings, 120 baselined).

Ready to commit: the round-2 WIP is already on the branch (downstream `518e38fe`, Core `4c8753ed`) and the dev merge was committed (`0d5b62c4`, `dff9b004`); add the three debug files `debugs/run-{muntc23v-7fcc4110,munv53gt-a0e6f545,munw7ffn-fe1cecd2}.md`, the report `reports/t194-d56-run-debugs.md` and this report; validation: the round-2 combined validation above -> all rc 0, Core 2031/2031, domain 982/982, extension 1487/1487.

**Wrap-up validation (2026-09-30 20:03-20:29 UTC, after w13, w15, w16, w17 and the w14 revert; `scratchpad/t194/validate-r3.sh`):**
Core build rc 0; Core `tsc --noEmit` rc 0; Core vitest (executor, llm, deepseek-bootstrap-exploration, runtime-adaptation,
result-verification, recovery, flow-bootstrap, service/summaries, flow-draft) 203 files, 2581/2583, the 2 failures 15 s timeouts in
`service/summaries/tests/run-detail-preservation.test.ts`, which pass 3/3 alone with `--testTimeout=90000` (17.6 s, 6.9 s, 1.3 s;
the second took 15.5 s in the suite, so load-dependent); Core structure audit passed; domain check rc 0, suite 990/990; extension
check rc 0, suite 1496/1496; test-contracts 156/156; test-runner suite 1697/1700, the 3 not this lane's: 914 `runner-wiring`
expects a `runRedactionScopes(...)` string that committed `run-scenario.ts:617` no longer has (untouched by w16), 1280
`clone-cache` lock timeout, 1449 `demo-workspace`; downstream structure audit passed (128 warnings, 120 baselined).

Ready to commit (fix set 3): downstream extension `content/extraction/{list-reader.ts, list-wait.ts, item-filter.ts, filtered-answer.ts}`,
`content/extraction/tests/{store-pager.ts, list-reader-lazy-tail.test.ts, item-filter.test.ts, list-reader.test.ts}`,
`content/actions/{extract-list.ts, tests/extract-list.test.ts}`, `shared/{extraction-continuation.ts, tests/extraction-continuation.test.ts}`;
domain `actions/extraction/{summary.ts, index.ts, seen-values.ts}` and its test, `output-nodes/extract-list/{dispatch.ts, tests/dispatch-timeout.test.ts}`;
test-runner `src/live-llm/**`, `src/flow-lane/terminal-run-wait.ts` + test, `src/run-scenario.ts`, `src/run-scenario/{index.ts, product-failure.ts, tests/product-failure.test.ts}`;
docs `debugs/run-muohgblr-ed6ddc49.md`, `reports/t194-w13..w17-*.md`, this report. Core `runtime/llm/**` (F16),
`runtime/service/runtime-adaptation/{repair-rerun.ts, tests/repair-rerun.test.ts}`, `runtime/service/summaries/{extraction-summary.ts, tests/extraction-summary.test.ts}`,
`runtime/result-verification/read-account/{condition.ts, accounts.ts, tests/accounts.test.ts}`, `runtime/tests/deepseek-bootstrap-exploration.test.ts`
(exactly `git status` of both trees; nothing else is dirty). Validation: the wrap-up validation above -> Core 2581/2583 (2 load
timeouts, pass alone), domain 990/990, extension 1496/1496, test-runner 1697/1700 (3 pre-existing, not this lane's), all checks
and audits rc 0.

Taken from other lanes, not fixed here: the dry run's `core.replay.unreproducible` on draft steps (runs 1 and 3, 6-7.5 s each) is t174's (their run 4, t174-w2), recorded as t193's cause D. The Lab screenshot gap is recorded by t193 (G2) and t174 (`run-scenario/ui-review/`, uncommitted); this lane photographs its headed window through the OS (`scratchpad/t194/ui-shots.ps1`) meanwhile.

## Pre-run

- Core libraries built through the build cache (`scripts/worktree/core-build.mjs` `buildCore`, heavy.sh b1):
  `@fluxiq/contracts`, `fluxiq`, `@fluxiq/client-gateway-websocket` all `reuse` from stamp.
- Other live lanes' reports at start (2026-09-30 05:11 UTC): t174's exists (runs 1-12, Fixes 1-3);
  t193's and t195's did not exist yet.

## Runs

| # | Run | Task | Stage reached | Causes | Fix | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `run-munnhi5q-4867dabe` | plus-earbuds-under-50 | 6: refuted correctly; re-author failed | Flow read 28 rows unfiltered by Plus/rating/price; conditions' counts reset per page (F5); 429 page lost a results page (F6); Plus inexpressible (F7); re-author blocked by `consequences_undeclared` ×8 (F2) and rerun `extraction_handle_required`/`answered_the_same_again` (F3), profile limit ×4 (t174's summary bound, F0); repair context dropped for byte budget (F4) | F2-F7 | see Fix log |
| 2 | `run-munoaqcn-b90a601c` | same | none (facility) | `page.goto: Page crashed` opening the side panel: t174's network-guard cause | F0 (t174 Fix 3) | runs 3 and 4 started cleanly |
| 3 | `run-munojusu-26a9ad62` | same | 6: refuted; re-author failed (pre-F2/F3) | Flow's only filter was sponsored; 43 rows; dry run refused completions on `core.replay.unreproducible` (t174's) | F2, F3 (landed after) | see Fix log |
| 4 | `run-munq5s8x-6d620cdf` | same | **6: refuted, re-author applied, re-run executed** | build wrote rating `atLeast 4`, price `lessThan 50`, sponsored and accessory filters; 8 of 13 (accessory rule drops three true "Wireless Charging Case" earbuds; Plus inexpressible; limiter); re-run stopped on the optional "Continue shopping" press its session no longer showed; judge advised a pagination loop that existed (not told pages/stop) | F6, F7; re-run stop and judge context under investigation | debug `debugs/run-munq5s8x-6d620cdf.md` |
| 5 | `run-muntc23v-7fcc4110` ($0.0615) | same | 2: no Flow | the build's 11 extract reruns met the store's 429 limiter three times, the session was flagged and the store showed its robot check; 10 dry-run resets `reset_failed` (mid-build restarts: t196's); the Lab mislabelled it a facility failure (`run-scenario.ts:505`); the model could not see its own extract argument (512-byte entry cap, `flow-draft/entry.ts:80`, t189/t195's file) | F9 (w10 pace); the rest recorded | debug `debugs/run-muntc23v-7fcc4110.md` |
| 6 | `run-munv53gt-a0e6f545` ($0.0856 incl. re-author) | same | 6: refuted, re-author applied, re-run stopped | played `next a:nth-of-type(6)` names nothing on page 1 (stop `control_absent`, 2 of 13); re-author's "charging case" rule drops true rows and chained two reads (transcript draft: t196's); re-run stopped on the optional press (ladder retries spent the subflow budget); re-run attempt ids collided | F10 (w12), F11, F12 | debug `debugs/run-munv53gt-a0e6f545.md` |
| 7 | `run-munw7ffn-fe1cecd2` ($0.086: Lab reported $0.0418, the re-author's $0.0425 missing) | same | 6: refuted correctly, re-author applied, re-run stopped on the optional press | 11 of 13 read, 9 true: each page's lazy last four never read (4 expected rows missing); no accessory rule (kept Ear Tips, Charging Case Replacement); positional Next read pages 1,2,5,3,4 and a false `truncated`; judge told "aria-label present" for the Plus badge; re-author explored from page 4; 13/35 re-author replies malformed; Lab idle 306 s after the re-run; re-author spend absent from `live-llm.json` | F13 (lazy tail); F10-F12 landed after it; others open below | debug `debugs/run-munw7ffn-fe1cecd2.md` |
| 8 | `run-muohgblr-ed6ddc49` (cost NO EVIDENCE: killed before the Lab's accounting; 24 decisions, roughly $0.04-0.05) | same | 2: build iteration 24, **stopped by the supervisor at the user's order** (19:19:57 UTC, 7 min in) | the first paged read took 13.7 s and the frame shows the page revealed to its last row (F13 acting); then 16 `amend_draft rerun`s of the extraction in 80 s with 3 malformed replies, the same rerun loop as runs 5-7 | none (Lab runs stopped) | debug `debugs/run-muohgblr-ed6ddc49.md` |

## UI evidence for t191

From this lane's OS captures of the headed window (`scratchpad/t194/shots/run01/`, `run04/`, 15 s), side panel open throughout:
- The "Get set up" card says **"Add an AI model key: To do"** in every frame, while a keyed build is running (runs 1 and 4).
- **"RIGHT NOW: Done / Last step: Looked at the page"** mid-build (run 1, 05:19:24), and **"RIGHT NOW: Nothing running"** while FluxIQ was re-authoring and re-running (run 4, 06:40:58 to 06:42:14). The one correct frame: "FluxIQ is working / Reading data from the page" with Stop (run 4, 06:34:54).
- **No on-page FluxIQ overlay** was visible on the site in any frame of runs 1 and 4.
- The site's own cookie banner and "Never miss a deal" modal stay up during playback and the re-run.

## Round 1 (2026-09-30), ready

All t194 edits are validated; nothing is in progress in the trees. Combined checks after every worker returned: extension suite 1239/1239, domain suite 914/914, test-runner build rc 0 with its lane tests 51/51, Core `tsc --noEmit` rc 0, Core vitest (harness-options, flow-bootstrap/authoring, recovery, draft-shown) 664/664, structure audits passed in both repositories.

**F0 files (t174's fixes applied by hand; take t174's/dev's version at the merge):** Core, the 20 files of `f0dbbd6..4d126f6`; downstream, the 26 files of `6f29c62c..2d6d27f8` minus docs. Lists: `scratchpad/t194/f0-core.txt`, `f0-down.txt`.

**Mixed files (F0 plus t194 lines):** downstream `packages/test-runner/src/run-scenario.ts` (t194: `keepsRunState` in the import and at the `finally`, line 679), `packages/test-runner/src/run-scenario/index.ts` (t194: one export line); Core `runtime/llm/harness-options/bootstrap-completion.ts` (t194: the `inheritedNodeRefs` import and two call sites, t174's summary lines unchanged).

**t194 files that dev has also changed since `defcbe2d`/`f0dbbd6` (true merges):** downstream `apps/extension/src/content/extraction/pagination.ts` (t195/t174 load-more Retry vs t194 F6 429 reload), `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` and `domain/src/runtime/llm-evidence/tools.ts` (F3), `docs/architecture/web-capabilities.md`; Core `runtime/flow-bootstrap/authoring/draft-routing.ts` (F2) and `runtime/llm/harness-options/bootstrap-completion.ts`.

## Merge of dev after round 1 (2026-09-30)

The supervisor committed round 1 (Core `c4c469de`, downstream `31be444b`) and merged dev (t174, t193, t195, t196, t191 round 1) into both trees; the lead resolved the conflicts and the supervisor committed the merge (Core `b75459d8`, downstream `8b5fcb9b`).
- Conflicts: Core `llm/harness-options/bootstrap-completion.ts` (dev's side plus `inheritedNodeRefs`); `domain/src/runtime/llm-evidence/tools.ts` (the `repeatedRefusals.answered(scope, toolId, answer)` call F3 needs, beside t196's `observed` state-digest binding); `packages/test-runner/src/run-scenario.ts` and `run-scenario/index.ts` (dev's `uiReview`, `periodicCapture`, `createRunScreenshotAdapter`, plus `keepsRunState` in the import, at line 670 and as one export). Every F0 file resolved to dev's version.
- First checks failed on a stale Core `dist` (4 domain tests on failure records; extension check on `effect`/`retryAfterMs`), not on the merge: Core rebuilt, then all green.
- Validation: Core fluxiq tsc rc 0, Core vitest (harness-options, flow-bootstrap/authoring, recovery, draft-shown) 672/672; domain check rc 0, suite 948/948; extension check rc 0, suite 1348/1348; test-runner check and build rc 0, lane node tests 87/87; both structure audits passed.
- The Lab now takes its own screenshots (t174's `ui-review`, t193's `periodicCapture`); this lane's OS capture stays as a cross-check.

## Round 2 triage, new session (2026-09-30, from 18:20 UTC)

The previous lead ended on a session limit after run 7; its round-2 work was committed as WIP (downstream `518e38fe`,
Core `4c8753ed`) and dev merged in (Core `dff9b004` clean; downstream one conflict).

- **merge resolved: `apps/extension/src/runtime/action-runner.ts`**, both sides kept. Navigation: dev's settled landing
  (`settleLandedReading` over the first `readLandedPage`, `checkWait` on the landing) plus this lane's page pace
  (`navigationResult` wrapped in `withPaceNote` when `paceNavigation` held the load). Frame send: this lane's paced
  `sendAction(..., pace)` plus dev's `sendClickCheckingLanding(..., LANDED_TAB_ACCESS)`. Staged with `git add`, not committed.
- Round-2 changes found in the WIP, mapped to their owners (runs 5-7 were not yet in the runs table; added below):
  w7 seed keeps an optional press's route (Core `llm/node-tools/draft-from-flow.ts`, `flow-bootstrap/authoring/draft-routing.ts`);
  w7 item 3 applied by the lead, a re-run numbers its attempts after the first pass's (Core `executor/{contracts,graph-run,node-execution}.ts`,
  `service/runtime-adaptation/repair-rerun.ts` + test); lead fix, ladder retries do not spend the subflow recovery budget, so an
  optional press's third miss still takes its `failed` route (Core `executor/recovery-budget.ts`, `executor/tests/optional-failed-route.test.ts`);
  w8 judge and re-author see each read (Core `result-verification/read-account/*`, `result-summary.ts`, `run-outcome.ts`, `verdict.ts`,
  `recovery/refuted-result/{brief,history}.ts`, `llm/diagnosis-instructions.ts`, `service/summaries/extraction-summary.ts`);
  w9 exploring model sees rejected rows (domain `actions/extraction/rejected-samples.ts`, `summary.ts`, `llm-evidence/node-run/*`;
  extension `extraction/rejected-samples.ts`, `list-reader.ts`, `actions/extract-list.ts`, `shared/extraction-continuation.ts`);
  w10 one per-origin page-load pace (extension `background/page-pace/*`, `runtime/{action-runner,command-router}.ts`,
  `shared/protocol.ts`, `extraction/pagination.ts`); w12 a `next` read finds the page's own Next (extension
  `extraction/{detect-pagination,pagination}.ts`, `tests/store-pager.ts`); w5 Diffs A and B applied by the lead (`rate_limited`
  stop word in domain `summary.ts`; `paginationStop` in `packages/test-contracts` and test-runner `flow-lane/extraction-read.ts`).
  No w11 exists. Nothing found half-written; combined validation below.

## Wrap-up at the supervisor's stop (2026-09-30, from 19:20 UTC)

The supervisor stopped all Lab runs at the user's order and killed run 8 mid-build. No Lab run was started after that.
The supervisor's item 3 (a run that spent 53 s trying steps and made no repair attempt) was not this lane's: lane C launched
nothing between 09:32 and 19:08 UTC, and run 8 never reached a Flow.

- **t194-w14 reverted, described here.** A re-author explores from where the step it changes starts (run 7 cause 6). The worker
  built and tested it (Core vitest `recovery`, `flow-bootstrap`, `service/runtime-adaptation`: 84 files, 1314 passed): before the
  re-author's first model call, replay the Flow's own steps up to the changed step through the build's permission-gated tools,
  withheld when any earlier step declares a consequence; a failed replay is reported in the brief; the brief says where the page
  is. It was **not wired**: the caller (`service/runtime-adaptation/refuted-result-port.ts`, `service.ts`) was outside its files,
  so it never ran in a repair. Rather than leave unwired code, the lead reverted it. The patch is kept at
  `C:/Users/osrs_/FluxStuff/evidence/t194/t194-w14-reauthor-start-page.core.patch` (15 files; `git apply --check` clean against
  Core at `dff9b004`), with the wiring steps in `reports/t194-w14-reauthor-start-page.md`.
- F13 (w13) was validated before run 8 and is kept.

## Top causes for the audit

Across runs 1-8 of `everything-store-plus-earbuds-under-50` (the only task this lane reached). Run ids: 1 `munnhi5q`,
2 `munoaqcn`, 3 `munojusu`, 4 `munq5s8x`, 5 `muntc23v`, 6 `munv53gt`, 7 `munw7ffn`, 8 `muohgblr` (each `run-<id>-…`).

| # | Recurring cause | Runs | Stage it stops at | Status |
| --- | --- | --- | --- | --- |
| 1 | **The build reruns its own extraction over and over** (11 in run 5, 10 in run 7's build, 13 in run 6's re-author, 16 in run 8), each rerun "succeeding"; in run 5 the burst tripped the store's limiter and no Flow was built | 1, 5, 6, 7, 8 | 2 (exploration) | **Open.** Contributing: the model is shown its own extract argument cut at 512 bytes (`flow-draft/entry.ts:80`): **owned by t200** (a limit on what the model sees). A draft grown by rerunning rather than authored: **owned by t196**. Decision parameters are not recorded (gap G1), so why each rerun happened is unanswerable |
| 2 | **The Flow keeps the wrong rows**: no accessory rule, or a "charging case" rule that drops three true "... Wireless Charging Case" earbuds | 3, 4, 6, 7 | 5 (answer) | **Open.** The exploring model sees rejected rows (F8/w9, live since run 7) yet still omitted the rule. Proposed: the completion check requires each exclusion the instruction names to map to a `where` condition, as `instructed-acts/check.ts` does for acts (t174's instructed-requirements work is the nearest owner) |
| 3 | **A paged read never read each page's lazily loaded last results** (4 of 13 expected rows in run 7) | 4, 6, 7 | 5 | **Fixed**, F13 (validated; run 8's frames show the reveal; records not yet proven live) |
| 4 | **Positional Next selector** (`a:nth-of-type(n)`): pages read 1, 2, 5, 3, 4, a false `truncated`, or a stop on page 1 | 4, 6, 7 | 5 | **Fixed**, F10 (w12), not yet live |
| 5 | **The store's 429 limiter**: bursty page loads lost a results page (run 1) or flagged the session into its robot check (run 5) | 1, 5, 6 | 2 and 5 | **Fixed**, F6 + F9 (per-origin pace); run 7 met no 429 |
| 6 | **The repaired re-run stops on the optional "Continue shopping" press** (ladder retries spent the subflow recovery budget; earlier the re-author also flattened the optional route) | 4, 6, 7 | 6 (repair re-run) | **Fixed**, F11 + F8 (w7 route), not yet live |
| 7 | **The re-author explores from where the playback left the tab** (page 4), never where the changed step starts | 6, 7 | 6 | **In progress**: t194-w14 built and reverted unwired (patch above) |
| 8 | **The judge misdescribes the read**: advised a paging loop that existed (run 4); read "aria-label present" for the Plus badge and a false `truncated` (run 7); "part of the summary was withheld" (runs 4, 7) | 4, 7 | 6 (judgement) | **Fixed** in part: F8 (w8), F14 (w15), F10. The judge summary's 4,000-byte budget that withholds parts is a limit on what the model sees: **owned by t200** |
| 9 | **The re-author chains several reads writing one dataset** (a transcript of its reruns, not an authored Flow) | 6, 7 | 6 | **Owned by t196** (draft authoring) |
| 10 | **Malformed provider replies**: 14 of 35 re-author replies in run 7, 3 of 24 in run 8, just before full extract reruns | 7, 8 | 2 and 6 (time and spend) | **In progress**: F16 (w17) records the case, finish reason and length; cause not established; proposed: a rerun sends only the keys it changes |
| 11 | **Re-run evidence and spend were lost**: attempt ids collided (the re-run's steps hidden); the re-author's spend missing from `live-llm.json` (run 7 reported $0.042 of $0.086); the Lab idled 306 s after a failed repaired re-run; run 5 mislabelled a facility failure | 4-7 | 4-6 (evidence) | **Fixed**, F12 and F15 (w16) |
| 12 | **Mid-build replays and resets**: dry-run `core.replay.unreproducible` (runs 1, 3) and ten `reset_failed` resets (run 5) | 1, 3, 5 | 2 | **Owned by t196** |
| 13 | **UI**: status cards over the chat, raw tool and node ids, "Add an AI model key: To do" while building, the pill over the cookie banner, "Running your Flow" and "passed its check" during a re-author | every run | UI (never a pass) | **Owned by t191/t174** (t174 U1-U13) |

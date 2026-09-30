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
| F7 An icon-only badge (an element with no text but a constant accessible name, like the store's `<i role="img" aria-label="Brightaisle Plus">`) is offered as an optional attribute column named by that name, so `where {field: <badge>, is: "present"}` expresses "Plus eligible"; a name that varies per item is never a label (t194-w6) | downstream `apps/extension/src/content/extraction/{infer-fields.ts, badge-name.ts (new)}` (+ `tests/badge-column.test.ts`), `domain/src/output-nodes/extract-list/catalog-text.ts` (+ test), `domain/src/runtime/llm-evidence/structure/packet.ts` (comment) (+ `structure/tests/badge-column.test.ts`), `docs/architecture/web-capabilities.md` (two rows) | runs 1, 3, 4: no Flow could say "Plus only"; detection offered only images, links, controls, test ids and text (`infer-fields.ts:333-372`) | combined round-1 suites: extension 1239/1239, domain 914/914 (both include the badge tests); structure audit passed | validated (not yet live) |
| F6 A list read that meets a 429/503 page mid-pagination waits a bounded backoff, reloads the same address and resumes with its records; if refused again, or if the list vanished mid-read, it ends `truncated: true` with the stop named, never `truncated: false` (t194-w5) | downstream `apps/extension/src/content/extraction/{pagination.ts, list-reader.ts}`, `apps/extension/src/content/actions/extract-list.ts`, `apps/extension/src/shared/extraction-continuation.ts`; tests `extraction/tests/{pagination.test.ts, list-reader-refused-page.test.ts}`, `actions/tests/extract-list-refused-page.test.ts`, `shared/tests/extraction-continuation.test.ts`; `docs/architecture/web-capabilities.md` (Pagination row) | run 1: the 5th results page was the store's 429 page; the read stopped `list_vanished` and reported success, `truncated: false`; 8 of 13 expected rows never read | combined round-1 extension suite 1239/1239 (includes the 6 refused-page tests); structure audit passed | validated (not yet live). Not applied, proposed in the w5 report: a `rate_limited` stop word in the domain (Diff B) and `paginationStop` in `packages/test-contracts` (Diff A) |
| F5 A multi-page read counts its filter conditions over the whole read, not its last page (t194-w3's diff, applied by the lead) | downstream `apps/extension/src/shared/extraction-continuation.ts` (+ test), `apps/extension/src/content/extraction/list-reader.ts` (+ test) | run 1 `run-munnhi5q`: s9 reported `conditions {applied: 0, kept: 0}` over 56 items, making it look like the two `where` filters did nothing; the counters restart on every page and the handover dropped them | extension suite `pnpm --filter @fluxiq-web-extension/extension test` (heavy.sh): 1223/1223 | validated |
| F4 The repair diagnosis keeps the Flow graph with the failing node and that node's parameters: lossless trims first, then largest-first trims, instead of dropping whole sections at the 8,000-byte budget (t194-w4) | Core `runtime/recovery/{context.ts, context-summary.ts}`, new `runtime/recovery/context-budget/*` (+ `tests/trims.test.ts`), new `runtime/recovery/tests/context-fit.test.ts` | run 1: context carried only `failure`; `flow_graph`, `step_parameters`, `subflow`, `route_context`, `recent_nodes` omitted `byte_budget` (measured 15,489 B against 8,000) | Core vitest `recovery` + harness-options + flow-bootstrap/authoring + draft-shown: 52 files, 664/664; Core `tsc --noEmit` rc 0; Core structure audit passed | validated |
| F3 The re-author can re-run and amend the Flow's own extraction: the repeat memory starts over when a loop opens, and an inherited literal extraction whose item is a list this Flow detected is accepted, its withheld field selectors restored by key (t194-w2) | downstream `domain/src/runtime/llm-evidence/{repeated-refusal.ts, tools.ts, structure/handles.ts, plan-resolution/resolve-plan-node.ts}`, new `plan-resolution/own-extraction-list.ts`; tests `tests/repeat-across-explorations.test.ts`, `tests/reauthor-reruns-own-extraction.test.ts`, `plan-resolution/tests/own-extraction-list.test.ts` | run 1 re-author: first detection `answered_the_same_again` (the build's answer was still remembered); rerun of f9 `extraction_handle_required` then `answered_the_same_again` ×3 | domain suite `pnpm --filter @fluxiq-web-extension/domain test` (heavy.sh): 911/911; downstream structure audit passed | validated |
| F2 A re-author's inherited, untouched presses are not sent back through the consequence gate (only steps the build adds or changes are gated; move money, delete, send/publish still need the person) (t194-w1) | Core `runtime/llm/harness-options/{inherited-plan-nodes.ts (new), plan-parameter-resolution.ts, bootstrap-completion.ts}` (+ `tests/inherited-plan-nodes.test.ts`), `runtime/flow-bootstrap/authoring/{contracts.ts, draft-routing.ts, assemble-draft.ts}` | run 1 re-author: 8 completions refused `web.step.consequences_undeclared` for Accept, Go and Continue shopping, steps it inherited and could not declare | as F4 (same Core run): 664/664, tsc rc 0, audit passed | validated |
| F1 `FLUXIQ_LAB_KEEP_RUN_STATE=1` keeps the run's `.work/<runId>` (Core workspace and database, Flow source with real parameters, logs) | downstream `packages/test-runner/src/run-scenario/keeps-run-state.ts` (+ test), `run-scenario/index.ts`, `run-scenario.ts:679` (line-neutral) | run 1: Stage 3's real parameters were unanswerable; the bundle screens them and the Lab deleted the workspace | test-runner build rc 0; `keeps-run-state.test.js` 2/2; used live in run 3 | validated |
| F0 t174's committed fixes applied as working-tree patches, byte-identical to `task/t174-live-lane` (as t193 and t195 did): network-guard start crash, gateway open timeout, draft-shown `did_not_work` throw, thrown-issue codes, build progress trace, summary bound, long build request | Core `f0dbbd6..task/t174-live-lane` (20 files); downstream `merge-base..task/t174-live-lane` minus docs (26 files) | run 2 `run-munoaqcn`: `page.goto: Page crashed` opening the side panel (t174's Fix 3 cause) | Core build rc 0; extension suite 1223/1223; domain 911/911 | validated (owned by t174; not t194's changes) |

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

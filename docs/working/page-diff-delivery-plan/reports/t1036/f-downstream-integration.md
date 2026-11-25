# t1036 / f-downstream-integration (worker)

## Outcome
Done for owned paths, with three groups of failures left that are in paths I must not touch or wait on Core (listed below).

## What changed and why
- `domain/src/runtime/llm-evidence/tools.ts`: removed the `web.find_on_page` declaration, handler and the `runWebFindOnPage` / `WEB_LLM_FIND_ON_PAGE_TOOL_ID` imports; describe description says "printed on a page line" and "the full page lists" hidden elements. The `pageChannel` block is untouched. Comment near detect updated.
- `page-find/`: deleted run.ts, search.ts, query.ts, near.ts, schema-version.ts (nothing remaining imports them; checked by grep across domain, extension, scripts). `run-description.ts` had borrowed `WebFindOnPageRun`; it now has its own `WebDescribeElementRun` type (exported from the barrel). index.ts trimmed. Deleted tests/search.test.ts; removed the search tests from tests/groups.test.ts and aria-groups.test.ts (the describe tests stay); rewrote tests/run.test.ts around describe_element; tests/description.test.ts mints its hidden handle through an ordinary read plus the describe capture.
- header.ts and element/index.ts: B had already removed the find words (grep clean). Fixed the stale search comment in `page-view/element/group-token.ts`.
- Tests moved off find: `plan-resolution/tests/printed-handles.test.ts` and `printed-tool-results.test.ts` (now use describe; the second uses a refused describe instead of an echoing search), `tests/vocabulary.test.ts`, `node-run/tests/run.test.ts`. B's list: covered-press, press-raw-read, arrival, harness-options options moved v3 to v4 and `page` to `shownPageText`. `node-run/tests/call-words.test.ts` keeps find ids on purpose (recorded runs).
- Files in no list that I edited: `tests/tools.test.ts` (find tool gone, describe description checks), `tests/recovery-selector-hints.test.ts` (the recovery-search test became a recovery-describe test; header comment v4), `plan-resolution/extraction/tests/element-record.test.ts` (hidden line handle comes from `runtime.pageChannel.fullPage`), `apps/extension/src/content/rendered-elements.ts` and `src/shared/snapshot-capture-options.ts` (comments only).
- e2e: crossborder follow-official-store spec uses the full page (`pageChannel.fullPage`) for the hidden line and the look's page text for the account control; `site-reset/tests/installed-project.spec.ts` dropped its `web.find_on_page` read and reads page text through `webLlmShownPageText`.
- Docs: page-evidence.md and testing-facility.md reworded (full page and describe; retired ids remain only for recorded runs).
- Premise change (D2), person-needed.test.ts "a press with a handle from before the check's reload ...": the filtered page no longer renumbers the control, by design. The test now asserts the handle is the same (`equal`) and still presses it and checks the witness. A reworded-control variant failed as `web.handle.ambiguous`, which is legitimate, so I did not use it.

## Commands run and observed
- `domain/node_modules/.bin/tsc -p domain/tsconfig.json --noEmit` and `-p domain/tsconfig.test.json --noEmit`: no output, exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t1036f heavy-slot run t1036-f -- node scripts/test-domain.mjs llm-evidence runtime/tests element-fingerprint target-reacquire` (run from `domain/`): `# tests 2039 / # pass 2026 / # fail 13` before my last three fixes. After fixes, `test-domain.mjs llm-evidence/node-run llm-evidence/plan-resolution`: `# tests 945 / # pass 945 / # fail 0` (covers 552, 937, 938).
- Remaining failures of the 13 (not rerun as a whole after the fixes):
  - Must-not-touch files that mint handles through find: `rejection-next/tests/list-handle-elsewhere.test.ts` ("a read through an element's own handle with a table's columns is told it names one element...", "the same read from another page is refused as a handle of a page no longer loaded", "a detection at a handle another page printed is told the handle names nothing here...") and `structure/tests/target-binding.test.ts` ("a handle only a search printed binds a detection, as it binds a press or a read"). All fail with "web evidence tool is not registered". Move them to `pageChannel.fullPage` as in `element-record.test.ts`.
  - `structure/tests/detect.test.ts` "a handle from a page the browser has left is refused with the page now and the handle the same place has there" fails with "a fresh handle is named, not t2": most likely D2 keeping the handle (not find). Not in my paths; W2/B owner to check.
  - Five carried-repair tests in `runtime/tests/carried-service-repair.test.ts` and `carried-row-service-repair.test.ts` (1926-1930): Core's page channel is not built yet (B confirmed by declaring `pageView` temporarily).
- `pnpm --filter @fluxiq-web-extension/extension check` and `... test`: refused, "FluxIQ Core's build at ...\t1036\!FluxIQ is not current with its source". Core not rebuilt. Run directly instead: `node scripts/check-extension.mjs` under the gate: exit 0.
- Extension unit tests directly (`node scripts/test-extension.mjs`, label t1036f, gate): `# tests 4168 / # pass 4168 / # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (262 warning(s), 550 baselined)` (no new violation; the baseline is 1 fewer than B's run).
- `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 560 model-facing Core files, 14298 string literals)`.
- `domain check` via pnpm: not run (same Core refusal).

## Not verified
- The e2e specs I changed (crossborder, installed-project) were type-checked by `check-extension.mjs` only if that script covers e2e; not run in a browser. The crossborder regex for the hidden line (`hidden <p> "`) comes from the full view format, confirmed in element-record's output, not from a live run.
- The full domain filter set was not rerun after the final three fixes (narrow rerun above only).

## Open questions
- `web.recovery.inspect` kept as in C's report.
- `node-run/call-words.ts`, `vocabulary.ts` and `structure/detect.ts:76` still name `find_on_page` (recorded runs and a comment in a must-not-touch file).

## Round 2: provider-free bigbox-retail Lab run

### Outcome
Partial. The page rebuild and its unit test are done. The Lab run did not pass: three runs each stopped on a different cause, and the third got through attempt 1's build to the judge, which refused to confirm because of a product defect outside my paths (below). No run was retried unchanged. The requests of the third run still give the table asked for in item 3.

### What changed
- `scripted-model/scripts/evidence.ts`: `currentPageOf` rebuilds the page from the request's deliveries: the newest `whole` for each page key, then its `changes` applied in order; `unchanged`, references (`replacedBy`, `droppedAt`) and recalled pages add nothing. It falls back to the old `core.current_view` / whole-`page` reading when a request has no delivery.
- `scripted-model/scripts/page-changes.ts` (new): `applyPageChanges` applies the change lines (`  ` context, `- `, `+ `, `~ `; a `~ ` line is matched by its leading handle, else its first word).
- `scripted-model/scripts/tests/current-page.test.ts` (new): four tests on deliveries made by Core's own `automationStudioLlmPageChannelProjection`.
- `bigbox-retail-rated-delivery-towels.ts` and its test: three adaptations, each from a failed run:
  1. Run 1 (`run-mwvrnwa9-a359d0f4`) refused at request 3: the page now prints `checkbox "Paper Towels (28)"` and `checkbox "Delivery (21)"`, so the facet regexes accept a trailing count.
  2. Run 2 (`run-mwvrysoc-81bbebeb`) reached the end but every completion was refused `answer_first.processing_binding_missing` (the task's processing names `ad` and `fulfillment`, which the read did not keep); the read now also keeps `ad` and `fulfillment` (the detected Sponsored field, the field whose sample says Delivery).
  3. Run 3 (`run-mwvs5bch-26cd6b81`) refused the repeat amendment (`span_holds_routing`): the framework now drafts every landed act, so the first-visit detours (consent, offer) sit in the Flow; the script drops them with `amend_draft` before repeating the read and next-page steps.
- The script used no `find_on_page` or look call (grep), so nothing changed there.
- Lab slot 2 was claimed with an owner file for the runs (instance `t1036-lab`) and the file was removed afterwards.

### Commands and observed results
- Unit tests, gate: `node --test "dist/attempt-lane/scripted-model/**/*.test.js"` after `test-runner:build`: `# tests 115 / # pass 115 / # fail 0` (includes the four `current-page.test.ts` tests; the first run of the same set was `# tests 113 / # pass 113 / # fail 0` before the script adaptations).
- Lab: `FLUXIQ_LAB_INSTANCE=t1036-lab heavy-slot run t1036-lab -- pnpm lab attempt bigbox-retail --task bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts 4`, headed, three times (logs `test-runs/t1036f/lab.log`, `lab2.log`, `lab3.log`, `lab4.log`; the Monitor was on the run's end and on the watcher alert file; 0 alerts in the runs checked). Result line of the third (last) run:
  `{"status":"not_judged","task":"bigbox-retail-rated-delivery-towels","why":"AttemptScriptRefused","evidence":"...\test-runs\instances\t1036-lab\attempts\run-mwvsbihx-e60f9f0f"}` after `[attempt] model request evidence_tool_decision 33 REFUSED: The script ... expects no request 33`.
- Cause of the last stop and how far it got: attempt 1 built the Flow (consent dropped, read and next repeated, `core.run_flow` read the pages), reached `complete`, and Core's completion check answered `answer_first.judged_unsure`: "The evidence Core could not read: read-first (web_judge.read_invalid); witnesses.before (judge_evidence.before_state_missing)". Completions repeated until the script's 32 decision replies were spent. No attempt ended, so attempts 2-4 and continuation proofs did not happen.
- Root of `web_judge.read_invalid` (step `0016-tool-core.run_node` of that run): the read's `extraction` summary carries `rejectedObservations` and no `rejectedSamples`, and `webAutomationExtractionSummaryValue` (`domain/src/actions/extraction/summary.ts:368-369`) returns `undefined` for the whole summary in that case, so `judge-evidence/project.ts:63` marks the read invalid. This is on the tree's `dev` base (neither file is changed here), in W2's paths, not the page channel. `witnesses.before` missing is Core's `result-verification/judge-evidence/summary.ts:54` (no start view held); I did not look further. I did not touch either.

### Table from the third run's 33 requests (`test-runs/t1036f/analyse-run.mjs`, reads `model/evidence_tool_decision-NNN.request.json`)
| Check | Observed |
| --- | --- |
| First request | one delivery, `whole` (6,952 chars) |
| Later requests carrying `changes` | 4 of 32 (requests 2, 8, 21, 32); the others carry a `whole` of the newest page plus `ref:droppedAt` references (up to 5 per request) |
| Why mostly whole | each facet press changes the page key (its query), so a new key is shown whole; older keys' copies become `droppedAt` references as the 20,000-character budget is reached |
| Page text carried per request | 6,952 to 13,566 chars (never above the budget) |
| `web.find_on_page` offered | no request (0 of 33) |
| Capture node in the `run_node` enum | no request (0 of 33); enum size 19 in every request |
| Offered tool list | identical in all 33 requests (one digest `984119dba31c`; tools: core.describe_nodes, core.full_page, core.loop_decision, core.recall_result, core.run_flow, core.run_node, core.set_result_processing, web.describe_element, web.detect_repeating_structure) |
| Attempts' outcomes | none ended (attempt 1 not judged), so no verdict, no model-call count per attempt and no continuation proof |

### Not verified
- Attempts 2 to 4, their continuation proofs and model calls: never reached.
- Whether the judge result changes once `rejectedSamples`/`rejectedObservations` agree: the defect is in W2's paths.
- The table is read from the `model/` requests; tokens and uncached tokens are not computed.

### Open questions
- Page-key design: pressing a facet makes a new key, so page-diff shows `changes` only for the same address (scrolls, in-page changes). Is that intended for P-a? It is why 28 of 32 requests carry a whole page.
- Core's draft keeps the first-visit detours, so every scripted task with a transient press now needs the drop edit (the other scripts were not touched).

## Round 3: judge reply shape, and the re-run

### Outcome
Partial. The judge-ask fault is fixed and `web_judge.read_invalid` is gone. The run still did not pass: Core still holds `judge_evidence.before_state_missing`, so attempt 1 was not confirmed and attempts 2-4 never started.

### What changed
- Cause of the decision-shaped reply at step 0028: not the script's `loop_verification` reply (its shape, `judgement.ts`, is the judge's own). The judge's first ask is a continuation: `messages[0]` is the attempt's conversation whose last text block is the judge's task JSON, and the last message is prose ("The conversation above is the attempt's own record..."). `wire-request.ts` read only the last message, found no `taskKind`, called it a chat turn (`panel_command` ordinal 2) and the script answered it with its chat reply (`do`/`with`/`process`).
- `scripted-model/wire-request.ts`: when the last message holds no task, the newest earlier message whose last text block is a task JSON naming a `taskKind` is the payload (`continuedPayload`); a chat turn has none, so it is still a chat turn.
- `scripted-model/tests/model-server.test.ts`: new test for that shape.
- The bigbox script and `judgement.ts` were not changed in this round.

### Commands and observed results
- Unit tests, gate (`test-runner:build`, then `node --test "dist/attempt-lane/scripted-model/**/*.test.js"`): `# tests 116 / # pass 116 / # fail 0`.
- Lab re-run (once): `FLUXIQ_LAB_INSTANCE=t1036-lab heavy-slot run t1036-lab -- pnpm lab attempt bigbox-retail --task bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts 4`, headed, lab slot 2 (owner file written and removed), the Lab rebuilt the domain host, extension and test-runner; log `test-runs/t1036f/lab5.log`. Result line:
  `{"status":"not_judged","task":"bigbox-retail-rated-delivery-towels","why":"AttemptScriptRefused","evidence":"...\test-runs\instances\t1036-lab\attempts\run-mwvtl0qe-73df7041"}` after request 33 refused (`expects no request 33`); watcher alerts 0.
- `web_judge.read_invalid` in the new run's `steps/` or `model/`: 0 files (grep -rl). `judge_evidence.before_state_missing`: still present, first at `steps/0028-judge/request.json`, and in the completion refusal `steps/0029-answer-unusable/result.json`.
- Attempt 1 confirmed: no. The judge now gets its own request (`loop_verification` ordinals 1 and 2 answered, 0028 and 0058 `status ok`), and Core answers `answer_first.judged_unsure`: "The evidence Core could not read: witnesses.before (judge_evidence.before_state_missing)". Then `same_evidence` refusals and loops until the script's 32 decision replies are spent.
- Attempts 2-4, model calls, continuation proofs: none; no attempt ended.
- Cause not fixed (outside my paths, Core): `result-verification/judge-evidence/summary.ts:54` gaps `witnesses.before` when `held.startView` is undefined and `witnesses?.before` is undefined; `startView` is read from the session trace's first page (`result-summary.ts` "startView ... read off the session's own trace"). `pageView` is declared in `observed-state-keys.ts` (line 23), yet no start view was found. I did not trace why (whether the trace keeps the first view under `pageView`, or the delivery projection hides it from that read).

### Request table, new run (33 requests; `test-runs/t1036f/analyse-run.mjs`)
| Check | Observed |
| --- | --- |
| First request | one delivery, `whole` |
| Later requests with `changes` | 7 of 32 (was 4 of 32) |
| Others | newest page `whole` plus up to 5 `ref:droppedAt` references |
| `web.find_on_page` offered | 0 of 33 |
| Capture node in the `run_node` enum | 0 of 33 (enum size 19 each) |
| Offered tools | identical in all 33, one digest `984119dba31c`: core.describe_nodes, core.full_page, core.loop_decision, core.recall_result, core.run_flow, core.run_node, core.set_result_processing, web.describe_element, web.detect_repeating_structure |

### Not verified
- Attempts 2-4 and their continuation proofs; why Core's start view is still not found.

## Round 4: held, not run
The one launch of round 4 ended without running: the Lab refused a stale Core build (`fluxiq:build` and `ui-components:build`, "inputs changed: packages/fluxiq"); its prelude did not rebuild Core. I then built `fluxiq` and `@fluxiq/ui-components` under the gate (`test-runs/t1036f/core-build.log`); the build finished but was "not stamped, because inputs changed while it ran (packages/fluxiq)", since Core was still being edited. The sub-supervisor then held round 4 for a different fix. No run happened, so there is no result line, grep count or table for round 4. Core needs a rebuild after the new fix and before the re-run. Lab slot 2's owner file was removed and all my waiting loops are stopped.

### Round 4 (re-run after the lead's fix; supersedes the held note above)
- Core rebuilt under the gate (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build`, `test-runs/t1036f/core-build2.log`: all packages "Done"). Lab re-run once, headed, slot 2, instance `t1036-lab`, watcher on (0 alerts reached me), log `lab7.log`.
- Result line: `{"status":"not_judged","task":"bigbox-retail-rated-delivery-towels","why":"AttemptScriptRefused","evidence":"...\test-runs\instances\t1036-lab\attempts\run-mwvw1r9k-9b10a381"}` after request 33 refused.
- Counts in that run's `steps/` (files containing the word): `before_state_missing` 0; `read_invalid` 48 (expected, W2's fix is not in this tree).
- Gaps in the judge's evidence (`evidenceProjection.missing`, step 0030): `[{"source":"read-first","codes":["web_judge.read_invalid"]}]` and nothing else.
- Attempt 1 confirmed: no. Core's reason (`answer_first.judged_unsure`, step 0031): "The check said yes, but Core held it unconfirmed: Some required evidence was not available... The evidence Core could not read: read-first (web_judge.read_invalid)." Then `same_evidence` refusals until the script's 32 decision replies were spent. No attempt ended; attempts 2-4 not reached.
- Request table (33 requests): first request `whole`; 8 of 32 later requests carry `changes`; `web.find_on_page` offered 0 of 33; capture node in the `run_node` enum 0 of 33; one tool-list digest `984119dba31c` in all 33 (same nine tools as before).
- Structure audit: the swallowed-failure finding in `wire-request.ts` is fixed (the catch now names `SyntaxError` and rethrows anything else). `node scripts/structure-audit.mjs` -> `structure-audit: passed (262 warning(s), 550 baselined)`.

## Round 5: page key without the query, re-run
- Lab re-run once, as in round 4 (headed, slot 2, instance `t1036-lab`, the Lab rebuilt the domain; log `test-runs/t1036f/lab8.log`). The script did not trip on the new deliveries: `currentPageOf` rebuilt the pages (filtered and sorted pages included) and the run went as far as in round 4. No script change this round.
- Result line: `{"status":"not_judged","task":"bigbox-retail-rated-delivery-towels","why":"AttemptScriptRefused","evidence":"...\test-runs\instances\t1036-lab\attempts\run-mwvwk117-6ffa4ca0"}` after request 33 refused (script's 32 replies spent on completions Core held unconfirmed).
- Counts in `steps/` (files containing the word): `before_state_missing` 0; `read_invalid` 48 (expected until W2 merges).
- Judge's named gaps (steps 0030 and 0060, `evidenceProjection.missing`): only `[{"source":"read-first","codes":["web_judge.read_invalid"]}]`.
- Attempt 1 not confirmed (`answer_first.judged_unsure`, read-first `web_judge.read_invalid`); attempts 2-4 not reached.

| Request table (33 requests) | Round 4 | Round 5 |
| --- | --- | --- |
| First request | `whole` | `whole` (6,952 chars) |
| Later requests carrying `changes` | 8 of 32 | 14 of 32 |
| Later requests whose fresh delivery is only a `whole` | n/a | 18 of 32 |
| Whole deliveries over the run | n/a | 33 (about one per request) |
| References over the run (`droppedAt` and `replacedBy`) | n/a | 134 (up to 2 `droppedAt` and 6 `replacedBy` per request) |
| `unchanged` deliveries | n/a | 0 |
| Page text per request, min / max | 6,952 / 13,566 | 6,952 / 19,700 (at the 20,000 budget at most) |
| `web.find_on_page` offered | 0 of 33 | 0 of 33 |
| Capture node in the `run_node` enum | 0 of 33 | 0 of 33 |
| Tool-list digest | one (`984119dba31c`) | one (`984119dba31c`) in all 33 |

Reading: with the query out of the key, facet and sort presses on one path now arrive as `changes` (14 of 32), but 18 of 32 later requests still carry only a whole page (a new path, a changed-too-much page, or the D7 rule that shows the key whole again when changes would outgrow its whole view), and page text per request is higher (max 19,700) because older pages are kept as references only after the budget is reached.

## Round 6: merged tree (dev 3b610be39 / t1039)
- Run once, as in round 4 (headed, slot 2, instance `t1036-lab`; the run waited in the heavy gate, then the Lab rebuilt; no `behind-dev` refusal; log `test-runs/t1036f/lab9.log`).
- Result line: `{"status":"not_judged","task":"bigbox-retail-rated-delivery-towels","why":"AttemptScriptRefused","evidence":"...\test-runs\instances\t1036-lab\attempts\run-mwvxrxq8-84effe55"}` after request 33 refused. Attempt 1 not confirmed; attempts 2-4 not reached.
- `steps/` counts: `before_state_missing` 0 files; `read_invalid` 50 files (expected, W2's fix not in dev). The judge's named gaps (steps 0028 and 0058): only `read-first: web_judge.read_invalid`.
- Request table (33 requests): first `whole`; later requests carrying `changes` 13 of 32 (round 5: 14; round 4: 8); whole deliveries 33; references 129; page text per request 6,952 min / 17,999 max; no `web.find_on_page` and no capture node in the `run_node` enum in any request; one tool-list digest (`984119dba31c`) in all 33.
- Flow charts (t1039): `C:\Users\osrs_\FluxStuff\fxwork\t1036\!FluxIQWebExtension\test-runs\instances\t1036-lab\attempts\run-mwvxrxq8-84effe55\flow.png` (193 KB) and `...\flow.svg` (19.6 KB), written beside `attempt.json` (not under an `attempt-N/` folder, since the attempt never ended). The chart is titled "Flow chart (draft)": START, the INPUT box with the task instruction, the parameters (Search, Sort by, with values "paper towels", "rating_high"), then the numbered steps from 1 NAVIGATE through the clicks on "Paper Towels (28)" and "Delivery (21)" and the sort choice.
- Round 5 for the record: see the Round 5 section above (lab8.log, 14 of 32).

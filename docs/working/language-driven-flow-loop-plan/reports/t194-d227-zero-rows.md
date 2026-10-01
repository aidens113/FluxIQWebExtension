# t194-d227: why t227's chat-driven earbuds run returned 0 of 13

Run `run-muq310ht-ab80eed0` (`everything-store-plus-earbuds-under-50`, chat-driven, $0.277).
Run directory: `C:/Users/osrs_/FluxStuff/fxwork/t227/!FluxIQWebExtension/test-runs/run-muq310ht-ab80eed0/` (called `RUN/` below).
No `.work/<runId>` was kept for this run. Read only: nothing was launched, edited or committed.

## Outcome

Done. The read returned 0 rows because **the Flow never types the search**. The build typed "wireless earbuds" into the search box and pressed Go. The model then put the Go press into the Flow but never put the typing into it.

The playback therefore pressed Go on an empty search box and landed on `/s?i=all&field-keywords=&k=`, which reads "No results for """. No result list was ever drawn, so the read saw 0 items. The read has `minItems: 0`, so it "succeeded" with nothing.

The build's own dry run should have refused this Flow before it was proposed, and could not. The web domain's "read something, then read nothing" check counts the longest array anywhere in the result payload, not the rows read. A live list read is therefore never counted as 0.

Current dev does not fix either defect.

## What happened, with evidence

### 1. The Flow as saved (`RUN/snapshots/flow-lane.json`, `authoredNodes`)
- It has five nodes: `s1`–`s3` `web.output.browser-navigate`, `s4` `web.output.dom-click` (`button` "Go"), and `s5` `web.output.dom-extract_list`.
- **There is no `dom-type` node.**
- The `s5` request:
  - `item` is withheld (redacted, not absent).
  - The fields are name, price, rating and url (all `required: true`), plus plus and ad (optional). All selectors are withheld.
  - `where`: one condition, `ad` attribute `is: absent`.
  - `paginate: { next: <withheld>, maxPages: 5 }` and `minItems: 0`.
  - `handle`: NO EVIDENCE. Only resolved selectors are listed, all withheld.

### 2. The page the playback read on
- `RUN/screenshots/00017-9e8191ef9ad2.jpg` (22:08:00, the chat card reads "Running step 5 of 5: Reading the list") shows URL `127.0.0.1:60830/scenarios/everything-store/s?i=all&field-keywords=&k=`. That is an empty query.
- `RUN/screenshots/00013-0eb558a3acb3.jpg` and `00014-de681dbc3776.jpg` show the same URL with "No results for """ and "No results for . Try checking your spelling".
- The playback click `s4` reports `targetResolution.status: unresolved_no_candidates` yet `status: succeeded` (`flow-lane.json` `actions[3]`). The URL above shows that Go was pressed, with nothing typed.

### 3. The read's own account (`flow-lane.json` `actions[4].extraction`, and `extraction.steps[0].reads[0..1]`)
- `recordCount 0`, `itemsSeen 0`, `emptyRecords 0`, `pagesRead 1`.
- `listPresence: "never_appeared"`, and `listWait: { stoppedOn: "window_elapsed", waitedMs: 10001, waitedFor: 1 }`.
- `conditions: { applied: 0, kept: 0, rejected: [0] }` and `paginationStop: "control_absent"`.
- The conditions removed nothing; the list never existed. The reauthored Flow's read (`actions[10]`) reports the same.
- `RUN/snapshots/extraction-mismatches.json`: expected 13, observed 0.

### 4. The build typed the search, and the Flow lost it
Build trace: `flow-lane.json` `build.evidenceLoop.steps`, the same rows as `RUN/snapshots/decision-trace.json` `flows[0].adaptations[1]`.
- Iteration 24 is `web.output.dom-type`, `web.action.succeeded`, `effectApplied: true`, `pageState: changed`. It was appended at draft position 9: the row shows `draft.steps: 8` before it.
- Iteration 25 is `web.output.dom-click` (Go), succeeded, appended at position 10.
- `build.declaredConsequences` refs: `search.earbuds.1` ("type text" into "Search Brightaisle") and `search.submit.1` (click "Go").
- The final dry run's refs are `dryrun.1.reset`, `dryrun.1.1`, `dryrun.1.2`, `dryrun.1.4` (three navigates), `dryrun.1.10` (click) and `dryrun.1.19` (extract list); see `declaredConsequences` indexes 24–29.
  - The replay names each call `dryrun.<attempt>.<position>` and replays only proposed steps. Core: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/replay-draft.ts:99,122`.
  - **Position 9, the typing, was not a proposed step.**
- How a step gets into the Flow:
  - Every step the loop runs is appended as `taken` (evidence, not part of the Flow). It becomes `kept` only when the model's call carries `add`. Core: `.../runtime/llm/evidence-loop.ts:201-211`.
  - Proposed means `disposition === "kept"` and proposable. Core: `.../runtime/flow-draft/step.ts:188-190`.
  - The only other way in is an `add` amendment (`.../runtime/flow-draft/amendment.ts:209`). The build's eight amendments (iterations 29–36) all have `targetedStepIds: ["d14"]` (the list read), so none of them touched the typing.
- So the model added the navigates and the Go press as it ran them, and never added the typing.
  - Which `add` flags each call carried: NO EVIDENCE. The decision arguments are not published. This is inferred from the dry-run positions above.
  - The model's last reasoning line, in `RUN/screenshots/00012-c38dbfce39d4.jpg`, reads: "Budget is nearly spent and the draft already holds the search, the listing extraction and the filtered result, so I complete the Flow now." The model believed the search was in the draft.
  - Whether the completion check's act claims named the search act: NO EVIDENCE.

### 5. The build's last reads of draft step `d14` (iterations 27, 29–36)
- Iteration 27 was the first read: 40,755 evidence bytes, `pageState: changed`.
- The reruns returned 27,204 bytes at iterations 29, 30 and 31, 19,103 at 32, 25,663 at 33, and 19,103 at 34, 35 and 36. Every rerun reports `pageState: unchanged`.
- The page was `/s?k=wireless+earbuds&page=5`, a real results page with product cards (`RUN/screenshots/00010-d4370b6c6aac.jpg` and `00011-fabf91248db4.jpg`).
- The chat reasoning in the same screenshots describes the attempts in order:
  1. Rows were rejected by the Plus, rating and price conditions together ("so the ... conditions stop rejecting every row").
  2. The read was rerun "with only the ad-absent condition so the Flow reads every result row across all five pages".
  3. It was then rerun with that condition removed and later put back. The saved `where` is ad-absent only.
- Rows returned per read: NO EVIDENCE. The trace rows carry bytes, not counts, and the extraction summaries of the build's reads are not in the bundle.

### 6. Why the build's dry run did not catch it
- The completion check replayed the Flow from the start: navigate, navigate, navigate, Go, then read the list. That is screenshot `00013` at 22:07:30, captioned "Trying the Flow from the start: reading the list", with "No results for """ on screen.
- The verdict let the proposal through:
  - The `core.decision_complete` row is stamped 22:07:34.658Z.
  - `RUN/events.ndjson` seq 14 shows the chat ending at 22:07:37.
  - `build.outcome` is `proposed` and `chat.ending` is `created`.
- Any replay answer other than `replayed` blocks a proposal (Core `.../runtime/flow-draft/dry-run.ts:224-250`). So the read's replay must have answered `core.replay.replayed`.
- The domain's guard for exactly this case is in `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension/domain/src/runtime/llm-evidence/node-run/replay.ts:241-249`. It answers `core.replay.changed` "the step read nothing where it read N" only when `produced.records > 0 && now === 0`.
- Both numbers come from `webNodeRecordCount` (`replay.ts:258-268`, and `replay.ts:92` for the exploration side). That function returns **the longest array anywhere in the payload, up to depth 6**, not the number of rows read.
- A live `extract_list` payload always carries other arrays:
  - `extraction.fieldNames`, six entries here (`flow-lane.json` `reads[*].fieldNames`).
  - `extraction.missingFields` and `extraction.conditions.rejected`.
  - `snapshot.interactiveElements`. The snapshot is always attached to a list read (`apps/extension/src/content/actions/extract-list.ts:74`) and carried into the payload (`apps/extension/src/content/action-runtime/results.ts:507-508`, `domain/src/client/gateway-mapping.ts:312-314`, `apps/extension/src/runtime/result-mapping.ts:61-62`). The protocol type is `apps/extension/src/shared/protocol.ts` (`interactiveElements: DomElementDescriptor[]`).
- So `now` is at least 6 for a 0-row read. The collapse check cannot fire on a live read, and the replay answered `replayed`.
- The unit test that covers it stubs a payload of `{ extracted: [] }` only (`domain/src/runtime/llm-evidence/node-run/tests/replay.test.ts:104-119`), which is why it passes.
- The Flow's own read also passed with 0 rows:
  - `validationFor` passes when `records.length >= minItems` (`apps/extension/src/content/actions/extract-list.ts:171-174`), and the model wrote `minItems: 0`.
  - G4's `everyRecordEmpty` needs `records.length > 0` (`extract-list.ts:185-187`), so it does not cover a read with no rows.

## Cause, to file:line
1. **Primary: a step the Flow depends on was never added.** The build typed the query (draft position 9), and the step stayed `taken` because the model's call did not `add` it (Core `.../runtime/llm/evidence-loop.ts:207-211`). The Go press it depends on was added (position 10). Nothing in Core or the domain notices a kept step that ran on a page state only an un-added step produced.
2. **The dry-run gate that should have refused it is blind for live list reads.**
   - `domain/src/runtime/llm-evidence/node-run/replay.ts:243` (`now = webNodeRecordCount(result.payload)`) and `replay.ts:92` (`records = webNodeRecordCount(input.payload)`, the exploration side) count the longest array in the payload, not `extracted`.
   - So `replay.ts:247` (`before > 0 && now === 0`) never fires. The replay answered `replayed` on a page with no results, and the build proposed the Flow.

## Is it fixed on current dev (t194 tree at `8fa5a944`)?
**No.**
- `git diff 58ec93dd 8fa5a944 -- domain/src/runtime/llm-evidence/node-run/replay.ts` is empty. The run's tree branched at `58ec93dd`, per its debug file, and launched at 22:04Z, before the 15:19 -0700 dev merge in t227.
- Core `7618316a..HEAD` (t194 Core) changes `evidence-loop.ts` only to add the unanswered-provider counter (`git diff 7618316a HEAD`). The `taken`/`add` rule and the dry-run verdict are unchanged.
- t223 stable handles and lane A F16-F22 cut the 20 refused clicks that burned the build's budget (the debug file). The model's own words tie its hurried completion to budget, so those fixes may make an omitted `add` less likely. They change neither the `add` rule nor the replay count. This is speculative; there is no run evidence either way.
- Lane C F23-F28 and G4 (`8c78bffb`): G4 fails a read whose rows are all empty, not a read with no rows (`extract-list.ts:185-187`). Lane D F28-F33: nothing found in `replay.ts`, `run.ts` replay statements or Core flow-draft. I did not read every lane D commit.

## Proposed fix (not applied)
**Smallest change, in the domain only:** make the replay statement and the replay compare the read's own counts, not the longest array.
- In `domain/src/runtime/llm-evidence/node-run/replay.ts`, have `webNodeReplayStatement` (`:91-97`) write `produced: { records: extraction.recordCount, itemsSeen: extraction.itemsSeen }` from `payload.extraction`. Fall back to `Array.isArray(payload.extracted) ? length : undefined`.
- In `replayStep` (`:241-249`), answer `core.replay.changed` when either of these holds:
  - `before.records > 0 && now.records === 0`, or
  - `before.itemsSeen > 0 && now.itemsSeen === 0`. This is "the list was there while exploring and never appeared now". It holds even when the exploration read's conditions kept 0 rows, which may have been true here (NO EVIDENCE of the counts).
- Add a replay test whose stub payload carries `extraction.fieldNames` and a `snapshot.interactiveElements` array, the shape a live read has.
- Effect on this run: the completion dry run would have answered `changed` for position 19. Core's feedback then tells the model that the step before it left the target somewhere else and to correct that step (`dry-run.ts:280`), which points at the un-added typing.

**Follow-up (larger, Core, optional):** at completion, flag a `taken` step whose `stateAfter` is the `stateBefore` of a kept step, meaning a kept step ran on a page only an un-added step produced. Core already carries both digests on every step (`.../runtime/flow-draft/step.ts:118-121`). Not needed once the replay gate works for this case.

## Commands run and observed results
- Read `RUN/snapshots/flow-lane.json`, `decision-trace.json`, `live-llm.json`, `extraction-mismatches.json`, `RUN/events.ndjson`, and screenshots `00010`–`00014` and `00017` (node one-liners, Read).
- `git diff 58ec93dd 8fa5a944 --stat -- domain/src/runtime/llm-evidence/node-run/replay.ts` printed nothing.
- `git diff 7618316a HEAD -- .../llm/evidence-loop.ts` in t194 Core printed only the unanswered-provider hunk.

## Not verified
- The per-call `add` flags and the act claims at completion; the decision arguments are not in the bundle.
- The row counts of the build's `d14` reads.
- That the payload reaching `replay.ts` still holds `snapshot` after Core's client gateway. I read only the extension and domain mapping. `extraction.fieldNames` (6) alone already defeats the check.
- No test or build was run; the brief was read only.

## Open questions or contradictions
- The earlier debug says the reauthor's `Read list` attempts were refused "it wasn't on the page". The reauthored Flow (`node.bootstrap.8e79c542189f1267.main.*`) also has no type step: its `s5` read reports `never_appeared` (`actions[10]`), then `s6` (a click) fails `web.target.not_found`. The repair inherited the same omission.

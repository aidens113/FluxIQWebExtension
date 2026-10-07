# Report: node-audit-reading

Lead report (lead, read-only audit) for "Brief: node-audit-reading" in
`docs/working/node-catalog-plan.md`. Read at downstream `a4bddccb` (dev), Core sibling checkout as found.
No source, test or other doc file was changed; nothing was built, tested or run; no Lab, browser or provider
call was made.

Prefixes: D = `domain/src`, E = `apps/extension/src`, EE = `apps/extension/e2e/content/tests`,
CORE = `../!FluxIQ/packages/fluxiq/src/programs/automation-studio`.

## Outcome

Done for the code audit of all nine members of the family. Live-failure evidence and the observation-tool map
came from two Explore sweeps whose conclusions were spot-checked (see "Not verified" for what was not).

## The family on one screen

| Node / tool | Domain id | Effect | Verifies state | Model-taught? | Verdict |
|---|---|---|---|---|---|
| extract | `web.output.dom-extract` | observe | no | no (catalog only) | orphaned: its value reaches no dataset |
| extract_list | `web.output.dom-extract_list` | observe | no | yes (grammar, detect tool, Lists line) | strongest node; one-page redesign landed |
| next_page | `web.output.dom-next_page` | mutate | no | yes (web-5 Lists line) | new; several silent-end and missed-change gaps |
| assert | `web.output.dom-assert` | observe | yes | no | sound core, vacuous-text bug, first-match bug |
| capture_snapshot | `web.output.dom-capture_snapshot` | observe | no | as the free "look", never a step | fine as a look; meaningless as a Flow step |
| wait_for_selector | `web.output.dom-wait_for_selector` | observe | yes | no | first-match bug; CSS only, no identity fallback |
| wait_for_text | `web.output.dom-wait_for_text` | observe | yes | no | exact, case-sensitive, light-DOM text only |
| detect_repeating_structure | tool, via capture_snapshot `detectStructure` | observe | n/a | yes | one list per answer; stale "paginationBound" text |
| find_on_page | tool, over captured evidence | observe | n/a | yes | sound; query not whitespace-collapsed |

Definition facts (D/output-nodes/definitions.ts): effects at :136-157 (next_page is `mutate`, :153-154);
state-verifying set at :166-170 (assert, wait_for_text, wait_for_selector); the `item` input port only for
nodes whose schema requires `selector` (:235), so extract, wait_for_selector and assert can be scoped to a
loop row and wait_for_text, extract_list and next_page cannot; `ended` branch port for next_page only
(:72-74, :236); records port and `recordsPath` for extract_list only (:52-54, :236, :264).

---

## 1. Contracts and paths, per node

All web nodes run through one native implementation (D/output-nodes/native-runtime.ts:77-94) that emits one
`policy.output.dispatch` effect; Core's io-policy dispatches it and puts the browser result under
`outputs.result` (CORE/runtime/io-policy.ts:42-51, 108-119); the route is `dispatchedRoute(result.payload)`,
which is how next_page's `ended` reaches Core. The gateway parameter reader lifts each structured field
(D/client/gateway-action-parameters.ts:70-104); the extension routes by action type
(E/content/actions/execute.ts, `routeContentAction`), wrapped in the recovery loop (`runWithRecovery`,
5 s budget for `target_absent`, E/content/action-runtime/recovery/budget.ts:82-89).

### 1.1 extract (`web.dom.extract`)
- Contract: `selector` required, `element`, `visualTarget`, `timeoutMs`, `extract: {mode: text|html|attribute|value, attribute?}`
  (D/actions/schemas.ts:286-298, 145-153). Output: `outputs.result.extracted` (D/client/gateway-mapping.ts:322,
  withheld for a sensitive element :350-351). Routes success/failed. No consequences (observe).
- Path: native-runtime.ts:87 (check-wait parameters) -> gateway -> E/content/actions/extract.ts:22-41 ->
  E/content/action-runtime/extract.ts:100-109.
- Tests: E/content/actions/tests/extract.test.ts (sensitive refusal; evidence-only success); e2e
  EE/actions.spec.ts, identity specs, selectors/tests/volatile-selector-replay.spec.ts.
- Not tested: html mode with sensitive descendants on the action path, attribute mode, empty value, hidden element.

### 1.2 extract_list (`web.dom.extract_list`)
- Contract: `extractList` (`{handle, fields?, where?, dedupe?, sort?, minItems?, maxItems?}` handle form or literal
  `{item, fields}`); `recordOutput` derived or reconciled; records port; one page per run (S4).
  D/output-nodes/extract-list/catalog-text.ts grammar (`WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR`), dispatch.ts:162-184,
  one-page-read.ts:43-51 (`dedupe`, `sort`, `maxItems`, `minItems` leave the page for `recordOutput.process`;
  `answer: "kept"` asked of the page, dispatch.ts:199-204). `paginate` beyond one page refused
  `web.extract_list.paginate_retired` (dispatch.ts:164, 227-243).
- Path: native-runtime.ts:88-89 -> gateway -> E/content/actions/extract-list.ts:83-112 -> extraction/list-reader.ts
  (reveal of lazy items: extraction/list-wait.ts header; field reading incl. open shadow roots:
  extraction/field-reader.ts:98-160).
- Tests: rich. Domain: output-nodes/extract-list/tests (9 files), actions/extraction/tests (11). Extension:
  actions/tests/extract-list*.test.ts (5), extraction/tests (24 files). e2e: EE/extraction/tests (19 specs).
- Not tested: a list whose items live inside a shadow root; a Flow-run pass that lands on a page with zero items
  (see bug R4); item-selector drift between passes.

### 1.3 next_page (`web.dom.next_page`)
- Contract: `nextPage: {list: "extraction.N", control?: "tN"}` (handle form) or literal `{item, itemElement?, pagination?}`
  with `pagination` one of `{mode?: next, next}`, `{mode: loadMore, control}`, `{mode: scroll}`, `{mode: numbered, pages}`
  and no bound (D/actions/next-page/request.ts:19-32; request-value.ts:56-99). `timeoutMs` default 30 s
  (D/output-nodes/next-page/parameters.ts:118). Answer: `moved {by: next|following|numbered|loadMore|scroll, page?}`,
  `ended {stop: control_absent|control_disabled|no_following_page|scrolled_to_end}` with `route: "ended"`, or
  `failed {stop: list_unchanged|rate_limited|list_vanished|control_not_clickable|page_fault}` (answer.ts:143-155).
  Routes success / ended / failed. Effect `mutate`.
- Path: D/runtime/llm-evidence/plan-resolution/next-page-slot.ts:48-96 (handle -> request; `control` always
  becomes `{next: selector}`, :78) -> D/output-nodes/next-page/dispatch.ts:75-79 -> gateway -> E/content/actions/next-page.ts:53-76
  -> E/content/extraction/page-advance/move-page.ts:40-80 -> step-page.ts:132-150 -> follow-next.ts / load-more.ts /
  scroll-for-more.ts / numbered-page.ts -> list-change.ts:129-162; cross-document: continued-move.ts:254-262,
  arrival.ts:29-61.
- Tests: E/content/actions/tests/next-page.test.ts (6: mapping of moved/ended/failed/timed out);
  E/content/extraction/page-advance/tests/move-page.test.ts (9: same-page Next -> following, Next found from the
  list, disabled span ends, script Next on last page ends, list absent fails, cancelled link by address, arrival,
  429 reload, 503 twice); D/actions/next-page/tests (request and answer readers);
  D/runtime/llm-evidence/plan-resolution/tests/next-page.test.ts; D/output-nodes/tests/next-page-node.test.ts;
  E/runtime/tests/next-page-continuation.test.ts; e2e EE/extraction/tests/everything-store-next-page.spec.ts.
- Not tested: `loadMore`, `scroll` and `numbered` ways through `movePage` (only `next`); a list re-rendered in
  place with the same nodes (bug N1); a Bootstrap-style disabled Next (`li.disabled > a`, bug N3); a list inside a
  shadow root; a `control` handle naming a Load more button (N4).

### 1.4 assert (`web.dom.assert`)
- Contract: `assert: {kind: exists|absent|text|url|visible|enabled, expected?, timeoutMs?}` plus an optional element
  target (D/actions/schemas.ts:123-132, 318-323). One claim per node. Default window 5 s
  (E/content/action-runtime/assertion-evaluation.ts:107). Fails STATE_MISMATCH when judged false, TIMEOUT when the
  subject never appeared (E/content/actions/assert.ts:261-263). `verifiesState: true`.
- Path: native-runtime.ts:87 -> gateway (`assertRequestValue`, D/client/gateway-action-parameters.ts:172-178) ->
  E/content/actions/assert.ts:129-160 -> action-runtime/assertion-evaluation.ts:111-177. The same vocabulary is
  Core's `expectedState` post-condition evaluator (definitions.ts:76-94; D/runtime/expectation/conditions.ts).
- Tests: E/content/action-runtime/tests/assertion-evaluation.test.ts (5 timing), assertion-visibility.test.ts
  (enclosed vs hidden, shadow), E/content/actions/tests/assert.test.ts (11: codes, timeouts, shadow host chain,
  row scoping); e2e EE/check-assert.spec.ts (9).
- Not tested: `text` with no `expected` (bug A1); a hidden first match with a visible second (A2); page-scoped
  text inside an open shadow root (A3); ancestor `aria-disabled` (A4); case or whitespace differences in `text`.

### 1.5 capture_snapshot (`web.dom.capture_snapshot`)
- Contract: no parameters in a Flow (definitions.ts:303); the authoring runtime adds `detectStructure` and search
  options (E/content/actions/capture-snapshot.ts:18-25). It is the "look" the evidence loop takes
  (D/runtime/llm-evidence/node-run/catalog.ts, `WEB_LLM_OBSERVATION_NODE_ACTION`, `proposes: false`).
- Path: E/content/actions/capture-snapshot.ts -> action-runtime/capture-snapshot-for-response.ts:34-37 ->
  dom-snapshot.ts.
- Tests: many e2e evidence specs (EE/evidence/tests/*, 11 specs) and extraction specs use it.
- Gap: as a Flow node it does nothing a run reads; Core still ranks it in the build catalog.

### 1.6 wait_for_selector (`web.dom.wait_for_selector`)
- Contract: `selector` required, `wait: {condition: present|visible|enabled|absent|url|stable, url?, stableForMs?}`,
  `timeoutMs` default 10 s (D/actions/schemas.ts:66-74, 112-120, 274-279). Timeout -> `timed_out`.
- Path: native-runtime.ts:87 -> gateway (`waitRequestValue`) -> E/content/actions/wait-for-selector.ts:171-193 ->
  action-runtime/wait-conditions.ts:60-153 on waits.ts:234-275 (mutation observer on the light document plus a
  50 ms poll).
- Tests: EE/waits.spec.ts (10), EE/shadow-roots/tests/shadow-root-waits.spec.ts (4),
  E/content/action-runtime/tests/recorded-shadow-hosts.test.ts, E/content/actions/tests/execute.test.ts.
- Not tested: several matches of which the first is hidden or disabled (W1); a drifted selector whose element the
  fingerprint would still find (W2); `stable` on a page with a ticking widget or shadow-root churn (W4).

### 1.7 wait_for_text (`web.dom.wait_for_text`)
- Contract: `text` required, `wait.condition` (present|visible|absent|url|stable), `timeoutMs` default 10 s
  (D/actions/schemas.ts:280-285). No element scope.
- Path: E/content/actions/wait-for-text.ts:232-252 -> wait-conditions.ts:90-117 -> `pageText()` =
  `document.body.innerText` (waits.ts:278-280).
- Tests: EE/waits.spec.ts:211-229 (2), E/content/actions/tests/execute.test.ts.
- Not tested: text split across elements, case, text inside an open shadow root, text inside a same-origin frame.

### 1.8 detect_repeating_structure (tool)
- Contract (D/runtime/llm-evidence/tools.ts:392): around a target handle, else the page's largest list; returns an
  `extraction.N` handle, field keys/labels/kinds/coverage, item count, `pagination` and a `nextPageNote`
  (D/runtime/llm-evidence/structure/packet.ts:64-72). Runs as capture_snapshot with `detectStructure`.
- Extension: E/content/extraction/detect-structure.ts:124-373 (one best run by data held, thin runs last, outward
  search from a target, lone record beside a run, waits up to 5 s for a run or for skeletons to fill).
- Tests: D/runtime/llm-evidence/structure/tests (9), E/content/extraction/tests/infer-list, infer-fields, item-selector;
  EE/extraction/tests/structure-detection.spec.ts, inference.spec.ts.

### 1.9 find_on_page (tool)
- Contract (tools.ts:401): case-insensitive substring over words, label, value, options, href and every attribute
  name and value, hidden elements included; 50 matches a page with an `after` cursor
  (D/runtime/llm-evidence/page-find/search.ts).
- Tests: D/runtime/llm-evidence/page-find/tests (3); EE/evidence/tests/page-view-*.spec.ts.

---

## 2. Bugs found

Each with file:line and how it fails. Ordered by harm.

- **N1. next_page misses an in-place re-render and fails a real move.** `listChanged`
  (E/content/extraction/page-advance/list-change.ts:222-227) counts a change only when the first old item
  detached, the count changed or the first node differs. A client-rendered list that reuses its DOM nodes and
  rewrites their text (React/Vue lists keyed by index, virtualised grids) keeps all three, so the move waits 10 s
  and fails `list_unchanged` (OUTPUT_NOT_OBSERVED) although page 2 is showing. A same-size page reached by a
  router that keeps the nodes has the same result.
- **N2. next_page with no detected way only tries Next.** `stepPage(undefined, ...)` goes straight to `followNext`
  (step-page.ts:132-133); the design (read-list-collect-design.md 4.2(a) step 1) lists Next, following page,
  numbered page, Load more and scroll. A list whose detection carried no pagination but which continues by Load
  more or infinite scroll answers `ended control_absent` on page 1: a silent truncation that the loop treats as a
  clean end.
- **N3. "Disabled" means only the element's own state.** `isDisabled` (E/content/extraction/pager-reading/pager-reading.ts:114-116)
  reads `:disabled` and the element's own `aria-disabled`. The common Bootstrap pager draws the last page's Next
  as `<li class="disabled"><a href="#">Next</a></li>` (or `pointer-events: none`), so the control is "enabled",
  is pressed, nothing changes, and the step fails `list_unchanged` instead of answering `ended control_disabled`.
  The same own-only rule is in the wait (`isEnabled`, wait-conditions.ts:181-184) and the assert
  (assertion-evaluation.ts:278-280), while the click resolver reads ancestors (design note, resolve-target.ts).
- **A1. A `text` assert with no expected text always holds.** The gateway keeps an absent `expected`
  ("an empty expectation is still an expectation", D/client/gateway-action-parameters.ts:171-178) and the
  evaluator uses `request.expected ?? ""` (assertion-evaluation.ts:161) and `text.includes("")` (:209), which is
  true. A `url` claim with no URL is refused `malformed` (:236); `text` is not. A verifying node then proves
  nothing, and because it carries `verifiesState: true` Core counts it as verification of a repair.
- **A2/W1. Visibility, enabled and text are judged on the first match only.** Assert's `firstMatch`
  (assertion-evaluation.ts:191-198) and the wait's (wait-conditions.ts:143-149) take the first element the
  selector matches. A page that keeps a hidden duplicate first (a mobile menu, a template row, an off-canvas copy)
  fails `visible`/`enabled` (and a selector-scoped `text`) although a matching element is visible and enabled.
- **A3. Page-scoped text ignores open shadow roots.** Assert `text` with no target reads `document.body`
  (assertion-evaluation.ts:202, 217-223) and wait_for_text reads `document.body.innerText` (waits.ts:278-280);
  text a web component draws inside its root is not there. `composedRenderedText`
  (E/content/action-runtime/composed-rendered-text.ts:32-43) already exists for exactly this and is used only by
  the in-place effect watch.
- **W3. wait_for_text and assert `text` are exact and case-sensitive.** `pageText().includes(text)`
  (wait-conditions.ts:95, 104, 116) on raw `innerText` (newlines between blocks) and `text.includes(wanted)` on
  whitespace-collapsed text (assertion-evaluation.ts:209) with no case folding. "Order Confirmed" against "Order
  confirmed", or "Total: $5" drawn as two cells, never holds. `find_on_page` and extract_list conditions ignore
  case (search.ts `found`; tools.ts:392 "ignoring case"); these do not.
- **R4. A pass that lands on an empty page fails the loop.** In a Flow run `answer: "kept"` keeps `minItems`
  at 1 counted on items seen (E/content/actions/extract-list.ts header, `countsItemsSeen`, `measured`). A search
  with no results, or a numbered pager whose last page is empty, fails the read (OUTPUT_NOT_OBSERVED) and so
  the run, where the right answer is an empty collection. The model can write `minItems: 0`, but the catalog
  teaches it only as "0 = none" (catalog-text.ts grammar) and nothing ties it to the loop.
- **D1. The detect tool promises a field that is gone.** tools.ts:392 says it "Returns ... pagination and
  paginationBound"; packet.ts:64-72 says `paginationBound` was removed by S4. It also says "If conditions reject
  every item, the node returns what it read" (tools.ts:392), which is now true only while exploring; a Flow
  read answers the kept rows, possibly none (dispatch.ts:124-127).
- **D2. Stale action description.** `web.dom.extract_list` is still "following pagination" (D/actions/schemas.ts:327).
  The node definition overrides it with the catalog text (definitions.ts:201), but the action definition is what
  `webAutomationActionDefinitions` consumers and docs read.
- **W5. A wait_for_text that names no real text is accepted and passes.** Bigbox pickup-order, three runs
  (debugs/run-muo06beo-bcce5ab7.md:33,54; run-muo12lnk-9c841755.md:33,55; run-muo2b224-aa7f6336.md:33,54): an
  authored `web.dom.wait_for_text` with text "null" "succeeded" in 187 ms. Why it held is not traced (the bundle
  withholds parameters); either way a verifying node whose text is "null" verified nothing. Nothing at plan
  resolution refuses a wait or assert whose text is empty, "null" or "undefined".
- (Withdrawn while auditing: find_on_page does collapse the query, page-find/query.ts:19.)

## 3. Robustness gaps (not bugs, but missing behaviour)

| Gap | Where | Effect |
|---|---|---|
| G1 next_page press is a bare `HTMLElement.click()` | list-change.ts:185-197 | no pointer/mouse events, no scroll into view, no actionability or covered check; a pager listening for `pointerdown`/`mousedown` never moves (`list_unchanged`), while `web.dom.click`'s gesture would |
| G2 Lists and pagers in shadow roots | arrival.ts:22-26, list-change.ts:222-227, move-page.ts:59, list-reader.ts:322,520, item-selector.ts:114, detect-structure.ts:369 | every list query is `document.querySelector(All)`; a results grid inside a web component's root is undetectable, unreadable and cannot page |
| G3 No repeat detection across next_page passes | move-page.ts header ("keeps no history"), follow-next.ts:211-217 | a Next that cycles (back to page 1, or to the same page without a pager to read) loops to the repeat's `most` bound; whole-row dedupe hides the rows but the run spends up to 50 page loads |
| G4 The loop does not stop at the read's limit | one-page-read.ts (maxItems -> `process.limit`) | "the first 20 results" over a 40-page list reads every page up to `most` and then cuts |
| G5 wait_for_selector and assert-with-selector use CSS only | wait-for-selector.ts:171-182, assert.ts:196 | a recorded selector that drifted (generated class) times out the wait while the following click resolves the same target by fingerprint |
| G6 `absent` means "not in the DOM" | wait-conditions.ts:112-117, assertion-evaluation.ts:153-160 | a spinner or modal hidden by `display:none` but kept in the DOM never satisfies "absent"; there is no `hidden` condition |
| G7 `stable` watches only the light document | waits.ts:269-273 | mutations inside shadow roots are not seen (false "stable"); a ticking clock or carousel makes it never stable (timeout) |
| G8 Timeout reports do not say what was seen | wait-conditions.ts:156-164 | "the element was not visible before the timeout" does not distinguish not found, found hidden, found covered, or N matches; repair has to guess |
| G9 Frames | wait_for_text, assert `text` page scope | a same-origin child frame's text is not read; only the frame the command targets is |
| G10 next_page `control` handle is always mode `next` | next-page-slot.ts:78 | a Load more button named as the control gets Next semantics; it works only because an appended list changes length; the `following` swap (follow-next.ts:211-219) can misread a script button with a pager beside it |
| G11 detect answers one list | detect-structure.ts:211-214 (`detectLargest`) | a page with two lists (results and a sponsored carousel, two tables) shows the model only the largest unless it aims a handle; the answer does not say other lists exist |
| G12 single-value extract is orphaned | D/output-nodes/definitions.ts:52-54 (no recordsPath), no catalog text | its value lands in `outputs.result.extracted` only; no dataset, no judge sees it, the model is not taught it; "what is the price of X" goes through extract_list one-record mode |
| G13 capture_snapshot as a Flow step | definitions.ts:303 | a Flow step that does nothing; still offered by Core's catalog ranking |
| G14 assert is one claim per node | schemas.ts:123-132 | the Flow pays a node per claim; `expectedState` already takes a list with `mode: all|any` |
| G15 page-wide detection is top-frame only | D/runtime/llm-evidence/structure/detect.ts:179-181 (no `browserFrameId` without a target); E/runtime/look-across-frames.ts:54-58 merges only the snapshot | a list inside an iframe is found only when the model aims a target handle in that frame; no e2e covers frame detection |
| G16 a detection target inside a shadow root cannot be named | D/extraction/structure-detection.ts:119-123 (wire keeps `selector` only, no host chain) | a target recorded inside a root resolves against the light DOM: `target_not_found` after the 5 s wait, or the wrong element |
| G17 collapsed lists and huge pages | E/content/extraction/largest-runs.ts:33-37, 74 (first item must be rendered; 10,000 elements scanned, 24 runs) | a list behind a closed panel is undetectable though find_on_page sees it; a list past the 10,000th element is missed silently |
| G18 detection binding uses class/path selectors | structure/handles.ts, infer-fields labels | hashed or atomic classes that change between renders break the handle with no re-detect (live: run-muqilf9s C2, run-mux6nxst D3-3; fix t279 "ready, not merged" per week-review report:160) |
| G19 no unit tests for detect-structure.ts or largest-runs.ts | E/content/extraction/tests | only Playwright specs (structure-detection.spec.ts, 8) cover ranking, outward search and thin runs |

---

## 4. Live failures

From an Explore sweep of `docs/working/language-driven-flow-loop-plan/debugs/` (D) and the lane and week-review
reports. Roll-ups already exist: week-review/causes-early.md:86 (#21 "Lists were read wrong", 15 runs),
causes-late.md:101 (W16, 12 runs, "mostly fixed"), week-review/report.md:74-82 (pagination inside the read).
Fixed items are listed only where they show a class still open.

**extract_list (open classes)**
- A read on the wrong page passes. Homepage instead of results (D/2026-09-24-everything-store-plus-earbuds.md:90,123),
  robot-check page (D/run-muntcsge-36c2663a.md:163), no-results page (D/run-muntufao-7b7bc04a.md:183), search never
  typed so `minItems: 0` "succeeded with nothing" (reports/t194-d227-zero-rows.md). The node cannot tell "this is
  the list I was built on" from "a list". Proposal: the read checks the page against the build's start-location
  identity and the list's label (see fix 16).
- `list_never_appeared` (~11 s) on bigbox pickup-order, cause "NO EVIDENCE" (D/run-muo1ch23-3de731fb.md:92,
  run-muo1ni63:41, run-muo1rxmv:86); reads taking ~12 s with "No fix found" (D/run-muo0zggr-442f9107.md:101,
  causes-early.md:86). Open.
- Model-written `where` drops wanted rows (charging-case rule D/run-munw7ffn-fe1cecd2.md:452, run-muqk713g:366; a
  regex drops Jonas D/run-mux6nxst-c9bca37c.md:30) -- "every C run", "every D run" (week-review/report.md:101).
  Model judgement; the alone-rows account already reaches the judge.
- Two extract nodes writing one dataset (D/run-munw7ffn:453, run-munv53gt:222) -- addressed by S1 per-step datasets.
- "No way to a read after the act" (D/run-mux6nxst:135, D3-2), open (week-review/report.md:164).

**next_page**: no live incident yet; the node landed after round 4. Its first live round will meet N1-N3 on any
client-rendered pager.

**assert**
- Row-scoped check read the template card (D/run-musp474o-e0ed7432.md:117,161), fixed t195-w40, verified live
  (D/run-muw6144a-e56f945d.md:117).
- Assert queried the light DOM for a control in a shadow root (reports/t195-w24a-verify-hidden.md:9), fixed with
  `shadowHosts`. The page-scoped `text` claim still has the same blindness (A3).

**wait_for_selector / wait_for_text**
- wait_for_text "null" passed (W5 above). `dom-wait_for_selector` refused `target_not_a_handle`
  (D/run-muo0qepn-c0aa6dd0.md:32), cause not stated.

**capture_snapshot**: the free first look refused `not_at_start_location` in nearly every run, "by design"
(D/run-munmmj5n-52d8a67d.md:59, run-muog33va:67).

**detect_repeating_structure**
- `handle_not_in_packet` (D/run-muntfume:58, run-muntu7in:51, run-muog33va:82); caps since removed.
- `handle_no_longer_on_page` twice, 5.3 s (D/run-munore4o-c84cfa29.md:71,105), cause not stated -- consistent with
  G18 (class-path binding).
- Repeated detects answered `already_answered` (D/run-munnq7vz:125, run-musp39u8:582 "minor, open").
- Field identity from hashed classes (D/run-muqilf9s:362 C2, run-mux6nxst:136 D3-3), t279 "ready, not merged".
- "See all" partial list: fixed `30f65794`, but the Flow-check side "Not fixed" (D/run-muq5v4zg-39182b58.md:287).

**find_on_page**
- Used as site search: 12 decisions, a third of the spend (D/run-muqc07fh-eeffbc86.md:17,30); "45 of 53 calls"
  (D/run-muq70foz-74caa189.md:62); repeat guard "partly" fixed. Bigbox product names "eleven times. None was on the
  page" (D/run-muq3ubys-4b4dbf5b.md:38).
- Matches carry no href, so `address_not_shown` refused the right URL (D/run-muq5v4zg-39182b58.md:290, "Not fixed";
  reports/t195-w24c-run37.md:62). Open.

**Script/JS used where a reading node would serve**: none found; no script or request tool exists yet
(structural-agent-plan.md:18). One reverse case: the model read results with extract_list "which cannot open an
item" (D/run-muohbi3e-e5847e5a.md:89-90) -- the read_details proposal below.

---

## 5. Ranked fixes and extensions (existing nodes)

Ranked by (harm in live runs or silent wrong answers) x (tasks affected) / cost. Each names the tests that would
prove it; all are unit or content-harness tests beside the changed file.

1. **next_page: detect a change by content, not only by node identity (N1).** `listChanged` also compares a digest
   of the first and last items' text (and `location.href`) taken before the press.
   Tests: move-page.test.ts "a list re-rendered in place (same nodes, new text) moves"; "same text and same nodes
   after the press is still list_unchanged".
2. **next_page: when no way is given, try every way (N2).** Order: Next / following page, numbered page, Load more
   (a control under the list whose words are a "more" phrase), then a scroll only when the page declares a feed
   (`isDeclaredFeed`) or the list grew on the read's reveal. Answer `by` with the way used; answer
   `control_absent` only when all are absent.
   Tests: move-page.test.ts "no pagination named, a Load more under the list is pressed (by loadMore)"; "no
   pagination, a declared feed scrolls (by scroll)"; "nothing at all ends control_absent".
3. **One disabled rule, ancestors and classes included (N3, A4).** A shared `isEffectivelyDisabled` in
   action-runtime: own `:disabled`/`aria-disabled`, an ancestor up to the pager item with `aria-disabled="true"`
   or a `disabled` class token, `pointer-events: none`, and an `href` of `#`/`javascript:` on a pager item marked
   disabled. Used by pager-reading, wait-conditions `enabled`, assertion-evaluation `enabled`.
   Tests: pager-reading test "li.disabled > a ends control_disabled"; waits.spec "enabled waits for an ancestor's
   aria-disabled to clear"; assert test "enabled fails under aria-disabled ancestor".
4. **assert `text` requires expected text (A1).** The gateway refuses `kind: "text"` without a non-empty
   `expected` (and the evaluator returns `malformed` as `url` does).
   Tests: gateway-action-parameters test "text claim without expected is refused"; assertion-evaluation test
   "text with empty expected is malformed, not held".
5. **Judge every match, not the first (A2/W1).** `visible`, `enabled` and selector-scoped `text` hold when any
   match satisfies them; the outcome reports `n matched, k visible`.
   Tests: waits.spec and check-assert.spec fixtures with a hidden duplicate first.
6. **Normalised, case-insensitive, shadow-aware page text (A3, W3, G9).** One `pageReadableText()` built on
   `composedRenderedText` plus same-origin frames, whitespace-collapsed, compared case-insensitively; an optional
   `exact: true` keeps today's behaviour.
   Tests: waits.spec "text split across two cells holds"; "different case holds"; shadow-roots spec "page text
   inside an open root holds"; assertion-evaluation equivalents.
7. **Empty pages in a loop are not failures (R4).** For a Flow read with `answer: "kept"` reached as a loop pass
   after the first, an empty list counts as an ended page; or simpler: the domain sends `minItems: 0` on every
   pass after a Next page answer, and keeps 1 on the first read so a wrong selector still fails.
   Alternative to decide with the supervisor: next_page answers `ended` when the page it reached shows no item
   (`list_vanished` today, arrival.ts:60).
   Tests: extract-list-kept-answer.test "a kept read of a page showing no item with minItems 0 succeeds with []";
   move-page.test "a landing with zero items and a 'no results' text ends instead of list_vanished".
8. **next_page presses like a person (G1).** Reuse the click verb's gesture (scroll into view, pointer and mouse
   sequence, covered check with closeWith) instead of `control.click()`; keep the cancelled-click detection.
   Tests: move-page.test "a pager listening to pointerdown moves"; "a covered Next answers control_not_clickable
   with the covering layer".
9. **Repeat detection across passes (G3).** next_page answers `moved` with a short content digest of the page it
   reached; the worker's continuation store (or Core's pass record) keeps the previous pass's digest per node, and
   a digest equal to one already seen answers `ended page_repeated`.
   Tests: move-page.test "a Next that leads back to page 1 ends page_repeated on the second visit".
10. **Waits and asserts fall back to identity (G5).** When the recorded selector matches nothing, resolve the
    element by its recorded fingerprint as `resolveTarget` does, and report `resolution`.
    Tests: identity e2e "a wait on a drifted class selector is satisfied by fingerprint".
11. **`hidden` condition (G6).** wait and assert gain `hidden` (absent or not rendered).
    Tests: waits.spec "hidden holds when the spinner gets display:none".
12. **Timeout reports say what was seen (G8).** `actual` names match count and the first match's state
    (not rendered, enclosed, covered-by, disabled).
    Tests: waits.spec timeouts assert the new `actual`.
13. **Stale model text (D1, D2) and empty-text waits (W5).** tools.ts:392 drops "paginationBound" and qualifies
    the rejected-rows sentence; schemas.ts:327 says one page; the gateway refuses a wait_for_text whose text is
    empty, and plan resolution refuses "null"/"undefined" literals in text slots.
    Tests: tools description test; gateway-action-parameters test "wait_for_text with empty text is refused".
14. **Loop stops at the limit (G4).** The repeat's `most` is derived from `limit` when the read declares one and
    the page size is known (Core-side), or next_page answers `ended item_limit` when the run's collection already
    holds `limit` rows (needs the collection count on the command).
    Tests: Core build-test walker test with limit 20 and 10 rows a page: 2 passes.
15. **Shadow-root lists (G2).** Item queries go through the shadow scope resolver the waits use
    (`resolveShadowScope`) when the detection recorded a host chain.
    Tests: fake-shadow-dom fixture "a results grid inside an open root is detected, read and paged".
16. **A read knows it is on the wrong page (live class above).** The read carries the list's label and the
    detection's field keys; a page whose best run has none of those keys, or that is a robot check or a "no
    results" page, fails `wrong_list` (or answers an empty page explicitly) instead of reading whatever list is
    there. Tests: list-reader test "a page with a different list fails wrong_list"; "a no-results page answers
    empty with a no_results note".
17. **Detection across frames and roots (G15, G16, G17).** Page-wide detection asks each same-origin frame and
    open root and answers the best run with its frame; the wire carries `shadowHosts` beside `selector`; collapsed
    runs are offered with a `closed` mark. Tests: detect.test frame fake; e2e frames + shadow fixture.
18. **find_on_page matches carry the link address (live, open).** A matching link's line prints its `~` address
    as the page view does, so the address can be used. Test: search.test "a link match shows its address".

## 6. New nodes proposed for this family

| Node | Contract | Why | Tests |
|---|---|---|---|
| **read_value** (replaces extract for model Flows) | `{target: "tN", read?: text\|value\|attribute:<name>\|number\|date, as: "<column>"}`; writes one row to the read step's dataset (recordOutput like extract_list's one-record mode) and to `outputs.value` | single answers ("the order total", "the confirmation number") are datasets the judge can see; today the model must detect a "list" of one | dispatch test: derived one-column recordOutput; content test: number parsing "$1,299.00" -> 1299 |
| **read_table** | `{handle: "extraction.N" \| target: "tN", columns?: {key: "<header>"}, where?}` reading `<table>`/ARIA grid by header names, with row and column spans | tables are the most common structured answer on the realistic sites (orders, invoices, comparisons); `column:<header>` exists in the literal grammar only | extract-list-table.spec extended: colspan header, ARIA grid |
| **verify_page** (multi-claim assert) | `{claims: [{kind, target?, expected?}], mode: all\|any, timeoutMs}` with kinds exists, absent, hidden, visible, enabled, checked, selected, text, textAbsent, url, title, count (`{atLeast, atMost}`), value | one node per outcome check; the same list Core's `expectedState` already evaluates; adds the kinds a confirmation check needs | assertion-evaluation per kind; gateway reader refuses empty claims |
| **wait_until** (merges both waits) | `{for: element\|text\|url\|stable\|network_idle, target?, text?, state?: present\|visible\|enabled\|hidden\|absent, timeoutMs}` | one wait the model can be taught in a sentence; identity-aware, shadow-aware, case-insensitive text | waits.spec reused against the merged verb |
| **count_items** | `{handle: "extraction.N", where?}` -> `outputs.count`, route `none` when 0 | branch on "are there any results?" without reading rows; lets a Flow end cleanly on an empty search (R4) | content test: count with where; route none |
| **read_page_text** | `{target?: "tN", contains?: string}` -> `outputs.text` (bounded, sensitive-filtered) | an answer that is prose (a status message, an error banner, "your request was sent") for the judge, without a list | sensitive filtering test; bound test |
| **read_details** (row drill-down helper) | `{list: "extraction.N", link: "<column>", fields}`: for each row, open its link, read one record, come back | the list-then-detail pattern the design names ("a list and then each row's detail"); today it needs For Each + navigate + one-record read + back | Core loop walker test with fake natives; e2e on a fixture with detail pages |

## 7. Not verified

- Nothing was run. Every bug is from reading code; none was reproduced in a test or browser. N1 (in-place
  re-render) and N3 (Bootstrap disabled Next) are inferred from `listChanged` and `isDisabled`, not observed live;
  no realistic scenario site was checked for either pattern.
- W5's cause (why a "null" wait held in 187 ms) was not traced; the bundle withholds parameters.
- Whether `innerText` of `document.body` includes open-shadow-root text in Chrome was not tested; A3 rests on the
  repository's own finding (composed-rendered-text.ts:5-10) and the bigbox shadow-root incidents.
- Whether a later node can bind `web.dom.extract`'s `outputs.result.extracted` through a state binding was not
  traced in Core; G12 says only that no dataset or judge receives it (supported by reports/t195-w19e-audit-moon-jar.md:14).
- Live-failure citations come from the Explore sweep; I re-read only the W5 debug lines. Line numbers in the debug
  citations are the sweep's.
- Explore-reported test counts (detect.test.ts 15, search.test.ts 8, etc.) were not recounted.
- The Core loop (repeat `while`/`most`) and S1 processing were taken as landed per the plan's Current State; their
  behaviour with next_page's `ended` route was not traced in Core.

# Debug: run-mvgf7ij5-a9747575

Status: FAILED (no Flow). Read-only review under brief debug-rr2-social, 2026-10-20. No source edit, build, paid run, browser run or commit.

## The run

- Task `social-network-feed-recent-group-posts`, rerun round 2, slot 3, lane tree `C:/Users/osrs_/FluxStuff/fxwork/t566`.
- Source: downstream ddf41bf4, Core ca23a8ba (current dev). It includes t725 (`f36181c0`, the scroll `maxScrolls` contract), L1 (`07d2e291`), lane S (`c74e11a9`, `9fedacc4`) and lane T (`8a4143a1`).
- DeepSeek flash (`deepseek-flash`), $0.25 ceiling. It spent $0.1807 over 153 step folders: builder brief-1 $0.113, builder brief-2 $0.057, supervisor $0.010. The run took 18 minutes (08:27:46 to 08:45:48), so the time limit played no part.
- Evidence: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgf7ij5-a9747575/steps/` (index.md and step folders), plus `summary.json`. The Lab log (`scratchpad/rerun2/slot-3.log`) shows no environment fault: no balance error, crash or timeout. Its only warning is the Firefox placeholder gecko id.

## What ended it

The supervisor dispatched one subflow, `collect_group_posts`, twice. Neither builder produced a revision that worked.

- **Brief-1 (steps 0009-0111)** got one revision accepted (0063). That revision optionally dismissed the overlays, scrolled to the end-of-feed marker by handle, then ran one filtered read. Its trial (0065) failed at the scroll step with `web.target.not_found` after 4 attempts. The infinite feed had not loaded the marker yet, so the read was never reached. The builder then spent 22 decisions (0068-0110) guessing the scroll request's shape. It tried `scroll: {until: "stopsGrowing" | "stops_growing" | "page_stops_growing" | "stable"}`, with and without a target. Every attempt was answered with a bare `invalid_input` / `parameter_not_readable` or `repeat_refused`, and the brief ended partial.
- **Brief-2 (steps 0114-0152)** never got a revision accepted. Its full submit was refused twice as `evidence_completion_plan_invalid`. It then sent the same script three more times, which `repeat_refused` answered each time. That ended the brief.
- **0153:** the supervisor completed `ended: blocked`. The draft it kept is brief-1's revision 1.

## The completion plan and why it was invalid

Both refusals come from Core `flow-bootstrap/authoring/draft-routing.ts` `scriptSpan()`. The refusal is passed on through `authoringError(... span.refusal.path ?? \`flow.line.${repeat.line}\`)` (line 272).

**Submit 1 (0143 → 0144, `:3e95ca03`).** The script had this structure (handles and page words left out):

```
step: open the home feed                  web.browser.navigate
step feed: read the posts in the feed     web.dom.extract_list  (extractList, fields, recordOutput.process where/dedupe)
step: expand the post's full text         web.dom.click target tN   repeat over: feed   repeat through: expanded
step expanded: wait for the post's full text  web.dom.wait_for_text  text: $row.text
step: go to the next page of the feed     web.dom.next_page   repeat while: feed   repeat most: 20
done when: text tN contains "<marker>"
```

- Rule: line 333, `flow_script.repeat_span_unknown`. `repeat while: feed` on the next-page step names a span end that comes before the step.
- The feedback named the problem exactly, and the model fixed it.

**Submit 2 (0145 → 0146, `:fd7aec14`).** The only change: `repeat while: next` moved onto the read, and the next-page step was labelled `next`.

```
step feed: read ...           repeat while: next        <- outer span: feed .. next
step: expand ...              repeat over: feed  repeat through: expanded   <- a second repeat inside it
step expanded: wait ...
step next: go to the next page
```

- Rule: line 338, `flow_script.repeat_body_is_routed`. A member of a span carries its own `repeat`, so the script is a row loop inside a page loop. Core does not support that.
- The message: "The step at line 19 says repeat inside the span that starts at line 5. A repeat inside a repeat is not supported: say repeat once, on the first step of the span."
- `refusal.path` is unset, so the issue's path is the **outer** head's repeat line: `flow.line.18`, step "read the posts in the feed".
- The `next` text therefore says "The refused step is line 18, 'read the posts in the feed' (feed): correct that step".

**Submits 3-5 (0147, 0149, 0151).** Each decision's script is byte-identical to submit 2 (same md5). Yet each summary claims a fix: "one repeat on the read through Next page, and the full-text expansion done inside that same span". The model believed it had already obeyed the refusal.

## Did the feedback name what to change? No. Four signals contradicted each other.

1. **The detection's `nextPageNote`** (0143 request, `pagination: infinite_scroll`) said: "for every page, add Next page ... after the read, then repeat the read through Next page while it succeeds".
2. **The downstream `incomplete_text` hint**, given when brief-2's first read was refused at 0118, said: "Use those records in For Each with an optional explicit registered row-bound click on each row's own disclosure, then read full text ... **Repeat this ordering after each Next page move.**" Doing a per-row click after each Next page *is* a row loop inside a page loop, which Core's script grammar refuses.
   - Source: `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts` `webLlmRejectionNext()`, the `incomplete_text` branch, added in `ec9b8593` (2026-10-17).
3. **The refusal** pointed at the outer repeat on the read: line 18, the very line that signals 1 and 2 had told the model to write. It never mentioned the inner `repeat over: feed` (line 23). Its only advice, "say repeat once, on the first step of the span", is what the model thought it was already doing.
4. **The repeat guard** (0148/0150) repeated those same issues and offered `ended: blocked`. The model took neither path.

Core already has the right words for this shape. `NO_ROW_LOOP_IN_PAGE_LOOP` (draft-routing.ts line 97) says to read every page in one `repeat while` span with `extractList.where`, and to act on rows of one listing with `repeat over:`. But it is attached only to the `repeat_not_after_its_source` refusal (line 368), not to `repeat_body_is_routed` (line 338).

The model had no consistent move. It is a flash model with no reasoning output, so it re-sent the script it believed was correct.

## Did L1, lane S or lane T change this path?

No. Core `git log` on `draft-routing.ts` shows the line-338 message unchanged since `8d85a542` (2026-10-07). `NO_ROW_LOOP_IN_PAGE_LOOP` dates from `e0b55d43` (2026-10-14). `9b6b5b1b` (10-19, `repeat most` beside `repeat over`) did not touch the nested-repeat refusal. None of these touch the completion-plan validator or its feedback:

- L1 (`07d2e291`) is site-reset settlement. No trial reached a reset here.
- Lane S (`c74e11a9`, `9fedacc4`) covers prompt rules, wording and the chat fold.
- Lane T (`8a4143a1`) routes runners through the run environment.

## An honest structure existed and was reachable

- The qualification workflow (`apps/scenario-lab/src/scenarios/social-network-feed/qualification/recent-group-posts/workflow.ts`) is flat: scroll the feed down to the marker, click See more on the cut-short posts, then read.
- The previous attempt (`run-mvfq957o-40103539`, rev 9 at 0081) reached the exact oracle answer with the same shape:
  - scroll `{"mode":"untilStable","maxScrolls":40}`;
  - an intermediate read labelled `posts`;
  - an optional per-row click with `repeat over: posts`;
  - a final read.
- So the task, its wording and the oracle are achievable and are not the cause.

This run reached neither half of that shape:

- **Brief-1 never found the scroll request's form.** Its described definition (0068 request) prints the parameter as bare `id: scroll, type: object`, with no description, keys or example. The node text only says "until the page stops growing".
  - Source: `domain/src/output-nodes/definitions.ts` line 339, `structured("scroll", "Scroll Mode")`, which has no `description` or `example`.
  - The run-time refusal carried only `{"reason": "parameter_not_readable"}`. t725 made the extension's *sentence* name the key, but `domain/src/runtime/llm-evidence/action-failure/refusal.ts` `webActionFailureRefusal()` deliberately drops that sentence, mapping `INVALID_PARAMETER` → `parameter_not_readable`, and adds no key list. `webAutomationScrollRequestIssues()` exists and could name `mode` missing / `until` unknown, but it is not used on this path.
  - So at `core.run_node` the model never learned `mode` / `untilStable` / `maxScrolls`.
- **Brief-2 never tried a scroll.** It followed the two notes into the nested loop.

## How far it got

- No trial ever reached the read; brief-1's one trial stopped at step 9 of 9, the scroll.
- The run collected no dataset rows in any trial.
- Brief-2's exploration read the feed and saw the cut-short text (`incomplete_text`), but its subflow was never accepted.
- Of the honest path, it reached: open the feed, dismiss the overlays, detect the list and the disclosure control. It did not reach: load all rows, expand, filtered read.

## First divergent step

- **0143**, the first full submit of brief-2: a per-row click span placed inside a next-page span. It followed the `incomplete_text` hint (0118 feedback) and the `nextPageNote`.
- Brief-1's first divergence is **0068**: an unreadable scroll request, after a describe that showed no shape for `scroll`.

## Cause class

**Product defect**, in two places that compound. It is neither an environment problem nor a task problem.

- **Primary (brief-2):** the guidance contradicts the script grammar.
  - The downstream `incomplete_text` hint prescribes a per-row disclosure loop "after each Next page move".
  - Core refuses that nesting, and its refusal points at the outer repeat without the row-in-page-loop alternative it already has.
- **Secondary (brief-1):** the scroll parameter's shape is never shown in the node description or in the run-time refusal at `core.run_node`.

The repeated identical submits are a model mistake, but they follow from that contradiction. The repeat guard worked as designed.

## Proposed fixes (least general first)

1. **Downstream, the hint.** `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`, the `incomplete_text` sentence: replace "Repeat this ordering after each Next page move." with generic words that fit the grammar.
   - Suggested wording: "A repeat cannot hold another repeat, so do this on one listing: where the list loads more rows in place as it scrolls, load every row first (a Scroll untilStable step, or Next page in its own repeat while span), then the row-context read, the per-row disclosure with repeat over that read, and the full read."
   - Test seam: `domain/src/runtime/llm-evidence/rejection-next/tests/next-sentence.test.ts`. Assert the sentence names no nesting ("after each Next page") and names loading the rows before the row loop.
2. **Core, the refusal.** `flow-bootstrap/authoring/draft-routing.ts` `scriptSpan()` line 338 (`flow_script.repeat_body_is_routed`):
   - When the inner member's repeat is `over` (a row loop), append `NO_ROW_LOOP_IN_PAGE_LOOP`. Add one generic clause for an in-place-growing list: load it whole before the listing step.
   - Set the issue `path` to the inner member's repeat line (`flow.line.${input.written[member].repeat.line}`), so the `next` sentence names the step that cannot be, not the head.
   - Test seam: `flow-bootstrap/candidate/tests/refusal-locator-corpus.test.ts`, case "a repeat inside a repeat" (line 123), and `flow-bootstrap/authoring/tests/candidate-loops.test.ts`. Assert the path is the inner repeat line and the message carries the row-in-page-loop words. Use a non-realistic fake site, as the corpus already does.
3. **Downstream, the scroll description.** `domain/src/output-nodes/definitions.ts` line 339: give `scroll` a `description` and an `example`, for instance `{"mode": "untilStable", "maxScrolls": 20}`, naming the three modes and that `untilStable` needs `maxScrolls`. Core then shows them with the node (catalog text shows each object parameter's description and example, per `next-page/catalog-text.ts`).
   - Test seam: `domain/src/output-nodes/tests/`. Assert the scroll definition's `scroll` parameter has a description and example that `webAutomationScrollRequestIssues()` reads as valid.
4. **Downstream, the run-time refusal.** In `domain/src/runtime/llm-evidence/action-failure/refusal.ts`, for an `INVALID_PARAMETER` scroll, add the closed key list from `webAutomationScrollRequestIssues()` (`missing: ["mode"]`, an unknown key named), computed from the request the domain sent, never from the extension's sentence.
   - Test seam: `action-failure/tests/refusal.test.ts`.

None of these fixes mirrors the task or this site, and none weakens the oracle.

## Not verified

- Whether a flat `scroll untilStable` → read → `repeat over` click → read would pass on this lane's tree (no run). The previous attempt's rev 9 suggests it would.
- Whether `web.dom.next_page` on this infinite feed answers `ended` at the marker. It was never trialled.
- Exactly how Core renders a domain parameter's `description`/`example` into `describedNodes` for an object parameter. Fix 3 relies on the next-page catalog-text header saying it does.
- Whether brief-2's non-optional per-row click would have failed on rows without a disclosure. The script never reached a trial.
- Why the supervisor's budget note showed only 7 decisions left at brief-2 iteration 17. It did not affect the outcome.

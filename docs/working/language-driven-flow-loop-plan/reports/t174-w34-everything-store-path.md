# t174-w34: `everything-store-kettle-to-cart`, path audit

Worker t174-w34, 2026-10-01. Read-only audit of tree `fxwork/t174` (downstream and Core on
`task/t174-live-lane`, downstream `a15a465e` plus the uncommitted w31 work in `runtime/`, which the content
bundle does not include). No Lab, no provider. Every product claim below is either a probe line (T2 content
harness, `apps/extension/e2e/content/tests/lane-a-probes/t174-w34.spec.ts`, quoted as `[w34] ...`) or a
file:line read; which is which is said.

## Outcome

Done. The honest path is performable today through the content script's own verbs, end to end up to the cart
(probe row 5 passed: the cart ended `B0D7KXS4G7x2` on top, session not flagged), and the cart half works
when driven through the real domain evidence runtime: the right row's Save for later is pressed, the site's
"Try again" is shown in the next look 4 s later, and pressing it saves the phone case (probe row 1).

Four unowned defects were proven provider-free (each row of the probe fails on today's code for it):

1. **Cause #14, replay half: a cart row's control carries no row identity**, so a replayed or re-run press
   lands on whatever row now sits at that position. Probe rows 1 and 4: the replayed phone-case press saved
   the batteries (`saved L1`), which is run 21's dry run 3 exactly. Two halves: the content record rule does
   not recognise the store's rows (`div[data-line][data-sku]`), and the domain never carries a *keyed* record
   into a created press even when the content reports one.
2. **Cause #15: the cart read in the instruction's own column names is refused
   `column_not_in_detected_list`** (`{item, quantity, price}` and `["item","quantity","price"]`), because the
   detected keys and labels are CSS paths with hashed classes and Core's name matcher finds no candidate.
3. **The support chat that opens itself over the buy box is not cleared by the interference defence**:
   "Minimize chat" is not a dismissal word, so the quantity select and Add to Cart are each refused
   `web.action.blocked_by_dialog` after 4 absorbed attempts.
4. **A press made before the product page hydrates is reported `succeeded` although nothing happened**: F20
   presses once more inside the 800 ms window, the store hydrates at 1,200 ms, and the second ignored press is
   not watched.

The "Save for later on the wrong row" seen in run 30 is consistent with defect 1 (a rerun of an older step's
positional selector); the model's own handle choice is not in that run's evidence (G1). The "could not save
... Try again never recovered" half is recoverable on today's code; what is still missing there is owned by
t223 (the press does not wait out the row's busy indicator, and a re-press of the covered control is refused
`handle_not_in_packet` with nothing about the layer).

## What changed and why

Only the probe spec was added: `apps/extension/e2e/content/tests/lane-a-probes/t174-w34.spec.ts` (5 rows). It
drives the real content-script bundle on the Scenario Lab store and, for rows 1, 2 and 4, the real domain
evidence runtime (`createWebAutomationLlmEvidenceRuntime`) with scripted decisions, as
`extraction/tests/item-conditions.spec.ts` does. Rows 1-4 assert what a passing Flow needs and fail today;
row 5 passes. No product file was touched.

## 1. The reference path

From `live-tasks.ts:49-55` (judged `expected-dataset`, `extract-cart`), the honest-path test
(`tests/honest-paths.test.ts:105-128`), the recording (`workflows/add-to-cart.ts:66-94`) and the route
(`route.ts`). Expected records: Sage Green 1.7 L kettle, `2`, `$44.99`; AA batteries, `1`, `$17.49`.

| # | Page | Control or input | Expected effect |
| --- | --- | --- | --- |
| 1 | any, then store home `/scenarios/everything-store/` | navigate | home; cart badge 2 (phone case L2 above batteries L1, seeded `state/create.ts:17-20`) |
| 2 | home | "Never miss a deal" dialog, 4 s after load, page behind it inert (`client/shell-script.ts` `openNotifications`) -> "Not now" | prompt gone, page live |
| 3 | home | cookie banner -> "Accept" or "Decline" | banner gone |
| 4 | home | search box `input[name=k]` ("Search Brightaisle"), not the off-screen honeypot `field-keywords` before it (`pages/header.ts:34-35`) <- a short query, e.g. "tidewell kettle" | text typed. Every query word must be a title word (`catalog/search.ts:43-46`): "...sage green 1.7 litre" finds nothing |
| 5 | home | Go (`nav-search-submit`) | `GET /s?...`; the session's first search is served the soft check at that address (`route.ts:59`) |
| 6 | soft check | "Continue shopping" (disabled "Checking your browser..." for 1.5 s; passes itself at 8 s) | reload onto the results |
| 7 | results | the Tidewell family's organic card title (`[data-sku=B0D7KX2M4P]:not([data-ad-id]) h2 a`), not the TIDEWEL look-alike ad nor the Renewed one | Brushed Steel 1.7 L page |
| 8 | product | "Brightaisle Assistant" chat opens itself at 5 s over the buy box (shadow root) -> "Minimize chat" | chat minimised (state persists across pages) |
| 9 | product | swatch `div[title="Click to select Sage Green"]` (live only after `productHydrate` 1.2 s) | navigates to `/dp/B0D7KXS4G7`, Sage Green 1.7 L, sold by Brightaisle |
| 10 | product | (recording only) app banner Close at 2 s, the sign the page is live | banner gone |
| 11 | product | Quantity select = 2 | value 2 |
| 12 | product | buy box "Add to Cart" (not Other sellers, not "Add all three", protection unticked) | 400 ms spinner, `add-to-cart` x2, "Added to cart" side sheet |
| 13 | side sheet | "Go to Cart" | cart: kettle x2 (L3), phone case (L2), batteries (L1) |
| 14 | cart | phone case row's "Save for later" (`span[data-action]`, tabindex 0, no role) | the session's first save fails by design (`state/cart-ops.ts:65`): a spinner layer covers the row (`client/cart-script.ts:30-44`) |
| 15 | cart | after 4 s the layer reads "Something went wrong. We could not save this item. Try again" -> "Try again" | phone case to Saved for later (3 items) |
| 16 | cart | read Active Items: item, quantity, price of one | the two expected records |

## 2. The product path, step by step

Verdicts: works / defect / owned elsewhere / unknown. "Probe" means observed in this audit's T2 run;
"read" means code reading only.

| # | Product path (file:line) | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | `apps/extension/src/runtime/action-runner.ts` navigate; served status F14 (`runtime/served-status.ts`) | works (read) | Not probeable in T2 (background). Core's first look is refused `not_at_start_location` by design in every debug. |
| 2 | content click `content/actions/click.ts`; defence presses "Not now" when a press is blocked (`interference/vocabulary.ts:71` lists `not now`) | works | Probe row 5: `[w34] path not-now: succeeded`. |
| 3 | consent decline is a way out (`interference/vocabulary.ts`, 2026-09-30) | works | Probe row 5: `[w34] path decline-cookies: succeeded`. |
| 4 | `web.dom.type`; whether the model is shown the search box and not the honeypot is page serialization | works (verb); shown: owned elsewhere (t223) | Probe row 5: `the field holds "tidewell kettle"`, `honeypot left empty`, `path flagged: null`. Query choice is the model's; F10 (`content/evidence/lead-statements.ts`) marks "No results for" (on dev). |
| 5 | click on the submit button; landing judged by `runtime/click-landing.ts` (w31 editing) | works (verb); landing unknown | Probe row 5 reached the results (the URL shows `k=tidewell+kettle`). The landing judgement is background-only, not exercised. |
| 6 | soft check read `self_clearing` (`content/action-runtime/challenge-evidence.ts:42-46,82`), waited out, never pressed by the defence | works; robot checks owned by t197 | Probe row 5 pressed "Continue shopping" once enabled and reached results. A press while disabled would be refused `disabled` (honest). |
| 7 | link click: `navigation ... was initiated` (`content/actions/click.ts`); telling the family card from the TIDEWEL ad is the packet's | works (verb); shown: owned elsewhere (t223) | Probe row 5: `path family-card: succeeded, navigation to .../dp/B0D7KX2M4P was initiated`. |
| 8 | covered-target refusal names the layer (`interference/covering-layer.ts`); defence clears only dismissal labels (`interference/clear.ts`, `vocabulary.ts:71`) | **defect** (Fixable here, F3) | Probe row 3: with the chat open, `quantity 2: failed web.action.blocked_by_dialog ... controls are "Minimize chat", "Send"` and Add to Cart `did not recover within its 4 attempts after absorbing blocking_dialog x4`; `chat state after: open`. The refusal is honest and names the way out, so a build can recover by pressing it; a Flow whose minimize step runs before the chat opens cannot. |
| 9 | click on a `div` with a handler (gesture lands on its `img`), then navigation | works | Probe row 5: `sage-swatch: the point 644,361 landed on img, inside the target`; the cart later held `B0D7KXS4G7`. Swatches have no role or focus; whether they are shown is t223's. |
| 10 | not needed by the product (a recording-only wait) | n/a | - |
| 11 | `web.dom.select` | works when uncovered | Probe row 5: `selected value "2"`. Covered by the chat: F3. |
| 12 | click; ignored-press F20 (`content/actions/click.ts:116,152,221`, `action-runtime/ignored-press/press-again.ts`) | works after hydration; **defect** before it (Fixable here, F4) | Probe row 5: `add: succeeded`, sheet open, cart `B0D7KXS4G7x2`. Probe row 3, pressed at load: `succeeded ... the page ignored the first press, so it was pressed once more`, cart unchanged (`["B0RDGAU8PMx1","B0BAAA48CTx1"]`). |
| 13 | link click in the sheet | works | Probe row 5: `go-to-cart: navigation to .../cart was initiated`. |
| 14 | domain handle -> selector + identity (`domain/.../plan-resolution/target-packets.ts:146-152`, `element-identity.ts:95,109`); content resolve + record gate (`content/action-runtime/resolve-target.ts`, `content/identity/veto.ts:229,251`, `content/identity/record.ts:125,134,147-155`) | works in exploration; **defect** on replay or rerun (Fixable here, F1) | Probe row 1: handle `target.83` (second of three, `alike {index:2,total:3}`) -> `store activity after the press: ["save for later failed L2"]` (right row). Dispatched: positional `main > div > div > div > div:nth-of-type(2) > div > div > span:nth-of-type(3)` with identity `{tagName, visibleText, selector}` and **no record**. After the case was saved, the same command replayed: `saved L1` (the batteries). Probe row 4 (rows given a `data-line-id`): content descriptors carry `record {keyAttribute:"data-line-id", key:"L2"}` yet the created press still carries none, and the replay again `saved L1`. |
| 14b | reporting the site's failure: press evidence (domain `capture.ts`/`node-run/run.ts`, t223) | partly owned elsewhere (t223) | Probe row 1: the press answered `web.action.succeeded`, `pageChanged: true`, `loading: {busy:true, indicators:[{kind:"progressbar", label:"Updating"}]}`; no failure text (it appears 4 s later). Pressed again at once: `web.action.rejected.target_unobserved / handle_not_in_packet` (the post-press packet dropped the covered control; `instead` is the generic list, nothing about the row's layer). |
| 15 | look again, press "Try again" (`span[tabindex=0]`, in the row's layer) | works | Probe row 1: after 4.8 s the look shows `Try again` (`target.222`) and the error line; pressing it -> phone case saved, cart `["B0D7KXS4G7","B0BAAA48CT"]`. |
| 16 | detect (`content/extraction/`), column binding (`domain/.../plan-resolution/extraction/columns.ts:243`, `column-match.ts:111,151,222`), refusal mapping (`tool-rejection.ts:516`, t223) | works with detected keys; **defect** with the instruction's names (Fixable here, F2) | Probe row 2: detection `itemCount: 2`; `{item:"item",quantity:"quantity",price:"price"}` and the array form -> `web.action.rejected.target_unobserved / column_not_in_detected_list`; the map to the two detected keys labelled `(number)` and `(currency amount)` -> `web.inspect.succeeded` with the right selectors. The item title's column is labelled `div > a.css-0y6s4m2 > span` (hashed class): nothing names it as the item. The fixture's own read gives the expected rows (`extraction/tests/everything-store-cart.spec.ts`). |
| Core | instructed acts (Core `runtime/flow-bootstrap/instructed-acts/check.ts`, `instruction-choices.ts`) | works (read + Core's reader run) | Core's act reader on the instruction (dist built by w31, run from scratchpad): `a1 add_to` with `a1.quantity` "two" and `a1.colour` "sage green"; `a2 move`; `a3 open` ("give me what is in my cart..."). "1.7 litre" and "sold by Brightaisle itself" are not read as choices. The reference path answers each: Add to Cart (a1), quantity select (a1.quantity, input "2"), swatch click (a1.colour, own step), Save for later or Try again (a2), Go to Cart (a3). The check itself was not run. |

### The debugs' causes against current code

| Debug, cause | Today | Evidence |
| --- | --- | --- |
| run 27 #1, run 21 #1: query with every attribute finds nothing; "No results" not in evidence | fixed (F10) for the evidence; the store's all-words match is the site's honest behaviour | `content/evidence/lead-statements.ts`; runs 30/33 retyped a short query after F10. |
| run 21 #2: reads on the no-results page report success | owned elsewhere (t194 extraction / t223 evidence); not probed | - |
| run 21 #3, #6: a press that changes nothing reported `succeeded`; failed first save not retried | changed: the domain refuses `no_progress` when the page did not change (`domain/.../press.ts:47,83`); the save press is truthful (`pageChanged`, `loading.busy`); recovery via "Try again" works (probe row 1). Remaining gaps: F4 (double-ignored press), and t223's post-press settle | probe rows 1, 3 |
| run 21 #4, run 30 #6, run 33 #3: dry runs replay real acts and the reset keeps site state; replay saved the batteries | replays: owned by t196. The wrong row on replay is F1 (unowned), reproduced provider-free | probe rows 1, 4: `saved L1` |
| run 21 #5, #7, #8; run 30 #5, #8; run 33 #4, #6: dry runs on refused completions, amendment churn, no-progress guard, transcript draft, call bound | owned by t196 (F18 on dev caps repeats) | - |
| run 21 #9, #10; G1/G2 instrumentation | fixed (t195 F13, F9, F12 decision dump) | lane report |
| run 21 #11: a cart read takes ~12 s | not reproduced | probe row 2: detect plus three reads in 5.0 s total |
| run 30 #1, run 33 #2 (cause #14): Save for later on the wrong row; "could not save ... Try again" never recovered | wrong row: F1 (positional selector, no record); unrecovered: the way through works today, the missing waits and refusal wording are t223's (row 14b) | probe rows 1, 4 |
| run 30 #2: quantity never set | fixed (P1 B; Core reader gives `a1.quantity`) | Core reader output above |
| run 30 #3 (cause #15): `column_not_in_detected_list` | still present: F2 | probe row 2 |
| run 30 #4, run 33 #5, run 27 #4: draft entry cap | owned by t200 | - |
| run 30 #7, run 33 #7: `handle_not_in_packet` on the search-box re-entry | F13 on dev (shown handles kept); the covered-control variant is t223's (row 14b) | probe row 1 |
| run 30 `target_covered` at 56 with the chat open over the cart | consistent with F3 (the chat persists across pages); what covered it is not in that run's evidence | probe row 3 |
| run 33 #1: the kettle listing never pressed | owned elsewhere (t223, what the packet shows) | - |
| run 27 #5: unusable decisions | Core evidence loop, t196 | - |
| 429 limiter (5 results pages / 8 s; 3 refusals flag the session) | navigate: F14 on dev; click: w31 (Task 1, in progress) | `state/throttle.ts` |
| seeded cart lines moved by dry runs (run 21) | t196 (replays) plus F1 (which row) | probe rows 1, 4 |

## 3. Fixable here

Each is unowned by t223, t196, B1 or t197 as the brief lists them. Each probe row named fails today and is the
failing-first proof; the unit test named is the one to write.

### F1. A cart row's control carries no row identity, so a replay presses another row (cause #14, replay half)

- Cause, two halves, both needed on this store:
  - **Extension.** `apps/extension/src/content/identity/record.ts:125` (`RECORD_SELECTOR`: `tr`, `li`,
    `article` and list/row roles) and `:134` (`RECORD_KEY_ATTRIBUTE`: `data-...-id|key|uid|uuid|guid`) do not
    recognise `<div class=cartRow data-line="L2" data-sku="...">` as a record, so `recordIdentity`
    (`:147-155`) returns nothing, the descriptor has no `context.record` (probe row 1 logs none), the record
    gate (`identity/veto.ts:229,251`) has nothing to check, and the positional selector names whatever row
    is second. The same rule leaves the search result cards (`[data-component][data-sku]`) unkeyed.
  - **Domain.** Even a keyed record never reaches a created press. `plan-resolution/element-identity.ts:109`
    builds `context.record` only from the packet's `within` words; `plan-resolution/target-packets.ts:146-152`
    never reads `binding.records`, where `sanitize.ts:192` keeps the key address. The file comment at
    `element-identity.ts` says the key "lives in the binding's records, which only the call site
    (target-packets.ts) holds", and the call site does not use it. Probe row 4 proves this half alone.
- Files a fix would edit: `apps/extension/src/content/identity/record.ts` (accept the product/line identifier
  attributes, e.g. `data-(...-)?(sku|asin|gtin|ean|upc|isbn)` and a cart line id, or the structural rule "a
  data attribute whose value differs across same-template siblings"; the supervisor chooses);
  `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts` and `element-identity.ts` (carry
  `{keyAttribute, key}`). The key address is built with a private separator in `elements.ts:112,275`, which
  is t223's file: the domain half needs t223 to export a parser or put the structured record on the binding.
- Tests, failing first: `apps/extension/src/content/identity/tests/record.test.ts` (a `div` row carrying
  `data-sku`/`data-line` is a record keyed by it); `domain/src/runtime/llm-evidence/plan-resolution/tests/record-identity.test.ts`
  (a keyed row control's identity carries `{keyAttribute, key}` through to the gateway command);
  probe rows 1 and 4 (`the replay moved no other line`, `the created press carries the row it was made on`).
- Size: extension small (one rule plus tests; the wider rule needs a check across the ten campaign sites);
  domain small to medium, after t223's export.

### F2. The cart read in the instruction's own column names is refused (cause #15)

- Cause: the detection's keys and labels are CSS paths with seeded hashed classes (`div > a.css-0y6s4m2 >
  span`, `p.css-10muxo3 > span (currency amount)`), and Core's matcher at its 0.25 floor
  (`plan-resolution/extraction/column-match.ts:111`) finds no candidate for `item`, `quantity` or `price`, so
  `columns.ts:243` refuses `web.handle.unknown_field`, mapped to `column_not_in_detected_list`. The kind hint
  the detection already writes into a label (`(number)`, `(currency amount)`, and the key suffixes `_number`,
  `_currency_amount`) is not used by the matcher: `columnShape` (`column-match.ts:222`) reads only the spec.
- Files: `domain/src/runtime/llm-evidence/plan-resolution/extraction/column-match.ts` (when no name clears the
  floor, use the column's declared shape: a quantity word to the one number column, a price word to the one
  currency column; the item title has no such hint, so it also needs the detection to name a record's own
  link text as its title, which is `apps/extension/src/content/extraction/` labelling and the nearest owner
  candidate is t194).
- Tests: `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/column-match.test.ts` (with the cart's
  detected fields, `quantity` and `price` resolve to the `(number)` and `(currency amount)` columns as recorded
  assumptions); probe row 2.
- Size: medium (the shape fallback is small; the item-title naming is a detection change).

### F3. "Minimize" is not a way out, so the support chat blocks the buy box

- Cause: `apps/extension/src/content/action-runtime/interference/vocabulary.ts:71` (`DISMISS_LABEL`) has close,
  dismiss, hide, not now, ... but not minimise; the chat's only way out is `aria-label="Minimize chat"` with a
  "—" glyph. The defence absorbs 4 attempts and reports `blocked_by_dialog` (probe row 3). The chat reopens on
  every product page until answered and stays open across pages once open.
- Files: `interference/vocabulary.ts` (add `minimi[sz]e`; the deny-list still applies).
- Tests: `interference/tests/vocabulary.test.ts` ("Minimize chat" is a dismissal; "Minimize and delete" is
  not), `interference/tests/way-out.test.ts`; probe row 3 (`the add reached the store`, once its early-press
  half is separated from F4).
- Size: small.

### F4. A press the page ignored twice is reported `succeeded`

- Cause: F20 presses once more when nothing answered within 800 ms (`content/actions/click.ts:116,152`), but
  the second press is not watched (`:221`, `watchIgnored` is first-press only) and the result is `succeeded`
  with "pressed once more" (`:304`). The store's buy box hydrates at 1,200 ms, so a press in the first ~400 ms
  after load is lost twice and reported done (probe row 3, cart unchanged). In exploration the domain's
  `no_progress` catches it; in playback a step run soon after the swatch's navigation would carry on believing
  the add happened.
- Files: `apps/extension/src/content/actions/click.ts`, `action-runtime/ignored-press/press-again.ts` (watch the
  second press; when it is also unanswered, either wait a bounded time for the page to come alive and press
  once more, or report the press as not taken effect, retryable, as F7 does with `effect: unacted`). The
  choice is the supervisor's: a later-answering handler would then be pressed twice.
- Tests: `apps/extension/src/content/actions/tests/click.test.ts` (a second ignored press is not
  `succeeded`), `action-runtime/ignored-press/tests/press-again.test.ts`; probe row 3's early press.
- Size: small to medium.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w34 probe" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/lane-a-probes/t174-w34.spec.ts --workers=1`
  (first attempt) -> global setup failed: `Could not resolve "fluxiq/automation-studio/nodes"`; worker
  t174-w31's Core build was writing `packages/fluxiq/dist` at that moment. Waited for it to finish.
- The same with `--output=e2e/test-results/t174-w34` (rows 1-3) -> `3 failed`, the `[w34]` lines quoted above.
- The same, rows 1-4 -> `4 failed`: `the replay moved no other line`, `a read named in the instruction's own
  words is not refused`, `nor written as an array`, `the add reached the store`, `the created press carries
  the row it was made on`, `the replay pressed no other row`.
- The same with `-g "honest path before the cart"` (row 5) -> `1 passed (1.4m)`, cart
  `["B0D7KXS4G7x2","B0RDGAU8PMx1","B0BAAA48CTx1"]`, `flagged: null`.
- `node scratchpad/w34-acts.mjs` (Core's `automationStudioInstructedActs` from the t174 Core dist on the task
  instruction) -> acts `a1 add_to` (requires `a1.quantity` "two", `a1.colour` "sage green"), `a2 move`,
  `a3 open`.
- Logs: `scratchpad/w34-probe-{2,3,4}.log` (session `58ff9269`).

## Not verified

- Anything the background worker does: navigation and click landing judgement (`runtime/click-landing.ts`,
  being edited by w31), served status, the page pace and 429 handling, frame merge. T2 has no background.
- The packet format the model will see after t223 lands; the rows above used today's packet.
- Core's completion check itself (only its act reader was run), playback, dry runs, repair.
- Whether a live build would now reach the cart: the model's choices (short query, which card, which handle,
  looking again after the site's 4 s) are not exercised.
- F1's wider record rule on the other nine campaign sites; F4's effect in real playback timing.

## Open questions or contradictions found

- Core reads "give me what is in my cart ... as a table" as an act of kind `open` (`a3`), which a navigation
  answers. Harmless for this path (Go to Cart answers it), but it is not an act of opening; Core's
  instructed-acts reader (P1 B area).
- "Sold by Brightaisle itself" is not a choice Core checks; a Flow adding a marketplace offer would pass the
  completion check and be caught only by result verification.
- The brief's "t195 H (row-scoped targets)" covers a For Each pass's row (`values`), not a single press made
  during a build, so it does not cover cause #14.
- The run-30 debug says the wrong-row press was "a rerun of draft step d19"; which control d19 named is not in
  that bundle, so attributing it to F1 rather than to a model choice is an inference.

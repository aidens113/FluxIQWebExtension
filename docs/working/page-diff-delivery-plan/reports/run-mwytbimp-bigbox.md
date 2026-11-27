# run-mwytbimp-e0c33977: why the saved Flow stopped at step 10, and why attempt 1 cost 31 calls

This is a worker report and a diagnosis only. No code was changed, no live or paid run was made, and no git command was
used. Debug file: `docs/working/language-driven-flow-loop-plan/debugs/run-mwytbimp-e0c33977.md`.

Paths:

- extension and domain paths are in the lane tree `C:/Users/osrs_/FluxStuff/fxwork/t1015-paid-bigbox/`, which the run
  built from;
- Core paths are under `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ/packages/fluxiq/src/` (fluxiq 0.54.34);
- step numbers are folders under `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-27/run-mwytbimp-e0c33977/steps/`;
- "store" means `.../test-runs/instances/paid-bigbox/.attempt-work/run-mwytbimp-e0c33977/fluxiq-root/.fluxiq/artifacts/automation-studio/projects/ac4a0357-.../project.sqlite`,
  read with Python in read-only mode. Trace chunks are deflated, not encrypted.

## Outcome

Done.

- **Step 10 is the click on results page link "2"**, a page-2 detour the saved Flow should not have kept.
- **It is ambiguous because t1071's words-are-state mark was applied to the wrong control.**
  - The mark took away the words "2" and the `page=2` query, which were what identified that link.
  - What was left could not separate "2" (score 0.51) from a crowd of 15 navigation links (0.42 and below).
- **There was no double add.** Attempt 2 pressed Add to cart neither in the replay nor live.
- **The 31 calls came from a failed sort, not from t1074 or t1075.**
  - `dom-select` hides the shape of its `option` parameter, and the verb's own reason ("the command named none") never
    reaches the model.
  - Without the sort, a 2-page scan followed. The page budget holds about one results page and both pages share one key,
    so each visit erased the other page and the model went back and forth.
  - In-place rewrites of those page copies also broke the prompt cache, which is about $1.21 of the $1.90.

## 1. Step 10's ambiguity

**Which control.**

- Saved node `node.bootstrap.a84314135eae2e5d.main.s9`, Flow step 10, is `web.output.dom-click` from build call
  `next_page_2` (0020, handle t796, `link "2"`).
- The command attempt 2 sent (store, `client_gateway_trace_events` row 585, 10:06:17.951) has this target:

```json
{"selector":"main > div > section > nav > a:nth-of-type(2)","tagName":"a","implicitRole":"link","accessibleName":"2",
 "classNames":["css-1foc4gr"],"context":{"landmark":"navigation"},"readsWords":true,"href":"/scenarios/bigbox-retail/search"}
```

**Which candidates tied.**

- It was not a tie between two candidates. The client's failure (deflated trace chunk `6125138234AF...`, repeated in all
  4 tries) is: `no exact match; 16 scored candidate(s) tied: a "2" (0.51), a "ReorderMy Items" (0.42), a "Sign InAccount"
  (0.42), a "Pharmacy Delivery" (0.42), a "Registry" (0.42), and 11 more`, with `resolution: {candidateCount: 16,
  bestScore: 0.514, runnerUpScore: 0.425}`.
- So the right link led, by 0.09, which is under `TARGET_SCORE_MARGIN` 0.2 (`apps/extension/src/content/identity/score.ts:146`).
- Its expected line says `refused a "2" scoring 0.51 with nothing the recording named agreeing exactly`.
- The crowd is the header's `href="#"` navigation links. Without words they agree with the recording on tag, role and
  landmark `navigation`.

**Is it t1071's destination rule?** Yes, at both levels.

- `scoreReadTarget` sends a target marked `readsWords` that carries a path to `ledToDestination` (`score.ts:215-217`).
- That function picks only a leader whose destination `confirms`. If any ranked candidate is `shared`, it returns
  `ambiguous` (`score.ts:234-242`).
- `destinationVerdict` (`identity/destination/verdict.ts:61-67`) calls a link `shared` when another visible real link has
  the same path. On the filtered page 1, "1", "Next page", "Rollbacks & More", "Clear all" and the facet links all go to
  `/scenarios/bigbox-retail/search?...`.
- The `href="#"` header links are action links (`action-link.ts`), so they are not rivals for the destination, but they
  still fill the word-less ranking.
- The veto applies the same rule (`veto.ts:270-277`): `confirmed` only through `destinationVerdict(...) === "confirms"`.

**Why attempt 1's recorded identity did not break it.**

- The mark took the identity apart. `createWebLlmStateWords` (`domain/src/runtime/llm-evidence/plan-resolution/self-changing/state-words.ts`)
  keys a control by `[frame, shadow hosts, selector]` plus tag, id, test id and label (`:111-118`).
- Pagination links have no id, test id or label, so the key comes down to the positional selector
  `main > div > section > nav > a:nth-of-type(2)`.
- The site's pagination (`apps/scenario-lab/src/scenarios/bigbox-retail/pages/results-pagination.ts:15-20`) starts with a
  `<span>` on page 1 and with a "Previous page" `<a>` on page 2. So that slot is link "2" (`...Pickup&page=2`) on page 1 and
  link "1" (`...Pickup`) on page 2.
- The store's captures show exactly this, under xpath `/html[1]/body[1]/div[1]/main[1]/div[1]/section[1]/nav[1]/a[2]`:
  "2" with `...&page=2` (10 captures) and "1" with `...facet=fulfillment_method%3APickup` (1 capture).
- `of()` (`:99-106`) needs two wordings that are not the act's own, plus one destination. `destinationPath` (`:127-132`)
  drops the query, so both wordings give `/scenarios/bigbox-retail/search`, and the slot was marked.
- The saved identity then carried:
  - `readsWords: true`, so the words "2" are a value. They are neither a veto nor a corroboration, and the ranking
    leaves them out.
  - `href` cut to that path.
- The only exact corroborations are visible text, accessible name, label, id, test id or a drawing (`corroboration.ts:61`,
  `:70-76`). Selector, class, landmark and place never count. Nothing was left that could confirm "2", and the shared path
  could not either.

**What should break such a tie, generically, by what stays the same.**

- **Not the place.** The positional selector is what merged two different links: the "Previous page" arrow shifted the
  slot. Position is the least stable thing here.
- **Not the region alone.** A region signal would push the header crowd down. But "1" and "2" sit in the same pagination
  `nav`, and the corroboration rule still wants a distinguishing signal. Region alone would at best turn "ambiguous"
  into "unmatched".
- **The words and the full address, which change together here.**
  - For this control, the words "2" and the query `page=2` are its identity: they move as a pair.
  - The generic rule: a link's words are state only while its full destination (path and query, fragment aside) stays
    the same. When words and address change together, two links share one position, and neither is marked.
  - That keeps t1071's case marked. The cart link read "🛒 1 $3.97", then "🛒 2 $5.25", and went to `/cart` both times.
- **The region, as the full fingerprint asks, for the case t1071 was really about.**
  - Take a truly self-changing link (the header cart) against a visible same-path rival in a drawer or mini-cart.
  - What stays the same is where it lives: its nearest landmark and that landmark's name.
  - Today `context` records only `{landmark: "navigation"}`, the same for the header nav and the pagination nav.
  - Recording the landmark's name and its top-level region (header, main, dialog or drawer), and counting only rivals in
    the same region, breaks that tie by a stable signal, not by one attribute.

## 2. The double add

**Not pressed, and not skipped either: never reached.**

- Attempt 2's replay ran 0060 navigate, 0061 cookie-banner click `ended`, 0063 open store, 0064 set store `ended`
  (already set), 0066 type, 0067 Pickup check.
- Then 0068-0071 failed `web.target.ambiguous` 4 times, each `effect: unacted`, and note 0072 stopped the run at step 10.
- Add to cart (saved step 18, t1589 on the product page) comes after that, so it was never reached.
- Live, the model opened the cart (0075, "check what state the earlier attempt left"), read it (0079), amended the draft
  (0081 and 0083 refused `second_copy`, 0088 applied), and ran only the cart read (0089 `run_flow from 27`, 0090
  `core.replay.replayed`, rows for the 2 lines).
- The site's own record (`attempts/run-mwytbimp-e0c33977/attempt-2/site.json`): `change: {}`, activity `search-view` x2,
  cart `5530601` and `5510204` each at 1.
- t1075's carried act was recognised in the draft checklist ("The acts checklist is done (a1 at step 18)", 0092).
- Whether the run gate would refuse a replayed press as already done was not exercised in this run. Attempt 3 stopped at
  the same step 10 (0103-0107).

## 3. Why attempt 1 took 31 calls ($2.12)

31 calls means 28 decisions, 1 chat and 2 judges. The comparison is with 14 decisions ($0.51) in run-mwynbry2's
attempt 1.

**The same up to the sort.**

- Decisions 0003-0011 match the earlier runs almost byte for byte (0003 input 25,042 tokens, against 25,046 in mwynbry2
  and 24,928 in mwyfc9uf).
- So t1074's asked-column view, the anyOf change and t1075's carried-evidence trail added nothing to the prompt.
  t1075's trail applies only from attempt 2 on.

**The split: the sort.**

- 0013 sent `dom-select` with `label: "Price low to high"`, which failed, as it did in mwynbry2 (c7).
- mwynbry2's next guess was `value` (c8), which works: `findOption` matches an option's visible words (`select.ts:217-219`, t509).
- This run gave up on sorting (0015), read page 1 unsorted (0017, 15 rows) and went to page 2 (0019).
- Its second try at 0025 was `option: {label: ...}`, which also failed (0026).

**Product defect A: `dom-select` hides its contract and swallows its reason.**

- The model is shown `{"id":"value","type":"string","defaultValue":""}` and `{"id":"option","type":"object"}`, with no
  description (`domain/src/output-nodes/definitions.ts:355`, `:364`; seen in request 0015's describedNodes).
- The action requires `option` to be `{by: "value"|"label"|"index", ...}` (`domain/src/actions/schemas.ts:93-104`,
  `domain/src/actions/types.ts:204-208`).
- The store's commands show both sends exactly as the model wrote them: `{"label":"Price low to high",...}` x4 and
  `{"option":{"label":"Price low to high"},...}` x4.
- The verb answered all 8 with `expected "an option named by value, label, or index"`, `actual "the command named none"`
  (`select.ts:97-104`). That validation is `failed` with no failure code, so it becomes `output_not_observed`, gets no
  reason (`domain/.../action-failure/refusal.ts:124-148` has none for it), and is retried 4 times (`attempts: 4`,
  about 4.5 s each).
- The model saw only `code: output_not_observed` and, the first time, `undeclaredParameters: ["label"]`.

**Then a 2-page scan in a window that holds one page.**

- The page budget is 20,000 characters per request (Core `runtime/llm/view-channel/budget.ts`). Page 1 is 11,762
  characters (0012 `page.txt`) and page 2 is 10,202 (0020). Both share the key `.../search`, since the address drops `?`
  parameters (user rule, 2026-11-25).
- So each arrival retired the other copy to `{key, replacedBy}` or `{key, droppedAt}` (`view-channel/projection.ts:16-31`,
  `:106`, `:111`, `:125`). In request 0033 every earlier search view is a reference.
- Page 2 was only structure-detected (0022), never read as rows. So the model lost what it had seen there:
  - 0023 went back to p1 to press Add;
  - 0027 went to p2 to "establish the paging loop";
  - 0029 went to p1;
  - 0031 went to p2 ("Page 2 could hold something cheaper");
  - 0033 tried p1 again, which was refused as a repeat (0034);
  - two loop decisions followed (0036, 0038), the first saying "Sort select does not work".
- Afterwards it re-checked p2 once more (0047) and re-opened the cart (0049).
- About 14 extra decisions came from this, all after the sort failure.
- How much of the back-and-forth is product and how much is the model's own choice not to read page 2 is a judgement.
  The product part is that a retired copy leaves only a reference, and the refusal never said why the sort failed.

**Smaller items.**

- The draft did not tie Add to cart to act `a1` on its own (`todo: no_step_added`, request 0053), which cost one
  amendment.
- One amendment was refused `already_so` (0056).

**Why $2.12: the page window rewrites history.**

- Consecutive requests differ first where an earlier page copy was retired. For example, 0027 to 0029 differ at byte
  137,930, where `"whole"` became `"replacedBy":"next_page_loop"`.
- Everything after that point has to be written to the cache again. 10 of the 28 decisions read a cache prefix at or near
  the system prompt (18,592-28,037 tokens): 0009, 0013, 0019, 0021, 0025, 0029, 0031, 0033 and 0045, with 0049 partly.
- Attempt 1 wrote 482,628 cache tokens. Step 0029's bill implies rates of $2.00/M input, $2.50/M cache write, $0.10/M
  cache read and $10/M output. At those rates the writes are about $1.21 of the $1.90 decision cost.
- run-mwynbry2's attempt 1 had the same pattern on a shorter path: 142,480 write tokens, about $0.36 of $0.51.

## 4. Root-cause fixes, each with an offline proof on this recording

None of these is a cap: each changes the rule that produced the defect.

- **F1. State words need the same full destination.**
  - Change: in `state-words.ts`, record a link's destination as path and query (fragment aside). Mark only when the
    wordings changed while that full destination stayed the same. The saved `href` for a marked target keeps the query
    too.
  - Proof:
    - Unit: feed `createWebLlmStateWords` the two stored captures of the slot ("2" `...Pickup&page=2`, "1" `...Pickup`).
      Today `of()` returns `{destination: "/scenarios/bigbox-retail/search"}`; after the change it returns `undefined`.
    - The t1071 cart fixture ("🛒 1 $3.97" and "🛒 2 $5.25", `/cart`) stays marked.
    - Resolution: score trace row 585's target without `readsWords`, against the stored page-1 HTML artifact
      `b3069613...` (68,487 bytes, saved with the failure). The words "2" corroborate and the link resolves.
- **F2. A shared destination is decided within the control's region.**
  - Change: record the nearest landmark's accessible name and the top-level region in `context`
    (`identity/context.ts`). `destinationVerdict` counts only rivals in the same region.
  - Proof:
    - The t1071 cart fixture plus a visible drawer "View cart" to `/cart`: `ambiguous` today, the header link after.
    - On this page's stored HTML with F1 off, the 0.42 header crowd leaves the pool. The pagination "1" stays a rival,
      which shows F1 is still needed.
- **F3. A press whose page is never used before a navigation by URL is left out.**
  - Change: a kept framework step with nothing lasting (`compose/lasting.ts`), whose resulting page no kept step acts on
    or reads before a later `browser-navigate` to an address, is marked `replaced`. This sits beside `compose/dead-end.ts`
    and does not depend on state digests.
  - Proof:
    - Drive Core's compose with this run's draft steps (request 0057, `core.flow_draft`, steps 9-17, dispositions as
      recorded): step 10 is left out.
    - Attempt 2's 12-node Flow loses it too.
    - A Flow that clicks page 2 and then reads it keeps the click.
- **F4. `dom-select` states its contract and fails honestly.**
  - Change, in two parts:
    - (a) `definitions.ts:364`: describe `value` as the option's value or its words as the page view prints them, and
      `option` as `{by: "label", label: "<words>"}` with `by` one of value, label or index, with an example.
    - (b) `select.ts:97-104` and `:202-206`: no option named, or an `option` without `by`, fails as `INVALID_PARAMETER`.
      That maps to `invalid_input` / `parameter_not_readable`, is not retried, and carries the verb's expected and actual.
  - Proof:
    - Replay the recorded inputs of 0014 and 0026 provider-free on the bigbox filtered search page through the domain's
      tool path. Today: 4 tries, `output_not_observed`, no reason. After: 1 try, the reason names the shape.
    - `option: {by: "label", label: "Price low to high"}` and `value: "Price low to high"` both select and reorder the list.
    - The describedNodes text in a re-projected request 0015 carries the shape.
- **F5. Append-only history; the page window is one trailing block.**
  - Change: in `view-channel/projection.ts`, stop rewriting earlier records. History carries references from the start,
    and the current whole or changed views sit in one trailing block within the same 20,000-character budget.
  - This keeps the user's per-request page limit and the "whole once, then changes" rule. It also means a page dropped
    from the window stays named in history.
  - Proof: the projection is pure. Re-project the 28 recorded attempt-1 request records in both layouts, then measure
    the common prefix of consecutive requests:
    - today it falls back to the system prompt 10 times, as above;
    - after the change it grows monotonically;
    - expected cache writes, from the recorded token counts, fall from about 483k to the new tail of each request.

## Commands run and observed results

- `find .../lab-runs -maxdepth 2 -name run-mwytbimp-e0c33977` printed `.../lab-runs/2026-11-27/run-mwytbimp-e0c33977`.
- I read `steps/index.md`, every decide's `meta.json` usage, every tool step's `call.json` and `result.json`, and the
  model text of 0013-0057 and 0074-0092.
- `cmp` of consecutive request JSONs, with `cache_control` stripped, showed first differences at retired page copies
  (0007 to 0009 at 55,956; 0011 to 0013 at 66,124; 0027 to 0029 at 137,930; 0043 to 0045 at 171,763; 0047 to 0049 at 173,802).
- Read-only Python over the store printed:
  - row 585: the step-10 target above;
  - deflated chunks: the 16-candidate failure (8 copies, from attempts 2 and 3);
  - the nav slot's captures ("2" x10, "1" x1 at `nav[1]/a[2]`);
  - 8 select validations, "the command named none";
  - `run_dataset_answer_rows`: attempt 2's cart rows carry item, quantity and price.
- Attempt-1 totals, summed over decide `meta.json`: 28 decisions, 2,067,552 input tokens, 482,628 cache-write tokens,
  $1.896.

## Not verified

- Why `dead-end.ts` did not bracket steps 10-15 (p1, p2, then back to p1). The draft prints no state digests.
- The per-signal score contributions for the 16 candidates. Only the summary string is stored.
- Why attempt 2's `complete` (0092) was accepted without a whole-Flow run from the start, while the saved Flow still
  failed at step 10. Not checked against Core `completion/replay-stands.ts`.
- The fixes are proposals. None of the proofs above was run, because they need code.

## Open questions

- F1 reads the query as part of where a link leads. A site whose self-changing link also carries a changing query, such
  as a cache-buster, would no longer be marked. That has not been seen on the ten scenarios.
- F5 changes what every model call sees, so it should be planned under the page-diff delivery plan rather than as a
  lane fix.

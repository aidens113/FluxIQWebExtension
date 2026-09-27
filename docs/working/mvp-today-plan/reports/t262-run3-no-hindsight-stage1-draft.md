# t262 — Run-3 no-hindsight Stage 1 draft

Status: **Complete draft; do not create the pending debug until every serial preflight gate is green**

This is copy-ready preparation for `pending-t249-run-3.md`. It is not the pending debug and does
not authorize a provider, browser, Lab, build, or dry-run action. Copy it only after final t258 and
t259 acceptance, final-tree validation/build/freshness, downstream compatibility, the first
one-Lab check, and zero-provider readiness all pass. The latest accepted live evidence remains
failed run 2, and the consecutive-pass streak remains **0**.

## Copy-ready header and Stage 1

```markdown
# Run debug — `pending-t249-run-3`

This file and Stage 1 were completed before the run began and before any run-3 artifact was
opened. Every later field must be filled from the resulting bundle; missing evidence is recorded
as `NO EVIDENCE:`. The expectations below describe the pre-run oracle and the locally proven
change under measurement; they are not claims about the live outcome.

---

## Header

- Run id: pending; replace only after the command returns a real run id
- Scenario / variant / task: `everything-store` / none / `everything-store-plus-earbuds-under-50`
- Command: isolated created-Flow lane, DeepSeek `mvp-hard-scenario`, unchanged default 26-call budget, one deterministic replay; no max-call, token, cost, timeout, Lab-instance, target, or run-root override
- Date, provider, model: pending / DeepSeek / pending from sanitized run evidence
- Provider calls, tokens, cost: pending from sanitized accounting evidence; do not combine overlapping representations
- Verdict as reported: pending
- **Stage reached:** pending
- Change under measurement: the complete post-run-2 correction chain. T233/t239/t243 preserve truthful three-state request provenance; t246 forwards the Router-selected Subflow into repaired replay; t255 permits only the same held, claimed, idle run grant to continue across the exact authorized Flow binding change; and t258 retains that run-owned grant through nested reauthoring, continues it only after durable apply plus an authoritative binding read under the Flow lock, replays the selected Subflow without a provider call, performs the post-replay judge call, and leaves terminal revocation to the enclosing run. A continuation refusal must preserve the applied adaptation, record closed `grant_continuation` provenance with `applied: true` and `replayReady: false`, and skip replay and the post-replay judge. This measurement does not assume that any of those outcomes will occur live.

## Stage 1 — the instruction and the expected chain

- The instruction, verbatim: Find every pair of wireless earbuds in the store's search results that is Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going through every page of results. Leave out sponsored placements and accessories such as ear tips or charging cases, list each pair only once even if it turns up on two pages, and keep the order the search results show them in, with columns name, price, rating and url.
- The node chain a correct Flow must have, written before looking at the run:
  1. Navigate from the blank start to the Everything Store home page.
  2. Dismiss the `Never miss a deal` dialog with `Not now`, then accept the cookie banner. Neither interruption is a high-risk action requiring human authorization.
  3. Search for `wireless earbuds` through the real header field and submit the search.
  4. Pass the first-search browser check with `Continue shopping` if it appears.
  5. Enforce the exact predicates: organic non-sponsored results; product kind earbuds rather than accessories; Brightaisle Plus eligible; printed rating at least 4.0; and price strictly below $50.00. Approximate store filter labels are insufficient.
  6. Extract only organic result cards with fields `name`, `price`, `rating`, and `url`.
  7. Traverse every results page and lazy-loaded card without relying on a Next control after it stops advancing. Progress must be demonstrated rather than assumed.
  8. De-duplicate repeated page-boundary listings by listing identity, retaining the first occurrence and the store's relevance order.
  9. Store the ordered dataset and let Core judge every record and field. If the first answer is wrong, the judge must issue an actionable screened repair; reauthoring must apply and persist it under the same authorized run grant; the selected Subflow must replay with zero provider calls; Core must judge the replayed answer; and the enclosing run must finally revoke the grant.
- What a wrong answer that looks right would look like here: a polished four-column table—possibly even 13 rows—built from Plus, `4 Stars & Up`, and `$25 to $50`, but containing sponsored cards, accessories, actual 3.8/3.9 ratings, the exactly-$50 item, duplicate page-boundary listings, or no later-page results. It is also wrong if the price band excluded valid products below $25, if order changed, if a row or field differs, or if count 13 is treated as sufficient by itself. A correct-looking first table is still a failure if Core does not affirm it; an incorrect first table is still a failure if repair is not applied and persisted, replay calls the provider, the selected Subflow is lost, the replayed answer is not judged, or the grant is leaked or widened.
- Oracle recorded before the run: exactly 13 ordered records from `extract-plus-under-fifty`, with `kind === "earbuds"`, `plus === true`, `rating >= 4`, and `priceCents < 5000`. Compare `name`, `price`, `rating`, and `url` for every row in exact order; count alone cannot pass.
- Pre-run hypotheses: semantic filter and pagination fidelity remain the highest scenario risks. Short page timing, target drift, transient browser failure, or transport faults should be absorbed and recorded by bounded recovery. No permission question is expected because the task does not delete, move money, send, or publish. If wrong-answer recovery is needed, the expected provider sequence is two initial `loop_verification` decisions, one `evidence_tool_decision` reauthor decision, deterministic selected-Subflow replay with zero provider calls, and one post-replay `loop_verification`; this is an expected path, not an assumed live outcome. The default production allowance remains 26 calls.
- Authority and accounting invariants fixed before the run: repair may continue only the exact existing run-owned grant after the exact authorized binding update. It must not mint or replace a grant, widen purpose/scope/capabilities/permissions, reset uses/tokens/cost/reveal authorizations/deadline, relax binding drift, or transfer terminal revocation. Every provider attempt/response state must remain truthful, including setup failures and untyped harness escapes.
- Pass threshold fixed before the run: a finalized integrity-valid bundle with `verdict: passed`, `flowCreated: true`, `oracleVerdict: passed`, `reportedVerdict: passed`, affirmative result verification (`confirmed`), exact ordered dataset and fields, and one zero-provider deterministic replay. If repair occurs, require an applied and persisted adaptation, selected-Subflow replay, post-replay judgement, and terminal grant revocation. A raw runner pass, a count-only match, or local test evidence is insufficient.
- Consecutive-pass rule: if this run passes, it begins the streak at 1 because runs 1 and 2 failed. A second independent unchanged-profile pass is still required.
```

## Failure evidence checklist

After the command returns, rename the pending debug to the real `<run-id>.md` before reading any
bundle content. Do not revise Stage 1. From finalized, integrity-valid, sanitized artifacts only,
record:

- the highest completed stage, facility/product classification, exact closed failure code and
  phase, and whether a real run id and finalized bundle exist;
- authored node categories, own-page reach, ordered oracle counts/field comparisons, pagination,
  de-duplication, ordering, Core's verdict, and every bounded mismatch class;
- provider-call order and accounting as separately published representations, without summing
  overlapping buckets; exact attempt/response provenance for any setup, harness, or provider
  failure;
- whether recovery routed, the repair directive validated, an adaptation id/status was published,
  durable persistence was proved, and the Router-selected Subflow reached replay;
- replay provider-call count, replay result, post-replay judgement, final Flow/run status, and
  terminal active-grant count;
- for continuation refusal: authoritative old/new binding evidence, closed `grant_continuation`
  classification, `applied: true`, `replayReady: false`, no replay, and no fourth judge call;
- any evidence of a minted/replaced grant, widened authority, reset accounting/reveal/deadline
  state, binding bypass, leaked active grant, raw provider text, or inaccurate provenance as an
  immediate product/security failure; and
- every unanswered template field as `NO EVIDENCE:` with the specific bounded evidence needed.

Never copy raw prompts/responses, credentials, authorization material, selectors, opaque page
handles, recorded page text or rows, cookies, network payloads, raw logs, or unsanitized errors into
the debug. Fully debug run 3 before another provider call. A failure leaves/resets the streak to
**0**; a pass moves it only to **1**.

## Work performed

Prepared this report from t249, t260, t261, the accepted run-2 debug structure, and the blank
run-debug template. No shared plan, source, generated output, pending debug, run artifact,
provider/browser/Lab state, build, commit, or push was changed.

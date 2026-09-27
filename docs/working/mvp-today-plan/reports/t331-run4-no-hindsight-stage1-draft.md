# t331 — Run-4 no-hindsight Stage-1 draft

Status: **Copy-ready draft only; no pending debug created and no run authorized by this report**

This draft preserves the exact scenario contract, oracle, command, and acceptance threshold used for run 3. Run 4 is the single unchanged reliability retry authorized by t327. There is no source, configuration, dependency, generated-output, budget, policy, scenario, oracle, or command change under measurement.

Copy the block only after every t327 serial gate is green. Complete and independently attest it before launching run 4, then do not revise Stage 1 from run output.

## Copy-ready header and Stage 1

````markdown
# Run debug — `pending-t331-run-4`

This file and Stage 1 were completed before the run began and before any run-4 artifact was opened. Every later field must be filled from the resulting integrity-valid, sanitized bundle; missing evidence is recorded as `NO EVIDENCE:`. The expectations below are the unchanged scenario contract and pre-run oracle, not claims or predictions about the live outcome.

Run 4 is the one bounded unchanged reliability retry authorized after accepted failed run 3. No product/source/configuration/dependency/generated-runtime-output change is under measurement. Do not backfill run-3 trace details into this Stage 1.

---

## Header

- Run id: pending; replace only after the command returns a safe real run id
- Scenario / variant / task: `everything-store` / none / `everything-store-plus-earbuds-under-50`
- Exact command:

  ```powershell
  node packages/test-runner/dist/cli.js run everything-store `
    --target isolated `
    --live-llm `
    --llm-profile mvp-hard-scenario `
    --llm-provider deepseek `
    --llm-task create-flow `
    --instruction-task everything-store-plus-earbuds-under-50 `
    --replays 1
  ```

- Command contract: isolated created-Flow lane, DeepSeek `mvp-hard-scenario`, unchanged default 26-call budget, and one deterministic replay; no max-call, token, cost, timeout, retry, concurrency, Lab-instance, target, or run-root override
- Date, provider, model: pending / DeepSeek / pending from sanitized run evidence
- Provider calls, tokens, cost: pending from sanitized accounting evidence; keep overlapping representations separate
- Verdict as reported: pending
- **Stage reached:** pending
- Change under measurement: no source or policy change. This is the one authorized unchanged reliability retry measuring whether the variable live created-Flow build converges under the same validated tree and default profile. Run 3 proved truthful terminal preservation for a non-converging build but did not establish a deterministic source defect or authorize weakened answerability, a larger budget, provider retry, or repeated attempts.
- Stop rule fixed before launch: this authorization permits exactly one invocation. If the accepted run-4 evidence again ends in the Stage-2 exhaustion family `flow_bootstrap.evidence_unusable_decision` with `bootstrap.cannot_answer_instruction`, stop unchanged retries. Do not launch run 5. The next provider call must wait for a fix-before-retry investigation with privacy-safe stable draft/step identity or a deterministic scripted reproduction and a measured source change.

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
- Consecutive-pass rule: the streak before run 4 is **0**. If run 4 passes the complete threshold, it begins the streak at **1**, not 2; a second independent unchanged-profile pass is still required. Any failure leaves/resets the streak to **0** and must be fully debugged before another provider call. The repeated-Stage-2 stop rule above is stricter and forbids another unchanged attempt.
````

## Post-run handling fixed before launch

- Rename the pending debug to the safe real run id before semantic artifact inspection, preserving Stage 1 unchanged.
- Apply the established integrity, identity, unique-index-entry, and conservative-redaction gates before reading bounded evidence.
- Keep build/main, runtime/repair, and verification accounting representations separate unless typed schema evidence proves disjointness.
- Do not open or copy raw provider text, logs/events, page data, screenshots/HTML, browser state, credentials, authorization material, selectors, or datasets.
- A malformed/no-id/facility outcome still consumes the one authorized invocation; do not automatically relaunch.
- Fully classify run 4 before any later provider call. Enforce the no-run-5 unchanged-retry rule if the accepted result repeats the specified Stage-2 exhaustion family.

## Work performed

Prepared this copy-ready report from the finalized run-3 debug, t327 disposition, and t262 Stage-1 source. No pending debug, shared plan, source, generated output, run artifact, `test-runs` content, provider/browser/Lab state, test, build, commit, or push was created or changed.

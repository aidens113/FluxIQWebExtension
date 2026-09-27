# t222 — Run 2 no-hindsight Stage 1 draft

This is copy-ready preparation for `pending-t219-run-2.md`. It is not the pending debug itself and does not authorize or start a live run. Copy it only after t219's validation, freshness, serial-Lab, credential, and provider-free readiness gates are green.

Run 2 uses the unchanged default **26-call** `mvp-hard-scenario` profile. There is no `--llm-max-calls` or other budget override. A pass would begin the consecutive-pass streak at **1** because run 1 failed; one further independent default-profile pass would still be required.

## Copy-ready header and Stage 1

```markdown
# Run debug — `pending-t219-run-2`

This file and Stage 1 were completed before the run began and before any run-2 artifact was opened. Every later field must be filled from the resulting bundle; missing evidence is recorded as `NO EVIDENCE:`.

---

## Header

- Run id: pending live invocation
- Scenario / variant / task: `everything-store` / none / `everything-store-plus-earbuds-under-50`
- Command: isolated created-Flow lane, DeepSeek `mvp-hard-scenario`, default 26-call budget, one deterministic replay
- Date, provider, model: pending run date, DeepSeek, model pending bundle confirmation
- Provider calls, tokens, cost: pending bundle evidence
- Verdict as reported: pending
- **Stage reached:** pending — fill with the highest stage actually completed
- Change under measurement: t217 terminal-classification parity only. It must retain an actionable final unusable-decision issue instead of flattening it to iteration-limit. It does not change budgets, convergence requirements, answerability, runtime recovery, judgement, repair, or replay behavior.

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
  9. Store the ordered dataset and let Core judge all records and fields. If the first answer is wrong, the judge must produce actionable fix instructions, the repair must apply and persist automatically, and the repaired Flow must replay with zero provider calls.
- What a wrong answer that looks right would look like here: a polished four-column table—possibly even 13 rows—built from Plus, `4 Stars & Up`, and `$25 to $50`, but containing sponsored cards, accessories, actual 3.8/3.9 ratings, the exactly-$50 item, duplicate page-boundary listings, or no later-page results. It is also wrong if the price band excluded valid products below $25, if order changed, if a row or field differs, or if count 13 is treated as sufficient by itself.
- Oracle recorded before the run: exactly 13 ordered records from `extract-plus-under-fifty`, with `kind === "earbuds"`, `plus === true`, `rating >= 4`, and `priceCents < 5000`. Compare `name`, `price`, `rating`, and `url` for every row in exact order; count alone cannot pass.
- Pre-run hypotheses: semantic filter and pagination fidelity remain the highest product risks. Short page timing, target drift, transient browser failure, or transport faults should be absorbed and recorded by bounded recovery. No permission question is expected because the task does not delete, move money, send, or publish. A wrong first answer should generate a structured repair directive, persist the corrected Flow, and replay without a provider call. T217 changes only how a final unusable build decision is classified; it does not predict that the model will converge.
```

After the live helper returns a run ID, rename the actual pending file to `<run-id>.md` before opening any run-2 artifact. Replace only the pending header fields from sanitized bundle evidence; do not revise Stage 1 to fit the outcome.

## Expected behavior by stage

| Stage | Expected behavior before seeing run 2 |
| --- | --- |
| 1 — instruction | The exact instruction and nine-part chain above are fixed before provider work. |
| 2 — exploration | The model may inspect and act within the bounded loop, route around structured refusals, and use draft feedback. Every provider decision counts toward the default 26-call build grant; exploration must converge to an answerable Flow within that bound. |
| 3 — proposal | A reviewed runnable Flow preserves every required behavior and qualifier. Screened authored-node parameters must demonstrate exact semantics rather than approximate UI labels. |
| 4 — execution/replay | The Flow reaches its own page, executes authored nodes in order, absorbs recoverable faults through bounded defensive recovery, and never reports success for an action that did nothing. Deterministic replay makes zero provider calls. |
| 5 — answer | The returned dataset is exactly the 13-row oracle in order, with exact `name`, `price`, `rating`, and `url` values; all exclusions and boundary conditions hold. |
| 6 — judgement/repair | Core judges the exact result. If wrong, its directive identifies what to fix; repair receives the required structured context, applies and persists, and the repaired replay proves the correction without a provider grant. |

If the build again reaches its literal final decision with an unusable completion, t217 is expected to preserve the actionable refusal rather than replace it with a generic iteration-limit. That is a truthful failure, not a pass.

## Pass thresholds

Run 2 passes only if all of the following are evidenced in the finalized, integrity-valid bundle:

1. The facility verdict is `passed`, with the intended isolated created-Flow lane, scenario, workflow, task, and one parsed replay.
2. The live build remains within the default 26-call grant and all configured token, cost, timeout, and stage bounds; no budget override or breach exists.
3. A reviewed Flow is actually authored. Its screened node list and parameters implement all nine Stage-1 behaviors, including strict semantic predicates, organic-only extraction, full pagination/lazy loading, identity-based deduplication, and stable result order.
4. Runtime reaches the Flow's own page and completes. Any recoverable fault is both absorbed and recorded with its attempt and recovery rung; no node claims success without the intended effect/output.
5. The returned dataset matches exactly 13 expected records, all four fields, and exact order. A runtime success, plausible table, or matching count alone is insufficient.
6. Core's result judgement runs against the exact dataset and reaches the correct conclusion.
7. If repair is needed, it triggers automatically from a structured directive, changes the relevant parameters without weakening the instruction, persists, and the persisted repaired Flow is the one replayed.
8. Deterministic replay makes exactly zero provider calls and proves the final persisted behavior.
9. No non-high-risk permission question, redaction failure, integrity failure, secret exposure, or competing Lab/build state occurs.

A passing run 2 sets the consecutive-pass streak to **1**, not 2.

## Fail and no-pass thresholds

Any of these prevents a pass:

- no proposal, null authored nodes, or a build that ends on any refusal/limit without producing an accepted answerable Flow;
- more than 26 build-grant calls, any call-count override, budget breach, provider retry, or provider call during deterministic replay;
- missing navigation, interruption handling, search, browser-check handling, exact predicate, extraction, pagination, deduplication/order, judgement, repair, persistence, or replay behavior;
- using approximate `4 Stars & Up` or `$25 to $50` controls as proof of exact rating/strict-price semantics;
- including sponsored placements, accessories, actual sub-4.0 ratings, the exactly-$50 listing, duplicates, or out-of-order rows; excluding valid under-$25 rows; or failing to traverse every results page/lazy card;
- absent comparison, count-only comparison, any row/field/order mismatch, absent judgement, or an unsupported claim that no dataset means zero matching rows;
- a recoverable runtime fault that terminates the Flow, an unrecorded retry/recovery, or success-without-effect;
- an unexpected permission request for build, inspection, repair, extraction, judgement, persistence, or replay;
- a repair that does not trigger when required, lacks structured context, is not applied/persisted, or is not the version replayed;
- non-finalized or integrity-invalid evidence, failed redaction attestation, secret-bearing output, wrong target/lane/task/oracle, or concurrent Lab/build interference.

If run 2 fails but t217 correctly preserves the final unusable issue, record the classification fix as validated while keeping the scenario/MVP result failed. Do not upgrade any unmeasured later stage.

## Allowed retry and recovery policy

- **Provider retries:** exactly zero. The grant/profile permits no automatic provider retry; every provider decision is one of the build grant's at most 26 calls.
- **Exploration rerouting:** allowed within the same bounded evidence loop when a structured tool result says the start location, target, dialog, page structure, or draft is not usable. Rerouting is not a provider transport retry and still consumes provider decisions normally.
- **Browser/runtime recovery:** bounded retries and recovery rungs are required for recoverable timing, target, navigation, transient status, or transport faults. Each attempt, terminal/recovered status, and rung must be recorded. Recovery may not turn a no-op into success or bypass a genuinely high-risk permission.
- **Repair:** at most the product's authorized automatic repair path for the failed result, followed by persistence and deterministic replay. Repair provider work must remain in its separately authorized grant; replay itself must use zero provider calls.
- **Manual rerun:** no immediate ad-hoc rerun inside run 2. Fully finalize, inspect, and debug the bundle first. A later independent run requires the same serial preflight and does not retroactively change run 2.
- **Budget policy:** keep the default 26 calls. A 27-call command is diagnostic-only and cannot qualify as this run or enter the consecutive-pass streak.

## Sanitized evidence checklist

Record only closed-vocabulary state, screened authored parameters, and aggregates. Use `NO EVIDENCE: <needed field>` rather than inference.

### Integrity and header

- completion/index integrity result, redaction status, run ID, scenario/workflow/task, lane/target, timestamps, verdict/failure category, highest completed stage;
- provider/model/profile identifiers and per-grant aggregate calls, input/output/total tokens, estimated cost, configured ceilings, breaches, and pending/unrecorded call counts;
- never record a credential or credential value/source detail beyond an approved variable/source label.

### Exploration and proposal

- one row per provider turn in order: iteration, closed decision/tool kind, screened action category, closed result code/reason, whether progress/reset/rerun occurred, and safe evidence-byte/count totals;
- remaining-budget fields when available: `decisionsLeft`, `tokensLeft`, `costLeftUsd`, `secondsLeft`, and whether the decision was completion-only;
- repeats, refusals, unusable decisions, amendment/rerun counts, context truncation/eviction markers, and terminal issue codes;
- reviewed node list and semantic parameters needed to prove the instruction, with selectors, opaque handles, prompts, responses, and recorded page content removed;
- every divergence from the prewritten chain classified only when evidence supports page misread, grammar misread, or inability to express.

### Runtime and recovery

- runtime run ID and status; each authored node's execution order, outcome, duration, attempt count, effect/output presence, terminal/recovered failure code, and recovery rung;
- navigation/page ownership, readiness waits, dialog handling, pagination progress, lazy-load continuation, and success-without-effect checks as sanitized states—not raw DOM/page evidence;
- provider calls attributed separately to build, judgement/repair, and replay. Replay must be zero.

### Answer, judgement, and repair

- expected and actual record counts without reproducing recorded page rows;
- compared field names, exact-match/mismatch counts, missing/extra/order mismatch classes, and whether comparison was exact or count-only;
- judgement invoked/status/basis/code and a sanitized structured-fix summary, never raw model text;
- repair trigger, target node/parameter category, context-presence flags, application outcome, persistence result, replay count/outcome, and proof the persisted version was replayed;
- explicitly mark absent stages as not reached rather than failed, passed, zero-row, or zero-call unless the artifact measures that value.

### Privacy exclusions

Never copy raw prompts/responses, credentials, authorization material, selectors, opaque page handles, recorded page text/rows, cookies, network payloads, raw logs, or unsanitized error messages into the debug. If safe structured evidence cannot answer a template field, preserve the gap verbatim as `NO EVIDENCE`.

## Handoff

This draft changes no run file. The supervisor must create the actual pending debug only after t219's gates pass, paste and review the Stage 1 block before provider work, and keep the run serial. No live/provider/browser action, credential access, build, commit, or shared-document edit was performed for t222.

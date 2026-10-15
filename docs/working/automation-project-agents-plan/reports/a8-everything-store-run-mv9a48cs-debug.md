# A8 wave 6 debug: everything-store plus-earbuds-under-50, `run-mv9a48cs-8fff527c`

Read-only debug. Nothing was committed, no Lab or live run was started, and no model provider was called.
Pair: downstream `0638d45f`, Core `95cc9a7d` (t567 tree). Steps are under
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mv9a48cs-8fff527c/steps/`.
The wave 5 pass used for comparison is `lab-runs/2026-10-14/run-mv96rz6c-5249e54f`.

## Outcome

Done. The build was ended blocked by three separate defects, two of them introduced by this wave's own fixes:

1. **t622 regression (Core), and the reason for the final ending.** The repair brief's new `yourSubflow` carries the subflow's resolved node parameters raw. Those include `selector` keys. `selector` is on the web domain's denied-evidence list, so Core refused the repair's first request before any provider call (`flow_bootstrap.request_refused_evidence_denied_key`). The same thing happened in social `run-mv9a4ah1-3269d74d`.
2. **t623 regression (web extension).** The new check on Next page treats the search box's default department choice (`<select name="i">`, option "All" selected) as an applied filter. The site's Next and page-number links drop `i=all`, so every Next from a typed search failed with `page_fault`. The model was told only `action_failed`. It spent 6 decisions (about $0.015) working around this.
3. **Brief budget (Core).** The plan's two subflows split the money three ways, so each brief got $0.0769. The only builder stopped with $0.018 of that left: its next call's worst-case price (about $0.025) did not fit, even though the build still had $0.184 unspent.

The model's own plan choice made 3 worse: it split the filtering into a second subflow that never touches the page, which is the main difference from wave 5.

## What changed and why

Only this report was written.

## How far it got

| Stage | Result | Evidence |
| --- | --- | --- |
| Plan | Written, with 2 subflows: `collect_results` (p1) and `filter_and_list` (p2, `after: collect_results`, input `results`) | step 0005; 0006 returned warning `project.plan_subflow_constraint` on `subflows.1`; 0007 supervisor: "the filter_and_list warning is fine since its part reads what the person asked for" |
| Briefs | Dispatched as brief-1 (build `collect_results`) and brief-2 (build `filter_and_list`); each `allowanceUsd: 0.076914, maxCalls: 77` | 0008 `given` |
| Builder exploration | Cookie banner and popup closed, search typed (0016: URL `s?i=all&field-keywords=&k=wireless+earbuds`), list detected and read. **Next page failed twice** (0023, 0031: `"code": "action_failed", "attempts": 4`, about 12 s each, no reason given). The model clicked page link "2" instead (0033), detected and read page 2 again (0035, 0037) | steps 0009-0037 |
| Submits | rev 0 refused `subflow.output_unbound` (0039); rev 1 refused `part_interface_invalid` for `$step page.records` (0041); rev 2 accepted (0043) | |
| Subflow trial | rev 2, 5 pages read, 94 seen, 21 kept, 4 duplicates removed, **17 stored**, verdict **unsure** (`candidate.trial_unconfirmed`) | 0045 |
| Revision after trial | rev 3 added `{"field":"name","not":true,"contains":["Ear Tips","Charging Case","Replacement"]}` (0049, 0050). **Never tested**: iteration 20 threw `flow_bootstrap.run_budget_cost_exhausted` (core.log 08:39:50.092) | |
| Brief returns | brief-1 `partial`: "This brief's allowance could not pay for its next call (llm_budget.run_cost_limit)", `spentUsd 0.0590`, 22 calls. brief-2 `blocked`, $0 spent: its predecessor never passed | 0008 result |
| Repair | brief-3 (repair `collect_results` from the unsure receipt), `allowanceUsd 0.043436`. Opening navigate ran (0053); decide 1 threw `flow_bootstrap.request_refused_evidence_denied_key` after 11 ms, with 0 calls and $0 spent | 0052; core.log 08:39:56.735 |
| Assembly / whole test | **None.** No candidate was ever assembled | |
| Ending | 0054 supervisor `complete` `{ended: "blocked", reason: "...the repair brief was refused (flow_bootstrap.request_refused_evidence_denied_key)..."}`; `completion check ok=true`; build throw `post_provider_validation_failed` | core.log 08:39:59 |

Spend: $0.066 of $0.25. 27 provider calls for the build, plus 1 chat call.

## The judges against the oracle

The oracle (`apps/scenario-lab/src/scenarios/everything-store/workflows/plus-under-fifty.ts`) expects 13 records. The 17 stored rows of rev 2 are exactly wave 5's 13 passing rows plus 4 more:

- 2 sponsored placements: Pulsebud Neo ANC at `sspa/click?...adId=sp-7Q2K91`, and Kinetra Run Hook at `adId=sp-4H6RZ2`.
- 2 accessories: "Replacement Ear Tips ..." ($12.99, 4.5) and "Charging Case Replacement for Soundcrest Air Pro ..." ($24.99, 4.2).

I checked this by comparing names against wave 5's step 0064 sample rows. Rev 2 left out the sponsored and accessory conditions because its brief was p1 only. Rev 0's script (0038) had both conditions.

The trial judges were given p1 as asked and p2 under `outOfScope`.

- **Judge 1 (0046): yes, 0.72.** "excluding accessories is the job of the out-of-scope part p2, not of this subflow, so this trial's own part p1 is satisfied." Right for the scope it was given. Every row satisfies p1's three bounds, all pages were read, and paging ended.
- **Judge 2 (0047): no, 0.70.** "'Replacement Ear Tips ...' is an accessory, not a pair of earbuds ... The request's own words are 'every pair of wireless earbuds'". This is right about the final answer, but out of scope for this trial. It did not mention the 2 sponsored rows.
- **Recheck (0048): no, 0.70.** Core's check on judge 2's advice had told it "this advice adds an exclusion the request never states". The judge kept its no anyway: "The request's words do not state an exclusion for accessories, so under the recheck instruction I cannot treat that row as excluded ... it is a row the request does not ask for".
- **Core's result: unsure.** In effect this is right for a p1 trial. The wording, though, is false: the instruction does state the accessory exclusion, in p2. Core should say the exclusion belongs to an out-of-scope part, not that the request never states it (see Open questions).

Against the oracle, neither verdict matters on its own. The finished Flow could only be right once p2's subflow existed, and it never started.

**t624 behaviour.** Core settled the left-out rows in the judge's copy for presence and the two numeric bounds (`leftOutSettled` with `settled: ... Core settled these rows`; 0047 request around lines 453, 614 and 752). Judges 1 and 3 used it: "the settled left-out rows all fail those bounds". t624's own text-condition settling was **not exercised**: rev 2 had no text condition, and rev 3, which added the `not contains`, was never tested. `leftOutAlsoInResult` appears only in the instruction text, on no row. That is correct: of 33 left-out row names, none is among the 17 stored rows (checked by script).

## Why it ended blocked, and why under `post_provider_validation_failed`

No reply was unusable. The supervisor's last reply (0054) was a valid honest ending, `complete {ended: "blocked"}`, and `completion check ok=true`.

The code comes from `packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/run.ts:239`. When the supervisor loop returns with no `candidate`, Core throws `flowBootstrapPhaseFailure("post_provider_validation", ..., "flow_bootstrap.post_provider_validation_failed")` with `issueCodes: ["project.build_" + ending.outcome]`, so `project.build_blocked`. The code names the phase the build was in, not what went wrong. The real cause, the repair's `request_refused_evidence_denied_key`, appears only in the supervisor's reason text.

The supervisor ended because, in its words, nothing was left to try: "collect_results came back partial ..., and the repair brief was refused (flow_bootstrap.request_refused_evidence_denied_key); filter_and_list is blocked because its predecessor never passed". It still had about $0.18 and 220 calls.

## Repair refused before its first turn: the t622 `yourSubflow` key (both runs)

**Confirmed: t622's `yourSubflow` carries the refused key, and it is the only thing that does.**

I walked every key of the repair's opening `core.run_node` result, which is the evidence item that goes into the first request:

- **everything-store `run-mv9a48cs` step 0053:** 7 `selector` keys, all under `repairOf/yourSubflow/steps/0/nodes/...`:
  - `nodes/1/parameters/selector` and `nodes/1/parameters/element/selector` (the optional banner Close click, `t1952` resolved).
  - `nodes/5/parameters/extractList/fields/{name,price,rating,plus,url}/selector`.
- **social `run-mv9a4ah1-3269d74d` step 0086:** 6 `selector` keys, all under `repairOf/yourSubflow/steps/0/nodes/{1,3,6}/parameters/...` (two clicks with `selector` and `element/selector`, and `extractList/fields/{name,mutual}/selector`). Dispatch 0085 returned brief-3 `blocked`, "Flow Bootstrap generation failed (flow_bootstrap.request_refused_evidence_denied_key)". core.log line 157 shows `decide throw iteration=1 ms=24`.
- Neither result carries any other denied key (`html`, `innerHtml`, `outerHtml`, `pageSource`, `cookies`, `headers`; the list is in `domain/src/runtime/llm-evidence/denied-keys.ts`) outside `yourSubflow`.

**How it happens.**

- `project-agents/dispatch/run-brief.ts`, `yourSubflow()`, builds `steps` from `found.proposal.subflows[].nodes[]` with `parameters: structuredClone(node.parameters)`. These are the parameters as Core resolved them, and a web click or read field resolves to `{selector, element: {selector, ...}}`.
- `shownAtOpening()` puts this into the opening call's evidence as `repairOf`. That evidence item has toolId `core.run_node`.
- `llm/harness/context-packet.ts` `packEvidenceLoop()` withholds denied keys only for the flow-draft tool's entry (`draft-screen.ts`, `automationStudioLlmDraftEntryWithoutDeniedKeys`, which checks `toolId === AUTOMATION_STUDIO_FLOW_DRAFT_TOOL_ID`). Any other item carrying a denied key is refused whole: "Evidence-loop evidence carries a key the bound domain denies, so the decision request is refused rather than sent."
- This is the same defect `draft-screen.ts`'s header records for drafts (`run-mulxk0ro-36bf090d`), coming back by a new route.
- t622's test (`dispatch/tests/repair-opening.test.ts`) runs a scripted model that never goes through the context packet. Its fixture nodes also carry no denied key, so the test could not see this.

**Smallest fix.** The resolved steps are the Flow's own authored parameters, not page data, so carry them withheld the way the draft is:

- Split `withoutKeys` out of `llm/harness/draft-screen.ts` into an exported `automationStudioLlmValueWithoutDeniedKeys(value, deniedKeys)`. The draft entry function then uses it too.
- Give the builder ports the domain's declaration: `deniedEvidenceKeys`, from `binding.deniedEvidenceKeys` in `service/project-build/brief-ports.ts`, through `project-agents/dispatch/port.ts`.
- `yourSubflow()` in `run-brief.ts` maps each node's `parameters` through the helper and adds `AUTOMATION_STUDIO_LLM_DRAFT_WITHHELD_NOTE` where it removed anything. The proposal Core keeps is untouched, so a step the repair leaves as it is keeps its locator.
- Test: in `repair-opening.test.ts`, a node with a `selector` parameter, asserting that `screenAutomationStudioLlmEvidence(opening.repairOf, ["selector"]).deniedKey === false` and that the note is present. A second test should pack the opening through the real context packet so that any future route is caught there.

## Root causes and the smallest structural fix for each

1. **Core, t622 regression: repair refused at 0 turns.** See the section above. Files: `project-agents/dispatch/run-brief.ts`, `llm/harness/draft-screen.ts`, `project-agents/dispatch/port.ts`, `service/project-build/brief-ports.ts`, and the test.

2. **Web extension, t623 regression: Next fails on any page reached by the store's search form.**
   - **Cause.** `apps/extension/src/content/extraction/page-advance/applied-controls.ts` counts every selected `<option>` as applied, including a select's default choice. The page's own address carries `i=all`. Next leads to `s?k=wireless+earbuds&page=2`, and so does page link "2" (seen at 0029/0033), so both drop `i`.
   - `dropped-state.ts` `shownApplied` matches the selected option's select name `i` (`pages/header.ts:35`, `<select name="i">`, option `all` selected). `follow-next.ts` `keepingFollowing` then finds no following link that keeps it and throws `PaginationFault("page_fault", ...)`, before anything is pressed. The domain turns that into `ACTION_FAILED` (`domain/src/actions/next-page/answer.ts`).
   - **Comparison.** Wave 5, on pre-t623 code, followed Next from this same URL (`s?i=all&field-keywords=&k=wireless+earbuds`) to `s?k=wireless+earbuds&page=2` (its step 0019). This run's trial navigated straight to `s?k=wireless+earbuds`, so there was nothing to drop and all 5 pages paged.
   - **Fix.** A choice the page is in by default narrows nothing, so do not count it as applied. In `appliedControls`, skip an option that is its select's first option, the unnarrowed "All/Any/Featured" position. Add a test in `page-advance/tests/applied-controls.test.ts` (a department select on its first option) and a case in `next-keeps-scope.test.ts`.
   - **More robust alternative.** Follow Next, then fail only if a control applied before the move is no longer applied on the page it lands on.

3. **Web domain: the failure's reason never reaches the model.** Steps 0023 and 0031 show only `{"ok": false, "code": "action_failed", "attempts": 4}`, with no stop word (`page_fault`) and no fault message. The model repeated the call, which was refused as a repeat at 0027, then described the control and tried again, about $0.015 in all. Fix: carry the next-page answer's `stop` and the fault's own sentence into the LLM tool result's `detail`, as `target_covered` already does with `reason` and `next`. The likely place is the result projection under `domain/src/runtime/llm-evidence/node-run/`; I did not find the exact file. Also, a deterministic `page_fault` was retried 4 times (12 s). Retries are a user rule, so this is only noted.

4. **Core: a brief's allowance ends a builder while the build has money, and a sequenced sibling's share sits idle.**
   - **Cause.** `project-agents/supervisor/brief-sizing.ts` splits what can be given out over `sent + waiting + 1` shares, so 3 here and $0.0769 each. Wave 5 had 1 subflow, so 2 shares and $0.115. brief-2 runs `after` brief-1 and could not start until brief-1 passed, yet its whole share was carved from the start.
   - The purse prices the next call at worst case: every input token a cache miss, at peak rates (08:39 UTC Thursday). For the next builder request, about 52k input tokens at $0.30/M plus an 8000-token reserve at $1.20/M, that is about $0.025. The actual calls were costing $0.001 to $0.002 at about 93% cache hit (0049: 46,848 of 50,222 input tokens cached, $0.00225).
   - The builder therefore stopped with $0.0179 left in its allowance, one test short of a trial of rev 3, while the Flow's purse had $0.184 unspent.
   - **Fix.** Size a brief that is sequenced `after` another brief of the same dispatch when it starts, from what is then left, instead of carving its share at dispatch (`brief-sizing.ts` and `project-agents/dispatch/dispatcher.ts`). Or, alternatively: when an allowance refuses a call, let it draw on the parent purse's unallotted remainder, the finishing share kept back, before refusing (`llm/build-purse/allowance-book.ts`, `purse.ts`). Neither touches the worst-case pricing that `purse.ts`'s header justifies.

5. **Core plan check (contributing): a subflow with no page work is accepted.**
   - `filter_and_list` has no page facts. Its whole job is to narrow, de-duplicate, order and shape `collect_results`'s rows, which a read already does with `where` and `recordOutput.process`.
   - Core flagged it with `project.plan_subflow_constraint`, and the supervisor dismissed the warning (0007).
   - The split moved p2's exclusions out of the reading builder's scope. That is why rev 2 dropped the sponsored and accessory conditions and its trial came back unsure, and why the money was split three ways.
   - **Fix (general, mentions no site).** In `project-agents/supervisor/plan-input.ts`, a subflow whose only inputs are another subflow's dataset and whose parts act on no page is merged into the producing subflow's parts, or refused with that instruction.

6. **Core reporting (not causal): misleading code.** `service/project-build/run.ts:239` reports any ending without a candidate as `flow_bootstrap.post_provider_validation_failed`. Fix: carry the ending's own cause, here the last brief's failure code, in `issueCodes`, or use a dedicated "ended without a candidate" code, so that a person or a debugger is not pointed at a validation failure that never happened.

**Lab:** no Lab defect found. The run used the realistic scenario, the $0.25 ceiling (`--llm-max-cost-usd 0.25`), a clean pinned pair (`dirty: false` on both), and a visible browser was not in question.

## How this differs from wave 5's pass (`run-mv96rz6c-5249e54f`)

| | Wave 5 (pass) | Wave 6 (this run) |
| --- | --- | --- |
| Plan | 1 subflow `find_earbuds` carrying every criterion | 2 subflows; p2's exclusions moved to a subflow with no page work |
| Brief allowance | $0.115 (2 shares); spent $0.060 over 3 trials | $0.077 (3 shares); spent $0.059 over 1 trial, then refused |
| Exploration Next | Succeeded from the same `s?i=all&...` URL (pre-t623) | Failed twice (t623 regression); 6 decisions lost |
| Script | Navigated to `s?k=...`, clicked the Plus filter, read with `where` sponsored absent, plus present, rating ≥ 4, price < 50; 3 pages; 13 rows | Navigated to `s?k=...`, read with plus, rating and price only; 5 pages; 17 rows |
| Trials | no, no, yes; then whole test yes | unsure, then out of money |
| Repair | Not needed | Refused at 0 turns (t622 `yourSubflow` selector) |

## Commands run and observed results

All were read-only.

- `ls`, `cat` and `python -c json` over the run folder (`summary.json`, `run.json`, `snapshots/live-llm.json`, `snapshots/flow-lane.json`, `logs/core.log`) and over steps 0001-0054. This run's core.log shows `decide throw iteration=20 ... code=flow_bootstrap.run_budget_cost_exhausted`, then `decide throw iteration=1 ms=11 ... code=flow_bootstrap.request_refused_evidence_denied_key`, then `completion check ok=true`, then `build throw ... code=flow_bootstrap.post_provider_validation_failed`.
- A Python key walk for denied keys over `0053-tool-core.run_node/result.json` (this run) and `0086-tool-core.run_node/result.json` (social run). It printed 7 and 6 `selector` paths respectively, all under `repairOf/yourSubflow/steps`.
- A Python overlap check of stored rows against `leftOutSettled` names in the 0047 judge request: 17 stored, 33 left out, overlap `[]`.
- Wave 5 comparison: the plan (0007), the dispatch `given` (0010: `allowanceUsd 0.115003`, spent 0.0603), the accepted script (0029), the page URLs (0017 `s?i=all&field-keywords=&k=wireless+earbuds`, 0019 `s?k=wireless+earbuds&page=2`), and the 13 rows in the final judge (0064).
- Code read: Core `brief-sizing.ts`, `build-purse/purse.ts` and `projected-cost.ts`, `deepseek/pricing.ts`, `harness/context-packet.ts`, `evidence-screen.ts` and `draft-screen.ts`, `dispatch/run-brief.ts` and `accepted-subflows.ts` (`git show 73e36120`), `service/project-build/run.ts`. Extension: t623's `applied-controls.ts`, `dropped-state.ts` and `follow-next.ts` (`git show a91219ce`). Scenario: `pages/header.ts`.
- I tried to print the oracle records with `node --experimental-strip-types`. It failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME`, so I used wave 5's 13 oracle-passing rows instead.

## Not verified

- That steps 0023 and 0031 threw `page_fault` from `keepingFollowing`. No extension or content-script log was in the run folder. This is inferred from the code path, the URLs and the store's `<select name="i">`, and from wave 5 following Next from the same URL on pre-t623 code.
- That page link "2" also drops `i`. I saw only its landing URL (0033: `s?k=wireless+earbuds&page=2`), not the pager's `href` list.
- The exact domain file where the LLM tool result drops the next-page `stop` and message.
- Whether a pageless `filter_and_list` subflow could have been built at all.
- The exact projected figure in the allowance refusal. It is not in the step log. The roughly $0.025 is my calculation from the published rates and the last request's size.
- None of the proposed fixes were implemented or tested.

## Open questions or contradictions found

- The wording of Core's check on judge 2's advice ("adds an exclusion the request never states ... a request excludes only what its own words state") contradicts the instruction, which does state the accessory exclusion, in p2, out of this trial's scope. A scoped trial should say "that exclusion belongs to part p2, which is not this subflow's". As written, the recheck judge kept its no anyway, and the builder added the exclusion in rev 3 regardless.
- The step log writes `yourSubflow`'s raw `selector` values into `steps/0053/result.json` (run-local, never sent to a provider). Once the fix withholds them before they reach the evidence, the log copy will be the withheld one too.
- Wave 5 stored no accessory rows without any accessory condition, apparently because the site's Plus filter excluded them, and passed. That is not a basis for any guidance. I record it only as a difference.

# w2-corpus-c: live creation campaign, company directory and social inbox

Lab instance `corpus-c`, real DeepSeek (`deepseek-chat`, profile `lab-create-flow`),
isolated target, 2026-09-17 (UTC 2026-09-18 05:37 to 06:00). No source, test or
Core edits; no commits.

## Outcome

Done. The probe reached DeepSeek with real calls and tokens. All seven batch
tasks ran, and one ambiguous failure was rerun once. **1 of 8 tasks passed**
(`social-inbox-first-screen`, 25/25). No task returned a wrong table while
reporting success. **In every run with a verdict, `reportedVerdict` agreed with
`oracleVerdict`**; runs that built no Flow have neither.

The headline change since the last measurement: FluxIQ now **authors filter
steps** on this fixture. `no-companies` built navigate → click (Independent
retail) → select (size band) → click (Search) → extract, where it previously
returned all 320 rows with no filter step. Every company-directory Flow that was
built then **failed at runtime on the first click, for one reason**. The sector
link has an `href` of `?sector=…`, and FluxIQ's click check expected "navigation
to …?sector=… begins". The fixture's script cancels that navigation
(`preventDefault`) and loads the filtered rows in place
(`apps/scenario-lab/src/scenarios/company-directory/client-script.ts`), so the
check reports `web.validation.output_not_observed` ("the click was prevented and
the location did not change"). That hit 4 of 4 built company-directory Flows. The
failure is honest, not a false success, but none of the record-count questions
could be answered.

## What changed and why

Nothing in the repository changed. Scratch files live only in the session
scratchpad (`corpus-c-*.log`, `corpus-c-analyze.cjs`, `corpus-c-run.cjs`).

Two deviations from the brief's command, both disclosed:

1. The first probe with `--no-build` failed at once with `Cannot find module
   ...\.lab-instances\corpus-c\dist\scenarios\index.js`, because the instance had
   never been built. It made 0 calls. I reran it without `--no-build`, which
   compiles only the scenario lab into `.lab-instances/corpus-c/dist` (it runs
   `tsc` on `apps/scenario-lab`, not Core). The coordinator later confirmed this.
2. That rerun was refused by the Lab: "FluxIQ Core's build is 53 minute(s)
   behind its source". I checked read-only: Core's tree was clean, and the only
   source newer than `dist` came from comment-only commit `4a1b39c` plus a test
   file from `cf176fe`. I then ran the probe once with
   `FLUXIQ_LAB_ALLOW_STALE_CORE=1` **before the coordinator's HOLD arrived**. That
   run (`run-mu6j3qqx-37dcb2b2`: 8 calls, 55,540 tokens, $0.0255, failed with the
   same code as the valid probe below) is **void** and not counted. After the
   supervisor rebuilt Core (newest `dist` file 22:40:33 local, newer than newest
   `src` 22:30:34), I reran the probe with no override. The override was not used
   again.

The seven-task batch ran with `--no-build`. Every `pnpm lab run` still rebuilds
the extension, the shared `domain/dist` (its `clean-dist` step removed 414 files
first) and the test packages under the shared build lock; that is the Lab's own
behaviour.

## Per-task results

Record counts come from `evaluation.json` `extraction[]` (expected / observed /
matched). The Flow shape comes from `snapshots/flow-lane.json` `flowShape.actionTypes`.

| Task | Run | Flow built | Flow actions (type × count) | Records exp / obs / matched | Reported | Oracle | Calls / tokens / USD | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| register-page (probe) | run-mu6j8l11-9e04819e | no | none | 15 / not run | null | null | 6 / 39,357 / 0.0182 | `flow_bootstrap.evidence_unusable_decision` (3× `web.handle.malformed`, expected `extract_list.handle_fields_paginate`) |
| logistics-sector | run-mu6jc98w-e04d569c | yes | navigate 1, click 1, extract_list 1 | 40 / 0 / 0 (not_run; expectedPages 3, pagesFollowed null) | failed | failed | 3 / 21,972 / 0.0100 | `web.validation.output_not_observed`: click prevented, no navigation to `?sector=logistics` |
| logistics-sector-relabelled | run-mu6jekpu-231204c8 | yes | navigate 1, click 1, extract_list 1 | 40 / 0 / 0 (not_run; pagesFollowed null) | failed | failed | 4 / 29,513 / 0.0135 | same as above |
| no-companies | run-mu6jgqqv-c073952f | yes | navigate 1, click 2, select 1, extract_list 1 | 0 / 0 / 0 (**not_run**; no rows returned) | failed | failed | 3 / 21,975 / 0.0101 | same, at the click on `?sector=independent-retail` |
| company-profile | run-mu6jiapp-ce30e137 | no | none | 1 / not run | null | null | 5 / 29,124 / 0.0131 | `flow_bootstrap.evidence_repeat_without_progress` |
| last-page (playback goal) | run-mu6jkba5-5a2aa0d7 | yes | navigate 1, click 1, extract_list 1 | no dataset (extraction `[]`) | failed | failed | 5 / 28,739 / 0.0131 | same click failure on `?sector=logistics` |
| social-inbox-first-screen | run-mu6jm8yg-13c3965a | yes | navigate 1, extract_list 1 | **25 / 25 / 25**; fields 125/125, 0 unexpected | passed | passed | 2 / 14,779 / 0.0068 | none |
| social-inbox-open-conversation (batch) | run-mu6joh10-78c00c64 | no | none | 1 / not run | null | null | 1 / none / $0 | `lab.generation_http_400` |
| social-inbox-open-conversation (rerun) | run-mu6jsegm-00b396cb | yes | navigate 1, select 1, click 1, extract_list 2 | 1 / 0 / 0 (not_run) | failed | failed | 5 / 38,532 / 0.0178 | `web.intervention.required`: select blocked by `reply-scrim`, a Reply dialog open over the page |

Campaign totals: batch 23 calls, 146,102 tokens, $0.0666; valid probe $0.0182;
rerun $0.0178; void probe $0.0255. Everything together cost about $0.128.

## Findings per question in the brief

- **Filter steps authored (click/select/type vs navigate+extract).** Yes, on
  every company-directory Flow that was built. `no-companies` authored a sector
  click, a size-band select and a Search click. No Flow fell back to
  navigate+extract alone on a filter task, and none typed. The first click then
  failed its check, as described above.
- **Why the click check fails.** The check expects a real navigation because the
  target is a link with an `href`. The page is built like many real sites: it
  intercepts the click and updates the results region in place after 150 ms.
  The failure screenshot for `relabelled` still shows "320 companies listed". It
  cannot show whether the filter landed after the check gave up. **Unverified:
  whether the filter was applied.** Verified: the check's expectation
  ("navigation … begins") is one this page can never meet.
- **`no-companies` returns 0.** No rows came back and the Flow reported failure,
  so the earlier "320 rows reported as success" did not recur. Getting the right
  answer, an empty table, was **not demonstrated**: the extraction never ran.
- **`logistics-sector` 40 across 3 pages.** Not measured. Extraction was
  `not_run` and `pagesFollowed` is null.
- **Missing headcounts stay missing (36 companies).** **Not measured.** No
  company-directory extraction ran in any run.
- **`relabelled` reads by heading.** **Not measured**, for the same reason. The
  failure screenshot confirms the variant rendered "Industry" and "Team size" in
  a different column order.
- **`company-profile` invented hostname.** **Did not recur.** There was no
  permission-gate failure, and the model used only `web.inspect_current_page` and
  `web.navigate_same_origin`. It failed differently: its first same-site
  navigation was rejected as `web.action.rejected.no_progress`, two more were
  answered `llm_evidence_loop.already_answered`, and the fourth was rejected as a
  repeat. No Flow was built. The URLs it asked for are not in the bundle.
- **register-page (probe).** Reproduced 2 of 2: the void stale-Core run and the
  valid run. The model inspected the page and detected the repeating structure,
  then sent three extract decisions that Core rejected as `web.handle.malformed`.
  The issue code says the expected shape is `extract_list` with `handle`,
  `fields` and `paginate`. `malformed` covers about a dozen distinct mistakes in
  `domain/src/runtime/llm-evidence/plan-resolution/extraction-slot.ts` and
  `extraction-columns.ts`, and the bundle does not record which one. The model's
  raw output is not retained (`perCallRecords: "not recorded"`). This task alone
  asks for a `url` column holding each company's own page address. **Unverified
  hypothesis:** the attribute/href column shape is what fails.
- **Reported vs oracle verdict.** They agreed on every run that had them:
  failed/failed ×5 plus the rerun, passed/passed ×1. **No disagreement.**
- **A call of 1 with 0 tokens and $0.** Only `open-conversation` in the batch:
  `observed.calls` 1, `accounting` null, cost $0, `providerInvocation` "unknown",
  code `lab.generation_http_400`. The code means Core answered HTTP 400 with a
  body its own diagnostic parser rejects
  (`packages/test-runner/src/flow-lane/creation/build-proposal.ts:166`). The
  build took 47.5 s, longer than one call's 25 s timeout, so this does **not**
  look like an instant local refusal, and whether DeepSeek was reached is
  unknown. A sibling instance rewrote all of `domain/dist` at 22:56:56 to
  22:57:00 local, 24 s after this failure (build settled 22:56:32). That shows
  concurrent rebuilds of the shared `domain/dist` in this window, but not an
  overlap with the failure. The **rerun did not reproduce the 400**, so it is
  most likely environmental, from a single observation.
- **Rerun of `open-conversation`.** It built a 5-node Flow. The Flow failed at
  its first step after navigate: the select was blocked because a Reply dialog
  was open over the page. The fixture opens that dialog only when a row's Reply
  button is clicked, and it starts hidden on every load
  (`apps/scenario-lab/src/scenarios/social-inbox/client-script.ts:255,322`;
  `markup.ts:97`). Nothing in the Flow clicked Reply before that point. The
  build-time exploration used `web.reveal_safe`. **Unverified hypothesis:**
  exploration clicked Reply, and the dialog survived into playback because the
  Flow's navigate "matched" without reloading the page. The Flow stopped with
  `user_intervention_required`. It did not return wrong data.
- **`security.redaction` / `unscanned-store`.** Did not appear in any run. The
  only invariants recorded were `runner-verdict` and `evidence-packet-budget`,
  which passed everywhere it was measured.
- **`ENOENT` inside `domain/dist`.** Did not appear in any attempt log.

## Commands run and observed results

- Probe with `--no-build` → `campaign.usage`: `Cannot find module
  ...\.lab-instances\corpus-c\dist\scenarios\index.js`; 0 calls.
- Probe without `--no-build` → scenario lab built; the Lab refused because Core
  was stale (message quoted above); `noResult`; 0 calls.
- Probe with `FLUXIQ_LAB_ALLOW_STALE_CORE=1` → campaign `2026-09-18T05-38-59-206Z`,
  failed, 8 calls, 55,540 tokens. **Void**, run before the HOLD.
- Probe after the Core rebuild → campaign `2026-09-18T05-42-40-610Z`: `live-llm.json`
  `observed.accounting` = 6 calls, 38,372 in / 985 out / 39,357 tokens, $0.01818,
  `credentialSource` "the process environment". The gate condition was met.
- Batch → campaign `2026-09-18T05-45-02-191Z`: totals `{"tasks":7,"passed":1,
  "succeeded":1,"failed":6,"noResult":0,"judgementsPassed":1,"providerCalls":23,
  "reportedTokens":146102,"reportedCostUsd":0.06655264}`.
- Rerun `social-inbox-open-conversation` → campaign `2026-09-18T05-58-10-713Z`:
  failed, 5 calls, 38,532 tokens, $0.01779.
- `grep ENOENT` over all attempt logs → no hits. Search of the bundles for a
  `security*` invariant or `unscanned-store` → none.

The key was never printed. Only its presence and length were checked in the
first shell.

## Not verified

- Whether the sector-link click actually filtered the page before the check
  failed.
- Every record-count, pagination, missing-headcount and read-by-heading
  question on the company directory. No company-directory extraction ran.
- Which part of the register-page extract decision was malformed. The model
  output is not retained.
- Whether the batch `lab.generation_http_400` reached DeepSeek, and whether it
  was caused by the `domain/dist` rebuild race.
- Where the Reply dialog in the `open-conversation` rerun came from.
- Each failure above rests on a single run, except the register-page malformed
  handle (2 of 2) and the prevented-click check (4 of 4 built Flows).

## Open questions or contradictions found

- The brief said Core was "built and current". It was not at dispatch: comment-only
  commit `4a1b39c` postdated `dist`. The supervisor rebuilt it.
- The brief's probe command used `--no-build` on a never-built instance, which
  cannot work. The coordinator corrected this.
- The brief frames "1 call, 0 tokens, $0" as a local refusal. The one instance
  here took 47.5 s and ended in an HTTP 400 without a parseable diagnostic, so
  that signature is not specific enough to separate a local refusal from a Core
  error that lost the accounting.
- Product defect, observed 4 of 4: a click on an `<a href>` whose page handles the
  click in script is verified as a navigation, which fails on in-place
  filtering and pagination links. That is a common real-site pattern, and it
  blocks every company-directory filter task.

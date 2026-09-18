# w2-corpus-a: live creation run, social scheduler and social inbox

Worker report. Lab instance `corpus-a`, real DeepSeek (`deepseek-chat`,
profile `lab-create-flow`), Core `cf176fe` at `F:\!FluxIQ` rebuilt
2026-09-17 22:40:33 local (quiet, clean), extension repository at `3ba6742`.
2026-09-17 (2026-09-18 UTC).

## Outcome

Done: all nine tasks ran live. One of nine passed its judgement:
`week-ahead-reordered-columns`, 14 of 14 rows. No state-changing job changed
state:

- **No Flow was built** for any of the three schedule-post variants or the
  three answer-mention variants.
- **Both retry-failed Flows** were built and acted (select, click), but
  neither contained the steps a retry needs.
- **`retry-failed-quiet-week` reported success while its oracle failed it.**
  This is the "returned the table and called it done" failure again, now on a
  job that is meant to change state.

## Per-task results

Runs are under `test-runs/instances/corpus-a/`. Record counts come from
`evaluation.json` `extraction[]`. The Flow's action sequence comes from
`snapshots/flow-lane.json` (`flowShape.actionTypes`, plus the `actions[]`
actually executed). Calls, tokens and cost come from
`snapshots/live-llm.json` `observed.accounting`.

| Task | Run | Flow built | Actions executed | Records exp / obs / matched | Oracle / reported | Calls / tokens / USD | What stopped it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| schedule-post | run-mu6jcss9-eaa5de34 | no | none | n/a | not measured / none | 24 / 236,200 / 0.1062 | Four of the model's attempts to press something during exploration were refused (3 `target_unsafe`, 1 `target_unobserved`). Build then ended `flow_bootstrap.evidence_tool_failed` |
| schedule-post-restyled | run-mu6jjaqd-7b0a6861 | no | none | n/a | not measured / none | 13 / 113,101 / 0.0506 | 1 press refused `target_unsafe`, repeated, then build ended `evidence_repeat_without_progress` |
| schedule-post-renamed-composer | run-mu6jmqso-5a41c970 | no | none | n/a | not measured / none | 11 / 91,994 / 0.0412 | Same as restyled: 1 `target_unsafe`, then `evidence_repeat_without_progress` |
| retry-failed | run-mu6jqnkd-cc769d58 | yes: navigate 1, select 2, click 2, extract_list 1 | navigate, select, select, click, **click failed** | 10 / 0 / 0 (extract `not_run`) | failed / failed (agree) | 7 / 57,392 / 0.0264 | Runtime `web.target.ambiguous` on `[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(1) > input`, the row-1 checkbox: "16 scored candidate(s) tied". The Flow has no Retry and no confirm step |
| retry-failed-quiet-week | run-mu6jtzlz-5cd3fbd1 | yes: navigate 1, select 2, click 2, extract_list 1 | all 6 succeeded | 3 / 3 / **0** (9/9 fields present) | **failed / PASSED: disagree** | 7 / 57,497 / 0.0264 | Nothing was retried (see below). FluxIQ reported success anyway. Event: "Extract step extract-retried record 0 does not match" |
| week-ahead-reordered-columns | run-mu6jxr07-39f795a9 | yes: navigate 1, select 2, extract_list 1 | all 4 succeeded | 14 / 14 / 14 (56/56 fields) | passed / passed (agree) | 4 / 30,156 / 0.0139 | Judgement passed. Overall `failed` only from the known `security.redaction` false failure (`.fluxiq/global.sqlite`, `unscanned-store`) |
| answer-mention | run-mu6jzzz2-378a898c | no | none | n/a | not measured / none | 1 / 5,823 / 0.0026 | `evidence_tool_failed` on the model's **first** decision (after the automatic initial inspect). A real call, not a local refusal |
| answer-mention-restyled | run-mu6k12r3-5a6fff4b | no | none | n/a | not measured / none | 3 / 17,764 / 0.0080 | navigate `no_progress`, detect `structure.detected`, then `evidence_tool_failed` on decision 3 |
| answer-mention-moved-send | run-mu6k2dqu-3abc6d48 | no | none | n/a | not measured / none | 2 / 11,841 / 0.0053 | detect `structure.detected`, then `evidence_tool_failed` on decision 2 |

Totals for the counted runs (the probe plus the main campaign) were 72 real
calls, 621,768 tokens and $0.2806. The void run described below adds 23 calls,
230,268 tokens and $0.1040. No run ended with `no-result` and none needed a
retry: every task took 1 attempt, with no RAM-fault retries. There was no
`ENOENT` inside `domain/dist`.

## What happened to the state-changing jobs

**schedule-post (three variants): nothing was scheduled.** No Flow was built,
so no Flow ran.

- The fixture ships the composer `hidden`. It opens only through the page's
  plain "New post" button (`<button type="button" data-action="new-post">`,
  with no `aria-expanded`).
- While building a Flow, the model has only four tools: inspect the page,
  navigate within the site, reveal, and detect a repeating structure
  (`WEB_LLM_EVIDENCE_TOOL_IDS` in
  `domain/src/runtime/llm-evidence/vocabulary.ts`). None of them presses an
  ordinary button.
- The reveal tool's allowlist (`safeRevealElement` in
  `domain/src/runtime/llm-evidence/reveal.ts`) accepts only a `<summary>`, a
  button marked as a disclosure, or a tab, menu item or tree item. It also
  refuses anything whose wording includes submit, confirm, send or publish.
- So the model can see the "New post" button but can never open the composer,
  never sees its fields, and cannot write the type and select steps.

Across the three runs, 5 of the 6 refused presses were `target_unsafe`, meaning
the element **was** in the packet and the safety rule refused it. Only 1 was
`target_unobserved`. **The flood of row checkboxes in the element packet is not
what stopped schedule-post. The reveal allowlist is.** The bundle does not keep
per-decision targets (`perCallRecords: "not recorded"`), so I cannot prove
every refused press was aimed at "New post". It is the only control that opens
the composer.

**retry-failed (both variants): nothing was retried.**

- In the fixture a retry takes three steps: tick rows or "Select all" in the
  header; a bulk toolbar then appears with a **Retry** button; then confirm in
  a dialog (`client-script.ts` `renderBulk` and `openRetryDialog`).
- The fixture's comment says nothing else can put a post into "Queued", and
  the expected records carry that post-retry status.
- The Retry button does not exist until a row is ticked, and exploration
  cannot tick one: a checkbox is not a disclosure, tab or menu item. So the
  model never saw Retry or the dialog in any packet, however the packet was
  composed.

Both Flows had exactly two clicks and then the extract. That is too few for
any retry path (select, Retry, confirm), so neither could have committed a
retry.

In the plain variant the second click was the row-1 checkbox, targeted by
position, and the runtime refused it as ambiguous. That is where the row
checkboxes did bite. Every evidence packet in that run was at the cap and
truncated (5,796 to 5,983 bytes, `truncated: true` at every capture point).

In quiet-week, with fewer rows, both clicks resolved. The Flow read back the
3 failed rows with all 9 fields present but 0 matched. That fits the rows
still reading "Failed" rather than "Queued". This is an inference: the bundle
does not keep the extracted values. FluxIQ reported that run `passed`.

**answer-mention (three variants): no reply, nothing marked handled.**

- The build ended after 1 to 3 model decisions with `evidence_tool_failed`.
  In Core's `llm/evidence-loop.ts` this means the domain's `executeTool` threw,
  or returned a result that is not valid JSON. It is not a provider error: the
  `provider_output_validation` / `httpStatus 400` fields are only the
  category's mapping.
- The failing call is not in the recorded steps, which list only completed
  tools, so which tool threw is unknown.
- The inbox's Send is `data-action="send"` inside a reply dialog. "send" is a
  committing word, so reveal would refuse it anyway. None of the three runs got
  as far as trying.

The real schedule-post probe also ended on `evidence_tool_failed`, after 24
decisions.

## Verdict disagreements

- **`social-scheduler-retry-failed-quiet-week`: reportedVerdict `passed`,
  oracleVerdict `failed`.** FluxIQ told the user the job succeeded. The
  retried table matched 0 of 3 rows, and no retry was performed.
- Every other run with a measured oracle agreed: retry-failed failed/failed,
  week-ahead-reordered-columns passed/passed.

## Locally refused calls

None. Every run's `observed.calls` had non-zero tokens and cost. The smallest
was answer-mention: 1 call, 5,823 tokens, $0.0026, a real DeepSeek call.

## What changed and why

No source, test, Core or build-configuration change. The only files written
are this report and scratch files in my session scratchpad
(`corpus-a-*.log`, `corpus-a-extract.cjs`, `corpus-a-rows.ndjson`). The Lab
itself built `corpus-a`'s own copies under `apps/scenario-lab/.lab-instances/corpus-a`,
`apps/extension/.lab-instances/corpus-a` and `domain/.lab-instances/corpus-a`,
all ignored instance outputs.

## Commands run and observed results

All runs used the brief's environment: `DEEPSEEK_API_KEY` exported from
`.env.local` (never printed; presence checked only),
`FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_TEST_TARGET=isolated` and
`FLUXIQ_LAB_INSTANCE=corpus-a`. Output was redirected to scratch logs.

1. `pnpm lab:campaign --no-build social-scheduler-schedule-post` failed at
   once with `Cannot find module ...\.lab-instances\corpus-a\dist\scenarios\index.js`.
   A fresh instance has no catalog. No calls were made.
2. `pnpm lab:campaign social-scheduler-schedule-post`, without `--no-build`,
   built the instance catalog. The Lab's guard then refused: "FluxIQ Core's
   build is 53 minute(s) behind its source:
   ...result-verification\index.ts". Campaign `2026-09-18T05-37-24-930Z`:
   noResult, 0 calls.
3. **Deviation, now void.** I read Core's git state (clean at `cf176fe`). The
   only non-test sources newer than dist were the two files of `4a1b39c`, a
   comment move, and `cf176fe` changes a test only. I then reran with
   `FLUXIQ_LAB_ALLOW_STALE_CORE=1`: campaign `2026-09-18T05-38-18-881Z`, run
   `run-mu6j31g0-92f5f29e`, 23 calls, 230,268 tokens, $0.1040, failed with no
   Flow and `evidence_tool_failed`. The coordinator's correction, that the
   override is not acceptable, arrived after this run had finished. I did not
   use the override again, and this run is **not** counted anywhere above.
4. I waited until Core's dist was newer than
   `result-verification/index.ts`. The newest dist file was 22:40:33 local,
   unchanged over 20 s, and no non-test source was newer. Then the real
   probe: `pnpm lab:campaign social-scheduler-schedule-post`. The guard
   reported `"state":"quiet"` with newest `2026-09-18T05:40:33.378Z`.
   Campaign `2026-09-18T05-46-03-187Z`: failed, 24 calls, 236,200 tokens,
   $0.1062. `live-llm.json` confirmed real calls with non-zero tokens.
5. The main run, `pnpm lab:campaign --no-build` with the 8 remaining task ids,
   was campaign `2026-09-18T05-50-53-606Z`. Totals:
   `{"tasks":8,"passed":0,"succeeded":0,"failed":8,"noResult":0,"judgementsPassed":1,"providerCalls":48,"reportedTokens":385568,"reportedCostUsd":0.17445384}`.

## Not verified

- **Which element each refused press targeted, and which tool threw in the
  `evidence_tool_failed` builds.** The bundle keeps no per-decision records,
  and failed tool calls are not added to the recorded steps. I did not open
  the isolated workspace's store to look.
- **What the first click of each retry Flow targeted, and the extracted cell
  values.** The Flow document and the dataset values are not in the bundle.
  "The quiet-week rows still read Failed" is inferred from 0 of 3 matched
  with 9 of 9 fields present, plus the fixture's rule that only a retry makes
  a post Queued.
- **The fixture's final state for the playback-goal tasks.** It was never
  judged, because no Flow ran.
- **Repeatability.** Each task ran once, so every finding rests on a single
  observation. The machine's RAM fault means a single run carries an error
  bar, though none of these failures has the uniform or impossible signature
  of that fault.
- **Live browser behaviour outside the Lab.** Not exercised.

## Open questions or contradictions found

- **The brief said Core was "built and current". It was not:** the build was
  53 minutes stale by one comment-only commit. The supervisor has since
  rebuilt it.
- **The brief's `--no-build` fails on a fresh instance.** The coordinator
  corrected this mid-task.
- **The exploration toolset cannot reach state-changing controls.** For
  creation tasks, the model has no tool that presses a plain button or ticks
  a checkbox. So it can never observe what follows those controls: a hidden
  composer, a bulk toolbar that appears after selection, a reply dialog.
  Every state-changing task in this set needs one of them. This, and not the
  packet flood, is the first wall these tasks hit.
- **Answer-mention and the scheduler probe end on `evidence_tool_failed`:**
  a tool execution error, not a refusal. It is worth finding which tool
  throws. On the inbox it happens on the first or second decision.
- **A success can still be reported on a state-changing job that did
  nothing:** quiet-week reported `passed` against oracle `failed`.
- **`run.json` records the facility repository as `dirty: true`.** At the time
  the only change was a sibling worker's untracked `reports/w2-corpus-b.md`.

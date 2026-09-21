# w2 multi-action live A/B

## Outcome

Paused without an acceptance A/B. No valid baseline/variant comparison was
attempted or passed. Two inherited-environment failures were diagnosed before
provider use, one baseline accidentally used the wrong instruction task and is
preserved only as non-acceptance evidence, and the corresponding wrong-task
variant was interrupted before a completed provider call was recorded. The
correct task is `social-scheduler` with instruction task
`social-scheduler-schedule-post`.

The intended same-code pair remains unspent and must not run until the
supervisor re-dispatches it after remediation/review. Manual panel ports 3000
and 4711 were not touched. No product source, Core source, user store/profile,
or repository configuration was edited.

## Source and intended command contract

- Downstream source: `fab7cba2ef7eadcfa1b01dd5e6af7f48437d473a`.
- Core source: `0dbf62ff30401e7a7a931f3c4758f7d62d88fd93`.
- Intended scenario/task: `social-scheduler` /
  `social-scheduler-schedule-post`, seed 171, isolated target, checkpoint
  evidence, DeepSeek `deepseek-chat`, `create-flow`.
- Intended sole arm difference: run-scoped
  `--llm-max-actions-per-decision 1` then `16`, each from fresh state.
- Intended per-arm limits: 48,000 input, 8,000 output, 56,000 request-total,
  26 calls, 560,000 run-total tokens, 25,000 ms, zero retries, $0.25 per call,
  and $1 total estimated cost.

## Pre-provider environment failures

1. The first baseline command stopped at target resolution because the loaded
   Lab environment selected `existing` while the CLI explicitly selected
   `isolated`. It did not start the browser or provider and spent zero calls.
2. A process-local launcher then loaded the existing Lab environment, removed
   the existing-target URL/ID selectors in memory, and selected `isolated`.
   Run `run-muaqvrj5-97d480b5` reached `scenario.execute` but failed FluxIQ
   authentication with HTTP 401 because existing-install credentials were
   still inherited. It persisted no Flow, executed no actions, recorded zero
   provider calls, and ended after 57,465 ms. The correction was to remove the
   complete existing-target credential set and shared runs-directory selector
   in the disposable process environment; no file was changed.

## Wrong-task baseline: non-acceptance evidence

Run `run-muaqywrp-1b95a3d5` used `social-scheduler-week-ahead`, not the intended
field-entry task. Source inspection confirms that task is
`navigate-and-extract` with expected dataset `extract-week-ahead`; therefore
its navigate/select/select/extract-list trace and 14-row result cannot satisfy
the multi-action acceptance oracle.

- Reported verdict: passed for that wrong task; duration 77,749 ms.
- Flow was created and executed through the production extension.
- Ordered actions: `web.browser.navigate`, `web.dom.select`,
  `web.dom.select`, `web.dom.extract_list`.
- Wrong-task deterministic oracle: 14/14 records and 56/56 fields, with no
  unexpected fields.
- Provider accounting: five total calls reported by the final evaluation;
  the build snapshot records four build calls, 41,622 input tokens, 645 output
  tokens, 42,267 total tokens, and $0.01916508 estimated build cost. The fifth
  call was associated with one diagnosis-only harness intervention; no runtime
  patch or adaptation was applied.
- The issued snapshot granted 26 calls, 560,000 run tokens, 25,000 ms,
  $0.25/call, and **$2 total**, not the intended $1 total. This independent
  grant mismatch also makes the run inadmissible as an A/B arm.

No raw extracted values, field values, page evidence, credentials, or tokens
are recorded here.

## Interrupted wrong-task variant

The subsequently launched `maxActionsPerDecision=16` process still named the
wrong `social-scheduler-week-ahead` task. It was stopped immediately on the
supervisor's mismatch warning and is preserved as staging run
`run-muar1lps-309794ed`.

- Its staging bundle contains only the initial `runtime.dispatch` event.
- Its isolated database contains one blank Flow with zero nodes and zero
  edges, zero linked runs, and zero linked adaptations.
- It contains no provider usage, decision trace, completed provider call, or
  persisted result: exact recorded provider calls are zero.
- Because the process was force-stopped rather than finalized, an outbound
  request that was in flight but never recorded cannot be ruled out. It is not
  counted as an A/B arm and no retry was made.

## Corrected task and stop condition

The exact corrected CLI pair is scenario `social-scheduler` with instruction
task `social-scheduler-schedule-post`. It is the form/playback-goal task that
opens the composer, enters the post/account/date/time fields, submits, and
confirms the queue result; this is the task whose adjacent stable
`web.enter_field` actions can exercise the intended list decision.

Before that corrected pair was launched, the supervisor paused live spending
after an independent review found three product blockers: whole-list
action/repeat admission, domain-result-code refusal stopping, and schema
validator `uniqueItems` support. Those findings were not revalidated in this
worker turn. The correct disposition is **defer the A/B until remediation and
explicit re-dispatch**, while retaining all runs above strictly as diagnostic
non-acceptance evidence.

## Validation and scope

- Observed the two environment failures and the wrong-task baseline live.
- Verified scenario/task ownership directly in the current instruction
  catalog and social-scheduler manifest.
- Inspected only sanitized bundle/accounting metadata and categorical isolated
  state; no raw page or field values were emitted.
- Ran no broad suite, provider retry, corrected A/B, commit, or push.

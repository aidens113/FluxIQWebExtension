# Report: t741-c1-retry

## Outcome

Partial. Picking which attempt answers is done and tested: a press the site refused for now, whose
later attempts failed only because the control was gone, now reaches the model as
`page_busy_try_later` with `attempts: 4`. The node's result keeps the refusal's own record, with
`retryAfterMs` and the extension's words about returning the tab. The model packet still does not
carry the retry-after or the tab-return fact. Nothing in the domain puts either on a packet today:
`WebLlmToolRejectionDetail` and `rejectionDetail` in `llm-evidence/tool-rejection.ts`, and
`webActionFailureRefusal` in `action-failure/refusal.ts`, have no field for them. I do not own those
files, so I did not change them. `click-landing.ts` already puts `retryAfterMs` on its RATE_LIMITED
record (around line 552), so it needed no change.

## What changed and why

- New `domain/src/runtime/llm-evidence/node-run/retries/answer.ts`, which exports
  `webNodeRetriedAnswer(answers, last)`. Rule: if some attempt failed `RATE_LIMITED` and every attempt
  after it failed only with `TARGET_NOT_FOUND`, `TARGET_NOT_SHOWN` or `TARGET_NOT_ACTIONABLE`, the
  latest such refusal answers. A failure whose `actual` starts with `covered:` does not count, because
  the control is still there. In every other case the last attempt answers: a success, a timeout,
  another code in between, the refusal as the last attempt, or every attempt not shown.
- `retries/dispatch.ts`: the dispatch callback now records each attempt's answer. When Core settled
  no lasting act (`lastingAct === undefined`), the result is `webNodeRetriedAnswer(answers,
  outcome.result)`. `attempts` is still Core's total. A lasting act Core settled as `landed` or
  `uncertain` keeps Core's answer. Both callers (`run.ts`, `replay.ts`) get the change, because both
  go through this function.
- `retries/index.ts`: added the barrel export for the new file (one line).
- Tests: `retries/tests/answer.test.ts` (new, unit) and three new cases in
  `retries/tests/dispatch.test.ts`. They use a fake gateway on a library catalogue page with an
  "Available now" filter link. Attempt 1 is RATE_LIMITED with a 5 s retry-after and the tab returned;
  attempts 2-4 are TARGET_NOT_SHOWN.
  - The model packet has `code: refused_by_page`, `detail.reason: page_busy_try_later`,
    `resultReason: page_busy_try_later`, `attempts: 4`, and there were 4 presses.
  - Calling `webNodeDispatchWithRetries` directly returns the RATE_LIMITED record with
    `retryAfterMs: 5000`, the tab-return `actual` text, and `attempts`/`noted.attempts` of 4.
  - When all four attempts are TARGET_NOT_SHOWN, the answer is still `target_not_actionable`, after
    4 attempts.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t741-c1-retry node scripts/test-domain.mjs node-run/retries/tests`
  printed `# tests 45  # pass 45  # fail 0`.
- Test-first check: I temporarily set dispatch.ts back to `outcome.result` and ran
  `... test-domain.mjs node-run/retries/tests/dispatch`. It printed `# pass 9  # fail 2`; the failures
  were tests 9 and 10, the two refusal cases, while the all-not-shown case passed. I then restored the
  file and confirmed the `webNodeRetriedAnswer(answers` line was back.
- `... test-domain.mjs node-run/tests/replay node-run/press-effect/tests` printed
  `# tests 142  # pass 142  # fail 0`.

## Not verified

- No typecheck (the shared rules forbid it); the domain test build compiled these files.
- No live run, and no replay of job 0116.
- Core's repeat guard was not exercised. I relied on the brief's statement that it exempts
  `page_busy_try_later`.
- In the live job, attempts 2-4 reached the model as `target_not_actionable`. That could come from
  either TARGET_NOT_SHOWN or TARGET_NOT_ACTIONABLE (not covered); both are handled. I did not check
  which code the raw failure records carried.

## Open questions or contradictions found

- The brief asks for the retry-after to be said and for the model to learn the tab was taken back.
  Neither reaches the model for any RATE_LIMITED failure today, a single attempt included. Doing it
  needs a field such as `retryAfterMs` (and perhaps `tabReturned`) on `WebLlmToolRejectionDetail`
  (`tool-rejection.ts`), set in `webActionFailureRefusal` (`action-failure/refusal.ts`) from
  `failure.retryAfterMs`. That is model-facing schema, so a prompt pin may move. The lead needs to
  assign it to the owner of those files.
- `retries/index.ts` is not in my Owns list. I added one export line there because the barrel rule
  requires it for the new file.

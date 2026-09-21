# Unified Decision No-Progress Completion Feedback

Status: Bounded repeat feedback implemented; live attempt failed before evidence-loop entry
Updated: 2026-09-20
Owner: `w2-unified-no-progress-completion`

## Result

The previous feedback-only run completed a successful four-action batch, then
asked for the same current-page observation until the no-progress guard stopped
it. I strengthened only Core's bounded already-answered/already-observed text so
a provider is told explicitly that:

- the prior result is already present immediately before the feedback;
- an unavailable observation is absent from the current decision schema;
- repeating or rephrasing the same request will stop the loop;
- it should complete immediately when existing evidence is sufficient; and
- otherwise it should choose a currently offered tool with materially different
  input only for a specific fact still missing from the final result.

The no-progress counter, guard threshold, decision schema, batch coordinator,
permission checks, execution, evidence movement, and completion handling are
unchanged.

The single permitted live attempt failed on its first provider request with
sanitized `lab.generation_http_400`. No evidence loop existed, so the new
feedback was never delivered and cannot be evaluated from this run. Per the
live-first gate, no focused tests or retry followed.

## Source change

Existing isolated pair:

- downstream: `F:\fxlab\t027-unified-decision\!FluxIQWebExtension`;
- Core: `F:\fxlab\t027-unified-decision\!FluxIQ`.

One additional Core file changed:

- `runtime/llm/evidence-loop.ts`: only the two constant strings under
  `ANSWERED_REQUEST` were strengthened.

This file already carries the unified provider-decision experiment. The
feedback-only completion sentence remains in
`runtime/llm/harness-options/bootstrap-completion.ts`; the Flow-script format
remains byte-identical to base. Batch schema/executor/safety files were not
changed for this unit.

The feedback remains content-free and bounded: it is constant Core-authored
text beside existing closed codes, tool id, answered-by call id, and numeric
progress counters. It adds no prompt, tool input, page evidence, selector, or
provider output.

## One-shot live attempt

- Run: `run-muaj50u8-77eb29bf`
- Scenario/task: `social-scheduler` / `social-scheduler-schedule-post`
- Browser/target: isolated Chromium
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: 16
- Started: `2026-09-21T00:52:12.733Z`
- Build settled: `2026-09-21T00:53:49.619Z`
- Evaluated duration: 141,141 ms
- Build duration: 92,694 ms
- Evaluator provider-call observation: 1
- Build accounting/provider calls: absent
- Provider invocation classification: `unknown`
- Failure: `lab.generation_http_400`, HTTP 400
- Evidence loop: absent (`null`)
- Flow created: false
- Browser actions: 0
- Reported verdict / oracle: absent / absent
- Harness interventions: 0

Because `build.evidenceLoop` is `null`, this is neither a zero-batch decision
trace nor evidence about completion behavior. No provider decision was accepted
and no repeat feedback could be shown.

## Interpretation

The initial request shape in this attempt is the same as the immediately prior
feedback-only run: `ANSWERED_REQUEST` text is added only after a repeated tool
decision and is not serialized into the first request. The prior run entered
the provider for twelve decisions; this one failed before entry. That contrast
is evidence that the pre-decision HTTP 400 is not determined solely by the
initial candidate bytes. The sanitized artifact still exposes no provider
response explanation, so no narrower cause is claimed.

## Validation and stop rule

- `pnpm --filter fluxiq build`: passed before live execution.
- Live attempt: failed at the exact boundary above.
- `git diff --check`: passed for the isolated Core diff and this report, apart
  from Git's existing Windows LF-to-CRLF warnings.
- No focused tests ran because live behavior did not pass.
- No broad suite, extra live retry, downstream edit, commit, merge, or push was
  performed.

## Handoff

Keep the strengthened repeat feedback isolated and unclaimed: its behavior was
not exercised. The unified candidate still has positive multi-action adoption
evidence from earlier attempts, but no single attempt has yet combined a batch,
completion, Flow creation/application, playback, and a passing oracle.

No secrets or page content are included in this report.

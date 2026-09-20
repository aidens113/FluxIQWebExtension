# t027 ordered-batch live Chromium safety

Status: focused live spec passes; two projection gaps identified  
Date: 2026-09-20  
Worker: `w2-t027-batch-safety-spec`

## Outcome

Added the one owned live spec:
`apps/extension/e2e/content/tests/exploration-state/tests/multi-action-safety.spec.ts`.
It uses Core's production evidence loop, the downstream production web evidence
runtime, the real content script, and Scenario Lab pages in Chromium.

The focused run passed all five rows. It proves:

- two stable field-entry mutations continue in order in one batch;
- opening the scheduler composer stops the listed next observation with
  `targets_may_have_changed`;
- an unknown observed-target handle stops the listed next observation with
  `action_refused`;
- an admin-console same-document navigation stops the listed next observation
  with `targets_may_have_changed`;
- a real modal intervention refuses the browser click and the listed next
  observation does not run.

Every stop row asserts the executed Core trace (where one exists) and the exact
browser command sequence, so absence of the later action is observed rather
than inferred. The positive row asserts both batch positions, both real browser
field operations, and the resulting DOM values.

## Contract gaps found

The intervention reaches the content script and reports
`web.intervention.required`, and the later call is safely not executed. The
web evidence gateway then represents the failed browser interaction by throwing
`web evidence interaction failed`; Core returns
`llm_evidence_loop.tool_failed`. Consequently there is no batch trace step and
no `batch.stoppedBy: action_refused` projection for the UI/Lab to inspect. The
spec asserts this exact current behavior and names the gap; changing it requires
production runtime ownership outside this brief.

The requested distinct `effect_not_applied` browser row is not constructible
through today's production web evidence tools. Successful web mutations always
return `effectApplied: true`. Recoverable mutations return `{ok:false}` and are
classified first as `action_refused`; other failed content actions throw and
become `llm_evidence_loop.tool_failed`. A live `effect_not_applied` row needs a
production contract change that returns a non-refusal mutation execution with
`effectApplied: false`. I did not fabricate that result in the gateway.

## Verification

Command:

```text
pnpm --filter @fluxiq-web-extension/extension test:content -- exploration-state/tests/multi-action-safety.spec.ts --workers=1
```

Result: `5 passed (29.8s)` in Chromium.

No provider call, full suite, commit, push, or production/Core/test-runner edit
was made. The first exploratory run exposed four assertion/fixture mismatches;
after correcting the selectors/result code and using the admin console's
same-document navigation, the exact focused command above passed.

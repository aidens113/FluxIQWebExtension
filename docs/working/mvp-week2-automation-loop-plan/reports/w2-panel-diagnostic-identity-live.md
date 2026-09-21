# Panel Diagnostic Identity Live

Status: Reporter masking fixed and live-proved; true terminal category exposed
Updated: 2026-09-20
Owner: `w2-panel-diagnostic-identity-live`

## Result

The downstream failure-evidence adapter no longer masks a valid sanitized Core
failure when a tool/result diagnostic would exceed the recorder's 64-character
identity bound. A focused regression test passed, and one fresh real-panel run
preserved the complete categorical failure sequence through the final
generation-rejected checkpoint.

The true live terminal result was
`flow_bootstrap.evidence_repeat_without_progress` in provider-output
validation. The run recorded two read-only evidence outcomes in order:

1. `web.inspect.succeeded`;
2. `web.action.rejected.no_repeating_structure`.

No proposal or persisted bootstrap audit was created, so a 2+ action batch is
not proved. Per the brief, I stopped without review/apply/playback/oracle or a
provider retry.

## Isolation

- Downstream: `F:\fxlab\t027-panel-unified\!FluxIQWebExtension` at base
  `e2718ccd0eabfaeab1c505267316b42c4e0616c9`, with only the two authorized
  downstream diagnostic/test files changed.
- Core: `F:\fxlab\t027-panel-unified\!FluxIQ` at base
  `949735d22839574a0437de0457802fb6216472a0`, retaining exactly the unchanged
  two-file unified-decision candidate.
- Fresh run root: `F:\fxlab-runs\t027-panel-diagnostic-live`.
- Headed production Chromium panel on isolated ports `3377` / `4947`; both
  ports closed afterward. Port `3000` and user panel/profile/store data were
  untouched.
- Same registered `product-catalog-photos` task and public Scenario Lab
  instruction as the live reproduction.

Provider credentials and test identity values remained process-local. No raw
provider output, page content, selector, tool input, field value, screenshot,
or recorded browser state was inspected or included.

## Root cause and repair

The live-first reproduction had already shown HTTP 400 after one safely
recorded tool result, followed by `Evidence diagnostic identity is invalid`.
The adapter built each tool-result diagnostic code by concatenating its bounded
tool id and bounded result code. Two individually valid identifiers can exceed
the evidence recorder's 64-character combined limit, causing the reporter to
throw while reporting the real Core failure.

The repair is confined to
`packages/test-runner/src/demo-llm-create-ui/exploration-failure-evidence.ts`:

- keep the bounded result code as the tool-result category, falling back to
  the bounded tool id when no result exists;
- validate issue and reason identities before passing them to the recorder;
- use fixed categorical fallbacks for any future sanitized value that does not
  meet the recorder's identity contract.

The generic evidence recorder remains fail-closed. Core, provider prompts,
schemas, execution, and product behavior were not changed.

## Focused validation

After the existing live reproduction and repair:

- test-runner build: passed;
- directly owned `exploration-failure-evidence.test.js`: 3/3 passed;
- added coverage constructs a published tool/result pair whose concatenation
  exceeds 64 characters and proves the result category plus final Core reason
  are both retained without a recorder exception;
- `git diff --check`: passed.

No broad or full suite was run.

## One post-repair live attempt

- Evidence run: `demo-llm-explore-2026-09-21T01-22-18-918Z-84250d`.
- Evidence interval: 31.064 seconds.
- High-token confirmation interval: about 19.3 seconds.
- Production panel generation response: HTTP `400`, `responseOk: false`.
- Visible generic error: absent.
- Sanitized Core category: `generation.provider-output-validation`.
- Sanitized terminal reason:
  `flow_bootstrap.evidence_repeat_without_progress`.
- Provider invocation accounting: `1`.
- Evidence iterations / decisions / tool calls: `4 / 5 / 2`.
- Evidence bytes / trace steps: `7,005 / 2`.
- Effect-applied results: zero; both outcomes were read-only/non-mutating.
- Proposal and bootstrap adaptation: absent.

The runner's public failure now reports
`Evidence-guided Flow generation failed (generation.provider-output-validation)`
instead of `Evidence diagnostic identity is invalid`. The retained evidence
also carries the more specific allowlisted terminal reason above. This meets
the diagnostic brief: the reporter does not replace Core's terminal result,
and the actual bounded category is durable.

## Acceptance and handoff

| Gate | Result |
| --- | --- |
| Reporter accepts every sanitized live diagnostic | Passed |
| True provider-output category retained | Passed |
| Specific allowlisted Core reason retained | Passed |
| Completed 2+ action batch | Unproved; no persisted bootstrap audit |
| Proposal/apply/playback/oracle | Not reached after terminal failure |

No second provider attempt, unrelated edit, full suite, commit, merge, or push
was performed. The downstream two-file diagnostic repair is live-proved and is
safe to review for integration independently of the still-isolated unified
Core candidate.


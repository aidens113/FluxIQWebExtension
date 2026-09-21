# Panel Unified Progress Live

Status: Narrow guidance produced no live progress; candidate remains isolated
Updated: 2026-09-20
Owner: `w2-panel-unified-progress-live`

## Result

One bounded Core evidence-loop guidance change was tested through the real
production panel. The run reproduced the exact previously exposed sequence:

1. `web.inspect.succeeded`;
2. `web.action.rejected.no_repeating_structure`;
3. `flow_bootstrap.evidence_repeat_without_progress`.

The evidence iterations, decisions, tool calls, evidence bytes, and terminal
category were identical to the preceding diagnostic run. No proposal or
persisted bootstrap audit existed, so no completed 2+ action batch was proved.
The brief's live-progress gate failed; I stopped without focused prompt tests,
provider retry, review/apply/playback, or oracle execution.

## Isolated candidate

- Downstream: `F:\fxlab\t027-panel-unified\!FluxIQWebExtension` at base
  `e2718ccd0eabfaeab1c505267316b42c4e0616c9`, retaining the live-proven
  diagnostic adapter and focused test from the preceding unit.
- Core: `F:\fxlab\t027-panel-unified\!FluxIQ` at base
  `949735d22839574a0437de0457802fb6216472a0`, retaining the unified decision
  schema plus this guidance experiment.
- Fresh run root:
  `F:\fxlab-runs\t027-panel-unified-progress-live`.
- Headed production Chromium panel on isolated ports `3381` / `4951`; both
  ports closed after the attempt. Port `3000` and user panel/profile/store data
  were untouched.
- Registered fixture/task: `product-catalog` / `product-catalog-photos`.

Provider credentials and test identity values stayed process-local. No raw
provider output, page content, selectors, tool inputs, field values,
screenshots, or recorded browser state were inspected or included.

## Narrow change

Only the constant provider guidance in Core
`runtime/llm/evidence-loop.ts` changed on top of the existing unified
candidate. It now says:

- when multiple independent read-only observations are already identifiable
  from current evidence, put them in one calls list instead of spreading them
  across decisions;
- after `web.action.rejected.no_repeating_structure`, do not repeat or rephrase
  structure detection; choose a different observation for a specific missing
  fact or complete from current evidence.

No schema, parser, batch coordinator, executor, permission/target safety,
completion output format, no-progress threshold, downstream runtime, or panel
behavior changed. Core rebuilt successfully before the live attempt.

## One live attempt

- Evidence run: `demo-llm-explore-2026-09-21T01-30-08-702Z-bc7b5e`.
- Evidence interval: 38.999 seconds.
- Production generation response: HTTP `400`, response not OK.
- Visible generic panel error: absent.
- Provider invocation accounting: `1`.
- Evidence iterations / decisions / tool calls: `4 / 5 / 2`.
- Evidence bytes / trace steps: `7,005 / 2`.
- Recorded outcome 1: `web.inspect.succeeded`, non-mutating.
- Recorded outcome 2: `web.action.rejected.no_repeating_structure`,
  non-mutating.
- Terminal category: `generation.provider-output-validation`.
- Specific reason: `flow_bootstrap.evidence_repeat_without_progress`.
- Proposal, adaptation, and batch audit: absent.

Compared with the preceding run, all categorical and count fields above are
the same. The provider did not combine the two observations into one proved
batch and did not choose a different observation or completion after the
no-structure answer.

## Validation and handoff

- Core `fluxiq` build: passed before live execution.
- `git diff --check`: passed, with only Git's existing Windows LF-to-CRLF
  warnings on the two Core candidate files.
- Focused prompt tests: not run because the live behavior did not progress.
- No broad/full suite, second provider attempt, apply/playback/oracle, commit,
  merge, or push was performed.

The guidance experiment remains isolated and unproven. The downstream
diagnostic adapter continues to work: it retained both tool outcomes and the
exact Core terminal reason without masking them.


# Panel Unified Batch Task Live

Status: Live generation failed after one read-only action; no batch audit or proposal was produced
Updated: 2026-09-20
Owner: `w2-panel-unified-batch-task-live`

## Result

The one real production-panel attempt reached explicit high-token confirmation
and entered the evidence loop. One `web.inspect_current_page` action succeeded,
then the generation endpoint returned HTTP 400 before a proposal or bootstrap
adaptation was persisted. The bounded failure reporter recorded that first tool
result but then rejected a later sanitized diagnostic identity, replacing the
underlying structured reason with `Evidence diagnostic identity is invalid`.

Because there is no persisted `batchDecisions` audit and no proposal, the
required completed 2+ action batch is not proved. I stopped at this first exact
terminal outcome. There was no provider retry, review/apply/playback/oracle, or
test run.

## Candidate and task choice

- Reused unchanged paired candidate:
  - downstream `F:\fxlab\t027-panel-unified\!FluxIQWebExtension` at
    `e2718ccd0eabfaeab1c505267316b42c4e0616c9`;
  - Core `F:\fxlab\t027-panel-unified\!FluxIQ` at
    `949735d22839574a0437de0457802fb6216472a0`.
- Core remained modified in exactly the two unified-decision files,
  `runtime/llm/evidence-batch/schema.ts` and `runtime/llm/evidence-loop.ts`.
  No completion-format, feedback, no-progress, or new source edit was present.
- Fresh disposable run root:
  `F:\fxlab-runs\t027-panel-unified-task-live`.
- Headed production Chromium panel on isolated ports `3373` / `4943`; both
  ports were closed afterward. Port `3000` and user panel/profile/store data
  were untouched.

The selected registered task was `product-catalog-photos` on the
`product-catalog` fixture. It is a read-only extraction goal that asks for both
repeating product-card facts and image-specific attributes, making independent
page/structure inspection a natural evidence need. The exact instruction came
from the existing Scenario Lab catalog; no synthetic prompt or fixture change
was introduced. Provider-free request readiness passed for the registered
scenario, exact origin, bounded grant, and manual-review requirement.

## Live evidence

Prerequisites in the fresh workspace passed:

- Secret Keys UI configuration and redaction attestation, with zero findings;
- blank-workspace preparation through the production panel;
- provider-free request readiness, with zero provider calls.

The single provider-bearing attempt was:

- evidence run: `demo-llm-explore-2026-09-21T01-12-57-953Z-79faa5`;
- evidence interval: 50.895 seconds;
- confirmation-to-terminal interval: about 29.2 seconds;
- headed production panel and loaded production extension;
- high-token confirmation attempted for the bounded 560,000-token run grant;
- generation response: HTTP `400`, `responseOk: false`;
- visible generic panel error: absent;
- safely observed evidence actions: exactly one recorded step,
  `web.inspect_current_page`, result `web.inspect.succeeded`;
- the action's effect-applied state was unspecified, consistent with a
  read-only observation;
- proposal: absent;
- persisted bootstrap adaptation/audit: absent;
- sanitized batch-decision count: unavailable, not zero-proved, because Core
  persisted no bootstrap adaptation after the failed generation.

No tool input, selector, page state, page content, image data, provider output,
or credential was inspected or copied. Credentials remained process-local.

## Exact terminal boundary and classification

The runner first recorded the safe HTTP-400 response and the successful tool
result. While recording the next sanitized generation-failure diagnostic, its
fixed identity validator rejected the stage/error identity before the final
failure checkpoint could be written. The public launcher consequently emitted:

- failure code: `unknown`;
- source location: `browser-evidence:70:19` in the compiled map;
- cause: `Evidence diagnostic identity is invalid`.

Source inspection confirms `BrowserEvidenceRecorder.diagnostic` accepts only a
bounded lowercase identity. `recordExplorationGenerationFailure` forwards
sanitized Core issue/reason codes into that field without an additional safe
projection. The exact underlying HTTP-400 issue code therefore cannot be
claimed from retained evidence. This is a testing-facility observability defect
masking a real pre-proposal generation failure; it is not evidence of batch
adoption.

## Acceptance ledger

| Gate | Result |
| --- | --- |
| Existing safe read-only task readiness | Passed |
| Typed instruction and high-token confirmation | Passed |
| At least one evidence action | Passed: one read-only action succeeded |
| Completed 2+ action batch | **Unproved: generation failed before persisted audit** |
| Reviewable proposal | Failed: HTTP 400, no proposal |
| Visible review / approve / apply | Not attempted |
| Playback and page oracle | Not attempted |

## Handoff

No source edit, retry, unit test, broad test, commit, merge, or push was made.
The unchanged unified candidate remains isolated. A separate bounded facility
repair could project arbitrary sanitized Core issue/reason codes into a valid
content-free evidence identifier so the real HTTP-400 cause survives, but this
brief did not authorize source edits or a second provider attempt.


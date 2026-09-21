# w2-permission-dialog-boundary

Status: provider-free state-reset defect fixed; the single authorized live rerun stopped at a narrower downstream response-body settlement boundary before the consequence dialog could be exercised.

## Provider-free boundary proof

The Core authoring panel did strictly parse and render a bounded `flow_bootstrap.permission_required` response. The dialog disappeared only when the panel received an equivalent Flow/readiness revalidation: the general preflight effect cleared `permissionRequest` and `permissionOpen` whenever those prop objects changed, even though the Flow identity had not changed.

A focused mocked-transport/component probe reproduced that exact sequence. Before the fix it passed the initial strict parse and visible-dialog assertions, then failed after the equivalent-props rerender because the dialog count changed from one to zero. The smallest fix moved permission-state clearing out of the preflight-refresh effect and into the existing actual-`flowId` change effect. The same probe then passed, proving response shape -> strict parse -> retained React state -> visible dialog across equivalent revalidation.

The earlier high-token-modal close remains necessary so that confirmation is consumed before a later consequence request, but it was not the remaining disappearance cause.

## Single live rerun

One production `panel:golden` rerun was made against the isolated workspace/profile on panel/gateway ports 3378/4948. It used the same bounded instruction and reached:

- explicit high-token confirmation;
- two successful live browser actions;
- the generation endpoint response with HTTP 200;
- no visible generic generation error.

The sanitized evidence bundle `demo-llm-explore-2026-09-21T03-23-27-357Z-1c7557` then stopped at event 121. Its last two closed checkpoints were `exploration.generation-response` and `exploration.visible-error.absent`. It did not record `exploration.generation-failure`, `exploration.permission-required`, Cancel, reopen, confirmation, or a durable proposal.

The next exact boundary is downstream response-body settlement. In `packages/test-runner/src/demo-llm-create-ui/explore-proposal-ui.ts`, the driver records those two checkpoints and then awaits `terminal.response.text()` before sanitizing the failure and looking for the already-rendered dialog. That await did not settle before the outer run failed, so the driver never reached its closed failure event or dialog locator. This live result therefore does not disprove the Core dialog fix, but it also cannot accept the end-to-end consequence flow.

The server owner of that response is Core `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts`: its `POST` awaits `fluxiq.programs.api.call(...)` and returns `NextResponse.json(...)`. The in-page consumer is Core `apps/web/src/features/programs/program-api.ts`: `readResponse` awaits `response.json()` and normalizes it before the authoring command resolves. The thin command seam is `apps/web/src/features/automation-studio/authoring/authoring-commands.ts`. The external observer is downstream `explore-proposal-ui.ts`, whose Playwright `response` event proves headers/status were observed but whose subsequent `Response.text()` did not settle. The evidence does **not** yet prove whether the incomplete settlement originates in the server serialization/runtime, browser fetch lifecycle, or Playwright's second body consumer; that three-point seam is the correct provider-free diagnosis scope.

Per the one-attempt authorization, no provider retry was made. Cancel preservation, reopen, exact consequence reissue, and one durable unapplied proposal remain live-unverified.

## Files and validation

Core candidate:

- `apps/web/src/features/automation-studio/authoring/BlankFlowAuthoringPanel.tsx`
- `apps/web/src/features/automation-studio/authoring/tests/blank-flow-authoring.test.tsx`

Downstream candidate retained from the prior unit:

- `packages/test-runner/src/demo-llm-create-ui/explore-proposal-ui.ts`

Validation performed in required order:

- provider-free focused probe before fix: failed only at the post-revalidation visible-dialog assertion;
- same focused probe after fix: passed, 1/1 selected test;
- production UI rerun: failed at the response-body settlement boundary above;
- no broad suite and no post-failure test expansion.

No temporary instrumentation remains. No raw provider response, page evidence, credentials, or user state was exposed. Port 3000 was untouched. No commit or push was made.

# w2-permission-continuation-acceptance-live

Status: the single authorized production UI attempt failed before the consequence dialog; no retry was made.

## Isolation and attempt

The existing disposable t027 workspace/store was used with newly created browser profiles. The previous isolated profiles were moved to recoverable `.acceptance-archive` siblings before launch. The panel and gateway used 3389/4959; port 3000 and user state were untouched.

Exactly one `panel:golden` attempt ran with the existing saved provider configuration and zero provider retries. Its sanitized evidence bundle is `demo-llm-explore-2026-09-21T03-33-37-118Z-08346b`.

## Live result

The production UI reached:

- explicit high-token confirmation;
- two successful live browser actions;
- HTTP 200 from the generation endpoint;
- no visible generic generation error.

The evidence again ended at event 121, with closed checkpoints `exploration.generation-response` and `exploration.visible-error.absent`. No later `exploration.response-body-unsettled`, sanitized generation-failure, permission-dialog, Cancel, reopen, grant confirmation, or proposal event was persisted.

Sanitized visual inspection of the last permitted panel screenshot found no consequence dialog. A provider-free durable-state probe after teardown returned `proposedCount: 0`, `bootstrap: false`, `providerMatches: false`, and `modelMatches: false` with zero provider calls for the probe. Thus there was no durable unapplied proposal and no auto-apply.

The acceptance oracle failed at the same narrow interval: after the driver records the endpoint response and absence of a generic alert, but before either the bounded external-body diagnostic or the product consequence dialog becomes observable. This attempt does not establish that the requested consequences were displayed, cancelled, retained, or reissued.

The repaired downstream bundle was confirmed to contain the two-second `settleObservedResponseText` race and `exploration.response-body-unsettled` checkpoint. Because neither that checkpoint nor the dialog appeared, this run did not prove a new deterministic source defect that could safely be edited under the brief. Candidate product files were therefore left unchanged and no second run was made.

## Validation and limits

- Pre-run package/build steps inside `panel:golden` completed.
- Live acceptance failed at the boundary above.
- Provider-free durable-state inspection completed and found zero proposals.
- No post-failure focused or broad tests were run.
- No raw response, page evidence, credential, or user state was logged.
- No commit or push.

# `af-w27-final-reset` — W27 repaired-pair mismatch

## Finding

The lone failure is a **Lab-to-Core control-plane transport observation during
pairing approval**, before the W27 Flow lane began. It is not evidence of a W27
automation/product failure. The durable event safely records category
`gateway.pairing`, HTTP stage `control.request`, transport category `network`,
and allowlisted code `ECONNRESET`.

The semantic operation is nevertheless exact from the code path:
`pairExtensionWithColdEpochRecovery` can reach a `gateway.pairing` HTTP request
only after its connect observation has produced a valid pending pairing, when
it calls `approvePairing`. `FluxIQControlClient.approvePairing` assigns that
category and currently uses the generic closed stage `control.request`.
The lifecycle deliberately preserves an approval failure and does not enter
the post-approval status wait.

## Ordering and comparison

- B repeat 0 started, completed topology/browser/page setup, and reached pairing
  approval. The approval request was reset. Its only event is the terminal
  error at sequence 1; it has zero scenario steps, zero actions, no Flow, and no
  evidence packet. The run finalized after 47,687 ms.
- The preceding B W27 recording run passed. It finished 7.627 seconds before
  this Flow run started. The following B W27 `disabled` Flow run began 7.441
  seconds after the failed run finalized and passed with one action.
- B primary Flow repeats 1 and 2 passed, created their Flows, and executed one
  action apiece. A primary Flow repeats 0, 1, and 2 also passed with the same
  shape. Thus the repaired pair has five successes in six independent primary
  W27 Flow evaluations, with the only miss occurring before Flow construction.
- A repeat 0 was running successfully at approximately the same wall-clock time
  as B repeat 0. That is consistent with a transient per-instance socket reset,
  rather than a shared deterministic W27 failure.

## Classification

The strongest supported classification is **facility control-transport
failure, observed once under concurrent machine load**. The artifacts cannot
distinguish whether the peer reset originated in the isolated Core process, the
OS socket stack, or another machine-level transient, so a narrower root cause
would be speculation. They do rule out the W27 fixture, selector/action logic,
Flow creation, Flow execution, and final-state oracle: none of those stages was
entered. The later B repeats and all A repeats also argue against a deterministic
product defect.

The runner behaved as designed: it bounded the diagnostic to a closed
allowlist, preserved the primary failure, did not leak request material, and did
not blindly replay an approval whose outcome was ambiguous. No code change is
justified by this one observation.

## Narrow next validation and ownership

If the repeatability gate requires an additional observation, run only W27
primary Flow for three isolated repetitions under the same two-campaign
concurrency. If all pass, record this reset as a non-repeating machine/facility
observation. If an approval reset recurs, ownership begins in
`packages/test-runner/src/run-lifecycle/pair-extension.ts` and
`packages/test-runner/src/http-control.ts`, not the W27 scenario or web-
automation domain. The safe next design would reconcile the ambiguous approval
by reading pairing status first and accepting an already-connected session;
retry approval only after the Core endpoint's idempotency is explicitly proven.
For future diagnosis, the HTTP client could also give approval its own closed
`pairing.approve` stage instead of the generic `control.request` label.

## Validation boundary

This was read-only. I inspected only the two campaign summaries, W27 immutable
receipts/events needed for the primary Flow and adjacent W27 ordering, and the
closed HTTP/pairing projector and lifecycle code/tests. I did not read or report
raw messages, page data, request bodies, addresses, ports, credentials, or
recorded content. No tests were run because no implementation changed.

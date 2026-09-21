# w2-bootstrap-no-proposal-diagnosis

Status: categorical result boundary fixed and live-proven; creation now stops honestly at `flow_bootstrap.permission_required` rather than generic no-proposal.

## Provider-free trace

The preserved run reached the generation endpoint and persisted no adaptation. Source tracing showed that Core cannot return `ok: true` before `createFlowBootstrapAdaptation()` saves the proposed adaptation: provider/evidence completion, target-plan resolution, plan validation, stale-binding validation, persistence, and response projection are strictly ordered in `runtime/service.ts:1916-2028` and `api/handlers/llm-generation.ts:113-144`.

The downstream production driver consumed the Playwright response with `response.json()`, then on `ok !== true` passed that same response to `readSanitizedGenerationFailure()`, which calls `response.text()`. The second body read threw before the sanitized failure diagnostic was recorded. This was the first deterministic discard boundary in the evidence pipeline and explains the prior HTTP-200/no-proposal/generic-failure combination: HTTP 200 described transport, while the consumed API envelope actually held `ok: false`.

## Smallest fix

- `generation-failure.ts` now exposes the same closed sanitizer over an already-consumed string body.
- `explore-proposal-ui.ts` reads the response exactly once as bounded text, parses the success envelope from that text, and sends the same text through the closed failure sanitizer when `ok !== true`.
- The barrel and two directly owned focused tests cover the pure sanitizer and enforce that the exploration driver does not call both `response.json()` and the response-reading sanitizer.

No Core source was changed.

## One authorized live rerun

The same production UI instruction ran once more in the existing isolated workspace on loopback panel/gateway 3375/4945. It reached explicit high-token approval and completed three evidence results: one inspect plus two successful effect-bearing browser actions.

The corrected driver then durably recorded:

- result: `flow_bootstrap.permission_required`;
- response parsed: true;
- HTTP status: 400 at the program envelope boundary;
- provider invocation: attempted (bounded count 1 in the failure projection);
- evidence: one iteration, three decisions, three tool calls, 2,087 bytes;
- applied evidence actions: two;
- proposed bootstrap adaptations: zero.

This is a narrower honest blocker, not a provider/normalization/persistence ambiguity. Core's action-permission gate intentionally stops on the first consequence absent from the build grant (`runtime/flow-bootstrap/action-permissions.ts:17-26, 64-84`). The web authoring request created by `blank-flow-authoring-model.ts:158-176` does not carry `permittedConsequences`, and the authoring UI has no follow-up permission-request review/resume interaction. Consequently the correct current behavior is refusal before proposal persistence.

No second provider rerun was made. A visible durable unapplied proposal was therefore not achieved. The next product unit should add an explicit human permission confirmation/reissued build grant (or an equivalent reviewed continuation) for the bounded `permissionRequest`; it must not silently pre-authorize consequences from the instruction.

## Focused validation

- Live production panel/Chromium rerun proved the new categorical diagnostic.
- `@fluxiq-web-extension/test-runner` build passed.
- Direct focused tests passed 8/8: exploration UI driver/source contract and failure sanitizer.
- `git diff --check` passed.
- No broad suite, commit, or push.

## Isolation

The disposable workspace remains under `F:\fxlab-runs\t027-fresh-ui-repair`. Ports 3375/4945 were closed after the run. Port 3000, user state, shared `dev`, credentials, raw provider response, and page data were untouched and are not recorded here.

# t268 — Service retention boundary audit

Status: **Complete read-only source audit**

## Verdict

**NO-GO on the reviewed tree.** The caller-controlled boolean reported by t265 has been removed,
but grant retention is still selectable outside the exact runtime-owned wrong-answer reauthor
operation. The public generation method suppresses revocation for every valid
`explore_and_adapt`/`extend` request, and its private `Set` is ambient state keyed only by grant ID,
not a capability attached to one invocation.

No source, shared document, generated output, build, run artifact, or live state was changed by
this audit. This report is a point-in-time review of the current working tree.

## Caller map

| Caller/boundary | How it reaches generation | Can select retention today? | Finding |
| --- | --- | --- | --- |
| Automation Studio API handler (`api/handlers/llm-generation.ts:80-145`) | Calls the public one-argument `service.generateFlowBootstrapAdaptation(...)` after inspecting a `build_and_adapt` grant; it does not expose `mode` and constructs no `explore_and_adapt` request. | No, through this endpoint. | The HTTP/program API path is narrow and spends/revokes its build grant normally. |
| Runtime wrong-answer reauthor (`runtime/service.ts:2641-2664`) | Adds the run grant ID to `runtimeOwnedBootstrapGrantRetentions`, calls the same public generation method with `mode: "extend"`, then removes the ID. | Yes, intentionally. | This is the one operation that should retain the run-owned grant through apply, continuation, replay, and recursive verification. |
| Exported service / in-process source callers | `AutomationStudioService` is exported by `runtime/index.ts:31` and the Automation Studio barrel; `GlobalProgramRuntime.automationStudio` exposes the live instance (`programs/_shared/runtime.ts:20-23`). | **Yes, unintentionally.** Any caller with a valid bound `explore_and_adapt` grant can invoke public generation with `mode: "extend"`. | Request parsing expressly accepts that combination (`generation-request.ts:29-57, 85-107`), and the public method's `finally` skips revocation solely because of the purpose (`service.ts:1721-1724`). No reauthor provenance is required. |
| Direct test callers | Bootstrap/extend tests call the public service method directly; several use synthetic `explore_and_adapt` grants (`extend.test.ts:176-179, 192-198, 234-237, 298-301`). | Yes. | These tests prove the exposed combination is accepted, but do not bind a revoker or assert that an ordinary public extend spends the grant. |

Repository search found only two non-test production call sites: the API handler and the internal
reauthor callback. That limited current usage does not close the exported service boundary:
source-level consumers receive the service instance and the accepted request type itself admits
the broad purpose/mode combination.

## Why the current private `Set` is not an operation boundary

`runtimeOwnedBootstrapGrantRetentions` is private (`service.ts:394`), so an ordinary typed caller
cannot mutate it directly. That does not make retention private for two independent reasons:

1. `service.ts:1723` contains a purpose-wide exception:
   `unsafeGrant?.purpose !== "explore_and_adapt"`. Thus an ordinary public
   `explore_and_adapt`/`extend` call retains without touching the set at all.
2. The set is shared ambient state keyed only by `grantId`. While the reauthor invocation has an ID
   present, a concurrent public invocation carrying that same grant ID also observes membership in
   the public method's `finally`. The retention decision is therefore not attached to the exact
   invocation that owns it.

The grant store may independently refuse a competing resolution, but the service's cleanup
decision must not depend on that as an implicit serialization guarantee. Even a request that fails
before provider work reaches the same ambient `finally`.

## Smallest safe seam

Keep the existing public signature for compatibility, but split dispatch inside the class:

- `generateFlowBootstrapAdaptation(input)` calls a private implementation with retention disabled;
- a private reauthor-only method calls the same implementation with retention enabled;
- the wrong-answer callback calls that private method;
- remove `runtimeOwnedBootstrapGrantRetentions` and remove the purpose-wide
  `explore_and_adapt` exception from public cleanup.

The retention selector may be a private implementation argument because no exported method or
request type can set it. The implementation's `finally` then makes one invocation-local decision,
which also removes the same-grant concurrency window. Generation may continue accepting
`explore_and_adapt` for public `extend` work; that call simply spends its grant when it returns or
fails, as every ordinary entry-point call does.

An equally safe shape is a private reauthor method containing the generation operation and its
cleanup directly, but duplicating the build body would be larger and risk drift. Merely deleting
the purpose exception while keeping the ambient set is insufficient because it retains the
concurrency ambiguity.

## Compatibility impact and proof required

- **External/API contract:** none. The API request fields and the public TypeScript method remain
  one-argument and unchanged.
- **Behavioral correction:** direct in-process `explore_and_adapt`/`extend` callers now have their
  grant revoked at the end of that standalone generation call. A caller that depended on the
  undocumented purpose-wide retention must move into the runtime-owned operation or obtain a new
  grant for later work; it cannot opt into retention.
- **Runtime reauthor:** unchanged intended behavior. Its exact private invocation retains until the
  outer runtime-session `finally` revokes the grant.
- **Tests:** add a revoker-backed direct public `explore_and_adapt`/`extend` case asserting one
  revoke on success and on pre-provider failure; retain the composition assertion that the internal
  reauthor reaches continuation/replay/fourth verification and ends with zero active grants. A
  concurrency regression should pause the private reauthor generation, issue a second public call
  with the same ID, and prove the second call cannot inherit retention.

The final-tree gate is therefore **NO-GO until the invocation-local private seam replaces both the
purpose-wide exception and the ambient set, with the public-direct revocation regression passing.**

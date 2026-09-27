# t272 — Final t258 diff review

Status: **Complete read-only current-tree review; final validation evidence remains pending**

Snapshot: `2026-09-26T18:50:33-07:00`, from the shared uncommitted Core checkout. The t258
handoff report was still absent, and this review did not wait on or adopt any in-flight gate result.
Source edits or regenerated baselines after this timestamp are outside the verdict.

## Verdict

**Source correctness and retention boundary: GO. Final/live gate: NO-GO until the exact public
extend revocation regression and the settled-tree t258 gates are observed passing.**

No residual product-source defect was found in the final t258/t265–t269 path. The current source
closes both t265 findings, replaces t268's purpose-wide/ambient retention with an invocation-local
private selector, and now includes t267's missing cross-layer binding-read failure composition.
The remaining issue is test evidence: the suite still does not directly exercise a successful
public `explore_and_adapt` / `mode: "extend"` invocation and prove that it revokes while the private
runtime-owned invocation retains. This is the exact regression t269 left as the final hard gate.

## Final-tree review

### Retention ownership — GO by source shape

- Public `generateFlowBootstrapAdaptation(input)` always delegates with literal `false`.
- The retention boolean is a parameter of the private implementation, is absent from the public
  request contract, and has no ambient `Set`, async context, purpose exception, or grant-id lookup.
- The only `true` production call is the local runtime wrong-answer reauthor closure. Interleaving a
  public call cannot inherit it because each invocation captures its own lexical value.
- Public generation always enters its `finally` revocation path. The runtime-owned nested call
  retains only until `runRuntimeSession`'s unconditional outer `finally` revokes the run's grant.

### Durable apply and continuation — GO

- Under the Flow adaptation lock, the helper reloads the exact adaptation, compares its base digest
  and revision with the pre-generation binding, applies it, reads the authoritative post-apply
  binding, and only then asks the grant store to continue.
- The binding read and continuation are now in the same closed post-apply catch. Either failure
  preserves truthful `applied: true`, emits `replayReady: false` with sanitized
  `grant_continuation` provenance, and prevents replay and the recursive fourth judge.
- The grant-store CAS still requires the exact held/claimed/live/idle grant and exact scope, session,
  key, old binding, and authoritative new binding. Success mutates only digest and revision; every
  refusal revokes.
- Selected-Subflow identity is forwarded into the provider-free replay. Recursive verification
  occurs only after a replay-ready applied repair.

### Regression coverage — one exact gap remains

Current source contains all of the following:

1. Four-call successful reauthor composition, applied adaptation, successful replay, and terminal
   zero-active-grant assertion.
2. Continuation-refusal composition with three calls, durable applied provenance, no replay/fourth
   judge, sanitized detail, and terminal revocation.
3. Authoritative binding-read failure at both helper and full service-composition boundaries; the
   service case proves the adaptation remains applied, the run fails closed, raw error text does
   not escape, and no fourth call occurs.
4. A direct `explore_and_adapt` public-generation **failure** case that asserts revocation.

What is still absent is a direct public **successful extend** revocation assertion (or the stronger
same-grant interleaving test described by t269/t271). The existing direct case uses a blank/create
request that fails before provider resolution, so it would not prove cleanup after the formerly
vulnerable successful public extend path. Add and pass one of these before live run 3:

- public `mode: "extend"` + exact `explore_and_adapt` success invokes its revoker exactly once,
  while the existing runtime composition proves private retention and outer terminal revocation; or
- the deterministic same-grant interleaving regression specified by t271.

## Structure and API review

- `runtime/service.ts` is 4,561 lines, below its current 4,568-line structure baseline. The new
  reauthor continuation module is 74 lines; its focused test is 60 lines. Scoped `git diff --check`
  reported no errors (line-ending warnings only).
- The continuation helper is exported by the internal `runtime-adaptation` barrel for service use,
  but `service.ts` does not re-export it and the package automation-studio barrel reaches only
  `runtime/service.ts`; no new HTTP, gateway, or request-contract capability was found.
- There are additive TypeScript surface changes: `AutomationStudioServiceOptions` and
  `bindLlmExecutionProvider` accept the optional continuation hook, the already-exported grant
  service has the continuation method, and the result-verification rerun port accepts optional
  `subflowId`. These are compatible host-wiring additions, not caller-selectable retention or a
  permission/budget widening. No unintended API exposure was found.
- The current helper file has three closely related exports (continuation type, apply/continue
  helper, detail projection). This does not exceed a measured structure budget and is cohesive for
  the boundary reviewed; no extraction is required for this gate.

## Verification limitations

No tests, checks, build, baseline generation, or live run were executed by t272. The t258 final
report did not exist at the snapshot, and broader gates may still have been running. Therefore this
report does not independently establish a green settled build or authorize provider-backed live
testing. Final GO requires the missing exact retention regression plus the serial focused/package/
root check and build results from the final unchanged tree.

No Core source/shared document, generated output, run artifact, provider/browser/Lab state, commit,
or push was changed. This report is the only file written.

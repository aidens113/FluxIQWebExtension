# t273 — Final retention regression review

Status: **Complete read-only snapshot review**

Snapshot: `2026-09-26`, from the shared, uncommitted Core tree after the final regressions landed.
This review did not run tests because its brief forbids generated-output changes; passing execution
remains a separate supervisor gate.

## Verdict

**GO on test design and current-tree coverage; execution evidence remains pending.** The final
private-argument source seam is sound. The exact t267 post-apply binding-read composition test,
successful public `explore_and_adapt` + `extend` revocation test, and deterministic distinct-Flow
same-grant overlap test now cover the blockers in t267/t269/t271. No remaining assertion or race
defect was found in the final test snapshot.

## Test-by-test coverage map

| Blocker / invariant | Final test evidence in this snapshot | Result |
| --- | --- | --- |
| t267: authoritative binding read fails only after durable apply | `runtime/tests/refuted-result/tests/reauthor-service.test.ts`, **"keeps durable applied provenance and skips replay when the applied binding cannot be read"**: injects the exact post-apply read fault, proves three provider calls only, `applied: true`, `replayReady: false`, persisted applied adaptation, sanitized detail, failed run, and zero active grants. | **Covered** |
| t267 helper ordering | `runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts`, **"reports a closed post-apply outcome when the authoritative binding read fails"**: observes apply before the rejected binding read and proves continuation is not called. | **Covered** |
| t269/t271: a direct explore-purpose public failure cannot retain by purpose | `runtime/tests/service-bootstrap/tests/accounting.test.ts`, **"does not let a direct explore-and-adapt caller retain the generation grant"**: observes exactly one revoke for the grant on a sanitized generation failure. | **Covered**, but only the failure path |
| t271: valid public explore-purpose `extend` success revokes | `runtime/tests/service-bootstrap/tests/extend.test.ts`, **"opens for a non-blank Flow, starts from its steps, and keeps its ids"** reaches a successful `evidence_tool_decision` under `mode: "extend"` and `purpose: "explore_and_adapt"`, then observes exactly one revoke with `llm-grant:run`. | **Covered** |
| t269/t271: in-flight private retention cannot leak to a same-ID public call on a distinct Flow | `runtime/tests/refuted-result/tests/reauthor-service.test.ts`, **"does not leak private retention to a same-grant public generation on another Flow"** uses explicit start/release promises, pauses the private provider, uses a distinct Flow lock, launches a same-ID public call, observes exact pre-release revocation, releases in `finally`, and proves the outer run fails without replay/fourth verification, leaked secrets/provider detail, or an active grant. | **Covered** |
| Runtime-owned success retains only until terminal run cleanup | Existing reauthor success composition proves four task kinds, replay readiness, applied persistence, successful run, and zero active grants. | **Covered** |

## Determinism and flake assessment

The binding-read regression is deterministic: a one-shot flag is armed by reading the validated
adaptation during apply, and the next binding read throws. It uses no timer, polling, or scheduler
assumption. The helper test is likewise synchronous under an injected lock callback.

The new overlap regression uses the right synchronization shape: an explicit provider-start
promise and release promise, plus a distinct Flow so the public call does not queue behind the
private generation lock. It therefore reaches the former vulnerable overlap without sleeps,
polling, fake timers, or microtask-order assumptions. Release is in `finally`, so an assertion
failure cannot strand the provider barrier. The decisive assertion is made while the private call
is still paused: the revocation sequence is exactly `[grantId]` and the grant store is empty. After
release, the exact task sequence proves there was no replay/fourth verification; sanitized detail
and terminal zero-grant assertions close the privacy and lifecycle sides.

The successful public-extend test is also deterministic. Its provider-task assertion proves the
request passed early validation and actually generated, while its one-call revoker assertion
proves ordinary public cleanup on success rather than merely on a pre-provider refusal.

## Required closure

Observe the focused t271 command passing on the settled tree before treating the implementation as
release/live-run GO. This report's source/test-design verdict is already GO; it does not substitute
for that execution gate.

No Core/downstream source, shared document, generated output, run artifact, provider/browser/Lab
state, commit, or push was changed. This report is the only file written by t273.

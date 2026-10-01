# Login lock concurrency investigation

Status: Complete (exact two-path implementation frozen; supervisor review pending)
Owner: runtime_contracts
Date: 2026-10-01

## Written brief

- Mounted Chat eight paths remain frozen. Own only this report; Core product/tests are read-only until precise implementation release.
- Tenth full Core gate46495 failed one of2548 tests after196.07s: durable login attempts concurrent-failures test at lib/tests/login-attempts.test.ts:166 threw EPERM opening its synthetic TEMP attempts.json.lock at lib/login-attempts.ts:120. Other2547 passed; web types59550/native0/96912ms and build36861/native0/209084ms passed. Protected structure failure unchanged.
- Read exact Core apps/web/src/lib/login-attempts.ts and tests/login-attempts.test.ts, relevant bounded imports only. No actual login store/private .fluxiq or user data inspection. Inspect TEMP/codex-t224-tenth-core-full.log relevant failure only.
- Run existing owning login-attempts test through heavy wrapper, maximum three narrow reproductions initially. Report actual results. Investigate exclusive create/close/unlink concurrency on Windows; distinguish confirmed code-path behavior from filesystem hypotheses. Do not blame load, relax tests or swallow general permission errors.
- Propose minimal safe exact-file fix/test plan that distinguishes transient lock contention from denied access, preserves bounded waits/stale reclamation/login protections and never treats a failed acquire as success. No source edits/commits/broad/browser/provider/panel operations yet.

## Evidence and proposed resolution

### Supervisor implementation release

Status: Active implementation. Root read the complete findings and approved exact Core apps/web/src/lib/login-attempts.ts and existing lib/tests/login-attempts.test.ts, plus this report only. Existing assertions remain intact; new deterministic partial-fs regression must fail before product edits. Core environment worker owns unrelated programs paths; neither lane runs broad gates before both freeze.
Follow the bounded policy below, preserving the original denied-access error on exhaustion, propagating probe permission/IO failures, and requiring actual successful exclusive acquisition. Never stale-delete based on EPERM, retry PID-write errors as contention, bypass lockout, or alter true permissions. Preserve original failure when initialization cleanup itself fails; close any acquired handle and remove only its owned lock. Windows deletion contention remains a supported hypothesis, not a proven explanation of the retained full run. Narrow tests/scoped types/whitespace only, then freeze; no public injection API/new helpers/protected runtime/storage edits/private stores/broad/live/commits.

### Observed results

The retained tenth full-gate failure is confirmed in its relevant TEMP log: the synthetic concurrent-failures case rejected from exclusive `open(lockPath, "wx")`, not from store reading/writing or release. The failure stack points to source line120 and test line166. It was an EPERM, not the EEXIST that the implementation currently retries. Nothing in the retained evidence identifies the native Windows error number or proves which competing handle caused it.

All three authorized narrow executions used the heavy wrapper and existing `src/lib/tests/login-attempts.test.ts`, unchanged:

| Wrapper label | Tests | Native result | Test time | Vitest duration |
| --- | --- | --- | --- | --- |
| codex login lock investigation 1 | 34 passed | 0 | 372ms | 1.13s |
| codex login lock investigation 2 | 34 passed | 0 | 287ms | 936ms |
| codex login lock investigation 3 | 34 passed | 0 | 277ms | 963ms |

The maximum three runs are exhausted. These passing narrow runs do not invalidate the observed full-suite failure. Runtime inspection returned Node v22.23.3, libuv1.51.0, win32. No synthetic store contents, actual login stores, private data or browser state were inspected.

### Source-confirmed findings

1. **High: exclusive-open handling is too narrow for Windows concurrency.** Only EEXIST enters the existing bounded100-attempt wait; EPERM immediately escapes before the operation runs. Release closes the owning handle then removes the lock, while contenders inspect the same path with `stat`. Windows documents that pending deletion can reject a subsequent open with ACCESS_DENIED; the installed libuv version maps that native error to EPERM. This establishes a possible contention mechanism, not proof that pending deletion caused this particular run. [Microsoft DeleteFile documentation](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-deletefile), [libuv1.51.0 Windows error mapping](https://raw.githubusercontent.com/libuv/libuv/v1.51.0/src/win/error.c).

2. **High: the current catch combines acquisition with initialization.** Its try block includes both exclusive open and PID writing. Expanding that catch to retry EPERM wholesale would also retry a failed PID write after a handle was successfully acquired, leaking ownership/handle and risking subsequent false contention. Any fix must separate exclusive-open classification from acquired-handle initialization and clean up an initialization failure.

3. **Medium: lock inspection suppresses every stat error.** `stat(...).catch(() => null)` makes permission and IO errors indistinguishable from disappearance. A safe contention policy must recognize ENOENT explicitly and propagate other inspection errors. Neither denied access nor a failed acquisition may be interpreted as ownership.

4. **Existing protections must remain.** Operation and durable write occur only after exclusive acquisition; release runs in finally. Existing100-attempt/backoff bounds, ten-second stale threshold, concurrent persisted counts, live-lock waiting, stale reclamation, store-error release, throttle/lockout/client-key behavior and all34 assertions remain required. Do not replace disk exclusivity with a same-process queue: that would conceal the two-instance test symptom while leaving other-process ownership unresolved.

### Proposed exact implementation unit (not released)

Only Core `apps/web/src/lib/login-attempts.ts` and its owning `apps/web/src/lib/tests/login-attempts.test.ts` need release. No new helper, public API, auth configuration, baseline or shared document changes are proposed.

Tests first: introduce a scoped partial filesystem mock that delegates to the real filesystem except for named synthetic exclusive-open/PID-write/stat failures. Retain existing real-file concurrent and waiting tests. Prove an injected transient Windows EPERM rejects on current source, then succeeds only when a later real exclusive open succeeds; assert persisted concurrent counts remain[1,2]. Prove persistent denied exclusive open remains a rejection with its original code and bounded attempts, denied stat propagates, other open errors remain immediate, and PID-write failure closes/removes the acquired synthetic lock while preserving the write error. Also exercise lock disappearance during inspection and unchanged EEXIST exhaustion. Restore every injected behavior between tests; no product test-only injection surface or weakened assertions.

Recommended policy: isolate the `open("wx")` catch. Preserve EEXIST contention. On win32 only, allow EPERM from that exclusive-open call a bounded retry when a path probe finds a regular lock file or ENOENT; do not extend this to PID-write, store-write, release, EACCES or arbitrary errors. For denied/malformed probe results, propagate the relevant error; never remove a lock merely because acquisition returned EPERM. Use the existing shared100-attempt/backoff budget, with no unbounded or second nested wait. Retain the latest access error and reject it on an exhausted access-denied attempt rather than replacing a persistent permission failure with an apparent success or misleading generic busy error. EEXIST-only exhaustion retains existing busy feedback. Preserve the existing stale threshold/reclamation policy in the EEXIST branch on confirmed regular locks; EPERM itself does not authorize stale removal. Do not introduce recursive deletion or a new stale-ownership protocol.

A probe cannot conclusively distinguish transient pending deletion from ACL denial: both can produce EPERM and a readable regular path. The defensible distinction is bounded retry versus successful exclusive acquisition, followed by the original denied-access rejection when permission does not recover. This policy does not bypass permissions or treat denied access as an acquired lock. The source-level evidence does not justify blaming machine load, antivirus or ACLs specifically.

After release: confirm deterministic regression fails before changing source; implement the separated acquire/initialize cleanup and bounded Windows policy; run owning narrow tests through heavy and exact scoped type checking; freeze both files and report native outcomes. Supervisor owns subsequent independent review/full gates. No additional reproduction, product edit, broad validation, actual-store investigation, live/browser/provider/panel operation or commit occurred in this investigation.

## Released implementation progress

Supervisor explicitly released the exact source and owning test paths after reading the investigation. Added12 deterministic synthetic filesystem/platform regressions, preserving all34 existing assertions. First tests-only run454a64/native1 yielded40pass/6fail, but a denied-probe case exceeded the default timeout and could leave its pending call affecting later spies. Corrected the new harness before product editing: settle both concurrent calls even on failure, accelerate only injected bounded-wait cases, restore platform/spies and close tracked synthetic handles after each test. The clean tests-only run be379d/native1 yielded39pass/7fail in414ms (Vitest1.23s). The seven failures independently demonstrate transient EPERM rejection, stale-lock EPERM rejection, missing bounded retry, swallowed denied probes and missing owned initialization cleanup. Original34 pass. Product source was still unchanged for both runs.

Implemented only the released Core paths:

- `apps/web/src/lib/login-attempts.ts`: separate exclusive acquisition from owned PID initialization. EEXIST keeps existing bounded waiting/stale reclamation; win32 exclusive-open EPERM retries only after regular-lock or ENOENT probe. Other probe errors propagate, EPERM never triggers stale removal, and the most recent original access error survives budget exhaustion even if subsequent attempts report EEXIST. PID-write failures close/remove the owned lock and rethrow the original initialization error even when cleanup fails. Normal release behavior, durable update/wire schema/client/throttle policy and bounds are unchanged.
- `apps/web/src/lib/tests/login-attempts.test.ts`: retain34 original assertions; add16 deterministic cases. Besides initial regressions, added mixed EPERM/EEXIST exhaustion, persistent stale regular lock preservation, PID-write EEXIST not treated as contention, and close-failure cleanup/error preservation. Scoped mocked filesystem delegates to real synthetic files; platform/timer/spies restore and tracked handles close after every case.

Observed narrow validation:

| Check | Native result | Evidence |
| --- | --- | --- |
| First implementation owning test, `codex login lock recovery tests` | 0 | 3d3d1f,46passed,396ms test/1.12s Vitest |
| First exact-two-root type check, `codex login lock scoped types` | 0 | c790b0,0 diagnostics |
| Final owning test after added boundary cases, `codex login lock final tests` | 0 | e65963,50passed,403ms test/1.09s Vitest |
| Final exact-two-root type check, `codex login lock final scoped types` | 0 | e67b7b,0 diagnostics,3.434s tool |
| Exact source/test diff check and review | 0 | 89309c; only these2 Core paths;225insertions/11deletions |

Type checks used TEMP `codex-t224-login-lock-types.mjs`, actual owning web tsconfig/options, exact2 roots and dependency diagnostics, no emit/incremental output or tracked configuration change. Heavy commands used the required shared wrapper. The passing deterministic recovery does not establish the exact native cause of the earlier full-suite EPERM or prove a subsequent full gate; root owns independent review and full integration validation. Both source/test files are now frozen. No extra source/helper/API/config/baseline/shared-document edits, actual-store/private inspection, broad/live/provider/panel commands or commits occurred.

Supervisor follow-up: root independently read acquisition diff/original assertions and observed50 owning tests passing/native0/1.28s. Structure34789 found a NEW swallowed-failure violation at initialization cleanup lines141/142 in addition to inherited protected service4506/4505. The rationale above the handlers is insufficient for that audit; it requires an inside-handler marker, exactly `.catch(/* best-effort: preserve original PID initialization failure */ () => undefined)`. Root owns this comment-only reconciliation AFTER its active full/types/build gates finish, followed by narrow structure verification. Source remains frozen for this worker. No baseline/config relaxation; broad certification and this structure reconciliation remain pending.

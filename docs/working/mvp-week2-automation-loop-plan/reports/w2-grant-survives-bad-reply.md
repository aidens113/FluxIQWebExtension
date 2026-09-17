# w2-grant-survives-bad-reply — worker report

Repository changed: FluxIQ Core (`F:\!FluxIQ`). `AS/` =
`packages/fluxiq/src/programs/automation-studio/`. In this repository, only
this report was written. No live provider calls, no network, no `pnpm lab`.
Nothing committed.

## Outcome

**Done.** A failed provider call no longer ends a grant unless the failure is
about the authorization.

- **The grant.** A closed table, keyed by every provider failure code, now
  decides what a failure means:
  - **Ends the grant:** anything about the authorization.
  - **Spends only the call:** the model's reply or the network. The call is
    counted and charged exactly as before, and the grant carries on.
- **The exploration.** It now asks again after an unusable answer. A run of
  bad answers is stopped by the existing no-progress guard, which has a new
  reason for it: `unusable_decision`.
- **Proven end to end.** The test uses the real grant, the real DeepSeek
  adapter and the real recovery path, with only the network and the
  credential store stood in.
  - Every exploration decision comes back malformed, or runs past its
    deadline.
  - The exploration stops after 3 decision calls, well short of the 24
    allowed, with outcome `no_progress` and reason `unusable_decision`.
  - The patch is then still sent under the same grant, and it validates.
  - Before this change, the first bad answer revoked the grant, and the patch
    was refused.

## Three things the brief did not name, found and fixed

1. **Timeouts revoked the grant by a second route.**
   - The harness enforces each call's deadline by aborting the signal it hands
     the provider. It aborted with a bare abort, and the grant treated every
     abort as a cancellation and revoked.
   - So classifying `llm.provider_timeout` alone would not have saved a single
     real timeout.
   - **Fix, part 1:** the harness now aborts with a `TimeoutError` reason
     (`AS/runtime/llm/harness/run.ts`). The grant treats that as the end of
     the call only. Any other abort is still a cancellation and revokes.
   - **Fix, part 2:** the grant now settles a timed-out call at once, inside
     the abort handler. This was needed because the harness returns before the
     provider finishes unwinding. Without it, the caller's next call was
     refused with "already has a call in progress".
2. **The exploration ended on the first bad decision, whatever the grant did.**
   - The evidence loop turns a decision call that throws into
     `llm_evidence_loop.invalid_decision`, and the outcome is `failed`.
   - So fixing the grant alone would have rescued the patch, but not the
     iteration.
   - **Fix:** the runner now asks again (details below).
3. **The exploration's clock also cancelled a call in flight.**
   - When the clock ran out mid-call, the ledger aborted with a bare abort.
     That would have revoked the grant, and the patch would then be refused.
   - **Fix:** the clock now aborts as a timeout
     (`AS/runtime/recovery/exploration-budget.ts`). Cancellation from outside
     still aborts as a cancellation.

## What changed and why

### The classification table: `AS/runtime/llm/failure-disposition.ts` (new)

- **`AUTOMATION_STUDIO_LLM_PROVIDER_FAILURE_DISPOSITIONS`** gives each provider
  code one of three meanings: `end_grant`, `spend_call`, or
  `spend_call_on_server_error`.
  - It is declared `satisfies Record<AutomationStudioLlmProviderErrorCode, …>`.
    A code added to the provider contract without an entry, or an entry for a
    code that does not exist, fails the type check.
  - The table is frozen.
- **`automationStudioLlmProviderFailureSpendsCall({ code, status })`** answers
  the question from a code and a status. It fails closed:
  - An unknown code, or `llm.provider_request_failed` (what an untyped
    exception becomes), is not a spent call.
  - A prototype key such as `constructor` is not a spent call (checked with
    `Object.hasOwn`).
  - `llm.provider_http_error` is a spent call only for a 5xx status.
- **`automationStudioLlmProviderErrorSpendsCall(error)`** answers the same
  question for a thrown error.
  - The error must be a real `AutomationStudioLlmProviderError`. An object that
    only looks like one is not accepted. The DeepSeek adapter throws nothing
    else, so this costs nothing and is stricter.
  - The message is never read.
- **`AS/runtime/llm/provider-contract.ts`** now lists the 15 call-time codes as
  a value, `AUTOMATION_STUDIO_LLM_PROVIDER_CALL_ERROR_CODES`, beside the
  existing list of 17 pre-flight codes. The code type is derived from both
  lists, so a test can check the table against the whole vocabulary at run
  time.

### The grant: `AS/runtime/llm/execution-grants.ts`

- **When a call throws, the grant is kept only if all of these hold:**
  1. The error is a provider error whose code means a spent call.
  2. The credential had already been released for this call (a new
     `credentialReleased` flag, set just before `resolveSecret` returns the
     key). This means the failure happened on the provider's side of the
     credential check, not inside it.
  3. The grant is still this grant: claimed, inside its lease, and this call
     is still its call in flight.
  4. `validateClaimedGrant` still passes when the grant re-checks itself right
     after the failure.

  Anything else revokes, including every failure that has no code.
- **A deadline abort** (the signal's reason is a `TimeoutError`) calls
  `abandonTimedOutCall`.
  - It settles the call on the spot, then aborts the in-flight request as a
    timeout.
  - If the credential had not yet been released, the deadline cut off the
    grant's own authorization steps, whose outcome is unknown, so the grant is
    revoked instead.
- **Any other abort, or a signal that was already aborted, revokes the grant,**
  as before.
- **A spent call is charged as follows:**
  - Its use and its cost are taken when the call is claimed, exactly as now.
  - Its tokens are charged at the call's worst case,
    `min(maxTotal, maxInput + maxOutput)`, because a failed call reports no
    usage.
  - The run ledger charges a failed call its whole reservation
    (`maxInputTokens + maxOutputTokens`, `harness/run.ts:124`). That is never
    less than the grant's charge, so the grant is never the stricter of the
    two.
- **`commitCall` and the new failure path share one `finishCall`,** so a grant
  whose last use went on a bad reply is consumed exactly as before.
- **Size.** The grant's purpose type, its capability tables, the purpose
  parser and the request matcher moved, with their text unchanged, into
  `AS/runtime/llm/grant-capabilities.ts` (new).
  - `execution-grants.ts` went from 772 to 750 lines. It would have passed the
    800-line limit otherwise.
  - The barrel (`llm/index.ts`) re-exports exactly the three names that were
    public before: `automationStudioLlmExecutionGrantTaskKinds`,
    `AutomationStudioLlmExecutionGrantPurpose` and
    `AutomationStudioLlmExecutionGrantResolvePolicy`.
  - `runtime-session-grant.ts` now imports the task-kind list from the new
    file.

### The exploration

- **`AS/runtime/recovery/unusable-decision.ts` (new)** defines
  `AutomationStudioExplorationUnusableDecisionError`. The error carries issue
  codes only.
- **`AS/runtime/recovery/runtime-exploration.ts`:** when `decide` throws that
  error, the runner:
  1. counts it;
  2. records a step that did not advance;
  3. admits another provider call under the same budget;
  4. asks again.

  Other details:
  - Anything else `decide` throws still ends the loop, as before.
  - The runner stops asking once the loop's signal is aborted.
  - The result and the trace event gain `unusableDecisions`.
- **`AS/runtime/recovery/progress-guard.ts`:**
  - New reason `unusable_decision`.
  - New method `recordUnusableDecision()`. It shares the streak with barren
    actions and records no request signature, so a later step cannot read as
    a repeat.
- **`AS/runtime/recovery/exploration-budget.ts`:**
  - New ledger method `recordUnusableDecision()`.
  - The clock now aborts with a `TimeoutError` reason.
- **`AS/runtime/recovery/annotation/exploration.ts`:** throws the typed error
  only when all of the following hold. Otherwise it throws a plain error, as
  before.
  - The provider was reached.
  - Every error code is either a spent-call provider code (from the same table
    the grant reads) or in the harness's own `llm_output.` namespace, which
    covers a reply that arrived and failed Core's checks.
  - An `ok` result whose response is the wrong kind also counts.

  Everything else still ends the exploration:
  - a run-budget refusal;
  - a pre-flight refusal;
  - an `llm_usage.*` breach;
  - `instruction.conflict`;
  - `llm.provider_request_failed`;
  - `llm.provider_diagnostic`.
- **`AS/runtime/recovery/index.ts`** exports the new module.

### Does the guard stop a loop of invalid replies? (brief's question)

- **Before this change: no.** The guard never saw a bad decision. The
  exploration ended at the first one as `failed`
  (`llm_evidence_loop.invalid_decision`). That is a fault ending, not a guard.
- **Now: yes.**
  - With the default streak of 3, a loop whose every answer is unusable stops
    after 3 decision calls, out of the 24 the exploration allows.
  - It ends with outcome `no_progress`, stop reason `no_progress`, reason
    `unusable_decision`, and the sentence "The model kept answering with
    something the exploration could not use, so it was stopped."
  - The run budget still binds as well: every spent call is on the ledger and
    on the receipt.
  - The patch still runs afterwards.

## The security property behind each class

| Class | Ends the grant? | Security property that decides it |
| --- | --- | --- |
| Actor's session invalid, or Secret Keys unlock gone (plain errors from validation or minting) | Yes | A grant never outlives the authenticated, unlocked session of the person who authorized it. |
| Key changed or disabled; provider rejects the key (`auth_failed`) | Yes | A grant only ever reveals the exact key version that was authorized, and a key the provider has rejected is never sent again. |
| Flow or settings revision changed | Yes | A grant only authorizes calls about the exact Flow revision the person approved. |
| Grant revoked; caller cancelled (`provider_aborted`, or any abort whose reason is not a timeout) | Yes | Revocation and cancellation are final and take effect immediately. |
| Lease expired, including while a spent call was in flight | Yes | A claimed grant cannot run past its run lease, and a spent call does not extend it. |
| Claim, exchange or reveal integrity: request not authorized ("request mismatch"), scope changed after the claim ("scope mismatch"), exchanged authorization for another key version, revealed key not the authorized one, credential check refused (`secret_unavailable`), redirect (`redirect_rejected`) | Yes | A call is exactly what was authorized. Reveals stay one per call and bound to the authorized key. The credential only ever goes to the fixed endpoint. |
| The 17 pre-flight refusals | Yes | Core would refuse the same request identically next time, so retrying only spends reveals. `credential_in_request` is also a sign the credential could leak out. |
| Budget breach: provider billed past the call's limit (`usage_limit_exceeded`); the grant's own token or cost total | Yes | The spending bound. Once a provider bills past a call's reservation, every later reservation is an underestimate, so the grant's total can no longer be guaranteed. |
| Any other 4xx (`http_error`, not 5xx) | Yes | The provider refused this request outright, and asking again will not change that. |
| No code, an unknown code, or an object merely shaped like a provider error | Yes | The check fails closed: nothing is kept by omission. |
| A deadline that fires before the credential was released | Yes | The grant's own authorization steps were cut off with an unknown outcome. |
| Reply unusable: `malformed_response`, `output_invalid`, `output_truncated`, `output_padding_truncated`, `response_oversize`, `usage_invalid` | No; the call is spent | See the note below the table. |
| Network: `timeout` (the provider's, or the caller's deadline after release), `network_error`, `rate_limited` (429), `http_error` 5xx | No; the call is spent | As above. These failures are temporary by nature. |

**Why a spent call keeps the grant.** The credential went to the fixed
endpoint, under an authorization that was still valid, for a call that is
counted and charged exactly like a successful one. What the reply said has no
bearing on whether the person's authorization still holds. The grant
re-checks itself immediately. Before any further reveal, the next call checks
the session, the key, the Flow revision, the lease and the scope again.

"Still claimed" in the grant also covers "still in progress": a second call
made while one is still running is still refused without revoking. That is
unchanged (see open question 3).

## Commands run and observed results

- **Type check.** `npx tsc --noEmit -p .` in `packages/fluxiq`: exit 0, no
  output. It was run after the grant change and after the recovery change.
  - The second run first reported two test helpers missing the new
    `unusableDecisions` field (`stages.test.ts`, `runtime-exploration.test.ts`).
    I fixed both, and the rerun exited 0.
- **`llm` tests.** `npx vitest run src/programs/automation-studio/runtime/llm --root packages/fluxiq`:
  - Before adding new tests: 16 files, 164 passed. This includes the 7 grant
    lifetime tests in `execution-grant-lifetime.test.ts`, unchanged.
  - After adding them: 18 files, 191 passed.
  - On the first run, 2 new cases failed on my own expectations. I had
    expected `llm.provider_secret_unavailable`; the code actually reports
    `llm.provider_aborted` (see open question 1). I corrected the
    expectations; the grant is revoked in both cases.
- **`recovery` tests.** `npx vitest run src/programs/automation-studio/runtime/recovery/tests --root packages/fluxiq`:
  12 files, 193 passed.
  - The earlier combined run failed only `has three distinct reasons`, which
    pins the reason list. I updated it to four.
- **Recovery guard tests.** `recovery/annotation/tests/iteration-guards.test.ts`: 8 passed.
- **End-to-end tests.** `runtime/tests/deepseek-recovery-requests.test.ts`:
  6 passed. The case where decisions time out takes about 3.0 s (3 × 1 s
  deadline).
- **Negative controls.** Each control broke one part of the fix, ran the four
  test files (68 tests), then restored the file. `cmp` confirmed every restore
  byte-identical.

  | Control | What was broken | Result |
  | --- | --- | --- |
  | A | The grant's failure path always revokes (the old behaviour) | 14 failed: the 11 spent-call cases, the budget-breach case, and both new end-to-end cases |
  | B | A deadline abort treated as a cancellation | 2 failed: the caller-deadline case and the end-to-end timeout case |
  | C | The runner does not ask again | 6 failed: 2 runner cases, 2 guard cases, 2 end-to-end cases |
  | D | The harness deadline aborts without a timeout reason | 1 failed: the end-to-end timeout case |
  | E | The "credential released" requirement removed from the deadline path | 1 failed: "ends the grant when a deadline falls before the credential was released" |
  | F | The ledger clock aborts without a timeout reason | 1 failed: "aborts a call in flight as a timeout when its clock runs out…" |
  | G | The exploration never throws the typed error | 4 failed: 2 guard cases, 2 end-to-end cases |
  | H | The scope-mismatch revoke removed (run later, see below) | 1 failed: the integrity test |

- **Core `pnpm check`.**
  - First run: exit 2. This was a real type error in my new test file
    (`TS2722`, "possibly undefined"). I fixed it.
  - Second run: **exit 0.**
    - Structure tests: 96 pass, 0 fail.
    - `structure-audit: passed (144 warning(s), 254 baselined)`.
    - `check: Done` for contracts, client-gateway-websocket, fluxiq and
      apps/web.
    - `node scripts/structure-audit.mjs --json`: 0 failures. The one baseline
      entry it says can be lowered is
      `apps/web/.../flow-settings-model.ts::values`, which is not mine.
- **Runtime suite, first full run.**
  `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq`:
  `Tests 2 failed | 1027 passed (1029)`, 109 files, 111 s. Both failures are
  timing limits in service tests that import none of the changed code:
  - `instruction-readiness.test.ts` hit the 15 s test timeout. This was
    already known, from the earlier budget-integration report.
  - `scale-pages.test.ts` failed "expected 751.1 to be less than 500", a
    500 ms speed limit for paging.
  - **Alone:** `instruction-readiness` passed 1/1 in 6,697 ms. `scale-pages`
    passed 3/3; the paging case took 879 ms including setup.
  - **The count:** 991 before this task, plus 38 new tests, gives 1,029:
    - 6 table tests;
    - 21 grant failure tests;
    - 3 guard tests;
    - 4 runner tests;
    - 2 recovery guard tests;
    - 2 end-to-end tests.
- **Runtime suite, second full run:** `Tests 5 failed | 1024 passed (1029)`,
  114 s.
  - All 5 failures were the 15 s test timeout. One of them also left its
    SQLite file locked during cleanup (`EBUSY`).
  - The failing files were `durable-patches`, `service-adaptation/subflow`,
    `service-bootstrap/adaptation`, `service-flows/subflows` and
    `service-recordings/proposals`. None of them is the pair that failed in
    the first run.
  - **Alone,** those five files passed 31/31 in 20 s.
  - The supervisor was editing `deepseek-provider.ts` during this run.
- **Scope tightening, after the second run.** `claimCall` now revokes on a
  scope mismatch (see open question 3).
  - I added a case for it to the integrity test.
  - **Control H** (the revoke removed): 1 failed, the integrity test. The file
    was restored and `cmp` confirmed it byte-identical.
  - The type check then exited 0.
  - `llm`, `recovery` and the end-to-end file together: 37 files, 425 passed.
- **Core `pnpm check`, final run: exit 0.**
  - Structure tests: 96 pass, 0 fail.
  - `structure-audit: passed (144 warning(s), 254 baselined)`.
  - All four packages reported `check: Done`.
- **Runtime suite, third and final full run: exit 0.**
  `Test Files 110 passed (110)`, `Tests 1032 passed (1032)`, 91 s.
  - The one extra file, with 3 tests, is the supervisor's new
    `deepseek-json-content.test.ts`. My own additions account for 991 → 1029.
  - The run was on a working tree that also held the supervisor's concurrent
    `deepseek-provider.ts` edit.
- **API, shared host and Secret Keys suites.**
  `npx vitest run src/programs/automation-studio/api src/programs/_shared src/programs/secret-keys --root packages/fluxiq`:
  34 files, 226 passed.
- **Line counts.**
  - `AS/runtime/service.ts`: 6434, untouched.
  - `execution-grants.ts`: 750.
  - `grant-capabilities.ts`: 131.
  - `failure-disposition.ts`: 121.
- **New advisory warnings from my edits.** These are warnings, not failures:
  - `runtime/recovery/` now has 16 source files, past the 15-file advisory
    threshold.
  - `recovery/tests/runtime-exploration.test.ts` is 487 lines, past the
    400-line advisory threshold.
  - No baseline file was touched.

## Not verified

- **No live DeepSeek run.** Everything here uses a stand-in endpoint, as the
  brief required.
- **Real Secret Keys and Identity Access** were not exercised. The grant tests
  use the shared stand-in, which already mimics one-use and expiring
  authorizations.
- **Flow Bootstrap with a surviving grant was not tested.** By reading the
  code:
  - Its evidence loop does not use the runtime exploration runner, so it still
    ends at the first bad decision.
  - `service.ts:2040` revokes its grant in a `finally`.
  - So the only change there is that the grant is revoked when generation
    ends, rather than at the bad reply.
- **The service entry point** (`runRuntimeSession` and the host's grant
  binding) was not driven. The end-to-end test mirrors the host binding, as
  the earlier test does.
- **Not run:** the whole Core `pnpm test`, `pnpm build`, the Lab, the web
  panel, or a browser.
- **The diagnosis and the patch are still single calls and are not retried.**
  - A bad diagnosis reply still ends the recovery: the plan requests nothing
    from a failed diagnosis.
  - A bad patch reply leaves the recovery with no patch.
  - The grant survives both, which only matters if something later asks
    again.
- **No backoff after a 429.** Three rate-limited answers in a row stop the
  exploration on the guard within a moment.
- **A timing risk in the end-to-end timeout case.** It relies on the
  diagnosis and patch finishing within a 1 s per-call deadline. The stand-in
  endpoint answers at once and the case passed under full-suite load, but a
  heavily loaded machine could time the diagnosis out too.

## Open questions or contradictions found

1. **A misleading code on the receipt.** When the grant's own credential check
   refuses a reveal, it revokes the grant first, and that abort reaches the
   adapter before the refusal does. The call is therefore recorded as
   `llm.provider_aborted` rather than `llm.provider_secret_unavailable`. This
   happens for a revealed key that is not the authorized one, and for a
   credential found in the outbound body. The grant ends either way. This is
   existing behaviour and I did not change it.
2. **Documentation is out of date.** Core architecture docs that say a failed
   call revokes the grant, or that list three no-progress reasons, now need
   updating. `docs/` was out of scope and was not checked.
3. **Two refusals in `claimCall` did not revoke before this task.**
   - **"Scope mismatch" now revokes.** The brief says a claim-integrity
     failure must revoke, and no legitimate path reaches this refusal: only a
     caller changing its scope object after `resolve` does.
   - **"Already has a call in progress" still does not revoke.** Revoking
     would kill the first call, which the existing concurrency test expects to
     complete. The new deadline handling removes the one legitimate way the
     runtime used to reach this refusal (a caller moving on right after a
     timeout). Whether a concurrent call should end the grant is a decision
     for the supervisor.
4. **Downstream consumers.** No exhaustive map over no-progress reasons exists
   in `apps/web` or in this repository (grep found none). The Lab report may
   want to show `unusableDecisions` and `unusable_decision`.
5. **The brief's "the 17 pre-send codes"** matches
   `AUTOMATION_STUDIO_LLM_PROVIDER_PREFLIGHT_ERROR_CODES` exactly (17 entries,
   pinned by a test).
6. **How "a budget breach reported by the ledger" was read.** The run ledger
   refuses before a call is made, so the grant never sees that refusal. The
   breaches the grant can see are the provider billing past a call's limit
   (`usage_limit_exceeded`) and its own token and cost totals. All of these end
   the grant.
7. **The supervisor's concurrent change.** The coordinator said
   `llm.provider_malformed_response` must stay a spent call. It is one in the
   table.
   - I did not touch `deepseek-provider.ts` or `deepseek-json-content.test.ts`.
   - My malformed test replies are `not json` and a cut-off object. Both stay
     malformed under a parser that tolerates one extra `}` at the end.
8. **Line endings.** Files I edited or created are LF in the working tree;
   git warns they will become CRLF when it next touches them. The index stores
   LF (`core.autocrlf=true`), so committed content is unaffected.
9. **The files I changed, all in Core under `AS/runtime/`.**
   - **New:**
     - `llm/failure-disposition.ts`
     - `llm/grant-capabilities.ts`
     - `recovery/unusable-decision.ts`
     - `llm/tests/failure-disposition.test.ts`
     - `llm/tests/execution-grant-failures.test.ts`
   - **Edited:**
     - `llm/execution-grants.ts`
     - `llm/harness/run.ts`
     - `llm/index.ts`
     - `llm/provider-contract.ts`
     - `llm/runtime-session-grant.ts`
     - `llm/tests/execution-grant-fixture.ts`
     - `recovery/annotation/exploration.ts`
     - `recovery/annotation/tests/iteration-guards.test.ts`
     - `recovery/exploration-budget.ts`
     - `recovery/index.ts`
     - `recovery/progress-guard.ts`
     - `recovery/runtime-exploration.ts`
     - `recovery/tests/progress-guard.test.ts`
     - `recovery/tests/runtime-exploration.test.ts`
     - `recovery/tests/stages.test.ts`
     - `tests/deepseek-recovery-requests.test.ts`
   - **The last one is outside `llm/` and `recovery/`.** It is the existing
     end-to-end test of the two together. Core's placement rule puts a test
     with both as subjects in their nearest shared `tests/` folder, which is
     this one.

# t407 — Fresh live-authorization preconditions

## Disposition

**NO-GO now.** This report does not authorize a provider call, Lab run, browser session, or panel
operation. T385 now records provider-free downstream GO with the exact documented task-fixture
machine exception, but final candidate/staged-path review, post-document identity capture,
provider-free launch readiness, no-hindsight Stage 1, and fresh command-specific authorization have
not been established. Run 4 fired the binding no-unchanged-run-5 stop, the pass streak is 0, and
provider-free correction evidence is not live convergence evidence.

After downstream closure, the senior supervisor may prepare a *candidate* no-hindsight record only
if every gate below is satisfied against one settled tree. The candidate becomes authority only
through a fresh explicit authorization made after reviewing that record. No earlier run-4 grant,
readiness record, or general instruction to continue the loop carries across the fix-first stop.

## Facts that must be frozen before authorization

Freeze these facts together, before execution and without later replacement from run output:

1. **Disposition and hypothesis.** Name run 4 (`run-muje0grk-4d8d2d3f`) as the latest accepted
   measurement; record its Stage-2 terminal pair
   `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`, zero-pass
   streak, and the measured source change being tested: lossless `step_rows_v1` packing of all
   bounded draft inputs inside the unchanged 4,000-byte reservation. State explicitly that this is
   a test of convergence after that correction, not a claim that convergence has been proved.
2. **Settled repository identity.** Record UTC capture time, repository roots, branch names, exact
   Core and downstream `HEAD` SHA-1s, exact porcelain status/path sets, and `git diff --check`
   results. Freeze the reviewed candidate source/test/config/generated-document path set. Any later
   edit, regeneration, staging change, branch/HEAD change, or unexpected status path invalidates the
   record until its affected gates are rerun.
3. **Core closure identity.** Bind the record to the final Core check/test/build/docs and freshness
   evidence, including the 5,437-pass/one-intentional-skip root-test result from t395 only while its
   source/test/config preconditions remain unchanged, and t406's lowered-only baseline plus passing
   `pnpm structure:check`. Record the final Core build identities used downstream; do not substitute
   t379's earlier package-only GO for final root closure.
4. **Downstream closure identity.** Bind the record to t385's final provider-free GO after the full
   corrected dependency rebuild, downstream root gates, package gates, host/marker checks,
   junction/runtime resolution, and all six strict source/dependency-to-output freshness
   comparisons. Its observed repository identities were downstream
   `5b8429c543fdc27eb892c225641717aed43c5dc4` and Core
   `d035e1b7d17977951a2a2ec6b5e51570e3f2c537`; final package counts included domain 847/847,
   extension 832/832, Scenario Lab 571/571, and test-runner 1,470/1,470. `pnpm check` was nonzero
   only because `pnpm task:test` hit the exact known `git worktree add` machine failure (89/120
   passed, 31 failed, `cannot spawn git: Exec format error`); every non-worktree gate passed. Freeze
   those facts without relabelling root `pnpm check` as an unqualified pass. Because later reports
   change the dirty path set, recapture final statuses/paths immediately before authorization rather
   than reusing t385's counts of 95 downstream and 179 Core paths.
5. **Privacy and inclusion boundary.** Freeze the final staged-path/candidate inclusion and exclusion
   review, generated-artifact disposition, and sensitive-data scan. T405 is documentation-only GO;
   it does not replace the final candidate-file scan. Record only secret *presence/readiness*, never
   secret values, bearer/pairing tokens, request headers, raw prompts/responses, page values,
   selectors, browser state, or raw run artifacts.
6. **No-hindsight Stage 1.** Before the run, freeze the exact instruction source and digest, the
   expected action/Flow chain, and the oracle identity/digest. The expected result remains exactly
   13 ordered records over `name`, `price`, `rating`, and `url`, with exact predicates,
   organic-only extraction, all-page traversal, stable order, and identity-based de-duplication.
   Count-only or post-run reconstructed expectations cannot qualify.
7. **Evidence and debug contract.** Freeze the artifact schema/version, finalized marker/index and
   digest checks, conservative-redaction requirement, bounded structured-artifact allowlist, and
   the complete Stage 1–terminal debug obligation. Missing evidence is recorded as `NO EVIDENCE`;
   raw provider/page/browser material is not opened merely to fill a gap.

## Commands and request identity that must be frozen

The authorization record must reproduce the exact commands actually observed during closure; it
must not paraphrase them. At minimum it must include, with working directory and exit code:

- the final Core commands and the final t385 downstream rebuild/root/package/freshness commands;
- the read-only identity commands that produced both `git rev-parse HEAD`, porcelain status/path
  sets, both `git diff --check` results, Core junction targets, and runtime resolution to Core's
  `fluxiq/dist/index.js`, `fluxiq/dist/core/index.js`, and
  `client-gateway-websocket/dist/index.js`;
- one post-closure provider-free dry-run command, copied verbatim with secret values omitted, whose
  observed result is `ready`, invokes zero provider calls, and emits the intended runnable request;
- the exact Stage-1/no-hindsight generation or comparison command and its frozen output identity;
  and
- the prospective live command copied byte-for-byte from that accepted dry-run request. It must not
  be reconstructed manually or executed while freezing the record.

The dry-run request and prospective live command must agree on this unchanged identity:

- isolated `everything-store` created-Flow lane;
- DeepSeek profile `mvp-hard-scenario`;
- task `everything-store-plus-earbuds-under-50`;
- exactly one replay;
- no budget override and no timeout enlargement;
- default ceiling of 26 provider calls; and
- the existing per-request ceilings (48,000 input, 8,000 output, 56,000 total tokens) and existing
  cost ceilings (USD 0.25 per call and USD 2 total), as previously published—not newly proposed
  budgets.

Also freeze the Lab instance/run-output target and prove immediately before launch that no other
Lab/live run is active. Only one live Lab run may exist on the machine; a separate worktree or Lab
instance does not relax this machine-wide rule. No test/build/provider job may still be mutating or
loading the frozen outputs.

## Authorization and panel boundary

The supervisor must make the fresh live authorization explicitly after reviewing all frozen facts,
then identify the single command and single run it covers. This report, a worker GO, successful
provider-free gates, secret availability, or a dry-run `ready` result is not authorization.

Starting, stopping, or restarting the FluxIQ web panel is a separate operation that requires the
user's explicit authorization for the current session. A live-run authorization does not imply
panel-management authority. If the qualifying Lab path does not require panel management, leave the
panel untouched; if it does, the absence of current-session user permission is a stop condition.

## Explicit NO-GO conditions

Do not authorize or launch if any one of these is true:

- t385's provider-free GO no longer applies to the candidate tree, any non-worktree Core or
  downstream gate is nonzero, the task-fixture result differs from its exact documented machine
  exception, or any freshness, junction/runtime identity, host, marker, or generated-output
  comparison is missing or stale;
- either repository identity/status differs from the frozen record, an unreviewed path appears, or
  t395/t406's conditional evidence has been invalidated by a relevant edit;
- the final privacy/staged-path scan is incomplete or finds a secret, token, raw provider/page
  content, browser state, raw artifact, or unapproved generated output;
- the provider-free dry-run is not `ready`, makes a provider call, does not yield one exact runnable
  command, or disagrees with the frozen scenario/profile/task/replay/default-budget identity;
- Stage 1, oracle identity, the expected 13-record ordered contract, artifact capture/redaction
  contract, or full-debug plan was written or altered after looking at run output;
- any call/token/cost/timeout ceiling is raised, answerability is weakened, provider retry is added,
  or the run differs materially from the measured correction without a new measured fix and fresh
  closure;
- another Lab/live run exists, its absence is uncertain, or concurrent validation/build work could
  contend for browsers, ports, CPU, or frozen outputs;
- provider credentials/readiness are absent, expired, or can be established only by exposing their
  values;
- current-session user authorization is absent for any required panel start/stop/restart;
- the senior supervisor has not issued a fresh, command-specific authorization after all preceding
  facts were frozen; or
- anyone proposes treating a failure as retry permission. A failure resets the streak and must be
  fully debugged before a measured fix or any further provider call.

Even after a qualifying run is authorized, it can provide at most the first pass. MVP exit still
requires two consecutive independent passes under the unchanged default profile, and the second
provider call needs its own post-debug, still-valid authorization decision.

## Scope

I read only the assigned plans/rules and reports. I did not run tests, builds, providers, browsers,
Lab tooling, panel commands, staging, commits, or pushes; did not inspect secrets or raw artifacts;
and did not authorize a run. This report is my only edit.

# t420 — Next fresh-run no-hindsight contract

## Disposition

**NO-GO for a provider call now; GO as a copy-ready authorization checklist after every pending
item below is frozen and independently verified.** Run 4 remains the latest accepted live
measurement, the consecutive-pass streak is 0, and its repeated Stage-2 exhaustion forbids an
unchanged retry. The next eligible call is instead a single convergence measurement of the settled
`step_rows_v1` packing correction, with the scenario, instruction, oracle, profile, budgets, and
acceptance threshold unchanged. Provider-free evidence does not predict or prove live convergence.

## Frozen request identity

Mark this section GO only when one provider-free dry run returns `ready`, makes zero provider calls,
and supplies one runnable command that is copied byte-for-byte into the authorization record:

- scenario `everything-store`, isolated created-Flow lane, no variant;
- provider/profile DeepSeek / `mvp-hard-scenario`;
- task `everything-store-plus-earbuds-under-50`, LLM task `create-flow`, exactly one replay;
- the same canonical instruction source used by t331, frozen by path, strict UTF-8 normalization
  rule, byte count, and SHA-256 without reproducing page, provider, credential, or browser content;
- the same nine-step expected chain attested by t340, frozen by canonical source-slice identity and
  digest rather than reconstructed after the run;
- no call, token, cost, timeout, retry, concurrency, target, Lab-instance, or run-root override;
- per request: 48,000 input, 8,000 output, and 56,000 total tokens, USD 0.25 estimated
  cost, and an effective 25-second request timeout (the declared 30 seconds is clamped to Core's
  ceiling); and
- per grant: at most 26 calls, 560,000 total tokens, and USD 2 total estimated cost, with zero
  provider retries and concurrency fixed at one.

The created-Flow invocation may issue two distinct sequential grants with that same envelope: one
`build_and_adapt` grant for the build, then one `diagnose_and_adapt` grant for playback,
verification, and any proposed repair. The deterministic replay issues no grant and makes zero
provider calls. Thus 26 calls, 560,000 tokens, and USD 2 are **not invocation-wide totals**. The
source-proven worst-case authorization exposure for this lane is two grants: up to 52 provider
calls, 1,120,000 grant-total tokens, and USD 4 estimated cost across the invocation. This is the sum
of two separately enforced grant envelopes, not a third invocation-level aggregate budget; the
second grant is never reached if the build does not progress to playback.

Any mismatch between the accepted dry-run request and prospective live command is NO-GO. The
record must also bind the settled Core/downstream HEADs and clean statuses, final relevant checks,
fresh output identities, privacy scan, one-Lab predicate, output target, and credential readiness.
The exact launch process must prove inherited `FLUXIQ_LAB_INSTANCE` and `FLUXIQ_TEST_RUNS_DIR` are
absent or explicitly cleared; `FLUXIQ_TEST_ENV_FILES=none` does not clear inherited process
variables. This is required to prove the default Lab instance and default repository `test-runs/`
root. Do not record secret values.

## Stage 1 assertions frozen before output exists

The pending debug must state, and an independent ordinal comparison must attest, all of the
following before launch:

1. This is one measured-correction run after accepted run 4
   (`run-muje0grk-4d8d2d3f`), whose terminal family was
   `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`; it is not
   another unchanged run-4 retry.
2. The only convergence hypothesis is lossless `step_rows_v1` packing of all bounded draft inputs
   within the unchanged 4,000-byte reservation. No weakened answerability or enlarged allowance is
   under test.
3. The instruction and nine-step chain are the frozen canonical identities above. Their text may
   not be regenerated from live output or edited after launch.
4. The oracle is exactly 13 ordered records from `extract-plus-under-fifty`; every record must
   satisfy `kind === "earbuds"`, `plus === true`, `rating >= 4`, and `priceCents < 5000`.
   `name`, `price`, `rating`, and `url` must match in exact order. Organic-only extraction,
   all-page traversal, stable order, and identity-based de-duplication are mandatory; count alone
   cannot pass.
5. The exact existing run-owned grant may continue only through an authorized binding update. It
   may not be minted, replaced, widened, reset, transferred, or spared terminal revocation.
6. The pre-run streak is 0. One complete pass can advance it only to 1.

Run id, UTC date, observed model, calls/tokens/cost, reported verdict, and stage reached remain
explicitly `pending`; no prior-run trace or predicted live result may fill them.

## Evidence and debug obligations

Before launch, freeze the artifact schema/version, finalized marker/index and digest checks,
conservative-redaction policy, and bounded structured-artifact allowlist. The debug must reserve
sanitized fields for request identity; repository/build identity; reported verdict and highest
stage; decision/tool-call summaries; Flow proposal/review/creation; runtime and exact oracle result;
judgement/refutation; repair directive, application, persistence, and authoritative binding;
selected-Subflow zero-provider replay; post-replay judgement; terminal grant revocation; and
disjoint call/token/cost accounting. A missing fact is `NO EVIDENCE`, never an invitation to open
raw content.

After the one invocation, parse only the final nonblank stdout JSON in memory. Require a safe run id
matching `^[A-Za-z0-9._-]{1,128}$`; rename the pending debug to that id before inspection; require the
default `test-runs/<run-id>` path and closed `passed|failed` verdict. Then run silent integrity
inspection and require matching identity, `valid: true`, artifact-index schema `0.1`, exactly one
safe index entry per requested artifact, redaction `applied` or `verified`, and matching `run.json`
identity/verdict with manifest redaction `verified` or `not_applicable`. Until all gates pass, no
semantic artifact may be read. Never display or open raw stdout/inspection objects, prompts,
responses, page rows, logs/events, HTML/screenshots, selectors, credentials, headers, cookies,
browser state, hashes, unindexed artifacts, or authorization material.

## Authorization, stop, and pass branches

Immediately before launch, prove no other Lab/live run or competing build/test job is active,
`FLUXIQ_LAB_INSTANCE` and `FLUXIQ_TEST_RUNS_DIR` are absent/cleared in the exact launch process, and
the frozen repositories/outputs are unchanged. Panel start/stop/restart requires separate
current-session user authorization if the qualifying path needs it. Only after all gates are GO may
the supervisor issue fresh authorization naming the exact single command, single invocation, and
potential two-grant exposure (at most 52 calls, 1,120,000 grant-total tokens, and USD 4 estimated
cost; zero retries; concurrency one; replay zero-provider).

- **Pass 1:** accept only a finalized integrity-valid bundle with `verdict: passed`,
  `flowCreated: true`, `oracleVerdict: passed`, `reportedVerdict: passed`, confirmed verification,
  the exact ordered 13-record/four-field result, and one zero-provider deterministic replay. If a
  repair occurred, also require screened actionable direction, applied and persisted adaptation,
  authoritative binding, selected-Subflow replay, post-replay judgement, and terminal revocation.
  Then the streak becomes 1; stop and fully debug before considering another call.
- **Pass 2:** requires a second independent run under the same unchanged scenario, instruction,
  oracle, profile, budgets, and acceptance threshold, plus a new post-debug readiness freeze and a
  new explicit command-specific authorization. Only another complete pass makes the streak 2 and
  satisfies the two-pass live exit criterion.
- **Any failure/facility fault:** consumes the authorized invocation and leaves/resets the streak to
  0. Bind and classify any safe finalized evidence, but do not retry automatically. A missing or
  unsafe id, integrity/redaction/identity failure, budget breach, or repeated cannot-answer outcome
  is NO-GO for semantic reading where applicable and NO-GO for another provider call until a
  measured fix and fresh closure exist.

## Copy-ready GO/NO-GO authorization line

> **GO / NO-GO:** I verified the settled Core/downstream identities and checks; accepted the
> zero-provider `ready` dry run; attested the immutable Stage 1, 13-record ordered oracle, evidence
> contract, privacy boundary, credentials, one-Lab predicate, and absence/clearing of inherited Lab
> instance and run-root variables; and confirmed the exact live command matches the accepted
> request byte-for-byte. I understand that this one invocation can issue two sequential grants,
> each capped at 26 calls, 560,000 tokens, and USD 2, for a derived maximum exposure of 52 calls,
> 1,120,000 grant-total tokens, and USD 4; requests remain capped at 48,000 input / 8,000 output /
> 56,000 total tokens, USD 0.25, and 25 seconds, with zero retries, concurrency one, and a
> zero-provider replay. **GO** authorizes exactly that one invocation and no retry. Any unchecked or
> changed item means **NO-GO**.

## Scope

I reconciled only the assigned Current State and t331/t340/t346/t407 reports. I did not access raw
artifacts, provider/page/browser content, secrets, the panel, Lab, a browser, or a provider; did not
run tests/builds or inspect live processes; and did not edit source, a shared working document, or
Stage 1. This report is my only write and does not itself authorize a live run.

# t422 — Live credential and capture gate

## Disposition

**GO for the credential resolver and capture procedure; this is not live-run authorization.** T419
reported the settled corrected-order rebuild/freshness gates green (freshness 6/6, markers 12/12,
and Core identities 3/3) and its exact provider-free seam returned `ready` with zero provider calls
and the unchanged isolated created-Flow request/profile/task/replay/default budgets. Final
clean-tree recapture and command-specific authorization remain supervisor-owned gates.

The credential name is `DEEPSEEK_API_KEY`; its value was never printed or persisted. It is absent
from this worker's inherited process, while the ignored repository `.env.local` contains a
syntactically nonblank declaration and t419 reported only credential-source metadata naming
`DEEPSEEK_API_KEY` from `.env.local`. The live credential resolver reads the process value first,
then parses `.env`/`.env.local` but returns only this provider's single named assignment; it rejects
blank, implausibly sized, or control-character-bearing values. Separately,
`FLUXIQ_TEST_ENV_FILES=none` prevents saved target/base-URL/account settings from entering the test
environment, and spawned scenario/Core environments remove provider-secret variables. This is GO
for local presence and syntactic resolver readiness without widening target configuration. Actual
provider acceptance is deliberately unproved until the one authorized invocation; no provider-free
check can validate it.

## Required capture order

The safe procedure is the corrected t266/t346 sequence:

1. Retain t419's accepted provider-free `ready` result with zero provider calls, and use its single
   prospective live seam below without reconstruction or alteration.
2. Freeze and independently attest the unused pending Stage-1 debug before launch. Immediately
   before launch, recheck the settled identities, outputs, one-Lab predicate, absence of competing
   jobs, and credential presence/nonblank status by name only.
3. Invoke the authorized command exactly once. Retain stdout only in memory and send stderr to the
   null sink. Never print, format, serialize, or save the raw stdout/result object.
4. Parse only the final nonblank stdout JSON line in memory. Require a safe run id matching
   `^[A-Za-z0-9._-]{1,128}$`; clear the raw variables on every stop path. A nonzero exit with a safe
   id may still be a finalized product failure; missing or unsafe identity is a hard stop.
5. Before inspecting any bundle content, require that the destination debug path does not exist and
   rename the pending debug immediately to `<run-id>.md`. Never overwrite a prior debug.
6. Require the reported path to equal the default `test-runs/<run-id>` path and the CLI verdict to
   be closed (`passed` or `failed`), then clear the retained live-result variables.
7. Run `inspect <run-id>` with stdout retained only in memory and stderr discarded. Parse only its
   final nonblank JSON line; require exit 0, `valid: true`, matching id, and matching default path,
   then clear all inspection variables. Do not print the inspection object or hashes.
8. Only after inspection, check artifact-index schema `0.1`, unique required entries, and every
   indexed redaction state (`applied` or `verified`); then check `run.json` identity, closed verdict,
   and manifest redaction (`verified` or `not_applicable`). Any failure stops semantic reading and
   any further provider call.
9. Open only the minimum indexed structured artifacts in the established order: `run.json`,
   `summary.json`, `evaluation.json`, `snapshots/live-llm.json`, then conditional flow-lane,
   extraction-mismatch, and repair-lane snapshots. Record missing facts as `NO EVIDENCE`. Never open
   raw provider/page content, logs/events, HTML/screenshots, selectors, credentials, headers,
   cookies, browser state, profiles, raw datasets, or unindexed artifacts.

The pending debug remains bound to the real run id after any post-rename stop. A failure consumes
the single authorization and never implies retry permission.

## Prospective command seam

T419's accepted provider-free command set only the two isolation variables below and ended in
`--dry-run`. The sole prospective live seam is the same command with only `--dry-run` absent,
wrapped by the required memory-only stdout/null-stderr capture:

```powershell
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_TEST_TARGET = 'isolated'
$liveRaw = @(& node packages/test-runner/dist/cli.js run everything-store `
  --target isolated `
  --live-llm `
  --llm-profile mvp-hard-scenario `
  --llm-provider deepseek `
  --llm-task create-flow `
  --instruction-task everything-store-plus-earbuds-under-50 `
  --replays 1 2>$null)
$liveExitCode = $LASTEXITCODE
```

No budget, timeout, retry, concurrency, target, Lab-instance, or run-root override is present. The
full parse/rename/inspect/redaction order above is part of the seam, not optional follow-up. This GO
becomes NO-GO if the exact command changes, the credential resolver no longer reports the expected
name/source, the frozen tree/output identity changes, one-Lab/competing-job checks fail, or fresh
command-specific authorization is absent. It does not grant panel-management authority.

## Pending Stage-1 construction checklist

Create a new, unused pending debug only after the candidate tree and command are settled. Before
launch, it must contain all items below and then remain byte-stable; none may be reconstructed from
provider-free or live output.

- **Preamble and provenance:** state that the file and Stage 1 were completed before launch and
  before any new-run artifact was opened; later facts come only from integrity-valid sanitized
  evidence; missing facts become `NO EVIDENCE`. Name accepted run 4 as the latest live measurement,
  its Stage-2 terminal family, the zero-pass streak, and the no-unchanged-run-5 rule.
- **Request header:** scenario `everything-store`, no variant, task
  `everything-store-plus-earbuds-under-50`, isolated created-Flow lane, DeepSeek
  `mvp-hard-scenario` / `create-flow`, exactly one replay, the exact t419-derived command/capture
  seam, default 26 calls, existing token/cost ceilings, and an explicit list of forbidden
  call/token/cost/timeout/retry/concurrency/target/Lab/run-root overrides.
- **Measured correction:** state that this is one convergence measurement of lossless
  `step_rows_v1` packing of every bounded draft input within the unchanged 4,000-byte reservation;
  it is not evidence that convergence is already proved and does not weaken answerability or enlarge
  an allowance.
- **Instruction contract:** install the canonical instruction verbatim from its frozen source;
  identify that source and its normalization rule. Include all nine expected chain steps in the
  accepted order, the plausible-but-wrong answer description, and the pre-run hypotheses. Do not
  import any run-4 trace as a prediction.
- **Oracle contract:** name `extract-plus-under-fifty`; require exactly 13 ordered records, the four
  compared fields, exact predicates, organic-only extraction, all-page traversal, stable order, and
  identity-based de-duplication. State that matching count alone cannot pass.
- **Authority and accounting:** freeze continuation of only the existing run-owned grant through an
  authorized binding update; forbid minting, replacement, widening, reset, transfer, drift bypass,
  or missing terminal revocation. Require truthful attempt/response provenance and separate any
  overlapping accounting representations.
- **Pass, streak, and stop rules:** require the finalized integrity-valid passed bundle, Flow
  creation, exact oracle and reported pass, confirmed verification, exact ordered result, and one
  zero-provider replay. If repair occurs, also require screened direction, applied/persisted
  adaptation, authoritative binding, selected-Subflow replay, post-replay judgement, and terminal
  revocation. One pass changes the streak only from 0 to 1; any failure consumes the invocation,
  resets/leaves it at 0, and grants no retry.
- **Evidence contract:** freeze artifact-index schema `0.1`, finalized marker/index/digest and
  identity checks, conservative redaction states, the bounded structured-artifact allowlist, the
  corrected rename-before-inspect order, and complete Stage-1-through-terminal debug fields. Forbid
  raw provider/page/browser/log/screenshot/selector/credential/authorization material.
- **Pre-launch identities:** record Core and downstream roots, branches, exact HEAD identities,
  clean porcelain path sets, both `git diff --check` results, accepted validation/freshness and
  generated-output identities, Core junction/runtime targets, the isolated Lab/output target,
  one-Lab/competing-job result, credential name/source status only, and the single-invocation
  authorization identity. Any later edit, regeneration, staging or HEAD change invalidates them.

Compute and attest, without printing digest values in operator status, these immutable identities:

1. canonical instruction source path, strict UTF-8/LF/terminal-newline rule, logical length/byte
   count, and SHA-256;
2. accepted nine-step-chain source slice coordinates, the same normalized line/byte/SHA-256
   identity, and ordinal equality with the installed pending payload;
3. oracle source/fixture identity and SHA-256, including the exact ordered 13-record/four-field
   contract rather than only its count;
4. normalized pending Stage-1 payload line count, byte count, SHA-256, BOM/line-ending/terminal-LF
   state, and ordinal equality with its reviewed source payload; and
5. prospective live command/request identity copied from t419, plus the settled repository and
   output identities named above.

Only these run-derived header fields may remain literally `pending` at launch: safe run id; UTC
start/end date; observed model (provider remains preconfigured DeepSeek); provider calls, token and
cost accounting; reported verdict/category; and highest stage reached. All decision/tool results,
Flow shape, runtime, dataset comparison, judgement, repair, persistence, replay, and revocation
sections must contain no predicted observation before launch; fill them later from allowed evidence
or mark them `NO EVIDENCE` after the capture gates pass.

## Created-Flow grant exposure audit

**Finding: one CLI invocation can create at most two sequential execution grants, not one.** The
first is the lane's build authorization point; the second exists only after a proposal survives
build/review and the created Flow is about to run. There is no third result-verification grant on
this lane and no code path that renews or replenishes either execution grant.

| Layer | Purpose / occurrence | Calls | Token bound | Cost bound |
| --- | --- | ---: | ---: | ---: |
| One provider request | Any task under either grant | 1 | 48,000 input; 8,000 output; 56,000 total | USD 0.25 |
| Grant 1 | `build_and_adapt`; blank-Flow instruction build | 26 | 560,000 total across the grant | USD 2 total |
| Grant 2 | `explore_and_adapt`; created-Flow playback, result judgement, and repair | 26 | 560,000 total across the grant | USD 2 total |
| Whole CLI invocation | Both grants, when both are reached | **52** | **1,120,000 total** | **USD 4 total** |

The invocation-wide input-only ceiling is 1,120,000 tokens (the aggregate total-token ceiling binds
before 48,000 x 52). The output-only ceiling is 416,000 tokens (8,000 x 52). These are independent
projections under the same 1,120,000 aggregate total-token cap and must not be added together as an
extra allowance. Every request has a 25-second effective timeout and provider retry count zero.
Calls, tokens, and cost are componentwise upper bounds, not a claim that 52 calls can each consume
the per-request maxima: the per-grant token and cost ledgers stop that combination.

The arithmetic comes from the unchanged default plan: each iterating grant asks for 26 calls; an
unspecified run-token budget becomes the smaller of 56,000 x 26 and the ten-request confirmation
threshold, hence 560,000; and each grant's total cost is the smaller of USD 0.25 x 26 and Core's USD
2 grant ceiling. `repairPlan` copies those bounds rather than sharing the first grant's remaining
pot, so the two grants' maximum exposures add at the invocation boundary.

Grant lifecycle details close the possible widening paths:

- `buildAuthorizer` calls the authorization chain once for `build_and_adapt`. The build endpoint
  revokes that grant when generation ends; review/apply does not replenish it.
- `repairAuthorizer` calls the chain once for `explore_and_adapt`. That same held grant covers
  playback, `loop_verification`, diagnosis/evidence/patch work, any result reauthoring, and
  post-repair verification. The lane never calls the available `grantOverride`/`verify_result`
  mechanism, so no separate verification grant is minted.
- An applied binding update calls `continueAfterAppliedFlowAdaptation` on the same grant id. Core
  changes only its execution digest/settings revision after exact scope checks; remaining uses,
  committed tokens, committed cost, deadline, key, actor/session, purpose, and permissions are not
  reset. Failure revokes rather than renews.
- Core may exchange an expiring Secret Keys reveal authorization one-for-one for an in-flight call.
  That is credential-lifetime maintenance, not a new execution grant or provider-call allowance.
- The requested deterministic replay creates no grant and must make zero provider calls. Terminal
  run cleanup revokes the held second grant. A failed/facility outcome creates no retry authority.

Therefore earlier shorthand describing USD 2 or 560,000 tokens as the exact command's “total” is
correct only **per grant**. The conservative pre-launch authorization must disclose the true
invocation-wide worst case: two grants, 52 calls, 1,120,000 total tokens, and USD 4, while retaining
the unchanged per-request and per-grant bounds above.

## Scope

I read only the assigned Current State, reports t266/t310/t331/t340/t346/t407/t420, and the accepted
sanitized run-4 debug; consumed t419's sanitized reported dry-run/freshness facts; inspected only the
credential resolver and environment filter implementation; checked only credential-variable/
declaration presence and syntactic status; traced the downstream created-Flow authorization hooks,
budget planner, and Core grant/continuation implementation; and wrote only this report. I did not
inspect a secret value or raw artifact, invoke a provider/browser/Lab/panel, build/test, create or
edit Stage 1, edit a shared document, or touch staging, commits, or remotes.

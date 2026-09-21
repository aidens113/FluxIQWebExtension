# w2x-verification-agreement

Worker report for plan step L2 (slices C5a, C5b, D5 of
`w2x-existing-flow-and-repair-design.md`, Item 5), paired task t035.
Worktrees: `F:\fxwork\t035\!FluxIQ` and `F:\fxwork\t035\!FluxIQWebExtension`,
branch `task/t035-verification-agreement` in both. Nothing is committed.
Date: 2026-09-21.

## Outcome

**Partial.** The code is built exactly to the Item 5 table and works live.
However, the pass criteria for both live proofs cannot be met by that table.
The flipping verdict I measured live at temperature 0 was **`unknown`**, not
`no`. The table deliberately does not ask an `unknown` a second time, so an
`unknown` still ends the run `refuted`.

- **C5a (Core).** A "does not answer" is now asked a second time with the same
  evidence. The two answers are combined in a new pure
  `result-verification/agreement.ts`, which follows the table exactly. The
  run's record now carries `verdicts` and `calls` and gets one or two
  interventions. Each intervention is marked
  `metadata.source: "verifyAutomationStudioRunResult"` and
  `metadata.verificationCheck` (1 or 2).
- **C5b (Core).** `verify_result` has a fixed allowance of two calls. When no
  count is given it gets 2, and a request for 1 or 2 is accepted.
  `diagnosis_only` is still limited to exactly one.
- **D5 (downstream).** `snapshots/live-llm.json` has a new `verification`
  record listing every verification call.
- **Core web.** The run story has a "Result" step, which shows
  "Unverified: the two checks disagreed".
- **Proof (a), the Core probe (real DeepSeek).**
  - Stored week-ahead playback verified 10 times: **8 `confirmed`, 2
    `refuted`**. Both refutations were a first-call `unknown`. No call
    answered `no`, so no second call was needed.
  - The brief's whole-queue negative control ended `refuted` after **one**
    call, not two: the model answers `unknown`, not `no`.
  - A second negative control I added (the retry-failed-posts instruction)
    ended `refuted` after **two** calls (`no`, `no`), and both interventions
    were marked. The two-call path is therefore proven live.
- **Proof (b), three week-ahead campaign runs.** All three matched 14 of 14
  records. Resulting verification statuses:

  | Run | Status | Cause |
  |---|---|---|
  | 1 | `refuted` | first call answered `unknown` |
  | 2 | `confirmed` | – |
  | 3 | `confirmed` | – |

  In all three, `build.providerCalls == observed.calls`, and the verification
  calls are listed in `live-llm.json`.
- **Supervisor scope addition (empty-result fail-open): not implemented.** It
  contradicts itself, and live runs show that the rule it asks for would fail
  both of its own proof tasks. See the dedicated section below.

## What changed and why

Core (`F:\fxwork\t035\!FluxIQ`), `AS/` = `packages/fluxiq/src/programs/automation-studio/`:

- `AS/runtime/result-verification/agreement.ts` (new) — pure; one or two verdicts → the one verification the run records, per the Item 5 table: yes → as is (`calls: 1`); no+no → `refuted`, code `core.result.does_not_answer_request`, `calls: 2`; no+yes → `unsure`, basis `model_disagreed`, code `core.result.verdicts_disagree`, no failure record; no+unsure/silent/unavailable → basis `model_unconfirmed`, code `core.result.refutation_unconfirmed` (reason names the second call's code); unsure/silent/unavailable first → unchanged, never asked again.
- `AS/runtime/result-verification/verify.ts` — second identical harness call only after a first `does_not_answer`; report returns `interventions` (0–2) in place of `intervention?`; each intervention is stamped `metadata.source` + `metadata.verificationCheck` (the harness does not copy the caller's metadata onto the intervention, so without this the downstream count had nothing to key on — observed live: before the change every verification intervention had `source: null`); a colliding second intervention id gets `.2`.
- `AS/runtime/result-verification/contracts.ts` — bases `model_disagreed`, `model_unconfirmed`; optional `verdicts`, `calls`; new `automationStudioResultVerificationFailsRun` (fail-closed except the two unsettled bases).
- `AS/runtime/result-verification/verdict.ts` — codes `disagree`, `unconfirmed`.
- `AS/runtime/result-verification/verification-status.ts` — performed + unsettled basis → `unverified`.
- `AS/runtime/result-verification/run-outcome.ts` — `failing` via `FailsRun`; `recordedOutcome` adds `verdicts`, `calls`; run detail appends every intervention.
- `AS/runtime/llm/grant-capabilities.ts` — `calls: 2` on `verify_result`, `automationStudioLlmExecutionGrantFixedCalls`, comment rewritten.
- `AS/runtime/llm/execution-grants.ts` (verify_result allowance only) — non-iterating purpose takes `maxCalls ?? fixedCalls`; accepts 1 or the allowance; message `verify_result permits one LLM call or 2.`; `diagnosis_only` keeps `permits exactly one LLM call.`
- `AS/api/contracts/llm.ts` — doc comments only.
- `apps/web/src/features/automation-studio/runtime/RunDetailPanels.tsx` — "Result" story step when `metadata.resultVerification` exists; `model_disagreed` renders "Unverified: the two checks disagreed".
- Tests: new `AS/runtime/result-verification/tests/agreement.test.ts`; updated `tests/run-outcome.test.ts` (scripted per-call answers; two-call refutation, disagreement, unconfirmed ×3, unsure-never-reasked, both interventions stamped), `tests/verification-status.test.ts`, `AS/runtime/llm/tests/verify-result-grant.test.ts` (1 or 2 accepted, 3/26 refused, default 2, a third call refused, diagnosis_only still 1).

Downstream (`F:\fxwork\t035\!FluxIQWebExtension`):

- `packages/test-runner/src/live-llm/live-llm-run.ts` — `verification` in `snapshots/live-llm.json`: `source` (`run-detail`/`absent`/`unreadable`), `status`, `basis`, `code`, `verdicts`, `recordedCalls`, `calls`, per-call `{check, requestId, validationOk, tokens, estimatedCostUsd}`, `totalEstimatedCostUsd`; words and numbers only, Core's reason sentence is not copied. Exploration and verification share one raw `get-flow-run-detail` read (a second read broke `lane-settlement.test.ts`, which asserts one). Usage/budget accounting is deliberately unchanged.
- `packages/test-runner/src/live-llm/tests/live-llm-run.test.ts` — two new tests plus an `absent` assertion.

## Commands run and observed results

**Safety (supervisor note).** Every Lab and campaign run in this report set
`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated
FLUXIQ_TEST_RUNS_DIR=F:/r35`. The `run.json` of each run records
`targetMode: "isolated"`, with gateway ports 62968, 63237, 63589, 64238 and
64434. No run reached the user's panel on port 3000 or the gateway on 4711.
The Core probe ran against a **copy** of
`F:\r19\persistent-isolated\t019-replay\fluxiq-root` placed in my scratchpad,
with DeepSeek called directly. It used no Lab and no panel. The only
dry run (`--dry-run`) touched nothing.

### Live, proof (a): the Core probe

The probe script is
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\9fa9070d-9274-4ad5-ba37-583f15c64762\scratchpad\t035probe\probe.mjs`,
and its results are in the `*.json` files in the same folder.

It verifies run `72b19723-3fe7-4aaf-88f1-b6ba2b81d794`: Flow `flow.c1542a11…`,
14 rows with sha `23782055…`, the run stored as `refuted` on 2026-09-18. It
goes through Core's `verifyAutomationStudioRuntimeSessionResult` using the
stored run detail, the stored instruction, the Flow graph, the web domain's
denied keys and the default policy. Ports are captured in memory. Token limits
are 48k/8k/56k, the same as the Lab grant.

| When | Instruction | n | Result (status / answers) |
|---|---|---|---|
| before change | week-ahead | 10 | 10 `confirmed`/yes |
| before change | week-ahead | 10 | 10 `confirmed`/yes |
| before change | whole-queue | 3 | 3 `refuted`/unknown (1 call) |
| before change | retry-failed (added) | 2 | 2 `refuted`/no (1 call) |
| **after change** | **week-ahead** | **10** | **8 `confirmed`/yes; 2 `refuted`/unknown (1 call, not re-asked per table)** |
| **after change** | **whole-queue** | **2** | **2 `refuted`/unknown after ONE call** |
| **after change** | **retry-failed (added)** | **2** | **2 `refuted`/no→no, `calls: 2`, both interventions `source` set, checks [1,2]** |

The stored refutation did not reproduce: none of 30 verifications of the same
evidence answered `no`. The probe made 41 calls in total, costing $0.05134.

### Live, proof (b): `pnpm lab:campaign social-scheduler-week-ahead --max-attempts 1`

| Run | matched/expected | resultVerification | verification calls listed | build.providerCalls = observed.calls | cost |
|---|---|---|---|---|---|
| `F:\r35\run-mublcbqf-9e815106` | 14/14 | **`refuted`** (`core.result.verdict_unsure`, verdicts `[unsure]`) | 1 (check 1) | 4 = 4 | $0.0202 |
| `F:\r35\run-mublh450-f8808c44` | 14/14 | `confirmed` | 1 (check 1) | 5 = 5 | $0.0250 |
| `F:\r35\run-mubln4ri-e9277338` (after the one-read settlement change) | 14/14 | `confirmed` | 1 (check 1) | 5 = 5 | $0.0250 |

In run 1 the oracle `passed` but the reported verdict was `failed`
(`ambiguous_or_unknown`). No campaign run's first answer was `no`, so none
exercised the second call.

### Live, the supervisor's scope addition (current code; the change was not implemented)

- `pnpm lab:campaign data-table-inventory-empty --max-attempts 1` produced
  `F:\r35\run-mublwjzb-13bdfac0`. The oracle `passed` with 0 of 0 (the
  expected dataset is empty). The run `succeeded` with `resultVerification`
  `no_result` (`core.result.nothing_to_judge`) and 0 verification calls. The
  Flow was `web.browser.navigate` followed by `web.dom.extract_list`.
- `pnpm lab:campaign social-scheduler-schedule-post --max-attempts 1` produced
  `F:\r35\run-mublz4fv-fc84370f`. It returned after 187,441 ms with no hang;
  the oracle `passed`; the run `succeeded` with `no_result` and 0
  verification calls. The Flow **contains one `web.dom.extract_list`**, and
  so did t024's run (`F:\r24k\run-muabdpmu-6c1f639d`, `extractNodes: 1`).

### Tests and checks

These ran after the live runs, except for the first focused vitest pass.

- **Core focused vitest**, from `packages/fluxiq`, covering
  `result-verification`, `verify-result-grant`, `execution-grants` and
  `api/contracts/tests/llm`: 94 of 95 pass. The one failure is
  `run-outcome.test.ts` › "fails a run that stored nothing without spending a
  call" (`expected 'succeeded' to be 'failed'`). It already fails on dev: t024
  commit `5616d73` changed `nothingToJudge` and did not update the test. My
  change leaves that code path untouched.
- **Core `pnpm check`** (root) exited 0. Structure tests passed 182 of 182,
  task tests passed 20 of 20, and the structure audit reported
  `passed (168 warning(s), 361 baselined)`. `tsc` passed for `fluxiq`,
  `client-gateway-websocket` and `apps/web`.
- **Core `pnpm build`** (root) exited 0, including the Next build of `apps/web`.
- **Core web focused vitest** on
  `apps/web/src/features/automation-studio/runtime`: 46 of 46 passed. The
  first attempt reported one unhandled `SyntaxError` while loading a module
  (7 of 8 files ran, all tests passed). It did not recur on rerun; it looks
  like a flake, possibly the faulty RAM.
- **Downstream test-runner**: `pnpm build`, then
  `node --test "dist/live-llm/tests/*.test.js"`, passed 73 of 73.
- **Downstream `pnpm check`** exited 0, with the structure audit at
  `passed (81 warning(s), 122 baselined)`.

## Not verified

- **The disagreement and unconfirmed paths live.** No live first call
  answered `no` on correct rows, so `model_disagreed` and `model_unconfirmed`
  are covered only by unit tests. The panel rendering of "Unverified: the two
  checks disagreed" was never seen in a browser; only type-checking and the
  existing web tests exercise it.
- **The C5b allowance through a real issued grant.** Nothing in this
  repository issues a `verify_result` grant (live-llm-run's own comment says
  so), so the 2-call allowance is proven only by `verify-result-grant.test.ts`
  against the real grant service.
- **The t019 HTTP timeout.** t019 saw 30-second timeouts on persistent
  builds. A second verification call adds about 3–5 s after a run, but no
  `no` occurred live, so that timing was not measured.
- **Full suites.** I did not run them, as the brief required.

## Open questions or contradictions found

1. **Proof (a) and (b) cannot pass under the Item 5 table.**
   - **What flips is `unknown`.** Live, at temperature 0, the flip was
     `yes`↔`unknown`: 2 of 10 probe verifications after the change, and 1 of
     3 campaign runs. Over 33 judgements of correct 14-row results, `no` never
     appeared. The table's last row ("unsure, silent or unavailable — not
     asked again — fails closed") therefore still produces `refuted` on
     correct rows. That is a design decision, not a bug, and the brief
     requires the table exactly.
   - **Fix: re-ask an `unknown` once as well.** The smallest change is to
     treat a first `unknown` like a first `no`:
     - `unknown` then `yes` would become `unverified` (`model_disagreed`, or
       a third basis).
     - `unknown` then `unknown` would stay `refuted`.

     This touches only `agreement.ts`, `verify.ts` and their tests. I did not
     make it because it departs from the table.
2. **The whole-queue negative control cannot end "`refuted` after two
   calls."** The model answers `unknown` to it (5 of 5), so it ends `refuted`
   after one call. The retry-failed-posts instruction does produce `no` → `no`
   (4 of 4 calls) and is the working negative control.
3. **Pre-existing failing test on dev (t024, `5616d73`).** I did not change
   it; see the next section.
4. **`agreement.ts` is not re-exported from the `result-verification/index.ts`
   barrel,** which I do not own. Only `verify.ts` uses it, and the structure
   audit does not flag it.
5. **Out-of-scope comments that are now stale.** Two comments still say
   "one call":
   - `AS/runtime/llm/runtime-session-grant.ts:116` has the diagnostic string
     "its one call judges the finished run's result".
   - `TR/live-llm/live-llm-plan.ts:22-30` needs the comment update the design
     names.

   I own neither file.
6. **Verification calls sit outside the run budget.** They are not in
   `llmGate.providerCalls` or `costAccounting`. For a playback with no gate
   record, `repair.observed.calls` happens to count them through the
   intervention fallback. D5 lists them separately and does not fold them
   into `usage.calls` or the budget checks. Whether they should count against
   the run budget is a Core decision.

## Supervisor scope addition: empty results and `core.result.no_records`

**I did not implement it.** The rule and the two live proofs contradict each
other, and the live runs above show the rule would fail both proof tasks:

- **Every Core record set comes from an extraction step.** The rule's
  distinction ("an empty catalog shell from a Flow with no extraction step")
  cannot arise. `runtime/executor/record-capture.ts` creates rows only for a
  node that declared a `recordOutput`, and a dataset's `nodeIds` name that
  node. A Flow with no extraction step stores no record set at all
  (`recordSetCount 0`), which is already `nothing_to_judge`.
- **The schedule-post shell comes from the Flow's own extraction step.**
  `social-scheduler-schedule-post` builds a Flow that ends in
  `web.dom.extract_list` ("Then confirm it is sitting in the queue"). Both
  t024's run and my run today show this, and the step returned 0 rows.
  Under the rule, that run would end `failed` with `no_records`. The required
  proof says it must not be failed for the shell.
- **The empty variant's instruction allows an empty table.** The data-table
  scenario's only empty-variant task is `data-table-inventory-empty`, and its
  instruction (`INVENTORY_MAY_BE_EMPTY`) says "If every product has been
  delisted, an empty table is the right answer". Its oracle expects an empty
  dataset. Live today it passes with 0 of 0 and `no_result`. The requested
  proof ("ends `failed` with `core.result.no_records`") would turn a correct
  deterministic result into a false failure. That violates the addition's own
  rule that a task whose instruction allows empty results must not be failed.
- **Telling "empty is the answer" from "empty is a failure" needs the
  judge.** The difference lives in the instruction, which only a model reads.
  Core keeps the Flow's derived instructed consequences in Flow metadata
  (`bootstrapInstructedConsequences`, `service.ts:4146`), and they could mark
  an action Flow provider-free. However, `canonicalFlowDocument` drops Flow
  metadata before verification, so reaching them needs a new port in
  `service.ts`. That file is over its ratchet and outside my scope. As
  instructed, I am reporting this rather than reopening the deadlock.

**What stands today.**

- The provider-free routing is intact: `run-outcome.ts` sends any result with
  `totalRecordCount === 0` to `verify` without resolving a provider.
- Both live runs returned with 0 verification calls.
- The dev unit test that expects `no_records` for any empty dataset still
  fails. The live evidence argues it asserts the wrong behaviour for
  instructions that allow an empty result.

**A consistent rule for the supervisor to choose.** Keep `nothing_to_judge`
for an empty result, the current and correct behaviour for both proof tasks,
and do one of the following:

- (a) Update the stale test to expect `no_result`.
- (b) Add a service port that passes the Flow's stored instructed
  consequences into verification. Fail `no_records` only when the record-set
  node belongs to a Flow that instructs no lasting consequence, and exempt
  instructions that allow empty results by letting the judge see them.

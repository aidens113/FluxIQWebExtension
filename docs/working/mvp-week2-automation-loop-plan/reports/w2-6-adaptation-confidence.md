# W2-6 — Validating proposed adaptations (confidence)

Worker report. Task branch `task/t007-adaptation-confidence`, worktree pair
`F:\fxwork\t007\!FluxIQ` and `F:\fxwork\t007\!FluxIQWebExtension`. No commit made.

## Outcome in one line

Three of the four claimed gaps were **already closed** at HEAD and were not
rebuilt. The fourth survived only in part: the promotion *rule* existed and was
correct, but **nothing in Core ever produced the evidence it counts**, so
`established` was unreachable in production. That missing producer is what I
built.

## Which gaps survived verification, and how I checked

HEAD of the task branch is identical to `dev` (`git log dev..HEAD` is empty), so
everything below is the state of `dev` as of 2026-09-17. The scoping report was
written against an older Core and is substantially out of date.

### Gap 1 — "a never-executed proposal is recorded as a successful validation and passes the apply gate" — CLOSED

Checked by reading the two places that can write a validation result and the gate
that reads one.

- `AS/runtime/live-patch.ts` `validationResultForVerification` returns a result
  **only** for `verified` (succeeded) and `contradicted` (failed). `not_executed`
  and `unverifiable` return `undefined`, and `adaptationStatusForVerification`
  leaves such a patch in `testing`.
- `targetOverrideProposalAdaptation` (the structurally-checked, never-executed
  proposal) writes **no** `validationResults` at all. Its structural check is
  parked in `metadata.structuralChecks`, with a comment saying why it must not
  live where a consumer asking "was this validated?" would find it. It is
  `status: "proposed"`, `riskLevel: "high"`.
- The apply gate no longer reads status. `AS/runtime/recovery/adaptation-promotion.ts`
  `evaluateFlowAdaptationPromotionGates` asks `applyEvidenceIssue`, which refuses
  an `unverified` tier unless a **named** reviewer approved it, and refuses even
  then when the latest counted result failed.
- The brief's note about `trial.ts` is confirmed: `observedHostRuntime` records
  `passed` only when `checkedConditionCount >= conditions.length` **and** the
  condition list is non-empty; anything else is `unknown`, which is never a pass.

Verified by test as well as by reading: `live-patch.test.ts` (23 tests) and
`adaptation-promotion.test.ts` (28 tests) both pass and assert this behaviour.

### Gap 2 — "confidence is not tiered / not persisted" — CLOSED

- `AutomationStudioChangeConfidence = "unverified" | "provisional" | "established"`
  in `AS/runtime/flow-change/contracts.ts`.
- Persisted: `adaptations.confidence_tier` column in
  `AS/storage/project/adaptation-store.ts`, recomputed from the saved validation
  results on every upsert (`adaptationMatchingColumns`, line 652), written in the
  insert and in the `on conflict … do update` clause, surfaced on
  `AutomationStudioAdaptationSummaryRecord`, and filterable through
  `ListInput.confidenceTier`.
- Validation **kinds** are already persisted too:
  `AutomationStudioFlowChangeValidationKind = "trial" | "replay"` on
  `AutomationStudioFlowAdaptationValidationResult`, with a documented rule that a
  result written before kinds existed reads as `trial`.

So the "distinguish validation kinds / persist which kind produced a confidence"
half of my brief was already done. I added nothing here.

### Gap 3 — "the `testing` status has no consumer" — SURVIVES, but is not a defect to fix here

`testing` is written in two places (`live-patch.ts`
`adaptationStatusForVerification`, and `service.ts` on `request_validation`) and
mapped in the store (`dbStatus` → `pending_approval`, audit event
`validation_requested`, a status reason). A grep for `=== "testing"` across
`packages/fluxiq/src` returns **no** reader outside those mappings.

But this is now deliberate, not an oversight. The confidence work explicitly moved
the gates off status and onto evidence — `adaptation-promotion.ts` says in as many
words that "a `validated` status on its own is a claim about the adaptation and
satisfies neither". Making `testing` load-bearing again would undo that.

What genuinely remains is narrower than the scoping report implies: **nothing
revisits an adaptation parked in `testing`.** The only exit is a person calling
`request_validation`/`setAdaptationStatus`. I did not change this, because it is a
service-orchestration decision and the brief forbids editing `service.ts`. See
"Call site to wire up" below.

### Gap 4 — "no promotion from provisional to trusted after repeated success" — RULE CLOSED, PRODUCER MISSING (this is what I built)

The rule was already right, in `AS/runtime/flow-change/confidence.ts`:
`AUTOMATION_STUDIO_CHANGE_CONFIDENCE_DEFAULT_REPLAYS = 2`, with high/destructive
risk needing one more, replays counted only since the last failure, and
`unverified` on any failure after the last success.

The defect is that **the rule had nothing to eat.** Grepping every non-test file
in `packages/fluxiq/src` for `kind: "replay"` returns nothing: `live-patch.ts`
writes `kind: "trial"` at three sites and that is the only kind Core ever
produced. Each runtime patch also mints a *new* adaptation id
(`adaptation.${runId}.${kind}.${now}`), so results never accumulated on one
record even across repeated repairs of the same failure.

Consequence at HEAD, before my change: every repair in production was capped at
`provisional` for ever, however many times it went on working. `established` was
reachable only from a hand-written test fixture.

The raw material for the fix was already laid and clearly left as a seam — node
metadata carries `adaptationIds` (`withAutomationStudioNodeAdaptationId`), the
executor copies them onto each attempt (`nodeAttemptWithAdaptationIds`), and the
contract comment on `AutomationStudioNodeAttemptTrace.adaptationIds` says the
field exists "so a replay can name the changes it exercised" and that malformed
metadata is ignored whole "because a replay recorder reads this field as proof of
which saved changes ran". There was simply no replay recorder.

## What I changed

New, in Core:

- `AS/runtime/adaptation-confidence/replay.ts` — the replay recorder.
- `AS/runtime/adaptation-confidence/index.ts` — barrel.
- `AS/runtime/adaptation-confidence/tests/replay.test.ts` — 13 tests.
- `AS/runtime/flow-change/attempt-projection.ts` — two helpers extracted from
  `trial.ts` (`automationStudioAttemptCapturedRecords`,
  `automationStudioAttemptVerifiesState`) so the trial and the replay answer the
  same two questions about an attempt identically rather than each keeping a copy.

Modified:

- `AS/runtime/flow-change/trial.ts` — now calls the extracted helpers; its private
  `capturedRecords`, `definitionVerifiesState`, `declaresRecordOutput` and
  `isJsonObject` are deleted. Behaviour unchanged (`trial.test.ts`, 25 tests, still
  passes untouched).
- `AS/runtime/index.ts`, `AS/runtime/flow-change/index.ts` — barrel entries.

Not touched, as instructed: `service.ts`. Also not touched, because they needed
nothing: `AS/model/flow-adaptation.ts`, `AS/storage/project/adaptation-store.ts`,
`AS/runtime/live-patch.ts`, `AS/runtime/service/adaptations/gates.ts`. The brief
expected edits in the first three; they already carry the kinds, the tier column
and the fail-closed result writing. `gates.ts` needed no entry because I added no
patch kind and no status.

### Note on placement

The brief asked for `AS/runtime/adaptation-confidence.ts` with its own `tests/`.
A file at `runtime/` root must be tested from `runtime/tests/`, and adding one
file there took it from 25 to 26 and **failed** `structure-audit`
(`[directory-files] … 26 source files exceeds the 25-file limit`). I made it a
capability directory instead, mirroring `flow-change/`. Audit passes.

## The confidence contract

A **trial** is the change proving itself once, on the run that made it. A
**replay** is a later ordinary run that executed the already-applied change and
was judged by the same verdict rule. The tier rule (unchanged, in
`flow-change/confidence.ts`) is:

| Tier | Meaning |
| --- | --- |
| `unverified` | no succeeded trial or replay, **or** a failure after the last success |
| `provisional` | at least one success, but fewer succeeded replays than required |
| `established` | enough succeeded replays since the last failure, none failing after |

Required replays: **2** by default; **3** for `high` or `destructive` risk. Two,
not one, because one success on a flaky page is indistinguishable from luck.

`recordAutomationStudioAdaptationReplays(input)` takes a finished run's trace and
the saved changes to judge, and returns one outcome per change carrying `before`
and `after` tiers, the `result` to append, the `verdict`, and `promoted`/`demoted`
flags. It is pure — it writes nothing. `withAutomationStudioAdaptationReplay`
appends a result to an adaptation.

## Where it fails closed

Five distinct refusals, each covered by a test:

1. **One run speaks once.** A run whose id already appears among the change's
   saved results is skipped (`run_already_counted`). This is the important one:
   the run that *trialled* a repair therefore cannot also be counted as a *replay*
   of it, so a single run can never supply both observations `established` needs.
2. **Only `applied` changes can be replayed** (`not_applied`). A node carries an
   adaptation id only once `applyApprovedAdaptation` stamped it, so a stamp naming
   a change in any other status is stale metadata, not evidence it ran.
3. **An unjudged expected state is never a pass.** A finished trace keeps no
   record of the host's per-condition answers — only `diffSummary.stateCheckCount`,
   a count. The replay therefore reports `expectedState: "unknown"` unconditionally
   for a node that declares one, producing check code `expected_state_unevaluated`.
   Reading a `matched` comparison as a pass would be exactly the fail-open that
   `trial.ts` was fixed for. Other evidence (declared route, declared outputs,
   records, downstream assertions) is readable from a trace and is used.
4. **A verdict that proves nothing records nothing** (`proved_nothing`).
   `unverifiable` and `not_executed` leave the change exactly where it stood —
   neither promoted nor demoted.
5. **A stamp is the only source of "this node is part of the change."** A node the
   run reached without the stamp is not counted, whatever else it did
   (`not_exercised`).

Demotion is symmetric and deliberate: a replay whose changed node fails again is
recorded as a **failed** replay, which the tier rule reads as `unverified` with
`lastFailure: "replay"`. A repair that has stopped working stops being trusted on
the next run, not on the next person to look at it.

## Mutation testing — each run, observed, then reverted

| # | Mutation | Observed result |
| --- | --- | --- |
| 1 | `AUTOMATION_STUDIO_CHANGE_CONFIDENCE_DEFAULT_REPLAYS` 2 → 1 (promote after one success) | **16 tests failed.** Mine: "promotes on the second succeeded replay and not before" — `AssertionError: expected { Object (tier, trials, ...) } to match object { tier: 'provisional', replays: 1 }`; also "stays provisional after the first succeeded replay" and "makes a high-risk change earn one replay more". Plus 9 in `confidence.test.ts`. |
| 2 | `proved_nothing` synthesises a succeeded replay (treat an unjudged replay as a success) | **2 tests failed**, both mine: "records nothing when the changed node succeeded but proved nothing" and "never reads a declared expected state as judged, since a finished trace holds no answer to it" — both `AssertionError: expected { runId: 'run.later', …(4) } to be undefined`. |
| 3 | tier becomes `established` without checking `replays >= replaysRequired` (no replays reads as trusted) | **18 tests failed.** Mine: "leaves a change with no replays at provisional however good its trial was" — `AssertionError: expected 'established' to be 'provisional'`; plus 7 more of mine and 9 in `confidence.test.ts`. |

All three reverted. `git checkout` restored `confidence.ts` exactly (it now shows
no diff), and mutation 2 was reverted in place and re-verified at 13/13 passing
before mutation 3 was applied.

## Validation — commands and observed output

All run from `F:\fxwork\t007\!FluxIQ\packages\fluxiq` (never a repository root),
except the audit which is a root script.

- `npx vitest run src/programs/automation-studio/runtime/adaptation-confidence/tests/replay.test.ts`
  → `Test Files 1 passed (1)`, `Tests 13 passed (13)`.
- `npx tsc --noEmit -p tsconfig.json` → clean, exit 0. (This is the package's own
  `check` script verbatim.)
- `node scripts/structure-audit.mjs` (from the Core repo root) →
  `structure-audit: passed (162 warning(s), 361 baselined).` Before the directory
  restructure this was `FAIL [directory-files] … 26 source files exceeds the
  25-file limit`, which is what drove the placement decision.
- Neighbouring suites, to prove the `trial.ts` extraction changed nothing:
  `flow-change/tests/` + `live-patch.test.ts` + `training-modes.test.ts` +
  `recovery/tests/adaptation-promotion.test.ts` +
  `executor/tests/attempt-trace.test.ts` → `Test Files 9 passed (9)`,
  `Tests 215 passed (215)`. `trial.test.ts` 25/25 with no edits to it.
- Full program suite: `npx vitest run src/programs/automation-studio` →
  `Test Files 1 failed | 239 passed (240)`, `Tests 1 failed | 2161 passed | 1 skipped (2163)`.
  The single failure was `deepseek-bootstrap-exploration.test.ts`, a **live
  DeepSeek network test**, failing at `expect(run.failure).toBeUndefined()` with
  `code: "flow_bootstrap.provider_transport_unknown"`, `providerInvocation:
  "attempted"`, `providerResponse: "unknown"`. Rerun alone as instructed:
  `Test Files 1 passed (1)`, `Tests 8 passed (8)` in 52s. It is a provider
  transport flake under a 240-file parallel run, not this change — I touched no
  LLM, provider or bootstrap code.

## Call site to wire up (not done — `service.ts` is out of scope)

`recordAutomationStudioAdaptationReplays` has **no production caller yet.** It
needs to be invoked once per finished run, from wherever `service.ts` completes a
run and has both the trace and the flow's applied adaptations in hand, then each
returned `result` appended with `withAutomationStudioAdaptationReplay` and saved.
Until that call exists, `established` remains unreachable in a live system — the
producer exists and is tested, but nothing runs it.

Two things the wiring should decide, which I could not:

- Whether a run that itself invoked the model for a given change should be
  excluded beyond the run-id guard. The run-id guard already covers the common
  case (the trialling run recorded a trial under that run id), but a run that
  patched change A and merely re-executed change B is a legitimate replay of B
  only, and the caller is what knows the difference.
- Whether recording a replay should also move an adaptation out of `testing`
  (gap 3). That is the natural consumer the status currently lacks.

## Not verified

- **No live browser or end-to-end run.** Everything here is unit-level against
  synthetic traces. In particular I have not seen a real run stamp an attempt,
  reach this code and promote a real repair — because, as above, no caller exists.
- **No storage round-trip of a replay result.** `adaptation-store.ts` recomputes
  `confidence_tier` from `validationResults` on upsert, and its own tests already
  cover replays reaching `established` through the column
  (`adaptation-store.test.ts` lines 532, 561), but I did not add or run a test
  that puts *my* recorder's output through the store.
- **`pnpm check` and `pnpm test` at repository scope were not run** — the brief
  forbids running tests from a repository root, and `pnpm check` additionally runs
  `structure:test`, `task:test` and `-r check` across every package. I ran the
  audit and the package's own `check` and `test` directly instead.
- **`biome check` does not cover this code** — the configuration ignores
  `packages/fluxiq/src/programs/**` (it reported "No files were processed in the
  specified paths"), so there is no lint signal on the new files beyond `tsc`.
- **The `testing`-status question is reported, not resolved.** I confirmed no
  reader exists; I did not add one.

## Open questions / contradictions found

1. **The scoping report is stale on three of its four gaps.** Gaps 1, 2 and 4's
   rule are all implemented, most of it landing in commits `aab40c1`, `45a2f9c`
   and `e4fa65b`. Treating the report as current would have produced a duplicate
   confidence module beside `flow-change/confidence.ts`. Worth flagging to whoever
   dispatches the remaining W2 briefs — this is the third time per the brief's own
   note.
2. **The brief's expected file list was wrong in a useful way.** It named
   `flow-adaptation.ts`, `adaptation-store.ts` and `live-patch.ts` as files to
   edit; none needed a change, and the real hole was in a file the brief did not
   name (nothing producing replays). The "verify before building" instruction is
   what caught it.
3. **A patch kind that stamps no node cannot be replayed.** `edit_router` writes an
   *edge* carrying `metadata.adaptationId` and deliberately stamps no node, with a
   comment explaining that otherwise every run of the edge's source would claim
   the route. That is correct for provenance, but it means a route-only change can
   never earn a replay and so can never reach `established`. Reading edge metadata
   during a run would be the fix; it is a separate piece of work and I did not
   attempt it.

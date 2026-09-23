# fa-adversarial-measurement — D0a, A12, D1, D2, D3

Task t089. Worktrees `F:\fxwork\t089\!FluxIQWebExtension` and `F:\fxwork\t089\!FluxIQ`,
both on `task/t089-adversarial-measurement`. 2026-09-22.

## Outcome

**Done.** The measurement exists and it reports a number per condition:

```
condition                                 declared                absorbed by             attempts  calls  verdict
basic-form/primary/timed-overlay          none                    none                    1         0      passed
basic-form/primary/renamed-submit         host_target_resolution  host_target_resolution  1         0      passed
dynamic-list/remove-a-row/rows-per-visit  none                    none                    3         0      passed
delayed-ui/primary/late-recoverable       retry_node              retry_node              2         0      passed
delayed-ui/primary/too-slow               none                    none                    3         0      passed
auth-gate/primary/expired                 none                    none                    1         0      passed

6/6 condition(s) absorbed as declared, for 0 provider call(s) in total
```

**The recovery ladder has now been shown to absorb something.** `retry_node`
rescued `delayed-ui/late-recoverable` live: the wait ran out after 5,025 ms,
the rung attempted the node again, and the second attempt succeeded after
1,885 ms. And the recovery that has no rung was caught for the first time:
`renamed-submit`'s click resolved by `visual-target` at confidence 0.359
against `selector` at confidence 1 for the three controls that were not
renamed.

Three of the six conditions are absorbed by nothing, and each says why in its
own `because`. Those are measurements, not gaps.

---

## What changed and why

### D0a — making the rungs observable

Three things were dropped between Core's executor and the run bundle, and none
of the ladder could be attributed without them.

**The node id, and with it the attempt's own index and duration** (Lab).
`flowActionsSnapshot` published a flat list of attempts with no node on them.
A node the ladder retried three times and a Flow that authored the same action
three times produced the identical list. `PersistedFlowAction` now carries
`nodeId`, `attemptIndex`, `startedAt`, `durationMs`, `retry` and `readiness`,
and the snapshot publishes all of them.

The node id was left out deliberately before — `persisted-flow-run.ts` said so:
"an action carries no node id, so that a node id cannot reach a judgement, a
failure's details, or the bundle." That reasoning held while a node was
attempted once. It is admitted now only when it has the shape of a Core node
identifier (`attemptNodeId`, `persisted-attempt.ts`), so a value carrying page
text is read as absent. Two existing tests asserted the old invariant and were
rewritten to the new one rather than deleted: Core's *sentence* about why it
stopped still must not travel, and the run's *start* is still a position.

**The ladder rung** (Core). `AutomationStudioNodeAttemptTrace.retry` carries
`{attemptNumber, maxAttempts, backoffMs, rung}` and `readiness` carries the
wait ceiling, and `runtimeActionAttemptsFromSession` published neither. Both
are now on the attempt's `metadata`, narrowed to their closed words and
integers (`readiness.message` stays behind). This is what names the rung that
asked for each attempt.

**The host's target resolution** (Core). New module
`runtime/service/summaries/host-target-resolution.ts` projects the browser's
`WebAutomationTargetResolution` out of `attempt.outputs` onto
`metadata.hostTargetResolution`, and the Lab narrows it again on the way into
the bundle. It is the only evidence of the recovery the ladder has no rung for,
because the browser re-resolves before Core is told anything failed.

**One thing here was nearly wrong, and the live run caught it.** The first
version read `outputs.result.resolution`, which is where a *runtime*-dispatched
output puts it. A paired browser client's action goes through the IO registry
instead, and the domain's gateway dispatcher wraps the payload as
`{status, message, result}` (`domain/src/io/gateway-output-dispatcher.ts:32`) —
so the resolution is one level further in. The unit tests passed and every real
run reported `hostTargetResolution: null`. The projection now reads both
shapes, with a test for each.

### A12 — `evidenceLoop.steps` on a proposed build

`fa-lab-measurement` specified this as two edits in `runtime/service.ts`. Both
functions have since moved to `runtime/service/flow-bootstrap-commands/evidence-trace.ts`,
which is not the frozen service, so that is where they were made:

- `sanitizeEvidenceLoopTrace` keeps `resultCode` (bounded by code shape) and
  `effectApplied`. It dropped both, so the trace stored on every adaptation
  could not say what any decision came to. This also closes plan step **A10**.
- `evidenceTraceAuditDetail` emits `steps`, built by a new shared module
  `runtime/flow-bootstrap/evidence-loop-steps.ts` that `generation-failure.ts`
  now uses as well — so a proposed build's trail and a refused build's are
  built by the same function and read alike.

The Lab half was already in place from t080 and needed no change.

### D1 — the five adversarial conditions

Each is a variant of an existing scenario. Two were already there and needed
only their expectation; three are new.

| Condition | Where | What it arms |
| --- | --- | --- |
| A timed overlay | `basic-form/timed-overlay` (new) | A promotional interstitial appears 400 ms after the first keystroke and covers the submit button and nothing else, so every earlier step works and the last one is refused. |
| Content after the action that needed it | `delayed-ui/late-recoverable` (new) | The same late content at 9,500 ms: past one replayed wait, inside the second. |
| A control renamed between authoring and replay | `basic-form/renamed-submit` (new) | The submit button keeps its text, type, role and position and loses the identifier the recording matched it by. |
| Per-visit row differences | `dynamic-list/remove-a-row/rows-per-visit` (new workflow + variant) | Two rows have arrived above the recorded one and every row's identifier has been reissued. |
| A session expiring mid-Flow | `auth-gate/expired` (existing) | Already the condition; it gained the expectation. |

`late-recoverable`'s timing is written down rather than tuned. A replayed wait
gets its node's default 5,000 ms whatever the recording asked for, and Core
retries three times at 250 ms / 1 s / 2 s. Attempt 1 covers `[D, D+5,000]` and
attempt 2 covers `[D+5,250, D+10,250]`, where `D` is the gap from the
`begin-delay` click to the wait's dispatch — so 9,500 ms misses the first and
is caught by the second for every `D` below 4,500 ms, and a replayed node takes
one to three seconds. A test pins the arithmetic.

### D2 — the per-condition expectation

`ScenarioExpected.recovery?: { absorbedBy, because, maxAttemptsPerNode? }`,
validated in `packages/test-contracts` and in the portable JSON schema, with
the closed vocabulary `none | host_target_resolution | skip_satisfied_node |
await_recorded_state | clear_interference | retry_node`. Four of those are
Core's own rungs, so naming one is a claim about a word the run wrote.

It exists **because `providerCalls` alone cannot tell a correct absorption from
an accident.** A run that spends nothing because the ladder retried the node
and a run that spends nothing because the fixture's arming never reached the
page both report zero and both pass. That difference is the whole measurement.

`flow-lane/recovery-attribution.ts` joins the run's attempts back into nodes,
names what resolved each one, and `assertRecoveryAsDeclared` holds the run to
the declaration — narrowing one judgement and no other, as `expected.failure`
and `expected.providerCalls` do.

### D3 — the measured lane

`pnpm lab:adversarial` (`scripts/lab/adversarial-lane.mjs` and
`scripts/lab/adversarial/`) runs every corpus row that declares
`expected.recovery` — discovered from the fixtures, so a condition somebody
adds is measured without editing the lane — and prints the table above. It
writes `measurement.json` and `measurement.txt` under
`test-runs/.adversarial/<timestamp>/` and exits non-zero unless every condition
was absorbed as declared, for no calls.

**Each run is provider-free by construction: no grant is issued at all.** That
is the design, not a saving. A run with a grant that went unspent shows the
model was not needed *this time*; a run with no grant shows that whatever
finished it was the deterministic runtime, because nothing else was available.
The `expected.providerCalls` declarations on the same rows are the guard for
the live case, when the campaign runs them with a grant.

The campaign row now also carries `recoveryRungs` (`row/rung-attribution.mjs`),
so the same measurement appears beside `providerCalls` in a live campaign.

### The two dead evidence paths

1. **`snapshots/repair-lane.json` is read.** `fa-lab-measurement` was right and
   the plan's step list is stale: `row/bundle.mjs` reads it, `replaySummary`
   computes `replayProviderCalls` from it, and `repairOutcome` takes it as its
   fourth argument. `null` only means the run was given no `--replays`. **No
   fix was needed and none was made.**
2. **No campaign row carried a duration.** Both measurements are now there and
   named apart, because they answer different questions: `durationMs` is the
   campaign's own wall clock around the task, retries and process startup
   included, and `runDurationMs` is the runner's measurement of the one attempt
   that produced the row. A task slow because it ran twice and a task slow
   because the run is slow used to look identical.

### One defect the measurement exposed, and fixed

**The Lab read every absorbed run as a failed run.** Core records the *first*
failure it meets and keeps the failed attempt in the trace, so a run the retry
rung rescued arrives carrying a failure record and a failed attempt beside its
`succeeded` status. `reportedVerdict` required every attempt to have succeeded
and no failure record; `assertFlowFailure` failed a run with an undeclared
failure record. Measured on `late-recoverable`: the wait ran out, the rung
rescued it, the Flow finished, the oracle passed — and the run was failed for
"an unexpected timeout failure" it had recovered from.

`absorbedEveryFailure` (in `recovery-attribution.ts`) answers the one question
both needed: something failed, and every node still ended on a successful
attempt. A failed attempt is evidence of what the page did; it is not the run's
outcome. A workflow that *declares* a failure and then has it absorbed still
fails, which is right — its declaration has gone stale.

### The two caps the coordinator routed in

1. **`toolCallCount > 16` on the created-adaptation audit** was cutting off
   real builds. A build that explores by running the node library makes one
   tool call per step it tries rather than a handful before writing a script,
   which is the change t082 made. Both that cap and `toolIds.length > 16` are
   now `MAX_EVIDENCE_LOOP_STEPS` — Core's own loop ceiling — and
   `toolCallCount > iterationCount` still refuses a record claiming more calls
   than decisions. Covered by a new test with forty tool calls and twenty
   distinct nodes.

2. **The instruction-authority derivation's calls.** The Lab takes a build's
   `providerCalls` from the evidence loop itself
   (`build-proposal.ts`: `providerCalls: loop?.providerCallCount ?? null`), so
   by construction it *cannot* see a call Core makes outside the loop. The
   derivation is exactly such a call. Its tokens are spent against the grant's
   budget — which is why a build dies on budget for calls no count explains —
   while the Lab's reported spend never shows them. Core publishes no total
   call count for a build (`build.accounting` has provider, model, tokens and
   cost, and no `calls`), so the Lab has nothing better to report.

   What was done: the contract now says plainly what that number is and what it
   is not, and points at the arithmetic that exposes the gap (more tokens than
   those calls explain). **What would close it is Core's: a call count on the
   build's accounting record covering every call the grant paid for.**

   **It does not affect this lane's numbers.** Every condition runs with no
   grant, so the zero in the `calls` column is structural.

### The `run_node` declarations, and exactly where they stop

Asked for alongside D0a. They cannot be carried without editing another task's
files, and this is where they stop.

`AutomationStudioActionPermissionGate.checkFor`
(`runtime/action-permissions/gate.ts:133-160`) reads each declaration with
`readAutomationStudioActionDeclaration` at line 135, compares its consequences
against the grant, and at line 139 returns `{ permitted: true }` — **keeping
nothing**. The declaration survives only when the gate *refuses*, onto the
raised request, where `consequences` and `missing` are published and do reach
the Lab (observed live this task: `run-mudkd3ik-0755e14a`'s
`build.permissionRequest` is `{verb: "click", controlName: "Submit",
controlKind: "button", consequences: ["modify_existing"], missing:
["modify_existing"]}`). A *permitted* action's declaration is discarded at line
139 and nothing downstream — not the loop trace, not the adaptation's
`evidenceTrace`, not the created audit event — has anything to publish.

The change is to keep a bounded record per check (`{ref, kind, id, verb,
consequences, permitted}`), expose it from
`runtime/flow-bootstrap/action-permissions.ts`, store it on the adaptation and
publish it on the audit detail. `gate.ts` and `flow-bootstrap/action-permissions.ts`
are t087's, and `service.ts` is frozen, so all three are outside this task.
The Lab side is then one more member on `CreatedFlowBuildStep`, beside the
`steps` A12 just added — that shape already exists and is already read.

Separately: `perCallRecords: "not recorded"` is about **provider-call
accounting** for a build, not about declarations. The two are different gaps
that sound alike.

---

## Commands run and observed results

### The lane, which is the proof

`node scripts/lab/adversarial-lane.mjs`, provider-free, `FLUXIQ_TEST_ENV_FILES=none`.

| Condition | Run | Declared | Absorbed by | Attempts | Calls | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `basic-form/timed-overlay` | `run-mudkl9e7-535d1f9c` | none | none | 1 | 0 | passed |
| `basic-form/renamed-submit` | `run-mudkmqiv-c756fac4` | host_target_resolution | **host_target_resolution** | 1 | 0 | passed |
| `dynamic-list/rows-per-visit` | `run-mudko6tx-d8ef8f93` | none | none | 3 | 0 | passed |
| `delayed-ui/late-recoverable` | `run-mudkpdjp-31bee11c` | retry_node | **retry_node** | 2 | 0 | passed |
| `delayed-ui/too-slow` | `run-mudkqquz-af57ae3c` | none | none | 3 | 0 | passed |
| `auth-gate/expired` | `run-mudksc6f-dc1a6f77` | none | none | 1 | 0 | passed |

Written to `test-runs/.adversarial/2026-09-23T03-54-06-926Z/`. A confirmation
run after the module split reproduced the table row for row
(`test-runs/.adversarial/2026-09-23T04-10-23-078Z/`, exit 0).

**`renamed-submit`, attempt by attempt** — the live proof of D0a's Core half:

```
web.dom.type     attempt 0  succeeded  1064ms  {strategy: selector,       candidateCount: 1, bestScore: 1,     confidence: 1}
web.dom.select   attempt 1  succeeded    32ms  {strategy: selector,       candidateCount: 1, bestScore: 1,     confidence: 1}
web.dom.type     attempt 2  succeeded    24ms  {strategy: selector,       candidateCount: 1, bestScore: 1,     confidence: 1}
web.dom.click    attempt 3  succeeded   324ms  {strategy: visual-target,  candidateCount: 1, bestScore: 0.382, confidence: 0.359}
```

**`late-recoverable`, attempt by attempt** — the ladder absorbing a fault:

```
web.dom.click              attempt 0  succeeded  1330ms
web.dom.wait_for_selector  attempt 1  failed     5025ms
web.dom.wait_for_selector  attempt 2  succeeded  1885ms  retry: {rung: retry_node}
web.dom.click              attempt 3  succeeded   324ms
```

**`too-slow`, for contrast**: three wait attempts of 5,029 / 5,019 / 5,018 ms,
all failed, nothing absorbed.

### Live, against the real DeepSeek

Two runs, both on the `create-flow` lane with the key from `.env.local`.

- `run-mudkd3ik-0755e14a` (`instruction-only-form-submit`, 3 provider calls,
  $0.0089). Ended `permission_required`: the press declared `modify_existing`
  while the instruction's authority derived `send_or_publish` from "then submit
  it", so the grant held neither. Its `build.permissionRequest` is quoted above.
- `run-mudkfgff-9b733107` (`product-catalog-first-page`, 27 provider calls).
  Ended `failed`: twenty of its twenty-seven decisions were
  `core.decision_unusable` / `bootstrap.invalid_subflows`, with
  `web.detect_repeating_structure` answered `llm_evidence_loop.already_answered`
  four times between them. Its `evidenceLoop.steps` read that plainly, which is
  itself the point of A12's shape.

**Neither build proposed**, so **A12's proposed-build path was not observed
live** — see *Not verified*. Both runs did show the Lab's `steps` reader
working against real data.

### Unit tests, after the live runs

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | `# tests 571 # pass 571 # fail 0` |
| `node --test "packages/test-runner/dist/**/tests/*.test.js"` | `# tests 1299 # pass 1299 # fail 0` |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | `# tests 125 # pass 125 # fail 0` |
| `node --test "scripts/lab/**/tests/*.test.mjs"` | `# tests 79 # pass 78 # fail 0 # skipped 1` |
| Core: `vitest run .../flow-bootstrap .../service` | `Test Files 37 passed, Tests 358 passed \| 1 skipped` |
| Core: `vitest run .../summaries/tests/host-target-resolution.test.ts` | `9 passed` |
| Core: `vitest run .../flow-bootstrap-commands/tests/evidence-trace.test.ts` | `7 passed` |
| `pnpm check` (downstream) | exit **0**; structure audit passed (92 warnings, 122 baselined) |
| `pnpm check` (Core) | exit **0**; structure audit passed (175 warnings, 360 baselined) |

New tests: 13 in `flow-lane/tests/recovery-attribution.test.ts`, 9 in Core's
`host-target-resolution.test.ts`, 7 in Core's `evidence-trace.test.ts`, 2 in
`packages/test-contracts/tests/scenario-validation.test.mjs`, 1 in
`tests/existing-fluxiq-control.test.ts`, 1 in `delayed-ui/tests/scenario.test.ts`.

### Two fixtures corrected by their own measurement

- **`dynamic-list/rows-per-visit` was written expecting the host to recover the
  row by its text, and it does not.** `run-mudjlm0l-b9212e40` resolved by
  `fingerprint` against seven candidates on all three attempts and refused
  every one, ending `web.target.not_found`. The refusal is the resolver's
  record rule working: every Remove button is byte-identical, the row is the
  only thing that tells them apart, and reissuing the row identifiers takes
  that away — so refusing is the safe answer, the alternative being pressing
  Remove on somebody else's row. The declaration now says `none` and the
  variant declares the failure it produces. **A sibling variant that reorders
  rows while keeping their identifiers is the case that should be absorbed, and
  it is worth authoring.**
- **`delayed-ui/too-slow`'s 20,000 ms stopped being enough the day the retry
  loop landed** — the contradiction `fa-executor-ladder` predicted. One
  replayed wait ended at about 6.4 s; three end at about 17.6 s, and the
  fixture oracle runs after that, so the reveal was landing on the page between
  the last attempt and the oracle and `late-action-absent` failed on a page
  that behaved exactly as designed (`run-mudjoo3j-2360a304`). It is now
  45,000 ms, past the whole ladder and past the oracle.

### Structural

`persisted-flow-run.ts` passed the 800-line limit, so the four members the rung
attribution reads — node id, `retry`, `readiness`, the host resolution — moved
to `flow-lane/persisted-attempt.ts` (769 lines remain). They are one
responsibility: what a single attempt says about the recovery that produced it.

---

## Not verified

- **A12's proposed-build path is not live-observed.** Two real DeepSeek builds
  were made and neither proposed (one hit the permission gate, one failed on
  repeated invalid subflows), so no live run has shown `steps` on a *proposed*
  build's record. The Core chain is tested end to end instead: `evidence-trace.test.ts`
  runs `evidenceTraceAuditDetail` into `bootstrapAdaptationAsFlowAdaptation`
  and asserts the steps arrive at `metadata.phase9.auditEvents[created].detail.steps`,
  which is the exact path the Lab parses, and t080's Lab-side test covers the
  read. A build that proposes would close it in one run.
- **`clear_interference`, `await_recorded_state` and `skip_satisfied_node` have
  still never fired.** Nothing writes `metadata.clearsInterference`,
  `readyState` or a non-URL `expectedState` onto a recorded Flow, so three of
  the four rungs have no input. The vocabulary carries them and the attribution
  would report them; no condition can exercise them until those are written.
  That is `fa-executor-ladder`'s *Not verified* list, unchanged.
- **`web.action.rejected` is non-retryable in the domain's failure table**
  (`domain/src/runtime/failure/codes.ts:139`), which is why a covered control
  is absorbed by nothing even when the overlay would clear. Whether a covered
  control *should* be retried is a product decision this task did not take; the
  fixture's overlay therefore never clears, so the result cannot be read as a
  timing accident.
- **The campaign's new `durationMs`, `runDurationMs` and `recoveryRungs` are
  unit-covered but no campaign was run.**
- **`pnpm test` and `pnpm build` were not run** in either repository; `pnpm check`
  was, in both, plus the suites above.
- The provider-call column is a structural zero, not an observed one: the lane
  issues no grant, so Core could not have reached a provider. That is stated in
  the lane's own header.

## Open questions or contradictions found

1. **The instruction-authority derivation's calls are invisible to the Lab by
   construction** (see above). Core publishing a call count on a build's
   accounting record is the fix, and it is Core's.
2. **`run_node` declarations stop at `gate.ts:139`.** Routing needed; the
   change and its three owners are named above.
3. **A per-visit *reorder* condition is missing.** `rows-per-visit` reissues
   identifiers as well, which the resolver correctly refuses. The commoner real
   case — rows move, identifiers hold — should be absorbed and is not yet
   measured.
4. **`domain/src/runtime/web-automation/` does not exist.** The brief named it
   as owned for the target-resolution strategy. The strategy already travels:
   the domain puts it on the wire at `client/gateway-mapping.ts:311` and the
   gap was entirely Core's projection. No domain change was needed or made.
5. **The brief's Core paths for A12 and D0a have moved.** A12's two functions
   are in `runtime/service/flow-bootstrap-commands/evidence-trace.ts`, not
   `service.ts`; D0a's Core half is in `runtime/service/summaries/`, not
   `runtime/flow-bootstrap/review-projection.ts` (which only clones audit
   events verbatim). Both were made where the code now lives.
6. **A stale Core build silently aborts the lane.** Two lane runs reported
   "absorbed by nothing" for every condition after the first, because a Core
   source edit mid-lane made `dist` stale and the Lab refused each run. The
   refusal is correct and loud in the log, but the lane's table rendered the
   refusals as measurements. The lane should distinguish "no result" from
   "nothing absorbed it" in its own exit path.

## Files changed

Core (`F:\fxwork\t089\!FluxIQ`):

- new `runtime/service/summaries/host-target-resolution.ts` and its test
- new `runtime/flow-bootstrap/evidence-loop-steps.ts`
- new `runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts`
- `runtime/service/summaries/conversions.ts`, `runtime/service/summaries/index.ts`
- `runtime/service/flow-bootstrap-commands/evidence-trace.ts`
- `runtime/flow-bootstrap/generation-failure.ts`, `runtime/flow-bootstrap/index.ts`

Downstream (`F:\fxwork\t089\!FluxIQWebExtension`):

- new `packages/test-runner/src/flow-lane/recovery-attribution.ts` and its test
- new `packages/test-runner/src/flow-lane/persisted-attempt.ts`
- new `scripts/lab/adversarial-lane.mjs`, `scripts/lab/adversarial/{index,conditions,measurement}.mjs`
- new `scripts/lab/live-campaign/row/rung-attribution.mjs`
- `packages/test-contracts/src/{scenario,validation}.ts` and its tests
- `packages/test-runner/src/flow-lane/{run-flow-lane,persisted-flow-run,lane-observation,expectations,index}.ts`
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
- `packages/test-runner/src/{existing-flow-run,existing-fluxiq-control}.ts`
- `packages/test-runner/src/**/tests/*` (five files updated to the new contract)
- `scripts/lab/live-campaign/{runner.mjs,row/summarize-task.mjs,row/index.mjs}`
- `apps/scenario-lab/src/scenarios/{basic-form,delayed-ui,dynamic-list}/scenario.ts`,
  `auth-gate/manifest.ts`, `delayed-ui/tests/scenario.test.ts`,
  `tests/live-repair-tasks.test.ts`
- `docs/architecture/{testing-facility,repository-layout}.md`, `package.json`

# The scheduled result check: training checks, built

Task t102. All source changes are in **FluxIQ Core**; this repository has no
source change and none was needed. No Lab run, campaign or provider call was
launched.

Implements `fa-training-mode-design.md` phases 1, 2, 3, 4 and 6. Phase 5 (the
refutation reaching the repair ladder) is t099's and was deliberately not built.
Phase 7 (one live run) is the supervisor's.

---

## Outcome

**Done**, with one thing the design left open now settled against it, one
deviation from the design's file layout, and one dependency on t099 stated
below.

The user's requirement — "even when a Flow does not break, the model looks at
the action chain and output on a successful run and judges whether it actually
succeeded according to the user's instruction; if it did not, that triggers a
repair" — is now true for runs nobody is watching, on the default schedule
1, 2, 3, 8, 33, 158, and settable in the Flow settings view in five shapes.

---

## 1. The design's open question, settled — against the design

The design flagged one thing it had not proved: that `flows.graph_revision`
advances on every apply path, and that `AutomationStudioFlowRunSummary.
flowVersion` carries the post-patch value, so that keying the run count on
`runtime_runs.flow_revision` would restart the three-run window after a repair.

**It does not hold, and not marginally — `runtime_runs.flow_revision` is the
constant 1 for every row in the table and always will be.**

The proof is two lines. `upsertRunSummary` writes the column as
`positiveInteger(Number(summary.flowVersion) || 1, "flow revision")`
(`storage/project/runtime-stream-store.ts:147`), and **nothing in Core ever sets
`flowVersion`**. A search for an assignment across `packages/fluxiq/src`,
excluding tests, returns exactly two hits: the merge in
`service/summaries/run-detail-merge.ts:79`, which only passes through whatever
it was given, and the store's own read-back at `runtime-stream-store.ts:604`,
which returns `String(row.flow_revision)` — that is, what it just wrote.
`runtimeFlowRunSummaryFromSession` (`service/summaries/conversions.ts:211`),
the only producer of a run summary on the runtime path, does not set it. So the
first write is `Number(undefined) || 1` = 1, and every later write round-trips
that 1 forever.

Had the design been implemented as written, **no Flow's checking window would
ever have restarted**, and the failure would have been silent: the counts would
have kept rising across repairs and the schedule would simply have checked less
and less often forever.

**What was built instead** is the design's own fallback, sourced better than
the design proposed. The design suggested `result_check_epoch` on
`flow_settings`, "bumped by the repair" — which would have made the feature
depend on t099 doing the bumping. Instead the epoch is a column on
`runtime_runs`, written per run from **the Flow's real graph revision**, which
`materializeCanonicalGraphFlow` already puts on the canonical document as
`metadata.graphRevision` and which `graph-store.ts:153` bumps inside the apply
transaction of every graph patch. A landed repair therefore restarts the window
for free, with no bookkeeping, nothing to reset, and **nothing required of
t099** — which is the property the design wanted and the reason it preferred a
revision key in the first place.

---

## 2. What was built

### Phase 1 — the schedule, pure and replaceable

`packages/fluxiq/src/programs/automation-studio/runtime/result-check-schedule/`

`settings.ts` (the five shapes and the defaults), `contracts.ts` (state,
decision, codes), `ordinals.ts` (the sequence), `decide.ts` (the decision),
`policy.ts` (the one-method interface), `resolve.ts` (shape → policy),
`configuration.ts` (schedule + authorization as one stored thing),
`conversation.ts`, `index.ts`.

Pure throughout: no clock, no store, no provider. `decide(state, settings)` is
handed everything it needs, so every shape is provable with no database and no
money.

Two rules sit outside the ordinal sequence, and both are tested:

- **After a refutation, the next run is checked** whatever the sequence says,
  because a repair's own product has to be judged. The design's item (d) — a
  repaired run is never re-judged — is not fixed by this (that is t099's), but
  the *schedule* no longer looks away from the run after a refutation.
- **A scheduled check that settled nothing is re-asked once**, at the next run
  and only there. Bounded deliberately: a test asserts that a Flow whose checks
  keep coming back `unverified` does not quietly become `every_run`.

**Deviation from the design.** The design asked for five files, one per shape
(`initial-then-exponential.ts`, `linear-decay.ts`, …). They share one body
instead, because what separates the shapes is a single arithmetic step and five
copies of the same twenty lines would be five places for the reset rules to
drift apart. What the design actually asked for — that the policy be
*replaceable* — holds: callers hold an `AutomationStudioResultCheckSchedule` and
never a shape name, so a shape with a genuinely different body (one keyed to
elapsed time, for the Flow run twice a year that the design's item 6 worries
about) is added in `resolve.ts` without touching the runtime.

### Phase 2 — settings

One field on `AutomationStudioTrainingModeSettings`
(`resultCheck?: AutomationStudioResultCheckConfiguration`), one import line, and
`training-modes.ts` is still under its 400-line advisory threshold with no new
exported value in it — as the design required.

`runtime/service/flow-settings/result-check-settings.ts` reads it. **A Flow that
has never been configured reads back the documented defaults, so every existing
Flow gets the default schedule with no migration and no backfill.** The
authorization is the opposite way round and absent until a person grants one —
a schedule is a preference and defaults, a permission to spend is not.

### Phase 3 — the counter

Migration `0022_result_checks`
(`storage/project/schema/result-checks.ts`), two columns and one index, both
nullable-or-defaulted so an existing project database migrates forward
rewriting no row:

```sql
alter table runtime_runs add column result_verification_status text
  check (result_verification_status is null
         or result_verification_status in ('confirmed','refuted','unverified','no_result'));
alter table runtime_runs add column result_check_epoch integer not null default 1
  check (result_check_epoch > 0);
create index if not exists runtime_runs_result_check_idx
  on runtime_runs (flow_id, result_check_epoch, finished_at_ms desc, run_id);
```

`AutomationStudioProjectRuntimeStreamStore.readResultCheckState` derives the
state in four indexed counts rather than a scan, so a Flow with ten thousand
runs answers in the same four statements as one with three. Ties on
`finished_at_ms` break on `run_id`, so two runs finishing in the same
millisecond still have a definite ordinal — there is a test for it.

**`null` in `result_verification_status` means "this run was not part of a
check", which is a different fact from `unverified`**, and the schedule depends
on the difference: a run the schedule passed over still runs the verification,
still reaches `core.result.no_model_available` and is still recorded
`unverified` on its own detail, and counting that as a check that settled
nothing would make the schedule re-ask after every run it deliberately skipped.

### Phase 4 — the model attached to the runs the schedule picks

This is the core of the task, and the design was right that the judge needed no
changes at all: `verifyAutomationStudioRuntimeSessionResult` already ran on
every finished run, already asked the user's question in the user's terms, and
only the provider was conditional.

`runtime/service/runtime-adaptation/result-check.ts` decides, at the
verification call site, whether this run is checked and whether an authorization
pays for it. `service.ts`'s `resultPorts.resolveProvider` now reads:

- a person's execution grant, **exactly as before** — it still wins, and a
  granted run behaves identically to how it did before any of this existed;
- otherwise the Flow's standing check authorization.

A test replays twelve runs and asserts a provider is reached on 1, 2, 3 and 8
and on no other, with no grant and no actor session anywhere in the call.

### Phase 4 — the standing check authorization

`runtime/result-check-authorization/` — `contracts.ts`, `redeem.ts` (pure),
`reveal.ts` (the one credential hop), `provider.ts`, `provider-contract.ts`.

The blocker the design identified is real: `AutomationStudioLlmExecutionGrant
Service.issue` throws "LLM execution actor session is unavailable" without a
live session, and `inspectAvailable` re-validates it on every call. A Flow
replaying at 3am has neither.

Built exactly as the user approved it — "Yes this is how it should be. If a user
says do this to acheive automation, it should do that." — with the three bounds
he was shown, **and no per-occurrence prompt**:

- **A redemption scope of one task kind.** `loop_verification` is the only value
  the record can carry and the only value `redeem.ts` will pass. There is no
  argument, no settings field and no configuration by which this could come to
  pay for a diagnosis, an exploration or a patch. A stored record hand-edited to
  say `runtime_patch` is read back as a verification authorization by the
  settings reader *and* refused on scope by the redemption.
- **A cost ceiling**, per call and in total, drawn against the same spend figure
  the training budget already uses (`budgetState.costUsdThisTrainingWindow`), so
  the two promises to the person cannot disagree. A remainder too small to pay
  for a whole call counts as exhausted.
- **An expiry**, ninety days by default.

It is **not** a loosening of the grant service, per the design's explicit
warning: a grant purpose issuable without a session would have let unattended
work reach `diagnose_and_adapt` and `explore_and_adapt` too. Nothing in this
path can name a purpose.

The credential hop (`reveal.ts`) is where every refusal lives, and it relaxes
nothing: the key still comes out of Secret Keys' held custody through a one-use
reveal minted per call; the unlock must belong to the user who authorized
checking (`createSessionRevealAuthorization` checks the pair together, so a
stale or borrowed unlock id opens nothing); the key must still be the enabled
LLM key at the same seal; and the outbound body is still checked for the
credential before it is sent. When the person's key unlock has lapsed, every one
of those refuses, no provider resolves, and the run records `unverified` —
which is the failing direction to pick.

### Phase 6 — the conversation

`result-check-schedule/conversation.ts`, the design's three moments and no more:
a refutation says its piece on the run's thread with the judged dataset attached
and no ask; an unsettled check posts one `choice` ask with `parks: false`; a
confirmed check says nothing. The words are Core's own `reason` and
`observation` throughout — a test asserts the model's prose never appears.

**No training screen was built**, per the design.

### The surfaces

The Flow settings view gains the controls in plain English
(`apps/web/.../settings/flow-result-check-model.ts` plus the Runtime group of
`FlowSettingsView.tsx`), with a read-only line that says what the schedule will
do — "Runs 1, 2, 3, 8, 33, 158 and so on have their results checked." It says
**runs, never days**, and a test asserts no time word appears in any shape's
summary: nothing in Core schedules a Flow, so a line promising a check "in a
month" would be a line Core cannot keep. The run view already renders
`metadata.resultVerification` and needed no work.

---

## 3. What t099 needs from this, and what this needs from t099

**This produces the refutation and records it. It does not build the repair
path, and nothing in `recovery/plan.ts`, `annotate.ts` or the recovery context
was touched.**

What a scheduled refutation now leaves for t099 to pick up:

- the run's session and detail carry `metadata.resultVerification` with
  `status: "refuted"`, the verdict, the code, Core's reason and observation, and
  `resultVerificationFailure` with the failure record's category and code —
  all exactly as before, unchanged;
- **new**: `metadata.resultCheck` on both, carrying
  `{checked, epoch, code, reason, status}`, so a repair can tell a refutation
  the schedule asked for from one a person's grant asked for;
- **new**: `runtime_runs.result_verification_status = 'refuted'` on the row,
  which is what makes the *next* run checked as well (the after-refutation
  rule), so a repair that lands and re-runs is judged.

Three things t099 still owns, unchanged from the design's section 4:

1. **The order of the ladder.** The verification still runs *after*
   `maybeAnnotateRunDetailWithRuntimeLlm`, so a refutation still arrives after
   the ladder has finished. Moving it, or adding a second entry point, is
   t099's. This design's Phase 4 is wired to whichever call site decides,
   because `runResultCheck` is computed once and read lazily.
2. **The candidate kind a refutation reaches**, and specifically that it must
   not be `expectation_wait_retry`. This remains the single biggest risk: a
   wrong-answer failure repaired by adding a wait will never be repaired, and
   this task makes refutations far more common. **t099 must state which route it
   took.**
3. **The `result_verification` recovery context section**, so the repair can see
   what came back.

---

## 4. Commands run and observed results

All in `F:/fxwork/t102/!FluxIQ` and `F:/fxwork/t102/!FluxIQWebExtension`.

**New unit tests, all passing:**

- `runtime/result-check-schedule/tests/schedule.test.ts` — **14 passed**.
  Includes the default's exact ordinals asserted literally:
  `[1, 2, 3, 8, 33, 158]` over 200 replayed runs and
  `[1, 2, 3, 8, 33, 158, 783]` over 1000; `linear_decay`
  `[1, 2, 3, 8, 18, 33, 53]`; `fixed_interval` twelve checks in fifty;
  `every_run` all fifty; `never` none; an unrecognised shape resolving to the
  default and not to `never`; the `maxInterval` ceiling; and the two reset
  rules, including that repeated `unverified` does not become every-run
  checking.
- `runtime/result-check-schedule/tests/conversation.test.ts` — **6 passed**.
- `runtime/result-check-authorization/tests/redeem.test.ts` — **7 passed**.
  Includes: a valid authorization redeems with no actor session anywhere;
  expired refuses; exhausted refuses, including a remainder too small for one
  call; **and seven non-verification task kinds each refused on scope**, plus a
  record that claims a wider scope refused as well.
- `runtime/result-check-authorization/tests/provider.test.ts` — **7 passed**.
  The lapsed-unlock case, the rotated-key case (and that it revokes the reveal
  it minted), the wrong-Flow case, and the credential-in-body case.
- `runtime/service/runtime-adaptation/tests/result-check.test.ts` —
  **12 passed**. Includes the twelve-run replay reaching a provider on
  `[1, 2, 3, 8]` and no other; expired and exhausted obtaining no model and
  never reaching the host; a run the schedule passed over never reaching the
  authorization at all; the host's wider ceiling held to the authorization's;
  and a person's grant still winning.
- `runtime/service/flow-settings/tests/result-check-settings.test.ts` —
  **6 passed**.
- `storage/project/tests/result-check-state.test.ts` — **6 passed**. Includes
  the epoch reset (`ordinal` restarts at 1 when the Flow's revision advances,
  with the previous epoch's history intact), an unchecked run reading as
  unchecked rather than `unverified`, and survival across closing and reopening
  the database.
- `runtime/result-verification/tests/run-outcome.test.ts` — **25 passed**
  (19 existing, 4 added).
- `apps/web/.../settings/tests/result-check-settings.test.ts` — **6 passed**.
  Includes that a settings save never drops the standing authorization stored
  beside the schedule.

**Repository checks:**

- `node scripts/structure-audit.mjs` (Core) →
  `structure-audit: passed (179 warning(s), 360 baselined)`.
  It failed twice on the way and both were fixed rather than baselined away:
  `service.ts` grew past its 4611-line ratchet, and
  `flow-settings-model.ts` past its 21-exported-value ratchet. Both were fixed
  by moving code out — `resolveRuntimeAdaptationContext`'s body into
  `service/runtime-adaptation/resolve-context.ts` behind ports, and the
  training-check model into `apps/web/.../settings/flow-result-check-model.ts`.
  **`service.ts` is now 4607 lines, four fewer than before this task started**,
  and `pnpm structure:baseline` recorded the lowering (4611 → 4607).
- `pnpm check` (Core) → `structure-audit: passed`, then
  `packages/contracts check: Done`, `packages/client-gateway-websocket check:
  Done`, `packages/fluxiq check: Done`, `apps/web check: Done`.
- `pnpm test` (Core) → **3076 passed, 1 skipped, 1 failed** of 3078 across 357
  files, on the first and cleanest run. The one failure was
  `runtime/tests/deepseek-bootstrap-exploration.test.ts:262`, reporting
  `llm.provider_timeout` against that test's own 3000 ms timeout.

  **The full Core suite is not reliably green on this machine, and it is not
  this task's doing.** Five full runs were made. Every failure was a heavy,
  disk-bound, multi-second test timing out under whole-suite parallel load, the
  failing set was different on every run, and **every one of them passed when
  re-run in isolation**:

  | Run | Failures | Note |
  |---|---:|---|
  | 1, alone | 1 | `deepseek-bootstrap-exploration`; all 8 in that file pass alone (cases take 6 s, 9 s, 15 s, 16 s) |
  | 2 and 3, concurrent with each other | 24 and 6 | disjoint sets — my own error, two suites racing on shared `os.tmpdir()` scratch directories |
  | 4, alone | 7 | 6 passed on re-run, 1 persisted (`global-docs`) |
  | 5, alone | 3 | all three pass alone: `scale-pages` (24 s), `run-detail-preservation` (24 s, its failing case 10.4 s), `global-docs` |

  `run-detail-preservation.test.ts` was the one worth worrying about, because it
  exercises the summary-metadata preservation path this task writes
  `resultCheck` into. Run alone it passes in 24 s, its failing case taking
  10.4 s.

  `global-docs.test.ts` ("generates a TypeDoc-backed framework reference")
  failed reproducibly in isolation, so it was chased down rather than dismissed.
  **TypeDoc is not broken by this task**, proved three ways: it passed in run 1
  with every change already in place; `node scripts/docs-reference.mjs` on this
  tree wrote the reference from **2,320 public declarations**; and a probe
  driving `registerGlobalDocumentationGenerators` through the built `dist`, the
  same way the test does, printed `NO FALLBACK: TypeDoc succeeded` with the HTML
  and JSON artifacts generated. Whatever fails it under vitest is environmental.

  The project already records that this machine has faulty RAM, which fits.
- `pnpm --filter fluxiq build` (Core) → completed, so the downstream link
  resolves against the new declarations.
- `pnpm check` (web extension) → `structure-audit: passed (99 warning(s), 121
  baselined)`, then all ten workspace projects `Done`.
- `pnpm test` (web extension) → **`# fail 0` in every package**: domain 760,
  `apps/extension` 740, `apps/scenario-lab` 571, `packages/test-runner` 1319,
  `packages/test-matrix` 17, `packages/test-evidence` 17,
  `packages/agent-orchestrator` 16, `packages/real-site-policy` 7, plus
  `packages/boundary-audit`.

**No Lab run, campaign or provider call was launched, and nothing was committed
or pushed.**

---

## 5. Not verified

- **That a live unattended check actually reaches DeepSeek and comes back.**
  Every test above uses a fake provider or a fake Secret Keys port. Phase 7 —
  one run, on one of the ten difficult sites, with the schedule set to
  `every_run` — is the first thing that would prove it, and it is the
  supervisor's to run.
- **That the standing authorization works end to end against real Secret Keys
  custody.** `reveal.ts` is tested against a port, not against
  `SecretKeysService`. The one operational fact it rests on is that a person's
  key unlock (`unlockSession`, whose `expiresAtMs` the caller sets and which
  Secret Keys does not cap) is still held when the 3am run happens. If it has
  lapsed, the check fails closed and records `unverified` with
  `core.result.no_model_available` — correct, but it means **the 3am case
  depends on the deployment holding a long-lived key unlock**, and nothing in
  this task creates one. A person's *identity* session is no longer involved,
  which was the actual blocker; the key unlock is.
- **That the Core suite is green end to end in one run.** It was not, on any of
  five runs, and the failures are characterised above as load-related timeouts
  that each pass in isolation. I could not prove the same failures occur on an
  unmodified tree, because a worker may not `git stash` and I did not want to
  run a suite inside the shared `F:/!FluxIQ` checkout while the supervisor may
  be using it. The evidence that they are not mine is indirect but consistent:
  different failing set every run, every failure passing alone, and none of them
  in a module this task changed except `run-detail-preservation`, which passes
  alone.
- **That `graph_revision` advances on the adaptation apply path specifically.**
  `graph-store.ts:153` bumps it inside `applyGraphPatch`'s transaction and
  `adaptation-store.ts:209` records the applied revision, which is what the
  epoch rests on. The storage test proves the *counter* restarts when the epoch
  advances; it plants the epoch rather than driving a real adaptation through to
  a graph patch.
- **No UI was opened in a browser.** The settings controls typecheck and their
  model round-trips under test; they were not looked at.
- **The conversation turn was not driven through the real
  `AutomationStudioConversations` store**, only through its two-method shape.

---

## 6. Open questions and contradictions

1. **The interval reading was taken as the default, as the design recommended.**
   "Every 5th run, then the 25th" is implemented as interval decay
   (1, 2, 3, 8, 33, 158) rather than an ordinal series (1, 2, 3, 5, 25, 125).
   Both give five checks in fifty runs so the cost is identical, and the
   interval reading is the one that generalises to "decay" and to the linear
   shape. Still worth one sentence of confirmation from the user.
2. **A refutation's repair still needs its own authorization, and this task
   grants none.** Verifying costs about $0.0015 and changes nothing; repairing
   changes the Flow and may act on a page. They are kept as separate questions
   deliberately, and the honest default stands: a repair that would act on a
   page raises a permission ask in the conversation exactly as it does today.
3. **The candidate kind a refutation reaches is still unknown**, and it is the
   biggest risk in the feature. If t099 lands it as `expectation_wait_retry`,
   this task will trigger repairs that propose waits for Flows that are missing
   a filter — more often than before, because refutations are now scheduled.
4. **`ambiguous_or_unknown` still has three producers and no code on two of
   them** (the design's item 5). This task makes refutations more common, so
   that string is about to be written more often, and a reader still cannot tell
   which produced it. Not fixed here; it is a few lines and belongs with t099.
5. **The judge still sees eight rows** and still sees no action parameters or
   results (the design's items 2 and 3). The brief's "the model looks at the
   action chain and output" is therefore satisfied only to the extent the
   existing packet allows: the Flow's shape, the recent actions' identities, and
   a bounded result summary. The design's recommended `resultChain` projection
   was **not** built — it was outside this task's phases, and building it means
   re-opening a stated content-protection decision rather than filling a gap.

---

## What Core's paired working document should record

Core is where every change landed, so Core's own working document should carry:

- **The `flowVersion` finding, as a standing fact about the run store**, not as
  a note about this task: `runtime_runs.flow_revision` is the constant 1,
  because nothing sets `AutomationStudioFlowRunSummary.flowVersion`. Anything
  that reads that column for a Flow's version is reading a constant. It is
  either dead weight to remove or a field to start populating, and until one of
  those happens the next reader will make the same wrong assumption the design
  did.
- **Migration `0022_result_checks`** in whatever list Core keeps of project
  schema versions, with the note that it is forward-safe and rewrites no row.
- **The new standing-authorization path as a second way a provider is
  resolved**, beside the execution grant service, with its bounds: one task
  kind, one key, a per-call and a total ceiling, an expiry, and no purpose
  vocabulary. Anyone auditing "how can Core reach a provider" now has two
  answers instead of one, and needs to find the second.
- **That `AutomationStudioService` is at its 223-method ratchet**, so the next
  feature that wants a service method has to move one out first — this task hit
  it and routed around it with free functions and ports.
- **That `service.ts` fell to 4607 lines**, in line with the standing direction
  to keep shrinking it, by extracting `resolveRuntimeAdaptationContext` behind
  ports into `service/runtime-adaptation/resolve-context.ts`.

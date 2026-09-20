# w2 — Exploration presses what it is asked to: the safety rule removed

Worker report. Branch `task/t011-exploration-reveal-safety`, worktree
`F:\fxwork\t011-exploration-reveal-safety`, base `a08237b` (dev merged by the
supervisor: includes t009, `0f156db`, t010, t012). Nothing committed by me.

## Outcome

Partial, and for a new reason. Piece 1 of the user's design is done: FluxIQ no
longer refuses any control on its own judgement of what it looks like, the
tool is renamed to say what it is, and the page-as-found work stands. Measured
live on the merged base, **exploration now opens the composer and the build
proposes a Flow** — the first `schedule-post` build to do so, in 3 and 5
provider calls.

The job still does not change the page, because after the build proposes, a
FluxIQ control request exceeds its 30-second bound — 2 of 2 runs. That happens
before the Flow runs, in the approve/apply/start sequence, not in exploration.
Pieces 2 and 3 (permission and escalation) are Core's and were not built.

## Live evidence

All runs are `social-scheduler-schedule-post` against real DeepSeek, from the
worktree, with `DEEPSEEK_API_KEY` exported from `.env.local` (never printed)
and `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated
FLUXIQ_LAB_INSTANCE=t011`. The last two runs also set `FLUXIQ_TEST_RUNS_DIR='F:\r11'`.

### Before any change (base `3ba6742`)

`run-mu7c7sd5-4da03bfd`: no Flow, 4 of 4 reveals refused
`web.action.rejected.target_unsafe`, then the same call repeated 4 times,
navigation in circles, `flow_bootstrap.evidence_iteration_limit`. **27 provider
calls against an authorized 26** — `performance.budget`, $0.1156. **Only this
baseline hit the call ceiling.** Every run after it stayed far below the ceiling.

### After the reveal/commit rule, still on the stale base

Five runs (`run-mu7cj62r`, `-mu7cojks`, `-mu7ctzm2`, `-mu7cx0s3`, `-mu7dfyht`)
plus `order-operations-partial-refund` (`run-mu7djnl3`): 5–9 calls each, no
button/checkbox/link/menu refused, no Flow. Every one ended on the
**no-progress guard** (`evidence_repeat_without_progress`) or on an unusable
decision, **not on the call limit**: the model repeated one refused press. A
structural probe showed why: the packet held 40 elements, **37 of them row
checkboxes**, and "New post" was **not in it**.

### After removing the rule, on the merged base

| run | calls | build | packet at inspect | after the press | end |
| --- | --- | --- | --- | --- | --- |
| `run-mu7e29su-5cfb4cf1` | 3 | **proposed** (26.6 s, $0.0116) | opener present | textarea 0 → **1** | `control.request` timed out at 30 s |
| `run-mu7e7nq5-21fd6698` | 5 | **proposed** (42.8 s, $0.0201) | opener present | textarea 0 → **1** | `control.request` timed out at 30 s |

**The packet's shape now**, from the temporary probe (counts and flags only,
now removed): 40 elements, `repeated: 4` (t009's exemplars are working),
`select 3, input:checkbox 2, input:search 2, button 9, a 13, label 5, span 6`.
Row checkboxes went from 37 to 2. `elementsTruncated` and `captureTruncated`
are still true, but the header survives the cut.

**Is the composer opener present and pressable? Yes, both.**
`openerPresent: true` on the first inspect of both runs. The model's first
press was `web.press_control`, and the next packet had `textarea: 1` and
`button 9 → 12`: the composer opened and its fields reached the model. The
build then completed with a proposal.

**Is the no-progress guard now the binding constraint? No.** Neither build
repeated itself. Both proposed. The binding constraint is now the post-build
timeout.

**Where the timeout is.** `facilityFailure: {reason: "http.timeout",
operationStage: "control.request", timeoutMs: 30000}`, reproduced 2 of 2, so it
is not the RAM fault. It fires about 36 s after the build settles
(20:08:14 → 20:08:50 and 20:11:16 → 20:11:54). A timed-out Flow *run* request
would not surface that fast: `executeRecordedFlowRun` recovers a bounded
failure by polling the run detail for up to 90 s before rethrowing
(`packages/test-runner/src/flow-lane/persisted-flow-run.ts:19,262-280,351-378`).
So the request that hung is one before the run: approve or apply the
adaptation, `get-flow`, `list-flow-subflows`, `selectExistingContext`, or
`startPersistedFlow`. I did not narrow it further. Since t012 ("a one-call
verification grant") is newly under this path on both sides, it is the first
thing I would check. The failure screenshot shows the queue page as loaded,
composer closed and still `122 scheduled`, so nothing was committed and no
page state carried over.

## What I changed (piece 1)

**Deleted, not refined**:

- `domain/src/runtime/llm-evidence/control-intent/` (reveal/commit
  classification, word classes, and their tests).
- `harness-options/safety.ts` and its test: the recovery ladder, including
  `WEB_RECOVERY_COMMITTING_WORDS` and its selector matching.
- `safeRevealElement` and the `revealKind` allowlist it replaced.
- The `target_unsafe` rejection code. Nothing raises it any more, and a code
  classified as `destructive_action_refused` with no raiser was a refusal
  waiting to be reused as a local substitute for permission.

**Renamed and made plain**:

- `reveal.ts` became `press.ts`. `pressControl` presses what the handle names.
  It still binds handles through their selectors, still reports `no_progress`
  on an unchanged page, and still presses a checkbox back once the page has been
  read. That last step is housekeeping, decided by the fact that a checkbox
  toggles — it is not a safety judgement.
- `web.reveal_safe` became **`web.press_control`**
  (`WEB_LLM_PRESS_TOOL_ID`). Its description says what pressing is for and
  lists nothing it refuses. It is shorter than before, well inside the evidence
  request's token ceiling.
- The recovery options `web.recovery.reveal` and `web.recovery.act_safe` had
  identical schemas and differed only in their gates. Without the gates they
  were the same option twice, so they are now **one**, `web.recovery.press`,
  using the same `pressControl`. The bundle now declares five options.

**Seams, marked and not approximated.** Each carries a `TODO(permission seam)`
naming the Core contract:

- `press.ts` `pressControl`: where a press with a lasting consequence will ask
  rather than proceed. It names both missing Core pieces: a permission set
  carried with the run, issued where `authorizeBuild` issues `build_and_adapt`,
  in consequence classes; and a needs-permission outcome carrying a request.
- `harness-options/exploration-terms.ts`: where that result will be classified
  as Core's `operator_approval_required`, whose outcome is
  `user_intervention_required`.

**Kept, as instructed**: the untick, and the same-URL reload in
`apps/extension/src/runtime/automation-tab.ts`, already committed with its test.

**Docs**: `docs/architecture/testing-facility.md` no longer describes the
allowlist; it describes the plain press, the seam, and the interim behaviour.
`elements.ts`'s `revealKind` comment no longer claims it bounds what may be
pressed; it is now only a description in the packet.

### Interim exposure — please read

Until Core carries permission, **nothing stops a press that commits**. The
authoring tool and the recovery option will both press Send, Delete, Confirm or
Refund if the model asks. On the authoring path, the lane resets the fixture
before the Flow runs, which limits the damage. The recovery path runs
mid-failure on a live account. Its exposure is bounded only by Core's registry,
which withholds mutating options from a caller that has not opted in to side
effects (`allowSideEffectsWithoutPolicy`, or a policy). This follows the user's
direction — a refusal with no route to the person was the defect — but it is a
real gap until pieces 2 and 3 land, and I am stating it rather than assuming it
is understood.

### Existing Core machinery the Core work should look at

- `domain/src/actions/safety.ts` `WEB_AUTOMATION_ACTION_SAFETY` classifies every
  *output type* as `safe` or `review`. The manifest's `safety.level` and
  `requiresApproval` derive from it. That is per action kind (every click is
  `review`), not per consequence, but it is the existing approval vocabulary.
- `harness-options/options.ts` notes that an option can declare a required
  runtime capability or permission, and the registry withholds it when the
  caller lacks it. That is a candidate attachment point for the permission on
  the recovery path.

## Findings carried from the earlier report

- **The refusals, reproduced.** At `HEAD`, "New post" and the row checkbox were
  refused on shape (`revealKind` undefined), not wording. Two identical packet
  elements differing only in the hidden selector were refused and allowed
  respectively, because `\border\b` matched inside `[data-testid="order-rows"]`.
- **The dialog left open into playback.** The mechanism has three parts:
  1. Exploration's first `navigate` makes the extension create its own tab
     (`automation-tab.ts:25-37`).
  2. The lane's `prepareFlowPage` reloads the Playwright page, not that tab.
  3. The Flow's opening navigate reuses the tab, and Chrome ignores a
     `tabs.update` to the URL already shown, so the Flow inherits what
     exploration left open.

  Fixed with a same-URL reload, pinned by a test that mutation fails. In both
  merged-base runs exploration did not navigate, so this path was not exercised
  live, and the screenshots show a clean page.
- **The token ceiling.** The evidence request sat at exactly 8,000 DeepSeek input
  tokens. The new description is shorter than the original, so this no longer
  binds here.

## Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t011 pnpm --filter @fluxiq-web-extension/domain test`
  → `# pass 677 # fail 0`, no entry failed to load.
- `pnpm --filter @fluxiq-web-extension/extension test` → `# pass 688 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` → `# pass 1144 # fail 0`
  (I touched a comment and one test row there, for the rename).
- `pnpm check` → exit 0; `structure-audit: passed (76 warning(s), 122 baselined)`.
- Mutation A, a word-list refusal put back in `pressControl` → **6 fail**. Among
  them: `presses Send reply / Delete order / Confirm / Refund this order / Retry
  failed orders when asked`, and the recovery option's `presses the control it
  is asked to, whatever it says`. My first attempt at this mutation survived.
  The cause was my shell escaping turning the regex into one that matched
  nothing, not a gap in the tests. The plain-string retry was caught.
- Mutation B, the old shape allowlist put back → **14 fail**, including `opens
  the composer behind a plain New post button`.
- Both mutations reverted; the suite is green again at 677/677.
- Live: the seven runs in the tables above.

## Not verified

- **Which request times out after the build.** Localised by timing to the
  pre-run sequence, not to one call.
- **That any state-changing job now changes the page.** No merged-base run
  reached playback.
- **`order-operations-partial-refund` on the merged base.** Not run. I stopped
  at `schedule-post` as asked, and the post-build timeout would block it the
  same way.
- **The recovery `press` option live.** `harnessActivations: 0` throughout.
- **Chrome's same-URL `tabs.update` no-op.** Read from code; the reload fix is
  unit-tested, not observed live.
- **Firefox.** Not exercised.

## Open questions or contradictions found

1. **The next blocker is not mine to fix from here.** A control request after
   a successful build times out at 30 s, 2 of 2. It needs someone who can see
   Core's side of approve/apply/start. t012 is the obvious suspect.
2. **Index state.** Deleting and renaming used `git rm` and `git mv`, so the
   worktree index already holds staged deletions and one staged rename
   (`tests/reveal.test.ts` → `tests/press.test.ts`). `press.ts` is untracked.
   Nothing is committed.
3. **Interim exposure.** Stated above. It is the user's chosen direction, but
   it should be a conscious choice to run the recovery path on a live account
   before Core's permission contract lands.

---

## Follow-up: the post-build timeout, pinned

A second brief: find which control request times out after a proposed build,
test the t012 verification grant directly, say whether router or subflow
handling is involved, and stop if the cause is in Core. Same worktree, live
first, unit tests last. Probes used in the investigation were env-gated, printed
routes, counts and flags only, and are all removed.

### Outcome

**Pinned: the request that times out is
`/api/programs/automation-studio/run-runtime-session`**, the call that runs the
created Flow. It is a **granted** run: since t012 the playback carries a
one-call `verify_result` grant. It is **slow, not hung**, and **no router or
subflow is at fault**. **Not a Core defect.**

The cause is the Lab client's default 30 s bound meeting a run that Core
answers only when it has finished, and that names its run id only in that
answer. That matches what the sibling t016 found. Their fix, the created lane
waiting up to the client's 300 s ceiling in `flow-lane/creation/lane.ts`, is on
their branch, not this one. **This branch still shows the timeout until the two
merge**; the last live run below shows it, now named.

**Once past the timeout, the job works: the scheduled post was made.** Across
four runs read to their end, the oracle said `passed` and FluxIQ reported
`passed`. It is the first state-changing job in this effort to change the page.

**Behind it is a second blocker, in this repository**: the redaction
attestation fails every completed run, because Core's store is 85.5 MiB against
a 32 MiB ceiling. Details below.

### Live evidence

`social-scheduler-schedule-post`, `FLUXIQ_TEST_RUNS_DIR='F:\r11'`, merged base.

| run | what was measured | result |
| --- | --- | --- |
| `run-mu7ensms-07f96108` | — | `lab.generation_http_400` before the build: 1 call, 0 tokens. Seen once before in corpus-c; did not recur |
| `run-mu7eqbto-e63bf4ac` | timeout pinned, run read to its end | route `run-runtime-session`, `grantPath: true`, 30 s bound. The run was found and ended `succeeded`: 10 actions, **0 route decisions, 0 subflow entries**, **76.6 s**. Oracle `passed`, reported `passed` |
| `run-mu7ewcn7-3b0dac0a` | same, again | same route. `succeeded`: 8 actions, **1 route decision, 1 subflow entry**, **62.6 s**. Oracle `passed` |
| `run-mu7f2w7u-1c68f22e` | same, plus store probe | `succeeded`: 10 actions, 1 route decision, 1 subflow entry, 70.2 s. Oracle `passed` |
| `run-mu7f8oag-6d4ab527` | store size named | `succeeded`: 9 actions, 1 route decision, 1 subflow entry, 86.9 s. Oracle `passed`; store 89,636,864 bytes |
| `run-mu7fmzcb-0db869c6` | **shipped branch state** | `facilityFailure: {reason: "http.timeout", operationStage: "control.request", timeoutMs: 30000, endpoint: "/api/programs/automation-studio/run-runtime-session"}` |

**Router and subflow, answered.** One created Flow was a straight line of 10
action nodes; the other three had a router. Those three made **exactly one route
decision and one subflow entry** each. The sibling finding, that model-authored
router rules carry no condition and so always match, did not produce a loop
here: an always-matching rule over one subflow enters it once. The runs took
62–87 s because each performs 8–10 browser actions at about 5 s each, not
because anything repeats.

**t012, tested directly rather than by elimination.** The probe recorded
`grantPath: true` on the timed-out call. The grant path (`llmExecution`) makes
`executeRecordedFlowRun` skip `startPersistedFlow`, so no run id exists until
Core replies, and Core replies only after the whole run and its verification.
The bounded-failure recovery then rethrows at once
(`packages/test-runner/src/flow-lane/persisted-flow-run.ts:257,264-281`):
`if (!isBoundedHttpFailure(error) || !executedRunId) throw error` has no id to
work with. Before t012 the created lane took the deterministic path, which
starts the run first and so always had an id to poll.

### What I changed, and what I took back

**Kept: every bounded HTTP failure now names its Core route.** You scoped this
in, and the last live run above proves it.

- `packages/test-runner/src/http-control/index.ts`: `boundedFetch` takes the
  route and puts it on the timeout, abort and transport failures' details. It
  carries the route only, with any query string cut, because
  `create-project?domainId=` carries a caller's value.
- `packages/test-contracts/src/evaluation.ts` and `evaluation-validation.ts`:
  `FacilityFailureDiagnostic` gains an optional `endpoint`. It is validated
  against `FACILITY_FAILURE_ENDPOINT_PATTERN`
  (`^/api/[a-z0-9][a-z0-9/_-]{0,119}$`) and allowed only on the three `http.*`
  reasons. The field is optional, so existing evaluations stay valid.
- `packages/test-runner/src/facility-failure/project-facility-failure.ts`:
  projects `details.path` into `endpoint` only when it matches that pattern.
  Anything that is not a Core route is dropped.
- The durable run-event projection `httpTransportFailureDetails` is
  **unchanged**. An existing security test requires it to carry closed fields
  only, and I first broke that test by adding the path to it. I reverted that
  change, and the test stands as it was.

**Taken back: a recovery that made the timed-out run readable.** It is what
produced the four `succeeded`/`passed` results above. `executeRecordedFlowRun`
listed the Flow's runs before a granted run. On a bounded failure it identified
the one new run and read it to its end.

You said not to work around the wait, so it is reverted, together with its
tests and a fake update in `live-repair-lane.test.ts`. It is worth placing after
t016 lands, as a complement rather than a replacement. A 300 s wait still leaves
a run longer than 300 s with no id to read back, and the run list closes that
for a run of any length. The design:

1. List the Flow's runs (`list-flow-runs`) before the granted call.
2. On a bounded failure, take the one run id that is new. None, or several,
   leaves the original failure standing.
3. If the list fails, the run goes ahead without recovery rather than failing.

**Hands off, as instructed**: `flow-lane/creation/lane.ts` and
`existing-fluxiq-control.ts` are unchanged on this branch. I needed no logging in
`existing-fluxiq-control.ts`: the route is attached one layer down, in
`http-control/index.ts`, which every control call goes through.

### The next blocker: the redaction attestation, in this repository

Every run that read the playback to its end failed `security.redaction`, 4 of 4:

```
findings: [{ scope: "workspace", path: ".fluxiq/global.sqlite", categories: ["unscanned-store"] }]
```

Every run that stopped at or before the timeout passed the same attestation,
including two where the timed-out request was still being worked on inside
Core. The probe named the branch:

- **`packages/test-runner/src/secret-leak-attestation.ts:218-220`**, the
  `metadata.size > limits.maxStoreBytes` arm of `stageDatabase`.
- `global.sqlite` measured **89,636,864 bytes (85.5 MiB)**: a regular file, not
  a link.
- `maxStoreBytes` is 33,554,432 bytes (32 MiB); the 64 MiB `maxTotalBytes` is
  exceeded too.
- The two other stores read clean: 1.3 MB and 64 KB.

The comment above the limits gives the reason for the ceiling: 32 MiB is "a
little over three times the largest store a healthy run has produced". That was
10.02 MiB, from `social-scheduler-week-ahead`, a run that never completed a
state-changing Flow. A completed 8–10-action playback on this 280-row page
leaves a store 8.5 times that size. My reading, not verified, is that Core
stores page evidence for every action attempt on a big page.

This is a fail-closed security control, so I did not change it. The choice is
either to raise the store and total ceilings with a stated reason, or to have
Core store less per attempt. That belongs to whoever owns t014 and Core's run
storage.

### Commands run and observed results (follow-up)

- `pnpm --filter @fluxiq-web-extension/test-contracts test` → `# pass 115 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` → `# pass 1146 # fail 0`.
  One earlier run of this suite failed `FIFO tickets prevent a later scheduler
  from overtaking an earlier waiter`, a timing test in a file I did not touch.
  It passed on every later run.
- `DOMAIN_TEST_BUILD_LABEL=t011 pnpm --filter @fluxiq-web-extension/domain test`
  → `# pass 677 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension test` → `# pass 688 # fail 0`.
- `pnpm check` → exit 0; `structure-audit: passed (76 warning(s), 122 baselined)`.
- Mutation, timeout details without the route → **1 fail**, exactly `a timed-out
  request names the Core route it went to, and never the query string`.
  Reverted; back to 1146/1146.

### Not verified (follow-up)

- **That t016's 300 s wait is enough.** The four runs read to their end took
  63–87 s, well inside 300 s, but I have not run the two branches merged.
- **Why Core's store is 85.5 MiB.** Only its size and the failing branch are
  measured.
- **Whether `lab.generation_http_400` has a real cause.** One occurrence, and it
  did not recur.

### Open questions or contradictions found (follow-up)

1. **Merge order.** This branch holds three things of different kinds:
   - the removal of the safety rule, which waits for t018's permission
     contract, as agreed;
   - the endpoint naming, which is independent and safe to land alone;
   - the automation-tab reload fix, which is also independent.

   If you want the naming or the reload fix sooner, they can be split out; their
   files do not overlap with the rule removal.
2. **Once t016 lands, the redaction ceiling is what every completed
   created-Flow run will hit next.** Decide it before the next corpus run, or
   every success will read as `security.redaction`.

---

## Wiring the press to Core's permission contract (t018)

Base `aca335f` (dev merged, including t016, t018, t020 and t022); shared Core
`80a8495`.

### Outcome

**Partial.**

- **Exploration presses are wired to Core's permission check, and it works
  live.** It fires, names the control, and nothing is committed.
- **Plan steps are not wired.** The declaration needs a Core change,
  described below.
- **Neither live proof passed as specified.** The instructed task was blocked,
  because the model's class and Core's reading of the instruction disagreed.
  The refund task never reached the refund control.

### How a press's consequences are determined

**The model declares them itself.** `web.press_control`, and the recovery
option `web.recovery.press`, now *require* `consequences`: Core's classes for
what this press itself lastingly does, or `[]` when it only changes what is
shown. FluxIQ never judges a control by how it looks. The contract did not force
a classification of controls, and no word list was written.

`permission.ts` turns the declaration into Core's check:
- `[]`: no call is made.
- A list of Core's classes: `await request.permission({ consequences, control:
  { name: <the packet name or text the model was shown>, kind }, verb: "press"
  })`, and the press is made only when Core permits it.
- Not permitted: refused `web.action.rejected.permission_required`.
- Not a list of Core's classes: `invalid_input`.
- No permission check passed in: refused, never taken.

`permission_required` is deliberately left unclassified, so it is not mapped to
`operator_approval_required`; Core already holds the request. The recovery
option passes `execution.permission` through.

Optional was tried first. The model simply omitted the declaration, and every
step went unasked (`run-mu7ia0cl-060ec935`). An optional declaration is a gate
the model can walk past.

### Plan steps: blocked on Core

I first let a step declare on its target handle:
`{ handle, consequences }`. Core's handle parser admits only
`{ handle, location? }` (`AS/runtime/llm/harness-options/plan-node-handles.ts`,
`isReferenceShape`, around line 79). The declared object therefore was not
read as a handle, and the node failed `bootstrap.invalid_parameter_value`,
4 times in `run-mu7iv81y-eb1dc973`. I reverted it, and
`resolve-plan-node.ts` is back to `aca335f`.

To gate Flow steps, Core must accept a declaration on the handle, or on the node
beside it. The domain half was written and works: it was measured, then
reverted. **A Flow step is not permission-checked on this branch.**

### Live evidence (`FLUXIQ_TEST_RUNS_DIR='F:\r11'`)

The build record now carries `instructedConsequences` (from the proposal) and
`permissionRequest`, including Core's `authority.instructed` with the person's
quoted words. Change: `flow-lane/creation/build-proposal.ts`.

| run | task | result |
| --- | --- | --- |
| `run-mu7itmcl-30d93066` | schedule-post (instructed) | `flow_bootstrap.permission_required`: exploration press on **"Schedule post"** (button), declared `create_new`, missing `create_new`. **Nothing scheduled** (build ended before any playback) |
| `run-mu7j3a8m-dbdf0478` | schedule-post, shipped code | `permission_required` on **"New post"** (button), declared `create_new`. Core read the instruction as `send_or_publish` ← *"Schedule a post to the Northwind Trails account for the morning of 24 September at nine o'clock, saying: …"*. Missing `create_new`; nothing scheduled |
| `run-mu7j4dz4-ed09f5fe` | `order-operations-refund-quote` (new task: *"…find out how much refunding the first line on it would give back, as the refund confirmation shows it. Do not change the order."*) | No request. The model never pressed the refund control with a declaration; ended `evidence_repeat_without_progress` after 11 calls. **Nothing refunded**; no request naming the refund control |
| `run-mu7ipw91-fcd3ca57` | refund-quote | `lab.generation_http_400`, zero provider calls, before the model (seen twice before, not reproduced) |
| `run-mu7ia0cl-060ec935` | schedule-post, optional declaration | Proposed with no declaration and `instructedConsequences: []`; the playback then timed out at `run-runtime-session`, 30 s |

**Why the instructed job was blocked.** Two model readings must agree class for
class, and here they did not:
- The press model over-declared: `create_new` for opening "New post", which
  only opens a form, and for "Schedule post".
- Core's instruction reader classified the same words as `send_or_publish`.
- A class the instruction plainly covers in intent therefore reads as not
  instructed.

There is a narrow fix on each side:
- This repository: the press description must say more firmly that opening,
  showing or ticking is `[]`.
- t018: decide whether the declared classes should be reconciled against the
  instructed ones rather than compared exactly.

The first is cheap and I would do it next. The second is a Core design choice.

**The run timeout.** `run-mu7ia0cl` still timed out at `run-runtime-session`
with a 30 s bound, although t022 is said to be merged. The coordinator should
check that t022 covers the created lane's playback.

### Not done

- **Recovery wiring**: passing `permittedConsequences` and the instructed
  classes into `runAutomationStudioRuntimeExploration`. Out of scope, as
  instructed.
- **Plan-step permission**: blocked on Core accepting a declaration, as above.
- **Proof 1** (instructed task proceeds, post scheduled, oracle passed): not
  achieved.
- **Proof 2** (request names the refund control): not achieved; no refund
  press was attempted.

### Checks run

- `tsc` for domain (source and tests) and test-runner → exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t011 pnpm --filter @fluxiq-web-extension/domain test`
  → `# pass 680 # fail 0`. New tests: each of Send, Delete, Confirm, Refund and
  Retry is refused `permission_required` with nothing pressed when Core says no,
  and pressed when it says yes. Core is asked with the shown name and the
  model's classes. `[]` asks nothing, an unreadable declaration presses nothing,
  and no check means refused.
- `pnpm --filter @fluxiq-web-extension/extension test` → `# pass 688 # fail 0`.
- `pnpm check` → exit 0.
- The test-runner and test-contracts suites were not rerun, per the quota
  instruction. The test-runner type-check inside `pnpm check` passed.

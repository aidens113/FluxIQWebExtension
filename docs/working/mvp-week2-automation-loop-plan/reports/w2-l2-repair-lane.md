# w2-l2-repair-lane — a repair lane that explores, then approves, applies and replays

## Outcome

**Done**, with one deliverable partly blocked by Core and one verification blocked by a
fixture I do not own.

1. **`--llm-task repair` exists and plans Core's `explore_and_adapt` grant.** Verified from
   the built CLI: the campaign's own limits produce
   `{purpose: "explore_and_adapt", task: "repair", maxCalls: 26, maxTotalTokensPerRun: 600000,
   maxTotalEstimatedCostUsd: 2, highTokenConfirmation: true}`. The grant iterates, and its
   call count is the operator's `--llm-max-calls` bounded only by Core's backstop of 64 —
   never a per-task constant. `adapt` is untouched and still plans `diagnose_and_adapt`.
2. **Approve, apply and `--replays N` are built for both `repair` and `adapt`.** The lane
   approves each adaptation the run saved, applies it, then re-runs the applied Flow N times
   with **no execution grant**, recording per replay whether Core counted a provider call
   (it must be 0) and whether the fixture's goal held. A run that saved no adaptation — a
   refusal task — applies nothing, replays nothing, and is not failed for it.
3. **Exploration is recorded per run in `snapshots/live-llm.json`, as counts and codes.**
   Outcome, the code that ended it, the stop reason, and seven counts. **Tool ids and
   per-tool result codes are not there, because Core does not publish them on a run detail.**
   The read for them is written and tested, and the record says `toolDetail: "not-published"`
   so an empty list can never be read as "no tool was called". The exact Core change that
   would fill them is under *Open questions*, item 1.
4. **The campaign switch is an exact diff below** (section 6), not applied: another worker
   holds `scripts/lab/live-campaign/**`.

Also delivered, from the mid-task instruction: **the Core action probe now asks whether the
page will accept the action rather than whether the target is visible.** Verified by four new
unit tests and two new source assertions. **Not verified live** — see section 5.

## What changed and why

### 1. `--llm-task repair` (deliverable 1)

- `packages/test-contracts/src/llm.ts`: `"repair"` added to `llmTaskKinds`, with a comment
  saying what separates it from `adapt`. **This file is outside my brief's ownership list.**
  It was unavoidable: `LlmExecutionProfile.task` is typed from that union, so `--llm-task
  repair` cannot exist without it. Nobody else is editing it (`git status` clean there), and
  it is a one-word addition plus a doc comment.
- `live-llm/live-llm-plan.ts`: `purposeOf` maps `repair` → `explore_and_adapt`. Everything
  else — the budget reconciliation, the clamps, the high-token confirmation — is shared with
  `adapt`, so `repair` takes exactly the same budget flags. `PURPOSE_ITERATES` already had
  `explore_and_adapt: true`, so the call count is the operator's.
- `commands.ts`: `repair` accepted by `--llm-task`.
- `live-llm/live-llm-run.ts`: new `repairsFlow` getter (`diagnose_and_adapt` or
  `explore_and_adapt`). `proposesRepairOnly` is deliberately **not** widened: a `repair` run's
  patch may be executed by Core, so it must be held to the scenario's real expectations, not
  to the declared proposal-only outcome.

### 2. Approve, apply, replay (deliverable 2)

Four new modules under `packages/test-runner/src/flow-lane/repair/`:

- **`apply-repair.ts`** — `applyLiveRepair`. For each adaptation the run saved: read its
  status, `review-flow-adaptation` `approve`, then `apply`, then read the status back. Core's
  promotion gates (`runtime/recovery/adaptation-promotion.ts`) accept either a succeeded trial
  **or** a named reviewer's approval read from `metadata.review.approvedBy`, and the Lab calls
  Core as the account it logged in as, so the approval is what satisfies the gate. An
  adaptation Core already applied (an executed patch under `explore_and_adapt`) is left alone
  and counts as applied. Outcomes: `no_proposal`, `applied`, `not_applied`.
- **`replay-repair.ts`** — `replayRepairedFlow`. Per replay: prepare the page, run the Flow
  through `executeRecordedFlowRun` with **no `llmExecution`**, read the run detail, and
  consult the goal. `modelCalled` is read from Core's own accounting
  (`llmAccounting.calls` → `providerCallCount` → itemized lines) **or** a recorded
  intervention — not from "we did not pass a grant", which is an intention rather than a
  measurement. A replay Core could not run at all is `outcome: "unreachable"` with the
  failure's *category*, and the remaining replays still run.
- **`prove-repair.ts`** — `proveLiveRepair` sequences the two and returns the proof;
  `assertLiveRepairProof` judges it. Nothing is replayed unless every adaptation reached
  `applied`, because replaying an unrepaired Flow measures the unrepaired Flow.
- **`run-repair-lane.ts`** — `runLiveRepairLane`: rebuilds the run's inputs (declared secrets
  and uploads, keyed by the paths this Flow's nodes ask for), runs the proof, writes
  `snapshots/repair-lane.json`, publishes a settle event, then judges. Published **before**
  judged, for the reason the Flow lane publishes first: evidence written only when the
  assertions pass cannot explain the run that failed them.

CLI: `--replays N` (0–10) on `lab run`. It requires `--live-llm` with `--llm-task repair` or
`adapt`, and `--flow`. **Without the option the lane does nothing at all**, so every existing
repair run behaves exactly as it did. `--replays 0` applies the repair and proves nothing,
which is how a repair is made durable without paying for the proof.

`checkGoal` is judged against the scenario's own `workflow`, never the proposal-only
`flowWorkflow` an `adapt` run's Flow run was held to: once the repair is applied, the Flow is
expected to reach the state the variant declares.

### 3. The exploration record (deliverable 3)

`live-llm/exploration-record.ts`, wired into `LiveLlmRun.settle` and `settleUnfinished` (a
lane that failed after exploring is exactly the run whose exploration is worth having). It
reads `runDetail.metadata.recoveryTrace`'s `exploration` stage — the client's parser drops
`metadata`, so this makes its own raw `get-flow-run-detail` call.

What reaches `snapshots/live-llm.json` under `exploration`: `source`, `requested`, `status`,
`providerCalled`, `outcome`, `endedBy`, `stopReason`, `noProgressReason`, and counts for
`actions`, `observedActions`, `refusedActions`, `unusableDecisions`, `providerCalls`,
`evidenceBytes`, `durationMs`. Every count is `null` where Core published none, never `0`:
an exploration stopped after four tool calls and one that never started must not read alike.
Core's own `reason` sentences are dropped, and a test asserts the snapshot does not contain
them. Anything that is not a code (`^[a-z][a-z0-9_.:-]{1,127}$`), a flag or a whole number is
dropped rather than recorded.

`source` is `"recovery-trace"`, `"absent"` or `"unreadable"`, so an empty record always says
which it is. The read never throws: a settlement's own refusals (an overspend, a provider
never reached) are what a run should fail on.

### 4. The Core action probe (mid-task instruction)

`run-scenario.ts:646` now passes a trial click instead of a visibility wait, with the two
comment lines from `w2-campaign-tasks-start.md` section 4. The predicate itself moved to a new
`lane-rules/probe-target.ts` (`coreProbeTargetUsable`), beside `probe-step.ts`: that file
chooses *which step*, this one answers *whether the page will accept it*. **`lane-rules/` is
outside my brief's ownership list**; nobody is editing it, and putting the predicate there
rather than inline is what made it testable.

A property worth stating because it bounds the risk: a stricter check can only make the probe
choose a later candidate or be **skipped**, and `proveCoreActionRoundTrip` publishes a skipped
probe with its reason and returns without failing the run. So the change cannot turn a passing
scenario into a failing one by rejecting its probe target; it can only stop the probe running.

### 5. Files moved, and why

`run-scenario.ts` was **794 lines against an 800-line hard limit** before I touched it, so the
repair-lane call had nowhere to go. Rather than shaving lines I moved the extension-runtime
helpers — `runtimeMessage`, `extensionStatus`, `pollStatus`, `recordingStartDiagnostic`,
`describeRecordingStartDiagnostic` — into a new `run-lifecycle/extension-runtime.ts`. They are
one subject (asking the extension's runtime a question and reading the status back) and
`run-lifecycle/` already owns the extension worker wait and the pairing recovery. **That
directory is also outside my ownership list**; it had no uncommitted changes.

`run-scenario.ts` is now **777 lines**, 17 shorter than when I started, with the repair lane in
it.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner test` → exit 0,
  `# tests 1149 # pass 1149 # fail 0` (1145 before this work, plus 4 new probe tests; 27 other
  new tests replaced or joined existing files).
- `pnpm --filter @fluxiq-web-extension/test-contracts test` → exit 0,
  `# tests 113 # pass 113 # fail 0`.
- `pnpm lab:test` → exit 0, `# tests 73 # pass 73 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` in `packages/test-runner` → exit 0, no output.
- `node scripts/structure-audit.mjs` → exit 1, `structure-audit: 2 violation(s) across 1
  rule(s)`. **Both are `working-docs` on shared documents and neither is mine:**
  - `docs/working/mvp-week2-automation-loop-plan.md: 807 lines exceeds the 800-line compaction
    threshold` — I did not touch that document.
  - `docs/working/README.md is out of date with the documents' header blocks` — regenerated by
    the supervisor with `pnpm structure:baseline`; other workers' new report files are already
    untracked in the tree, and this report adds another.

  **All four findings the coordinator named are cleared.** They were:
  `[failure-as-empty] flow-lane/repair/apply-repair.ts`, `[file-lines] run-scenario.ts 835`,
  `[imports] flow-lane/repair/replay-repair.ts`, `[imports] run-scenario.ts`. The audit now
  reports no `FAIL` outside `working-docs`.
- The live command below, parsed and planned through the built CLI (no run):
  `{"purpose":"explore_and_adapt","task":"repair","maxCalls":26,"maxTotalTokensPerRun":600000,
  "maxTotalEstimatedCostUsd":2,"highTokenConfirmation":true}`.
- `pnpm lab run storefront-checkout` and two variations → refused before any browser:
  `FLUXIQ_TEST_PROJECT_ID is required for an existing or clone target`, then
  `--target isolated conflicts with FLUXIQ_TEST_TARGET=existing`, then
  `isolated target cannot use existing-install configuration: FLUXIQ_TEST_BASE_URL,
  FLUXIQ_TEST_GATEWAY_URL`. See *Not verified*.

### How the new behaviour is pinned

- `live-llm/tests/exploration-record.test.ts` (6 tests): a recorded exploration reads as its
  counts and codes; a limit and the no-progress guard are named; a run with no exploration is
  `absent` with `null` counts, four ways; an unreadable trace and a failed read say so; prose,
  non-integers and a `"yes"` flag are dropped; tool ids are `not-published` today and are
  deduplicated, sorted and prose-filtered when Core does publish them.
- `flow-lane/repair/tests/apply-repair.test.ts` (6): approve then apply with the call order
  pinned; no adaptation costs no Core call; an already-applied adaptation is not reviewed
  again; a refused review is reported by category and the next adaptation is still attempted,
  with Core's refusal sentence absent from the record; a failed status read propagates; a
  non-identifier adaptation id is refused before any call.
- `flow-lane/repair/tests/replay-repair.test.ts` (5): each replay prepares, runs **ungranted**,
  and reports 0 provider calls; zero replays runs none; a provider Core counted is reported by
  ledger, by gate count and by intervention; a failed Flow and a missed goal are recorded
  distinctly; an unreachable replay carries the category, not the message, and the loop
  continues.
- `flow-lane/repair/tests/run-repair-lane.test.ts` (8): the whole lane against a fake Core —
  applied and replayed twice with the reset before each; a refusal task applies and replays
  nothing and does not fail; no `--replays` does nothing; a provider-free run does nothing;
  `--replays 0` applies and proves nothing; a refused apply fails the run **after** the proof
  is written; a replay that called the model fails as "not deterministic"; a missed goal fails
  naming the replays.
- `lane-rules/tests/probe-target.test.ts` (4): the probe uses `{trial: true}` so it presses
  nothing; a covered target answers `false` rather than throwing; a covered candidate is passed
  over for the next one; an all-covered page skips the probe without quoting a typed value.
- `run-evaluation/tests/runner-wiring.test.ts`: the pinned `lane-rules` import line updated,
  plus two new assertions — the probe's check is `coreProbeTargetUsable`, and the
  visibility-only form is gone. **That file has uncommitted changes from another worker**; my
  edit is one replaced line plus four added lines.
- `live-llm/tests/lane-settlement.test.ts`: the settle control gained `automationStudioCall`
  and a recovery trace; the failed-lane test now asserts the exploration was read on the same
  run id, the counts reached the snapshot, and Core's prose did not.
- `live-llm/tests/live-llm-run.test.ts`: a run detail with no recovery trace must read as
  `source: "absent"` with `counts.actions === null`.
- `live-llm/tests/live-llm-plan.test.ts`: `repair` → `explore_and_adapt` with the operator's
  call count, refused above 64, and `adapt` unchanged.
- `tests/commands.test.ts`: `--llm-task repair` with the campaign's budget flags; `--replays`
  accepted for `repair` and `adapt`, absent unless typed, and refused without `--live-llm`,
  without `--flow`, on `create-flow`, above 10, and when not an integer.

## The live command

One repair task, with exploration and two replays. Run it from the isolated pair.

```
pnpm lab run identity-drift --variant renamed-redesign --flow --live-llm \
  --llm-profile lab-explore-repair --llm-provider deepseek --llm-model deepseek-chat \
  --llm-task repair \
  --llm-max-input-tokens 42000 --llm-max-output-tokens 8000 --llm-max-total-tokens 50000 \
  --llm-max-run-tokens 600000 --llm-max-calls 26 --llm-max-cost-usd 0.25 \
  --replays 2
```

On one line, for PowerShell:

```
pnpm lab run identity-drift --variant renamed-redesign --flow --live-llm --llm-profile lab-explore-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task repair --llm-max-input-tokens 42000 --llm-max-output-tokens 8000 --llm-max-total-tokens 50000 --llm-max-run-tokens 600000 --llm-max-calls 26 --llm-max-cost-usd 0.25 --replays 2
```

What to read afterwards, and what passing looks like:

- `snapshots/live-llm.json` → `purpose: "explore_and_adapt"`, `exploration.source:
  "recovery-trace"`, `exploration.counts.actions > 0` and `exploration.counts.providerCalls >
  1`. If `exploration.source` is `absent`, the run never explored and the rest of the run is
  a two-call adapt in a repair's clothing.
- `snapshots/flow-lane.json` → `harnessRecovery.adaptationIds` non-empty.
- `snapshots/repair-lane.json` → `application.outcome: "applied"`, then two replays each with
  `outcome: "ran"`, `providerCalls: 0`, `modelCalled: false`, `goalPassed: true`.
- A refusal task (`--variant save-and-exit`) should reach
  `application.outcome: "no_proposal"` with `replays: []` and still pass.

## 6. The campaign switch (deliverable 4) — exact diff, not applied

`scripts/lab/live-campaign/**` belongs to another worker, and several of these files have
uncommitted changes, so apply these against the working tree rather than against `5e583ef`.

The first four hunks are the switch itself. The `--replays 2` hunk is marked separately: it
changes campaign behaviour (adaptations are applied durably), so it can be dropped without
affecting the rest.

```diff
--- a/scripts/lab/live-campaign/lab-run/profiles.mjs
+++ b/scripts/lab/live-campaign/lab-run/profiles.mjs
@@ -1,2 +1,2 @@
 /** The LLM profile each kind of task runs under unless `--llm-profile` names one for every task. */
-export const DEFAULT_PROFILES = Object.freeze({ create: "lab-create-flow", repair: "lab-adapt-repair" });
+export const DEFAULT_PROFILES = Object.freeze({ create: "lab-create-flow", repair: "lab-explore-repair" });
```

```diff
--- a/scripts/lab/live-campaign/lab-run/command.mjs
+++ b/scripts/lab/live-campaign/lab-run/command.mjs
@@ -6,7 +6,7 @@
 /**
  * The per-call and per-run limits a repair run gets unless the same option is
  * given after `--`: the ones live adapt runs have worked with
  * (`run-mu4ovip2-b15551d3`). The Lab refuses an option given twice, so a
  * limit given after `--` replaces its default rather than joining it.
  */
@@ -17,7 +17,9 @@
 /**
  * The Lab arguments for one task, after `pnpm lab`. A creation task builds a
  * Flow from its instruction; a repair task runs the Flow recorded on the
- * unarmed page against its variant, with the model allowed to diagnose and
- * propose (`adapt`), under `REPAIR_LIMITS` less any given after `--`.
+ * unarmed page against its variant, with the model allowed to explore the live
+ * page, diagnose and repair (`repair`, Core's `explore_and_adapt`), under
+ * `REPAIR_LIMITS` less any given after `--`. `adapt` made exactly two calls and
+ * could never gather the evidence its first move asks for.
  */
 export function labRunArguments(task, options) {
@@ -28,6 +30,6 @@
   return [
     "run", task.scenarioId, ...(task.workflowId ? ["--workflow", task.workflowId] : []), ...(task.variantId ? ["--variant", task.variantId] : []),
-    "--flow", ...identity, "--llm-task", "adapt", ...limits, ...options.labArgs,
+    "--flow", ...identity, "--llm-task", "repair", ...limits, ...options.labArgs,
   ];
 }
```

```diff
--- a/scripts/lab/live-campaign/arguments.mjs
+++ b/scripts/lab/live-campaign/arguments.mjs
@@ -9,1 +9,1 @@
-export const CAMPAIGN_USAGE = "Usage: pnpm lab:campaign [task-id ...] [--kind form|navigate|extract|navigate-and-extract|repair[,...]] [--all] [--limit N] [--dry-run] [--no-build] [--max-attempts N] [--llm-profile ID (default lab-create-flow, or lab-adapt-repair for repair tasks)] [--llm-provider NAME] [--llm-model NAME] [--output DIR] [-- LAB-OPTIONS]";
+export const CAMPAIGN_USAGE = "Usage: pnpm lab:campaign [task-id ...] [--kind form|navigate|extract|navigate-and-extract|repair[,...]] [--all] [--limit N] [--dry-run] [--no-build] [--max-attempts N] [--llm-profile ID (default lab-create-flow, or lab-explore-repair for repair tasks)] [--llm-provider NAME] [--llm-model NAME] [--output DIR] [-- LAB-OPTIONS]";
```

```diff
--- a/scripts/lab/live-campaign/summary/markdown.mjs
+++ b/scripts/lab/live-campaign/summary/markdown.mjs
@@ -19,1 +19,1 @@
-    `Started ${summary.startedAt}, finished ${summary.finishedAt ?? "(in progress)"}. Lab: creation tasks \`pnpm lab run ... --llm-task create-flow\` (profile \`${profiles.create}\`), repair tasks \`pnpm lab run ... --flow --llm-task adapt\` (profile \`${profiles.repair}\`); ${provider}/${model}, up to ${maxAttempts} attempt(s) per task.`, "",
+    `Started ${summary.startedAt}, finished ${summary.finishedAt ?? "(in progress)"}. Lab: creation tasks \`pnpm lab run ... --llm-task create-flow\` (profile \`${profiles.create}\`), repair tasks \`pnpm lab run ... --flow --llm-task repair\` (profile \`${profiles.repair}\`); ${provider}/${model}, up to ${maxAttempts} attempt(s) per task.`, "",
```

The two campaign tests that pin the command line:

```diff
--- a/scripts/lab/live-campaign/tests/lab-run-command.test.mjs
+++ b/scripts/lab/live-campaign/tests/lab-run-command.test.mjs
@@ -8,7 +8,7 @@
-test("each repair task becomes one adapt run of the recorded Flow, with the live limits unless they are given after --", () => {
+test("each repair task becomes one exploring repair run of the recorded Flow, with the live limits unless they are given after --", () => {
   assert.deepEqual(labRunArguments(REPAIRS[0], parseCampaignArgs([])), [
     "run", "identity-drift", "--variant", "renamed-redesign", "--flow",
-    "--live-llm", "--llm-profile", "lab-adapt-repair", "--llm-provider", "deepseek", "--llm-model", "deepseek-chat",
-    "--llm-task", "adapt", ...REPAIR_LIMIT_ARGS,
+    "--live-llm", "--llm-profile", "lab-explore-repair", "--llm-provider", "deepseek", "--llm-model", "deepseek-chat",
+    "--llm-task", "repair", ...REPAIR_LIMIT_ARGS,
   ]);
```

```diff
--- a/scripts/lab/live-campaign/tests/command-line.test.mjs
+++ b/scripts/lab/live-campaign/tests/command-line.test.mjs
@@ -56,10 +56,10 @@
-test("the command line: a repair dry run prints the adapt commands and runs nothing", () => withTemp(async (directory) => {
+test("the command line: a repair dry run prints the repair commands and runs nothing", () => withTemp(async (directory) => {
   const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: directory };
   const dry = await runCli(["--kind", "repair", "--dry-run"], env);
   assert.equal(dry.code, 0, dry.stderr);
   const limits = REPAIR_LIMIT_ARGS.join(" ");
   assert.deepEqual(dry.stdout.trim().split("\n").filter((line) => !line.startsWith("#")), [
-    `pnpm lab run identity-drift --variant renamed-redesign --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task adapt ${limits}`,
-    `pnpm lab run identity-drift --variant save-and-exit --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task adapt ${limits}`,
-    `pnpm lab run sensitive-input --workflow extract-card-secrets --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task adapt ${limits}`,
+    `pnpm lab run identity-drift --variant renamed-redesign --flow --live-llm --llm-profile lab-explore-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task repair ${limits}`,
+    `pnpm lab run identity-drift --variant save-and-exit --flow --live-llm --llm-profile lab-explore-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task repair ${limits}`,
+    `pnpm lab run sensitive-input --workflow extract-card-secrets --flow --live-llm --llm-profile lab-explore-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task repair ${limits}`,
   ]);
```

**Optional, separable: make the campaign prove each repair.** Add `--replays 2` to the repair
command, and the same two strings to the two tests above (after `${limits}`, before
`options.labArgs`):

```diff
--- a/scripts/lab/live-campaign/lab-run/command.mjs
+++ b/scripts/lab/live-campaign/lab-run/command.mjs
@@ -30,3 +30,5 @@
+  // Prove each repair rather than only propose it: apply what the model produced
+  // and replay the applied Flow twice with no grant. A refusal task proposes
+  // nothing, applies nothing and replays nothing, which is the correct outcome.
   return [
     "run", task.scenarioId, ...(task.workflowId ? ["--workflow", task.workflowId] : []), ...(task.variantId ? ["--variant", task.variantId] : []),
-    "--flow", ...identity, "--llm-task", "repair", ...limits, ...options.labArgs,
+    "--flow", ...identity, "--llm-task", "repair", ...limits, ...(options.labArgs.includes("--replays") ? [] : ["--replays", "2"]), ...options.labArgs,
   ];
```

With that hunk, `scripts/lab/live-campaign/row/repair-outcome.mjs` can stop reporting
`replayProviderCalls: null` ("the Lab's adapt …" comment on line 14) and read
`snapshots/repair-lane.json` instead: `replays[].providerCalls`. That file is the row
summarizer another worker holds, so I have not written that diff.

## Not verified

- **No live provider run of anything.** The brief forbade it. Every claim about `repair`
  above is from the built CLI's parse and plan, from unit tests against fake Cores, and from
  reading Core's source at `b0f1407`. **Nothing here has met DeepSeek.**
- **The probe fix is not verified live, and the blocker is not the fix.** A provider-free run
  of `storefront-checkout` cannot reach the probe, because defect (a) from
  `w2-campaign-tasks-start.md` section 4 **has not landed**: `apps/scenario-lab/src/scenarios/
  storefront-checkout/manifest.ts:10` still reads `cardExpiry: "12/34"` and
  `payment-frame.ts:39` still reads `maxlength="5"`, so
  `scenario-redaction-literals.ts` refuses the scenario before the bundle, the topology or a
  browser exists — on the recording lane too, not only `--flow`. That fixture is not mine.
  I then tried to run a different scenario (`basic-form`) on the isolated target to check the
  stricter probe had not regressed an ordinary run, and this repository's `.env.local` pins
  the `existing` target with `FLUXIQ_TEST_BASE_URL` and `FLUXIQ_TEST_GATEWAY_URL`; forcing
  `isolated` is refused unless those are removed. **I did not edit the shared environment
  file to force it.** Running it from the isolated pair would settle it.
- **No live run has produced `snapshots/repair-lane.json`.** Every replay assertion is from a
  fake Core. In particular, whether Core's `applyFlowAdaptationDurably` changes the Flow such
  that a later ungranted run uses the repaired target is Core's contract, read but not
  observed.
- **The approve-then-apply gate is reasoned, not observed.** `metadata.review.approvedBy` is
  set only when Core's `request.actor?.userId` is present and is not `"runtime"`. I read that
  the Lab's authenticated session supplies it; I did not watch Core set it.
- **The rebuilt replay inputs are not compared against the lane's own.**
  `runLiveRepairLane` recomputes the secret bindings and upload inputs that `runFlowLane`
  resolved internally, because the lane does not return them. They are computed by the same
  exported helpers from the same nodes, but nothing asserts the two agree. A scenario with
  declared secrets or uploads has not been replayed.
- **The extra read per settlement was not measured.** A live run now reads its run detail
  once more, for the exploration record.
- **Documentation not updated.** `docs/architecture/` was out of scope; the snapshot layout
  changed (`exploration` on `live-llm.json`, a new `repair-lane.json`) and the CLI gained an
  option, which would normally call for an update there.
- **`pnpm check` and `pnpm build` were not run at the repository level.** Other workers hold
  uncommitted changes in `flow-lane/{expectations,run-flow-lane,creation}`, `run-expectations`,
  `facility-failure` and `scripts/lab/live-campaign`, so a red result would not have been
  attributable. The three checks my brief named all pass.

## Open questions or contradictions found

1. **Core does not publish the exploration's tool ids or result codes, so deliverable 3 is
   short by design.** `AutomationStudioLlmEvidenceLoopTrace` carries `toolId` and `resultCode`
   per step (`runtime/llm/evidence-loop.ts:66-77`), and `runAutomationStudioRuntimeExploration`
   returns the whole trace, but `automationStudioExplorationTraceEvent`
   (`runtime/recovery/runtime-exploration.ts:197-232`) publishes only counts into the stage
   `detail`, and that stage is all `metadata.recoveryTrace` keeps. The adaptation
   `evidenceLoop.toolIds` the Lab already parses is the **Flow-bootstrap** path, not the
   runtime recovery. The Core change is one addition to that trace event's `detail`:

   ```
   toolIds: [...new Set(exploration.trace.flatMap((step) => step.toolId ? [step.toolId] : []))],
   resultCodes: [...new Set(exploration.trace.flatMap((step) => step.resultCode ? [step.resultCode] : []))],
   ```

   Both are closed vocabularies, neither carries page data, and the Lab side is already
   written and tested: the record fills itself and flips `toolDetail` to `"recorded"` with no
   further change here.
2. **Three files outside my brief's ownership list were necessary.** Named here so the
   supervisor can check them first: `packages/test-contracts/src/llm.ts` (the task kind —
   the deliverable is impossible without it), `packages/test-runner/src/lane-rules/` (the
   probe predicate and its tests) and `packages/test-runner/src/run-lifecycle/` (the
   extension-runtime move that made room in `run-scenario.ts`). None had uncommitted changes.
   A fourth, `run-evaluation/tests/runner-wiring.test.ts`, **does** have another worker's
   uncommitted changes; my edit there is one replaced line plus four added, and it was
   required because that test pins the exact `lane-rules` import line I changed.
3. **`--replays` does three things under one name** — approve, apply, replay — and I chose
   that deliberately, because the three are one claim and because a separate `--apply-repair`
   would let a run apply a repair it never proved. `--replays 0` is the escape hatch. If the
   supervisor would rather they were separable, the split is in `runLiveRepairLane` and is
   small.
4. **An `adapt` run with `--replays` now behaves differently from one without.** Applying the
   proposal changes the Flow, where before an `adapt` run left it alone. Existing campaign
   rows are unaffected only because the option is absent unless typed. The optional campaign
   hunk in section 6 would change that for every repair row, which is why it is separated.
5. **A repair run's Flow-lane expectations are the variant's own, not the proposal-only
   ones.** `withDeclaredFlowRepair` substitutes `proposalOnlyOutcome` only when
   `live.proposesRepairOnly`, which stays `diagnose_and_adapt`-only. That is intended — an
   `explore_and_adapt` patch may be executed, so the run should end repaired — but it means a
   `repair` run of `identity-drift/renamed-redesign` fails its Flow-lane expectations if Core
   proposes without executing. If that turns out to be Core's behaviour under
   `explore_and_adapt`, the scenario's declared repair needs a second outcome for it, and
   that declaration lives in `apps/scenario-lab/src/scenarios/<id>/repair.ts`.

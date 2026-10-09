# Lane D, first candidate-mode probe: `social-network-feed-confirm-requests` (t275)

Lead: lane D live lead (`lead-xhigh`), dispatched 2026-10-09 ~03:05 UTC by the supervisor.
Brief: `### Brief: lanes B, C and D first candidate-mode probes (one lead per lane)` in the
supervisor's `docs/working/mvp-final-month-plan.md`. Earlier lane D rounds 1-4 (legacy mode):
`reports/live-d.md` in this tree.

## Header

- Trees: `fxwork/t275/!FluxIQWebExtension` on `task/t275-live-lane-d` at `1d04a11a`; dev is `128d907e`, whose only
  change since is `docs/working/mvp-final-month-plan.md` (`git diff --stat 1d04a11a 128d907e`: 1 file), so the
  `behind-dev` guard's documentation exemption admits it. Core `fxwork/t275/!FluxIQ` on `task/t275-live-lane-d` at
  `52d7ac3a` (= Core dev). Both clean (`git status --short` empty).
- Slot 4: `~/FluxStuff/lab-slots/slot-4/owner` = `{"task":"t275","lane":"D","instance":"t275-slot-4",...}`.
  Instance `t275-slot-4`, workspace `t275-d`. No `STOP-balance`, no override files.
- Previous live run of the instance: `run-muxky54f-fadb9d03` (2026-10-07, round 4, failed); its debug exists in this
  tree, and the source fingerprint has changed since (t338-t374 landed), so `debug` and `unchanged` admit one run.
- Window: DeepSeek peak until 04:00 UTC Friday; paid launch only at or after 04:00, none after 05:45.

## Expectations (written 2026-10-09 03:10 UTC, before the dry run and any launch)

Instruction (fixture `live-tasks.ts`): "Go through my friend requests and confirm everyone I have at least five mutual
friends with, and leave every other request as it is. Then give me a table of every request the list now shows as
accepted, in the order the list shows them, with columns name and mutualFriends, where mutualFriends is written exactly
as their request shows it."

Fixture facts (`content/requests.ts`, `manifest.ts` workflow `confirm-requests`, step `extract-confirmed`):

- Eight requests in list order: Tom Becker (1 mutual friend), **Amara Osei (23 mutual friends)**, Priya Nair (4),
  **Jonas Weber ("Aisha Khan and 4 other mutual friends" = 5)**, Diego Alvarez (no line), **Lin Zhao (11)**, **Freya
  Holm (5)**, Marta Kowalczyk (3).
- The Friends home lists only four and the badge says a stale 4; the full list is behind "See all"
  (`~/friends/requests/`).
- Traps: "People you may know" offers Idris Bello (6) and Chloe Martin (9) with Add friend buttons, and a second Jonas
  Weber; none is a request. The first card's Tom Becker is a second Tom Becker.
- Rate limit `CONFIRM_RATE_LIMIT {max: 3, windowMs: 15000}`: a fourth Confirm inside 15 s opens the alert dialog
  "You're going too fast"; a "Try again" button appears within the countdown (manifest waits up to 17 s); pressing it
  confirms.
- Oracle: exactly four records in list order, `{Amara Osei, "23 mutual friends"}`, `{Jonas Weber, "Aisha Khan and 4
  other mutual friends"}`, `{Lin Zhao, "11 mutual friends"}`, `{Freya Holm, "5 mutual friends"}`, read from cards that
  show a message link (accepted). Tom, Priya, Diego and Marta untouched (Confirm and Delete still shown). Final path
  `~/friends/requests/`. No Delete pressed, no Add friend pressed. No permission ask expected (`permittedConsequences
  []`; confirming is on the instruction's authority).

The candidate a correct build submits:

1. Navigate `~/` (or straight to `~/friends/requests/`); optional dismissals (cookies, notifications, chat) marked
   optional, skipped when absent.
2. Reach the full request list (Friends, then See all) unless navigating there directly.
3. A one-page read of the eight request cards `{name, mutualFriends}` whose `where` keeps at least 5 mutual friends,
   counting "Aisha Khan and 4 other" as 5 and the missing line as 0 (a count condition, not a hard-coded name list).
   Exactly Amara, Jonas, Lin, Freya.
4. Confirm, repeated over that read's rows, each re-found by its row. The fourth meets the rate limit; the runtime's
   rate-limit handling (`content/action-runtime/rate-limit-notice.ts`, `rate_limited` with the wait) or the automatic
   retries plus "Try again" must get Freya confirmed. A press reported done when it was refused is a defect.
5. A fresh read of the list **after** the presses, keeping rows shown as accepted, `{name, mutualFriends}`: the Flow's
   answer. The expected names must never be hard-coded in the script.

What the trial must show: `start: "reset"` (all eight pending again even if exploration pressed something), each step
with its attempts, the rate-limit moment, the after-read returning four rows. Both judges yes only on that; a yes on a
Flow missing the after-read, confirming a wrong row, or answering from the pre-press read is a wrong acceptance.

Main risks, predicted:

- R1, the accepted state is unseen at script time: if exploration never pressed a Confirm, the model has no observed
  field for "accepted" (round 4's D4-3) and may write a `where` on an invented field. The trial's feedback must make
  the after-read's empty or wrong answer clear.
- R2, the rate limit in the trial and in playback: the fourth press refused, "Try again" not pressed, or reported
  done.
- R3, the count condition on the mutual line (round 4's judges misread `atLeast 5` on text, D4-4).
- R4, a model-invented final self-check that waits for text that is not there (lane A's Q1).
- R5, exploration presses Confirm live on real rows; harmless only because the trial resets the start.
- R6, the answer mixes reads: the candidate format (`flow-bootstrap/plan/flow-script-format.ts:267`) says rows a Flow
  reads are collected over the whole run, so the listing read's rows and the after-read's rows both reach the run's
  dataset. Identical `{name, mutualFriends}` rows dedupe to four; a listing with any extra column (a status, the
  Confirm button) gives eight or more rows.
- The format's own loop example (`flow-script-format.ts:284-301`, "Confirm every friend request from a colleague") is
  this task's shape; its per-row check `wait_for_text $row.name` is always true (the name is on the card before and
  after), so a candidate copying it gains no evidence that a press took.

Budget: candidate mode on `deepseek-flash`, $0.10 Lab ceiling, the campaign's call limit (48 in rounds 1-4; the dry
run states the current one). Headed browser, chat-started build, one attempt, no relaunch.

UI checkpoints (open from rounds 1-4 and lane A round 7): no previous thread at start; "Starting…" from the send;
"Testing your Flow" during trials; trial and save cards ("Save and test" steps, t373) name what they do; Confirm cards
name the row; choice, type and wait cards name their control (lane A's U1); no "Reading your instruction gave no
answer for ..."; no "Fixing your Flow" in a creation build; list names never cut ("name and mutual..."); on success
"Flow ready" and the table in the chat.

## Ledger

### 2026-10-09 03:05-03:17 UTC: preflight (0 calls)

- Rebuild in the lane trees, logs `fxwork/t275/rebuild-*.log`: Core `pnpm build` (contracts, fluxiq, client gateway,
  web; `core exit 0`, web build 225 s), then domain, test-runner and extension builds, each `exit 0` (the background
  command's own exit 1 was only its closing `tail` of several files).
- Campaign dry run: `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign
  social-network-feed-confirm-requests --dry-run --authoring-mode candidate --max-attempts 1 -- --target
  persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10` printed `pnpm lab run social-network-feed
  --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate
  --llm-task create-flow --instruction-task social-network-feed-confirm-requests --llm-max-input-tokens 992000
  --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated
  --workspace t275-d --llm-cost-ceiling-usd 0.10`.
- That command through `node scripts/lab/run-lab.mjs run ... --dry-run` (log `fxwork/t275/dryrun-candidate.log`):
  exit 0, `{"status":"ready","providerCallCount":0,"lane":"created-flow","buildEntry":"chat",
  "target":"persistent-isolated"}`, workflow `confirm-requests` judged by `expected-dataset` step `extract-confirmed`
  (index 20), instruction 339 characters sha256 `6c11d20a...f8d3`; `deepseek-flash` (= `coreDefaultModel`),
  `coreAuthoringMode: "candidate"`, 48 calls, 25 s per call, `maxEstimatedCostUsd 0.1`, `permittedConsequences []`,
  key by name from `.env.local`; **`candidateTrial {"trialRunner":true,"startReset":true,"source":"lab-plan"}`**;
  `coreWeb {"key":"464b730c5929b2f6fd268c70","cached":false}`. Prelude rebuilt the slot's `scenario-lab`,
  `domain:host-build`, `extension:build`, `test-runner:build` (102 s). The guards skip `--dry-run`; nothing left
  running.

### 2026-10-09 04:00-04:01 UTC: launch

- Dev had moved to `e0305125` at 03:50, again only `docs/working/mvp-final-month-plan.md` (t375/t376 briefs; this
  brief unchanged), so the `behind-dev` documentation exemption still applies. Core HEAD contains Core dev.
- Launched 04:00:08 (`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign
  social-network-feed-confirm-requests --authoring-mode candidate --max-attempts 1 -- --target persistent-isolated
  --workspace t275-d --llm-cost-ceiling-usd 0.10`, log `fxwork/t275/live-candidate-1.log`). Guard
  `{"lab":"live-guard","state":"admitted","instance":"t275-slot-4",...,"fingerprint":"sha256:77ed38ed...49d4ab"}`;
  ledger `start` `launch-mv0fuksg-ae018a6d` at 04:01:23.392Z, pid 4492, `overridden: []`.

### 2026-10-09 04:01-04:11 UTC: run `run-mv0fuual-f9e6f089`: FAILED (no Flow; 36 calls, $0.047233)

- Campaign: `failed (run-mv0fuual-f9e6f089), judgement not measured`, `providerCalls 36`, `reportedCostUsd
  0.04723306`. Ledger `finish` 04:11:52: `verdict failed`, `totalEstimatedCostUsd 0.047233056`, `maxBuildCostUsd
  0.0470586`, `buildsOverCeiling 0`, `balanceFailure null`. `creation-context.json`: `outcome failed`, `savedFlowHash
  null`. No promotion, no chat apply, no Lab playback, no oracle, no replay. Chat build 04:06:54-04:11:21.
- Shape: exploration 0002-0032 (navigate, notifications "Not now", Friends, Friend requests, close chat, two detects,
  two list reads; **no Confirm pressed while exploring**); 8 submissions (revs 1-8: 5 accepted as drafts, 3 refused
  `evidence_completion_plan_invalid`, 1 refused `parameters_unresolved`), 3 identical resubmits refused
  `already_answered`; 2 trials (revs 1 and 5), both `candidate.trial_judged_no`, judges right both times.
- **Cause B (build failure): the candidate could not narrow the rows the Confirm repeat goes over.** Rev 1's listing
  read all eight with no condition and the repeat confirmed all eight; the "5 or more" regex sat only on the
  after-read's `recordOutput.process` (end of run; it also dropped Jonas's "Aisha Khan and 4 other"). Trial 1 and
  trial 2: all eight accepted, table Amara, Lin, Freya. Revs 6-8 tried the right shape, `step eligible: node:
  builtin.data.filter-list` between the listing and `repeat over: eligible`, refused three times in a row:
  `invalid_parameter_value operator` (options exists, equals, not-equals, greater-than, less-than, contains; no
  matches), `required_input_unconnected nodes.s9.inputs.items`, then `unknown_parameter items` for `items:
  $step.requests.records`. The third same-reason refusal ended the build. Code trace: worker W2.
- **Rate limit (the user's point, centre of the debug): the runtime handled it, the model was never told.**
  Core's command attempts (`persistent-isolated/t275-d/fluxiq-root/.fluxiq/artifacts/runtime/command-attempts`):

  | Trial (rev) | Row (iteration) | Refused press, UTC | Named wait | Re-press, UTC | Re-press result |
  | --- | --- | --- | --- | --- | --- |
  | 1 (rev 1) | Jonas Weber (4th) | 04:08:21.072 `361381fe` | 5500 ms | 04:08:33.128 `72b1b006` | succeeded |
  | 1 (rev 1) | Freya Holm (7th) | 04:08:44.083 `0228c953` | 5500 ms | 04:08:57.183 `dd6cd3e8` | succeeded |
  | 2 (rev 5) | Jonas Weber (4th) | 04:10:15.817 `e1226c26` | 6500 ms | 04:10:29.444 `c92b588f` | succeeded |
  | 2 (rev 5) | Freya Holm (7th) | 04:10:40.459 `acc3e9aa` | 5500 ms | 04:10:52.519 `9078a87d` | succeeded |

  - Refused attempt: `web.action.rate_limited`, `retryable: true`, `effect: "unacted"`, `actual`: "the page answered
    the press 9 ms after it with a notice that it was refused for going too fast, and confirmed nothing; it asked for
    a wait, so the press may be made again after 5500 ms"; its page view shows `DIALOG t177 "You're going too fast"
    modal rate_limit`.
  - Re-press: `validation.actual` "the point 1123,361 landed on the target; the execution recovered on attempt 2
    after absorbing blocking_dialog, closing 1 dialog the page had put in the way, waiting 150 ms". So the runtime
    waited, closed the notice and pressed again, inside one node: the popup stayed on screen 12-14 s each time.
  - All eight presses ended accepted (both judges: "All 8 requests were accepted").
  - **What the model was told**: the trial feedback's step entry only, e.g. `{"step": 23, "definitionId":
    "web.output.dom-click", "control": "Confirm", "status": "succeeded", "attempts": 2}` (step 35 the same). No code,
    no rate limit, no wait, no row. Nothing slowed later iterations: the 7th press met the limit again in both
    trials, and rev 5 kept the unpaced loop.
- Side defect: the optional "close the chat if it shows" step (handle `t860`, view 14) acted in both trials on a
  control the feedback names "I can bring the gazebo if you need it" (W2 traces it).

### 2026-10-09 04:16-04:30 UTC: debug (three read-only workers, claims verified by the lead)

Worker reports: `reports/lane-d-candidate-w1-rate-limit.md` (worker-high), `reports/lane-d-candidate-w2-authoring.md`
(worker-high), `reports/lane-d-candidate-w3-ui.md` (worker). Run debug:
`docs/working/language-driven-flow-loop-plan/debugs/run-mv0fuual-f9e6f089.md`.

Lead verification of the load-bearing claims (read at the cited lines in `fxwork/t275`):

- `assemble.ts:318-320` refuses `flow_script.optional_misplaced` "says optional and is part of a repeat";
  `draft-routing.ts:316-318` refuses a repeat inside a repeat, `on <port>:` and a block inside a span.
- `nodes/timing/wait.ts` `execute` returns `{status: "waiting", ...}`; `graph-run.ts:548-557` returns the whole run
  `waiting` on such an attempt. (W1's probe printed `{"status":"waiting","nodes":[["wait","waiting"]],"parked":null}`.)
- `state-routing/could-not-run.ts:17-19`: state routing applies only to `failed` with category `target_not_found`.
- `graph-run.ts:631-640`: the retry wait is `automationStudioBoundedRetryWaitMs({backoffMs, hintedWaitMs, ...})`,
  taken in full after `finishAttempt` (`node-execution/attempt.ts:192-201`, the host-state snapshot), with no credit
  for time already passed.
- `feedback.ts:89-97`: a failed attempt followed by one of the same node is replaced by it, leaving `attempts: 2`.
- Domain `extract-list/catalog-text.ts:233-234`: `where?: [{field, atLeast, ...}]` with "where is optional: omit it,
  keep every item, narrow later"; `one-page-read.ts:9-10`: "`where` stays on the page".
- `submission-refusal.ts:61-64` `refusalCode` takes `feedback.refusal` first, so revs 6-8 counted as one kind.
- View 14 (0014 result): `t857 button "Close chat"`, `t860 "I can bring the gazebo if you need it"` (plain text).
- Pictures: `08-mid-build-scenario.png` shows the dialog ("You can try again in 0 seconds", OK, Try again) over the
  page, Tom, Priya and Diego already "Request accepted", the Elena Sokolova chat still open; `08-mid-build-panel.png`
  shows "Click · Confirm / Didn't work: the page was busy", "Trying the step again — ... often works on a second
  try", "The page was busy, trying again".
- Not verified by the lead: W1's per-step timing split (snapshot 2.7-4.6 s); W2's scratch probe (its
  `extractList.where` shape through the domain resolver with a detected handle is inferred from round 4's live read).

## In plain English

**The run failed and made no Flow.** It cost $0.047 for 36 calls, under half the $0.10 ceiling.

The build explored correctly, then wrote the Flow as a script and tested it twice from a fresh page. Both tests
confirmed all eight friend requests instead of the four with five or more mutual friends. Both judges said no, and
said exactly why. The model then tried a separate filter step three ways; each was refused for a different reason,
and the build stopped.

- **Why it confirmed everyone.** The product already has the right tool: a condition on the list read ("at least 5
  mutual friends"), which counts "Aisha Khan and 4 other" as five. Round 4 used it live and kept exactly the right
  four. But the instructions the candidate builder reads send filtering to the end of the run, where it only trims
  the saved table, and say to leave the read's condition out.
- **The "You're going too fast" popup (the user's point).** It appeared twice in each test, on the 4th and the 7th
  press, never while exploring. FluxIQ handled it inside the press: it waited the time the site named, closed the
  popup and pressed again, and all eight presses went through. But it started the wait late, so the popup sat on
  screen for 12-14 seconds, and the chat called it "the page was busy". The model was told only "2 attempts", so it
  never learned the site wanted a slower pace, and the second test hit the limit at the same places.
- Even if told, the model could not have written the fix: a script cannot put a "close it if it shows" step or a
  branch inside a loop, there is no pace setting, and the one "Wait" step in the catalog stops the whole run instead
  of pausing. The runtime's route-by-page-state only handles a step whose target is missing, not a refused press.

## Causes, reproduction and the file to change

| # | Finding | Reproduction | File to change | Verified by |
| --- | --- | --- | --- | --- |
| A1 | Trial feedback hides a too-fast refusal: only `attempts: 2` | trial results `0036`, `0060` steps 23, 35; Core attempts `361381fe`, `0228c953`, `e1226c26`, `acc3e9aa` | Core `runtime/service/candidate-trial/feedback.ts` `executedSteps` (:89) and `steps` (:62): keep the absorbed failure (code, row, wait taken, "closed the site's notice") | lead (code, results) |
| A2 | The retry waits the full hint after a 2.7-4.6 s snapshot, so the popup stays 12-14 s for a 5.5 s wait | the four refusals above: settle to re-press 8.3-10.2 s | Core `runtime/executor/graph-run.ts:631-640` (subtract elapsed time) or the order in `node-execution/attempt.ts:199` | lead (code); W1 (timings) |
| A3 | `builtin.timing.wait` ("Pause execution for a fixed duration") halts the run as `waiting`; no pause node works in a loop | W1 probe `wait -> math.add` returned `waiting`, the next node never ran | Core `runtime/executor/graph-run.ts:548-557` and `nodes/timing/wait.ts`: sleep `durationMs` and continue (approval keeps parking) | lead (code); W1 (probe) |
| A4 | A script cannot pace a loop or dismiss inside one: in-span optional, `on <port>:` and blocks refused; no pace key | `optional: yes` in a span -> `flow_script.optional_misplaced` | Core `flow-bootstrap/authoring/assemble.ts:319`, `draft-routing.ts:316-318`, `emitRepeatOver` :442-500; or a `repeat pace:` key in `parse.ts:50-51` | lead (code) |
| A5 | No guidance on rate limits or pacing | decide request 0035 has no such text | Core `flow-bootstrap/plan/flow-script-format.ts` loop format: on a too-fast refusal in a span, add a pause in the span of at least the named wait; the run itself closes the notice | W1; lead (format read) |
| A6 | Nothing paces later presses after a refusal (the 7th press always met the limit) | both trials | Core `runtime/executor/graph-run.ts` (per-node spacing after `web.action.rate_limited`) plus `service/candidate-trial/promotion.ts` to persist it into the Flow | W1 (design); not built |
| B1 | Candidate guidance sends row narrowing to run-end `recordOutput.process`; its loop example has no `where` | rev 1 (0034) | Core `flow-bootstrap/plan/flow-script-format.ts:267` and :284-301 (add `extractList.where: [{"field": ..., "atLeast": ...}]` to the listing); test `plan/tests/loop-format.test.ts` | lead (code) |
| B2 | Read grammar and detect description say "omit it, keep every item, narrow later" | catalog text | domain `output-nodes/extract-list/catalog-text.ts:234`, `runtime/llm-evidence/tools.ts:392` (catalog text is at its 700-character budget) | lead (code) |
| B3 | Judge advice pointed at the for-each and the click, not the listing's `where` | judges 0037, 0061 | Core `runtime/llm/diagnosis-instructions.ts` | W2; not read by the lead |
| C1 | Three different corrected defects counted as one refusal kind and ended the build; the warning promised a final test that candidate mode does not run | 0064, 0066, 0068 | Core `flow-bootstrap/candidate/submission-refusal.ts:61-64` (count by issue codes); `llm/decision-handlers/refusal-run.ts:56-58` wording | lead (code) |
| D1 | "Close the chat" step targets a plain text line (t860), pressed in both trials; the chat stays open | revs 1-8 `target: t860`; view 14 | domain `runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:689-700`: refuse a press on a target with no control role | lead (view 14) |
| U1 | A too-fast refusal reads "Didn't work: the page was busy" and "often works on a second try"; nothing says the site asked to slow down or that FluxIQ is waiting | moment 08 | Core `ui/activity-action/failure-reason.ts:43`, `runtime/activity/wording/recovery-choice.ts:5` (t376 owns `runtime/activity/**` and `graph-run.ts`) | lead (pictures, grep) |

Other UI findings (W3, not each checked by the lead): Confirm cards never name the row, so a retry looks like a
separate press; narration claimed "confirms only requests with 5+ mutual friends" for a Flow that confirmed all
eight; the overlay cuts sentences ("the…"); the check card's "11 rows came back" is not in the person's terms; the end
message says "kept trying without getting any further" although revs 6-8 each fixed a defect, and names the
instruction "Create an automation here"; exploration Click cards name no control; the idle record button is red
(moments 01, 16, 17) and grey only while building. Passed: "Starting…", no previous thread, "Testing your Flow", Chat
tab throughout, no "Fixing your Flow", no "Reading your instruction gave no answer", no internal codes.

## Judge versus oracle, cost and calls

- Judges: 4 calls, two pairs, both no, both right against the private oracle (eight confirmed where four were asked;
  the table missing Jonas). No wrong Flow accepted. The Lab oracle and the zero-call replay were not reached.
- Calls: 36 (1 chat, 31 decisions including 1 malformed reply that was charged, 4 judges); $0.047233; no balance
  failure; no ceiling breach. Running identities (build, Core, host, server adapter) all `verified: true`.

## Guard and slot state left behind

- Ledger `start` and `finish` for `run-mv0fuual-f9e6f089` (failed, $0.047233). Its debug exists in this tree.
- The `unchanged` guard now refuses this instance and task until source changes. No second paid run was made.
- Slot 4 stays claimed by t275. No process from `fxwork/t275` is running (checked by command line, 04:26 UTC).
- Nothing committed; no product source edited; no override files.

## Not run, not verified

- Lab playback, oracle and zero-call replay (no Flow).
- A trial with `extractList.where` on the listing (B1's fix) and the row-scoped Confirm on a narrowed list.
- Any of A1-A6: designs only, no tests written.
- What spends the extension's 2.5-4.1 s on a refused press, and the snapshot's 2.7-4.6 s.

---

# Round 2 (candidate mode, after t375-t379), 2026-10-09

Lead: lane D live lead (`lead-xhigh`), dispatched ~08:10 UTC. Brief: `### Brief: lanes A-D round 2 in candidate mode
(one lead per lane)` in the supervisor's `docs/working/mvp-final-month-plan.md`.

## Round 2 header

- Trees: downstream `fxwork/t275/!FluxIQWebExtension` on `task/t275-live-lane-d` at `fddca582` (merges dev
  `57094df4`); dev is now `e299e2c6`, which adds only `docs/working/README.md` and
  `docs/working/mvp-final-month-plan.md` (`git diff --stat HEAD...e299e2c6`: 2 files), so the `behind-dev` guard's
  docs-only exemption (`scripts/lab/live-guards/dev-ancestry.mjs:45-63`: every changed file under `docs/` or `.md`)
  admits it. Core `fxwork/t275/!FluxIQ` on `task/t275-live-lane-d` at `dcaf8f9f` = Core dev (t375-t379 merged).
  Both clean.
- Slot 4 owner unchanged (`{"task":"t275","lane":"D","instance":"t275-slot-4",...}`); no `STOP-balance`, no
  override files. Scenario unchanged since round 1 (`git diff --stat 1d04a11a HEAD --
  apps/scenario-lab/src/scenarios/social-network-feed`: empty); `CONFIRM_RATE_LIMIT {max: 3, windowMs: 15000}`.
- Previous live run `run-mv0fuual-f9e6f089` (round 1, failed) has its debug in this tree; source has changed since
  (t375-t379), so `debug` and `unchanged` should admit one run.
- Window: DeepSeek peak 06:00-10:00 UTC Friday; paid launch at or after 10:00 when the guard admits.

## Round 2 expectations (written 08:15 UTC, before the dry run and any launch)

What t378 put in place for this lane (read in the Core tree): trial feedback lists each absorbed refusal with the
pass, row, asked wait, wait taken and pace (`service/candidate-trial/absorbed.ts`, `feedback.ts:78-100`); the retry
wait credits time already passed (`executor/defensive/planned-retry-wait.ts`); `metadata.paceMs` is raised after a
hinted failure and held for later passes (`executor/pacing/pace-keeper.ts`); a trial's learned paces are written into
the saved Flow at promotion (`candidate-trial/learned-paces.ts`, `promotion.ts:70-96`); the script may write an
`optional: yes` step inside a span, `only after: <label>` steps after it, and `repeat pace:`
(`plan/flow-script-format.ts:308-310`, example `:349-375`); `builtin.timing.wait` pauses and continues; rows acted on
are narrowed with the listing's `extractList.where` (`:312`).

The candidate a correct build submits: navigate; optional dismissals; reach `~/friends/requests/`; listing read with
`extractList.where: [{"field": "mutualFriends", "atLeast": 5}]` keeping Amara, Jonas, Lin, Freya; Confirm `repeat
over` that listing, row-scoped; an after-read of the rows shown accepted, `{name, mutualFriends}`.

The user's rule, predicted step by step:

- U-P1. The trial presses four Confirms. If they start within 15 s, the fourth (Freya Holm, pass 4) meets "You're
  going too fast"; the runtime waits the asked time less the time passed, closes the notice, presses again, and raises
  the Confirm node's pace to at least the asked wait.
- U-P2. The trial feedback names it: "The site asked the run to slow down on pass 4 (Freya Holm) ...", plus a `paces`
  entry.
- U-P3 (design prediction). **If both judges say yes, the build promotes without returning to the model**: no code
  path sends a passing trial's absorbed interruption back for adaptation (grep of `candidate-trial`,
  `flow-bootstrap-commands`, `flow-bootstrap/candidate`: `absorbed` is used only in feedback). The saved Flow then
  carries the learned `paceMs` on the Confirm node (the pace half of the rule) but **no guarded dismiss/wait step**
  unless the model wrote one before any trial. The guarded-step half is reached only through a failed trial.
- U-P4. If a trial fails for another reason, the next submission should add, inside the span, an `optional: yes`
  close of the notice, an `only after:` `builtin.timing.wait` of at least the asked wait, and `repeat pace:` on the
  Confirm step.
- U-R1 (structural risk). The format's example closes the notice by a page handle (`target: t30`). The model never
  sees the dialog while exploring (round 1 pressed no Confirm while exploring), and t378 unit 5 refuses a handle the
  model was never shown, so the guarded close step may be unwritable without exploring into the limit.
- U-R2. With only four presses the limit may not be met at all (round 1's iterations took about 3.7-5.5 s each); then
  nothing is learned and the rule is not exercised.

Other risks: R1 the after-read's accepted condition on an unseen field; R2 the listing without `where` (round 1's
cause B, format now fixed); R3 the count on "Aisha Khan and 4 other mutual friends"; R4 an invented final self-check;
R5 the optional "close chat" step on plain text t860 (now refused naming the step, t378 unit 5); R6 mixed reads in
the run dataset.

Budget: candidate mode, `deepseek-flash`, $0.10 Lab ceiling, the campaign's call limit, headed browser, chat-started
build, one attempt, no relaunch. If it passes: the zero-call replay.

UI checkpoints (t375, t376, t378): onboarding at start; switch to Chat when the Flow runs; Stop and Take over present;
record button neutral (grey, not red, when idle); Confirm cards name the row; the slow-down said in plain words, not
"the page was busy"; refusal cards name the step; ending names its cause; overlay sentences not cut; "Flow ready" and
the table on success.

## Round 2 ledger

### 2026-10-09 08:13-08:26 UTC: preflight (0 calls)

- Rebuild in the lane trees, logs `fxwork/t275/r2-rebuild-*.log`: Core `pnpm build` (contracts, fluxiq, client
  gateway, web), then domain, test-runner and extension builds: `core exit 0`, `domain exit 0`, `test-runner exit 0`,
  `extension exit 0` (08:13-08:23).
- 08:23 supervisor message: the user removed the time-of-day rule; the Lab's `peak` guard is gone (dev `ba87bc0f`,
  t382), merged into this branch by the supervisor (`0064c9bf`; `git diff --stat fddca582 HEAD`: only
  `scripts/lab/live-guards/**` and docs). Launch as soon as the preflight is ready. Dev is now `3ba0ca45`, docs only
  beyond this head (`docs/working/README.md`, `mvp-final-month-plan.md`). Core unchanged at `dcaf8f9f`.
- Campaign dry run (`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign
  social-network-feed-confirm-requests --dry-run --authoring-mode candidate --max-attempts 1 -- --target
  persistent-isolated --workspace t275-d --llm-cost-ceiling-usd 0.10`) printed the same Lab command as round 1
  (`--llm-model deepseek-flash --authoring-mode candidate --llm-max-calls 48 ... --llm-cost-ceiling-usd 0.10`).
- That command through `node scripts/lab/run-lab.mjs run ... --dry-run` (log `fxwork/t275/r2-dryrun-candidate.log`):
  `exit 0`, `"status":"ready"`, `"providerCallCount":0`, `"lane":"created-flow"`, `"buildEntry":"chat"`,
  `"target":"persistent-isolated"`, `"candidateTrial":{"trialRunner":true,"startReset":true,"source":"lab-plan"}`,
  `"coreAuthoringMode":"candidate"`, `"model":"deepseek-flash"`, `"maxCalls":48`, `"maxEstimatedCostUsd":0.1`,
  `"permittedConsequences":[]`, judge `expected-dataset` step `extract-confirmed`, instruction sha256
  `6c11d20a...7f8d3` (same as round 1), `"coreWeb":{"key":"224f5e630024ffeac87efdef","cached":false}`.

### 2026-10-09 08:26 UTC: launch

- Launched 08:26 (`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign
  social-network-feed-confirm-requests --authoring-mode candidate --max-attempts 1 -- --target persistent-isolated
  --workspace t275-d --llm-cost-ceiling-usd 0.10`, log `fxwork/t275/live-candidate-2.log`). Guard
  `{"lab":"live-guard","state":"admitted","instance":"t275-slot-4",...,"fingerprint":"sha256:28ceef28...9d46"}` at
  08:26:48; run `run-mv0pcfaf-cd251bdc`; `[lab] live panel: side-panel (verified open)`.
- ~08:30 supervisor message: the user is ending the session; launch nothing further; a run already started is
  finished and debugged. This run had started; no other run will be launched.


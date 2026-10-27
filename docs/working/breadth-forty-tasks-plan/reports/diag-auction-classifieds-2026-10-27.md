# Diagnosis: auction-marketplace and local-classifieds breadth failures (read-only)

Date: 2026-10-27. Read-only; no run, build, test suite or model call. Sources: the debug notes under
`docs/working/language-driven-flow-loop-plan/debugs/`, the `codex-*` and `tasks-*` reports under
`breadth-forty-tasks-plan/reports/`, and `git log dev` in both repositories. Cited hashes were confirmed on `dev`
with `git rev-list dev`. Step numbers are the run's `steps/NNNN-*` folders.

Correction to the plan row. The Current State row for auction-marketplace ties "page-read navigation refused (R5)"
to `cheap-accessory-auctions` and `buy-it-now-quote`. The navigation refusal belongs to the accepted
`lens-hood-seller-shop` run `run-mvecxd6w-ed72a1ca` (steps 0035, 0060, 0064, 0089). Neither failed auction task
shows it. The `buy-it-now-quote` run navigated without a refusal (7 commands, 7 actions). The refusal could still
hit these tasks if a Flow binds a page-read link, but no evidence says it did.

## 1. auction-marketplace-cheap-accessory-auctions

Runs (all failed, no Flow, none accepted):
- `run-mvcwp3wh-bcea2115` (2026-10-17): 30 steps, $0.0068.
- `run-mvdghd7e-267bcda3` (2026-10-17): 93 calls, $0.1106.
- `run-mvdi0946-d897f3cb` (2026-10-18): 240 steps, 134 calls, $0.1487.

Root causes:
1. r1 (`mvcwp3wh`), product defect. Every `project.write_plan` put `reason` beside `input` instead of inside it
   (12 unusable plan replies; steps 0011 and 0017 refused `llm_output.unexpected_field` with no path, six unreadable
   replies in a row ended the build).
2. r2 (`mvdghd7e`), product defect. Trial 0051 stored the six right rows and both judges (0052, 0053) said yes. Core
   still returned `candidate.trial_judged_no` with `result.left_out_stating_a_kept_number` and
   `result.counts_look_right`. `request-rows/left-out-stating-a-kept-number.ts` `textTestAboutANumber` treated any
   digit-bearing text operand as quantity evidence, including a negated `matches` exclusion.
3. r3 (`mvdi0946`), mixed. After the guard fix, 15 of 15 candidate trials were judged no. The final trial (0229)
   stored 1 row and the judges (0230, 0231) were right: processing kept 1 of 46. The condition `approx lessThan`
   was applied unconditionally, and the fixture prints no pound estimate for GBP listings
   (`catalog/money.ts` `approxText` returns "" for GBP; `pages/card.ts` places the optional estimate beside the
   price). So 45 domestic or non-estimate rows were dropped. Parameter admission also failed closed repeatedly
   (step 0039: `web.handle.malformed:extractList.where.4.matches`; then `evidence_completion_parameters_unresolved`,
   `unchanged_after_no`, `repeat_refused`). No Flow was promoted.

Product versus task. Causes 1 and 2 are product defects. Cause 3 is a model authoring error (the model did not
apply the estimate only where the site shows one), but it exposes a possible task or expressiveness gap: the
instruction says "counting a listing priced in another currency at the pound estimate the site shows", and the
post-processing conditions are on single fields. The audit (`audit-auction-marketplace.md`) marks the task ok and
the oracle is six records, so no oracle change is justified. I could not verify from the notes whether a
"price if GBP, else estimate" rule is expressible; that is the open point.

Already fixed on dev:
- Cause 1: lane-2 Core fix (misplaced tool-call key moved into `input`, others refused with a path), named in the
  debug. Its commit was not located in my git search. The next run (`mvdghd7e`) got past `write_plan`, which is the
  only evidence it works.
- Cause 2: Core `d5701ec4` "Keep negated text patterns out of quantity-range evidence", merged as `3fb6b891`
  (2026-10-18). Both on `dev`. The code path covers step 0051's exact shape (negated `matches` with digits). Its
  regression is a generic document-title case. It was never exercised live.
- Judge consistency for cause 3-style splits: Core `990f9fa5` (a split no must name its defect), `534c41fb`
  (grounded defects, advice retained across revisions) and t752 `149ba69e` / downstream `4da5947c`. These did not
  change that the final judges were correct.

Owed:
- A rerun on current dev. This is also the first live check of `3fb6b891` and t752.
- Possibly a model-guidance or script-format point: conditioning a bound on one of two columns. Owner would be Core
  `packages/fluxiq/src/programs/automation-studio/runtime/` (record post-processing conditions), only if a
  provider-free probe shows it cannot be expressed. Do not add scenario-shaped examples.
- Task wording: consider naming that pound-priced listings show no estimate. Allowed by AGENTS.md as a rewording that
  keeps intent. Do this only after the probe, and not with the oracle.
- Depends on t751: no (no lasting acts, account unchanged). Depends on P6: no.

Provider-free reproduction:
- Headed, realistic scenario `auction-marketplace`. Existing owner tests are
  `apps/scenario-lab/src/scenarios/auction-marketplace/tests/breadth-paths.test.ts` (honest six-row path) and
  `tests/browser.test.ts`.
- Core probe: replay the saved judge request of step 0229 (`lab-runs/2026-10-18/run-mvdi0946-d897f3cb/steps/0229-*`
  and `0230-judge`) through `request-rows/left-out-stating-a-kept-number.ts` and the post-processing, and confirm
  the exclusion text no longer trips the guard (the same read-only method the debug note used with
  `codex-auction-guard-readonly.mjs`).

## 2. auction-marketplace-buy-it-now-quote

Run `run-mveba82m-fd0616dc` (2026-10-18): the Flow was created, and the whole run was reported passed, but the
oracle failed (`runtime.behavior`). Source downstream 97a28451, Core 868d541e. Cost $0.0171 reported and $0.0161
actual.

Root causes (`debugs/run-mveba82m-fd0616dc.md`, `reports/codex-auction-buy-now-quote.md`,
`reports/codex-auction-judge-proof-audit.md`):
1. Authoring or selection. The Flow chose a known fixed-price look-alike instead of the one auction with Buy it
   now. All three scalar reads (title, price, postage) failed the oracle. Whole run: 7 commands and 7 persisted
   actions. The expected extraction was `not_run` at step 9.
2. Missing answer. No dataset, no output object and no Flow ports were saved (0 declared ports); only three scalar
   `web.dom.extract` outputs existed. The instruction asks for a record with three columns.
3. Product defect, judge. The whole judge (step 0049, `loop_verification`) answered yes at 0.9 confidence with
   `totalRecordCount 0`, `recordSetCount 0` visible in its packet. The audit found the original instruction
   intact (342 characters, byte-equal) and no transport loss. It names two gaps: no generic receipt of executed
   scalar outputs, and no typed selected-listing format fact. It proposes no fix.
4. Separate Lab spend bug: one paid check counted twice (24 calls reported vs 23 observed, $0.001041924).
   `packages/test-runner/src/live-llm/run-spend.ts` `runtimeWithoutJudge` plus `observed-usage.ts`. A fix was written
   in t563 (50/50 tests per its report). Whether it reached `dev` I did not confirm; check `git log dev` on
   `run-spend.ts`.
5. Harness: 6 activations (3 diagnosis plus runtime_patch pairs, each an `add_handler/before` click handler,
   revisions 2 to 4). This is separate from the failure.

Product versus task. The audit marks the task ok ("exactly one auction with Buy it now", an exact expected row). The
oracle is not weakened. Causes 1 and 2 are authoring and product behavior; 3 is a product gap (judge accepts a
no-record confirmation for a request that asks for a table).

Already fixed on dev, and whether it covers this run:
- Judge: t752 `149ba69e` (downstream `4da5947c`), strict grounded negative judgements and "kept-row disclosures".
  It is aimed at false no verdicts, not at this false yes. It does NOT cover step 0049's yes with zero record sets.
  The judge-proof audit says the required-output contract is absent and needs a separately approved generic design.
- Selection errors: `d5488b29` (preceding-context feedback) and `dae53f9e` help recovery, but they apply to a
  failed trial. Here no trial failed, so they do not cover it.
- Spend overlap: see item 4; unconfirmed on dev.

Owed:
- Code fix, judge. Core `runtime/result-verification/verdict/result-verdict.ts` and `result-summary.ts` (and
  `run-outcome.ts` if the contract needs a run-end check): an explicit requested-output obligation, so a request for
  a table cannot be confirmed with no record set, while action-only and honestly empty requests stay correct. Needs a
  supervisor-approved contract first; do not infer it from words.
- Code fix, evidence (smaller): label executed scalar outputs and the selected listing's format in the judge packet
  (`result-summary.ts`, `runtime/llm/harness/context-packet.ts`).
- Rerun on current dev afterwards.
- Spend: confirm `run-spend.ts` is on `dev`.
- Depends on t751: no (read-only stop case; the four account lists stay unchanged). Depends on P6: no.

Provider-free reproduction:
- Headed `auction-marketplace`, `tests/breadth-paths.test.ts` (honest path plus the wrong-listing negative, which
  already exists).
- For the judge: a Core unit on `result-verification/tests/{verdict,result-summary,run-outcome}.test.ts` with a
  summary of zero record sets and an instruction that names columns, expecting no confirmed yes. The saved
  request is `lab-runs/2026-10-18/run-mveba82m-fd0616dc/steps/0049-*`.

## 3. local-classifieds-test-ride-question (a send, permission point `Send`)

Run `run-mvd9nlx5-1373850d` (2026-10-17 or 18; downstream 48cdbfee, Core c1ed1bdd): 257 steps, 131 calls, $0.089.
No Flow. The supervisor ended it `partial` ("nothing was sent"). No permission ask was recorded, so no trial
reached Send.

Root cause (`debugs/run-mvd9nlx5-1373850d.md`, `reports/codex-classifieds-target.md`,
`reports/codex-classifieds-seller-read.md`): an authoring and navigation mismatch. The candidate clicked card t932
(a listing outside the 5-mile radius, row index 2) and then read seller t1317 that was observed on another
listing's page (row index 0, reached by direct navigation at 0119 and 0135). The candidate omitted the radius step
(and any sort step). Trial 0143 clicked t932, then step 14 failed with `web.target.not_found` after 4 attempts; 0145
resubmitted unchanged (`candidate.unchanged_submission`) until repeat refusals (0147-0151). The repair brief then
looped on `web.detect_repeating_structure` refused `target_unobserved` and `handle_not_in_packet` (0250-0256). The
extension's refusal of the foreign seller was correct.

Product versus task. The debug establishes no product defect and no task or fixture problem; the audit marks the
task ok (cheapest in-radius, condition-filtered road bike is the 56cm at 285; the message is quoted word for word).
The only systemic gap was that failed-step feedback told the model to fix the failed step, not the earlier step
that caused the context mismatch.

Already fixed on dev:
- Core `d5488b29` "Trace preceding context in failed trial feedback" (`runtime/flow-bootstrap/candidate/trial-stop.ts`
  and its test), merged as `acf1a24f` on 2026-10-17, after the failing run. Covers the step 14 failure shape. The
  fail-first and pass results (1 of 8 failed, then 12 of 12) were recorded by the worker but were not live-proven.
- Downstream `a722f3f7` "a step's view is chosen from its preceding steps (t748 item 1)" and Core `baf354b0`
  (each node's preceding steps reach the domain) extend the same idea. They are not shown to cover step 14.
- No later live run of this task exists (the 2026-10-19 round never ran it); the fix is unproven live.

Owed:
- A rerun only, on current dev. No code fix is proven necessary. Watch for a repeat of the omitted radius setting:
  if it recurs after `d5488b29`, the owner would be Core `candidate/trial-stop.ts` or the explore feedback
  (generic, no scenario-shaped examples).
- The repair brief's three refused `web.detect_repeating_structure` calls show the repair brief did not recover; if
  it recurs, consider a separate diagnosis (not established here).
- Depends on t751: yes. This is the only task of the four with a lasting act (one send). A trial that sends a
  message must be reset or held back per the reset design; the Send point is `send_or_publish`, which the reset
  work classes as not undoable, so the build must not rerun the send in a trial. Also depends on the permission
  handoff behaving as the plan expects. Depends on P6: no.

Provider-free reproduction:
- Headed `local-classifieds`, `apps/scenario-lab/src/scenarios/local-classifieds/tests/breadth.test.ts`
  ("test-ride question", positive oracle and the ready-made-message negative).
- The probe proposed (not run) by `codex-classifieds-target.md`: follow the card path and the direct path, confirm
  distinct listing and seller identities, then run the filtered workflow to its oracle.
- For the feedback fix: `runtime/flow-bootstrap/candidate/tests/trial-stop.test.ts` in Core (exists).

## 4. local-classifieds-carbon-price-check (unconditional send correctly blocked)

Run `run-mveaglx4-22f23baf` (2026-10-18; downstream 59832522, Core c74af911): 26 steps, 13 calls, $0.0094. No Flow.
Ended `flow_bootstrap.post_provider_validation_failed` and `project.build_blocked`.

Root cause (`debugs/run-mveaglx4-22f23baf.md`, `reports/codex-classifieds-conditional-permission.md`): model
authoring syntax, not a permission rule. The price was observable before submission (0013-0017: current price above
the limit, listed first). The model then tried to encode "if 350 or less, send an offer; otherwise nothing":
- 0021: `subflow.scope_refused` with `subflow.when_refused` at `flow.line.41`. A builder may not write routing
  situations; the supervisor's structure plan owns them (`subflow-candidate/scoped-submission.ts` line 267).
- 0023: `flow_bootstrap.completion_refused` with `repeat_most_misplaced` and `repeat_invalid`.
- 0025: the final 42-line submission dropped all executable conditions (the threshold only in the title) and
  proposed a straight-line open-offer, type and declared send. Core blocked that send. No send ran; the
  `permittedConsequences` were `[]`; 0 trials.

Product versus task. Task is sound (audit ok: one carbon bike, 395 over the 350 limit, nothing sent). The worker
found no proven product defect. I disagree on one point of emphasis and record it as open: the model never learned
how to write a conditional (the branch must be a situation owned by the structure plan, but the offer is the only
lasting act), and the feedback at 0021 says where it must not go but not where to put it. That is an authoring
affordance gap, plausibly systemic for every conditional-send task (`company-website` `heat-pump-quote`,
`professional-network` `connect-kade-senior-engineer`). No evidence yet that it fails again; this task has been
run once. Also, the task declares no permission point, so any proposed send is blocked outright rather than asked.
That is by design for an honest path that sends nothing.

Already fixed on dev: nothing targeted at this shape was found. `d5488b29` and the t752 judge work do not touch
plan or situation routing. Core `9b6b5b1b` ("repeat over with repeat most acts on the first N rows") and
`944942b2` address the `repeat most` shape from the photo failure and may have changed `repeat_most_misplaced`; I
did not check that. Checked `git log dev -S"when_refused"` and found only merge commits, so the message at 0021 is
unchanged in intent.

Owed:
- A provider-free probe first (see below); then one of:
  a. a code or feedback fix if the probe shows a conditional send cannot be authored: the `when_refused` message in
     `scoped-submission.ts` and `plan/issue-feedback.ts` should say which structure-plan feature holds the
     situation, and the plan tool must accept a guarded lasting act. Owner Core `runtime/flow-bootstrap/`.
  b. otherwise a rerun on current dev.
- No task, fixture or oracle change is warranted (honest path proven).
- Depends on t751: no for the honest path (nothing is sent). Yes in the sense that the guarded branch contains a
  `send_or_publish` act that a trial must not run, which reset design governs. Depends on P6: no.

Provider-free reproduction:
- Headed `local-classifieds`, `tests/breadth.test.ts` "carbon price check" (the honest path and the forbidden-offer
  account failure already exist).
- A Core authoring test: submit a conditional-send plan through the supervisor and builder path with a scripted
  provider (no model call), expecting an accepted guarded plan or a precise path-bearing refusal. The saved
  submissions are `lab-runs/2026-10-18/run-mveaglx4-22f23baf/steps/0021`, `0023` and `0025`.

## Summary

| Task | Cause | Fixed by (commit) or owed | Owed work owner/file | Depends on t751? |
| --- | --- | --- | --- | --- |
| cheap-accessory-auctions | r1 misplaced `reason` key (product); r2 negated-text numeric guard (product); r3 unconditional `approx` bound dropped GBP rows (model), plus parameter-admission refusals | r1: lane-2 Core fix (commit not located); r2: Core `d5701ec4` / `3fb6b891`. Rerun owed; r3 shape unverified | Core record post-processing conditions (only if a probe shows the rule cannot be expressed); optional wording of the pound-estimate clause | No |
| buy-it-now-quote | Wrong fixed-price listing chosen; no answer record saved; whole judge confirmed a zero-record run (product gap); Lab double-counted one paid check | Not fixed: t752 does not cover the false yes. Spend overlap fix written in t563 (reaching dev unconfirmed) | Core `result-verification/verdict/result-verdict.ts`, `result-summary.ts`, `llm/harness/context-packet.ts` (requested-output contract, needs approval); `test-runner/src/live-llm/run-spend.ts` | No |
| test-ride-question | Candidate mixed a click on an out-of-radius card with a seller target from another listing; radius step omitted | Feedback fix Core `d5488b29` / `acf1a24f` (not live-proven); rerun owed | Core `candidate/trial-stop.ts` only if it recurs | Yes (a send is a lasting act) |
| carbon-price-check | Model could not author the conditional send; unguarded send proposed and correctly blocked | Not fixed; no targeted commit found | Core `subflow-candidate/scoped-submission.ts`, `plan/issue-feedback.ts` (feedback and plan-tool affordance), after a probe | No for the honest path; the guarded send touches reset |

## Not verified

- The lane-2 commit for the misplaced-key fix (r1) was not found by log search, and neither was the dev status of
  the `run-spend.ts` overlap fix.
- Whether `repeat most` changes (`9b6b5b1b`, `944942b2`) alter the carbon run's `repeat_most_misplaced` refusal.
- Whether a "GBP price else estimate" bound is expressible in post-processing.
- No step artifacts under `lab-runs/` were opened; step numbers and findings come from the debug notes and reports.
- No fix was exercised live; the first live check of everything on dev after 2026-10-19 is still to come.

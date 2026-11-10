# Task Speed

Status: Active
Status detail: Plan written 2026-11-10 from a measured breakdown of 44 live runs; Phase A starts alongside the FluxNode and panel work.
Created: 2026-11-10
Last updated: 2026-11-10
Owner: Senior supervisor agent
Scope: Making a live task attempt fast, by removing the causes of time found in measured runs: model thinking that a step does not need, per-step browser overhead, one model call per read-only look, a slow judge, a replay that pays for interpretation, and builds that take too many steps. It does not change what a task must achieve, its oracle, its retries, or any standing rule.
Paired document: none yet; the Core changes are listed here by file and get a Core-side document if they grow beyond these lanes.
Related: [time breakdown](./mvp-seal-plan/reports/time-breakdown.md), [Answer First](./answer-first-plan.md), [MVP seal](./mvp-seal-plan.md), Core's `docs/working/fluxnode-plan.md`

---

## Current State

**State (2026-11-10).** Phase A lane A1 has landed on both devs (task t888): S0's spans and the Lab speed report, S3's event-based readiness, and S4's kept look. Provider-free on three realistic sites, click overhead fell from 2.2-2.6 s to 1.4-1.8 s, and browser overhead per attempt from 38.2 to 28.5 s, 18.5 to 11.0 s and 19.4 to 13.6 s, with the same outcomes ([report](./task-speed-plan/reports/browser-step.md)). Not yet run live. Still open from S0: per-step timing for a saved Flow's replay, whose hook lives in `domain/src/runtime/adapter.ts` or Core's answer-first flow-run. Each second attempt still shows about 53 s of unexplained gaps. The first four-attempt run (t889) measured each replay at 2 model calls (interpretation and judge) and 46-48 s for 18 steps; see S6 and the new S9. Next, once the live lane (t885) merges, since all three touch its Core files: replay timing and the gaps' cause, S6, and S9. A2 (S2) follows when memory allows. The measurements are in the [time breakdown](./mvp-seal-plan/reports/time-breakdown.md), which draws on 44 live Claude runs (2026-11-04 to 11-09), per-step logs and 57 attempt reports.

**The user's words (2026-11-10):**
- "lets try and really increase efficiency, especially when it comes to time"
- "most of those tasks should take a few mins max, ideally less than 3 to get it working (thats just a goal ofc, not a hard requirement)"
- "we should NEVER attempt to fix these problems by simply capping the symptoms. Instead we should come up with ways to fix the root cause, always"
- On S1: "yes very good thinking, most requests wont need more than light thinking". So S1's default for a routine step is `low` effort, with the model's default kept for the hard cases S1 lists.

**Where time goes now.** A first attempt averages 3.1 minutes (median 2.1). The long tasks take 8 to 13 minutes. A step costs about 10 seconds:
- about 7 seconds is the model deciding, of which 80% (Sonnet) to 93% (Haiku) is hidden thinking;
- about 3 seconds is the browser node, of which only 0.4 seconds is the action itself.

Over a whole attempt, model decisions are 56-61% of the time, browser nodes 18-23%, the judge 7-9%, the chat's interpretation call about 2%, and Core's gaps between steps under 5%.

**Next:** Phase A. Its lanes touch files no running lane owns.

## Goal And How It Is Judged

**The goal (the user's, a goal and not a hard limit).** A realistic task's first attempt gets working in under 3 minutes; most take a few minutes at most. Second attempts that replay a saved Flow take under 30 seconds.

**What counts as a speed fix.** It removes a cause of time named here, with evidence: a log, a timing span or a code path. Lowering a timeout or a fixed wait, capping calls, rounds, retries or budget, skipping a required check, or special-casing a task is not a speed fix (standing rule, both AGENTS.md files).

**The quality guard.** The right-answer rate on the same tasks and models must not fall. Every fix that changes what the model sees or how much it thinks is measured live on a fixed set of tasks before it lands, which the refreshed Claude credit makes free. Provider-free Lab runs prove each fix works mechanically.

**The measure.** A per-attempt speed report from the Lab (S0): wall time split into thinking, visible output, input, browser action, browser overhead, judge, interpretation and gaps. It is reported per task and per model, beside the right-answer rate.

## Root Causes And Their Fixes

Each item names the cause, the evidence, the fix, where it lives, the time it should save, and its risk. Estimated savings are per attempt, from the breakdown's means. Taken together, S1-S5 bring a step from about 10 seconds to about 4.5 seconds, so a mean attempt goes from 3.9 minutes to about 1.8 with the same number of steps.

**S0. No timing spans, so the browser overhead's split is inferred (measure first).**
- **Cause.** A step's log has its start and end, but not where the 2.6 seconds outside the page action goes.
- **Fix.** Spans in each step's `meta.json`: dispatch sent; content start and end; after-look start and end; sanitize and diff. Also per-step timing for Flow replays, which today are not logged per step. Plus the Lab's per-attempt speed report.
- **Where.** Extension `domain/src/runtime/llm-evidence/node-run/`, `apps/extension/src/runtime/`, the Lab's attempt lane; Core's step logger.
- **Saves.** Nothing by itself. It is how S2-S4 are proven.
- **Risk.** None.

**S1. Every decision thinks at the model's default depth, routine or not.**
- **Cause.** The request sets no effort. Sonnet 5.5 defaults to `high` and Haiku 5.5 to `medium`, so a click after a page that plainly answered gets the same thinking as a repair. Thinking is 5 of a 6.4-second Sonnet decision and 8.5 of a 9.1-second Haiku decision. This is also why Haiku is slower than Sonnet per step.
- **Fix.** Core chooses the effort per decision from facts it already holds:
  - `low` when the last act landed as declared and the evidence is clean;
  - the model's default after a failure, a no-effect press, a loop-detector steer, a repair round or a judge's no.

  The thinking is matched to the step's difficulty, not cut. Effort goes in `output_config.effort`, set per message through the mid-conversation effort message (beta `mid-conversation-output-config-2026-07-01`), because changing the top-level effort mid-conversation would invalidate the 70% prompt-cache hit.
- **Where.** Core `runtime/models/providers/anthropic/request-body.ts` and the decision loop that knows the last step's outcome.
- **Saves.** About 1.0 minute (Sonnet) to 1.7 minutes (Haiku).
- **Risk.** Medium, on quality for hard steps. It is decided by a live comparison on fixed tasks, and lands only if the right-answer rate holds.

**S2. A read-only look costs a whole model call.**
- **Cause.** The decision loop runs one tool per model call. In 798 decisions, 171 were lookups (`describe_nodes`, `detect_repeating_structure`, `find_on_page`, `describe_element`) that ran in 6-253 ms but cost 5.5-6.4 seconds each, about 22 seconds per attempt.
- **Fix.**
  - A decision may make several read-only calls at once.
  - Core attaches what it already knows to the first result: the node's definition when the node is first used, and the page's detected lists with the page view.

  `describe_nodes` then has nothing left to answer.
- **Where.** Core `runtime/llm/node-tools/` and the decision loop; the domain's page view for list detection.
- **Saves.** About 0.35 minutes.
- **Risk.** Low.

**S3. Each acting node waits for the URL to stay still for one second, even when nothing navigated.**
- **Cause.** `apps/extension/src/runtime/automation-tab.ts:298` (`waitForTabReady`) polls every 250 ms until the URL has been stable for 1,000 ms. The readiness proof (`consumeSnapshotReadiness`) is used up by the before-look, so the after-look waits again.
- **Fix.** Readiness from events: the same document id and no navigation event since the act means ready, and waiting happens only when a navigation actually began. The proof survives the act. The after-look's retry loop stays as the safety net for pages that are between documents.
- **Where.** Extension `automation-tab.ts`, `action-runner.ts`.
- **Saves.** About 0.25 minutes while exploring, and 5 seconds per replay.
- **Risk.** Low to medium. A page that navigates late must still be caught, which is proven on the ten realistic sites.

**S4. Every step captures the page twice.**
- **Cause.** `domain/src/runtime/llm-evidence/node-run/run.ts` takes a full capture before the act (line 265) and after it (line 473). Each takes about 0.6 seconds and is sanitized and diffed in Core. A step's before-look repeats the previous step's after-look although nothing changed between them.
- **Fix.** The content script keeps a cheap mutation-and-navigation counter. When it has not moved since the last after-look, that look is the next before-look. Any page event invalidates it, so a stale look never reaches an act.
- **Where.** Extension content script, `node-run/run.ts`.
- **Saves.** About 0.15 minutes.
- **Risk.** Medium. It is proven with mutation tests on every realistic site.

**S5. The judge writes an essay, and starts only after the model says it is done.**
- **Cause.** The judge's reply is 1.1-2.4 thousand tokens of diagnosis with thinking, about 9-11 seconds, even when the answer is plainly right.
- **Fix.**
  - Ask for the verdict and the evidence references first, and a written explanation only on a no.
  - Start the judge speculatively as soon as the last read lands, and discard it if the model goes on acting.

  The judge still judges every result it judges today; a FluxNode's own check already replaces it at zero calls.
- **Where.** Core `runtime/result-verification/flow-less/` and its call site.
- **Saves.** About 0.25 minutes while exploring and 0.12 per replay.
- **Risk.** Low. Speculation is invisible when discarded.

**S6. A replay pays for an interpretation call and a before-look it does not need.**
- **Cause.** Every chat message goes through the interpretation call, even when its words fold to a task key that already has a saved Flow, which is a deterministic match. A replay's first node also captures the page before it acts.
- **Fix.**
  - On an exact task-key match, Core routes to the saved task without the interpretation call; a paraphrase still goes through it.
  - A replay takes a before-look only when a target must be found again.
- **Where.** Core `runtime/conversations/` (the same-words road) and the Flow replay path.
- **Saves.** About 3 seconds plus 0.5 seconds a step per replay. With S3-S5, a 5-step replay goes from about 25 seconds to under 10.
- **Risk.** Low.

**Measured 2026-11-10 (t889, the first four-attempt run, provider-free, local-classifieds dining tables, `run-mwaby832-3a6c67f5`).**
- Each replay ran the saved Flow with no decisions: 18 live steps, path `run_flow`.
- Each replay still made **2 model calls**:
  - the chat's interpretation of the same typed words, which S6 removes;
  - the judge, which S9 addresses.
- The attempt row counted only the judge. t889 fixes that.
- Each replay took 46-48 s against 52 s for the exploring attempt, with an instant scripted model, so a replay spends about 2.6 s per step in the browser and Core. That is the 53 s "second attempt gap" A1 saw, and it is S0's open replay-timing item.

**S9. Every replay of an accepted Flow is judged again.**
- **Cause.** The completion check judges each run's result, so a replay that ran exactly as its accepted, judged run did still pays a judge call: one of the two calls each replay makes.
- **Fix (recommended).** A replay whose every step ran as saved, with each step's own checks passing and the result in the accepted run's shape, is accepted on its own record. The judge is asked only when the replay deviates:
  - a step was repaired, retried past its first attempt, or routed by state to another node;
  - a read returned a different shape;
  - a FluxNode or the person asked for `judge: always`.

  The judge's one judged whole run of the finished Flow is unchanged.
- **Where.** Core `answer-first/completion/` and the flow-run record it reads, after the live lane (t885) merges, since it edits `completion/check.ts`.
- **Saves.** One call and about 9-11 seconds per replay. With S6, a replay makes no model call.
- **Risk.** Medium: a site whose data changed under an unchanged structure could return a wrong answer unjudged. The quality guard decides it: a replay series per realistic task must keep its right-answer rate, measured by the Lab's own oracle, which needs no model.

**S7. Long tasks take 30 to 55 steps.** After S1-S5, step cost no longer sets the time; the step count does.
- **Causes, each with evidence:**
  - **One amendment at a time.** The draft Flow is written one amendment per decision: 87 `amend_draft` decisions at 10-20 seconds each.
  - **A no without the missing part.** A judge's no does not name what is missing, so the model completes, is refused and goes on. `run-mwa19obz-abd5d558`, the free hubs task, made 7 judge calls in 963 seconds.
  - **An uncaught loop.** One job-board run (`run-mw4b7kav-cbff03e1`, 647 seconds, 54 calls) was a loop the detector did not end.
- **Fixes:**
  - one decision may write a whole step group or loop;
  - the judge's no names the missing part in the task's terms, so one more pass finishes it;
  - the loop detector gains the pattern that run shows.
- **Where.** Core `runtime/flow-authoring/` (draft tools), `result-verification/flow-less/`, `runtime/llm/repeat-guard/loop-detection/`.
- **Saves.** It halves the steps on the three slowest tasks, which the breakdown says is what free hubs and dining tables need to get under 3 minutes.
- **Risk.** Medium. Each fix is proven on its own failing run first.

**S8. Every decision re-sends about 33,000 input tokens.**
- **Cause.** The 70% cache hit keeps this cheap, but time to first token still grows with the uncached 3.5 thousand tokens a step (about 7 KB of page view).
- **Fix.** Measure first (S0). If time to first token is a real share, send a page view that is a delta from the last one when the page only changed in part, and evaluate the message-thread beta (`message-threads-2026-08-12`), which sends only new messages each turn.
- **Saves.** Unknown until S0 measures it.
- **Risk.** Medium.

**Outside the attempt, but slowing every test loop.** Lab startup takes 24-60 seconds, and up to 6 minutes when lanes queue. It is tracked separately and not part of the product's time.

**Related fix in flight.** The robot-check restart (the live lane t885, 2026-11-10): a person-only check must pause the attempt in place and resume from the same step. Restarts were re-doing whole explorations, which shows up here as time.

## Per Task, After The Fixes (from the breakdown)

| Task | First attempt now | After S1-S5 | Also needs |
| --- | --- | --- | --- |
| auction lens hood, napkins, everything-store, apprentices, professional-network | 1.5-3 min | about 1 min | nothing more |
| job-board Quillmark, nearby furniture | 5-7 min | about 2.2 min | the job-board loop (S7) |
| photo-social kiln | 5.6 min | about 2.9 min | fewer steps (S7) |
| social feed recent posts | 7.9 min | about 3 min | S3-S5, and its extract steps examined |
| dining tables | 8.5 min | about 3.3 min | 10-15 fewer steps (S7) |
| crossborder free hubs | 16 min | about 5 min | half the steps and one judge pass (S7) |

## Phases

| Phase | Lanes, partitioned by file | Proof | Starts |
| --- | --- | --- | --- |
| A | S0 spans and the speed report (extension node run, Lab); S3 and S4 browser readiness and the single snapshot (extension runtime and content); S6 the replay road (Core conversations); S2 read-only batching (Core node tools and loop) | Provider-free headed runs on the ten realistic sites with the same steps passing; S0 timings before and after | Now: no running lane owns these files |
| B | S1 effort per decision (Core models provider and loop); S5 the judge (Core result verification) | A live comparison on a fixed set of five tasks, both models, before and after: time and the right-answer rate | After S0 lands, so the comparison is measured the same way |
| C | S7 fewer steps: draft step groups, the judge's missing part, the loop pattern | Each on the failing run that shows it, provider-free first, then live | After B, because B changes what a step costs |
| D | S8, only if S0 shows time to first token matters | Measured | After S0 |

**Coordination.** The live lane (t885) is fixing the robot-check pause in Core's answer-first rounds and the extension chat. S6 and S7 touch nearby Core files, so they start from `dev` after that fix merges. The panel lane (t887) and the keys lane share no files with these.

## Work Ledger

### 2026-11-10 - Plan

- Agent: lead; the time-breakdown worker (read-only).
- Changed: this document. No source.
- Why: the user asked for a full plan to make tasks fast by fixing root causes.
- Validation: not validated; this is a plan. Its numbers come from `mvp-seal-plan/reports/time-breakdown.md` (44 runs' step logs) and the lead's parse of 57 attempt reports (`attempt-report.txt` under `test-runs/instances/*/attempts/`): live attempts mean 2.9 min, median 2.0.
- Outcome: shown to the user.

### 2026-11-10 - A1: spans, event readiness, kept look (t888)

- Agent: lead; worker speed-a1-browser-step (Opus).
- Changed: Core `runtime/llm/step-log/` (spans); domain `node-run/` (timing, refusal-detail split); extension `runtime/{automation-tab,action-runner}.ts`, `runtime/{navigation-events,look-reuse}/`, `content/page-changes/`, `shared/page-changes-message.ts`; Lab `attempt-lane/live/attempt/speed.ts`.
- Validation: re-run by the lead. Core `vitest run src/runtime/llm/step-log/tests/` -> 64 passed; Core structure audit -> passed; domain `tsc` (src and tests) -> clean; `node scripts/test-domain.mjs llm-evidence/node-run/` -> 560/560; extension `node scripts/check-extension.mjs` -> exit 0; `node scripts/test-extension.mjs runtime/tests runtime/look-reuse runtime/navigation-events content/` -> 1993/1993; test-runner `tsc` -> clean; `speed.test.js` -> 2/2. Worker's provider-free `lab attempt --scripted-model --attempts 2` on local-classifieds, everything-store and company-website: same outcomes before and after, figures in the report.
- Not verified: live runs, Firefox, seven of the ten sites, replay per-step timing (not built), time to first token. `docs/architecture/extension-client.md` and `testing-facility.md` are not yet updated for the readiness and speed changes.
- Outcome: merged into both devs ("Merge task t888: speed-browser-step") and pushed.

## Open Questions

None for the user. The quality guard decides S1 and S5 by measurement.

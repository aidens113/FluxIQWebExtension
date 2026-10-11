# R4b: why the coupon step's saved identity misleads the repair judge

This is a worker report for the brief "root-cause why R4b's optional 'collect the store coupon' step is saved against
the coupon control's post-click state". It is an investigation only. No source was edited.

## Outcome

Done. The brief's premise is half right. The step is **not** saved with the after-click words: "Collected" is not part
of its identity. It is saved with **no words at all**:

- What was saved: `{ tagName: "div", classNames: ["b"], selector: "div:nth-of-type(1) > div:nth-of-type(2)",
  context.shadowHosts: ["main > div:nth-of-type(2) > div:nth-of-type(2) > fb-store-coupon"] }`.
- Why: t356's across-views rule. Once the act changed the label, the rule keeps only what the before and after views
  agree on, so the words and the toggled class `x` are dropped.
- That identity does find "Get coupons" on a fresh page. Both runs' playbacks pressed it there and collected the
  coupon.

R4b's failure happens later, in the in-run repair's build test, and it comes from the missing words:

1. The test resets by navigation only, so the site still remembers the coupon. The start view shows `t934 "Collected"`.
2. Step 2 is a lasting act, so the test only checks it. A wordless identity also matches the "Collected" div, so the
   check answers `verified` ("could act now"). It should answer `present` ("effect already in place").
3. The judge sees the step's target only as `div, b`.
4. The checklist doubts the claim. It reads the control's words from the newest call, and that call already showed
   "Collected". "Collected" does not match "collect" as a whole word.
5. So the judge says the step "presses an unrelated control", and the repair loop goes round with nothing to fix.

The fix is to save the identity the control had when the run acted on it ("Get coupons", class `b`). The words the act
changed ("Collected", class `x`) become the step's effect, never its identity.

## What changed and why

Nothing. This was investigation only.

## Findings

### (a) The exact fingerprint saved, in both runs

I copied each `project.sqlite`, with its `-wal` and `-shm` files, to the scratchpad and read `graph_nodes`:

- R4a: workspace `t418-r4a-5`, project `9c81b672…`, node `…main.s2`.
- R4b: workspace `t418-r4b`, project `f26b32b3…`, node `…main.s2`.

Both runs saved **byte-identical** `parameter_values_json`:

```json
{"element":{"classNames":["b"],"context":{"shadowHosts":["main > div:nth-of-type(2) > div:nth-of-type(2) > fb-store-coupon"]},
 "selector":"div:nth-of-type(1) > div:nth-of-type(2)","tagName":"div"},
 "selector":"div:nth-of-type(1) > div:nth-of-type(2)","timeoutMs":10000}
```

Neither node carries visible text, an accessible name, a role or attributes. Neither carries route signatures:
`metadata_json` holds only the bootstrap keys and `declaredConsequences: []`.

The step's routing differs between the runs:

- **R4a** (submit `0038`, `optional: yes`): saved as optional, with `s2 failed -> s3`, where s3 is a
  `builtin.control.merge`.
- **R4b** (submit `0030`): has **no** `optional:` line. It is saved as a plain step, `s2 success -> s3`.

The brief calls R4b's step optional. It is not.

What the model saw for `t934` in R4b:

| Step | What the view showed for `t934` |
| --- | --- |
| `0013` decide | `"Get coupons"` |
| `0014` | Exploration pressed it |
| `0015` and `0029` decide | `"Collected"` |
| `0030` submit | Authored while `"Collected"` was showing (view 21) |

R4a followed the same sequence.

### (b) Does a step authored after its control was acted on save the after-act words?

No. The cause is in `domain/src/runtime/llm-evidence/plan-resolution/`:

- `target-packets.ts:404-412` (`acrossView`) merges a re-viewed handle through `webPlanElementIdentityAcrossViews`.
- `element-identity.ts:182-212` keeps only the fields both views agree on:
  - `visibleText`: "Get coupons" against "Collected", so dropped;
  - `classNames` (`agreedTokens`): `b` against `b x`, so only `b` is kept;
  - `words`: dropped as well.
- The header at `element-identity.ts:163-181` explains why the earlier label is not kept either. The same handle also
  serves exploration on the page as it now is, and a "Get coupons" identity would be vetoed against "Collected".
- The existing row pinning this is `plan-resolution/tests/target-packets.test.ts:141`: "a handle whose control an act
  relabelled keeps no label from after the act…".

**Can it match on a fresh page?** Yes, and it did:

- R4a playback `0045`: rate-limited on the first press. `0046`: "the point 849,361 landed on the target", on a page
  showing `t70 clickable "Get coupons"`.
- R4b post-redesign playback `0037` then `0038`: the same point, the same result.

The identity is therefore not a wrong-state identity. It is a **wordless** one:

- It meets the save floor (`element-fingerprint/signals.ts`) with exactly two signals: kind (`div`) and one class token
  (`b`).
- It breaks the user's rule that every saved element carries a full multi-signal fingerprint. The control's real words,
  "Get coupons", were in the earlier view and were thrown away.
- On a page where the act is already done, it matches the done control as well: the "Collected" div is the same
  `div.b` at the same address.

### How the wordless identity becomes R4b's failed judgement

The folders were renumbered while the run is live: the brief's `0098`/`0099` are now `0109`/`0110`. The same
judgement repeats at `0137`/`0138` and `0171`/`0172`. `entry.json` still says `"verdict": "running"` (15:11 local).

1. **The page remembers the coupon.** Playback `0038` collected it, then the basket redesign broke add-to-cart and
   in-run repair began.
   - The repair's build test resets by navigation only and keeps what the site remembers (decision D1,
     `flow-draft/verify-only.ts`, `sometimes-present.ts` header).
   - The scenario keeps the claim in server state (`state.coupons.stores`, rendered as `collected="yes"` by
     `apps/scenario-lab/.../markup/item.ts:42`).
   - So `startView` shows `t934 clickable "Collected"`.
2. **The check says `verified`, not `present`.**
   - Step 2 changed lasting state while exploring (`explored.changed: yes, stateChanged: true`), so the test only checks
     it (`withheld: true`).
   - `verify-only.ts:73-87` defines `present` as "the step's target is gone from the very page the step acted on, which
     is what an effect already in place looks like".
   - A wordless `div.b` is never gone, so the answer was `verified: the step's target is on the page, visible and
     enabled`.
3. **The judge reads no words for the step.** The `buildTest.steps[1].target` is `[div, b]`.
4. **The claim doubt uses post-act words.**
   - `Core flow-bootstrap/instructed-acts/claim-doubt.ts:20` reads `step.words?.target || step.control`. That is the
     newest call's own words for the control, and they read "Collected" (`flow-draft/step.ts:142-152`).
   - `kind-words.ts` `namesWord` is a whole-word test, so "Collected" does not name `collect`.
   - The claim kind's words include `coupons`, which "Get coupons" would have matched.
   - Worse, "collected" is in `AUTOMATION_STUDIO_INSTRUCTED_ACT_DONE_WORDS.claim`. The control's words are proof the act
     is done, but the checklist reads them as doubt.
   - The judge quoted it: "the checklist itself flags that the control's words are 'Collected'".
5. **The repair cannot satisfy the judge.**
   - The model reruns `t934` (`0124`/`0125`, later `0147`: `rerun_changed_nothing`) and completes (`0122`).
   - Core refuses that completion as `bootstrap.flow_unchanged_since_judged_wrong` (`0123`).
   - There is no defect to fix, so the loop spends money with nowhere to go. The model is not at fault: its handle was
     right every time.

### (c) What an optional step does when its saved control is not on the page

It is skipped as a success, and only the chat line says so. In Core
(`packages/fluxiq/src/programs/automation-studio/runtime/`):

- **Absent target.** `executor/step-skip/absent-step.ts:27-34` treats a `target_not_found` on an optional step as
  `declared`. The run gets no retry, no recovery, and "nothing recorded as a fault". `state-routing/decision.ts:91`
  takes that first.
- **The attempt record.** `state-routing/routed-attempt.ts:20` rewrites the attempt to `status: "succeeded",
  route: "skipped", skipped.reason: "target_absent"`, with failure, fault and message removed.
- **The chat.** `state-routing/announcement.ts:16-29` posts "Skipped …: it was not shown" (`optional_absent`). The
  candidate trial's feedback says "Its control was not on the page, so the step was skipped."
  (`service/candidate-trial/feedback.ts:102`).
- **Any other failure.** An optional step that failed some other way keeps its retries. The ladder then offers "Go on
  past the optional step" and spends no budget (`executor/recovery-ladder.ts:82-100`).
- **Nothing checks the request.** No part of this asks whether the step does an act the person requested. A requested
  "collect the coupon" that is skipped leaves the run `succeeded`.

The guard that exists runs on only one authoring path:

- The instructed-acts checklist flags an optional step that claims a requested act (`step_is_optional`,
  `flow-bootstrap/instructed-acts/step-fault.ts:72`).
- `flow-draft/sometimes-present.ts` refuses to auto-optional a step that carries an act.
- Both run only on the draft path. The candidate path that R4a used (`--authoring-mode candidate`,
  `flow-bootstrap/candidate/authoring-loop.ts`, `trial-gate.ts`) has no instructed-acts check. R4a's
  `optional: yes` on the requested collect was accepted at submit `0038`, and the Flow was saved that way. In
  `service/` and `flow-bootstrap/candidate/`, only `instruction-authority.ts` mentions instructed acts.

R4a still passed for two reasons:

- Its trial started from a full reset (`start: "reset"`), where the coupon read "Get coupons" again.
- The step held after one rate-limited retry, and the judge saw "Get coupons" become "Collected".

Had the control been missing, the run would have reported success with the coupon never collected.

### (d) The general fix

None of these is a per-site rule. They name no words of this site.

**F1. Save the identity a control had when the run acted on it (domain).**
- What it does: when exploration acts on a handle and the act changes the page, record that handle's identity from the
  view the act was made from (pre-act). A candidate or plan resolution of that handle saves the pre-act identity in
  full ("Get coupons", class `b`), not the across-views intersection. Fields that changed between the pre-act and
  post-act views ("Collected", the `x` class) are the act's effect and never identity. Exploration's own acts on the
  current view keep resolving with the current view's identity. That keeps the veto concern that led t356 to drop the
  label, because the two uses no longer share one identity.
- Handles nothing acted on keep t356's intersection.
- Files:
  - `domain/src/runtime/llm-evidence/node-run/run.ts:433-437`. `pressedHandle` and `current` already know a press
    changed the page. Widen this to any element act (click, check, type) and pass the pre-act identity.
  - `plan-resolution/target-packets.ts`. `FlowPages.pressed` (line 195) becomes a map from handle to its pre-act
    identity. `pressed()` is at lines 183 and 254. `resolve()` under `reach === "view_history"` (lines 265-268), and
    the plan resolution path, return it. `acrossView` (404-412) stays for exploration.
  - `plan-resolution/element-identity.ts:163-212`: update the header and add an "acted-as" precedence.
- Tests:
  - Change `plan-resolution/tests/target-packets.test.ts:141`. After an act, a submission resolve of the handle gives
    `visibleText: "Get coupons"` and `classNames: ["b"]`, never "Collected" or `x`. An exploration resolve on the
    current view is not refused.
  - New row in `plan-resolution/tests/` on the resolve-plan-node path: the saved `parameters.element` carries the
    pre-act words.
  - Extension e2e on crossborder, headed:
    - a step saved from the post-act view finds "Get coupons" on a fresh page;
    - on a page whose coupon is already collected, the check is not found there, so the build test gives `present`.

**F2. The words an act changed become the step's effect (domain and Core).**
- What it does: the same act record gives the step's after-state ("Collected" on that control) as its effect.
- It makes three things happen:
  - the build test's check answers `present` when the effect is already there (existing semantics,
    `flow-draft/verify-only.ts:73-87`, `core.replay.present`);
  - at runtime, `state-routing/decision.ts` `ownEffect` (143-149) and `effectHolds` can route "Skipped …: the page
    already shows what it does";
  - the judge gets honest evidence.
- Today neither saved node carries route signatures (`route-state/signatures/node.ts` reads
  `metadata[AUTOMATION_STUDIO_ROUTE_SIGNATURES_METADATA_KEY]`; both nodes have none), so effect-holds can never fire
  for a created step.
- Tests:
  - `executor/state-routing/tests/decision.test.ts`: a created click node whose saved effect holds is routed
    `effect_holds`, not `none`.
  - A build-test row where the step is withheld and its effect is present answers `present`.

**F3. A claim is judged by the control's identity words, and done words are not doubt (Core).**
- What it does: `flow-bootstrap/instructed-acts/claim-doubt.ts:20` reads the step's saved identity words, which are
  pre-act after F1, before `step.words.target` or `step.control`. A control whose words name the act kind's done word
  (`kind-words.ts` `AUTOMATION_STUDIO_INSTRUCTED_ACT_DONE_WORDS`) is evidence the act is done, not a doubt.
- Test: `instructed-acts/tests/claim-doubt.test.ts`. A claim act on a control reading the claim kind's done word gives
  no doubt, and the act is read as present.

**F4. An optional step that does a requested act is never passed over silently (Core).**
- At authoring: run the instructed-acts `step_is_optional` rule on the candidate path as well. Refuse it at submission,
  or carry it to the trial judge as missing.
- At runtime: when an optional step that claims a requested act is skipped as `target_absent`, record that the act was
  not done, unless its effect holds (F2). This affects:
  - `executor/step-skip/absent-step.ts` and `state-routing/routed-attempt.ts:20`: a distinct `skipped.reason`;
  - `state-routing/announcement.ts`: "Skipped … — <act> was not done";
  - the run result, so a finished-run judge and the chat both see it.
- An optional step stays fine for interruptions and banners, which carry no act.
- Tests:
  - `executor/step-skip/tests/absent-step.test.ts` and `state-routing/tests/announcement.test.ts`;
  - the candidate submission tests under `flow-bootstrap/candidate/tests/`.

**F5 (optional). The identity floor.**
- What it does: the floor accepted `{kind: div, classNames: [b]}`. A wordless identity that exists only because
  across-views agreement dropped the words should count as a shortfall, or should fall back to F1's acted-as identity.
- Where: `plan-resolution/identity-guard.ts` and `element-fingerprint/shortfall.ts`.
- With F1 in place this mostly stops arising. It is a backstop.

## Commands run and observed results

- `ls` and `cat` of the R4b and R4a step folders. The R4b folders were renumbered while the run is live: the judges are
  now `0109`/`0110`, `0137`/`0138` and `0171`/`0172`.
- `grep "bare div"` in `*/response.txt` found it in `0109-judge` and `0172-judge`.
- `python -I` with sqlite3, on copies under the scratchpad. It printed the `graph_nodes` and `graph_edges` rows quoted
  above.
- Playback results:

  | Run | Step | Result |
  | --- | --- | --- |
  | R4a | `0045` | `web.action.rate_limited` |
  | R4a | `0046` | `succeeded`, "the point 849,361 landed on the target"; page.txt has `t70 clickable "Get coupons"` |
  | R4b | `0037` | rate limited |
  | R4b | `0038` | succeeded, the same point |

- R4b judge `0109` request:
  - `flowShape.s2.element` is `{tagName: div, classNames: [b], context.shadowHosts}`;
  - `buildTest.steps[1]` is `outcome: verified, withheld: true, target: [div, b]`;
  - `claimSaid` is "whose control is 'Collected'… do not name 'collect'";
  - startView and endView both show `t934 clickable "Collected"`.
- R4a candidate trial `0040` result: `start: "reset"`; step 2 `succeeded`, `attempts: 2`; verdict `yes`.

## Not verified

- No code or tests were run. F1-F5 are proposals.
- I did not run the page veto. After F1, the check on a "Collected" page should come back not found, which gives
  `present`. I inferred that from `verify-only.ts` and t436's scoring; it is not measured.
- I did not trace where `step.control` and `words.target` are filled for an amend-draft rerun. I inferred they come from
  the rerun's own result, from `flow-draft/step.ts:142-152` and `claimSaid` quoting "Collected".
- I did not read `flow-bootstrap/candidate/submission.ts`. "The candidate path has no instructed-acts check" rests on a
  grep and on R4a's accepted submission.
- I did not check whether R4b ends on the cost ceiling. It was still running when I read it.

## Open questions or contradictions found

- The brief calls R4b's coupon step optional. R4b's submission `0030` has no `optional:` line, and the saved graph has
  no failed route. Only R4a's step is optional.
- The brief says "Collected" was saved as identity. It was not. No words were saved (t356's intersection). The live
  problem is the wordless identity and what reads it, not after-act words in it.
- t356 chose to drop the label so that exploration's re-press of the same handle is not vetoed. F1 keeps that, but
  only by separating "identity to save" from "identity to act on now". The supervisor should confirm that split.
- The step folders under `lab-runs/.../run-mv4dgmki-2b13db91/steps/` are renumbered while a run is live. Step numbers
  quoted in briefs go stale.

# t486 Core half: satisfied step and skip reporting

Worker report for brief t486 (Core half). Tree: `C:/Users/osrs_/FluxStuff/fxwork/t486/!FluxIQ`, branch
`task/t486-stale-handle-and-satisfied-step`. Nothing was committed.

## Outcome

Partial.
- Goal 2 is done.
- Goal 1 is done for the ordering gap that exists in Core.
- Goal 3 is explained. Its root cause is not in Core: Core asked the host the same question after every failed attempt,
  and the host answered "no" twice and then "yes" about a page that looked the same. The brief's premise that playback
  "retried before state routing was consulted" does not hold for this run (details below), so the Core change does not
  by itself remove the 13.2 s seen in run-mv62icw0.

## What changed and why

### Goal 3 first, because it changes how Goal 1 should be read

- In run-mv62icw0, s5 ran three times (steps 0055, 0056 and 0057). The step logs' `stateRouting` comes from Core's run
  detail (`runtime/service/summaries/state-routing.ts`, through
  `packages/test-runner/src/flow-lane/state-routing-attempt.ts`). The logs read `no_match` (code
  `web.target.not_found`), `no_match` and `effect_holds`.
- State routing **was** consulted after each of the three failed dispatches.
  - `graph-run.ts` calls `automationStudioStepStateRoute` on every `target_not_found`.
  - With no handler in scope, `automationStudioStepRetryBeforeRouting` answers `pass`, and
    `decideAutomationStudioStateRoute` runs each time.
  - A `no_match` record exists only because the decision ran.
  - The existing test `executor/tests/state-routing-run.test.ts` ("goes on past a step the site already did") already
    shows a step whose effect holds routed after its first failure, with one dispatch. Round 11 (4.4 s) was that case.
- Why `no_match` twice, then `effect_holds`:
  - Core passed the same recorded effect each time (node metadata).
  - The `no_match` records carry no `refused` list. If they did, the test-runner parse would have dropped them, since
    only `code` and `outcome` are allowed for `no_match`. So the unbound-value guard did not refuse, and neither did
    the progress guard.
  - That leaves one possibility: `automationStudioRouteEffectHolds` got a non-`true` answer from the host's
    `routeEffectHolds` on the first two observations, and `true` on the third. Downstream, that is
    `domain/src/runtime/route-state/effect/holds.ts`: every hash in the effect's `added` sample must be among the
    observed page's control-name hashes.
  - The difference therefore lies in the host's observed route state (`observeRouteState`), not in Core.
- Leading hypothesis, **not verified**: the effect's `added` sample includes a control that comes and goes
  independently of the store.
  - The page views show the hero carousel's slide link alternating: 0055 and 0057 show "Back-to-school … Shop now",
    and 0056 shows "Pickup today … Shop pickup".
  - The route state is observed at a different moment from `page.txt`, after a 4.3 s dispatch.
  - The full routing record (with `reason`) and the recorded effect hashes were not kept anywhere I could find: the run
    bundle, `lab-runs/…/steps` and `lab-slots` were searched. So this cannot be confirmed from the evidence.
  - Owner: downstream route-state effect signing, so the other worker or the supervisor.
- `page.txt` for 0055 and 0057 is identical. 0056 differs only in the carousel slide.

### Goal 1: `executor/step-loop/state-route.ts` (+ doc note in `could-not-run-retry.ts`)

- The real Core gap was at the lines the brief cites:
  - On Retry handlers dispatched **before** state routing.
  - So a retry handler in scope (for example one that closes a layer and resumes) re-pressed a step whose effect was
    already on the page.
  - The fail-first test showed exactly this: presses `["choose", "dismiss", "choose"]`, a second store choice.
- New order, for a step that recorded its own effect (`metadata.routeSignatures.effect`):
  - State routing decides first, with one page read.
  - A way on is taken at once, with no handler run and nothing dispatched again. Above all, this covers
    `effect_holds`, the step satisfied by state.
  - With no way on (`none`), On Retry runs as before. If a handler takes the run on, the attempt keeps the
    `no_match` record.
  - Otherwise the decision already made is reused. The page is read again only when a handler ran and may have moved
    it.
- Steps without a recorded effect, and the readiness-gate path, keep the old order unchanged.
- Every-node-retries is kept: an unsatisfied step still gets its first attempt plus three retries, tested.
- Known edge, accepted and not tested: for an own-effect step whose effect does not hold but whose page matches
  another step's pre-state, that candidate route is now also taken before On Retry handlers. I did not make this
  effect-only, because an effect-only decision needs `state-routing/decision.ts`, which this brief does not own.
  Taking any way on also avoids recording a progress-guard admission for a route that is never taken.

### Goal 2: `llm/harness/context-packet.ts`

- A recent action now carries three closed fields:
  - `acted: false` when the run passed the step over.
  - `skipped`, as one of:
    - `{ reason: "state_routed", toNodeId, direction }`
    - `{ reason: "target_absent", notDone? }`
    - `{ reason: "already_done", doneByAttemptId }`
  - `satisfiedByState`, the state evidence it counts as done on:
    - `page_showed_step_effect`: a `state_routed` skip whose `stateRouting.outcome` is `effect_holds`.
    - `recorded_state_held`: `stateHeld` on a failed attempt. `acted` is left absent there, because whether it acted
      is unknown.
- A routed skip (one that matched another step's start) has no `satisfiedByState`.
- Ids and closed words only: no Core code, and no row label such as "Lin Zhao".
- `isAutomationStudioLlmRecentActionContext` (which DeepSeek preflight uses) validates the new fields strictly.
  `RECENT_ACTION_FIELDS` lists them.
- Effect on the run-mv62icw0 judge: s5 attempt 7 would now read `status: succeeded, route: state_routed, acted: false,
  skipped: {state_routed → s6}, satisfiedByState: page_showed_step_effect` instead of the bare `succeeded`.

### Tests

- `executor/step-loop/tests/state-route.test.ts` (new), three cases:
  - effect holds: one press, no handler, `effect_holds`, one page read;
  - effect does not hold: the handler still goes first, the attempt carries `no_match`, one read;
  - no handler and no effect: four attempts, each `no_match`, one read each.
- `llm/harness/tests/context-packet.test.ts`, with a new describe:
  - the projection of each skip kind, of `stateHeld` and of a normal step;
  - the guard refusing forged shapes.

## Commands run and observed results

All were run from `packages/fluxiq` unless noted.
- Before the fix:
  - `npx vitest run …/step-loop/tests/state-route.test.ts` -> 2 failed, 1 passed (`expected [ 'choose', 'dismiss',
    'choose' ] to deeply equal [ 'choose' ]`; the no-effect case passed).
  - `npx vitest run …/harness/tests/context-packet.test.ts` -> 1 failed, 5 passed (the s5 recent action lacked
    `acted` / `skipped` / `satisfiedByState`).
- After the fix:
  - `npx vitest run src/…/executor/step-loop/tests src/…/llm/harness/tests/context-packet.test.ts` -> Test Files 6
    passed (6), Tests 25 passed (25).
- Regression neighbours:
  - `npx vitest run …/step-loop/tests …/state-routing/tests …/executor/tests/state-routing-run.test.ts
    …/lifecycle-run/tests` -> Test Files 29 passed (29), Tests 157 passed (157).
  - `npx vitest run …/llm/harness/tests …/llm/tests/{context-window,deepseek-evidence-preflight,deepseek-provider,harness}.test.ts
    …/llm/evidence-recall/tests/binding.test.ts` -> Test Files 26 passed (26), Tests 237 passed (237).
- Typecheck:
  - `npx tsc --noEmit -p .` -> exit 0, no output.
- Structure audit, from the Core root:
  - `node scripts/structure-audit.mjs` -> exit 0.
  - Its first run failed `[as-never]` on my test's `as never` cast, which I then replaced with a typed
    `AutomationStudioFlowRunDetail`.
  - It prints "2 baseline entries can be lowered". These are not from this change; I did not run `structure:baseline`.
  - Advisory warnings on touched paths existed before: `step-loop/` has 25 source files (no file was added to it);
    `context-packet.ts` was 646 lines and is now 734, past the 400-line advisory threshold and under the 800-line
    limit.

## Not verified

- The host-side cause of `no_match`, `no_match`, `effect_holds`. The carousel hypothesis is inferred from `page.txt`
  differences only. No route state, effect hashes or routing `reason` were recorded for this run.
- Whether the Core change shortens s5 in a live run. In run-mv62icw0 no On Retry handler is known to have fired, and
  the attempts' `lifecycle` records were not in the evidence, so the 13.2 s would most likely recur until the host's
  answer is stable.
- No Lab run, no full suites, and no `pnpm check` or `pnpm test`, as the brief says.
- The judge prompt text was not changed (it is not in my files). The new fields are self-describing JSON, but the
  result-check instructions do not mention them.

## Open questions or contradictions found

1. **Brief premise contradicted.** "Playback retried the store step for 13.2 s before state routing saw…" is wrong. State
   routing ran after every failed dispatch, and the host said the effect did not hold twice. Also, the 4.3 s per run is
   the extension's own 5 inner target attempts (3750 ms of waits) inside one dispatch, not Core's ladder. Reducing it
   needs one of two things downstream:
   - a stable effect reading, for example an `added` sample that leaves out volatile controls such as carousel slides;
   - an earlier `target_not_found` from the extension when the row's record shows the button is replaced ("3 matched,
     each in another record").
2. **Doc follow-up (not owned):** `docs/architecture/automation-studio.md`, in "A step that cannot run continues where
   the page is" and around C6 step 5, says On Retry runs before state routing. It needs a sentence for the own-effect
   exception, and one for the recent action's new `acted` / `skipped` / `satisfiedByState` fields.
3. **Possible follow-up (not owned):** the result-check (`loop_verification`) instructions could name
   `satisfiedByState` explicitly. They could say that a step with `acted: false` counts toward the request only
   through the state it names, and that `page_showed_step_effect` and `startView` together tell a pre-existing state
   from the run's own act.

---

# Continuation: a handle from another page is refused at submit

Coordinator continuation (run-mv636xvb-e1426db1, defect 1). Ownership was extended to
`runtime/llm/harness-options/plan-parameter-resolution.ts` and
`runtime/flow-bootstrap/candidate/submission-refusal.ts`, with their tests. I did not touch `submission.ts` or
`unchanged-submission.ts`.

## Outcome

Partial.
- The refusal is done, and it would have refused rev 2's s11 in the real run.
- The refusal's issue message names both locations. However, the model sees an issue's `message` only for codes in
  `AUTHORED_CODES` in `runtime/flow-bootstrap/plan/issue-feedback.ts`, a file I do not own.
- So the model currently receives the code, the refused handle (`handles`) and the advice from
  `submission-refusal.ts`, which tells it to take the handle from the page the step runs on, **but not the two page
  names**.
- One line closes the gap: add `"bootstrap.handle.other_page"` to `AUTHORED_CODES`. Note that this message quotes the
  two locations the domain reported in `handleViews`, which the model was already shown in those views and in the
  accepted-submission result. That breaks the list's literal "quotes nothing" promise, so the owner should decide
  whether to accept it.

## What changed and why

- **`plan-parameter-resolution.ts`.** When the caller asked for the view history (`handleReach: "view_history"`, which
  only a candidate submission does), `otherPageIssues` runs after the nodes are resolved.
  - It adds one error per offending step: code `bootstrap.handle.other_page` (new `CODES.otherPage`), at
    `plan.subflows.<i>.nodes.<j>.parameters`.
  - `issue-feedback.ts`'s `HANDLE_ISSUE` pattern matches the code, so the feedback carries the handle the model wrote.
  - The message says: "The handle tN of this step was printed in a view of <location>, but the step runs at
    <location>, where the step before it and the step after it act. Take the handle from a view of the location this
    step runs at (…)…"
  - The code says "location", not "page". The harness-options `builtin.test.ts` guard bans browser words (`url`,
    `page`) in this directory's code. My first draft used `URL` parsing and failed that guard, so I replaced it.
- **How the acting page is decided statically.** A step is refused only when all of these hold. Otherwise the page is
  treated as undetermined, and nothing is refused.
  1. The step has exactly one incoming edge, which is a `success` edge, from a step that has no other outgoing edge.
  2. The step has exactly one outgoing edge, which is a `success` edge, to a step that has no other incoming edge.
     Together, 1 and 2 mean no branch, join, loop body, first step or last step.
  3. Both neighbours have handle views, and they all share one location.
  4. Every one of the step's own handle views is at another location.
  5. Every one of the step's own views is newer (by view number) than every view of both neighbours.
- What the rules rely on:
  - Rule 2, the step after, is what rules out the common case where the step before navigates (open a result, then act
    on the product page). Only the step before cannot tell us the page.
  - Rule 5 rules out a real round trip (go to another page, act, come back) learned in that order.
  - A neighbour with no handle is never looked past, since it could be a navigation that names no control.
  - A location is compared without its query or fragment (generic URI syntax, cut at the first `?` or `#`). Picking an
    option rewrites the query: in the real run, s10 is on `/ip/…/418830127` and s12 is on `…?variant=5510202`, and
    exact comparison would have missed the defect.
- **Real-run check, by hand** from `lab-runs/2026-10-12/run-mv636xvb-e1426db1/steps/0054-tool-core.submit_candidate/result.json`
  `handleViews`:
  - s11 (`t1888`, view 43, napkins location) sits between s10 (view 16) and s12 (view 24), which are on the same
    towels location once the query is cut. It is refused.
  - No other step of rev 2 meets all five conditions: s7's location equals its neighbours'; the other steps' neighbours
    disagree, or a neighbour has no handle.
  - I worked this out by reading the data, not by running it. I also assumed a straight script, because rev 2's edges
    were not checked.
- **`submission-refusal.ts`.** A new `HANDLE_ADVICE.other_page` explains the cause and the way out: take the handle
  from a view of the page the step runs on; else move the step to where the Flow is on the page that printed it, or
  drop it. There are no scenario words. The header gained a t486 paragraph.

## Commands run and observed results (continuation)

All were run from `packages/fluxiq`.
- Fail-first, before the change:
  - `npx vitest run …/harness-options/tests/plan-parameter-resolution.test.ts` -> 1 failed, 34 passed
    (`expected true to be false`: submit accepted the other-page step).
  - `npx vitest run …/candidate/tests/submission-refusal.test.ts` -> 2 failed, 24 passed (no `other_page` advice).
- After the change:
  - plan-parameter-resolution -> 36 passed.
  - submission-refusal -> 26 passed.
- `npx vitest run …/harness-options/tests` first failed in `builtin.test.ts` ("names no browser concept", on `url`).
  After the rewrite, `harness-options/tests` gave 20 files / 200 tests passed.
- All touched directories:
  - `npx vitest run …/llm/harness-options/tests …/flow-bootstrap/candidate/tests …/executor/step-loop/tests
    …/llm/harness/tests` -> Test Files 60 passed (60), Tests 473 passed (473).
- Typecheck:
  - `npx tsc --noEmit -p .` -> exit 0, no output.
- Structure audit, from the Core root:
  - `node scripts/structure-audit.mjs` -> exit 0. It still says "2 baseline entries can be lowered".
  - New advisory warning: `plan-parameter-resolution.ts` is 527 lines (it was 435), past the 400-line advisory
    threshold and under the 800-line limit.
- One command of mine was blocked by the git hook, because I had wrongly included a read-only `git stash list`. Nothing
  in it ran, and I re-ran it without that part.

## Not verified (continuation)

- That the model is shown the two locations. That needs the `AUTHORED_CODES` line above.
- That the real rev 2 is refused when the Flow script is parsed. I replayed the rule on its `handleViews` by hand, not
  through a parse of the 0053 script.
- No Lab run.

## Open questions (continuation)

1. `AUTHORED_CODES` owner: add `bootstrap.handle.other_page`, which makes the message (with its two locations) reach
   the model?
2. Known gap, by design. If the model copies the step-after's handle from a view taken *before* a genuine round trip,
   rule 5 does not hold, and the round trip is refused. The advice is then still satisfiable: the model can copy the
   handle from the return view. Steps next to a handle-less step, and any branch, are never checked.
3. The `docs/architecture/` description of candidate submission should mention the new refusal. I did not edit it,
   because it is not my file.

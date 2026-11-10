# Check cleared, effect held? (live-checks-r3)

## Outcome

Partial. The cause is in two places. The Core half is fixed and tested. The extension half is
described below with the exact change, but I did not make it, because the brief keeps me out of
the extension.

1. Core (engine): when the person pressed Continue on a person-needed ask, the run took the
   step's `success` route without checking whether the step's act had happened. Fixed in
   `engine/automation/person-cleared.ts`.
2. Extension: the challenge gate (`apps/extension/src/content/action-runtime/results.ts`,
   `challengeGateFailure`) replaces a target-not-found failure with `web.intervention.required`
   and drops the record's `effect: "unacted"`. Core therefore cannot tell that the press was never
   made. Until the extension change below lands, Core treats a press like run-mwapfy0i's as one
   that may have been made, and the bug stays for that exact shape.

## Questions

### (a) Did the filter's effect hold after the check was cleared?

No. The press was never made. Evidence:

- In the saved Flow (from attempt 1, steps 0011-0027): s1 dismiss-welcome, s3 accept-cookies,
  s5 type "usb c hub" and submit, s6 the free-shipping press (`free-shipping`), s7 type the
  ceiling, s8 apply the ceiling, s9 sort by price, s10 the list read.
- The site at the start of attempt 2: `attempt-2/site.json` `activityBefore` ends
  `verify-human, search-load, search-load`, so `loadsSinceCheck` is 2 and the next results load
  is replaced by the traffic screen (`crossborder-marketplace/route.ts:32`).
- Attempt 2's site activity:
  `search-challenge, verify-human, search-load, search-load, search-challenge, verify-human, search-load, ...`.
  - s5's submit is the `search-challenge`.
  - Step 0036 (s6) is the person clearing it (`ask-or-park` 2865 ms) and then the screen's
    reload of the unfiltered `search?cat=&q=usb+c+hub`. That reload is the `search-load`.
  - The next `search-load` is s8 (`...&maxPrice=10`), and s9's sort press is the second
    `search-challenge`.
  - Each filter option sets `location.href` to a search URL (`client/search-script.ts`). A press
    on free shipping would therefore have produced one more search load, and the second screen
    would have come at s8, not s9. That load is missing.
- Step 0036's spans: `page.click` took 2 ms, `send.click` failed in 29 ms, and there was no
  `host.before` snapshot. The press was refused while resolving its target on the screen page.
  The extension's challenge gate (`results.ts:556-569`) turns that into
  `web.intervention.required`.
- s9's press, by contrast, was made. Its navigation landed on the screen at the sorted address,
  and the screen's `location.reload()` (`client/verify-script.ts`) kept the sort. The step-13 read
  (s10) then read `...&maxPrice=10&sort=price_asc` without `freeShipping=y`.
- I could not tell why s10 answered `output_not_observed` rather than reading wrong rows. The
  flow step folders hold only `meta.json`.

### (b) Where does the replay decide the step succeeded, and on what evidence?

The only evidence it uses is the person's Continue. It never looks at the attempt's act or the
page. The path through the files at HEAD `152a544bd`:

- `runtime/parking/person-needed-ask.ts:64-65`: Continue has `route: null`, so it takes
  `routes.granted = "success"`.
- `runtime/parking/settlement.ts:61` returns that route.
- `engine/automation/step-loop/ask-or-park.ts:102`: `routeOverride = settlement.route`.
- `engine/automation/graph-run.ts:509-539` (HEAD): a defined `routeOverride` skips state routing
  (`:511`) and the failed-attempt path (`:525`, with its effect check). It then sets
  `route = "success"` and takes the success edge.
- On a durable park, `resume.ts:80` seeds `route` and `graph-run.ts:392` skips the node
  altogether.

The run-acts layer adds a false record on top. In `run-acts/settling.ts:121-123` (9421825cb), a
plain press met by a person check is recorded as `effectApplied: true` unless the failure says
`effect: "unacted"`. Because the challenge gate drops that field, run-mwapfy0i's unpressed filter
was recorded as pressed.

### (c) The rule, now implemented (`engine/automation/person-cleared.ts`)

After Continue on a person-needed ask, the step is judged on the page the person left:

1. The act was not made (`effect: "unacted"`, or the fault was found while resolving the target),
   or the node's repeat cannot act (a read, a look, a wait): the step runs again from its own
   arrival, with a fresh readiness wait and target.
2. The act may have been made:
   - Plain press with no expected state: go on. It was made, the check was its answer, and the
     check reloads the address the press asked for. Pressing it again could undo a toggle.
   - Step with a `done when:`, or an act that lasts (declared by the node, or a floor that names
     a consequence, not the floor's bare `commit`): run the effect check. The page is read fresh,
     because the attempt's own comparison was taken with the check covering the page.
     - `landed`: go on.
     - `not_landed`: run the step again.
     - `unknown`: a lasting act is held as `run.outcome_uncertain` and never made again. A plain
       press goes on.
3. The existing bound still applies. A step run again that meets the check again asks again, and
   after 3 asks in a row with nothing succeeding the run ends (`person-needed.ts`).

On 9421825cb: its code does not need to change, and it does not block a needed re-run. A plain
press is left out of every refusal: `begin` returns `not_lasting` for a non-lasting call, and the
run gate never refuses it. So a second press goes out and is settled by its own answer. A press
whose record says `unacted` is not recorded at all, which is now right because the engine presses
it again. I updated only its header, which still said the engine always goes on.

## What changed and why

All changes are in Core `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src/`:

- `engine/automation/person-cleared.ts` (new): the decision above. It returns `go_on`, `rerun`,
  or a `run.outcome_uncertain` trace, and records `effectCheck` on the attempt when the check
  runs. It puts a rerun or a hold on the defence ledger and posts a generic activity thought.
  After a durable park, the run state has no floor for the node, so the floor is resolved from
  the node's authored parameters (as `attempt.ts` does when a binding is missing). A resolver
  that throws fails the run; it is not read as "no floor".
- `engine/automation/graph-run.ts`:
  - after `ask-or-park`: a Continue that comes back as `success` goes through the decision, and
    `rerun` means `continue` on the same node;
  - at loop top: a resumed `success` route goes through the same decision, and `rerun` clears the
    route so the node executes;
  - a `latestAttemptIndex` helper.
- `engine/automation/person-needed.ts`: header now points to the new rule.
- `framework/.../answer-first/run-acts/settling.ts` and `.../flow-run/steps-ran.ts`: header
  comments only.
- Tests:
  - `engine/automation/tests/person-cleared.test.ts` (new, 7 tests). It reproduces the run's
    shape: a filter that toggles, a screen that reloads its address, and a read whose rows depend
    on the filter.
  - `engine/automation/tests/person-needed.test.ts`: page steps now carry the press floor
    (`commit`), so they model a press that was made. Before, they had no floor, so Core now reads
    them as steps whose repeat cannot act. The no-port test passes `resolveActionEffect: () => undefined`
    to keep testing the ladder.
  - `flow-run/tests/steps-ran.test.ts`: n1 gets the press floor for the same reason.

### Extension change still needed (not made; outside my paths)

`apps/extension/src/content/action-runtime/results.ts`, `challengeGateFailure` (line ~564). Keep
the effect of the failure it replaces, so a press that never found its target says so:

```ts
  const record = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, { expected: ..., actual: ... });
  // Nothing was pressed: the target was never found. Without this Core reads the press as made and goes on without it (run-mwapfy0i-d64b26db).
  return failure.effect === "unacted" ? { ...record, effect: "unacted" } : record;
```

It needs a test beside it in `content/action-runtime/tests/`: a click whose target is missing on a
captcha page fails `web.intervention.required` with `effect: "unacted"`, and a press made before
the check (`actionNeedsPerson`, the landing's `checkLandingOutcome`) keeps no `effect`. Note that
`domain/src/runtime/llm-evidence/action-failure/refusal.ts:196` says every
`USER_INTERVENTION_REQUIRED` "did not act". That is the exploration side's reading, and it is
wrong for a press that was made.

## Commands run and observed results

- `npx vitest run src/engine/automation/tests/person-cleared.test.ts` -> 7 passed.
- Same run with `graph-run.ts` temporarily replaced by `git show HEAD:...` (then restored):
  6 failed, 1 passed. Failures included
  `expected [ 'filter', 'read' ] to deeply equal [ 'filter', 'filter', 'read' ]` for the run's
  shape, the durable resume, effect-gone-after-reload and the read cases. The hold test failed
  with `expected 'succeeded' to be 'failed'`. The "effect held is not re-run" test failed only on
  `expected undefined to be 'landed'`; it presses once with or without the fix.
- `npx vitest run src/engine/automation src/framework/automation-service/service/answer-first/run-acts src/framework/automation-service/service/answer-first/flow-run src/framework/automation-service/service/answer-first/tests`
  -> exit 0, `Test Files 158 passed (158)`, `Tests 1367 passed (1367)`. The earlier run before
  the steps-ran test update had 1 failure, which is explained above.
- `pnpm --filter fluxiq check` -> exit 0.
- `pnpm structure:check` (Core root):
  - first run exit 1, a `[failure-as-empty]` violation in `person-cleared.ts` (the
    floor-resolver catch), which I removed;
  - rerun exit 0, `structure-audit: passed (539 warning(s), 1095 baselined)`. `graph-run.ts`
    (610 lines) carries the existing advisory file-lines warning.

## Not verified

- No Lab run or live browser run, as the brief says. Whether the filter is pressed again live
  depends on the extension change above.
- Exploration (the build's evidence loop, `runtime/llm/evidence-loop`, where "on Continue the
  call stands"), outside-graph retries, and test suites outside the four named directories were
  not changed or run.
- Why s5's typed submit, which landed on the screen, reported `succeeded` instead of
  `web.intervention.required` from the landing judge (`runtime/click-landing.ts` covers a `type`
  with `submit`). If it had been reported, s5 would have asked and s6 would have pressed on real
  results.
- Why s10 answered `output_not_observed` rather than reading the unfiltered rows.

## Open questions or contradictions found

- The extension says a press answered by a check "was made" (`actionNeedsPerson`, click-landing).
  The domain's evidence code says every `USER_INTERVENTION_REQUIRED` "did not act"
  (`refusal.ts:196`, `capture.ts:99`). The two disagree, and only the `effect` field can carry the
  difference to Core.
- s5's submit landing on the screen while reporting success (see Not verified) looks like a second
  extension defect in the same run.
- The test host in `person-needed.test.ts` modelled page steps with no floor. Core reads such
  steps as ones whose repeat cannot act, so those tests now state the press floor explicitly.

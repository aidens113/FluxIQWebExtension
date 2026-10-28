# t775 D5: readings for the supervisor's judged whole run, and its scenario tests (Core)

R = `packages/fluxiq/src/programs/automation-studio/runtime`. Tree `fxwork/t775/!FluxIQ`, branch
`task/t775-minimal-reset-judging`. Nothing was committed and no mutating git command was run.

## Outcome

**Done.**

- The supervisor's judged whole run now gets the same live-only readings as a builder's trial:
  - a before reading at each witness of the whole plan's lasting steps (the latest fresh read, else a look);
  - an after reading, worded against the before state so the domain gives lines;
  - `siteChange` in the judge's summary, with proofs from the task spec parts' typed effects and `leftFromEarlier`.
- The look is honest: Core's own start check over the build's registry binding, made outside any loop.
- All 13 failing supervisor-side tests are rewritten to the new behaviour, or deleted where their only subject was retired.
- The acceptance set passes: 1067 of 1067. `pnpm check` exits 0, and the structure audit passes.

## What changed and why

### Goal 1: how Core looks during a project build without a builder's loop

**What a look needs.** A builder's look is `AutomationStudioSiteResetStartCheck.lookAt`. It runs the domain's arrival
node through the `core.run_node` option of a registry binding, then reads `startState`. The binding is built in
`brief-ports.ts` from `automationStudioHarnessOptionRegistry({ binding, nodeIds, startLocation }).evidenceLoopBinding(...)`.

**None of that depends on a loop.** The pieces behave the same outside one:

- **Build frame.** The registry frames every call with the build id from the build's evidence frame
  (`llm/harness-options/evidence-build.ts`). The supervisor's calls run inside that frame.
- **Core's own move.** `start-check.ts` runs each arrival inside `runAsAutomationStudioCoreMove`, so it is framed `move: "core"`.
- **No permission.** A call made without one gets `automationStudioActionPermissionDenied` (`registry.ts`), so the look can only arrive and read.

**What the web domain does with it** (read-only, downstream `domain/src/runtime/llm-evidence/node-run/run.ts`):

- It runs a navigation from any page.
- It skips the "address not shown" rule for a core move.

So the look is the same call a builder's reset makes. It is not a new path into the domain.

**`service/project-build/phase-start.ts`.** New `AutomationStudioProjectBuildPhaseStart.look({ binding, environment, ledger, cancellation?, liveCheck? })`:

- Builds a start check over the registry binding, with the cancellation wrapper and the settled-read live check.
- Returns `(signal) => lookAt(location, start?)`.
- Hands each read that landed to every ledger holding an act, as `observed(read, false)`: never as a baseline, as `reset-calls.ts` does for other briefs. It deliberately does not call `project.observed`, so an after-trial read can never seed an "original".
- Returns undefined when there is no arrival at the build's start location (no `startLocation` or no `runsNodes.arrival`), or no `startState`. Those are the cases where the whole run's first step would not take the tab back from wherever a look left it.

**`project-agents/supervisor/ports.ts`.**

- New optional port `look`.
- The doc for `projectLedger` is corrected: it no longer says an act refuses the trial until a reset.

**`project-agents/supervisor/whole-trial.ts`.**

- The reset's checks are `{ compare: noop, lookAt: look(signal) }` when the port is given, else unchanged (no look).
- `compare` stays a no-op: the whole run's arrival is its first step.
- The header gains a D5 paragraph.

**`service/project-build/run.ts`.** Builds `look` from `project.binding`, `project.trialEnvironment`, `project.ledger` and `project.cancellation`, and passes it to the supervisor when defined.

**`flow-bootstrap/site-reset/project-reset.ts`.** Comment only. The session reads through the first ledger that holds an act, and is correct for the supervisor because:

- every look read reaches every act-holding ledger;
- receipts, control witnesses and explored acts are shared build-wide, so stamps resolve alike through any ledger.

**What gets no readings:**

- **Offline trials.** The gate admits them with no reset, so no session begins. This is unchanged.
- **Trials with no look.** Without a look the supervisor begins no session, so unread witnesses can never turn a yes into `unproven`.

### Goal 2: the 13 failing tests

**`whole-trial.test.ts` (1 rewritten, 2 added).**

- **Rewritten:** "runs the test with the build's act still on the site, its judge told under startedWith, and an ending names it".
  - It no longer scripts a reset brief or a `cannotUndo` retry.
  - It asserts `startedWith.acts` = `act-1`, no reset dispatched, the act still in place, and the exact ending reason.
- **Added (fail-first):** "reads the hold at 9 just before and 10 after, with no reset brief, and its judge is sent the change with the part shown".
- **Added:** "takes no readings without Core's look".
- **Removed:** three empty `describe` shells D1 left behind, with their unused helpers and imports.

**`supervisor-loop.test.ts` (2 rewritten).**

- **The survey and reset scenario.**
  - The second test now runs. It is not refused, and its `startedWith.acts` names the first trial's `act-1`.
  - The model's own reset then clears the acts, so the third test starts with none.
  - Three trials run. `act-3` is left in place and named.
- **"Completes only on a yes".**
  - The ending is no longer held for `project.completion_reset_first`: the reset step and the second ending are gone.
  - The codes are the same less the hold.
  - The ending names what is left, and no reset is dispatched.

**`rescued-pass-fallback.test.ts` (6 rewritten, 2 cleaned).**

- Each completion now happens at once, with no `completion_reset_first` and no Core cleanup reset.
- The act left in place is asserted by id: `act-2`, `act-3` or `act-1`.
- `told` must end with "Still on the target from this build: ...".
- The guard-stall test with a purse now proves Core sends no reset even when it could pay for one.
- The "no reset could be sent" test is renamed only. It still passes unchanged.
- Two passing scripts had reset steps after an ending that can now never be reached; those steps are dropped.

**`reset-next.test.ts` (1 rewritten, 2 deleted).** The "nothing is assembled" test:

- is held once for `repair_first`, then the model's own reset runs;
- its answer is exactly `GUIDANCE.next.afterResetNothingAssembled`, with no `core.test_candidate`;
- its ledger is cleared, and the ending is blocked.

One passing test was renamed to describe what it shows ("says to test when it is sent before the latest assembled Flow was tested").

**`service/project-build/tests/project-build-phase-start.test.ts` (1 fixed, 2 added).**

- **Fixed:** in the whole-trial case, the earlier act is `inPlace: !hook`. The header text is updated.
- **Added (fail-first, end to end):** a new describe that runs:
  - the real `PhaseStart.look` over a stub binding with `startState` and an arrival;
  - the supervisor-shaped project reset;
  - the real candidate gate with `changeParts`;
  - the real whole-trial port, candidate-trial run and summary;
  - the real build-test judge on a mock provider.
- **Added:** a no-look case (no start location, no arrival, no `startState`).

**`supervisor-fixture.ts`.** New `readings: { copies }` option:

- the builders' list read carries `HOLDS_AT`;
- a stub `look` port routes reads to every act-holding ledger, as production does;
- the trial port adds one copy and takes `request.siteChange` after its run;
- `looks` and `judged` are returned.

Without the option the fixture behaves exactly as before.

**Deleted tests:**

1. `reset-next` "is answered as before once the build went on with another brief after the held ending". Its only subject is dropping `resetToEnd` when another brief is sent. `resetToEnd` can no longer be set: no ending or completion is held for a reset, and D1 open question 5 says so. The answer to a reset with nothing assembled is still asserted by the rewritten first test.
2. `reset-next` "says to complete again with the fallback's complete object, never to test". Its only subject is the `completeAgain` answer to a reset sent because a completion on the fallback was held. That hold (`project.completion_reset_first`) is retired. Completion on the fallback is still asserted in `rescued-pass-fallback` "completes on the fallback at once".

No settlement or ending assertion was weakened. Each rewritten test now asserts more:

- the exact act left in place;
- that no reset brief is dispatched;
- that the ending or `told` names what is left.

## Commands run and observed results

All runs are from `packages/fluxiq` unless noted.

- **Baseline, before any edit:** `node ../../scripts/vitest-groups.mjs --groups=parallel <R>/project-agents <R>/service/project-build <R>/flow-bootstrap/trial-change <R>/flow-bootstrap/site-reset`.
  - Printed `Tests 13 failed | 1052 passed (1065)` and `Test Files 5 failed | 121 passed (126)`.
  - These are the 13 the brief names: rescued-pass-fallback 6, reset-next 3, supervisor-loop 2, whole-trial 1, project-build-phase-start 1.
- **Fail-first, supervisor level.** I temporarily replaced whole-trial.ts's `checks` with `() => UNLOOKED`, then restored it from a scratch copy and confirmed with grep.
  - The new readings test failed: `expected [] to deeply equal [ …(2) ]` (no looks).
  - After restoring, `whole-trial.test.ts` printed `Tests 14 passed (14)`.
- **Service level.** The first run printed `expected [ {…}, {…} ] to have a length of 1 but got 2`: the yes and its recheck are both judge calls.
  - I dumped both requests. Each carried `siteChange` with:
    - `before: {source: "core_look"}` and `after: {source: "core_look"}`;
    - `lines: {gone: ["Item: 9 on the list"], added: ["Item: 10 on the list"]}`;
    - `proofs: [{part: "p1", effect: adds 1, proof: "shown"}]`;
    - `leftFromEarlier: [{did: "press \"Add\" button"}]`.
  - The assertion now checks this exact packet in both requests and the arrivals `[LIST, LIST]`, then prints `Tests 17 passed (17)`.
- **Final acceptance (same command).** Printed `Tests 1067 passed (1067)`, `Test Files 126 passed (126)` and `[vitest-groups] all groups passed: parallel`.
- **Prompt-contract tests** (`llm/deepseek/tests/system-prompt.test.ts`, `flow-bootstrap/plan/tests/issue-feedback.test.ts`). No model-facing words changed; they were run anyway and printed `Test Files 2 passed (2)`, `Tests 65 passed (65)`.
- **`pnpm check`.** Exit 0, printing `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; ..."}`, with 0 `error TS` lines and no foreign errors. The tsconfig includes `src/**/*.ts`, tests included.
- **`pnpm structure:check` (Core root).** Printed `structure-audit: passed (448 warning(s), 1152 baselined).`
  - I trimmed the phase-start test to 398 lines to clear a new 400-line advisory warning.
  - `supervisor-fixture.ts` was already over the 8-exported-values advisory before `HOLDS_AT`.

## Not verified

- **No live, headed or Lab run.** The web domain's handling of the look is read from its source, not exercised:
  - a core-move navigation outside any loop, with no `callScope`;
  - no "fresh" opening;
  - its effect on the domain's per-build arrival memory, keyed `(build, "")`.
- **The cost of the looks.** Before readings are only taken when no fresh read exists; after readings are always taken, each a settled read, two `startState` calls about 1 s apart. This was not measured.
- **Freshness across ledgers.** The before reading's freshness uses the reader ledger's clock: the first act-holding ledger. A lasting act made after the read by another brief, with no read routed after it, would not tick that clock. This is the same rule builders' trials use (D1's design). I did not change it, since `trial-change/**` is additions only.
- **More ledger settling.** With a look, the supervisor's reset also lets each ledger's `beforeTrial` look at stale act witnesses (L1 settlement), as builders' resets do. That can settle acts from fresh reads before a whole trial. The scenario tests pass, but this extra settling was not examined live.
- **The supervisor-level test uses a stub port.** Its look stub mirrors production's routing (the read goes to each act-holding ledger), and it passes no trial acts to `siteChange` (acts `[]`). The end-to-end service test is the one that runs the real look, port, summary and judge.

## Open questions or contradictions found

1. The fixture's builder act is a trial act. The brief's "explored add" is matched by the service-level test, where `act-1` is an explored "Add".
2. `state.resetToEnd` and the `completeAgain` and "end again now" answers in `dispatch-tool.ts` are now unreachable, and no test covers them any more. They are a cleanup candidate (D1 open question 5), outside my files except `state.ts` reads.
3. A whole run's readings exist only where a start location and arrival exist (`look` is undefined otherwise). A build with no start location still gets no `siteChange` on its whole run.

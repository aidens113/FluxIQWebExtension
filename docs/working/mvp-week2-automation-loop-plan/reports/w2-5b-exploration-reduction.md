# W2-5b — Exploration reduction

**Outcome:** Done.

## Premise re-check (asked for mid-task)

The brief's premise holds. I re-verified it against Core before writing the
second file, at what was then HEAD `1be6c9e`, searching by behaviour rather
than by directory name: `minimis|minimiz|minimal (path|sequence|action)|backward
slice|trajector|reduc(e|tion|er)` and then `shortest|prune|distil|slice|essential
step|undo|reverted|collapse the|smallest set` across `packages/**/*.ts`. Every
hit was `String.prototype.slice`, `Array.prototype.reduce`, or `digest().slice()`.

I also checked the two places sibling work had landed under other names:

- `AS/runtime/flow-change/` (`trial.ts`, `verdict.ts`, `confidence.ts`,
  `contracts.ts`, `action-target-parameters.ts`) trials a change that has
  *already been proposed* and decides a verdict over the attempts it made. It
  never derives a candidate from an exploration trace.
- `AS/runtime/recovery/adaptation-promotion.ts` gates whether an adaptation may
  be applied. Also downstream of a candidate existing.

And the only consumers of 2.3's exploration result at all are
`AS/runtime/recovery/annotation/exploration.ts` (runs it) and
`AS/runtime/recovery/stages.ts` (turns it into one trace event). Nothing reads
`AutomationStudioRuntimeExploration.trace` for content. So the trace is produced
and then never used for anything but counts, which is the gap as stated.

One small correction to the brief: 2.3's trace module is
`AS/runtime/recovery/trace.ts` exporting `AutomationStudioRecoveryTrace`, not a
file named `recovery-trace`.

**HEAD moved during the task**, as warned: `1be6c9e` at the start, `e9c26b1` by
the end. My directory is untracked and was unaffected; all validation below was
re-run after the move.

## The input contract I took from 2.3, and what it did not carry

2.3's per-step record is `AutomationStudioLlmEvidenceLoopTrace`
(`AS/runtime/llm/evidence-loop.ts`), reached as
`AutomationStudioRuntimeExploration.trace`:

```ts
{ iteration: number; decision: "tool_call" | "complete" | "unusable";
  callId?: string; toolId?: string; evidenceBytes?: number;
  effectApplied?: boolean; resultCode?: string; usage?: … }
```

Three of the five things a reduction needs are there, and I took all three
rather than inventing parallel names:

1. **Order and identity** — `iteration`, `toolId`.
2. **Whether the action ran** — a `tool_call` entry with no `callId` is a
   request the loop answered from what it already held. The three codes it
   writes for that are `llm_evidence_loop.already_answered`,
   `llm_evidence_loop.already_observed` and
   `llm_evidence_loop.rejected.repeat_without_progress`.
3. **Whether a mutation applied** — `effectApplied`, present only for a tool the
   table declares `effect: "mutate"`.

The tool table beside it (`AutomationStudioLlmEvidenceTool.effect`) supplies
observe-versus-mutate. I reused that exact vocabulary rather than a second one.

### Two things 2.3 does not carry, and could not be invented

**It carries no state digest before or after a step.** This is the real gap. A
digest *is* computed per step —
`automationStudioExplorationEvidenceDigest(evidenceText)` in
`AS/runtime/recovery/progress-guard.ts`, called from `recordAction` in
`runtime-exploration.ts` — but it is a digest of *the evidence the step
returned*, it lives inside the budget ledger's private `Set` for repeat
detection, and it never reaches the trace. Evidence is what the step *said*; the
reduction needs what the world *was*. A step that returns the same bytes twice
may have changed something both times, and one that returns new bytes may have
changed nothing. So this is not a field I could rename into place.

**It carries no action input.** `runtime-exploration.ts` builds
`actionSignature(toolId, canonicalJson(value))` for repeat detection and keeps
the signature, discarding the value. So the trace names the action and not what
it was asked to do — and a reduced sequence nobody can run again is not a fix.

I did not invent either field on the trace. Instead the adapter
(`evidence-loop-trace.ts`) takes a caller-supplied `stateSource` lookup keyed on
`iteration`, and a trace entry the caller cannot answer for is returned as a
named gap (`no_state_digests`) rather than guessed at. **The supervisor's call:**
either 2.3's runner starts recording a caller-supplied state digest per step
(and the action input), or every caller of the reducer has to keep its own
side-record. The first is one field on `AutomationStudioLlmEvidenceLoopTrace`
plus a hook on `executeTool`; the second duplicates the trace, which is how two
records of one run come to disagree.

## The reduction algorithm

`reduceAutomationStudioExploration` in `backward-slice.ts`. A walk backwards
from the state success was observed in, over *moments* rather than steps —
moment 0 is before the first step, moment *m* is after step *m−1*.

```
needed = stateAfter of the success observation
repeat:
  m = the EARLIEST moment whose digest equals `needed`
  if m == 0: stop — the state was already right before anything ran
  producer = step m-1
  keep it if it is replayable; otherwise mark the chain unsound
  needed = producer.stateBefore ; bound = producer
```

A step is *replayable* when all three of: `effect === "mutate"`,
`outcome === "succeeded"`, and `stateBefore !== stateAfter`. Those are the
brief's "drop observation-only tools" and "drop failed actions", plus the
no-op case.

**Earliest, not latest, is what drops the action-plus-undo pair,** and it is the
only interesting decision in the module. Nothing declares `back` the inverse of
`click`. The wrong click goes `list → wrong`; going back goes `wrong → list`; so
the state the correct click starts from held at two moments — once at the very
beginning, and again after the undo. Asking for the *latest* producer finds the
undo, keeps it, then keeps the wrong click that made the undo necessary, and
reduces nothing. Asking for the *earliest* lands on moment 0 and both fall off
the chain. A domain-neutral reducer cannot recognise an inverse action; it can
recognise that a state it had already been in has returned. That generalises past
pairs: a detour of any length cancels the moment the state comes back (tested).

**Output.** The kept steps in order, plus:

- `inputState` — `{ kind: "state_digest_equals", digest }` for the state the
  sequence must be applied from, or `{ kind: "any_state" }` for an empty trace.
- `outputState` — the digest success was observed in.
- `dropped` — every in-scope step with exactly one of five reasons
  (`after_success`, `observation_only`, `did_not_succeed`, `changed_nothing`,
  `undone`), so `actions.length + dropped.length === exploredSteps` is an
  assertion rather than a hope.
- `stateChainIntact` — false when the digest moved for a reason the trace does
  not record, or when something unreplayable sat where a producer should be. The
  reduction is still returned; the doubt is reported rather than swallowed.

**Predicate limitation, stated plainly.** With one opaque whole-state digest per
moment, equality is the only sound predicate Core can build. That is right as a
postcondition and too strict as a precondition: a whole-state digest changes when
anything in it changes, including things the sequence does not depend on, so the
guard will refuse replays that would have worked. Narrowing it needs the caller
to hand over state as *separable facts* rather than one digest. That is a
contract change upstream of this module and I did not invent one; the failure
direction it leaves is safe (refuse a good replay, never admit a bad one).

## Files

All new, all under the one directory the brief assigned:

```
F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\exploration-reduction\
  step.ts                       input contract: effect, outcome, two digests
  state-predicate.ts            the predicate type and its evaluator
  reduction.ts                  output contract, drop-reason vocabulary + sentences
  backward-slice.ts             the algorithm
  evidence-loop-trace.ts        adapter from 2.3's trace, and the named gaps
  index.ts                      barrel
  tests/backward-slice.test.ts       16 tests
  tests/evidence-loop-trace.test.ts   9 tests
```

I touched nothing else. `live-patch.ts`, `recovery/recovery-verdict.ts`,
`service/adaptations/patches.ts`, `storage/project/adaptation-store.ts` and
`service.ts` are untouched.

## Wiring not made — the exact call sites

The module is unreachable from outside `AS/runtime/` until someone adds:

1. **`AS/runtime/index.ts`** — add `export * from "./exploration-reduction/index.ts";`
   alongside the existing `export * from "./recovery/index.ts";` (line 16). Core's
   structure audit does not require this, so it passes without it; nothing
   outside `runtime/` can import the reducer until it is added. I did not edit
   that barrel because it is shared and I do not own it.
2. **`AS/runtime/recovery/annotation/exploration.ts`, after the
   `runAutomationStudioRuntimeExploration({...})` call at line 177** — that is
   the one place holding both the finished `AutomationStudioRuntimeExploration`
   and the domain tool binding, so it is where `automationStudioExplorationStepsFromTrace`
   then `reduceAutomationStudioExploration` belong. It is also where the state
   digests would have to be captured, because it owns `executeTool`.

Note the import-boundary rule in `scripts/structure-audit/config.mjs`:
`runtime/llm` must not import a *value* out of `runtime/recovery`. Wiring in the
direction above is fine; my module imports only *types* from `../llm/index.ts`.

## Canonical test — observed output

`Observe → Scroll → Wrong Click → Back → Inspect → Correct Click → Wait` reduces
to `Correct Click → Wait`. Observed, verbose reporter:

```
✓ tests/backward-slice.test.ts > reduceAutomationStudioExploration >
  reduces observe, scroll, wrong click, back, inspect, correct click, wait to correct click then wait
✓ … > bounds the sequence with the state it starts from and the state success was observed in
✓ … > accounts for every step it dropped, and says which rule dropped it
✓ … > drops an action and its undo because the state returned, not because the pair was declared
✓ … > drops a detour of any length once the state it started from returns
✓ … > never keeps an observation, even when the state digest moved across it
✓ … > reduces the canonical sequence to the same two actions when its observations disturbed the digest
✓ … > drops a step whose outcome was failed
✓ … > drops a step whose outcome was refused
✓ … > drops a step whose outcome was not_run
✓ … > drops a step that ran and left the state exactly as it found it
✓ … > ignores everything after the step success was observed at
✓ … > answers with no actions, and the state it requires, when nothing had to be done
✓ … > carries the argument each kept action was given, so the sequence can be run again
✓ … > has nothing to reduce, and no state to require, when the exploration took no steps
✓ … > refuses a success index that is not one of the steps

Test Files  1 passed (1)      Tests  16 passed (16)
```

The asserted reduction is exactly `[{ index: 5, actionId: "click", input: { target: "right" } },
{ index: 6, actionId: "wait" }]`, with `inputState` = `state:list`, `outputState` =
`state:right-detail-loaded`, and drops `observation_only, observation_only,
undone, undone, observation_only`.

The whole seven-step sequence is written in the web domain's own words *in the
test file only*. Core's `web-vocabulary` audit rule skips test files by design —
its own comment says Core's tests must be able to say "a recorded click on a
selector" to prove Core carries one opaquely. No source file under
`exploration-reduction/` contains a web, DOM, URL, selector, tab or browser word;
the audit confirms this below.

## Mutations — both make a test fail

**Mutation 1 — keep the observation-only steps.** Removed `step.effect ===
"mutate"` from `isAutomationStudioExplorationStepReplayable` in `step.ts`.
**Failed 2 tests** (23 passed):

```
× never keeps an observation, even when the state digest moved across it
  → expected [ 'read', 'fix' ] to deeply equal [ 'fix' ]
× reduces the canonical sequence to the same two actions when its observations disturbed the digest
  → expected [ …(3) ] to deeply equal [ { index: 5, …(2) }, …(1) ]
      + "actionId": "scroll",
        "actionId": "click",
        "actionId": "wait",
```

The second is the canonical seven-step sequence with the digests recorded as
having moved across the lookups — which is what a page re-rendering under an
observation really produces. `Scroll` enters the reduced sequence.

Note the plain canonical case does *not* fail under this mutation, and that is
worth knowing: there the observations leave the digest identical, so the
`stateBefore !== stateAfter` clause already excludes them and the effect clause
is redundant. The effect rule earns its place precisely when a digest is
volatile, which is the realistic case, and that is the test that pins it.

**Mutation 2 — keep the wrong-click / back pair.** Replaced the earliest-moment
lookup in `backward-slice.ts` with a backward scan for the *latest* moment at or
before the bound. **Failed 9 tests** (16 passed), the canonical one among them:

```
× reduces observe, scroll, wrong click, back, inspect, correct click, wait to correct click then wait
  → expected [ { index: 2, …(2) }, …(3) ] to deeply equal [ { index: 5, …(2) }, …(1) ]
        "actionId": "click",
      + "actionId": "back",
      + "actionId": "click",
        "actionId": "wait",
× accounts for every step it dropped, and says which rule dropped it
× drops an action and its undo because the state returned, not because the pair was declared
      → expected [ Array(3) ] to deeply equal [ 'step.three' ]
× drops a detour of any length once the state it started from returns
      → expected [ 'out.one', 'out.two', …(3) ] to deeply equal [ 'fix' ]
× ignores everything after the step success was observed at
      → expected [ 2, 3, 5, 6 ] to deeply equal [ 5, 6 ]
× carries the argument each kept action was given …
      → expected { target: 'wrong' } to deeply equal { target: 'right' }
× (and 3 more, incl. the adapter's end-to-end reduction)
```

That is precisely the predicted failure: the reduction becomes
`Wrong Click → Back → Correct Click → Wait` and reduces nothing.

Both mutations were reverted and the reverted state re-validated.

## Commands run and observed results

All run from `F:\!FluxIQ\packages\fluxiq`, never the repository root.

| Command | Observed |
| --- | --- |
| `npx vitest run src/…/exploration-reduction` | `Test Files 2 passed (2)`, `Tests 25 passed (25)` |
| `npx vitest run src/…/exploration-reduction --reporter=verbose` | 16 named passes, quoted above |
| `npx vitest run src/…/exploration-reduction src/…/runtime/recovery` | `Test Files 23 passed (23)`, `Tests 333 passed (333)` — nothing in 2.3 regressed |
| `npx tsc --noEmit` | 2 errors, both pre-existing and not mine: `runtime/tests/service-adaptation/tests/subflow.test.ts(205,27)` and `(206,27)`, `TS2740 … missing … from AutomationStudioGraphNodeRecord`. That file is `M` in `git status` from another agent's in-flight work and does not reference anything of mine. Zero errors in `exploration-reduction/`. |
| `node scripts/structure-audit.mjs` (from `F:\!FluxIQ`) | `structure-audit: passed (160 warning(s), 361 baselined)`. Zero findings mentioning `exploration-reduction` — including the `web-vocabulary` rule that HEAD commit `25bea03 Fail the build when a web concept enters Core` installed. |
| `npx vitest run` (full package, 3 attempts) | See below. |

**Full-suite runs, honestly.** Three attempts, three different results, none
involving my files:

1. Crashed outright inside the worker pool — `RangeError: Maximum call stack
   size exceeded` at `tinypool/dist/index.js:131`, then `TypeError: Cannot read
   properties of undefined (reading 'toString')` in tinypool's own worker init.
   No test results at all.
2. `Tests 15 failed | 2475 passed | 1 skipped (2491)`, `Test Files 10 failed |
   276 passed`. Every failure shown was `Error: EBUSY: resource busy or locked,
   unlink … project.sqlite` / `-shm` / `-wal`.
3. `Tests 1 failed | 2489 passed | 1 skipped (2491)`. The single failure was
   `service-flows/tests/scale-pages.test.ts:297` —
   `expected 613.6176000000014 to be less than 500`, a wall-clock budget.

Non-reproducible, non-overlapping, and all three signatures (pool crash, file
locks, timing budget) are what several agents validating concurrently in one
unisolated checkout plus this machine's known RAM fault produce. I am reporting
them as environmental, not as defects, and not as my work — my 25 tests passed
in every run including the two that failed elsewhere.

## Not verified

- **No live browser or real-provider validation.** This module never touches a
  browser, a provider or IO; it is a pure function over a list of records. But
  it has also never seen a real exploration, because nothing produces the state
  digests yet. Everything asserted is over fixtures I wrote.
- **The adapter has not been run against a real `AutomationStudioRuntimeExploration`.**
  Its fixtures are hand-built from the shapes `evidence-loop.ts` writes, which I
  read rather than captured. If 2.3 writes a trace shape I misread, the adapter
  is wrong and its tests would not notice.
- **`pnpm check` and `pnpm build` were not run** — only `tsc --noEmit` and the
  structure audit, which are what `check` wraps for this scope. Other agents were
  editing the same tree, and a full build would have been reporting on their
  work as much as mine.
- **Nothing is wired in.** The reducer is never called. Whether it is *useful*
  at the call site — whether a caller can actually produce stable state digests
  cheaply enough per step — is unproven and is the main risk in this design.
- **The precondition's strictness is unmeasured.** I argue above that whole-state
  digest equality will refuse good replays. I have not measured how often,
  because that needs real digests.

## Open questions / contradictions found

1. **Who computes the state digest, and over what?** This is the decision that
   determines whether the module works. Too coarse (the whole page serialised)
   and the precondition never matches; too fine and an undo is not recognised
   because an incidental byte differs. It is a domain decision, but Core should
   probably state the contract: *stable across a no-op step, different after a
   step that changed something the automation depends on.*
2. **An undeclared-effect tool defaults to `observe`.** The evidence loop treats
   a tool with no `effect` as non-mutating, and my adapter matches it. So a
   mutating tool that forgot to declare itself is dropped from every reduction.
   The `stateChainIntact` flag catches it (the step is found on the chain and
   refused), so the result is flagged rather than silently wrong — but a caller
   that ignores the flag gets a reduction missing the step that mattered.
3. **`successAt` is currently the caller's assertion.** The reducer takes an
   index and defaults to the last step. Phase 2.4's recovery verdict is what
   actually decides success from observed evidence, and that is the thing that
   should be naming the index. Those are the same boundary the brief kept apart
   between me and the verdict worker, so I left it as an input; someone should
   connect them rather than let a caller pick the index by hand.

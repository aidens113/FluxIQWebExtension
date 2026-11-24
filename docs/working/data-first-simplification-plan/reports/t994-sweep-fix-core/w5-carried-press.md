# t994 W5: a press held only to a look is looked at, not refused forever (F23)

Worker report, 2026-11-23. Brief: `../../briefs/t994-w5-carried-press.md`. Core tree: `fxwork/t994/!FluxIQ`. No browser, provider, paid call or git mutation.

## Outcome

Done. t995's diagnosis holds. I adopted the lead's proposed fix, with one change to it: the hold is released through a handle (`letGo`) rather than a separate record method. That keeps `AutomationStudioAttemptActRecord` at the structure audit's 40-method limit.

The reproduction now passes as `it`, and the new cases pass. Every test beside the changed files passes, and the structure audit passes.

## Cause as verified

I checked t995's reading of the code in the files, then confirmed it by running the reproduction before changing anything.

1. `act-record/gate/read-answer.ts` (`changedState`): any `draft.changed` line with `how: "reads"` or `"rose"` counts as changed state. A stepper's heading line that "reads" otherwise therefore qualifies.
2. `act-record/seed.ts`: `carries()` keeps an undeclared act that has `changedState`. `carried()` then stamps it `heldOnRepeat: true`.
3. `act-record/record.ts`:
   - `refusable()` admits `heldOnRepeat` entries.
   - `stands()` admits them while they are `may_have_landed`.
   - `carried()` returns the first standing match, whatever `lookedSince` says.
   - On a replay nothing ever calls `looked()`, so the hold can never lift.
4. `run-acts/run-gate.ts`: the native door answers that match `skipped: already_done` and sends nothing. The engine's recorded-effect check is answered `seen` through the proxy, so the step "succeeds" with no dispatch.

**Reproduction before any change:** 1 file, 4/4 passed. The `it.fails` fix case failed as expected. The "today" case showed:

- nothing sent and the stepper left on step 1;
- three `web.target.not_found` on the option;
- one look answering `gone`;
- the step ending `executor.target.gone` and the run `failed`.

## Fix

**`runtime/answer-first/act-record/record.ts`**

- Added `carriedHold(call)`, a read that refuses nothing and counts nothing as left out. It returns `{ act, toALook, letGo() }` or `undefined`.
  - `toALook` is true only when every standing match is `undeclared && heldOnRepeat`.
  - `letGo()` deletes `heldOnRepeat` from those held matches and persists the record.
- Moved the match `carried()` uses into a module function, `carriedMatches(entries, call, identity)`. `carried()` and `carriedHold()` share it, so both read the same matches. `carried()` behaves exactly as before.
- Inlined the one-line private `matching()` at its three call sites, with the same behaviour. Without that the class reached 43 methods, and the structure audit fails at more than 40.
- Added a header paragraph, "A held press on a replay".

**`framework/automation-service/service/answer-first/run-acts/run-gate.ts`**

- New gate input `scope?: { projectId, flowId }`.
- Both doors now go through `refusedFor(calls, node, signal)`:
  - If no call has a hold, the call is admitted, as before.
  - If every hold is `toALook`, the gate looks:
    - it takes the node's recorded effect (`automationStudioNodeRouteSignatures(node).effect`);
    - it observes the page with `observeAutomationStudioRouteState(...)` under `scope`;
    - it asks the real host, not the gate's proxy, `automationStudioRouteEffectSeen`.
  - Only `not_seen` lets the hold go (`letGo`). The call is then admitted and goes through the usual settling path: `stepOf`, `begin`, `native`, `nodeAnswered`. A plain press settles through `record.settled`, which absorbs the entry and clears `carried`.
  - Every other case calls `record.carried()` and refuses as before: `seen`, `unknown`, no effect, no host, no scope, a failed observation, or any declared, claimed or landed match.
- At the output door the look reads the node the engine last asked about through `resolveActionEffect`, tracked as `running` in the existing `settle` wrapper. Without `settle` there is no node, so it refuses as before.
- Updated the header ("A press held only to a look").

**`framework/automation-service/service/answer-first/flow-run/flow-run.ts`**

- `gatedOptions` passes `scope: { projectId: ports.input.projectId, flowId: ports.input.flowId }`. The rest of the line is unchanged, and the doc comment gained one sentence.
- The brief named `.../answer-first/attempt/flow-run.ts`, which does not exist. The gated-options wiring is in `.../answer-first/flow-run/flow-run.ts`, and that is the only flow-run edit.

**Why the hold is released for the attempt, not looked at on every press**

Once released, the press is this attempt's own plain press, which the settling header says is pressed as often as the Flow says. A stepper's second Next, or a loop's next-page Next, would otherwise be compared on page 2 against an effect that is visible there and refused. The release lasts for this attempt only: `changedState` stays on the entry, so the next attempt's seed holds it to a look again. The record tests assert this.

**What was not changed**

- `read-answer.ts`'s `reads` rule: the look is the root fix, and narrowing that rule is optional.
- Retries, waits and caps.
- Paths outside the owned list.

## Whether builds record effects

Yes, for a by-hand press during exploration:

1. The domain signs the effect per acted handle. In `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts:400`, `webPlanActEffect(before, after, selfChanging)` produces it.
2. `resolve-plan-node.ts` returns it as `effect`.
3. Core's `runtime/llm/harness-options/plan/parameter-resolution.ts:327` stores it as `node.routeSignatures.effect` where the build signed none.
4. `flow-authoring/bootstrap/adaptation.ts` (`routeSignaturesMetadata`) keeps it in node metadata.

So recording effects did not need to be added.

Limits on this:

- The domain keeps an effect only when the act added something.
- `webAutomationRouteEffectSeen` answers `not_seen` only when:
  - the effect is `web-effect.v1`;
  - it added at least 3 control names;
  - none of them is on the page;
  - the page is not on the effect's path.
- Anything else is `unknown`, which keeps the refusal.

Whether F23's saved `main.s4` node carries an effect was not checked, because the saved Flow document is not in the screened evidence.

## Files changed (Core, `packages/fluxiq/src/`)

- `runtime/answer-first/act-record/record.ts` (modified)
- `runtime/answer-first/act-record/tests/held-to-a-look.test.ts` (new, 4 tests)
- `framework/automation-service/service/answer-first/run-acts/run-gate.ts` (modified)
- `framework/automation-service/service/answer-first/run-acts/tests/carried-press.test.ts` (new): t995's reproduction re-pathed, `it.fails` flipped to `it`, and 6 cases added. The flipped case now passes `scope` to the gate, which is the new input.
- `framework/automation-service/service/answer-first/flow-run/flow-run.ts` (modified, gated-options wiring only)

**New cases in `carried-press.test.ts`**

- `not_seen` presses Continue and the run succeeds. The hold is released, and the next attempt's seed holds it again.
- Refused with nothing sent where (`it.each`):
  - the host says `seen`;
  - the host says `unknown`;
  - no recorded effect;
  - no scope;
  - no `observeRouteState`.
- A declared act is refused even when the host says `not_seen`.

**`held-to-a-look.test.ts`**

- `carriedHold` reads without refusing.
- A declared act is `toALook: false`.
- `letGo` persists and stops the refusal for this attempt, and the next seed holds the act again.
- `letGo` on a declared act changes nothing.

## Commands run and observed results

All runs were from `packages/fluxiq`, in the foreground, one at a time, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t994-w5 -- node ../../scripts/vitest-groups.mjs --groups=<group> <files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`.

1. **Before any change**, `--groups=parallel run-acts/tests/carried-press.test.ts` gave 1 file, 4/4 passed. The `it.fails` case failed as expected, which reproduces the bug.
2. **After the fix**, `--groups=parallel` on:
   - run-acts tests `carried-follow-on`, `carried-press`, `plain-press`, `run-gate`, `settled-before-return`, `settling` and `store`;
   - `act-record/tests`, `act-record/gate/tests`, `act-record/identity/tests` and `act-record/mergers/tests`.

   Result: 29 files, 450/450 passed.
3. `--groups=real-sql` on:
   - `run-acts/tests/double-act.test.ts`;
   - `answer-first/tests/double-act-on-run.test.ts` and `dropped-act.test.ts`;
   - every real-sql file in `flow-run/tests` (15).

   Result: 18 files, 144/144 passed.
4. `--groups=parallel` on the 10 parallel `flow-run/tests` files gave 10 files, 81/81 passed.
5. `node scripts/structure-audit.mjs` (Core root), first run: 1 violation (`[class-methods]` record.ts, 43 methods). That led to the restructure described under Fix.
6. After the restructure, `node scripts/structure-audit.mjs`: `structure-audit: passed (570 warning(s), 903 baselined)`. record.ts sits at 40 methods, which is an advisory warning only.
7. After the restructure, a rerun of step 2's set gave 29 files, 450/450 passed. It includes carried-press 10/10 and held-to-a-look 4/4.
8. After the restructure, `--groups=real-sql` on `double-act`, `double-act-on-run`, `dropped-act`, `flow-run/tests/flow-run`, `replay-over-done-act` and `stated-toggles` gave 6 files, 90/90 passed.

I did not edit `double-act-on-run.test.ts` or `dropped-act.test.ts`.

## Not verified

- The package typecheck: the brief says the supervisor runs it. Vitest's transform compiled every changed file, but that is not a type check.
- The live acceptance: company-website-saturday-certificate with `lab attempt --attempts 4`, where attempts 2 to 4 send `main.s4`. No browser or Lab run was allowed.
- Whether F23's saved `main.s4` carries `routeSignatures.effect`, and whether its effect added at least 3 control names. If it added fewer, the host answers `unknown` and the press stays refused.
- FluxNode carried runs (`framework/automation-service/service/runtime-session/graph-options.ts`, `carrying`) build the gate without `scope`, and that file is outside my paths. A hold there is still refused as before.
- The look is a single observation, made before the press. A page still rendering when it is taken could lack a late-drawn effect and read `not_seen`. The domain's "at least 3 added names, none present" rule limits this. Any remaining risk applies only to undeclared presses, where the record already discloses a limit.

## Open questions or contradictions found

- The brief's path `.../answer-first/attempt/flow-run.ts` does not exist. The wiring is in `.../answer-first/flow-run/flow-run.ts`, and I edited only `gatedOptions` there.
- `runtime-session/graph-options.ts` could pass `scope: { projectId: carry.projectId, flowId: carry.flowId }` the same way, if FluxNode replays should get the look too. It is not owned, so I did not edit it. The proposed diff is the one-line addition to the `automationStudioAnswerFirstRunActGate(options, { record: ..., ...})` call in `carrying`.
- `act-record/gate/read-answer.ts` still reads any `reads` line as `changedState`, so in-page navigation is still held in later attempts. It is now looked at instead of refused forever. Narrowing the rule remains optional, as the brief says.

# t294 — lane A round-4 fixes (lane A lead, 2026-10-07)

Tree `fxwork/t294`, both repositories, branch `task/t294-lane-a-r4-fixes`, = dev plus the C1 patch (`settings_rewrite_run`
for an `input` on a change that takes none; see `debugs/run-muxkzdjw-31a13429.md` and `reports/live-a.md` round 4 in
`fxwork/t262`). Nothing committed. No paid run. Evidence run: `run-muxkzdjw-31a13429`. C1b (a choice claim judged
when made, `claim-verdict.ts`) is left to the supervisor, as asked.

## (1) C2b — a checked rerun keeps the step as it ran

**Cause.** Core `R/llm/node-tools/rerun-check.ts` `checked()`. A rerun of a step whose lasting act was already done is
sent as the dry run's check (`replay: "verify"`), which runs nothing, and on `verified`/`present` it took the new
argument whenever the value named no other node. In the run:

- 0031 moved step 13, the "Get coupons" press holding act a2, onto the "+" control (t965). The coupon act sat on an
  unrun "+".
- 0075 then gave it `{target: t964, text: "3"}`, and a click held a `text`.

That was the lane D R7 design: a done act could be moved to another row's control.

**Fix.** A checked rerun takes only new values for parameters the step ran with, on the control it ran on. It never
takes another action (declared by the check's answer or named by the value), another control, or a parameter of
another kind. "Another control" means a target parameter (`target`, `selector`, `element`) given a value the step was
neither shown with (`input`) nor ran with (`ranWith`). A rerun patch that leaves the target out keeps it, so a
value-only correction still takes.

- When it takes, `ranWith` and `control` stay, with the changed values written over the resolved form.
- When it does not, the answer says why: "another control ... run it as a new call with add true and its act. To
  change only a value of this step, rerun it with just the keys that change", or names the parameters it never ran with.
- An unreproducible check keeps its old wording.

**Tests.**

- 5 new cases, run muxkzdjw C2b, in `R/llm/node-tools/tests/rerun-check.test.ts`.
  - Fail-first: `Tests 4 failed | 1 passed | 20 skipped`. The passing one pins the value-only take.
- 12 older cases pinned the replaced design (retargets: Amara's Confirm to Tom's, "original" to "candidate", and a
  declared action change). They now assert the new rule, and each keeps its original concern:
  - Tom's request is never pressed;
  - Amara's selector is never put under Tom's name;
  - lasting execution is kept;
  - following test marks are dropped on a take;
  - bound values are separated.
- Result: `Tests 27 passed (27)`.

## (2) "Couldn't fix your Flow" at the end of a creation build

**Path.** The only producer is `apps/extension/src/background/activity/headline.ts` `activityHeadline`, with kind
`run`, outcome `failed` and repairing. It is reached through `pacer.ts` `displayFor` / `thoughtDisplayFor` when a unit's
kind resolves to `run`.

**Live cause: not established.** Here is what I could rule out:

- Core emits a build's ending as a `step` row with `final: true` under the build scope (`R/activity/build.ts`).
  `subject.kind` is `build`, and the contract allows only `build | run`.
- No Core, domain or extension path gives a creation build's rows a run subject. The only run-scope emitters are
  `run.ts` and `parked-wait.ts`; the conversation command emits none; the gateway does not rewrite subjects.
- The relay keeps its display in memory, so no stale display is restored from storage.
- The Lab records none of the events the extension received.

A probe fed the pacer Core's build-subject sequence (repairing, "Build stopped: a budget ran out", then a late thought).
It never produced "Couldn't fix", but it showed a second defect: the late thought reopened the settled unit as
"Fixing your Flow | Build stopped: a budget ran out" with outcome null.

**Fix: both ways the build's ending sentence can sit under a run's headline are closed.**

- G1, `ending-kind.ts`: a settling row's build or run ending is recognised by its row's title of any kind, or by its
  label when it has no row. Before, only a `step` row's title counted.
- G2, `pacer.ts` `accept`: a unit that settled (failed or done) stays settled. A later row in it that settles nothing
  is ignored for the display. It still passes through the repair and retry trackers.

**Tests.** `apps/extension/src/background/activity/tests/pacer.test.ts`, 2 new cases. Fail-first: `# tests 40
# pass 38 # fail 2`. After: the `background/activity/tests` files gave `# tests 94 # pass 94 # fail 0` (bundled and run
as `scripts/test-extension.mjs` does, named files only).

**Recommended (not done).** The Lab should keep the relay's received events (its `history`/`recent`, already in the
panel state) in the run folder, so the next run can establish the live shape; `ending-kind.ts` has noted this gap
since t276.

## (3) "No rows would be stored" on a cart task

**Cause.** Core `R/result-verification/check-words.ts` `rowsWords` read the count at the head of the check's
observation and said "No rows would be stored." for a 0. A cart Flow writes no dataset: the live judge request had
`buildTest.stores: []`, so the observation read "0 records would be stored, in 0 datasets". The card
(`src/ui/activity-action/check-why.ts`) then made it "Didn't pass: no rows would be stored, and no step presses "Add to
cart"".

**Fix.** An observation saying the Flow writes no dataset ("stored, in 0 datasets") or no record set ("stored, across
0 record sets") gets no row words at all. This is the rule `R/activity/wording/run-ending.ts` already applies to a run's
ending (run `run-muw5zv4m-52d83027`). A Flow whose read writes a dataset and finds nothing still reads "No rows would be
stored." / "No rows came back."

**Tests.** `R/result-verification/tests/check-words.test.ts`, 2 new cases. Fail-first: `Tests 1 failed | 4 passed (5)`.

## Validation (lead, in t294, observed)

In the paths below, `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

- Core `npx vitest run R/llm R/flow-draft R/flow-bootstrap`: `Test Files 284 passed (284)`, `Tests 3358 passed
  (3358)`.
- Core `npx vitest run R/result-verification R/activity src/ui/activity-action`: `Test Files 77 passed (77)`, `Tests
  867 passed (867)`.
- Core `pnpm.cmd run check` (packages/fluxiq): exit 0.
- Core `node scripts/structure-audit.mjs`: `passed (278 warning(s), 349 baselined)`. The one new advisory warning is
  `rerun-check.test.ts` at 486 lines (threshold 400).
- Core build (`pnpm.cmd --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`):
  exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0, and core-build reported t294's Core current.
- Downstream `node scripts/structure-audit.mjs`: `passed (176 warning(s), 118 baselined)`.

Not verified: no live run on any of the three. The overlay fix is not proven against the live event shape, which is
unknown. No full package suites (per the twice-a-day rule).

## Files

- Core, all under `R/`:
  - `llm/node-tools/rerun-check.ts` and `llm/node-tools/tests/rerun-check.test.ts`;
  - `result-verification/check-words.ts` and `result-verification/tests/check-words.test.ts`;
  - from C1: `flow-draft/amendment/{settings-rewrite-run.ts,apply.ts,tests/settings-rewrite-run.test.ts}` and
    `llm/draft-amendment-feedback.ts` (line 180 only).
- Extension: `apps/extension/src/background/activity/{ending-kind.ts,pacer.ts,tests/pacer.test.ts}`.

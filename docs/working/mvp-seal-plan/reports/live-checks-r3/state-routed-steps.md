# Saved steps for a state that may not come: why the saved Flow stopped on them

Worker report, t885. The task: saved steps that handle a state that may or may not come up must be run by page state, not by build order. Evidence came from three sightings: the crossborder "Not now" cover, the bigbox napkins "View cart", and the photo-social kiln step 17.

## Outcome

**Partial.** The three sightings have **two causes**, not one. Cause B is fixed in Core and has provider-free tests that fail when the fix is reverted. Cause A is traced to one line in the domain, `node-run/run.ts`, which the brief says I must not edit. I did not change it. The exact one-line fix is written out below for the owner of that file.

## Two causes

### Cause B: a step written on the page that a skipped act would have produced (napkins step 8, kiln step 17)

**What happened.** Attempt 2 runs the saved Flow through the attempt's run gate (`answer-first/run-acts/run-gate.ts`). The gate does not repeat a lasting act. It answers the act's step `success`, with nothing sent. The engine then carries on in build order, to the next step. That next step was written on the page the act produced:

- **Napkins** (`lab-runs/2026-11-09/run-mw9x529c-557f5402`):
  - Draft step 7 is the "Add to cart" press, with `consequences: ["create_new"]`.
  - In attempt 1 it opened a drawer. Step 0014's page shows "COVERING ... t738 'Customers also bought' ... covers 35", with "✓ Added to cart" appearing.
  - Step 8 is the drawer's "View cart" link (t744).
  - In attempt 2 the Add was carried and skipped. So the drawer never opened, and step 8 failed `target_not_found` (step 0024).
- **Kiln** (`run-mwa0iiha-f3c93e83`):
  - Draft step 16 is the dialog's "Done", with `consequences: ["create_new"]`. In attempt 1 it closed the dialog and went to the collection page, `~/tamsin.reyes/saved/kiln-theory-notes/` (step 0033).
  - Step 17 is that page's "Saved" link (t818).
  - In attempt 2, Done was carried and skipped. Steps 11 to 15 had run again: the dialog opened and the name was typed. So the page stayed on `~/saved/` with the "New collection" dialog open (step 0046: "DIALOG t745 'New collection' modal").
  - Step 17 failed `target_not_found` (0045).
  - The debug note's wording, "a press inside a dialog never opened", is inaccurate. The dialog was open; the page that Done leads to never came.

**Why the run stopped.** The run reads a failed target only through state routing (`engine/automation/state-routing/decision.ts`). State routing had three possible ways on, and none applied:

1. **A sometimes-present step's declared way on.** This applies only to optional steps, and these steps are required. They have to be: when the act does run, its follow-on steps are needed.
2. **A match on another step's recorded starting page.**
   - For napkins, no later step starts on the product page.
   - Going back to the Add is refused, because the Add is a completed lasting act.
3. **The ladder.** Its retry goes through the re-find (`target-reacquire/step-reacquire.ts`), which answers `executor.target.gone`. A gone item then skips state routing altogether (`graph-run.ts:405`, `:499`, `&& !gone`) and goes to the failure path. There is no failed edge, so the run fails.

Nothing in the run knew that the page these steps were written on depended on an act this run did not make.

### Cause A: a cover dismissal saved as a required step (crossborder "Not now", draft step 7)

**What happened** (`test-runs/instances/t885-proof/attempts/run-mwa9oytn-d866da84`, the same shape as `run-mwa3kh87-d34c2f04`):

- The notification card is driven by a timer, and the site remembers once it has been answered: `apps/scenario-lab/src/scenarios/crossborder-marketplace/client/shell-script.ts:92`, `state/mutate.ts:50`.
- It rose in the instant after step 6 typed "10" into the Max field. Step 0012's result says: `changed: t1226 "Never miss a price drop" appeared, t1227 ... appeared`. The page is "COVERING ... t1225 covers 8 close t1228 'Not now'".
- The card is a front layer of no recognised kind. It is not a consent banner, promotion, robot check, rate limit or assistant.

**Why it was saved as required.** The design makes a press that answered a layer it did not open an `interruption`. Such a step becomes optional and is skipped when absent:

- `press-effect/answered-layer.ts`;
- Core `runtime/flow-authoring/draft/interruption.ts`;
- `flow-bootstrap/authoring/draft-routing.ts`.

But `domain/src/runtime/llm-evidence/node-run/run.ts:530-532` calls `run.layers.pressed(...)` for every on-page `mutate` step, and typing is one of those. `own-layers/memory.ts:99-103` then credits every new unrecognised layer to that step. So the timer card was remembered as opened by the typing. That meant:

- "Not now" answered the build's "own" layer;
- `interruption` was not set;
- the step was required.

The memory's own header (`memory.ts:51`) names this gap, and its test pins it (`own-layers/tests/memory.test.ts:84`: "what opened on a timer then cannot be told from it").

**Why the run stopped.** Step 7 is required, and its control is absent because the site remembers "later". The second-attempt run took the same path as above: no declared way on; no match on a starting page; the re-find found it `executor.target.gone`; the failure path. Step 0026 records `target_not_found/executor.target.gone`.

**Why this is not cause B.** The way into "Not now" was the typing, and the typing did act in this run. Nothing this run skipped explains the missing control. What explains it is that the authoring got the step's class wrong.

## The fix for cause B (Core)

The rule is in `engine/automation/state-routing/not-arisen.ts` (new):

- **When it applies.** A step whose target is not on the page, and whose way in was a lasting act that did not act this run, answered a state that never came up.
- **What the run does.** It passes the step over along its own `success` way, as `skipped: { reason: "target_absent", code: "executor.state.not_arisen" }`. It observes nothing and repeats nothing.
- **How "did not act" is read.** It is read from the attempt, not from the build order. Joins are passed through. The way in counts as not having acted when it is any of:
  - the engine's own completed-act skip (`skipped.reason === "already_done"`);
  - a host's closed word `skipped: "already_done"` among the outputs, with no effects (a lasting act already done, nothing sent);
  - a step this same rule passed over. Its follow-on page did not come either, so a chain of follow-ons is passed one at a time.
- **What it never passes over.** A step that does a lasting act; it is asked the same question as a sometimes-present step, through `doesAct` in `decision.ts`. A read (`recordOutput` / `recordsPath`), because rows are the result. A step after a step that ran. A step after a sometimes-present step that was not shown.
- **Why the way in must be a lasting act.** A carried plain press, such as a banner's "No thanks", produces nothing but the cover's absence. A missing control after it is missing for some other reason, so it keeps its recovery. The gate therefore says the word only for a lasting act.

Code changes:

- `state-routing/decision.ts:110-113`: after the declared way on, and before any page is observed, `decideAutomationStudioStateRoute` returns `{ kind: "declared", edge, code: executor.state.not_arisen }`. The lasting-act question is now one helper, `doesAct` (`:173`), shared with the declared skip. That helper was moved, not changed. The decision type gains an optional `code`.
- `state-routing/routed-attempt.ts:25`: a declared skip carries the decision's code when it has one.
- `state-routing/index.ts`, `engine/automation/index.ts`: export `AUTOMATION_STUDIO_STATE_NOT_ARISEN_CODE`, `AUTOMATION_STUDIO_ALREADY_DONE_OUTPUT`, `automationStudioStateNotArisenWayOn`.
- `answer-first/run-acts/run-gate.ts`:
  - The skipped result's outputs are `{ skipped: "already_done" }` when the carried act lasts (`:216`). It lasts when the act has a class, or the step claims one, or the step declares one (`:160`, `declaresAct` at `:236`). At the output door it lasts when the act has a class (`:189`).
  - The header has a new paragraph, "What follows a step not done again".
- `answer-first/flow-run/steps-ran.ts:150`: the next round is told "The step before it was not done again, so the page this step answers never came, and the run went on past it." It no longer reads "Its control was not on the page".

## Commands run and observed results (Core worktree `fxwork/t885/!FluxIQ`)

**Tests per cause.**

- `run-acts/tests/carried-follow-on.test.ts` drives the real engine through the gate:
  - "is passed over as not needed when that act was not done again, and the run reaches its end";
  - "passes over each follow-on in turn".
  - Two guards:
    - "not passed over when the act ran this time";
    - "never passes over a follow-on that does a lasting act, nor a read".
- `state-routing/tests/not-arisen.test.ts`, 6 tests, covers which ways in prove the rule and which do not:
  - ways in that prove it: through a join, the ledger's skip, a chain;
  - ways in that do not: a way in that acted, a plain press, an optional step that was absent, a failed way in, no way in;
  - also: a read is not passed over; the decision returns `declared` under its code; a lasting follow-on gets `none`.

**Reverted-fix checks (`carried-follow-on.test.ts`), each file restored from a scratch copy afterwards:**

- Rule disabled (`false && notArisen` in `decision.ts`): the 2 pass-over tests failed with `expected 'failed' to be 'succeeded'`; the 2 guard tests passed.
- Gate word removed (`outputs: {}`): the same 2 tests failed with the same message.
- Both files restored; `grep` confirmed the change was gone.

**Suites:**

- `pnpm exec vitest run src/engine/automation/state-routing src/.../answer-first/run-acts` → 20 files passed.
- `vitest run` of answer-first `tests`, `run-acts` and `flow-run` → 55 files, 465 tests passed. That tree includes the parallel worker's uncommitted rows and completion edits.
- `vitest run src/engine/automation src/.../service/candidate-trial` → 133 files, 1150 tests passed, exit 0.
- After the import fix (below): `vitest run` of state-routing, `carried-follow-on` and `flow-run` → 28 files, 173 tests passed.

**Checks:**

- `pnpm --filter fluxiq check` → exit 0. It ran before the import fix and again after it.
- `pnpm structure:check` (Core):
  - First run: failed on `not-arisen.ts` importing `../graph-navigation/edge.ts` instead of the barrel.
  - Fixed, rerun: "structure-audit: passed (538 warning(s), 1095 baselined)". None of the warnings is in a file I changed. Another worker's edit or my run may account for the 2 more than the 536 the earlier report saw; I did not separate them.

**Not run:** `pnpm build`, as the brief says. No Lab run and no paid call.

## Cause A: the fix I did not make (`domain/src/runtime/llm-evidence/node-run/run.ts`, off limits)

Only a press opens a layer that the Flow owns. Typing fills a field, and a layer that rises as it does rose by itself (on a timer, or on a scroll) or belongs to the field. The change is one line at `run.ts:532`:

```ts
if (pressedOnPage && node.definitionId === PRESS_NODE_ID) run.layers.pressed(buildOf(run), current?.evidence, after?.evidence);
```

`PRESS_NODE_ID` is already `"web.output.dom-click"` at `run.ts:102`.

With that line, "Not now" answers a layer it did not open. That marks it `interruption`, Core makes it optional, and a run where the card is absent skips it by the declared way on. That way on is taken before the re-find, so it never reaches `executor.target.gone`.

Things to decide and test with the change:

- **The risk it carries.** A layer that a select or a type really did open (for example, a "change country?" confirm after a select) would have its answer made optional. It would then be skipped only when absent. This is the same risk every interruption already carries, and a step that claims one of the person's acts is never made optional.
- **A narrower option.** Exclude only `web.output.dom-type` without `submit`, if the owner prefers that.
- **Tests.** The test at `own-layers/tests/memory.test.ts:84` stays as it is, because it is about the memory. The new test belongs beside `run.ts`'s press-effect tests, for example `node-run/tests/`: a type step that is followed by a new unrecognised front layer, then a press inside that layer that removes it, should read `interruption: true`.

I did not look for a way to do this inside `memory.ts`. The memory receives only the two page looks, not the act. Guessing the act from the evidence (a focused text field whose value changed) would be a proxy for a fact that `run.ts` already holds.

## Not verified

- **No Lab or live rerun of any sighting.** That is the brief's call; the supervisor runs the proofs.
- **Napkins still has a stop after this fix.**
  - The fix passes "View cart" over, so the run reaches the cart read (draft step 10), but on the product page.
  - The read is not passed over, so the run stops there instead of at step 8. The model then takes over, as now.
  - The saved Flow's only way to the cart was the drawer's link. Getting there needs a way the Flow does not have: the header's cart link ("same href as t551"), a re-find of a link by where it goes, or the Flow being re-saved after its repair.
- **Kiln is expected to pass over step 17 and run the collections read on `~/saved/`** under the open dialog. I did not prove that the read succeeds there.
- **In the live runs, the rule depends on the domain's effect floor (`resolveActionEffect`)** saying a plain press is not `commit`. Without a floor, the legacy word classifier decides. That is the same as for the declared skip.
- **Some engine traces were not available.** The saved-Flow runs' engine traces are not kept, so I read from the code why state routing found no starting-page match in sighting 1. I did not observe it.
- **Not checked:** why "No thanks" and "Accept all" (attempt 2, positions 2 and 3) were carried as acts while "Not now" was not.
- **Domain tests were not run;** no domain file changed.
- **The new `steps-ran` sentence has no test of its own.** The `flow-run` suite passes.

## Open questions or contradictions

1. **Cause A needs the one-line change in `run.ts`**, from that file's owner, or permission for me to make it.
2. **The debug note for the kiln run (`run-mwa0iiha-f3c93e83.md`)** says the step was "inside a New collection dialog never opened". The step evidence shows the dialog was opened (steps 11 to 15 ran again) and left open. The stopped step was on the page that Done goes to.
3. **The gone path skips state routing** (`graph-run.ts:499`). A re-find that answers `gone` on an unbound control goes straight to the failure path. It never reaches a declared way on that the first attempt's routing did not take. This did not matter here, because the new rule acts on the first failure, before any retry. It is still a place where "routes by state" does not hold.

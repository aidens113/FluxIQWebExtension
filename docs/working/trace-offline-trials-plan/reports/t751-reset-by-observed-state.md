# Report: t751-reset-by-observed-state (lane lead)

Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQWebExtension` (base `4d90eaa2`), Core
`C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ` (base `d78c8d4a`), both on `task/t751-reset-by-observed-state`.
No commits, merges or pushes. R = Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

## Design note (2026-10-20)

### What the evidence says

Rounds 2-5 failed on one class: a lasting act landed with nothing Core could read it back by, sealed every baseline,
and every later trial was refused (job r2 through the exploration door; office r3-r5 and job r5 through the trial door;
photo r5 through a trial act with no place). Round 5 added three shapes: a toggle the site put back by itself could
neither settle nor be pressed back (office, settle needed "a press after"; admission said "already back" and left it
listed); a control's start seeded from evidence after the build's own act, so the reset re-applied the act (photo); and
entry preparation re-ran lasting acts on a site still holding them (job, office). Photo's stall came from a listing-order
rule no web script can meet. Social round 5 is a judge and read cause (t752), not a reset or rule-contract cause.

### The model

**Witness.** Something Core reads whose reading from before the act it holds: a complete list group (a list read
complete: scopes, rows in order, row values), or a stateful control's place (state counts there). An act is witnessed by
a list named for it (`resetDestination`, issued ref), the list its control sits in, the lists of a witnessed transfer
or proved subject undo, the explored act it repeats, or its own control's flip at its place.

**R1 Baseline, read before the first act there.**
- Lists: the global seal (any lasting act froze every original) is replaced by a per-group seal. A complete read of a
  group is its original unless an act of the build already counts that group among its witnesses ("touched"), or an act
  whose effect location is unknown is on the site (a legacy unscoped act, which still seals everything). One rule in
  the three original stores (create-baselines receipts, a ledger's observations, the project ledger's adopted
  originals). Consequence: a list first read after an unrelated act can still issue a ref, so "read that list
  completely" is always a call that can be met, until an act touches it.
- Controls: a place's start is its first report while no build act has landed at that place. A trial act's own
  `before` seeds a place only when no press at that place was ever recorded; otherwise the start is unproven and the act
  has no toggle witness (photo r5's re-like cannot happen).
- An act that lands with no witness at all (no list, no flip, no stamp, no target identity) is `gate_unsatisfiable`
  with its condition named (`no_witness` / `no_target_identity`), never adopted onto unrelated lists.

**R2 Settlement by observed state.** An act is settled when fresh reads (after the act and after the latest lasting
call) of every witness show the baseline, whatever put it back. The toggle rule "the return must follow a press" is
deleted: a fresh read of the place at the start counts holds. An undo aimed at a control already showing the baseline is
answered from settlement: the act is settled (listed nowhere) when the latest read is fresh, otherwise the answer is a
look on this page. Invariant (property test): every act under `actsToUndo` has a settle whose call can be carried out.

**R3 One admission point.** `R/reset-admission/` holds one function, `automationStudioSiteResetAdmission`, that decides
from a declaration (effect, consequences, control tokens) and an optional reference whether a reversible lasting act has
a witness, answering the witness or a refusal built by `reset-answers`. Doors that call it:
1. Exploration (`action-permissions.ts` -> ledger `createBaseline`): every time, not only before the seal (the "after
   the seal nothing is asked" path is deleted). Absorbs `reset-witness.ts` and the creation precondition.
2. Submission (the plan step's permission check, `permissionFor`): the domain now declares a step's control tokens as
   the view showed its handle (`webTargetSpot`), so Core runs the same admission on each lasting step and stamps the
   witness on the plan node (`resetWitness`, Core-derived, refused if model-written). Submission itself never refuses for
   it.
3. Subflow trial, whole-candidate trial (the supervisor's whole run), entry preparation (phase start (d), and the
   predecessors a subflow trial runs): before the start hook and before any baseline moves, every reversible lasting
   step that will run must carry a valid stamp; otherwise the trial is refused unrun, `candidate.trial_step_unwitnessed`,
   `failed: no_witness`, `canMeet: another_page`, naming each step and the call that meets it (press that control once
   while exploring, naming `resetDestination` where it shows no state of its own, then submit again).
After a trial, each act takes its step's stamp: a destination ref is attached, a repeated explored act lends its
witnesses; a control or own-list stamp materialises from the step's diff.

**R4 Setup reruns.** Phase start never runs entry preparation while this build has acts on the site (open or
unsettleable); the entry is `unprepared` with `project.entry_site_not_reset`.

**R5 Contract.** Every site-reset refusal with `canMeet` other than `no_call` names a call Core offers and the domain can
carry out (a test scans the refusal sites and the ledger states). The listing-order rule reads a capability the listing
node declares (`answersRows: "page_order"` for the web read): it admits `process.limit: N` with no sort where the For
Each has `repeat most: N`, its `instead` names only calls that pass it, and the domain refuses at the key the model wrote;
a test applies each `instead` literally to a domain-resolved plan.

**R6 Replaced and deleted (callers switched in the same unit).** `site-reset/reset-witness.ts` and its test; the witness
half of `create-baselines.ts` `check`; the global `seal()` for strict acts; judge adoption (`adoptable`, the `adopted`
decision); `refsClosed` (replaced per act: `name` is unmet when no ref was read before the act); the control tracker's
"after a press" rule and trial-before seeding; `alreadyBack` leaving an act listed; `undo-claims.ran` attaching a
destination from a call that never landed. The standalone ledger of non-project candidate mode keeps its legacy unscoped
paths (they are still reached there); listed as an open item.

### Refusal-contract test

`R/reset-answers/tests/` (and a ledger-state property test beside the ledger): every `automationStudioSiteResetRefusal`
call site with `canMeet` `this_page` or `another_page` names in its instruction a tool the builder is offered
(`core.run_node`, `core.test_subflow`, `core.submit_subflow`) and a step the domain can carry out; generated ledger states
(open toggle, differing list, settled, already back, unwitnessed step) never leave an act under `actsToUndo` whose settle
names a call `target` refuses `no_call`. The listing-order contract test lives beside the domain plan-resolution tests.

### Work split

| Wave | Unit | Effort | Owns |
| --- | --- | --- | --- |
| 1 | A admission | worker-high | R `reset-admission/` (new), `site-reset/create-baselines.ts`, `site-reset/reset-witness.ts` (delete) + test, `site-reset/words.ts`, `reset-answers/**` |
| 1 | B settlement | worker-high | R `reset-settlement/**` |
| 1 | F listing order | worker-high | R `script-statements/listing-order-in-repeat.ts` + tests, `plan/flow-script-format.ts`; domain `output-nodes/extract-list/**` (not barrels), `plan-resolution/extraction/run-record-output.ts` + tests |
| 1 | G step spot | worker | domain `plan-resolution/step-permission.ts` (+ the caller that hands it the view) + tests |
| 1 | H1, H2 specs | worker | new `apps/extension/e2e/site-reset/tests/*.spec.ts` only |
| 2 | C ledger | worker-high | R `site-reset/**` except A's files |
| 2 | D stamp | worker-high | R `plan/{contracts,parsing}.ts`, `authoring/**` (refuse model-written), `llm/harness-options/plan-parameter-resolution.ts`, `adaptation.ts`, `action-permissions.ts`, `candidate/{contracts,trial-acts}.ts`, `service/candidate-trial/landed-acts.ts` |
| 2 | H3, H5 specs | worker | new photo specs |
| 3 | E doors | worker-high | `subflow-candidate/subflow-trial-gate.ts`, `candidate/trial-gate.ts`, `project-agents/supervisor/whole-trial.ts`, `service/project-build/**` |

Shared with other lanes (checked 2026-10-20): t749 edits domain `plan-resolution/index.ts` and
`plan-resolution/extraction/index.ts` (barrels: not touched here) and Core `service/project-build/whole-trials.ts`
(not touched here); t752 edits Core `service/candidate-trial/feedback.ts` (not touched; D edits `landed-acts.ts` beside
it); t753 edits domain `node-run/{run,replay,index}.ts` (not touched). Supervisor files: only `whole-trial.ts` (E),
checked again before E starts.

## Progress log

### 2026-10-20 wave 1 (A, B, F, G, H) — verified by the lead

- **A admission** (`R/reset-admission/` new: `witness.ts`, `stamp-valid.ts`, `contracts.ts`, `admission.ts`,
  `identified-create.ts`, `index.ts`, tests `admission`, `stamp-valid`, `exploration-door`): one function for every door,
  no seal check. `create-baselines.ts` delegates `check` to it, gains `known()` and `touch(groups)` (per-group seal);
  `reset-witness.ts` and its test deleted. Report `t751-a-admission.md`.
- **B settlement** (`R/reset-settlement/`): toggle holds by a fresh read at start counts (press-after rule deleted);
  a place's start is never seeded after a press there (`unproven` -> `no_baseline`); adoption deleted; `name` per act
  (a list with a receipt read before the act), `refsClosed` dropped from the judge port; `observe` takes a `touched`
  predicate. Report `t751-b-settlement.md`.
- **F listing order** (Core `script-statements/listing-order-in-repeat.ts` + tests, `plan/flow-script-format.ts`; domain
  `output-nodes/extract-list/rows-order.ts` new, its barrel line, `output-nodes/definitions.ts` 2 lines outside the brief
  (definition metadata is assembled there, reviewed and accepted), domain test
  `plan-resolution/extraction/tests/listing-order-in-repeat.test.ts`). Report `t751-f-listing-order.md`.
- **G step spot**: blocked; the step-permission caller holds no view binding, only `target-packets.ts` does. Re-briefed
  in wave 2 with that file. Its new test file pushed `plan-resolution/tests/` to 26 (cap 25): to be merged into
  `plan-step-permission.test.ts`.
- **H specs** (`apps/extension/e2e/site-reset/tests/job-unexplored-step.spec.ts`, `office-site-reverted-toggle.spec.ts`):
  run headed against a pristine `d78c8d4a` Core build (scratchpad copy, resolve hook) because the lane tree's dist was
  rebuilt mid-edit. Job fails at line 167 (`ok` expected false, received true: the never-pressed save step's trial ran,
  verdict yes, act left, My jobs 2 -> 3). Office fails at line 170 (`actsToUndo` still holds the untick act after
  `candidate.undo_already_back`; next test refused `trial_reset_required`). Report `t751-h-specs-job-office.md`.
- Lead check: `pnpm exec vitest run R/reset-admission R/reset-settlement R/reset-answers R/site-reset
  R/script-statements/tests/listing-order-in-repeat.test.ts` -> `Test Files 6 failed | 28 passed (34)`, `Tests 14
  failed | 379 passed (393)`. All 14 are site-reset tests asserting deleted behaviour (adoption x9, press-after toggle
  invariant, shape G read-before-settle, sealed-door wording in `refusal-sites`, entry repeats); lane C rewrites them.
  (From now on Core tests run through `pnpm test <paths>`, the grouped runner, per the supervisor.)

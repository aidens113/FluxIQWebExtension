# Report: t751-a-admission (worker)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ` (task/t751-reset-by-observed-state). R =
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`. No commits, no live runs, no full suites.

## Outcome

Done. `R/reset-admission/` holds the one admission. `create-baselines.ts` `check` hands off to it (exploration door),
exposes `known()` and `touch()`, and seals groups one at a time. `reset-witness.ts` and its test are deleted. Every
owned test passes, and so do tsc, the structure audit and the prompt contract tests. Two tests in files I do not own
now fail because of the brief's own rules (listed under Open questions). 13 more failures in the site-reset directory
come from worker B's settlement rewrite, which is in progress at the same time. They do not call the admission.

## What changed and why

New `R/reset-admission/` (barrel `index.ts`, one exported value per file):

- `witness.ts`. Contains types only:
  - `AutomationStudioSiteResetWitness` = `{via:"destination"; ref; scope; group}` | `{via:"own_list"; scope; group}` |
    `{via:"control"; place}` | `{via:"repeats"; act}` | `{via:"legacy"}`.
  - `AutomationStudioSiteResetWitnessStamp` = `{via:"destination"; ref}` | `{via:"own_list"}` | `{via:"control"}` |
    `{via:"repeats"; act}` | `{via:"legacy"}`.
- `stamp-valid.ts`: `automationStudioSiteResetWitnessStampValid(value: unknown): value is AutomationStudioSiteResetWitnessStamp`.
  It is strict:
  - The value must be a plain object (Object or null prototype) with own data properties only: no getters, no
    inherited properties.
  - `via` must be one of the five forms. `ref` is allowed only on `destination` and must match `^destination-[1-9]\d{0,2}$`.
    `act` is allowed only on `repeats` and must match `^act-[1-9]\d{0,3}$`.
  - Any other key is refused, which covers scope, group and place.
- `contracts.ts`: types only.
  - `AutomationStudioSiteResetAdmissionDeclared` = `Pick<AutomationStudioSiteResetDeclared,"effect"|"consequences"|"control">`.
  - `AutomationStudioSiteResetAdmissionInput` = `{declared; reference?: unknown; operation?: string; door: "exploration"|"step"}`.
  - `AutomationStudioSiteResetAdmissionExplored` = `{id; consequences; operation?; spot?: AutomationStudioSiteResetSettlementSpot; witnessed: boolean}`.
  - `AutomationStudioSiteResetAdmissionKnown` = `{unissued(reference: unknown): boolean;
    destination(declared, reference): {ref; scope; group} | undefined; original(scope, resource): {scope; group} | undefined;
    issuedRefs(): readonly AutomationStudioSiteResetIssuedRef[]; here(): readonly string[]; explored(): ReadonlyArray<Explored>}`.
  - `AutomationStudioSiteResetAdmissionRefusal`: `{ok:false; code; failed; canMeet; condition; instruction}`.
  - `AutomationStudioSiteResetAdmissionVerdict` = `{kind:"admit"; witness?: Witness}` | `{kind:"refused"; evidence: Refusal}`.
- `admission.ts`: `automationStudioSiteResetAdmission(input: AutomationStudioSiteResetAdmissionInput, known:
  AutomationStudioSiteResetAdmissionKnown): AutomationStudioSiteResetAdmissionVerdict`. The rules run in this order:
  1. A reference that no receipt printed is refused: `candidate.reset_destination_unissued`, `destination_unissued`,
     `this_page`. This applies to every call except an identified creation.
  2. A call that is not `mutate`, has no consequences, or has any class outside create_new/modify_existing/delete is
     admitted with no witness.
  3. An unscoped control is admitted as `legacy`.
  4. An identified creation is admitted with a `destination` witness, or a `repeats` witness when it repeats a
     `witnessed` explored act. Otherwise it is refused `candidate.create_baseline_required`,
     `no_destination_original`, and always `another_page`, never `no_call`.
  5. Any other press is admitted with the first of these that applies: `destination` (an issued ref), `own_list`,
     `control` (exactly modify_existing with a place and a state), or `repeats` (a `witnessed` explored act that
     `automationStudioSiteResetTrialRepeats` matches, with `operation` as definitionId). Otherwise it is refused
     `candidate.reset_witness_required`, `no_witness`, `another_page`.

  There is no seal check. Every refusal goes through `automationStudioSiteResetRefusal`. The door changes only the
  words of a refusal: the step door uses the new `WORDS.stepWitnessRequired`, because a plan step cannot carry a
  `resetDestination`.
- `identified-create.ts`: `automationStudioSiteResetIdentifiedCreate(declared): string[] | undefined`. This is the rule
  that used to be duplicated in `create-baselines.ts`; the admission and `create-baselines.ts` both import it now.

`R/site-reset/create-baselines.ts`:

- `check(declared, reference, explored = () => [])` asks the admission with `door: "exploration"`. When it admits, it
  returns exactly `{kind:"admit"}` with the witness removed, so `ledger.ts` `createBaseline` and every
  `toEqual({kind:"admit"})` assertion keep working unchanged.
- New `known(): Omit<AutomationStudioSiteResetAdmissionKnown,"explored">`. Its `destination` adds the original's ref.
  Its `original` returns `{scope, group}`. Its `here` returns the refs of the latest read.
- New `touch(groups: Iterable<string>): void`. In `observed`, no new original is recorded in a touched group, or when
  sealed (the per-group seal).
- `seal()`, `refsClosed()`, `unissued()`, `named()`, `described()` and `destination()` are kept.

Other files:

- `R/site-reset/words.ts`:
  - `witnessRequired` and `createBaselineRequired` no longer say "before this build's first reversible lasting change"
    or "a first observation after a lasting build effect". They now say "before any act of this build changes it".
  - New `stepWitnessRequired(issued)`. All words stay generic.
- `R/site-reset/index.ts`: removed the `export * from "./reset-witness.ts"` line. No line was added.
  `reset-admission` is not re-exported from site-reset or flow-bootstrap; callers import `../reset-admission/index.ts`.
- `R/reset-answers/failed.ts`: comment only. I needed no new failed condition.
- `R/reset-answers/condition-words.ts`: the `no_witness` words gain "and it repeats no witnessed press this build made
  while exploring".
- Deleted `R/site-reset/reset-witness.ts` and `R/site-reset/tests/reset-witness.test.ts`. `site-reset/tests` is now at
  24 files.

Tests added, all shown failing before the code landed:

- `reset-admission/tests/admission.test.ts`: each rule, the order of the rules, and the step door.
- `reset-admission/tests/stamp-valid.test.ts`.
- `reset-admission/tests/exploration-door.test.ts`: the ledger-level cases moved from `reset-witness.test.ts`, plus a
  new one. An exploration press after an earlier lasting act is still refused when it has no witness; the old code
  admitted it.
- `site-reset/tests/create-baselines.test.ts`:
  - Per-group seal: a list in another group still becomes an original and issues `destination-2`. A list in a touched
    group does not. `seal()` still blocks every group.
  - After `seal()`, a press with no witness is still refused.
  - A creation with no original is met on `another_page`.
  - `repeats` works through the `explored` argument.
  - The `known()` port.
- `site-reset/tests/words.test.ts`: the new wording and the step words.

## Commands run and observed results

All vitest and tsc commands ran from `packages/fluxiq`.

- Baseline before any edit: `pnpm exec vitest run R/site-reset R/reset-settlement R/reset-answers
  R/tests/action-permissions.test.ts` printed `Test Files 30 passed (30)`, `Tests 374 passed (374)`.
- Tests first, before the code: `pnpm exec vitest run R/reset-admission R/site-reset/tests/create-baselines.test.ts
  R/site-reset/tests/words.test.ts` printed `Test Files 5 failed (5)`, `Tests 8 failed | 38 passed (46)`.
  `admission.test.ts` and `stamp-valid.test.ts` could not load (no module). The 8 failures were the per-group seal,
  `known`, `touch`, the post-seal refusal, the step words, and the exploration-door post-seal case.
- After the code: `pnpm exec vitest run R/site-reset/tests/words.test.ts R/reset-admission
  R/site-reset/tests/create-baselines.test.ts R/reset-answers` printed `Test Files 6 passed (6)`, `Tests 66 passed (66)`.
- Final: `pnpm exec vitest run R/reset-admission R/site-reset R/reset-settlement R/reset-answers` printed
  `Test Files 6 failed | 27 passed (33)`, `Tests 14 failed | 367 passed (381)`.
  - 1 failure is mine by design: `refusal-sites.test.ts` "no witness before the seal ... met by no call once sealed
    with none" expects `no_call`; the brief requires `another_page`.
  - 13 failures are not from the admission. They are in `settlement-shapes.test.ts` (shapes E and G, and the toggle
    invariant "reverts with no press never settles"), `project-ledger-repeats.test.ts` (3),
    `project-ledger-adoption.test.ts` (3), `settlement-adopted.test.ts` (3) and `project-ledger-entry-repeats.test.ts`
    (1).
  - Evidence that they are B's: grep finds 0 `createBaseline`/`.check(` calls in those files. The one call in
    settlement-shapes (shape C, line 117) passes. The failures are about adoption, toggle settling and settle words,
    which worker B is rewriting in `reset-settlement/` right now (modified `judge.ts`, `words.ts`,
    `control-tracker.ts`, ...).
- `pnpm exec tsc --noEmit -p .`: exit 0, no output.
- `node scripts/structure-audit.mjs` at Core root: first run failed with statement-packing at `admission.test.ts` lines
  76 and 118. I fixed both. Rerun printed `structure-audit: passed (439 warning(s), 1152 baselined)`, with no warning
  naming a file I touched.
- Prompt contract tests (model-facing words changed): `pnpm exec vitest run plan/tests/extraction-vocabulary.test.ts
  plan/tests/issue-feedback-word-forms.test.ts plan/tests/issue-feedback-words.test.ts plan/tests/issue-feedback.test.ts
  llm/deepseek/tests/system-prompt.test.ts` printed `Test Files 5 passed (5)`, `Tests 70 passed (70)`.
- Extra narrow run of the out-of-R callers of `createBaseline`:
  - Files: `tests/action-permissions.test.ts`, `service/project-build/tests/{project-build-acts-record,
    project-build-reset-settle,reset-calls,project-build-brief-ports}.test.ts` and
    `project-agents/dispatch/tests/reset-done.test.ts`.
  - Result: `Test Files 3 failed | 3 passed (6)`, `Tests 4 failed | 56 passed (60)`.
  - Mine: `action-permissions.test.ts` (see Open questions).
  - Not from the admission: `reset-calls.test.ts` (2) records acts through `explored` directly and never calls the
    admission; `project-build-reset-settle.test.ts` (1) fails on `in_place` vs `unchanged` from trial-act adoption.
    Both match B's rewrite.

## Not verified

- I did not prove that the 13 site-reset failures and the 3 project-build failures are B's by running without B's
  edits. The evidence is the grep above and what the failures are about.
- No live or browser behavior.
- No full suites.
- The per-group seal has no effect in production yet. `ledger.ts` still calls `seal()` on every lasting act and never
  calls `touch()`. The ledger's `createBaseline` does not pass `explored`, so `repeats` never applies at the
  exploration door yet. Both are for lane C.

## Open questions or contradictions found

1. Rule order. The brief lists "reference no receipt printed" second. Today's behavior, which the brief also says to
   keep, refuses an invented ref on an observe look too: `createBaseline({effect:"observe"}, "destination-7")` gives
   UNISSUED. I kept today's behavior, so the unissued check runs before the not-reversible rule on every call except an
   identified creation. An identified creation with an invented ref stays `create_baseline_required` and is never
   admitted through `repeats`.
2. For a creation, the brief says to repeat "an explored act that has a destination". The port has only `witnessed`,
   so the admission uses `witnessed` for both cases. If lane C needs "has a destination" for creations, add a field to
   `AutomationStudioSiteResetAdmissionExplored`.
3. Tests in files I do not own now fail because of this brief's rules:
   - `site-reset/tests/refusal-sites.test.ts:169-170` expects `no_call` for a creation sealed with no original. It
     should become `another_page` (lane C).
   - `tests/action-permissions.test.ts:127` ("After the seal a press naming no ref is admitted as before") expects a
     witnessless press to be admitted after the seal. It is now refused, so act-2 never exists and `beforeTrial` admits
     at line 129 (lane D). Once the ledger passes `explored` with `witnessed`, that same-control press would be
     admitted as `repeats act-1`.
4. Stale comments name the deleted `reset-witness.ts` in files I do not own: `reset-settlement/judge.ts:60`,
   `site-reset/ledger.ts:98` and `site-reset/tests/settlement-shapes.test.ts:205`.
5. Worker B removed the `closed` option from `automationStudioSiteResetSettleWords` while I worked. Its
   `name-per-act.test.ts` covers the replacement, so I did not move the `closed` settle-word cases. I kept only the
   withheld-place cases, in `exploration-door.test.ts`, with two arguments. Their natural home is
   `reset-settlement/tests`, which B owns.

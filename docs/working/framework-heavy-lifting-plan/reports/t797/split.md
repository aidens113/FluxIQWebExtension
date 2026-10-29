# t797-split: site-reset restructured by responsibility (Core, no behaviour change)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t797/!FluxIQ` (branch `task/t797-fhl-undo-settlement`). Nothing committed.
Paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

## Outcome

Partial. Every acceptance check passes. Two things differ from the brief:

1. **The layout is sibling directories, not subdirectories of site-reset.** I tried the subdirectory shape first
   (`site-reset/undo/`, `site-reset/ledger/`). The structure audit failed it with 16 `[naming]` FAILs: "10 path
   segments exceeds the 9-segment depth limit". `site-reset/` is already at segment 8, and the depth rule never
   ratchets, so no subdirectory of site-reset can pass. I used the repository's own precedent instead (t743 moved
   the settlement modules to `reset-settlement/`, beside `reset-admission/` and `reset-answers/`):
   - `reset-undo/` holds the undo modules, with a barrel and a `tests/` folder;
   - `reset-ledger/` holds the ledger's collaborators, with a barrel;
   - the facade stays at `site-reset/ledger.ts`.

   Both new directories are outside S, so they go beyond the paths the brief named.
2. **One must-not-touch test now fails until a two-line edit is made.**
   `reset-answers/tests/refusal-tools.test.ts` hard-codes the scanned directories and refusal-site paths. It fails
   with `site-reset/undo-admission.ts: expected false to be true`. It would fail under the subdirectory shape too.
   The exact fix is below. I proved it with a temporary copy of the test in `site-reset/tests/` (3/3 passed) and then
   deleted the copy.

## What changed and why

### File map (old path -> new path)

| Old | New |
| --- | --- |
| `site-reset/undo-admission.ts` | `reset-undo/admission.ts` |
| `site-reset/undo-claims.ts` | `reset-undo/claims.ts` |
| `site-reset/undo-paths.ts` | `reset-undo/paths.ts` |
| `site-reset/undo-reach.ts` | `reset-undo/reach.ts` |
| `site-reset/undoes-tool.ts` | `reset-undo/undoes-tool.ts` |
| (new) | `reset-undo/index.ts` (barrel) |
| `site-reset/tests/undo-admission.test.ts` | `reset-undo/tests/admission.test.ts` |
| `site-reset/tests/undo-claims.test.ts` | `reset-undo/tests/claims.test.ts` |
| `site-reset/tests/undo-paths.test.ts` | `reset-undo/tests/paths.test.ts` |
| `site-reset/tests/undoes-tool.test.ts` | `reset-undo/tests/undoes-tool.test.ts` |
| `site-reset/ledger-act.ts` | `reset-ledger/act.ts` |
| `site-reset/leftover.ts` | `reset-ledger/leftover.ts` |
| `site-reset/trial-stamp.ts` | `reset-ledger/trial-stamp.ts` |
| `site-reset/ledger.ts` (part) | `reset-ledger/answers.ts`, `recording.ts`, `claims.ts`, `named-act.ts`, `lasting-classes.ts`, `state.ts` (new) |
| (new) | `reset-ledger/index.ts` (barrel; it does not re-export `lasting-classes.ts` or `trial-stamp.ts`, which only `reset-ledger/` uses) |
| `site-reset/ledger.ts` | stays, as the facade |

`site-reset/words.ts` and `site-reset/contracts.ts` did not move.

### Which ledger methods live where

- **(a) Settlement answers: `reset-ledger/answers.ts`.** Class `AutomationStudioSiteResetLedgerAnswers`, 13 methods:
  `inPlace`, `unsatisfiable`, `possiblyInPlace`, `leftover`, `unreadOf`, `changeSeen`, plus their helpers `toUndo`,
  `leftOf`, `unmet`, `open`, `settledNow`, `named`, `claimable`. It also builds the undo-reach port (`reachable`).
  Header paragraphs that moved with it: L1 "One settlement model"; "No call can settle it: `gate_unsatisfiable`";
  "What is left agrees with settlement".
  - `standing` stays on the facade as a one-line read of the public `leftover`. Moving it would have made it call
    the collaborator's `leftover` instead of the facade's, which is a dispatch change (the facade-dispatch rule
    names this risk).
- **(b) Call recording: `reset-ledger/recording.ts`.** Class `AutomationStudioSiteResetLedgerRecording`, 12 methods:
  `explored`, `placed`, `noEffect`, `undoSeen`, `trialRan`, `actOf`, `exploredActs`, `pressedUnder`, `locate`,
  `witnessGroups`, `buildExplored`, and the private `record`. Module helpers: `passWords`, `witnessTransfer`,
  `spotOf`, `lastingClasses`, `onlyModifies`, `MAX_ACT`, `LEFT_BY_TRIAL`, `POSSIBLY_LASTING`.
  Header paragraphs that moved with it: "Candidate mode had no record…" with its recorded-when and noEffect bullets;
  t593 possibly lasting; t598 trial act/item; t751 R1 seal per group; t772 value witness.
- **(c) Claim/target: `reset-ledger/claims.ts`.** Class `AutomationStudioSiteResetLedgerClaims`, 3 methods: `claim`,
  `target`, and `ran` (the `undos.ran` passthrough that `explored` calls). It builds the `AutomationStudioSiteResetUndoClaims`.
  Header paragraphs that moved with it: "What an undo may name and act on"; t719 cross-page inverses; and the t772 R2
  sentence about `target`, which came out of the `gate_unsatisfiable` paragraph.
- **Shared pieces.**
  - `reset-ledger/state.ts`: type `AutomationStudioSiteResetLedgerState` (acts, options, receipts, control witnesses,
    press notes, seen, tracker, judge, and the counters `next`, `clock`, `recordedInPhase`).
  - `reset-ledger/named-act.ts`: `automationStudioSiteResetLedgerNamedAct`, formerly the module function `namedAct`.
  - `reset-ledger/lasting-classes.ts`: the `UNDOABLE` and `IRREVERSIBLE` sets, exported and imported under their old
    aliases.
- **The facade, `site-reset/ledger.ts`.** 27 methods:
  - the admission doors `createBaseline`, `admitStep` and `stepStamp`;
  - `destinationReceipts`, `issuedRefs`, `adoptOriginalCollections` and `observed`;
  - the trial gate `beforeTrial`, `trialChange`, `endStateClash`, `startsInEndState` and the `stillThere` helper,
    with `ASKED_BEFORE_KEPT`;
  - `standing`, plus a one-line delegator for every other public method.
  - It keeps the three exported types (`…LedgerOptions`, `…ExploredAct`, `…RecordedAct`) and the overview, t775,
    t471, kept-acts, start-hook, t647, one-admission, page-read and phase paragraphs. A new paragraph names the
    collaborators and says why they sit beside site-reset.
- **Dispatch is preserved.**
  - Wherever the old code called one of the ledger's own *public* methods, the new code still goes through the facade,
    by a port closure: the undo-claims `inPlace` and `unsatisfiable`, `buildExplored` reading `exploredActs`, and
    `standing` reading `leftover`.
  - Calls between methods that were private now go to the collaborator that owns them.
  - `beforeTrial` and `observed`, which tests spy on through the prototype, are still facade methods with their bodies
    in place.

### Imports, barrels, surface

- `site-reset/index.ts` exports the same names as before. Its two re-exports are now explicit:
  `automationStudioSiteResetLeftover` with its type, and `automationStudioSiteResetUndoesTool`. Site-reset's barrel
  therefore gains no new names.
- Imports across directories go through the barrels.
  - `reset-undo/` and `reset-ledger/` take site-reset's types through `../site-reset/index.ts`.
  - `reset-undo/admission.ts`, `claims.ts` and `undoes-tool.ts` import `WORDS` from `../site-reset/words.ts`. The
    imports rule allows this because site-reset's barrel leads back to them.
  - `reset-ledger/` imports no values from site-reset.
  - The audit reports no import cycle.
- Comment paths were re-pointed everywhere outside the must-not-touch list: all backticked or quoted relative
  references in `site-reset/*`, `activity/wording/tool-call.ts` and `llm/loop-budget.ts`. Every relative reference in
  the 32 changed or new `.ts` files resolves (scripted check: 0 unresolved).
- `site-reset/tests/refusal-sites.test.ts` (owned): its refusal scan now also covers `reset-undo/` and
  `reset-ledger/`, and its pin on `undo-admission.ts` became "`reset-undo/…/admission.ts` and
  `reset-ledger/…/claims.ts` are scanned".
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`: five prose mentions now name the new paths
  (§"How an act settles", `no_admissible_undo`, the mirror note, "What is left", `destinationRemoval`). This file had
  no markdown links to the moved files. I did not touch `docs/reference/**`.

### Counts before -> after

| | Before | After |
| --- | --- | --- |
| `site-reset/` source files | 25 | 17 |
| `site-reset/tests/` | 25 | 21 |
| `reset-undo/tests/` | - | 4 |
| `site-reset/ledger.ts` lines | 800 | 461 |
| `AutomationStudioSiteResetLedger` methods | 39 | 27 |
| `reset-ledger/answers.ts` | - | 136 lines, 13 methods |
| `reset-ledger/recording.ts` | - | 300 lines, 12 methods |
| `reset-ledger/claims.ts` | - | 97 lines, 3 methods |
| `reset-undo/admission.ts` | 403 lines | 403 lines (unchanged) |

## Commands run and observed results

1. **Baseline before any edit, under the lock.** From `packages/fluxiq`:
   `pnpm test src/.../flow-bootstrap/site-reset src/.../flow-bootstrap/reset-settlement src/.../flow-bootstrap/tests`.
   Result: `Test Files 54 passed (54)`, `Tests 689 passed (689)`, real-sql: "No test files found", exit 0.
2. **After, under the lock.** The same command with `src/.../flow-bootstrap/reset-undo` added, because that is where
   the four moved test files now live. Result: `Test Files 54 passed (54)`, `Tests 689 passed (689)`, exit 0.
   - `reset-undo` alone: 4 files, 37 tests passed (paths 8, undoes-tool 2, claims 3, admission 24).
   - So the brief's literal three directories now hold 50 files and 652 tests.
3. **Typecheck, under the lock.** `node scripts/build-cache/cli.mjs fluxiq:check` printed
   `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; …","ms":52417}` and exited 0.
4. **Structure audit.** `node scripts/structure-audit.mjs` printed
   `structure-audit: passed (454 warning(s), 1152 baselined)`, the same totals as before the change. No FAIL.
   - Site-reset area warnings left:
     - class-methods: `site-reset/ledger.ts` has 27 methods (advisory 25; was 39);
     - directory-files: `site-reset/` has 17 (advisory 15; was 25), `site-reset/tests/` has 21 (was 25);
     - file-lines: `site-reset/ledger.ts` 461 (was 800), `reset-undo/admission.ts` 403 (unchanged),
       `site-reset/tests/ledger-subject.test.ts` 724, `ledger.test.ts` 636, `trial-witness.test.ts` 500,
       `flow-bootstrap/tests/site-reset-build.test.ts` 406 (all four unchanged).
   - I did not run `structure:baseline`; no baselined violation was removed.
5. **Docs links.** `node scripts/structure-audit.mjs --rule docs-links` printed
   `structure-audit: passed (0 warning(s), 0 baselined)`.
6. **Extra: the must-not-touch test.**
   `pnpm exec vitest run src/.../reset-answers/tests/refusal-tools.test.ts` gave 1 failed, 2 passed. The failure is
   `site-reset/undo-admission.ts: expected false to be true`.
   - A temporary copy with the fix below, placed in `site-reset/tests/` (same relative depth), passed 3/3. I then
     deleted the copy.
7. **Extra: the tests that spy on the ledger's prototype** (`beforeTrial`, `observed`).
   `pnpm exec vitest run` on `service/project-build/tests/project-build-{brief-ports,reset-settle,reset}.test.ts`
   gave 3 files, 28 tests passed.
8. **Extra: a line check against HEAD.** I compared every non-comment line of HEAD `ledger.ts` with the new files,
   after normalizing the `this.state.`/collaborator prefixes. 39 of 342 lines are not verbatim, and every one is a
   wiring line: the field initializers (now the state object), the constructor, the sets (now named exports), the
   `namedAct` definition, `undos.ran` (now `claims.ran`), and facade lines that read `acts`, `createBaselines`,
   `controlWitnesses` and `judge` from local consts bound to the same objects. The clock is always read live as
   `this.state.clock`. No logic line is missing.

## Required edit in a must-not-touch file (for the supervisor)

In `reset-answers/tests/refusal-tools.test.ts`:

- line 16: `const DIRECTORIES = ["site-reset", "reset-settlement", "reset-answers", "reset-admission", "reset-undo", "reset-ledger"];`
- line 134: replace `"site-reset/undo-admission.ts", "site-reset/undo-claims.ts"` with
  `"reset-undo/admission.ts", "reset-undo/claims.ts"`. Keep `"site-reset/ledger.ts"`: `startsInEndState` stayed in
  the facade.
- Optional: the header comment on lines 8-9 ("the four directories") could name all six.

Without the `DIRECTORIES` change, the t751 R5 contract silently stops scanning the undo modules' refusals.

## Not verified

- I did not run the full `pnpm test`, `pnpm check` or `pnpm build`. Per AGENTS.md these are for the twice-daily sweep.
- I did not run the web extension's checks. It imports none of the moved files, but its own repo was out of scope.
- No live browser run, because there is no behaviour change.

## Open questions or contradictions found

- **The brief's shape conflicts with the depth rule** (see Outcome 1). If the supervisor wants a different name or
  place for the sibling directories, the relocation script is
  `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/t797split-move.mjs`
  (its `relocate` mode). It moves whole directories and re-points every relative reference.
- **Stale comment references in must-not-touch files.** These name the old paths; only comments are affected:
  - `reset-answers/failed.ts`: `../site-reset/undo-reach.ts` (its `../undo-admission.ts` was already wrong);
  - `reset-settlement/act-subjects.ts`, `group-subjects.ts`, `judge.ts`, `observations.ts`, `own-control.ts`:
    `../site-reset/undo-admission.ts` or `undo-reach.ts`;
  - `reset-settlement/tests/ledger-value.test.ts`: `../../site-reset/leftover.ts`.
- **The same in the web extension repo, comments only:**
  - `apps/extension/e2e/site-reset/tests/office-site-reverted-toggle.spec.ts:168` (`site-reset/undo-claims.ts`);
  - `apps/extension/e2e/site-reset/tests/photo-dialog-destination.spec.ts:39` (`site-reset/undo-admission.ts`).
- **Room for P4.** `reset-undo/tests/` has 4 of 25 test files and `site-reset/tests/` has 21. `reset-ledger/` has no
  `tests/` yet; its collaborators are exercised through the facade by `site-reset/tests/ledger*.test.ts`. A test whose
  only subject is a collaborator belongs in `reset-ledger/tests/`.
- **`reset-undo/admission.ts` is 403 lines**, past the 400-line advisory, as it was before. P4 logic added there
  would grow it.

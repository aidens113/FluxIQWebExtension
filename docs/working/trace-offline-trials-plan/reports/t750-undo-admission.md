# t750-undo-admission-single-source: one source for the undo admission paths' act gates

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t750/!FluxIQ`, branch `task/t750-undo-admission-single-source`.
R = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`. No commits, merges, pushes, live or
paid runs.

## Outcome

Done. The act side of each undo admission path now lives in one module, `R/site-reset/undo-paths.ts`, and both
`undo-admission.ts` and `undo-reach.ts` read it. The reach's copies (`CHANGED`, `subjectsOf`, and the inline gate
checks) are deleted, and so is the pin test that guarded the copy. Behaviour is unchanged: every existing site-reset,
reset-settlement and reset-answers test passes unchanged; only the pin test was removed.

## What changed and why

- **New `R/site-reset/undo-paths.ts`.** It has one export, the const `AUTOMATION_STUDIO_SITE_RESET_UNDO_PATHS`, which
  holds one predicate per path gate (the same pattern as `AUTOMATION_STUDIO_SITE_RESET_WORDS`):
  - `about(act)`: what the act was about, which is its subject, plus its page where it sat in no item (t719);
  - `followUp(act)`: `follow_up`, the act has a landed undo's `chain`;
  - `transfer(act)`: a witnessed transfer. It is a type guard, so the admission still narrows `act.transfer`;
  - `createdItems(act)`: `created`, the items a legacy act's undo may delete by token; none for a strict act;
  - `ownItem(act)`: `own`, an item the act sat in that it did not create;
  - `readBefore(original, sequence)`: both removals; the list's original was read before the act. It is a type guard;
  - `deletesCreated(act)`: the subject deletion (t719); the act declared `create_new`;
  - `removesOnDestination(act)`: the removal on a destination (t743); a strict act that declared `create_new` or
    `modify_existing`;
  - `named(act, lent, scope)`: the removal on a destination; a list the act named, or one lent to it.

  The control-side conditions, the declared classes (`REVERSES`, `REMOVES`) and the named failure order stay in the
  admission. The reads that rule a path out for good (`ownItemGone`, the press-or-toggle hatch with
  `pressBackRefused`, `described`) stay in the reach. The own toggle comes from the ledger's `toggle()`, not an act
  field, so it is not a gate here. The header says all of this.
- **`R/site-reset/undo-admission.ts`.** These checks now read the shared gates: the transfer, created, own-item and
  follow-up gates; `aboutTheAct`; `namedDestination`; the read-before checks in `subjectDeletionUnmet` and
  `destinationRemovalUnmet`; the `create_new` class in the subject deletion; and the created-or-changed class in the
  destination removal. The header note that asked for hand-syncing with the reach now points to `./undo-paths.ts`.
  Each change is equivalent:
  - **Created.** `createdItem && !strictReset` becomes `item !== undefined && createdItems(act).includes(item)`.
  - **Own.** `!createdItem && spot && sameItem(spot, control)` becomes `spot && ownItem(act) && sameItem(...)`.
    `sameItem` already forces `control.item === spot.item`, both defined, so "the control's item was not created" is
    the same as "the spot's item was not created".
  - **Destination removal.** `removesOnDestination` also requires `strictReset`. `destinationRemovalUnmet` is reached
    only for strict acts (`destinationRemoval` checks `strictReset` first; `unmatched` runs only under `if
    (act.strictReset)`), so the named failure is the same. A comment there says so.
  - **About.** `aboutTheAct` becomes `control.subject !== undefined && about(act).includes(control.subject)`. This is
    the same truth table: subject equal, or the page where the act had no item.
- **`R/site-reset/undo-reach.ts`.** `unruled` reads `followUp`, `transfer`, `createdItems` and `ownItem`. `differences`
  reads `about` and `readBefore`. `removes` reads `readBefore`, `deletesCreated` with `about`,
  `removesOnDestination` and `named`. The local `CHANGED`, `subjectsOf` and the unused `AutomationStudioActionConsequence`
  import are removed, and the header says the gates are shared.
- **`R/site-reset/tests/settlement-unmeetable.test.ts`.** Deleted the `"the admission paths undo-reach mirrors"`
  describe (the sha256 and kind-list pin) and its three node imports (`createHash`, `readFileSync`,
  `fileURLToPath`). No other line changed.
- **New `R/site-reset/tests/undo-paths.test.ts`.** 9 tests, one or more per gate, on made-up gallery fixtures. They
  cover the boundaries the callers rely on:
  - the page counts as "about" only where the act had no item;
  - a strict act has no legacy created items;
  - an own item it created is not `own`;
  - `readBefore` is strict (`beforeAct < sequence`);
  - a non-strict act gets no destination removal;
  - `lent` may be undefined.

## Commands run and observed results

All vitest runs were from `packages/fluxiq`.

1. **Baseline, before any edit.** `pnpm exec vitest run R/site-reset R/reset-settlement R/reset-answers` (full
   paths) -> `Test Files 27 passed (27)`, `Tests 338 passed (338)`.
2. **After the change, the same command** -> `Test Files 28 passed (28)`, `Tests 346 passed (346)`. That is 338, minus
   1 pin test, plus 9 new tests. `undo-admission.test.ts` 23 tests, `settlement-unmeetable.test.ts` 7 (it was 8 with
   the pin), `undo-paths.test.ts` 9.
3. **`pnpm exec vitest run src/programs/automation-studio/runtime/flow-bootstrap
   src/programs/automation-studio/runtime/service/project-build src/programs/automation-studio/runtime/project-agents`**
   -> `Test Files 1 failed | 312 passed | 1 skipped (314)`, `Tests 1 failed | 3284 passed | 2 skipped (3287)`,
   `Duration 438.12s`.
   - The one failure was `flow-bootstrap/authoring-result/tests/browser-export.test.ts`, "bundles the actual compiled
     public candidate entry in a browser without server dependencies", with `Error: Test timed out in 15000ms.`
     (it took 15180 ms).
   - Rerun alone, the same file gives `Test Files 1 passed (1)`, `Tests 1 passed (1)`; the test took 7595 ms. The
     failure was a timeout under the load of the 438 s parallel run, not an assertion, and no site-reset test failed.
4. **`pnpm exec tsc --noEmit -p .`** -> no output, exit 0.
5. **`node scripts/structure-audit.mjs` (Core root)** -> `structure-audit: passed (438 warning(s), 1152 baselined).`
   - Advisory warnings on site-reset: `site-reset/` at 19 source files and `site-reset/tests/` at 25. Both were 18
     and 24 before.
   - Also, unchanged from before: `ledger.ts` at 632 lines and 29 methods, `ledger-subject.test.ts` and
     `ledger.test.ts` over 400 lines.

## Not verified

- No live or browser run. None is needed for a behaviour-neutral refactor, and the brief forbids paid runs.
- No downstream check. Nothing downstream imports these internal site-reset modules; they are not in
  `site-reset/index.ts`.
- `pnpm check` and the full suites were not run (narrow checks only, per AGENTS.md).

## Open questions or contradictions found

- **`browser-export.test.ts` is sensitive to load.** It has a fixed 15 s budget, took 15.18 s inside the wide run and
  7.6 s alone. I did not check whether it also times out on unchanged `dev` under the same load.

- **`site-reset/tests/` is now at exactly the 25-file hard limit.** It passes, but the next test file added there will
  fail the audit. The brief allowed `site-reset/` because its source budget (19 of 25) allows it. A future split by
  feature, for example the `settlement-*` tests (4 files), or the `undo-*` sources if a fourth arrives, would need a
  subdirectory. The prefix rule does not fire in `site-reset/` because of the path-depth limit.
- **A third copy of `about` remains in `R/reset-settlement/act-groups.ts`.** The reach's deleted `subjectsOf` cited
  it, and that file still has its own "subject, plus page where no item" logic. It was outside this brief's
  ownership, so I did not touch it. `reset-settlement/` must not import site-reset, so sharing it would mean moving
  `about` into `reset-settlement/` (or a sibling directory) and having `undo-paths.ts` re-use it.
- **The toggle hatch is not shared.** The admission's toggle path is the ledger's `toggle(act)`. The reach also treats
  an unread `act.press` as open (pressed or read as one). The reach's version is a deliberately wider, conservative
  reading, not a copy, so it stays in the reach.

## Extension (coordinator, 2026-10-20): the third "about" copy folded in

### What changed and why

- **New `R/reset-settlement/act-subjects.ts`.** Its one export is `automationStudioSiteResetActSubjects(spot)`, which
  returns the act's subject, plus its page where it sat in no item (t719). It lives in `reset-settlement/` because
  site-reset depends on that directory and never the other way, so all three callers can import it without changing
  the dependency direction.
  - It is re-exported from `R/reset-settlement/index.ts`. That is a one-line barrel addition; the barrel was not named
    in the extension message, but a barrel entry is required for the move.
  - Its budget: `reset-settlement/` goes to 16 of 25 source files, and `reset-settlement/tests/` to 3.
- **New `R/reset-settlement/tests/act-subjects.test.ts`** with 2 tests. It holds the "about" cases that were in
  `site-reset/tests/undo-paths.test.ts` and adds the unknown-spot case (`undefined`, `{}`). `site-reset/tests/` stays
  at 25 files.
- **`R/reset-settlement/act-groups.ts`.** Its inline `subjects` expression is replaced by `actSubjects(act.spot)`, and
  the header points to the shared source. `act.spot` was the very object `spot ?? {}` was built from, so the result is
  identical.
- **`R/site-reset/undo-paths.ts`.** The `about` gate is removed, and the header says "about" is the settlement's.
- **`undo-admission.ts` and `undo-reach.ts`.** Both now call `actSubjects(act.spot)`, a value import from the
  `../reset-settlement/index.ts` barrel each already imported types from. Their headers are updated.
- **`R/site-reset/tests/undo-paths.test.ts`.** The moved "about" describe (1 test) is removed; 8 tests remain.
- A grep of `site-reset/` and `reset-settlement/` for the old expression and for `PATHS.about` finds nothing; one
  copy is left.

### Commands run and observed results

1. **Before this extension.** The three folders, run after the first change above: `Test Files 28 passed (28)`,
   `Tests 346 passed (346)`.
2. **After.** `pnpm exec vitest run R/site-reset R/reset-settlement R/reset-answers` -> `Test Files 29 passed (29)`,
   `Tests 347 passed (347)`. That is 346, minus the 1 moved test, plus the 2 in `act-subjects.test.ts`;
   `undo-paths.test.ts` now has 8.
3. **`browser-export.test.ts` timing.** The coordinator's path `src/programs/automation-studio/authoring-result/...`
   does not exist; the file is at `src/programs/automation-studio/runtime/flow-bootstrap/authoring-result/tests/`.
   | Run | Test time | Run duration |
   | --- | --- | --- |
   | Alone 1 | 1898 ms | 5.98 s |
   | Alone 2 | 75 ms | 2.46 s |
   | Alone 3 | 133 ms | 2.05 s |
   | In its folder (`R/authoring-result`: 2 files, 26 tests passed) | 424 ms | 2.73 s |
   - For comparison: 15180 ms inside the 438 s wide run (the timeout), and 7595 ms alone right after that run.
   - The test runs an esbuild bundle. Its time follows machine load and warm caches, and it is far under the 15 s
     limit when nothing else runs. That points to a load timeout, not a real one.
4. **`pnpm exec tsc --noEmit -p .`** -> no output, exit 0.
5. **`node scripts/structure-audit.mjs` (Core root)** -> `structure-audit: passed (439 warning(s), 1152 baselined).`
   The one new warning is advisory: `reset-settlement/` at 16 source files, past the 15-file threshold.
6. **Wide vitest run** (flow-bootstrap, service/project-build, project-agents) -> `Test Files 314 passed | 1 skipped (315)`,
   `Tests 3286 passed | 2 skipped (3288)`, `Duration 673.11s`. No failures, and `browser-export.test.ts` passed in this
   run.

### Not verified (extension)

- I did not check whether the browser-export test times out on unchanged `dev` under the same load. The timings
  above are the evidence.

# t196-wR: an unreproducible dry-run step keeps blocking completion

Worker t196-wR, 2026-09-30. Core worktree `fxwork/t196/!FluxIQ`, branch `task/t196-state-digest-cost`,
which was clean at 564863b7 when I started. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.
Nothing is committed.

## Outcome

Done. An `unreproducible` outcome now blocks every time, just as `failed` and `changed` do. The two
existing exemptions still apply: conditional steps (`optional`, `only_if`, and the verdict's
`conditional` set) and steps that are no longer proposed. `asked` only marks feedback lines
`again: true`, and `cleanSignature` is set only by a verdict with nothing blocking. A completion
row now says `reused_clean` when the gate reused an earlier clean replay. All brief validations pass.

I made two small edits outside the "Owns" list. The callback mechanism the brief suggests needs
them. They are below.

## What changed and why

- **`R/flow-draft/dry-run.ts`**
  - `automationStudioFlowDraftDryRunVerdict` no longer takes `asked`.
  - `automationStudioFlowDraftReplayOutcomeBlocks(outcome)` is now `status !== "replayed"`, and its
    `asked` parameter is gone.
  - `automationStudioFlowDraftReplayOutcomeKey` is kept, and now only marks feedback.
  - `automationStudioFlowDraftDryRunFeedback(verdict, told = new Set())` adds `again: true` to a
    step line that did not replay and is in `told`.
  - The header now says why the asked-once rule went, citing runs 18 (`run-munpwa5r-e7aefe04`),
    21 (`run-muntufao-7b7bc04a`) and 33 (`run-munwwkwq-064c4203`). It also says what `unreproducible`
    really covers: a site that remembers the step's effect, or earlier steps that no longer reach
    the page. The two cannot be told apart.
  - `DRY_RUN_INSTRUCTION`: I removed "finish again with it kept and it will be accepted". It now
    says:
    - a step that does not replay keeps the Flow from being proposed until it replays, is marked
      optional (or only_if on a check), or is dropped;
    - finishing again with it unchanged is refused again;
    - `again: true` marks a step an earlier dry run already reported.
    - The unreproducible sentence now also tells the model to check that the steps before it
      still reach the page.
- **`R/llm/node-tools/replay-draft.ts`**: `asked` is removed from the input and from `verdictOf`.
- **`R/llm/node-tools/dry-run-gate.ts`**
  - `asked` is filled with every outcome that did not replay, *after* the feedback is built. The
    first report is therefore unmarked and later ones say `again`.
  - The comments say why the old rule went and that `cleanSignature` needs a verdict with nothing
    blocking.
  - New optional `reusedClean?()` in the gate input, called when the signature equals `cleanSignature`.
- **`R/llm/decision-handlers/completion.ts`**: `dryRunSaid` returns `reused_clean` when the gate reused
  a clean verdict. `not_run` now means only that no replay applied. The attempt resets `reused: false`.
- **`R/llm/decision-context/decision.ts`**: `AutomationStudioLlmDecisionContextDryRun` gains `"reused_clean"`, and its doc is updated.
- **`R/llm/decision-context/group.ts`**: the history row shows `dryRun: "reused_clean"` the same way it
  shows `clean`. The brief allowed this edit if the new word needed it, and it did: without it the
  row would show nothing.
- **Outside "Owns"; the callback needs them. One line each:**
  - `R/llm/evidence-loop.ts`: wires `reusedClean: () => { handling.dryRunSeen.reused = true; }` where
    the gate is built.
  - `R/llm/decision-handlers/types.ts`: `dryRunSeen` gains `reused?: boolean`, and its comment is updated.
- **Tests**
  - `R/flow-draft/tests/dry-run.test.ts`
    - "asks about ... once, and takes the answer" is inverted into "keeps blocking an
      unreproducible step on every attempt" (attempts 1-3 are all refused, and `...Blocks` is true).
    - New: a conditional unreproducible step passes, and only that one.
    - New: the `again` marker works, and the instruction contains "finishing again with it unchanged
      is refused again" and not "it will be accepted".
    - I dropped the `asked:` arguments.
  - `R/flow-draft/tests/routing.test.ts`: I dropped three `asked: new Set()` arguments. The verdict no
    longer takes `asked`. No assertion changed.
  - New `R/llm/node-tools/tests/dry-run-gate.test.ts`, with gate-level tests:
    - **Run 18:** refused at 46; refused again at 47 with `again: true` rather than waved through;
      48 replays (`dryrun.3.*`) and is refused; `reusedClean` is never called.
    - **Run 21:** refused at 62, the draft is amended to add step 40, and 64 replays and is refused.
    - **Run 33:** two unreproducible steps are refused at all four of 61-64.
    - **Passes:** once the step replays, the result is `undefined`; the next completion then makes
      no replay calls and `reusedClean` is called once. It also passes once the step is marked
      `optional` or `only_if` on d2 (still replayed, still unreproducible), and once it is dropped
      (not replayed).
  - New `R/llm/decision-handlers/tests/completion.test.ts`, a loop-level test. There are two
    check-refused completions over the same draft, followed by an accepted one. The history shown
    to decision 4 has the first row `dryRun:"clean"`, the second `dryRun:"reused_clean"`, and no
    `not_run`. Only one replay ran.
  - `R/llm/decision-context/tests/recorded-runs.ts`
    - Why it broke: run 4's live completion 47 ran no dry run, because the old gate had waved steps
      3 and 6 through. Dry runs 2-4 were "clean", so 47 reused dry run 4's verdict. Now dry runs 2-4
      refuse, nothing is cached, and 47 replays (dry run 5). The driver threw
      `the loop ran dryrun.5.reset, which the log never ran`.
    - Fix: I added `now` to `RecordedRun`, which holds the decisions the current code deliberately
      traces differently, each with its line and why. Run 4 declares only D47, with the full
      `dryrun.5.*` line (the same positions and codes as dry run 4).
    - The driver builds `expected` (the log with those lines replaced) and takes codes from it. The
      replay returns `expected` and `diverges`. It checks that each replaced line is for a decision
      of the same kind the log has.
  - `R/llm/decision-context/tests/recorded-windows.test.ts`
    - The replay check still holds `rebuilt` to `expected` exactly, line for line. `DIVERGES` pins
      the decisions that may differ from the log: `[47]` for run 4, `[]` for the others. The test
      asserts that both the line diff and the run's declared set equal that. Bigbox's pastLog test
      asserts `expected === logged`.
    - The run 4 decision-47 test records the new shape:
      - completions 29, 40, 44 and 46 all carry `dryRun [[3,"unreproducible"],[6,"unreproducible"]]`;
      - 47 is shown `dryrun.4.3` and `core.dry_run.4`, whose steps 3 and 6 carry `again: true`;
      - `cartextract5` is no longer shown. It is older than dry run 4's page and no longer fits in
        the 24,000-byte window. I measured the window at 47: detect3, cartdetect2, dryrun.4.3 (5,861
        bytes), core.dry_run.4 (3,071), completion_check.46, history, draft, budget.
    - The `OLD` comment notes that dry runs 2-4 were clean only because of the old waving.
  - `R/route-state/tests/build-routing.test.ts` (outside "Owns"; the brief said to fix any test that
    breaks): run 4 `afterUnreported` 32→33 and `callsBeforeUnseen` 28→29. Decision 48 now has D47's
    dry-run calls before it. I added a comment saying why.
- **Docs**
  - `docs/architecture/automation-studio/llm-flow-bootstrap.md`: a new dry-run paragraph, before
    "Core's own notes are superseded". It covers the four answers, the fact that every non-replayed
    answer blocks on every attempt, the two exemptions, `again`, the history of the old rule and the
    runs, and signature reuse with `reused_clean`. The history-row list now names `reused_clean`.
  - I regenerated `docs/reference/framework-reference.md` and
    `packages/fluxiq/docs/reference/framework-reference.md` with `node scripts/docs-reference.mjs`,
    because line numbers moved.

## Commands run and observed results

All heavy commands ran through `heavy.sh`.

- From `packages/fluxiq`: `npx vitest run --maxWorkers=2 --minWorkers=1` on `R/flow-draft`, `R/llm`,
  `R/flow-bootstrap` and `R/route-state`.
  - First run: `Test Files 1 failed | 121 passed (122)`, `Tests 1 failed | 1536 passed (1537)`. The
    failure was build-routing (run 4, `afterUnreported: 33` against 32, `callsBeforeUnseen: 29`
    against 28).
  - After the fix: `Test Files 122 passed (122)`, `Tests 1537 passed (1537)`, exit 0.
- Earlier targeted run: recorded-windows failed with `expected [ 'detect3', 'cartdetect2', …(6) ] to
  include 'cartextract5'`. The "as logged" replay test already passed against `expected`. After I
  recorded the new shape, recorded-windows reported `20 passed (20)`.
- `npx tsc --noEmit -p tsconfig.json` (from `packages/fluxiq`): exit 0, no output. I ran it both
  before and after the last test edit.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (199 warning(s), 354
  baselined)`. It also said "1 baseline entries can be lowered". `--json` shows that entry is
  `runtime/service.ts` file-lines at 4486 against a recorded 4558. I did not touch that file, and I
  did not run `structure:baseline`.
- `pnpm docs:check` (Core root): `structure-audit: passed (0 warning(s), 0 baselined)` and
  `Deterministic framework reference is current.`, exit 0.
- `node scripts/docs-reference.mjs`: `Wrote docs/reference/framework-reference.md and
  packages/fluxiq/docs/reference/framework-reference.md (2750 public declarations).`

## Not verified

- No Lab, browser or live run, as the brief requires. I have not seen whether a live model now marks
  a remembered banner `optional` rather than spending decisions until the budget runs out. That is
  the cost the t174-w16 report predicted.
- I did not run the whole fluxiq suite or `pnpm check`, only the four directories the brief named.
- I did not run the extension repository's suites; the change is Core-only.

## Open questions or contradictions found

- **Stale comment in the extension, which I must not touch.** The header of
  `!FluxIQWebExtension/domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts`
  (lines 6-7, 13) still says Core "asks the model once and afterwards lets the step through". It
  should be reworded to say an unreproducible step now blocks until it is conditional or replays.
  No code there depends on the old rule; grep found only this comment.
- **Ownership:** `R/llm/evidence-loop.ts` and `R/llm/decision-handlers/types.ts` were edited, one line
  each, beyond the owned list. The brief's suggested callback cannot reach `completion.ts` without
  them. `R/route-state/tests/build-routing.test.ts` was edited under the brief's instruction to fix
  every broken test.
- **Feedback lists conditional steps too:** a refused dry run's feedback still lists an exempt
  (conditional) step that did not replay among the steps. This was already the case and is out of
  scope, but it could suggest to the model that it must fix a step that is not blocking.
- **Build trace:** `progress-trace.ts` still prints no line when the gate reuses a clean signature. The
  history row now says `reused_clean`, but the `[FluxIQ build-trace]` log does not. That is t174-w16's
  instrumentation gap 1, and it was not in this brief.

# t244-w1 — Flow signature and the full-run gate (Core)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ`, branch `task/t244-partial-runs-full-judged-gate`. Nothing committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. All brief items 1-4 implemented test-first; touched tests and neighbouring suites pass; `pnpm --filter fluxiq check` exits 0.

## What changed and why

- **R/flow-draft/flow-signature.ts (new)** — `automationStudioFlowDraftFlowSignature(steps)`: JSON of proposed steps in order,
  each `[actionId, ranWith ?? input, settings ?? null, routing ?? null, interruption === true, sorted acts ?? []]`.
  `automationStudioFlowDraftReplaySignature` is unchanged. Header gives the user rule (2026-10-02) and why the replay
  signature (routing excluded) let a Flow pass on old outcomes.
- **R/flow-draft/full-run-required.ts (new)** — `AUTOMATION_STUDIO_FLOW_DRAFT_FULL_RUN_REQUIRED_CODE =
  "llm_evidence_loop.full_run_required"` and `automationStudioFlowDraftFullRunRequiredFeedback(steps)` returning
  `{ ok:false, code, steps:[{step, actionId, replayed:"not_run_in_this_build"}], instruction }`. Kept in one file as one
  cohesive group (code-structure.md: "one cohesive function group"); the word constant and instruction are module-private.
  Instruction has no web terms (tested: no page/click/browser/url/site).
- **R/flow-draft/index.ts** — exports both new modules; barrel comment extended.
- **R/llm/node-tools/dry-run-gate.ts**
  - a. `cleanSignature` and `refused.signature` are the Flow signature.
  - b. The `again.ok` pass removed. An unchanged Flow replayed MAX (2) times is refused again from the stored
    `refused.verdict` (feedback via `automationStudioFlowDraftDryRunFeedback(refused.verdict, asked)`, so `again` marks;
    issue codes from the same verdict), callId `core.dry_run.<attempts>.again`. `refused` no longer stores observations
    (nothing reads them now).
  - c. Made-optional pass: `cleanSignature = automationStudioFlowDraftFlowSignature(input.steps)` computed after
    `madeOptional` wrote the routing; the report carries that same signature.
  - d. `AutomationStudioFlowDraftTestReport.signature: string` (required); `passed(...)` takes the signature and every
    `observed` call carries it, reuse included.
  - e. After `enabled` and before the replayable check: proposed steps that are carried
    (`automationStudioFlowDraftStepCarried` from `./draft-from-flow.ts`) and lack `ranWith` or `replay` refuse:
    account + show feedback under `core.dry_run` with callId `core.dry_run.unrun.<n>` (own counter, n from 1; does not
    advance the replay attempt number), return `{ issueCodes: ["llm_evidence_loop.full_run_required"] }`. No
    executeTool, targetMoved, observed or reusedClean.
  - f. Header gains "The rule it holds (user, 2026-10-02)" with the three consequences; `refused`, `cleanSignature`,
    `reusedClean`, `observed` and the report doc comments updated.
- **R/service/flow-bootstrap-commands/tests/build-judge.test.ts** — fixture gains `signature:
  automationStudioFlowDraftFlowSignature([read])`. The build-test tests use their own structural
  `AutomationStudioBuildTestReportInput` (no `signature`), so no change there.

## Tests added (failing first)

Before the implementation, `npx vitest run` on flow-signature.test.ts, full-run-required.test.ts and dry-run-gate.test.ts:
`Test Files 3 failed (3)`, 14 tests marked `×` (all 4 signature tests, the feedback test, and 9 gate tests: the rewritten
optional test, the three report-signature tests, two "clean verdict is about the Flow" tests, three carried-step tests).

- flow-draft/tests/flow-signature.test.ts: routing/settings/interruption/acts change it (replay signature does not see
  routing); proposed set/order/ranWith change it; callId/iteration/replayed/replay.from/acts order/non-proposed steps do
  not; a step without ranWith reads by input (exact JSON).
- flow-draft/tests/full-run-required.test.ts: code value, steps shape, instruction content and no web words.
- llm/node-tools/tests/dry-run-gate.test.ts:
  - rewritten: "is replayed again, not judged from the old replays, when a routing word makes the failing step ..." —
    executeTool 9 calls (was 6), reusedClean not called;
  - rewritten: "reports a new replay's observations when a twice-replayed draft passes once its failing step is marked
    optional" — reused false, attempt 3, signature = Flow signature;
  - updated: reuse report equals first report incl. `signature`, which equals the Flow signature;
  - updated: made-optional pass reports the post-change signature, which differs from the pre-change one;
  - new: routing change after a clean replay replays again (reused [false, true, false]); settings change replays again;
  - new: carried unrun steps refused with `full_run_required`, steps 1 and 3 `not_run_in_this_build`, callId
    `core.dry_run.unrun.1`, no reports; with the vi.fn harness no executeTool/targetMoved/observed over two completions,
    shown `["core.dry_run.unrun.1","core.dry_run.unrun.2"]`; replayed (`dryrun.1.*`) once the carried step carries
    ranWith+replay; a dropped carried step does not count.

## Commands run and observed results

- `npx vitest run <flow-signature, full-run-required, dry-run-gate, build-judge, flow-draft dry-run tests>` (in
  packages/fluxiq) -> `Test Files 5 passed (5)`, `Tests 47 passed (47)`.
- `npx vitest run R/llm/node-tools/tests R/result-verification/build-test/tests` -> `Test Files 12 passed (12)`.
- `npx vitest run R/flow-bootstrap/unfinished-build/tests/judged.test.ts R/llm/evidence-loop/tests R/recovery/refuted-result`
  -> `Test Files 31 passed (31)`, `Tests 225 passed (225)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t244 w1 check" pnpm --filter fluxiq check` (Core root), run twice
  -> no tsc diagnostics; second run `exit=0` (15.5 s). Build cache: "not stamped, because inputs changed while it ran"
  (the concurrent worker's edits). No type errors in run-flow*.ts, index.ts or evidence-loop.ts at that moment.

## Not verified

- Whole-package vitest (`pnpm test`) not run, per the brief and the full-suites rule.
- Phases/build-judge consumers of `report.signature` (stamping `flowSignature`, requiring `yes` on the matching
  signature) are not in this brief; nothing reads `signature` yet beyond the tests.
- No live run.

## Open questions or contradictions found

- The evidence loop shows the `full_run_required` feedback only when the loop's `dryRun()` is invoked, i.e. when the
  dry run is enabled for the caller; a re-author build with the dry run off would still skip the gate. Worth confirming
  that the re-author's extend build passes `enabled: true`.
- `pressOn` fixtures (no `proposes`) and `step` fixtures carry routing changes through the signature as expected; a
  `repeat`/`on_failed` routing object's key order is part of the JSON, as with `ranWith` in the replay signature.

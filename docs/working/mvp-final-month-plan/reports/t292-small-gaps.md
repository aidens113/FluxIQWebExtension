# t292 small gaps (worker-high, 2026-10-07)

## Outcome

Done. All five items are fixed, and each has a test that failed before its fix and passes after it. `R` = `packages/fluxiq/src/programs/automation-studio/runtime` in Core.

## What changed and why

1. **Held amendments now go through the act judge (t285 gap 1).** `R/llm/evidence-loop/held-amendments.ts`: `settle(steps, rerun, options?)` now takes `{ claimRefused }` and passes it into its `applyAutomationStudioFlowDraftAmendments` call. Its caller `R/llm/decision-handlers/amendment.ts` (`automationStudioLlmEvidenceSettleHeldAmendments`) passes `context.input.draft.claimRefused`, the same way the direct path does. Before this, an act held for a rerun was claimed without the judge being asked.
2. **A claim refusal's `said` uses the numbers the model sent (t285 gap 2).**
   - New `R/flow-draft/amendment/said-numbers.ts` (`automationStudioFlowDraftSaidInNumbers`), exported from the amendment barrel. It rewrites each `Step N` / `step N` through a number map and skips JSON-quoted page words such as `"Spain (step 9 of 9)"`.
   - `apply.ts` maps both `said` and `instead` from the draft as it stands back to the shown numbering.
   - `held-amendments.ts` (`claimAsWritten`) maps a held claim's `said` and `instead` from the draft at settle time into the numbers the model wrote. The rerun counts as the step it replaced.
3. **R3-3 live wiring.** In downstream `domain/src/runtime/llm-evidence/tools.ts`, `WebAutomationLlmEvidenceRuntime` gains a required `readRowsKey: string`. The runtime declares `readRowsKey: "read.extracted"` beside `observedStateKeys`.
4. **The completion-check note now closes when the check throws.** In `R/activity/observer.ts`, the wrapped `checkCompletion` catches a throw, emits a closing note and rethrows the same error. The new `checkThrew` helper words it:
   - The nothing-to-change ending, recognised by the error's name `AutomationStudioReauthorNothingToChangeEnding`, closes as "The repair found nothing in the Flow to change" with status `succeeded`. This matches `wording/run-ending.ts`.
   - Any other throw closes as "Checking the proposed Flow — stopped" with status `failed`, and its message is not shown.
   - The error is read by name, not by a value import, which would risk an import cycle (the same reason `decisionFailed` reads by shape). The test pins the name to the real watch's error.
5. **t281's open edge: reversal ordering.** In `R/flow-draft/amendment/apply.ts`, a step kept by an `add`/`keep` after the decision has already withdrawn a step no longer runs `automationStudioFlowDraftDropReversals` mid-loop. It sets `reversalAfterCheck`, and the reversal runs once after the strand check. Before this, the reversal treated the drop as standing and took the toggle partner out, and the strand check then put the drop back, leaving the partner out with `cancels` and its acts lost. A keep that comes before any withdrawal still runs the reversal immediately, as before.

## Commands run and observed results

**Fail-first (each test run before its fix):**
- `npx vitest run .../flow-draft/amendment/tests/claim-refused.test.ts` -> `1 failed | 6 passed` (item 2, direct path). After the fix: `7 passed`.
- `npx vitest run .../llm/evidence-loop/tests/held-amendments.test.ts` -> `2 failed | 5 passed`:
  - item 1 failed with "expected spy to be called with arguments" (the judge was never asked);
  - item 2 (held) failed with "expected undefined to deeply equal [ObjectContaining…]".
  - After the fix: `7 passed`.
- `npx vitest run .../flow-draft/amendment/tests/drop-reversal.test.ts` -> `1 failed` (item 5: "expected ['kept','kept','kept',…] to deeply equal [Array(5)]"). After the fix: `5 passed`.
- `npx vitest run .../activity/tests/observer.test.ts` -> `2 failed | 32 passed` (item 4: only the "started" event was seen). After the fix: `34 passed`.
- Downstream, using `run-subset.mjs <abs domain dir> t292-w .../observed-state/tests/read-rows-keys.test.ts` and then `node --test` on the bundle -> `# pass 2 # fail 1` ("expected: 'read.extracted'"). After the fix: pass.

**Owning tests (Core, `--testTimeout=120000`, exact paths, run in groups because a single command line was too long):**

| Test folders | Result |
| --- | --- |
| `flow-draft/tests`, `flow-draft/amendment/tests` | 26 files, 295 passed |
| `llm/evidence-loop/tests`, `llm/decision-handlers/tests` | 37 files, 349 passed |
| `activity/tests`, `llm/repeat-guard/tests`, `llm/harness-options/tests` | 25 files, 265 passed |
| `flow-bootstrap/instructed-acts/tests`, `recovery/refuted-result/tests` | 20 files, 399 passed |
| `llm/tests`, `llm/node-tools/tests` | 50 files, 705 passed |

**Checks:**
- `node scripts/build-cache/cli.mjs fluxiq:check`:
  - first run: exit 2, from two TS2322 errors in my new observer tests (a sync/async union passed to `inScope`);
  - fixed by wrapping the calls in `async () => await …`;
  - rerun: exit 0.
- `node scripts/build-cache/cli.mjs structure-audit:check` -> `structure-audit: passed (276 warning(s), 349 baselined)`, exit 0.
- `pnpm.cmd build` (Core root) -> exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> "core-build: … is current with its source", exit 0.
- Downstream `node scripts/structure-audit.mjs` -> `structure-audit: passed (175 warning(s), 118 baselined)`, exit 0.
- Downstream, after the Core build: `read-rows-keys`, `observed-state-keys` and `tools` tests -> `# tests 19 # pass 19 # fail 0`. The scratch bundle directory was then removed.

## Not verified

- No Lab, browser or provider run, as the brief required.
- Not tested end to end:
  - that a live list read's answer reaches Core's `rerun-checked-rows.ts` with rows under `read.extracted`. The key comes from the domain's own `read-rows-keys.ts` comment and the existing Core function; this tree has no test that feeds a live read through Core.
  - that the activity UI (`src/ui/activity-action/`) renders the new `succeeded` and `failed` closing notes as intended. Its tests were not run.
- No authored documentation was updated. The brief did not ask for it, and the changes are internal wording and ordering.

## Open questions or contradictions found

- **Possible file overlap with t291.** The t291 brief owns `R/activity/**` for its page-pass words, and this brief names `R/activity/observer.ts`. My edit adds one helper (`checkThrew`) above `observeAutomationStudioEvidenceLoop` and a try/catch in its `checkCompletion` wrapper. If t291 also edits `observer.ts`, the merge needs care.
- **Edit outside the named file.** The `amendment.ts` caller edit is outside the file the brief named for gap 1. It is a one-line change and was needed so that the option reaches `settle`.
- **The nothing-to-change test is coupled to the error class name.** The note recognises the ending by the error's name string. If `nothing-to-change.ts` renames its error class, the observer test fails, which is intended.

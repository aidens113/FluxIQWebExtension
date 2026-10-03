# t252-w9-wiring: report

## Outcome

Done. All three brief items are implemented in the t252 Core tree (`C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`).
Nothing is committed. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## What changed and why

1. **`nodeOf` now reaches every place the build sends its steps again.**
   - `R/llm/loop-configuration.ts`: new loop input `nodeOf?: AutomationStudioFlowDraftDryRunGateInput["nodeOf"]`,
     with a doc comment. It is typed by indexed access, because `replay-span.ts` is not in the node-tools barrel.
   - `R/llm/evidence-loop.ts`: passes `nodeOf` to the tool set (line 240) and to the dry-run gate. The file was at
     exactly 800 lines, so the gate's spread shares the `lastingActs` line. A separate line put it at 801, which
     failed the audit's hard limit.
   - `R/llm/node-tools/run-flow.ts`: `RunFlowLoop.nodeOf` is handed on to `runAutomationStudioFlowDraftPart`.
     `loop-tools.ts` needed no edit, because its input type is `Parameters<typeof automationStudioLlmRunFlowBinding>[0]`.
   - `R/service.ts`: exactly two in-line insertions, with no reformatting:
     - `nodeOf: nodeDescriptions.definition` on the build's loop input (the call with `fullRunRequired: true`);
     - the same on the stopped round's `test` gate (`automationStudioFlowDraftDryRunGate({... lastingActs, nodeOf: nodeDescriptions.definition, signal })`).
   - New loop-level test `R/llm/node-tools/tests/run-flow-rows-in-loop.test.ts`, 2 tests. It uses a seeded draft:
     a list step, then a press repeated over it. The list's replay answers `outputs.records` with 3 rows.
     - With `nodeOf`, the press is sent once per row with `item` Ada/Ben/Cy, both in `core.run_flow` (`part.1...`) and
       in the dry run (`dryrun....`).
     - Without `nodeOf`, it is sent once with no item.
2. **`not_reached` for unexpanded members.**
   - `R/llm/node-tools/dry-run-gate.ts`, `notReached`: a written step is also refused when all of these hold:
     - its outcome has no `passes`;
     - it has no `withheldBy`;
     - its status is not `replayed`;
     - it sits inside a repeat span.

     Span membership comes from Core's own rule: `automationStudioFlowDraftConditionalStepIds` run over the draft with
     only its repeat routings kept (local helper `repeatedStepIds`). This adds no third copy of the span rule.
     The header comment is updated.
   - `R/flow-draft/full-run-required.ts`: the `not_reached` sentence now names both causes and what to do for each.
     - The list had no items in the test: run the listing where it returns items, or run the step once yourself.
     - The test could not go through the items (the listing did not run again cleanly, or gave back no items), so the
       repeat ran once on the explored item and the step did not pass there: make the listing run again cleanly
       (rerun it), or run the step once yourself.

     The header comment is updated. The wording stays domain-neutral, and the existing test that bans
     page/click/browser/url/site still passes.
   - Tests: 5 new in `dry-run-gate-loop.test.ts`, and 1 new in `flow-draft/tests/full-run-required.test.ts`.
     - Refused: no nodeOf and a failing press; rows that are not records and an unreproducible press.
     - Not refused: a written step that passed on the explored row; a recorded step that failed; a written step that
       is optional rather than in a repeat.
3. **Judge request re-screen.** `R/llm/harness/request-evidence-check.ts`, `sendableBuildTest` now screens three
   things for the declared keys:
   - each step's `observed` (as before);
   - each pass's `[observed, row]`;
   - each input's `test` value.

   An input's name is treated as Core's envelope, which matches w6's builder: it never withholds a name for being a
   denied key. 4 new tests are in `llm/harness/tests/request-evidence-check.test.ts`.

## Commands run and observed results

All vitest runs were from `packages/fluxiq`.

**Failing-first checks.** I disabled each new rule in turn, ran its test, then restored the file from a temp copy:
- The `unwalked` clause off: `dry-run-gate-loop.test.ts` gave `Tests 2 failed | 6 passed (8)`.
- The re-screen reverted to `observed` only: `request-evidence-check.test.ts` gave `2 failed | 7 passed (9)`.
- The tool-set `nodeOf` removed from `evidence-loop.ts`: `run-flow-rows-in-loop.test.ts` gave `1 failed`
  (`expected [ null ] to deeply equal [ 'Ada', 'Ben', 'Cy' ]`).
- The gate's `nodeOf` removed: the same failure.

**Test runs.**
- `npx vitest run R/llm/node-tools/tests R/flow-draft/tests R/llm/harness/tests R/llm/tests R/llm/evidence-loop/tests`
  -> `Test Files 107 passed (107)`, `Tests 1017 passed (1017)`.
- `npx vitest run R/llm/node-tools/tests R/llm/tests R/service/flow-bootstrap-commands/tests R/tests/service-bootstrap/tests R/tests/refuted-result/tests`
  -> `1 failed | 80 passed (81)` files, `1 failed | 749 passed (750)` tests.
  - The failure was `service-bootstrap/tests/adaptation.test.ts`, "bridges a generated proposal ID...". It ran for
    15275ms, which matches the test timeout.
  - Run alone (`npx vitest run R/tests/service-bootstrap/tests/adaptation.test.ts`), it gave `Tests 9 passed (9)`.
  - I read it as a timeout under the load of 81 files. I did not capture its error message.

**Checks.**
- `pnpm --filter fluxiq check`, run twice (the second after the final edit): no tsc output, and a build-cache line
  "stored in the shared store".
- `node scripts/structure-audit.mjs`:
  - First run: `FAIL [file-lines] .../llm/evidence-loop.ts: 801 lines exceeds the 800-line limit`. I fixed this as
    described in item 1.
  - Re-run: `structure-audit: passed (231 warning(s), 349 baselined)`. A new advisory: `dry-run-gate.ts` is 422 lines
    (advisory threshold 400).

## Not verified

- A live build, and the domain answering `outputs.records` to these wired calls.
- The service-level path: no service test exercises a repeat with `nodeOf` from `nodeDescriptions.definition`.
  - That the catalog entry is assignable is shown by tsc only.
  - That `nodeDescriptions` is in scope at both call sites is likewise shown by tsc only.
- The full Core suite (not run, per the rules).
- The adaptation test failure under load: its cause was not captured.

## Open questions or contradictions found

1. **`evidence-loop.ts` is at the 800-line hard limit.** Any further wiring there will need a split.
2. **`replay-span.ts` is not exported from `llm/node-tools/index.ts`.** I did not own the barrel, so I typed
   `nodeOf` by indexed access. The structure rule says a barrel in every directory, so the supervisor may want
   `replay-span.ts` added.
3. **Withheld members are exempt.** A written span member excused through `withheldBy` (held behind a lasting act) is
   not refused `not_reached`, although it also never ran. That is outside this brief's wording; flagging it for a
   decision.
4. **The pass label re-screen does not catch anything.** The label is a plain string, and the denied-key screen only
   matches object keys. Credential and locator shapes in it are already caught by the whole-summary screens.

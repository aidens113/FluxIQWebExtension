# t693 report: the repair is told what its condition did

## Outcome

Done, in both trees, with nothing committed. A list read now reports, for each condition, how many rows it kept and rejected, plus up to three values it read on the rows it kept. The domain passes that account to Core on the read's draft statement, and Core stores it on the draft step. When the model resends an identical rerun of that read, the `changes_nothing` advice now names any condition that left out no row and quotes the values it read. It no longer points at the act after the read in that case. The t690 page-loop hint and every other `changes_nothing` telling are unchanged.

## What changed and why

### How the account reaches Core

Core never reads a step's evidence. Every per-step fact the host gives Core (`reads`, `changed`, `toggle`) travels on the call's draft statement. Core parses that statement strictly, carries it onto `AutomationStudioFlowDraftStep`, and passes it to the feedback through `context.draftSteps`. I added `conditions` the same way. That made this the Core contract type the brief referred to, but it touches more Core files than the brief listed (see Open questions).

### Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t693/!FluxIQWebExtension`)

- **`apps/extension/src/content/extraction/item-filter.ts`**
  - The filter takes an optional fifth argument, `kept: string[][]`.
  - For an item every condition held of, it adds each condition's non-empty tested value to that condition's list. Each value is added once, up to `WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST` (3).
  - The existing rejection report (`seen`, observations, rejections) is unchanged.
- **`list-reader.ts`**: builds `keptValuesEach` and reports `conditions.keptValues`. The values are not carried across documents in the checkpoint, so a continued read reports its own document's values.
- **`filtered-answer.ts`**: added the type field and its docs.
- **`domain/src/actions/extraction/kept-values.ts`** (new)
  - The wire type, the bound, and a validator: one list per condition, at most 3 entries, each a non-empty string.
  - `summary.ts` maps it; a malformed value drops the whole summary, as for `seen`.
  - Exported from the barrel. `actions/types.ts` re-exports the bound for `domain/client`.
- **`domain/src/runtime/llm-evidence/node-run/list-read/condition-account.ts`** (new)
  - Builds the draft statement's `conditions` from the read's own summary.
  - Per condition: `kept` is `applied - rejected[i]`, plus `rejected` and `keptValues`.
  - Returns nothing for other nodes and for reads with no conditions.
- **Wiring**
  - `run.ts` sends `conditions` on a successful read.
  - The other `present<WebNodeDraftStatement>` sites in `run.ts` and `written-step.ts` state `conditions: undefined`.
  - `capture.ts` gives the domain's copy of the draft type a `conditions` field.
- **Docs**: added a paragraph to `docs/architecture/web-capabilities.md` (list extraction section).

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t693/!FluxIQ`)

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **`flow-draft/step.ts`**: new generic type `AutomationStudioFlowDraftStepCondition = { kept; rejected; keptValues: string[] }`, and `conditions?` on the step.
- **`flow-draft/condition-account.ts`** (new): the parser.
  - The account is positional, so one malformed entry withholds the whole account; the call is never refused for it.
  - Each value passes `automationStudioFlowDraftControlWords`: plain text, shown in the call's own evidence, cut at 120 characters.
  - At most 3 values are kept per condition.
  - Exported from the `flow-draft` barrel.
- **`llm/evidence-loop-decision.ts`**: `conditions` is added to the exact key list and parsed only when the effect is `observe`. Before this, a host sending the key would have had its whole statement refused (`draft.unknown_key`).
- **`llm/evidence-loop/tool-execution.ts`** and **`llm/evidence-loop/call-record.ts`**: the draft type gets the field, and the record carries it onto the step.
- **`llm/repeat-guard/narrowed-nothing.ts`** (new), exported from the `repeat-guard` barrel.
  - When at least one condition has `rejected === 0` and `kept > 0`, it returns the advice: which condition (numbered in argument order), how many rows it held of, the quoted values it read (or "it read no value on any of them"), that as written it narrows nothing, the rerun form to send, and "if every row is right, that condition is not needed: leave the step and go on".
  - It uses no web or DOM words; Core's `web-vocabulary` rule passes.
  - It lives in `repeat-guard` because `llm/` is at its 25-file limit, and that directory's barrel already covers "what the model is told when the same call is refused".
- **`llm/draft-amendment-feedback.ts`**
  - The `changes_nothing` branch of `nextStep` now returns `automationStudioLlmEvidenceNarrowedNothing(listing) ?? (loop ? readAfterAct : <the old text with rowAct>)`. The t690 `pageLoop` and `rowAct` are untouched.
  - The step type gains `conditions?`, and the header and docblock lines are updated.
  - The file is now exactly 800 lines, the hard limit.

## Commands run and observed results

**Core**
- `npx tsc --noEmit -p .` in `packages/fluxiq`: no output (clean). Run after the code changes and again after the final test edits.
- `npx vitest run src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-draft`: `Test Files 246 passed (246)`, `Tests 2400 passed (2400)`.
  - This ran before I moved the feedback test into `repeat-guard/tests`. No source changed after it.
- After the move, `npx vitest run .../llm/repeat-guard/tests/narrowed-nothing.test.ts .../flow-draft/tests/condition-account.test.ts`: `Tests 10 passed (10)`.
- With the fix off, the feedback test file (old name, same tests) failed: `3 failed | 1 passed (4)`.
  - The fix was turned off by replacing the `narrowedNothing` call with `undefined` and blanking the `conditions` parse.
  - The one that still passed is the regression guard: a read with no idle condition keeps the old telling.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (395 warning(s), 1155 baselined)`, exit 0.
  - An earlier run failed on `as-never` and `llm/tests` at 26 files. Both were fixed: the cast was removed and the test was moved.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (needed so downstream compiles against the new Core): `packages/fluxiq build: Done`.

**Downstream**
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `domain`: no output (clean).
- `node scripts/check-extension.mjs` in `apps/extension` (typecheck of both projects plus the bundle check): `exit=0`.
- `DOMAIN_TEST_BUILD_LABEL=t693 node scripts/test-domain.mjs actions/extraction/tests runtime/llm-evidence/node-run/tests runtime/llm-evidence/node-run/list-read/tests runtime/llm-evidence/tests`: `# tests 545 # pass 545 # fail 0`.
- After moving the end-to-end test into `run.test.ts`: `... node-run/tests/run.test node-run/list-read/tests actions/extraction/tests/kept-values`: `# tests 29 # pass 29 # fail 0`.
- Fix-off checks:
  - Summary mapping and `run.ts` statement off: `kept-values` test 1 and the statement test failed (`# fail 2`).
  - `run.ts` statement off: `run.test` new test `not ok 23`.
- `EXTENSION_TEST_BUILD_LABEL=t693 node scripts/test-extension.mjs content/extraction`: `# tests 300 # pass 300 # fail 0`.
  - On the first run, four `list-reader.test.ts` deep-equal assertions failed because `conditions` now carries `keptValues`. I added the field to those expectations.
- `content/extraction/tests content/actions/tests/extract-list`: `# tests 268 # pass 268 # fail 0`.
- Fix-off check: with `noteKept` disabled, `item-filter` new tests `not ok 10` and `not ok 11` (`# fail 2`).
- `pnpm structure:check`: `structure-audit: passed (202 warning(s), 639 baselined)`.
  - An earlier run failed because `node-run/tests` had 26 files. I moved the end-to-end test into the existing `run.test.ts`.

## Not verified

- No live or browser run. I did not exercise the real content script on a page, the background relay of `conditions.keptValues`, or a real model reading the new advice.
  - `content/actions/extract-list.ts` `conditionsOf` spreads the report, so `keptValues` should reach the summary, but no test covers that hop end to end in the extension.
- Whole suites were not run, per the brief.
- That a repair lane's carried draft keeps `conditions`: `automationStudioFlowDraftStepCopy` uses `structuredClone`, so it should, but I did not test it.

## Open questions or contradictions found

1. **Files edited beyond the brief's list.** Core:
   - `flow-draft/step.ts`, `flow-draft/condition-account.ts`, `flow-draft/index.ts`
   - `llm/evidence-loop-decision.ts`, `llm/evidence-loop/tool-execution.ts`, `llm/evidence-loop/call-record.ts`
   - `llm/repeat-guard/{narrowed-nothing.ts,index.ts}`

   Downstream:
   - `domain/src/runtime/llm-evidence/{capture.ts,node-run/run.ts,node-run/written-step.ts,node-run/list-read/*}`
   - `domain/src/actions/types.ts`

   These are the contract path a per-step host fact must take. The supervisor should confirm that no parallel worker owns them.
2. **Lockstep landing.** Core's statement key list is exact. The downstream `conditions` key must not reach `dev` without the Core change, or every list read's draft statement is refused whole.
3. **Count bound versus the 2026-09-30 user rule.** The brief asked for bounded values, so each condition carries at most 3 kept values. That rule says "no limits on elements passed to model". Each value is kept whole downstream; Core cuts each one at 120 characters through the control-words screen.
4. **`draft-amendment-feedback.ts` is at exactly 800 lines**, the file-lines limit. The next addition to it needs a split first.
5. **Placement of the feedback test.** `llm/tests` was full (25 files), so the loop and feedback tests sit in `llm/repeat-guard/tests/narrowed-nothing.test.ts`. Their main subject is there, and they drive it through `../../draft-amendment-feedback.ts` and the loop.

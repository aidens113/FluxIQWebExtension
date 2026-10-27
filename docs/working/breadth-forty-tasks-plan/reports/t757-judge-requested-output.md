# Report: t757-judge-requested-output

Worker: `t757-judge-requested-output` (worker-heavy). Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t757/!FluxIQ`, downstream `C:/Users/osrs_/FluxStuff/fxwork/t757/!FluxIQWebExtension`, branch `task/t757-judge-requested-output` on both. Nothing committed. Only Core files changed, plus this report.

## Outcome

Partial. The gate is built and tested in every owner the brief allows:

- the typed declaration on the task spec;
- the checklist carry;
- the held yes in verify, for both the build-trial path and an explicit runtime path;
- the honest-empty rule;
- the label on executed scalar outputs.

Two things are still missing before it can fire live.

1. **Wiring in forbidden areas.** Without three small edits, no live build ever sets the declaration and no judge receives it. Two are in `project-agents/supervisor/` (the tool schema and the guidance). One is in `service/project-build/task-checklist.ts` (the checklist copy). The brief reserves both areas for t751. The exact edits are under Open questions.
2. **The selected item's format fact.** I did not build it. Core has no domain-neutral typed source for it.

## What changed and why

### 2026-10-27 Evidence: which judges said yes

- I read the saved packets under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-18/run-mveba82m-fd0616dc/steps/`. I printed only their structure and counts.
- Step 0049 is the runtime check of the finished run (`run-outcome.ts`, then `verify.ts`). It had no `taskChecklist`.
- Steps 0038 and 0039 are the build's trial judge pair. Their packet carries `taskChecklist`.
- All three answered `yes` at 0.9 with `totalRecordCount 0` and `recordSetCount 0`.
- The checklist's part `p1` had `goalFacts` and `lastingActs: []`. It had no typed result shape.
- So the trial pair is where the declaration can stop promotion. If the trial judges had held their yes, the Flow would not have been promoted, and step 0049 would never have run.

### 2026-10-27 Unit 1: the requested-output obligation

**Declaration.** No typed result-shape field existed. I searched the task spec, the structure plan, the subflow interface, the Flow instruction type and the summary contracts. So I added the narrowest one:

- File: `project-agents/contracts/task-spec.ts`.
- Field: optional `answer?: { kind: "records"; columns: string[] }` on a part.
- Columns must be distinct, at most 50, each non-empty and at most 200 characters.
- An empty `columns` list means the request names no columns.
- The digest skips undefined values, so a spec without the field keeps its digest.
- `supervisor/plan-input.ts` passes `taskSpec.parts` straight to this parser, so the field reaches the record without touching that file. I read it, I did not edit it.

**Checklist carry.**
- `result-verification/contracts/task-checklist.ts`: the `asked` entry gets optional `answer`.
- `build-test/task-checklist.ts`: the part type gets optional `answer`, and `automationStudioBuildTestSummaryWithTaskChecklist` copies it.
- A new label sentence is added only when some part declares an answer, so existing packets are byte-identical.
- The sentence is generic and passes the existing teach-to-test screen. I extended that screen to cover the new field names.

**Gate.** New directory `result-verification/requested-output/`:

| File | What it does |
| --- | --- |
| `owed.ts` | Reads the obligation from the caller's `requestedOutput`, or else from the checklist parts' `answer`. Never from the request's words. |
| `honestly-empty.ts` | Decides when an empty answer is honest (rule below). |
| `missing.ts` | Decides whether the owed records are missing, and writes Core's sentence. |
| `held-yes.ts` | Turns a held yes into `unsure` (details below). |
| `index.ts` | Barrel, with a header explaining the run and the design. |

- `missing.ts` uses stored rows: the run's `totalRecordCount`. For a build test it uses the `buildTest.stores` answer rows. If stores were not worked out, nothing is held.
- `held-yes.ts` returns `unsure` with:
  - basis `model`, so a failure record is written, a finished run fails and no trial is promoted;
  - code `core.result.requested_output_missing` (added to `verdict/codes.ts`);
  - `requestedOutputMissing: { parts: [{ part, columns }], said }` (added to `contracts/verification.ts`);
  - the reason, Core's sentence naming the parts and columns;
  - the yes's `answeredReading`, `verdicts` and `calls`, kept.

**Honest empty, the rule.** An empty answer stays a yes only when one of these holds:
- a read whose own record shows its list ended kept nothing, and did not answer with unfiltered rows; or
- every read showed its list ended, and a record set's processing (or a build test's would-be store) collected rows and kept none.

"List ended" reuses the existing judge-paging rule. I moved it into `read-account/stop.ts` as `automationStudioResultReadObservedEnd`, and `judge-paging.ts` now calls it. I added no new file there, because `read-account/` is already at the audit's 25-file limit. `stop.ts` now exports two functions; the audit allows up to 15 values per file.

**verify.ts.**
- New optional `requestedOutput` on the request, for a caller that holds the declaration outside the checklist.
- The held-yes check is applied to the settled outcome on both return paths.
- A first yes that is held is not asked again to confirm it, which saves one paid call per build trial. Nothing the model says can change what the run stored.
- `firstAskConfirmed` is never set on a held outcome.

**Tests.** All were written first and observed failing before the implementation:

| File | What failed before the fix |
| --- | --- |
| `project-agents/contracts/tests/task-spec.test.ts` (one added case) | Dev refuses the field `project.unknown_field`. |
| `result-verification/tests/requested-output-route/tests/held-yes-route.test.ts` (5 cases) | With verify unwired, the zero-record yes stood in both the checklist case and the explicit `requestedOutput` case. The non-empty yes, honest empty and action-only cases fail on dev only because the module they import does not exist. |
| `result-verification/build-test/tests/task-checklist.test.ts` (one added case, screen extended) | The answer was not carried. |
| `result-verification/build-test/tests/judge-requested-output.test.ts` (2 cases) | Not run red. Written after the gate: the build-test judge gives `unknown`, its `why` names `part p1 (columns: name, year)`, after one call. A part with no declaration gives `yes` after two calls. |
| `result-verification/requested-output/tests/requested-output.test.ts` (7 cases) | Not run red. Written after the module. Covers: owed, honest-empty variants (truncated, page bound, no stop word, unfiltered, first page with no next control), build-test stores, wording, and non-yes verdicts passing through unchanged. |

The fixtures use a library and a museum, not an auction.

UNIT READY: these 22 Core paths, all under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `project-agents/contracts/`
  - `task-spec.ts`
  - `tests/task-spec.test.ts`
- `result-verification/`
  - `contracts/requested-output.ts`
  - `contracts/index.ts`
  - `contracts/task-checklist.ts`
  - `contracts/verification.ts`
  - `verdict/codes.ts`
  - `read-account/stop.ts`
  - `read-account/judge-paging.ts`
  - `requested-output/index.ts`
  - `requested-output/owed.ts`
  - `requested-output/honestly-empty.ts`
  - `requested-output/missing.ts`
  - `requested-output/held-yes.ts`
  - `requested-output/tests/requested-output.test.ts`
  - `verify.ts`
  - `build-test/task-checklist.ts`
  - `build-test/tests/task-checklist.test.ts`
  - `build-test/tests/judge-requested-output.test.ts`
  - `tests/requested-output-route/tests/held-yes-route.test.ts`

### 2026-10-27 Unit 2: executed scalar outputs labelled in the judge packet

- **Source.** Core's convention for a node's single value is `outputs.value`. A read's answer lands there through its data port's `resultPath` (`executor/node-execution/result-path-outputs.ts`; the downstream extract value port is `result.extracted`).
- **Module.** New `result-verification/returned-values.ts`. It lists the `outputs.value` of each succeeded attempt, by `nodeId` and in run order, when the value is a string, number or boolean. Beside the list it puts Core's sentence: "...A returned value is handed on to later steps: it is not a stored record, and recordSets alone hold the records the run stored."
- **Screening**, the same as the other run values in the summary:
  - no values at all without a denied-keys declaration;
  - the run's own withheld marker and credential-shaped values are dropped;
  - a locator is rewritten out of a value;
  - each of these sets `withheld`.
- **Placement.** `result-summary.ts` adds it as `returned`, after `flowShape`, so the cached prefix (`startView` first) is unchanged. The type is in `contracts/run-result-summary.ts`.
- **Reaches the judge.** The test sends the summary through `verify` with a scripted provider. The request's `resultSummary.returned` equals the summary's, so the harness neither drops nor refuses it.
- **context-packet.ts was not changed.** The packet already carries `resultSummary` whole. `recentActions` stay outputs-free, as their compact contract intends.
- **Test.** `result-verification/tests/judge-sees-returned/tests/returned-values.test.ts`, 4 cases. Three failed before the fix; the fourth now asserts the section exists.
- **Test placement.** Both route tests sit under `tests/<feature>/tests/`, the existing pattern (`reask-route`, `first-ask-route`). Left loose, `result-verification/tests/` had 27 source files, over the audit's limit of 25.

UNIT READY: these 4 paths, under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`.

- `contracts/run-result-summary.ts`
- `returned-values.ts`
- `result-summary.ts`
- `tests/judge-sees-returned/tests/returned-values.test.ts`

### 2026-10-27 Docs

- `docs/architecture/automation-studio.md`: one paragraph under "Judging a finished run's result, including an empty one", covering both units.
- `pnpm docs:reference` regenerated `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`. The diff only adds the new public declarations and the extended checklist description.

UNIT READY (after units 1 and 2):
- `docs/architecture/automation-studio.md`
- `docs/reference/framework-reference.md`
- `packages/fluxiq/docs/reference/framework-reference.md`

## Commands run and observed results

All runs were in the t757 trees with `FLUXIQ_BUILD_CACHE_DIR=off`. No model calls, no live or paid runs, no full suites.

**Core typecheck.** `pnpm check` in `packages/fluxiq`:
- With the default heap it died: "FATAL ERROR: Ineffective mark-compacts near heap limit", exit 134. Free RAM was 4.08 of 11.93 GB, so this was not the OneDrive leak.
- With `NODE_OPTIONS=--max-old-space-size=6144` it exited 0 with no diagnostics. It ran twice: before the move and after the final edits.

**Grouped runner, final run.** Command:

```
pnpm test src/.../result-verification src/.../project-agents/contracts src/.../service/candidate-trial src/.../llm/harness src/.../project-agents/single-subflow src/.../recovery/refuted-result src/.../service/datasets
```

- parallel: `Test Files  1 failed | 247 passed (248)`, `Tests  1 failed | 1988 passed (1989)`.
- real-sql: `Test Files  4 passed (4)`, `Tests  32 passed (32)`.
- The one failure is `recovery/refuted-result/tests/brief-checked.test.ts`, "carries every checked line...", with `expected 0 to be greater than 0`. It was already failing at the branch's base (proof below).
- An earlier run covering only result-verification and project-agents/contracts: parallel `Test Files 148 passed (148)` / `Tests 1254 passed (1254)`, real-sql `1 passed (1)` / `3 passed (3)`.
- The log shows every new and changed test file passing: held-yes-route 5, requested-output 7, returned-values 4, judge-requested-output 2, task-checklist 8, task-spec 14.

**Grouped runner, read-only extra run.** `pnpm test src/.../project-agents src/.../service/project-build`:
- parallel `Test Files 90 passed (90)` / `Tests 595 passed (595)`.
- real-sql `Test Files 2 failed | 6 passed (8)` / `Tests 2 failed | 44 passed (46)`. The failures:
  - `project-build-facade.test.ts`, "keeps the assembled Flow as a draft when the whole trial is judged no": expected `trial.verdict "no"`, received `"not_judged"`.
  - `project-build-time-limit.test.ts`: expected `candidate.trial_judged_no`, received `candidate.trial_not_judged`.
- Both were already failing at the branch's base (proof below).

**Baseline proofs.**
- I copied each modified file to the scratchpad (`t757-backup`, `t757-backup2`), wrote back its `git show HEAD:<path>` content, ran the failing tests, then restored my copies.
- `git diff --stat HEAD -- <files>` printed nothing, so the content matched HEAD. Its only output was LF-to-CRLF warnings, which also explains an earlier spurious `M` in `git status`.
- With all 15 modified files at HEAD, all three tests above failed the same way.
- After each restore, `cmp` showed every file equal to my backup.

**Prompt contract tests.** The three in `scripts/task/contract/list.mjs`: `Test Files 3 passed (3)`, `Tests 68 passed (68)`.

**Core repo root.**
- `pnpm docs:check`: first run failed with "framework-reference.md is stale". After `pnpm docs:reference` ("Wrote ... (4139 public declarations)") it printed "Deterministic framework reference is current" and exited 0.
- `pnpm structure:check`:
  - First run failed: `FAIL [directory-files] .../result-verification/tests/: 27 source files exceeds the 25-file limit`.
  - After the move: `structure-audit: passed (443 warning(s), 1152 baselined)`, exit 0.
  - The only warning on a touched file is the advisory `verify.ts: 491 lines`; it was already 470.
- `git diff --check`: exit 0.

**Core library build, run so downstream checks could start.** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`: exit 0. The output is untracked.

**Downstream.**
- `pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0. The first attempt was refused by the Core-currentness guard until Core was rebuilt.
- `pnpm --filter @fluxiq-web-extension/test-contracts check`: exit 0.
- `pnpm structure:check`: `structure-audit: passed (222 warning(s), 616 baselined)`, exit 0.

## Not verified

- **No live, Lab or browser run.** No paid model call checked the effect on a real build.
- **A real `write_plan` reply.** The supervisor model cannot emit `answer` until the schema edit lands, and the field is then optional, so a build that leaves it out is not gated.
- **The finished-run path.** `run-outcome.ts` does not yet pass `requestedOutput`: there is no port, and no persisted declaration on the Flow to read. So a Flow promoted before this change, or by a build that declared nothing, is judged as before. The explicit-`requestedOutput` route is tested at the `verify` level only.
- **The selected item's format fact.** Not built. Core has no domain-neutral typed source for "the item this step opened is of kind X". The `returned` section now ties each read value to the step that returned it, but it does not say what kind of item was opened.
- **Other packages.** The downstream extension package and domain were not typechecked. Domain does not consume the changed contracts. The extension e2e spec `social-read-discloses-kept.spec.ts` names `AutomationStudioResultVerification`, and the changes are additive optional fields.
- **Tests not shown red.** `requested-output.test.ts` and `judge-requested-output.test.ts` were written after the module, so I never saw them fail.

## Open questions or contradictions found

1. **The brief contradicts itself.** It asks to "add one [field] to the plan contract", but the model-facing schema and the judge's checklist copy are in forbidden areas. Three edits, all small, are needed after t751:
   - **`project-agents/supervisor/tools.ts`**, in the task-spec part `properties` (the part keeps `additionalProperties: false`, and `answer` is not added to `required`). Add:

     ```
     answer: { type: "object", properties: { kind: { type: "string", enum: ["records"] }, columns: TEXTS }, required: ["kind", "columns"], additionalProperties: false }
     ```
   - **`project-agents/supervisor/guidance.ts`**: one generic sentence in `WRITE_PLAN` and the step-1 text. For example: a part whose answer is rows of values declares `answer: {kind: "records", columns: [the columns the person names, in their order]}`; a part that only does something has none. This is model-facing, so it needs the prompt-contract tests and any supervisor guidance pins.
   - **`service/project-build/task-checklist.ts`**, in `checked()`. Add:

     ```
     ...(part.answer ? { answer: { kind: part.answer.kind, columns: [...part.answer.columns] } } : {})
     ```

   With these three in place, the trial pair (0038/0039) would get `unknown` with the finding, and nothing would be promoted.
2. **The finished-run judge (0049's path) needs a decision.** It has no task spec. Either the build persists the declared answers with the promoted Flow (in `service/project-build` or `supervisor/assembly.ts`, both forbidden), or `run-outcome.ts` gets a port reading the Flow's build record, passed as `requestedOutput`. `verify` already accepts it.
3. **Amendments.** `project-agents/amendment/part-change.ts` does not count a changed `answer` as a change to a part. It is unclear whether changing a part's declared answer should drop a carried proposal. I did not change it.
4. **One-page empty searches are held.** A search showing "no results" on one page with no next control is not an observed end under the existing paging rule, so such an empty answer is held `unsure` when the part declares records. That matches the brief's wording ("read to its end"), but it may be stricter than wanted.
5. **Already failing at the branch's base, unrelated to t757.** These should be owned by whoever broke them:
   - `recovery/refuted-result/tests/brief-checked.test.ts`;
   - `service/project-build/tests/project-build-facade.test.ts` (the whole-trial-no case);
   - `service/project-build/tests/project-build-time-limit.test.ts`.
6. **The heap.** `pnpm check` in `packages/fluxiq` needs more than node's default heap on this machine. Other workers will hit the same exit 134.

# t194-w20: a working click refused as `tool_result_invalid` (root cause)

## Outcome

Done. The cause is the top-level member **`clearedWait: { waitedMs: 9208 }`** on
`search2`'s result. The reload is incidental. The click landed on a robot check
that cleared by itself after 9.2 s. The web domain reports that as
`clearedWait` beside `resultCode`
(`domain/src/runtime/llm-evidence/node-run/cleared-wait.ts:25`). Core's exact
key list did not include it (Core
`runtime/llm/evidence-loop-decision.ts:73`, before the fix), so
`exactKeys` failed and the parse returned `undefined`.

The domain's copy of the list, `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`
(`domain/src/runtime/llm-evidence/capture.ts:283`), already contained
`clearedWait`. Its test `node-run/tests/cleared-wait.test.ts:20` claims "Core's
reader has learned clearedWait", but Core's list never did. t191-r6's report
flagged it: `t191-r6-wd-cleared-wait.md:126-129`, "I did not see the Core
change". Nothing enforces that the two lists match.

`search3` met no check, carried no `clearedWait`, and was accepted. That
explains the difference between the two calls.

## What changed and why (Core tree `fxwork/t194/!FluxIQ`, nothing downstream)

- `runtime/llm/evidence-loop-decision.ts`
  - **The fix:** `clearedWait` is added to the key list. Like `routeState`, the
    parser accepts it but does not read it. The activity observer reads it
    instead (`activity/ask/waited-out.ts`).
  - The list is now an exported constant,
    `AUTOMATION_STUDIO_LLM_EVIDENCE_TOOL_EXECUTION_KEYS`, so a caller can hold
    its own list to it.
  - The parse is split into one private reader, `readToolExecution`. It returns
    either `{result}` or `{refused: <check>}`, and runs the same checks in the
    same order as before.
  - `automationStudioLlmEvidenceParseToolExecutionResult` keeps its signature.
    `replay-draft.ts` and the tests still use it.
  - New: `automationStudioLlmEvidenceToolResultInvalidCode(value, effect)`
    returns `llm_evidence_loop.tool_result_invalid.<check>`, or nothing when the
    value reads.
  - `readCallRecord` now says which draft check failed.
  - `exactKeys` takes a `readonly string[]`.
- `runtime/llm/tool-failure.ts`
  - A closed vocabulary, `AutomationStudioLlmEvidenceToolResultCheck`, with 14
    entries: `not_json`, `unknown_key`, `evidence_not_json`,
    `effect_applied_not_boolean`, `targets_unchanged_not_boolean`,
    `result_code_not_code`, and `draft.{not_object, unknown_key, action_id,
    input, ran_with, effect, proposes, replay}`.
  - `AutomationStudioLlmEvidenceToolFailureCode` is widened with
    `` `llm_evidence_loop.tool_result_invalid.${check}` ``. The bare code is
    kept as a fallback.
  - A refusal names the check, never the member's name or value.
- `runtime/llm/evidence-loop.ts`: 7 lines, my only shared edit.
  - Both failure call sites (the first look and a decided call) keep the raw
    return in `let ran` and pass
    `automationStudioLlmEvidenceToolResultInvalidCode(ran, effect) ?? "llm_evidence_loop.tool_result_invalid"`
    in place of the bare code.
  - **Why this file had to change:** it is the only place that holds both the
    raw result and the code choice. `decision-handlers/failed-call.ts` already
    carries `code` unchanged to the model's failure entry, the trace row
    `resultCode`, the history row and the draft step. So no other file needed
    editing, and `failed-call.ts` was not touched.
  - **Note:** a concurrent worker is also editing this file (the cost purse:
    `automationStudioLlmEvidenceLoopPurse` and others). Our hunks are separate.
    The supervisor must integrate them together.
- `runtime/llm/tests/evidence-loop-tool-failure.test.ts`, which already holds
  this parse's tests:
  - Reproduction: `search2`'s real shape, with every top-level and draft
    member kept and the page cut to 2 elements, is read with its evidence and
    draft. The same result without `clearedWait` is read too.
  - Every member of that shape is in the exported list.
  - 14 table rows, one per check, assert the exact code, that it is
    closed-code-shaped, and that it carries no caller text.
  - Loop level:
    - a result with an unknown member shows
      `llm_evidence_loop.tool_result_invalid.unknown_key` on the trace row, the
      model's failure entry and the history row, and no private text;
    - a reload click carrying `clearedWait` runs as `web.action.succeeded`, and
      the model sees its evidence;
    - the old test that pinned the bare code now expects `.result_code_not_code`.
  - I first wrote these tests as a new `tests/evidence-loop-decision.test.ts`.
    That took `llm/tests/` to 26 files, over the audit's limit of 25, so I
    merged them into this file.

## Commands run and observed results

- **Before the fix**, a scratch vitest (scratchpad `w20-before.test.ts`) fed
  the real dumped results from
  `test-runs/instances/t194-slot-3/decision-dumps/build-2026-10-01T05-17-13-582Z-31824.jsonl`
  to the unmodified parse. It printed
  `{"s2":false,"s3":true,"s2WithoutClearedWait":true,"s2WithoutReloadType":false,...}`
  and `s2Keys` ended with `"clearedWait"`. The test failed as expected.
- **After the fix**, the same probe printed `{"s2":true,"s3":true,...}` and
  reported `Tests 1 passed (1)`.
- `heavy.sh ... npx vitest run <the two test files>`: `Test Files 2 passed (2)`,
  `Tests 32 passed (32)`. After the merge, the single file gave
  `Test Files 1 passed (1)`, `Tests 32 passed (32)`.
- `heavy.sh ... npx vitest run src/programs/automation-studio/runtime/llm`
  (from `packages/fluxiq`): `Test Files 90 passed (90)`, `Tests 805 passed (805)`.
  This ran while the separate test file still existed.
- `heavy.sh ... npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: exit 0, no
  output.
- `heavy.sh ... node scripts/structure-audit.mjs` (Core root):
  - First run: 2 violations. One was mine: `llm/tests/` at 26 files, fixed by
    the merge.
  - After the merge: 1 violation,
    `[file-lines] runtime/service.ts: 4506 lines ... Baseline 4505`.
    `service.ts` is unmodified in the working tree (`git status`), so this is
    already in HEAD and not from this brief.

## Not verified

- The full llm suite and tsc were not re-run after the merge into one test
  file, or after the concurrent worker's later edits to `evidence-loop.ts`.
  Only the merged file was re-run (32 passed).
- Core's dist was not rebuilt (brief). **Live runs load Core from dist, so the
  fix takes effect in the Lab only after a Core dist rebuild.**
- No Lab or live run (user's stop). The behaviour was verified against the
  run's dumped result only.
- Downstream suite and audit were not run, because there were no downstream
  edits.

## Open questions or contradictions found

1. **Nothing enforces that the two key lists match.** That gap is the root
   cause, and it will recur with the next key (`assumed` is queued behind it,
   `name-assumption.test.ts:165`). Suggested follow-up, in files I did not own:
   - Re-export `AUTOMATION_STUDIO_LLM_EVIDENCE_TOOL_EXECUTION_KEYS` from the
     `fluxiq/automation-studio` barrel.
   - Make downstream
     `domain/src/runtime/llm-evidence/tests/name-assumption.test.ts` (or
     `node-run/tests/cleared-wait.test.ts`) assert that
     `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` is a subset of Core's list,
     imported from `fluxiq`. It needs a Core dist rebuild.
   - That directory belongs to t223, so I wrote no downstream diff.
2. Core's `AutomationStudioLlmEvidenceToolExecutionResult`
   (`runtime/llm/evidence-loop/tool-execution.ts`, not mine) still lacks
   `clearedWait?: { waitedMs: number }`. It compiles because the observer reads
   the member defensively. Adding the member would document it.
3. The model's failure instruction for a refused result still says "This call
   failed and returned no evidence". For this case that is wrong, because the
   call worked and its result was unreadable. I left the text unchanged because
   it is prompt wording.

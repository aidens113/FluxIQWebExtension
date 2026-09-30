# t189-wB1: decision history (pure modules)

## Outcome

Done. `R/llm/decision-context/` (R = `packages/fluxiq/src/programs/automation-studio/runtime`, Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t189/!FluxIQ`, branch `task/t189-decision-context`) now holds a recorder, a
signature function, a closed-code filter for refusal feedback, and the `core.evidence_history` entry with its
compression ladder. None of it is wired into the loop yet, and `llm/index.ts` does not export it.

## What changed and why

New source files, one exported thing each (types aside):

| File | Export | Role |
| --- | --- | --- |
| `decision.ts` | types only | decision union, record, repeat, dry run, amendment refusal |
| `signature.ts` | `automationStudioLlmDecisionContextSignature` | canonical JSON of what the model asked for (reuses `automationStudioLlmEvidenceCanonicalJson`) |
| `closed-code.ts` | `automationStudioLlmDecisionContextClosedCode` | `/^[a-z0-9_.:-]{1,100}$/i` check that every string on a row passes |
| `closed-detail.ts` | `automationStudioLlmDecisionContextClosedDetail` | closed codes and integers from `refused()` feedback |
| `recorder.ts` | `AutomationStudioLlmDecisionContextRecorder` | one row per decision, with repeat counting |
| `history-tool-id.ts` | `AUTOMATION_STUDIO_LLM_EVIDENCE_HISTORY_TOOL_ID = "core.evidence_history"` | the entry id (the old one in `context-window.ts` is still there, for the wiring worker to remove) |
| `group.ts` (internal) | `automationStudioLlmDecisionContextGroup` | record -> row cells, role, identity at full and codes detail |
| `compression.ts` (internal) | `automationStudioLlmDecisionContextTellings` | generator over the ladder's tellings |
| `entry.ts` | `automationStudioLlmDecisionContextEntry` | picks the first telling within `maxBytes`, falling back to the least form |
| `index.ts` | barrel | exports everything above except `group.ts` and `compression.ts` |

Tests, in `R/llm/decision-context/tests/`: `recorder.test.ts`, `signature.test.ts`, `closed-detail.test.ts`,
`entry.test.ts` (grouping, sameAs, closed-code filtering, amendment and dry-run detail), `compression.test.ts`
(every rung, the 64-decision cases, no refusal lost). There is also a shared builder, `history-fixtures.ts`.
I did not touch `recorded-runs.ts` or `recorded-windows.test.ts`.

### Exported API the wiring worker calls

```ts
// signature.ts
type AutomationStudioLlmDecisionContextSignatureInput =
  | { kind: "tool_call"; toolId: string; input: JsonObject }
  | { kind: "complete"; result: JsonObject }
  | { kind: "amend_draft"; amendments: readonly AutomationStudioFlowDraftAmendment[] }
  | { kind: "unusable"; issueCodes: readonly string[] };
function automationStudioLlmDecisionContextSignature(decision: AutomationStudioLlmDecisionContextSignatureInput): string;
// The loop's own AutomationStudioLlmEvidenceLoopDecision fits this type directly (callId and usage are ignored).

// recorder.ts
class AutomationStudioLlmDecisionContextRecorder {
  record(iteration: number, decision: AutomationStudioLlmDecisionContextDecision): AutomationStudioLlmDecisionContextRepeat | undefined;
  repeats(signature: string, draftRevision?: number): AutomationStudioLlmDecisionContextRepeat; // lookup without recording
  records(): readonly AutomationStudioLlmDecisionContextRecord[];
}
type AutomationStudioLlmDecisionContextRepeat = { times: number; iterations: readonly number[] }; // this one included, oldest first
// record() throws when the iteration is not a non-negative integer or is earlier than the last one recorded.
// It returns undefined for look and redirect, and a repeat for every other kind (the brief needs it for answered, completion and unusable).

type AutomationStudioLlmDecisionContextDecision =
  | { kind: "look"; callId?; toolId?; resultCode? }                                   // iteration 0
  | { kind: "call"; signature; callId; toolId; actionId?; resultCode; changed: "yes"|"no"|"unknown"; refused?: boolean } // refused = tool answered {ok:false}
  | { kind: "call_failed"; signature; callId; toolId; actionId?; code }
  | { kind: "answered"; signature; toolId; actionId?; code; answeredByCallId }
  | { kind: "amendment"; signature; applied: number; refusals: readonly { step; reason; repeated: boolean }[];
      withdrewChanged: readonly number[]; undoneTo?: number; rerun?: number }
  | { kind: "completion"; signature; draftRevision: number; accepted: boolean; issueCodes: readonly string[];
      feedback?: unknown /* raw refused() feedback: reduced to closed detail when recorded, never stored */;
      dryRun: "clean" | "not_run" | readonly { step: number; status: string }[] }
  | { kind: "unusable"; signature; issueCodes: readonly string[] }
  | { kind: "redirect"; code?: string };

// closed-detail.ts
function automationStudioLlmDecisionContextClosedDetail(feedback: unknown): JsonObject | undefined;

// entry.ts
function automationStudioLlmDecisionContextEntry(input: {
  records: readonly AutomationStudioLlmDecisionContextRecord[]; maxBytes: number;
}): { callId: string; toolId: string; value: JsonValue } | undefined;
// callId = toolId = "core.evidence_history". It returns undefined until a decision other than look or redirect is recorded at iteration >= 1.
// maxBytes limits Buffer.byteLength(JSON.stringify(value)); the {callId, toolId} wrapper is not counted, as with the draft entry.
```

Semantics:

- **Answered requests.** An executed call and a request later answered from memory share a signature. The
  answered row's repeat therefore counts the executed call too: for run 6's `snap3`, iterations `[5, 6, 7, …]`.
- **Completions.** Keyed on signature plus `draftRevision`, so the same result against a changed draft is a new
  attempt.

### Row format (`decision_rows_v1`)

```json
{ "code": "llm_evidence_loop.decision_history", "format": "decision_rows_v1",
  "fields": ["at","kind","toolId","actionId","callId","code","changed","detail","sameAs"],
  "rows": [ ... ], "redirects"?: { "<code>": [iterations] }, "folded"?: n, "omitted"?: [..], "instruction": "..." }
```

- **`at`.** A number for one iteration, or an array of exact iterations for a group. A folded range is a string
  `"from-to"` in a row of shape `["from-to", "calls", count, changedCount]`; the instruction describes that
  shape.
- **`kind`.** One of `look`, `call`, `call_refused`, `call_failed`, `answered`, `amendment`, `completion`,
  `unusable`.
- **`callId` on an answered row.** It holds `answeredByCallId`, the entry to read instead of asking again.
- **`code`.** Depends on the kind:
  - call: the result code.
  - amendment: the refusal reasons, or `applied`, or `refused` when no reason is a closed code.
  - completion: the sorted issue codes, or `accepted`, `refused` or `dry_run_refused`.
  - unusable: the issue codes.
  - In every case, one code is a string and several are an array.
- **`detail` at full.** Only amendments and completions carry detail.
  - amendment: `{applied, refused:[[step,reason,repeated]], withdrewChanged, undoneTo, rerun}`
  - completion: `{feedback: closedDetail, dryRun: "clean" | [[step,status]]}`
- **`detail` at codes.** The same kinds, shortened.
  - amendment: `refused` becomes the list of step numbers.
  - completion: `{refusal: [feedback code/refusal/refusals], dryRun}`.
- **Trailing nulls.** Trailing null cells are dropped.
- **`sameAs`.** The first iteration the same decision was made, shown only when it is earlier than the row's
  first `at`.
- **Redirects.** Listed beside the rows rather than as rows, so a no-progress redirect does not break a run of
  identical answered rows.
- **Closed strings.** Every string passes the closed-code regex, and a string that fails becomes `null`.
  - Tested: a sentence in an actionId, a resultCode, an amendment reason and a redirect code never appears.
  - The amendment reason `"because it looked wrong"` is shown as `null`, with the row coded `refused`.
- **Least form (`decision_rows_least_v1`).** `fields ["at","kind","code"]`, one row per refusal, answer,
  failure or unusable group (identical ones joined). It adds `unlisted` (the count of other decisions) and an
  `omitted` note, and is emitted even when over budget.
- **Instruction.** 349 bytes serialized (the limit is 350).

### Ladder

Each rung is tried only if the previous one did not fit, and the first telling within `maxBytes` wins:

1. Full rows.
2. Detail trimmed to codes (`omitted: ["detail beyond codes"]`).
3. Plain successful calls folded, oldest first, one more per telling, with adjacent folds joined into one range.
   - Plain means a `look` or `call` that was not refused, not repeated (no `sameAs`) and not grouped.
   - Answered, failed, refused and repeated calls never fold.
4. Every plain call folded, and identical refusals that were not consecutive joined into one row. The joined row
   sits at the newest occurrence and carries every iteration.
5. The least form.

The rows of a distinct refusal survive every rung. This is tested on all nine tellings of the ladder fixture and
on both 64-decision cases.

## Commands run and observed results

- From `packages/fluxiq`:
  `npx vitest run src/programs/automation-studio/runtime/llm/decision-context/tests/{recorder,signature,closed-detail,entry,compression}.test.ts`
  -> `Test Files 5 passed (5)`, `Tests 26 passed (26)`. Two earlier runs failed on my own test expectations and I
  corrected them: I had miscounted the fixture's refusals as 8 when there are 7, and the coverage helper
  collected every row rather than only refusals.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t189-wB1 tsc" npx tsc --noEmit -p tsconfig.json`
  - First run (held slot b2) -> 1 error, `closed-detail.ts(51,35): TS2345`, where `filter(isObject)` did not
    narrow. I fixed it.
  - Second run (queued, then held slot b1) -> no diagnostics printed, exit 0.
  - After this fix I re-ran the five test files: still `Tests 26 passed (26)`.
- From the Core root: `node scripts/structure-audit.mjs` -> `structure-audit: passed (198 warning(s), 355 baselined).`
  - These are the same counts as before my files existed.
  - The only warning in decision-context is worker A's `tests/recorded-runs.ts` (673 lines, over the 400-line
    advisory).
- Byte sizes, measured with a scratch vitest file outside the repository:
  - **Ladder fixture (12 decisions).** Rung bytes are 1919 (full), 1659 (codes), then 1645, 1566, 1487, 1431
    and 1373 for folds 1 to 5, then 1134 (joined) and 807 (least).
  - **Mixed 64-decision build.** Look plus 64 decisions: calls, answered repeats, refused calls, refused
    amendments and refused completions with feedback.
    - Sizes by rung: full 8107, codes 6965, all folded 4976, joined 3979, least 1964.
    - At the production cap of 4000, the entry chooses the joined rung: **3979 bytes**, 45 rows, 33 calls folded.
  - **64 distinct unusable decisions with 90-character codes.** The least form is 7456 bytes, over the cap as
    specified, and all 64 rows are present.

## Not verified

- Nothing is wired into `evidence-loop.ts`. The loop has not run with this entry, and the entry has not been
  measured against the recorded windows (`recorded-windows.test.ts`).
- The whole package suite was not run. Only the five new test files ran.
- Byte sizes come from synthetic fixtures, not the recorded runs 4 and 6 or crossborder.

## Open questions or contradictions found

- **Two exports of one name.** `AUTOMATION_STUDIO_LLM_EVIDENCE_HISTORY_TOOL_ID` is now defined in both
  `context-window.ts` (re-exported through `llm/index.ts` via `evidence-loop.ts`) and `decision-context/`. The
  decision-context barrel is deliberately not added to `llm/index.ts`, so nothing clashes yet. The wiring worker
  must delete the old constant before re-exporting this barrel.
- **Near the cap.** A mixed 64-decision build lands at 3979 of 4000 only on rung 4. Longer builds, or larger
  closed feedback, will reach the least form. That is by design, but the wiring worker should expect it in long
  runs.
- **A joined refusal moves.** Rung 4 places a joined refusal at its newest occurrence, so the plain calls around
  its old position fold into one range (for example `"0-6"` with count 5 while iterations 3 and 5 are rows
  elsewhere). The count keeps this honest, but the range spans iterations that are not calls.
- **Fields chosen where the brief left them open.**
  - `call.refused` (whether the tool answered `{ok:false}`) is a new field on the decision; the brief did not
    name one.
  - A completion's code is its issue codes when there are any, otherwise the closed words `accepted`, `refused`
    or `dry_run_refused`, which I chose.

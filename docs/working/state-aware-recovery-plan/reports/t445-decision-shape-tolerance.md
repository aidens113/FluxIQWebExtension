# t445: an unambiguous tool-call decision is not discarded over its kind field (Core)

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t445/!FluxIQ`, branch `task/t445-decision-shape-tolerance`. Nothing committed.

## Outcome

Done. A decision whose `kind` is absent or names no known kind, and that carries a string `toolId` and an object
`input` with no `result` and no `amendments`, is now read as `tool_call`. A missing or invalid `callId` is filled
deterministically. A warning diagnostic, `llm_output.decision_kind_inferred`, records the repair. Anything still
refused at `response.decision.kind` now tells the model the field and the allowed values.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/llm/`.

- `harness/provider-result.ts`
  - New non-exported `inferredEvidenceToolCall`, called just before `validateUnknownEvidenceToolDecision`.
  - What it does:
    - It leaves any known kind (`tool_call`, `complete`, `amend_draft`) untouched, so a `complete` that carries a
      `toolId` is never relabelled.
    - Otherwise, when the fields match the shape above, it returns `{...decision, kind: "tool_call", callId}`.
    - The `callId` is kept when `validRequestIdentity` accepts it. When it does not, the id becomes
      `call.<FNV-1a 32-bit hex of toolId + NUL + JSON(input)>`.
    - It pushes a warning `{code: "llm_output.decision_kind_inferred", path: "response.decision.kind",
      metadata: {kindWritten: "absent" | "unknown" | "not_a_string", callIdFilled}}`. No model text goes into the
      message or the metadata.
  - The repaired decision then goes through the existing strict tool-call check, which still refuses extra keys and
    an invalid id or input. The structured response that is returned carries the repaired decision.
  - The remaining refusal message now names the allowed values: "Evidence decision kind is unsupported: decision.kind
    must be one of tool_call, complete, amend_draft." The code and path are unchanged.
  - Why here and not in the DeepSeek normalizer: this is the one provider-agnostic place with a diagnostics channel,
    and warnings reach `result.diagnostics` in `harness/run.ts` without changing `ok`. There is precedent in
    `llm_output.diagnosis_text_clipped`. The normalizer already passes the inner decision through untouched.
  - The helper stays non-exported inside this file. An import from `../evidence-loop-decision.ts` would risk a new
    import cycle, and this file is already baselined for `import-cycles`.
- `unusable-decision.ts`
  - `AutomationStudioLlmUnusableDecisionFieldIssue` is now a union. It adds `{code:
    "llm_output.invalid_evidence_decision", path: "response.decision.kind", allowed: ["tool_call", "complete",
    "amend_draft"]}` alongside the existing misplaced-`write` correction.
  - `screenedFieldIssues` rebuilds each known correction from Core's own constants, and only when its code is
    listed. Forged extras and values are dropped, as before.
  - The error builder reads field issues from diagnostics by code and path. `"Evidence decision must be an object"`
    (path `response.decision`) produces no field issue.
  - Feedback adds an instruction per field issue. The kind instruction says the field is `response.decision.kind`
    and must be exactly "tool_call", "complete" or "amend_draft".
  - `evidence-loop.ts` passes `thrown.fieldIssues` through by type, so it needed no change.
- `evidence-loop-decision.ts`: comment only. The normalizer's doc now points to where the inner `kind` is read.
- Tests
  - `deepseek/tests/response-envelope.test.ts`: a new describe block that goes through the real envelope parse and
    then `parseAutomationStudioLlmProviderResult`. It covers:
    - R4b's exact shape `{kind:"callId", callId:"select-7in1", toolId:"core.run_node", input}`. It is read with the
      callId kept and a warning with `callIdFilled:false`.
    - The no-callId shape: a derived `call.xxxxxxxx`, the same for the same call and different for a different
      input. No kind at all, and an invalid callId, are read the same way.
    - Still refused:
      - `complete` with `toolId`
      - `amend_draft` with `toolId`
      - `toolId` with no input
      - a non-object input
      - an otherwise valid call that also carries `result` (ambiguous)
      - an otherwise valid call that also carries `amendments`
      - an extra field `note`
    - The refusal names `response.decision.kind` and the allowed values.
  - `tests/decision-kind/tests/inferred-tool-call.test.ts` (new), through the real harness and the real evidence
    loop:
    - Both shapes run the offered tool.
    - An inferred call to a tool that was not offered still ends `llm_evidence_loop.unknown_tool` without running
      it, so the existing tool-offered check applies.
    - The ambiguous shape stays refused, and its error and feedback carry the kind field issue and instruction.
    - A not-an-object decision gets no field issue.
    - A forged kind correction is screened back to Core's constant.
  - Placement:
    - These four tests were first appended to `tests/unusable-decision.test.ts`. That took it to 870 lines and the
      audit failed it: `FAIL [file-lines] ... exceeds the 800-line limit`.
    - A sibling file in `tests/` then took that folder to 26 files: `FAIL [directory-files] ... 26 source files exceeds
      the 25-file limit`.
    - So the tests sit in a feature subfolder. This follows the precedent of
      `runtime/tests/earlier-output/tests/*.test.ts`.
    - `tests/unusable-decision.test.ts` is unchanged from HEAD.

## Commands run and observed results

All were run in `C:/Users/osrs_/FluxStuff/fxwork/t445/!FluxIQ` (packages/fluxiq for vitest and tsc):

- `npx vitest run src/.../llm/tests/ src/.../llm/deepseek/tests/ src/.../llm/harness/tests/` printed `Test Files 57
  passed (57)` and `Tests 697 passed (697)`.
- `npx tsc --noEmit -p .` printed `tsc exit: 0`. An earlier run caught a missing `JsonObject` import and a readonly
  tuple that is not a `JsonValue`; both are fixed.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (327 warning(s), 1159 baselined).` That matches
  the pre-change baseline run. `provider-result.ts` (601 lines) shows only the advisory warning about the 400-line
  threshold.
- Mutation check:
  - I replaced the `inferredEvidenceToolCall` call with the raw decision and re-ran the envelope test and the
    unusable-decision tests. Result: `Tests 5 failed | 95 passed (100)`.
  - The 5 failures were the read-as-tool-call tests and the loop tests. The extra-field test also failed, because
    before the fix it refused under a different code.
  - I then restored the file; `git diff --stat` shows the intended +58/-2.
- `npx biome lint <files>` printed "No files were processed": biome.json ignores these paths, so it does not apply.

## Not verified

- No Lab or provider run, as the brief said.
- I did not see the warning in a live step log. It is in `result.diagnostics` from `harness/run.ts`. Whether the
  Lab's step writer prints warning diagnostics for an `ok` decision is outside these files, and I did not check it.
- A bare top-level reply with no `decision` wrapper, `{kind:"callId", toolId, input}`, is still refused as
  `llm.provider_output_invalid` by the DeepSeek normalizer. None of the 9 observed cases had that shape, so I left
  the normalizer's lift rule as it was.
- I did not run the full Core suite, because the policy is narrow checks only.

## Open questions or contradictions found

- The brief said to put the tests in "the unusable-decision tests". That file has no room under the 800-line limit,
  and its folder is at the 25-file limit, so they live in `llm/tests/decision-kind/tests/`. The supervisor may prefer
  a different grouping, for example splitting `unusable-decision.test.ts` itself.
- `harness/provider-result.ts` is now 601 lines, past the 400-line advisory threshold but under the 800-line limit.
  A later split by response kind would be natural.

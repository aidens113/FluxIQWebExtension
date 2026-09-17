# w2-creation-loop-keeps-going: Flow creation no longer ends on a repeated request or a few refused plans

Core: `F:\!FluxIQ`, branch `dev`, HEAD `6964d63` when finished (the brief named
`42bd90a`; the supervisor committed in between). Nothing was committed.
`AS/` = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. One test in a file I do not own needs a one-line change (diff below).
Another worker's in-flight provider code leaves one type error and two test
failures in `llm/failure-disposition*`, which is not my file.

What a user of Flow creation will now see:

- **The model asks again for something it already has.** For example,
  `web.detect_repeating_structure` twice with the same input. The build goes
  on: the tool is not run again, the earlier result is moved to the end of what
  the model sees, and a short note after it names that result. The build ends
  only if this keeps happening. The default is three steps in a row with nothing
  new, and the build then ends as
  `flow_bootstrap.evidence_repeat_without_progress`.
- **The model asks to look again when nothing has changed.** This is handled
  the same way: it is answered with the latest look, and the note code is
  `llm_evidence_loop.already_observed`.
- **The model reuses one of its own call ids for a different request.** This
  was `multi-tab-order-details`. Core gives the request its own id (`call.1.2`,
  `call.1.3`, ...) and runs it. The build no longer ends as
  `evidence_duplicate_call`.
- **The model sends a malformed reply.** It is now told the issue codes and the
  shape a decision takes before it is asked again. Before this change it was
  asked again with no explanation.
- **A completed plan is refused.** The model is told each issue at its path.
  For an issue about a parameter, it is also told the shape that parameter
  accepts. For a record output this is the exact keys, the required keys, the
  contract text and a minimal valid example.
- **Refusals change from one attempt to the next.** A refusal with a set of
  issues not seen since the last tool result counts as progress, and so does a
  corrected handle position. The same issues coming back are not progress. A
  far backstop of 12 unusable decisions in a row, however different, still
  stops a runaway; it is configurable.
- **The list extraction's catalog entry.** It now carries Core's record-output
  contract in both the whole and the condensed form. Before this change, a
  preferred node that did not fit whole was dropped rather than condensed, so
  the list extraction never had a condensed form. Now it does.
- **The records-writing node.** Plan validation no longer accepts a
  `builtin.data.write-records` node that will fail when it runs.

## What changed and why

### The loop (`AS/runtime/llm/evidence-loop.ts`, `unusable-decision.ts`)

- **New input `maxStepsWithoutProgress`: the no-progress guard.**
  - Default: `unusableDecisions.maxConsecutive` if set, otherwise 3, held to
    `maxIterations`. If both are given they must agree, otherwise the
    configuration is refused.
  - Steps that count as giving nothing new:
    - a repeated request (same tool and input, with no applied change since);
    - a re-observation of a protected tool with no applied change since;
    - an unusable decision (a thrown `AutomationStudioLlmUnusableDecisionError`
      or a refused completion) whose issue set has already been seen since the
      last tool result.
  - A tool that runs resets the count and forgets the seen issue sets.
  - An unusable decision with an issue set not seen before restarts the count
    at 1. The issue set compares distinct codes regardless of order.
  - This also stops a model that alternates between two mistakes: A, B, A, B
    counts 1, 1, 2, 3.
- **How the guard ends the loop.** It depends on the step that reaches it:
  - a repeated request or re-observation ends as
    `llm_evidence_loop.repeat_without_progress`. That step's trace
    `resultCode` is `llm_evidence_loop.rejected.repeat_without_progress`.
  - an unusable decision ends through the caller's `stalled`, exactly as
    before, so Flow creation still ends as
    `flow_bootstrap.evidence_unusable_decision` with the issue codes.
- **A repeated request is answered, not run.**
  - The earlier result's evidence entry is moved to the end of the evidence, so
    the model's byte window always reaches it; the evidence window for Flow
    creation is only 8,000 bytes.
  - A note is then added under `core.request_check.<iteration>`:
    `{ok:false, code, toolId, answeredByCallId, stepsWithoutProgress, maxStepsWithoutProgress, instruction}`.
    It is under 512 bytes, counted against the evidence bytes, and gets its own
    trace step with `resultCode` `llm_evidence_loop.already_answered` or
    `already_observed`.
  - The repeat check runs before the call-id check, so a request repeated word
    for word, call id included, is answered rather than refused.
- **A reused call id is replaced (`unusedCallId`).**
  - Only when the request itself is new. The replacement is `<id>.2`, `<id>.3`
    and so on, cut to 200 characters.
  - The assigned id is what reaches `executeTool`, the evidence and the trace.
    It passes straight through to the domain binding (`harness-options/binding.ts`).
- **The two old endings are no longer produced.**
  - `llm_evidence_loop.duplicate_call` and `duplicate_tool_request` stay in the
    failure-code union, with a comment. `recovery/exploration-outcome.ts` has
    an exhaustive `Record` over that union, and stored results may carry them.
  - `generation-failure.ts` keeps the matching `flow_bootstrap.*` codes so
    stored diagnostics still parse.
- **Unusable-decision feedback.**
  - Built by `automationStudioLlmUnusableDecisionFeedback` and added under
    `core.decision_check.<iteration>`. The tool id is exported as
    `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_FEEDBACK_TOOL_ID`.
  - Contents: `{ok:false, code:"llm_evidence_loop.decision_unusable", issueCodes (≤8), stepsWithoutProgress, maxStepsWithoutProgress, accepted:{oneOf:[tool_call example, complete example], rule}, instruction}`.
    About 768 bytes.
  - It is added only when the loop will ask again. The trace step is unchanged.
- **Far backstop: `unusableDecisions.maxInARow`.**
  - Default `max(guard, min(12, maxIterations))`. The 12 is the new export
    `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_UNUSABLE_DECISIONS_IN_A_ROW`.
  - Allowed range: at least the guard and at most `maxIterations`.
  - A parsed tool call resets it, as the old streak was reset.
  - `unusableDecisions.maxConsecutive` is now optional.
- **Decision instruction.** `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION`
  gained one sentence: an entry whose toolId starts with `core.` is Core's
  answer to the previous decision, and when it names an earlier callId, that
  entry is to be used.
- **Recovery is unchanged in behavior.** `runtime-exploration.ts` still
  retries unusable decisions inside `decide`. For recovery, a repeated request
  now spends at most two more ledger-admitted provider calls before the guard
  ends it as `repeat_without_progress`, which it maps to `no_progress`. All
  recovery tests pass.

### The record-output contract and the catalog (`AS/runtime/flow-bootstrap/plan/`)

- **New `record-output-contract.ts`.** It is internal and not in the barrel.
  - `automationStudioFlowBootstrapRecordOutputContract(definition)` returns
    `{keys, requiredKeys, text, condensedText, example}`, built from the
    record-set constants.
    - The keys are written out, and a test holds them to the parser.
    - It says whether the node supplies the records path itself.
    - It offers `null` only on nodes that accept it.
  - `automationStudioFlowBootstrapRecordOutputIssues(definition, value)`: see
    the parser-disagreement section below.
  - `automationStudioFlowBootstrapSuppliedRecordsPath(definition)`.
- **New `parameter-text.ts`.** It holds the per-parameter catalog text, moved
  out of `catalog.ts` so the catalog and the feedback word a parameter the
  same way.
  - For a `record-output` parameter:
    - whole form: the node's own description, then the contract (up to 600
      characters, with the contract kept), plus the example;
    - condensed form: the short contract.
  - `boundedExample` now names the one failure it expects (`TypeError`) and
    rethrows anything else. This removes the one baselined `failure-as-empty`
    finding in `catalog.ts`.
- **`catalog.ts`.**
  - It uses the shared parameter text.
  - A preferred node (preferred because the instruction used one of its tags)
    now falls back to the condensed form before being dropped.
  - Finding: a scraping instruction never makes the list extraction a
    *required* node. It is only preferred, so before this change it was sent
    whole or not at all. Instead, "Extract every product name..." pins
    `web.output.dom-wait_for_text` for its extract intent. See the open
    questions.
- **New `issue-feedback.ts`, exported from the plan barrel.**
  - `automationStudioFlowBootstrapIssueFeedback({issues, plan?, registry?, resolution?})`
    returns at most 16 entries `{code, path?, accepted?}`.
  - Paths are printable and at most 300 characters.
  - A parameter's shape is given once, and all shapes together stay within
    3,000 bytes.
  - `accepted` depends on the issue:
    - a record output gets `{parameter, keys, requiredKeys, shape, example}`;
    - any other parameter gets `{parameter, type, required?, …, description?, example?}`;
    - `bootstrap.unknown_parameter` gets `{parameters: [declared ids]}`;
    - a domain refusal at the node's `parameters` path gets the shape of the
      parameter named at the start of its position code, for example
      `web.handle.misplaced:extractList.fields.0`.
- **`validation.ts`.**
  - Record outputs are checked through `automationStudioFlowBootstrapRecordOutputIssues`.
  - Absent and null record outputs are now checked too, not skipped.
- **Test fixture (`tests/web-domain-definitions-fixture.ts`).** `recordOutput`
  now carries `ui.control: "record-output"`, and the list extraction carries
  `metadata.recordsPath`, as the real domain declares both.

### The completion check (`AS/runtime/llm/harness-options/bootstrap-completion.ts`, owned from the coordinator's second message)

- **Feedback.** `refused()` takes the plan being checked plus the registry and
  resolution, and builds its issues with
  `automationStudioFlowBootstrapIssueFeedback`. The file's own `boundedPath`
  and `MAX_FEEDBACK_PATH_LENGTH` were removed, because the helper now bounds
  paths.
- **Instruction.** `FEEDBACK_INSTRUCTION` gained one sentence of mine about the
  `accepted` field, plus diff 3A (below).

### `AS/runtime/flow-bootstrap/generation-failure.ts`

- **Comments.** They mark `evidence_duplicate_call` and
  `evidence_duplicate_tool_request` as no longer produced, and describe the new
  endings.
- **New mapping.** `"llm.provider_exploration_evidence_invalid": "flow_bootstrap.provider_exploration_evidence_invalid"`.
  - The DeepSeek/harness worker added that pre-flight code to
    `provider-contract.ts`.
  - This table is keyed by that list on purpose, so the type check and
    `generation-failure.test.ts` failed until the code was named here.

## Addition: reused call ids (coordinator message 1)

- **Evidence.** `run-mu4xufd9-ac14d534` (`multi-tab-order-details`): the steps
  were inspect, `web.navigate_same_origin` (applied), then
  `web.navigate_same_origin` (applied) under the same call id. The build ended
  `flow_bootstrap.evidence_duplicate_call`.
- **Fix.** A new request under a used id now runs under an id Core assigns
  (see above).
- **Tests.**
  - "runs a new request whose call id was already used, under an id the loop
    assigns" (ids `call.1`, `call.1.2`, `call.1.3`, `call.1.2.2`).
  - "keeps an assigned call id within the id bound".
- **The four other runs** (`admin-console-customer-book`, `-short`,
  `member-directory-hollis-admins-by-activity`, `sensitive-input-card-labels`)
  all ended on a repeated `web.detect_repeating_structure`. Two of them repeated
  it after it had answered `web.action.rejected.no_repeating_structure`. Those
  repeats are now answered with that same refusal, and the build goes on.

## Addition 1: diffs 3A and 3B (coordinator message 2)

- **3A: applied** to `bootstrap-completion.ts` exactly as quoted. The last
  handle sentence now ends `". "`, followed by the two new lines about
  `<code>:<path>` and about a parameter's description naming further keys.
- **3B: applied** to `flow-bootstrap/plan/evidence-schema.ts:69`. It inserts
  "A parameter's description may name further keys to write beside the
  handle." before "Never write a locator, path or query of your own."
- **Checks.**
  - No test pins that schema text; I searched for it.
  - The new test `harness-options/tests/bootstrap-completion.test.ts` asserts
    both 3A sentences.
- **My own added sentence.** I worded it so it does not contradict 3A: "Where
  an issue carries accepted, it is what that parameter takes: write only the
  keys it names, beside a handle where one belongs, and follow its example."

## Addition 2: why plan validation and the run disagreed on the records-writing node

- **Cause.** The two sides treat a missing or `null` record output differently.
  - **At run time**, `nodes/data/write-records.ts` does
    `parseAutomationStudioRecordOutput(withWrittenRecordsPath(value))`, and
    `withWrittenRecordsPath` turns a missing or null value into `null`. The
    parser refuses that as `record_output.not_object`, which the node reports
    as `record_output.invalid`.
  - **Plan validation** used to skip every missing or `null` record output
    ("null is how a record output saves nothing"). That is true for
    `builtin.policy.action` (`readRecordOutput` returns no output) and for the
    web list extraction, which derives its own dataset. It is not true for this
    node.
  - The parameter has `defaultValue: null` and is not `required`. So a model
    that left it out, or wrote `null`, passed validation and failed at run time.
- **Evidence limits.** `run-mu4yk4u1-60a1c3a4`'s snapshots do not keep node
  parameter values. This is the only path through both parsers that gives
  "validation accepts, the run refuses".
  - Any object value was already parsed identically.
  - An authored path is replaced at run time, so it cannot make the run refuse
    what validation accepted.
- **Fix.** Validation now calls `automationStudioFlowBootstrapRecordOutputIssues`,
  which reads the value as each node does:
  - The records-writing node puts its own path over any other, and a missing
    or non-object value becomes itself or `null`, before parsing.
  - A domain output gets its declared `metadata.recordsPath` when no path was
    written. Missing or `null` is fine on the domain and policy nodes.
  - Every branch uses Core's own `parseAutomationStudioRecordOutput`.
  - A missing value on a record-output parameter is now checked, not skipped.
- **Side effect, also a fix.** An authored invalid `recordsPath` on the
  records-writing node is no longer refused, because the run ignores it.
- **The contract changes with it.** For this node it reads "Required: an
  object with only these keys…" and does not offer `null`.
- **Tests** (`plan/tests/record-output-contract.test.ts`, "a record output plan
  validation accepts"). These run the real built-in nodes (`builtinAutomationNodeDefinitions`,
  write-records and policy action) over 11 values and require validation's
  verdict to equal each node's run outcome, value by value.
  - The values: left out, null, `{}`, a string, an array, a whole one, one
    without a path, one with an empty path, an unknown key, a bad write mode,
    and encrypt.
  - A left-out value is checked both absent and as the declared default.
  - Separate cases pin the codes.
  - `plan/tests/validation.test.ts` adds "refuses it left out or null, as its
    run does" at full-plan level.

## Addition 3: the no-progress rule and position codes

- **Confirmed.** A changed issue set is progress. `run-mu4x5m2p-a4a4a29d`
  (misplaced, misplaced, malformed) now counts 1, 2, then 1 again (a new set),
  and the loop asks again. The old count ended it at the third.
- **Tests** (`llm/tests/unusable-decision.test.ts`).
  - "keeps asking after a repeat when the next refusal is a new one" mirrors
    that run.
  - "counts a corrected position as a new refusal": four refusals that differ
    only in their `:<position>` code all count as new, with a guard of 2.
- **Also checked.** Position codes pass the loop's issue-code filter
  (`^[a-z0-9_.:-]{1,100}$`, case-insensitive), so they are part of the set.
  - A position longer than 100 characters would be dropped by the check, and
    two refusals could then look identical.
  - The domain's example positions are short.

## Evidence that motivated item 2 (campaign `2026-09-17T02-23-20-255Z`)

- **`infinite-feed-load-more` (`run-mu4xt4fz-a5cd68c2`).** The refusals were
  `web.handle.malformed` four times with a detection in between: malformed,
  detect, then malformed three times. Under the new rule, the three after the
  detection are the same set, so the build still ends as
  `evidence_unusable_decision`. That is the intended stall; the handle refusal
  itself is the domain worker's.
- **`infinite-feed-first-forty-short-feed` (`run-mu4xqf74-75c52923`).** The
  refusals were malformed, malformed, misplaced. That now continues.

## Commands run and observed results

All commands were run from `F:\!FluxIQ`, and none made a live provider call.

- **Loop tests, first run.**
  - `FLUXIQ_TEST_ENV_FILES=none npx vitest run …/llm/tests/evidence-loop.test.ts …/llm/tests/unusable-decision.test.ts`
  - Before implementing: 23 failed, 43 passed (66). The new and changed tests
    failed for the expected reasons.
  - After: 66 passed. After the call-id change: 68 passed.
- **Flow-creation, loop and completion-check tests, after the crash.**
  - `FLUXIQ_TEST_ENV_FILES=none npx vitest run …/runtime/flow-bootstrap …/llm/tests/evidence-loop.test.ts …/llm/tests/unusable-decision.test.ts …/llm/harness-options`
  - `Test Files 14 passed (14)`, `Tests 269 passed (269)`.
- **The brief's test command, after the crash.**
  - `FLUXIQ_TEST_ENV_FILES=none npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/llm packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap packages/fluxiq/src/programs/automation-studio/runtime/recovery`
  - `Tests 2 failed | 750 passed (752)`, `Test Files 1 failed | 51 passed (52)`.
  - Both failures are in `llm/tests/failure-disposition.test.ts`, which is not
    mine: "has exactly one entry for every provider failure code" and "ends
    the grant on every one of the seventeen pre-send refusals". The expected
    list contains `llm.provider_exploration_evidence_invalid`; the disposition
    table does not.
  - An earlier run of the same command, before the crash, also showed
    tests-first failures in other workers' new files (`llm/harness/tests/*`,
    `deepseek-evidence-preflight.test.ts`, `recovery/annotation/tests/exploration.test.ts`).
    Those files pass now.
- **Type check.**
  - `npx tsc --noEmit -p packages/fluxiq` exited 2.
  - It reported 4 errors, all in `llm/failure-disposition.ts(92,12)` and
    `llm/tests/failure-disposition.test.ts`, caused by the same missing
    disposition entry. None are in my files.
  - An earlier run showed a missing-key error that my `generation-failure.ts`
    mapping resolves.
- **Structure audit.**
  - `node scripts/structure-audit.mjs` exited 0: `structure-audit: passed (156 warning(s), 354 baselined)`.
  - New advisory warnings only:
    - `flow-bootstrap/plan/` has 16 source files (advisory 15);
    - `evidence-loop.ts` is 648 lines (advisory 400);
    - `unusable-decision.test.ts` is 490 lines;
    - `generation-failure.ts` is 650 lines.
  - The JSON mode reported no `failure-as-empty` or `swallowed-failure`
    findings in my files.
- **Before the completion-check patch was applied.**
  - `git apply --check -v <scratch diff>` reported "Checking patch … bootstrap-completion.ts...", exit 0.
  - An in-memory TypeScript program check with the patched file served from
    memory (scratch script `w2loop-diff/typecheck-patched.cjs`) reported 0
    diagnostics in the patched file.
  - After the ownership change I applied it with `git apply -v`, which
    reported "Applied patch … cleanly".
- **Service-level Flow creation and loop limits.**
  - `FLUXIQ_TEST_ENV_FILES=none npx vitest run …/runtime/tests/service-bootstrap …/runtime/tests/deepseek-bootstrap-exploration.test.ts …/runtime/loop-limits`
  - `Tests 2 failed | 71 passed (73)`.
  - **Failure 1:** `deepseek-bootstrap-exploration.test.ts` "stops after three
    unusable decisions in a row…". Expected `evidenceBytes: 0`, received `1536`,
    which is the two feedback entries the model is now shown. This is intended;
    the diff is below.
  - **Failure 2:** `service-bootstrap/tests/adaptation.test.ts` "bridges a
    generated proposal ID…" timed out at 5000ms. It did so three times under
    load from other workers; an earlier run also had `EBUSY` SQLite unlinks in
    two sibling tests, which passed on rerun.
  - Run alone with `-t "bridges a generated proposal ID" --testTimeout=120000`,
    it passed in 3527ms. This path makes no evidence-loop calls.
- **Earlier, before the crash.**
  - The same service run plus `runtime/tests/deepseek-recovery-requests.test.ts`
    and `llm/harness-options` gave 126 passed and 4 failed: the exploration
    test above plus three 5-second timeouts or `EBUSY`.
  - Rerunning the three alone left only the `adaptation.test.ts` timeout.

## Not verified

- **No live provider run.** The brief forbids one.
  - Not verified: whether DeepSeek actually uses the moved result, the note,
    the decision feedback or the `accepted` shapes.
  - Not verified: whether the campaign tasks now complete.
- **The records-writing node's actual parameter value in
  `run-mu4yk4u1-60a1c3a4` is not in its snapshots.** The cause is inferred from
  the code, as the only path that splits the two parsers, and the parity test
  pins it.
- **The web domain's own dispatch** (`domain/src/output-nodes/extract-list/dispatch.ts`)
  is not in the parity test, because Core cannot import it. I read it: a
  missing or null record output means a derived dataset, and an object gets the
  declared path when it has none. Validation matches that.
- **The feedback against the other worker's new pre-send screen.** I checked
  only by reading its test names, and it was in flight. The feedback and note
  keys (`ok`, `code`, `issueCodes`, `accepted`, `oneOf`, `rule`, `instruction`,
  `toolId`, `answeredByCallId`, `parameter`, `keys`, `requiredKeys`, `shape`,
  `example`, `datasetId`, `schema`, `fields`, …) do not include the web
  domain's denied keys or Core's `target` family. The DeepSeek exploration
  test did send requests carrying the decision feedback: iterations
  `[1, 2, 3]` were sent.
- **Whether `adaptation.test.ts` is slower because of this change.** No
  measurement was taken on the base commit, because I did not want to stash
  other workers' files. It passes alone in 3.5s against its 5s limit.
- **Documentation.** Core's `docs/architecture/automation-studio/llm-flow-bootstrap.md`
  was not updated; another worker has it modified. It needs to describe:
  - the no-progress guard and far backstop;
  - answered repeats and reassigned call ids;
  - the decision feedback;
  - the `accepted` shapes;
  - the record-output contract in the catalog;
  - the preferred-node condensed fallback.

## Open questions or contradictions found

1. **One test needs updating: `runtime/tests/deepseek-bootstrap-exploration.test.ts`.**
   It is not in my ownership list. The intended change:

   ```diff
   @@ it("stops after three unusable decisions in a row with a named outcome, and releases the grant"
          // Three malformed replies were paid for nothing, so the record says so.
          accounting: expect.objectContaining({ provider: "deepseek", model: "deepseek-chat", inputTokens: 0, totalTokens: 0 }),
   -      evidenceLoop: { iterationCount: 3, decisionCount: 3, toolCallCount: 0, evidenceBytes: 0, steps: Array.from({ length: 3 }, () => ({ toolId: "core.decision_unusable", resultCode: "llm.provider_malformed_response" })) },
   +      // The first two were each answered with what was wrong before the model was asked again.
   +      evidenceLoop: { iterationCount: 3, decisionCount: 3, toolCallCount: 0, evidenceBytes: expect.any(Number), steps: Array.from({ length: 3 }, () => ({ toolId: "core.decision_unusable", resultCode: "llm.provider_malformed_response" })) },
          issueCodes: ["llm.provider_malformed_response"]
        });
   +    expect(run.failure?.evidenceLoop?.evidenceBytes).toBeGreaterThan(0);
   ```

   Observed value: 1536.
2. **`llm/failure-disposition.ts` has no entry for `llm.provider_exploration_evidence_invalid`.**
   The DeepSeek/harness worker added that code to `provider-contract.ts`. This
   causes the type error and the two test failures above. As a pre-send
   refusal it should be `END_GRANT`, and the test's "seventeen" count becomes
   eighteen. That is that worker's file.
3. **The structure baseline has a stale entry.** It still records
   `failure-as-empty` for `runtime/flow-bootstrap/plan/catalog.ts: 1`; the
   finding is gone. Run `pnpm structure:baseline` so the slack cannot be
   silently reused. The baseline file is not mine.
4. **Two comments in `runtime/loop-limits/` (not mine) now describe the old
   rule.** Suggested wording:

   ```diff
   --- a/…/runtime/loop-limits/flow-bootstrap-evidence-loop.ts
   -// enforces on every call, and the loop's own no-progress checks (a repeated
   -// request, or re-observing without a change in between, ends the loop).
   +// enforces on every call, and the loop's own no-progress guard (a request it
   +// already answered, a look with nothing changed, or the same refusal again,
   +// several times in a row, ends the loop).
   @@
   -   * Unusable decisions in a row after which the exploration stops. Each one
   -   * still spends one of the loop's iterations, so the grant's call count keeps
   -   * binding underneath; this is the guard that stops a loop whose replies stay
   -   * bad long before that count does.
   +   * The loop's no-progress guard: steps in a row that gave it nothing new --
   +   * an unusable decision for issues already seen, a repeated request -- after
   +   * which the exploration stops. Each still spends one of the loop's
   +   * iterations, so the grant's call count keeps binding underneath.
   --- a/…/runtime/loop-limits/evidence-loop.ts
   -// How many decisions in a row may come back unusable -- a malformed reply, a
   -// timeout -- before a loop that asks again stops asking. It is the same number
   +// How many steps in a row may give a loop nothing new -- the same refusal
   +// again, a request it already answered -- before it stops. It is the same number
   ```

5. **Ranking quirk (`plan/ranking.ts` is mine, but I left it alone).**
   - The word "extract" belongs to the verify intent group. So "Extract every
     product name and price from the list." pins
     `web.output.dom-wait_for_text` as the required node for that intent.
   - The list extraction arrives only through its tags, as a preferred node.
   - Tags and the new condensed fallback keep it in the catalog. But an
     extraction verb pinning a wait node is probably wrong, and it spends
     reserved budget.
   - Recommendation: a separate change, so that a domain tag on the
     best-scoring definition beats a verb group whose best match merely
     contains "text".
6. **`adaptation.test.ts` is close to its limit.** "bridges a generated
   proposal ID…" takes about 3.5 seconds alone against a 5-second limit, and
   times out whenever other workers run tests at the same time. It could be
   given an explicit timeout.
7. **The default far backstop is 12.** It lives in `evidence-loop.ts`, not
   `loop-limits/`, because only `runtime/llm` reads it. Flow creation does not
   pass `maxInARow` (that would be a `service.ts` change), so it gets
   `min(12, grant calls)`.

# t339 U1: candidate authoring format and trial gate

Worker: t339-candidate-gate. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t339\`, Core branch `task/t339-candidate-trial-gate`
(base Core `a2672def`). All edits are in the t339 Core tree and nothing is committed. Core paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

## Outcome

Done, with two choices that depart from the brief's wording (Open questions 1 and 2). In candidate mode the model now:

- sees the Flow script format plus a new act-on-one-item example on `core.submit_candidate`;
- can ask for a trial of its latest candidate through a new tool, `core.test_candidate`, which calls an injected trial
  port;
- can complete only on a `yes` for that exact latest revision and digest, whenever a port is injected.

All the brief's fail-first cases are covered and pass. The owning tests, the callers' tests, Core's non-incremental
typecheck and Core's structure audit pass.

## What changed and why

- **`candidate/contracts.ts`** pins the trial port contract:
  - `AutomationStudioCandidateTrialRequest`: `{ candidateId, revision, digest, signal, candidate }`. The `signal` is
    always an `AbortSignal`.
  - `AutomationStudioCandidateTrialResult`: `{ revision, digest, verdict, feedback: JsonObject, trialRunId? }`.
  - `AUTOMATION_STUDIO_CANDIDATE_TRIAL_VERDICTS` (`yes | no | unsure | not_judged | execution_failed`) and
    `AutomationStudioCandidateTrialPort`, which is
    `(request) => Promise<result>`.
  - `candidate` is an addition to the pinned input. See Open questions 2.
- **New `candidate/trial-gate.ts`**: the class `AutomationStudioFlowCandidateTrialGate` and the tool id
  `AUTOMATION_STUDIO_CANDIDATE_TEST_TOOL_ID = "core.test_candidate"`.
  - The tool is declared `effect: "mutate"`, because a trial acts on the site. Its description is 2,000 characters or
    fewer.
  - It takes `{ revision, digest }` and passes the port the exact latest revision and digest, plus a frozen clone of
    that candidate.
  - Refusals never reach the port, and each one tells the model what to do next:
    - `candidate.trial_input_invalid`;
    - `candidate.trial_unavailable` (no port injected);
    - `candidate.trial_stale_revision` (also names the latest revision and digest);
    - `candidate.trial_unchanged_after_no`.
  - Verdicts are kept per `revision + digest`. A `no` closes that digest: the same Flow cannot be tested again or
    completed, even when resubmitted unchanged as a new revision. This prevents shopping for a yes from the judge.
  - `unsure`, `not_judged` and `execution_failed` may be tested again on the same revision.
  - A port result for a different revision or digest counts as `execution_failed` (`candidate.trial_result_mismatch`),
    as does a malformed result (`candidate.trial_result_invalid`).
  - A port that throws gives `candidate.trial_port_failed`, and its error text is not shown to the model. A throw
    under an aborted signal is re-thrown as cancellation.
  - Completion rule, once a port is injected:
    - no verdict for the latest revision: `candidate.trial_required`, naming the exact revision and digest to test;
    - a digest closed by a `no`: `candidate.trial_unchanged_after_no`, carrying the earlier feedback;
    - any other verdict that is not `yes`: `candidate.trial_<verdict>`, carrying `trialFeedback`;
    - `yes`: accepted.
- **`candidate/authoring-loop.ts`**:
  - Builds the gate and offers `core.test_candidate` beside the submit tool. Any caller tool with that id is
    filtered out, as `core.run_flow` already was.
  - The latest-submission check runs first and is unchanged. The gate's rule runs after it.
  - The submit tool's `flow` property description is now
    `The whole Flow as a script. ${AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT}\n${AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE}`.
    This is the only reference to the format text, so nothing is copied. It goes on the input schema because tool
    descriptions are capped at 2,000 characters (`llm/deepseek/preflight.ts:124`), the format is about 6 KB, and the
    DeepSeek request sends tools without their `inputSchema` (`llm/deepseek/request-body.ts:194-201`). The tool's input
    reaches the provider inside the decision schema, which is the same route the legacy completion schema uses to
    carry the format.
  - The submit tool's description now points at the format and at testing first. A successful submission's evidence
    gains a `next` hint.
  - New optional input: `trial?: { candidateId, port }`. The result gains `trial`, the standing verdict for the final
    candidate, which is `undefined` when that candidate was never tested. `promotionAllowed` stays `false`, so the loop
    never promotes.
- **`candidate/index.ts`** exports `trial-gate.ts`.
- **`plan/flow-script-format.ts`** adds `AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE`: choose, choose, type a quantity,
  press add with `consequences: modify_existing`, then wait for confirming text.
  - It is a separate constant, and the `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` block is byte-identical to HEAD (checked
    by script).
  - Reason: putting the example inside the format first broke two byte ratchets outside my files:
    - `flow-bootstrap/tests/plan.test.ts:134`, under 6,000 bytes;
    - `llm/tests/evidence-loop-provider.test.ts:308`.
  - Keeping it separate also leaves the legacy default's prompt unchanged while candidate mode is measured against
    legacy.
- **Tests**:
  - New `candidate/tests/trial-gate.test.ts` (13 tests). It drives the real evidence loop with a scripted model and a
    fake port, and reads every refusal where the model reads it: the next decision's evidence, under
    `core.completion_check` or `core.test_candidate`.
  - `plan/tests/flow-script-format.test.ts` has 2 new tests. The example stays out of the format and out of the legacy
    completion schema. It also builds as written with the real web fixture: 6 nodes and a single press declaring
    `["modify_existing"]`.

## Commands run and observed results

All Core commands ran in `C:\Users\osrs_\FluxStuff\fxwork\t339\!FluxIQ`.

- **Fail-first.** I restored the HEAD versions of `authoring-loop.ts`, `contracts.ts`, `index.ts` and
  `flow-script-format.ts`, with `trial-gate.ts` removed and the new tests kept. Then I ran
  `vitest run .../candidate/tests/trial-gate.test.ts .../plan/tests/flow-script-format.test.ts`, which printed
  `Tests 15 failed | 9 passed (24)`: all 13 gate tests and the 2 example tests failed. My versions were then restored.
  - This run used an earlier draft with the example inside the format. The final split was checked by the full run
    below.
  - Most gate tests fail first on the missing tool id or export, so this shows the tests depend on the new code. It
    does not show each assertion separately.
- **Owning and caller tests.** From `packages/fluxiq` I ran
  `../../node_modules/.bin/vitest run` over `flow-bootstrap/candidate/tests`, `flow-bootstrap/plan/tests`,
  `service/flow-bootstrap-commands/tests/candidate-generation.test.ts`,
  `conversations/commands/tests/extension-chat.test.ts`, `flow-bootstrap/tests/plan.test.ts` and
  `llm/tests/evidence-loop-provider.test.ts`. It printed `Test Files 20 passed (20)`, `Tests 185 passed (185)`.
  - That includes `trial-gate.test.ts (13 tests)`, `authoring-loop.test.ts (7 tests)` and
    `flow-script-format.test.ts (11 tests)`.
  - The caller tests run the real service's candidate path, which injects no port. They still end as a draft.
- **Typecheck.** `../../node_modules/.bin/tsc --noEmit -p tsconfig.json` (non-incremental) printed `tsc exit: 0`. One
  earlier run failed on a test helper type (`JsonValue | undefined`). I fixed it and the re-run passed.
- **Structure audit.** `node scripts/structure-audit.mjs` printed
  `structure-audit: passed (283 warning(s), 349 baselined).`, exit 0.
  - No warning names a file I added or changed.
  - The two `plan/` warnings were there before: 25 source files in the directory (I added none) and `validation.ts`
    at 497 lines.
- **Biome.** `biome check` on the changed files reported that the paths are ignored by the configuration, so nothing
  was linted.

## Not verified

- No provider call, Lab run, live build or panel. The format's reach to the wire is shown only by the decision schema
  the loop builds, which the test asserts contains the format text, not by a recorded provider request.
- How the real loop's repeat and no-progress guards treat many `core.test_candidate` calls in a long build. The tests
  cover short scripts only.
- Whether `modify_existing` is the class the instruction-consequence read gives "add to cart" on the Lab tasks. Core
  tests use both `modify_existing` and `create_new` for it. See Open questions 3.
- I did not run the full Core suite, per the twice-a-day rule.
- Line endings: Git warns that several changed files are LF in the working copy and will become CRLF. Git normalises
  them on commit. No content change.

## Open questions or contradictions found

1. **Without a port, completion is accepted, not refused.** The brief says that with no port "completion is refused
   (candidate mode then still ends as a draft, as today)". Both cannot hold.
   `service/flow-bootstrap-commands/candidate-generation.ts:70` throws whenever the loop does not end `ok`, so a
   refused completion would make every candidate build stall and throw, not save a draft. It would also break the
   existing callers' tests (`candidate-generation.test.ts`, `extension-chat.test.ts`). I kept "ends as a draft, as
   today":
   - without a port, the test tool answers `candidate.trial_unavailable`;
   - completion on the latest valid submission is accepted;
   - the loop result's `trial` is `undefined`.

   Every refusal case in the brief is enforced whenever a port is injected. If the supervisor wants the literal
   reading, U2 must first change `candidate-generation.ts` to save a draft from a loop that did not end `ok`.
2. **The trial request carries `candidate` as well as the pinned fields.** A port given only
   `{ candidateId, revision, digest, signal }` cannot find the plan to run. The submission controller lives inside the
   authoring loop. `candidateId` is only minted at persistence (`candidate-generation.ts:79`), after the loop. No store
   holds per-revision submissions either. So I pass the exact submission, frozen, as `candidate`. The addition is
   additive: a port written against the pinned four fields still type-checks.

   Before calling U2, the caller has to supply `trial.candidateId` up front. Today the id is minted after the loop, so
   U2 must mint it before the loop and reuse it for the draft record. U2 should also check that
   `fingerprint(candidate)` equals `digest` before running.
3. **The design's example said `consequences: none` for the add press. I used `modify_existing`.**
   - The format's own rule says `none` is only for presses that reveal, open, filter, sort, tick, dismiss or navigate.
   - Live builds already under-declared presses (`flow-script-format.test.ts` comments).
   - Core tests read "Add to cart" as `modify_existing` (`judged-build.test.ts:288`) or `create_new`
     (`instruction-authority.test.ts:161`).

   If the Lab's instruction read gives the cart `create_new`, a candidate that copies the example could reach the
   permission gate. U2 or the live probe should check this. The example deliberately omits lane A's coupon "collect"
   press: its class is uncertain, and Core must not encode page knowledge.
4. **The example is not part of the format constant.** The legacy completion schema still shows only the format, so
   legacy builds do not see the act example. Extending legacy needs the two byte ratchets above raised by their owners.
5. **For U2:** `standing()` returns the last verdict for the final candidate's exact revision and digest. U2's
   promotion should read the loop result's `trial` and require `verdict === "yes"` and a matching revision and digest
   before re-reading the authoritative draft.

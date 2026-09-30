# t174-w3 — bigbox pickup-cart refusals (`run-muncqlr0-3348202b`)

## Outcome

Done. The full six-stage debug is at
`docs/working/language-driven-flow-loop-plan/debugs/run-muncqlr0-3348202b.md`. The run reached
stage 2 only; stages 3 to 6 are recorded as not reached, with the gaps marked `NO EVIDENCE:`
and the file that drops each one.

## What changed and why

Only the two files this brief owns:

- `debugs/run-muncqlr0-3348202b.md` is the debug, following `run-debug-template.md`.
- `reports/t174-w3-bigbox-refusals.md` is this report.

No product code, Current State, ledger or shared document was touched.

## Findings

1. **The build never got past the first act.** 37 decisions: 26 tool_call (15 executed, 11
   answered from memory in runs of 4 and 7), 9 amend_draft and 2 complete. The store chip was
   opened 6× and Millbrook picked 3×. No search, product page or Add to cart ever ran.
   `pick-millbrook` reloads the page (`set-store`, then `location.reload()` in
   `client/shell-script.ts`) and was never a proposed draft step at either dry run. Either its
   `effectApplied` was false or an amendment withdrew it; the trace cannot say which.
2. **`completion_profile_limit_exceeded` was not the 16-node limit.** The plan was drafted
   (every proposed step was `core.run_node`), so the Flow limits applied: `maxNodesPerSubflow:
   64` (`plan/limits.ts:7`, `profile-limits.ts:66`). The draft held 2 nodes. By elimination
   (names are clamped to 120, a click has 6 parameters, 2 nodes cannot approach 64 KiB), the
   limit was `maxSummaryLength: 240` at path `summary` (`profile-limits.ts:54`). The cause is
   that `fromDraft` (`bootstrap-completion.ts:348`) passes the model's summary untruncated,
   while the reply path truncates it to 240 (`authoring/accept.ts:84-87`). This is inferred,
   not observed.
   The task genuinely needs 20 action nodes, which is more than 16 but within the drafted 64.
   `16` binds only if Core falls back to a model-written plan, when any proposed step is not
   `core.run_node` (`llm/node-tools/draft-step.ts:104`). t175 and dev did not change the
   limits: nothing in `git log 259a11b..dev -- runtime/flow-bootstrap/plan/`, and dev's
   `limits.ts` still reads 64 / 16.
3. **`cannot_reach_start_location`** (`reachability/check.ts:82`). Core's initial call was an
   inspect on an already-loaded page, so no arrival step ever ran, and `start-step.ts:68-70`
   had nothing to restore. It was corrected by `nav-start` at iteration 24.
4. **`instructed_act_missing`** (`instructed-acts/check.ts:31`). Core extracts only 2 acts
   from this instruction: `a1` switch and `a2` add. The napkins add is folded into `a2`, and
   both quotes are the same 200-character clip. At completion #2 the draft kept only
   `nav-start` and a chip click, and **no step anywhere in the build added to a cart**, so `a2`
   genuinely had no step. `a1` had no store-switching step either. Which act the refusal
   named: NO EVIDENCE.
   The same check **passed** at completion #1 with a consent click and a chip click, because
   leftover claims are assigned in order (`check.ts:137`) and only "kept + mutating +
   unclaimed" is verified.

## Causes, ranked

| # | Cause | Owning file | Fix |
| --- | --- | --- | --- |
| 1 | Store switch via reload never kept, so the loop repeats the first act until the build ends | Core `runtime/llm/evidence-loop.ts` draft recording, plus the domain click post-condition across a reload | Report a reload-causing click as applied with the new state, and show the chip's new text after the action |
| 2 | Draft-path summary measured against 240 untruncated | Core `runtime/llm/harness-options/bootstrap-completion.ts:348` | Bound it as `accept.ts` does, or skip `maxSummaryLength` for `source === "draft"` |
| 3 | No arrival step when the build begins on its start location | Core `runtime/flow-bootstrap/reachability/start-step.ts` | Write the navigate-to-start step when the build began there |
| 4 | In-order claim fallback passes unrelated clicks as acts | Core `runtime/flow-bootstrap/instructed-acts/check.ts:137` | Require a claim to name its act |
| 5 | One `add` act for two objects | Core `runtime/flow-bootstrap/instructed-acts/instruction-acts.ts` | One act per coordinated object, each with its own quote |
| 6 | 11 answered-from-memory decisions | Core `runtime/llm/evidence-loop.ts:704-717` | Redirect earlier and say explicitly that nothing changed |

## Throw after `pick-millbrook-3`: candidates only (not hunted, per brief)

The last trace line is `tool end … pick-millbrook-3 … web.action.succeeded` at 00:23:05.830.
There is no `decide start iteration=38`, and the failure record is at 00:23:05.964. Between
the `executeTool` return (`evidence-loop.ts:736`) and the next decide:

- Inside the try, and so caught: `digest(callId)` for `stateAfter`, and
  `automationStudioLlmEvidenceParseToolExecutionResult`.
- Post-call tail, uncaught (`evidence-loop.ts:749-797`): `JSON.stringify(value)` / `Buffer.byteLength`;
  `callRecord`; `automationStudioLlmEvidenceLookWasRefused`; `draftRecord(...)`;
  `automationStudioLlmEvidenceRerunReplaced(draftSteps, rerunReplaces)` (changed in t173
  `02d9cfb`); `recordRow`; `noProgress.answerRepeats` / `cleared` / `stepped` / `redirect`.
- Returns, not throws, that a mislabelling path could also produce: `evidence_limit` (:751),
  `repeat_without_progress` (:795).
- The iteration-38 prelude (`evidence-loop.ts:512-540`): `automationStudioLlmEvidenceLoopRemaining`,
  then `exhausted("budget")` (a return), which leads on to the incomplete-draft save added in
  `f725490`, outside this file. None of the bounds should have bound: `maxIterations` resolves
  to 47 (48 minus 1 reserved), duration is 540 s against 244 s elapsed, and $2 / 2.688M
  tokens were not approached as far as can be seen, although the tokens themselves are not in
  the bundle.
- Before `input.decide` is called, inside its try: `buildAutomationStudioLlmEvidenceLoopDecisionSchema`,
  `automationStudioFlowDraftEntry`, `automationStudioLlmEvidenceLoopDraftShown` and
  `automationStudioLlmEvidenceContextWindow`. These throw into the catch, which re-throws only
  with `propagateDecisionErrors`, and `decide start` would already have been logged by then.
  They are therefore **ruled out**, because `decide start iteration=38` is absent.

## Commands run and observed results

- `grep "build-trace" logs/core.log | wc -l` printed 121 trace lines. They were read in full
  and tabulated in Stage 2.
- `node --experimental-strip-types` on a scratch module importing Core
  `instructed-acts/instruction-acts.ts` with the task text printed 2 acts: `a1` set/switch and
  `a2` add_to/add, with identical 200-character quotes.
- `git log --oneline 259a11b..dev` in Core printed t180, t178, t175 (`98133e7`), t183 and t177.
  `git log dev -- …/flow-bootstrap/plan/{limits,profile-limits}.ts` printed only `e82089f` and
  `e55a141`, both before the run.
- `git diff 259a11b dev -- …/bootstrap-completion.ts` shows only the restored-step reporting;
  no limit changes.
- File mtimes of `limits.ts` and `profile-limits.ts`: 2026-09-29 13:54 -0700, before the run
  started (17:13 -0700).

No tests were run: the brief asked for a debug with no code change, and a live run is in
flight on this machine.

## Not verified

- Which limit tripped at completion #1. `maxSummaryLength` is by elimination only.
- Which act and reason `instructed_act_missing` named.
- Why `pick-millbrook` (pos 12) was not proposed: `effectApplied: false` or withdrawn by the
  iteration-21 amendment.
- Why pos 11 was unreproducible in dry run 1. The hypothesis is that the chip's text changed.
- The store actually set after `pick-millbrook-2`/`-3`.
- Whether the Core working tree's uncommitted state at run time equals its state now. The run
  records `dirty: true` without a diff.

## Open questions or contradictions found

- **The lane summary's "20 action nodes vs `maxNodesPerSubflow: 16`" does not describe this
  run.** A drafted plan gets 64 nodes, and the draft here had 2.
- **The bundle says "Core made none" and 0 calls, but `core.log` shows 37 decide round trips**
  over 244 s. Every accounting field is `null`. This is the mislabel being fixed separately; the
  cost of this run is unknown.
- **The build was given a start location but began on the page already.** `reachability/check.ts`
  assumes those two never coincide. Is the Lab now opening the scenario before the build?
- **Instructed-acts check (`instructed-acts/check.ts`).** Completion #1 passing it with two
  clicks unrelated to either act suggests the check is weaker than the t173 close claims
  ("completion refuses a Flow missing the instruction's lasting acts").

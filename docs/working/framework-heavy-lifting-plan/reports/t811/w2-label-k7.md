# t811 / w2-label-k7 (Core)

## Outcome
Partial. Goal B (K7 latest-by-default) done and passing. Goal A (`from` by script label) NOT done: the latest proposal keeps no step label, and the brief says to report that before inventing a store.

## Where labels live (Goal A finding)
- A script's `step <label>:` is read in `flow-bootstrap/authoring/assemble.ts` (`buildSteps`, about lines 488-533). It makes `labelKeys` / `keyByLabel` maps (label -> `${prefix}s${index+1}`). Those maps are local to that call, and some are held in `GraphUnderConstruction` while the plan is assembled. None reaches the plan.
- The plan node (`plan/contracts.ts` `AutomationStudioFlowBootstrapNode`) has `label`, but that is the Core-derived described name (R3-U-12), not the script label. Node `metadata` only carries `fluxiq.entry` and `fluxiq.checkpoint`.
- `AutomationStudioSubflowProposal` (`subflow-candidate/contracts.ts`) holds `subflows`, `summary`, `changedPaths` and `unneededInputs`. It has no label map and no script text.
- Keys are positional: `s<N>` over the acting steps of a block, with a prefix for other blocks and parts. The test in `submit-then-sequence.test.ts` (W1's) expects `from: "second"` to map to a key. It fails with `subflow.from_step_unknown`, steps `["s1","s2"]`, until a label store exists.
- Smallest store I would propose (needs a decision, and touches W1's files `submit-tool.ts` / `index.ts`):
  - Add an optional `stepLabels?: Readonly<Record<string, readonly string[]>>` to `AutomationStudioSubflowProposal`, mapping a label to the keys that carry it. Count the "two or more" case on duplicate labels across blocks.
  - Fill it where the submission is assembled, from `built.keyByLabel` / the parsed script blocks (`scoped-submission.ts` already parses `result.flow` with `parseAutomationStudioFlowScript`).
  - `from-step-run.ts` would then resolve exact key first, then a label naming exactly one key. Otherwise it answers `subflow.from_step_unknown` with the keys plus their labels. The answer carries `from` (the key) and `fromLabel`. `pending-repair.ts` is untouched because it already works by key.
- Nothing in `from-step-run.ts`, `repair-words.ts` or `pending-repair.ts` was changed.

## What changed (Goal B)
- New `flow-bootstrap/test-call-pair.ts`: `automationStudioCandidateTestPair(revision, digest)` returns `latest` (both omitted), `pair`, `half` (one of the two, with the instruction "Give both revision and digest ... or leave both out ...") or `malformed`. It sits at the flow-bootstrap root, imported by relative path (precedent: `candidate/submission.ts` imports `../explored-interruptions.ts`). It is not added to `flow-bootstrap/index.ts` (not mine). I first tried `candidate/test-pair/` and `candidate/test-pair.ts`, but the structure audit refuses both (25-file limit, 9-segment depth).
- `candidate/trial-gate.ts` (800 lines, was 797): `revision` and `digest` are optional in the schema (`required` removed). The description says "Leave revision and digest out to test your latest submitted candidate, or give both exactly as core.submit_candidate returned them; a pair that is not the latest is refused." A half pair gets `candidate.trial_input_invalid` with the instruction. The stale check only runs for a supplied pair, with the same refusal and `latestRevision` / `latestDigest`. With no proposal the answer is as before.
- `subflow-candidate/test-input.ts`: the call type has optional `revision` / `digest`, and the schema drops `required`. A half pair gives `subflow.trial_input_invalid` with the instruction. The invalid-input text is reworded.
- `subflow-candidate/subflow-trial-gate.ts` (798 lines, net 0): `earlierBrief` is only asked for a supplied revision, the stale check only runs for a supplied pair, and `earlierRevision` is only added when a revision was supplied. Both tool descriptions (subflow and whole) say the same generic words. The `from` path works without a pair (it uses the latest).
- Tests:
  - `subflow-candidate/tests/subflow-trial-gate-latest.test.ts` (new): latest default, no `required`, stale pair refused with `latestRevision` / `latestDigest`, half pair refused, and the no-proposal answer.
  - `candidate/tests/trial-gate.test.ts`: a new `describe` appended (two import names added). It is not a new file because `candidate/tests/` is at the 25-file limit.
  - Label cases under `tests/from-step/`: not written (Goal A blocked).

## Commands run and observed results
All inside `heavy-check.lock` (waited about 3 hours for it behind another lane's full sweep).
- `tsc --noEmit -p .` printed only 3 errors, all in W1's `subflow-candidate/tests/builder-loop-auto-complete.test.ts` lines 24, 37 and 45 (TS2322, `revision: JsonValue | undefined` in a step input). None are in my files. An earlier run of mine had TS2345 at `subflow-trial-gate.ts(510)`; I fixed it.
- `FLUXIQ_TEST_GROUP=parallel npx vitest run .../subflow-candidate .../candidate`: `Test Files 4 failed | 64 passed (68); Tests 6 failed | 422 passed (428)`. None of my new tests fail. The 6 failures are:
  - `builder-ending.test.ts` (2): "expected '[]' to contain 'subflow.ending_after_yes'" and "Cannot read properties of undefined (reading 'instruction')".
  - `builder-loop-auto-complete.test.ts` (2): W1's new file.
  - `builder-trial-view.test.ts` (1): `expected undefined to match object { partial: true, verdict: 'yes' ...}`.
  - `submit-then-sequence.test.ts` (1): W1's, needs Goal A (see above).
  I believe `builder-ending` and `builder-trial-view` fail from W1's in-flight `builder-loop.ts` changes, but I did not trace them and did not run them against a tree without W1's edits.
- `node scripts/structure-audit.mjs`: 2 violations, both `directory-files`: `subflow-candidate/` has 28 source files and `subflow-candidate/tests/` has 30 (limit 25). W1's new files (`builder-auto-complete.ts`, `builder-test-call.ts`, `submit-then*.ts`, and 4 test files) account for them. My one new file there (`subflow-trial-gate-latest.test.ts`) is in `tests/`, as the brief names it, and is one of the 30. No violation comes from `candidate/` or my helper.

## Not verified
- Goal A, in all its parts.
- Whether the 6 vitest failures are all W1's. I did not run them in isolation.

## Open questions
- Permission to add the `stepLabels` field and its fill (touches W1's `submit-tool.ts` and `index.ts`, or `scoped-submission.ts`), or another source for the label map.
- `subflow-candidate/` and its `tests/` need a split by feature (a shared prefix such as `builder-*` or `submit-*`); the lead should decide who does it.
- Add `test-call-pair.ts` to `flow-bootstrap/index.ts` if a barrel export is wanted.

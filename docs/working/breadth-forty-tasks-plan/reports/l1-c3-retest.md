# l1-c3-retest report

## Outcome

Done. If an action applies nothing and answers `ok: false`, the loop now treats it as answered only until the next call runs. That next call can be a look. After it, the identical request runs again and reaches its tool. If nothing runs in between, the identical request is still answered `llm_evidence_loop.already_answered`. The no-progress guard still stops an endless refuse -> look -> refuse loop.

## What changed and why

All changes are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ`, under `packages/fluxiq/src/programs/automation-studio/runtime/llm/` (`LLM/`).

- New `LLM/refused-action-retest.ts`, with one export: `automationStudioLlmEvidenceRefusedActionRetest(answeredRequests)`. It holds the signature of the last refused action:
  - `callRan()` deletes the held signature from `answeredRequests`.
  - `settled(signature, tool, result)` holds a signature when the tool is an action (`effect === "mutate"` or `perCallEffect`) and `automationStudioLlmEvidenceNothingHappened` is true for its result.
- `LLM/evidence-loop.ts` is still 800 lines:
  - It builds the holder beside `answeredRequests`.
  - `runCall` calls `retest.callRan()` just before it records its own signature, and `retest.settled(...)` just after the existing refused-look delete.
  - To stay within the line budget I merged three comments into fewer lines. Their content is unchanged apart from the added pointer.
- `LLM/repeat-policy.ts`: added a header paragraph stating the new rule, the live run it came from, and what bounds it.
- `LLM/tests/repeat-policy.test.ts`: added a `describe("an action refused until a look ran")` block with three tests. They use generic tool ids (`inspect`, `press`) and a fake press that is refused until a look has run:
  1. Press, look, then the identical press: the tool is invoked twice (`["press","inspect","press"]`), the second press applies, and its `pressed` evidence is shown to the next decision.
  2. Press twice with nothing between: the second press is `already_answered` and the tool runs once.
  3. A press that is refused forever, alternating with looks: the loop ends `llm_evidence_loop.repeat_without_progress` after fewer than 10 tool calls, and the press reached its tool more than once.
- No existing test pinned the old behaviour, so none was changed. The existing "does not let the same refused action be asked for again" test (no call between) still passes unchanged.
- I first put the tests in a new `tests/retest-after-look.test.ts`. That pushed `LLM/tests/` to 26 files, over the structure audit's 25-file limit, so I moved them into `repeat-policy.test.ts` and deleted the new file. The brief allowed either location.

## Commands run and observed results

- `npx vitest run .../llm/tests/retest-after-look.test.ts .../llm/tests/repeat-policy.test.ts`: 2 files, 10 tests passed.
- Mutation check: with `retest.callRan()` commented out, 2 of the 3 new tests failed ("runs the identical request again after the look", "still ends a refuse, look, refuse loop"). The file was then restored from a scratch copy and `grep` confirmed line 406 reads `retest.callRan();` again.
- `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/llm`: 220 test files and 2109 tests passed. This run was made while the tests were still in the separate file.
- After moving the tests into `repeat-policy.test.ts`, I ran only that file: 1 file, 10 tests passed.
- `node scripts/structure-audit.mjs`:
  - First run: 2 FAIL, `llm/tests/` at 26 files (mine) and `flow-bootstrap/candidate/tests/` at 26 files (not mine).
  - After the move: exit 0, "structure-audit: passed (409 warning(s), 1152 baselined)". `llm/tests` now has 25 files. The only warning on my files is the existing advisory `evidence-loop.ts: 800 lines`.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit`:
  - First run: 1 error outside my files, `flow-bootstrap/site-reset/tests/start-check.test.ts(233,63)` TS2322, the `controls: unknown` type.
  - Final run: no errors. The concurrent worker on `flow-bootstrap/` evidently fixed it.

## Not verified

- The whole llm directory was not re-run after the tests moved into `repeat-policy.test.ts`; only that file was. The source was the same in both runs.
- No live run.
- The repeat guard (`repeat-guard/outcomes.ts`, which I did not touch) records a refused action as `failed` under its tool, its input and the page digest. A domain that reports state digests could therefore hit two cases:
  - If the look leaves the digest unchanged, the identical retest is still refused unrun as `llm_evidence_loop.repeat_refused`.
  - The exceptions are a refusal that names a precondition (t587), a handle not yet shown, or an invited resend.
  - In office r2 the guard did not fire, because the retests reached `already_answered`. So the trial tool's calls are either not digest-keyed or are lifted.
  - My tests use no digests. Whether `core.test_subflow`'s refusal ("read that list first") would be lifted by the guard on a digest-reporting page has not been checked.

## Open questions or contradictions found

- See the repeat-guard caveat above. If a live rerun shows `repeat_refused` on the retest after a look, then a refusal that is lifted by a look also needs to be taught to the repeat guard, for example as a precondition met by a non-refused look. That would be a separate brief owning `repeat-guard/outcomes.ts`.

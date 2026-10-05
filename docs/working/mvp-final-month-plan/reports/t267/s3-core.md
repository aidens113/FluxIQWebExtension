# t267 S3 Core (blocker 1, Core part): worker report

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t267/!FluxIQ` (branch `task/t267-adaptation-loop-unblock`). No commits. `A` = `packages/fluxiq/src/programs/automation-studio`.

## Outcome

Done.

## What changed and why

- `A/api/handlers/runtime-execution.ts`: when `runIntent` is valid and there is an actor, the handler now resolves `service.conversations.callerFor(request.actor)`. If the caller is `keyLocked` (a paired `client-gateway:` session whose person has no unlocked session), no `llmExecution` is built, so the Flow runs deterministically as it did before. The handler does not refuse the run and adds nothing to the answer. Otherwise `llmExecution` uses `caller.userId` and `caller.sessionId`. For a person's own session, `callerFor` returns the actor unchanged, so its behaviour does not change. The order of the existing checks is the same: an unsupported intent is still refused first, then a missing actor. A comment in the file's style explains why.
- `A/runtime/service/runtime-adaptation/result-check.ts`:
  - Added the exported type `AutomationStudioResultCheckCallerPays = "every_run" | "repair_checks"`, with a doc comment that cites MVP item 23.
  - `resolveAutomationStudioResultCheckProvider` takes a new optional `callerPays`. If it is absent or `every_run`, behaviour is unchanged. Under `repair_checks`, `resolveCallerProvider` is consulted only when `check.decision.check === true` and the code is `afterRepair` or `afterRefutation`. In every other case the caller's provider is not resolved at all, and the call falls through to the existing standing-authorization path, which is unchanged.
  - Added a private helper `automationStudioResultCheckJudgesRepair`.
  - The doc comment says that nothing passes `repair_checks` yet.
- Tests:
  - `A/api/handlers/tests/runtime-execution.test.ts`:
    - The service mocks now carry `conversations.callerFor`, built on the real `automationStudioConversationEffectiveCaller`.
    - New cases: a paired client with an unlocked session gets `llmExecution` on `session.unlocked`; a paired client with none gets no `llmExecution` and the run still runs, with the same answer keys; a paired client with an unsupported intent is still refused and nothing runs.
    - The existing person-actor test now has an unlocked session available and still expects `session.one`.
  - `A/runtime/service/runtime-adaptation/tests/result-check.test.ts`: a new describe block covers:
    - a check that each fixture reaches its intended schedule code;
    - under `repair_checks`, the caller pays for `afterRepair` and `afterRefutation`;
    - under `repair_checks`, the caller pays for none of `initialWindow`, `intervalReached` or `reaskUnsettled` and is never asked; with an authorization the standing path pays (capped at 0.05), and without one the result is undefined;
    - under `every_run` and when absent, the caller pays for all five codes.
- Line endings: this worktree has `core.autocrlf=true`, so the four files were checked out as CRLF (one was mixed). I wrote all four as LF. `git ls-files --eol` shows `i/lf w/lf`, and the diff is +155/-6 with no whole-file churn.
- Docs: none. `callerPays` is not reachable from the public exports, because `runtime-adaptation` is not re-exported from `A/runtime/index.ts` and `framework-reference.md` has no mention of it. `docs:check` confirms the reference is current.

## Commands run and observed results

- Fail-first:
  - `result-check.test.ts` before the source change: 1 failed / 18 passed. The failure was "initialWindow: expected 1 to be +0", because the caller was asked.
  - `runtime-execution.test.ts` before the source change: 2 failed / 6 passed (the two paired-unlocked and paired-locked cases).
- In `packages/fluxiq`, I ran `npx vitest run src/programs/automation-studio/api/handlers/tests/runtime-execution.test.ts src/programs/automation-studio/runtime/service/runtime-adaptation/tests/result-check.test.ts src/programs/automation-studio/api/handlers/tests/conversations.test.ts` twice. Both runs: Test Files 3 passed (3), Tests 44 passed (44), exit 0.
- From the Core root:
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0 (step fluxiq:check, inputs changed, 22682 ms).
  - `node scripts/structure-audit.mjs`: exit 0, "structure-audit: passed (247 warning(s), 349 baselined)."
  - `pnpm.cmd docs:check`: exit 0, "structure-audit: passed (0 warning(s), 0 baselined). Deterministic framework reference is current."

## Not verified

- Live behaviour: I made no extension run with a real paired client or real Secret Keys unlock.
- I did not wire `callerPays: "repair_checks"` into the service, because that file was out of scope. The new branch is therefore exercised only by unit tests.
- I did not run any full suites.

## Open questions or contradictions found

- The brief says to "add nothing to the answer" for a key-locked paired run. That means the extension cannot tell from the response that the model was skipped because the key was locked. If it should surface that, it is a follow-up for the lead.
- The handler now requires `service.conversations` to exist. The real `AutomationStudioService` always constructs it, but any other test that registers the run endpoint with a bare mock service and sends a `runIntent` would throw. Only the edited test file does this among the files I ran. I did not search the wider suite.

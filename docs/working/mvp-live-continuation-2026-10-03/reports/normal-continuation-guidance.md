# Normal continuation guidance implementation

Status: focused owners passed; worker source frozen. Worker: resume-cd. Date: 2026-10-03 local.
Brief: `normal-continuation-guidance` in both t262 coordinators. Only the four released Core owners changed; no service edit.

## Changes

Core runtime paths relative to `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `conversations/commands/explore.ts`: existing explore capability now explicitly describes building an unapplied Flow or continuing a compatible unfinished draft on that same Flow. Continuation phrases added. Optional instruction describes a genuinely changed goal, with saved goal reused when omitted. Execution, application, permissions and consequences unchanged.
- `conversations/instructions/prompt.ts`: conditional guidance distinguishes unfinished creation through offered explore, genuine applied-step improvement through offered improve, and explicit separate creation through offered createHere. Repeating a task does not itself change the saved goal. Names alone do not prove task fulfillment. Ambiguous Flow selection remains a question; authoritative compatibility remains service-owned. No capability forcing or refusal fallback.
- `conversations/instructions/tests/prompt.test.ts`: missing continuation/unchanged-goal/improvement/name-only distinction regression and capability availability coverage.
- `conversations/commands/tests/extension-chat.test.ts`: real registry/service/conversation fixture keeps failed creation then continues via explore without instruction. Asserts resumed revision1/two draft steps/one proposable search step, original Flow identity, unchanged instructions, judge invocation before any adaptation application, eventual search topology and no unreported background errors. The second retained step is the initial passive observation. Permission-request command seam separately asserts no apply call; this seam is scripted rather than real permission parking. Existing real improve decline/accept fixture remains green.

No new capability, public wire field, permission, budget or service routing change. The supervisor separately owns idempotent identical-goal saving; unchanged supplied-instruction continuation is still dependent on that unit and is not claimed fixed here. No extra source fixture for that dependency was added to this partition.

## Observed validation

Fail-first focused run: prompt regression failed because existing prompt lacked continuation guidance. Registry fixture initially failed an incorrect expectation of one retained draft step; actual resumed record had two, including passive initial observation. Corrected the fixture to its known actual shape. A subsequent fixture expectation of exactly one judge call was also too narrow (two occurred); corrected to require at least one and zero applied adaptations at every judge call. These two failures were fixture assumptions, not product defects.

First command incorrectly used `packages/fluxiq/`-prefixed test paths with package-filter exec and found no tests. Corrected immediately to package-relative `src/` paths; that command provides no validation evidence.

Final owning run: **15/15 tests passed in two files**, 24.00s, heavy slot b1, session30174, exit0. Scoped `git diff --check` exit0. Exact command, from paired Core checkout:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 continuation owners final' pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/conversations/instructions/tests/prompt.test.ts src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts
```

No package typecheck, build, full suite, provider/network request or live browser run performed by this worker. Scripted model fixtures verify actual command/service wiring, not stochastic model selection. Supervisor independently validates source/types and coordinates the remaining service dependency and normal UI live continuation. Source frozen after final focused run; only this worker report written downstream. No shared docs, stores, profiles, environment, slots, guards, commits or pushes changed.

Supervisor follow-up: combined 13-file/194-test run passed, then Core typecheck identified TS2352 in the permission-pending seam's incomplete context cast. Worker removed the cast and supplied required conversationId/startLocation and a fully typed host (empty pending asks, absent ask, unexpected direct turn write throws). The command does not use this host; the tested behavior is unchanged. Scoped diff check passed again. Per supervisor's narrow instruction no redundant owner test rerun was performed; package typecheck confirmation remains supervisor-owned. Source frozen again.

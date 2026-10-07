# t348 U4: Lab candidate lane and the start hook

Worker: t348-candidate-lane. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t348\` (both repos, branch
`task/t348-lab-candidate-lane`). Nothing committed.

## Outcome

Done. The Lab can now run a creation in candidate mode, and refuses before any provider call when it should:

- **Core:** a new start hook built from deployment settings. `FLUXIQ_CANDIDATE_START_URL` plus the optional
  `FLUXIQ_CANDIDATE_START_TOKEN` are read where the panel's service is constructed. Both are unset by default and in
  every product deployment.
- **Core readiness:** the API's generation readiness now reports `capabilities.candidateTrial.startReset`.
- **Lab, when admitted:** candidate mode is admitted only when Core reports the trial runner and the hook is set. The
  Lab starts its candidate-mode Core with the hook pointed at the run's own Scenario Lab reset (the t336 reset).
- **Lab, when the candidate stays a draft:** the lane fails with `runtime.behavior` and gives the candidate id and
  verdicts. Nothing is applied or run.
- **Lab, when the candidate is promoted:** the lane goes on to the same reset, playback and oracle a legacy build
  gets. The evidence records:
  - the authoring mode;
  - the candidate;
  - every trial;
  - the verdict;
  - the promoted proposal.
- **Legacy mode:** behaves as before. Its Core environment is unchanged and it makes no readiness read.

The provider-free dry run of the campaign's exact command answers `status: ready`, with
`candidateTrial: {trialRunner: true, startReset: true, source: "lab-plan"}`.

## What changed and why

Files proposed and edited (the brief asked me to propose the Core files first). As a worker I recorded them here and
went ahead.

### Core (`C:\Users\osrs_\FluxStuff\fxwork\t348\!FluxIQ`)

- **New `packages/fluxiq/src/programs/automation-studio/runtime/candidate-start-hook/`:**
  - `environment.ts`: `AUTOMATION_STUDIO_CANDIDATE_START_HOOK_ENV`, the variable names.
  - `from-environment.ts`: `automationStudioCandidateStartHookFromEnvironment(env, {fetch, timeoutMs})`.
    - Unset gives no hook.
    - A token with no URL, a non-http(s) URL or a URL with credentials throws, naming the variable.
    - A set hook POSTs `{}` with `Authorization: Bearer <token>`, `redirect: "error"`, the trial's abort signal and a
      15 s timeout.
    - It returns the endpoint's JSON object, capped at 16 KiB. A non-2xx answer or a non-object throws.
    - Error text never contains the token.
  - `index.ts`: the barrel, re-exported from `runtime/index.ts`.
- **`packages/fluxiq/src/programs/_shared/runtime.ts`:** builds the hook from `process.env` and passes
  `prepareCandidateStart` to `AutomationStudioService`. This is the one place the panel's service is constructed, via
  `FluxIQ.create` and `createGlobalProgramRuntime`.
- **`api/contracts/adaptation.ts`:** `capabilities.candidateTrial` gains `startReset: boolean`, which the shared
  constant sets to false. The parser requires it to be a boolean.
- **`api/handlers/llm-generation.ts`:**
  - Readiness sets `startReset` from the service's `candidateTrial.startReset`, and only from there.
  - The handler now treats a payload whose only key is `authSessionId` as empty. The web route adds that key to every
    signed-in person's POST to automation-studio, so the Lab's control client, which only POSTs, could never read
    readiness before. Any other field is still refused.
- **Tests:**
  - New `runtime/candidate-start-hook/tests/from-environment.test.ts` (8 tests).
  - New `_shared/tests/candidate-start-hook.test.ts` (3 tests). It checks that the product configuration (unset)
    gives `startReset: false`, that the Lab's variables give true, and that a half-set configuration refuses at
    start.
  - `api/handlers/tests/llm-generation.test.ts`: contract shape, parser refusals, `startReset` taken from the service,
    and a POST carrying only `authSessionId`.

### Downstream (`C:\Users\osrs_\FluxStuff\fxwork\t348\!FluxIQWebExtension`)

- **`flow-lane/creation/readiness.ts`:**
  - `assertCreatedFlowVerificationReady(mode, candidateTrial?)` refuses with
    `lab.candidate_verification_unavailable` when there is no trial runner, and with
    `lab.candidate_start_hook_unset` when the hook is not set.
  - New `labCandidateTrialReadiness({startsCore})`, asked before anything starts: it reads the linked Core's readiness
    contract and whether the Lab starts the Core itself.
  - New `readCreatedFlowCandidateTrialReadiness(control, domainId)`, asked once Core is running: it reads Core's own
    readiness through Core's parser.
- **New `flow-lane/creation/candidate-outcome.ts`:**
  - `CreatedFlowCandidateOutcome` is the record. It is built from one of three sources:
    - the `candidateTrial` audit on a promoted proposal;
    - the trial block in a direct build's draft;
    - a chat draft: the `candidate-draft` turn, with the verdict matched against Core's own
      `automationStudioConversationCandidateDraftSaid` words.
  - Trials come from `list-runtime-sessions`, filtered by `metadata.candidateTrial.candidateId` and `flowId`. Only ids
    and codes are kept, never a trial's Flow document.
  - `createdFlowCandidateDraftFailure` is the `runtime.behavior` / `lab.candidate_not_promoted` failure.
- **`flow-lane/creation/build-proposal.ts`:**
  - A candidate build sends `authoringMode: "candidate"`.
  - A promoted proposal carries `candidateOutcome`, and so does a draft.
  - `CreatedFlowBuild.candidateOutcome?` is added.
- **`flow-lane/creation/chat/build-from-chat.ts`:**
  - Takes `candidateTrial`.
  - Reads the draft turn only from this instruction's turns. When a candidate-mode build left no proposal, it waits up
    to 5 s for that turn, because Core writes it just after the result.
  - Records `candidateOutcome` on a draft and on a promoted, applied proposal.
- **`flow-lane/creation/lane.ts`:**
  - In candidate mode, asks the running Core's readiness first, before the blank Flow, the authorizer or the build.
  - Passes the readiness to the chat build, the direct build and approve/apply.
  - A draft throws the draft failure.
  - A candidate-mode proposal with no candidate attribution throws `lab.candidate_proposal_unattributed`.
  - The complete and incomplete evidence both carry `authoringMode`, and the incomplete one also carries `candidate`.
- **`flow-lane/creation/snapshot.ts`:** `flow-lane.json` gets `authoringMode` and `candidate`.
- **`flow-lane/creation/review-proposal.ts`:** takes `candidateTrial`.
- **`flow-lane/creation/index.ts`:** barrel export.
- **`environment.ts`:** `labCandidateStartHookEnvironment`. In candidate mode only, it sets:
  - `FLUXIQ_CANDIDATE_START_URL=http://127.0.0.1:<scenarioPort>/__control/reset`;
  - `FLUXIQ_CANDIDATE_START_TOKEN=<controllerToken>`.

  Inherited values are always dropped.
- **`cli.ts`:** two lines. Before anything starts, readiness uses `labCandidateTrialReadiness({ startsCore:
  target.mode !== "existing" })`, and the dry-run JSON reports `candidateTrial`.
- **Tests:**
  - `tests/readiness.test.ts`, rewritten (7 tests).
  - `tests/candidate-draft.test.ts`, with 3 candidate-outcome tests added.
  - New `tests/lane-candidate.test.ts` (4 tests).
  - New `tests/lane-harness.ts`: `runLane` moved out of `lane.test.ts` unchanged. `lane.test.ts` was 766 lines
    against an 800-line cap, and two test files now use the harness.
  - `tests/lane.test.ts`: two candidate tests updated, since candidate mode now does one readiness read.
  - `tests/fake-creation-core.ts`: a readiness endpoint, a `candidate-draft` generation, a `candidateTrial` audit and
    runtime sessions.
  - `chat/tests/build-from-chat.test.ts`: 4 candidate tests.
  - `src/tests/environment.test.ts`: 1 test.
- **Docs:** `docs/architecture/testing-facility.md` has a new "Candidate mode (t348)" paragraph in place of the old
  candidate refusal text.

## Commands run and observed results

All commands ran in the t348 trees.

- **Core owning tests:** `npx vitest run src/programs/automation-studio/runtime/candidate-start-hook
  src/programs/_shared/tests src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts
  src/programs/automation-studio/api/contracts/tests .../candidate-trial-facade.test.ts
  .../service-bootstrap/tests/generation.test.ts` reported "Test Files 12 passed (12); Tests 77 passed (77)".
- **Core fail-first:** I restored the HEAD versions of `_shared/runtime.ts`, `adaptation.ts` and `llm-generation.ts`
  and ran the new tests, then put my versions back. Result: "Tests 4 failed | 21 passed". The failures:
  - "constructs the service with the deployment's start hook": expected startReset true, got false;
  - "refuses to start on a half-set configuration": nothing was thrown;
  - the readiness shape test: {...(3)} against {...(4)};
  - the start-hook readiness test: undefined was not true.
- **Core typecheck:** `packages/fluxiq: npx tsc --noEmit -p tsconfig.json` exited 0. `apps/web: npx tsc --noEmit`
  exited 0.
- **Core structure audit:** `node scripts/structure-audit.mjs` reported "passed (287 warning(s), 509 baselined)" and
  "1 baseline entries can be lowered". I left the baseline unchanged and did not check whether that entry predates
  t348.
- **Core build:** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  passed. The test-runner compiles against Core's dist.
- **Test-runner typecheck:** `packages/test-runner: npx tsc --noEmit -p tsconfig.json` exited 0.
- **Test-runner build:** `pnpm --filter @fluxiq-web-extension/test-runner build` passed; Core's build is current with
  its source.
- **Test-runner tests:** `node --test dist/flow-lane/creation/tests/*.test.js
  dist/flow-lane/creation/chat/tests/*.test.js dist/tests/environment.test.js
  dist/extension-chat-check/prove/tests/chat-build.test.js dist/demo-llm-create-ui/tests/*.test.js
  dist/tests/cli-llm.test.js` reported "tests 212, pass 212, fail 0".
- **Downstream fail-first:** I restored HEAD versions of the 8 changed source files, compiled with the tests, ran
  them, then put my versions back. The compile showed 35 type errors (missing `candidateOutcome`, `authoringMode`,
  `candidateTrial`). Of the tests, 12 failed and 58 passed. The failures were all the new t348 lane, chat, readiness
  and environment tests plus the 2 updated lane tests. The candidate-outcome unit tests passed, because that module
  is new and was left in place.
- **Downstream structure audit:** `node scripts/structure-audit.mjs` reported "passed (176 warning(s), 182
  baselined)".
  - The first run failed `failure-as-empty`, because a failed trial-session read returned `null`. That read now
    propagates its error, and a test covers it.
  - No new `as never`: the diff adds none, and the audit's ratchet passes.
  - `creation/` has 24 files and `creation/tests/` has 24, against a cap of 25.
- **Campaign dry run:** `pnpm lab:campaign crossborder-marketplace-hub-to-cart --dry-run --authoring-mode candidate
  --max-attempts 1` printed the command:
  `pnpm lab run crossborder-marketplace --live-llm ... --authoring-mode candidate --llm-task create-flow
  --instruction-task crossborder-marketplace-hub-to-cart ...`.

  As t338 noted, the campaign's dry run only prints commands. So I ran that exact command through
  `FLUXIQ_LAB_INSTANCE=t348-dry node scripts/lab/run-lab.mjs ... --dry-run`. It exited 0 with
  `{"status":"ready","providerCallCount":0,...,"coreAuthoringMode":"candidate",...,"candidateTrial":{"trialRunner":true,"startReset":true,"source":"lab-plan"},"coreWeb":{"key":"2ef14964a7fcfd540b8f4256","cached":false}}`.
  - The same command in legacy mode gave `{"status":"ready","providerCallCount":0,"coreAuthoringMode":"legacy","candidateTrial":null}`.
  - The live guards skip `--dry-run`. No topology, browser or provider started, and no Lab process was left running.
  - The prelude rebuilt the ignored `.lab-instances/t348-dry` outputs for scenario-lab, the domain host and the
    extension.

## Not verified

- **No live run, and no Lab run that boots Core in candidate mode.** I did not observe a real Core reading the hook
  variables, a real trial calling the Scenario Lab reset, or the reset's answer being recorded in the trial record.
  The hook's request shape matches the reset endpoint (POST, empty JSON body, bearer token), and unit tests cover
  that shape, but no end-to-end run proved it.
- **The production-built Core web panel reading the variables at runtime.** It reads `process.env` server-side in
  `createGlobalProgramRuntime`, so it should pick them up, but I did not boot the Next build to see it.
- **A draft through the chat path, live.** Its spend stays unknown, as it was before t348, because the chat's draft
  turn carries no accounting. I did not check how the live settlement treats that. Unit-level, the budget check does
  not refuse unknown spend.
- **The chat-path verdict on a real draft.** It is matched against Core's own words, so a future change to that
  wording in Core reads as `unknown` rather than a wrong verdict.
- **Not run:** the full suites (`pnpm check`, `pnpm test`, Core's whole vitest), per the twice-a-day rule.
- **The `existing`-target refusal through the CLI.** Unit tests cover `labCandidateTrialReadiness({startsCore:
  false})` refusing with `lab.candidate_start_hook_unset`.

## Open questions or contradictions found

1. **Edits outside the listed owned paths:**
   - downstream `packages/test-runner/src/cli.ts` (2 lines), which is the CLI's readiness check;
   - the Core readiness handler's `authSessionId` change.

   The brief's Core ownership was "propose the exact files", and the readiness API was named in the goal. No other
   task is in flight on these files: t345, which owned `cli.ts`, is merged.
2. **The trial record keeps the hook's answer**, the Scenario Lab reset packet: seed and provenance, no token. It is
   never shown to the model.
3. **What a candidate trial's start reset does:** it is the Scenario Lab's global reset, so it also disarms any armed
   variant. Lane A uses no variant. A creation task that relies on an armed variant would lose it between trials. The
   playback path re-arms its variant; trials cannot.
4. **Core audit message:** "1 baseline entries can be lowered". I left the baseline alone.

Return contract:

```text
Outcome: Done
Changed: Core runtime/candidate-start-hook/** (new), _shared/runtime.ts, api/contracts/adaptation.ts, api/handlers/llm-generation.ts, runtime/index.ts, 2 Core test files; downstream flow-lane/creation/{readiness,candidate-outcome(new),build-proposal,review-proposal,lane,snapshot,index}.ts, creation/chat/build-from-chat.ts, environment.ts, cli.ts, 8 test files (2 new), testing-facility.md
Validation: Core vitest (12 files) -> 77 passed; Core+web tsc -> exit 0; test-runner node --test -> 212/212 pass; both structure audits -> passed; Lab dry run (campaign's candidate command + --dry-run) -> status ready, candidateTrial {trialRunner:true,startReset:true}
Not verified: no live or Core-booting Lab run; hook-to-reset round trip and chat-path draft spend unobserved
Report: docs/working/mvp-final-month-plan/reports/t348-lab-candidate-lane.md (t348 downstream tree)
Notes: also touched cli.ts (2 lines) and Core readiness handler (accepts the route-injected authSessionId so the Lab can POST it); fail-first shown in both repos
```

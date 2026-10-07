# t338: restore the creation path behind an authoring-mode setting

Worker: t338-restore. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t338\` (both repos, branch `task/t338-restore-creation-path`), on downstream `57ef32ce` and Core `a2672def`. Nothing committed. No provider call, no live Lab run, no panel.

## Outcome

Done. One setting decides how creation and improvement builds are authored. It is `FLUXIQ_AUTHORING_MODE`, owned by Core's `model/authoring-mode/`.

- `legacy` is the default. It restores the behaviour from before t330, rebuilt from the code t330's merges (Core `66a310cc`, downstream `4db30a78`) replaced, not rewritten.
- `candidate` keeps t330's draft-only behaviour.

In the Lab, the readiness hold now refuses only when the run's Core is in candidate mode. The campaign names the mode on every run (default `legacy`), and each run records it.

The legacy dry run of the campaign's exact command for `crossborder-marketplace-hub-to-cart` answered `status: ready` with `coreAuthoringMode: legacy`, so readiness admits legacy. The same command with `--authoring-mode candidate` was refused with `facility.contract` before anything started.

## What changed and why

### Core (`C:\Users\osrs_\FluxStuff\fxwork\t338\!FluxIQ`)

**The setting's owner (new): `packages/fluxiq/src/programs/automation-studio/model/authoring-mode/`.**
- `authoring-mode.ts` defines `AUTOMATION_STUDIO_AUTHORING_MODE_ENV` (`FLUXIQ_AUTHORING_MODE`), the list of modes, the default `legacy`, `isAutomationStudioAuthoringMode`, and `resolveAutomationStudioAuthoringMode(env)`.
- Unset or blank means `legacy`. Any other value throws rather than falling back.
- It follows the pattern of the existing `run-cost-ceiling/` and `build-call-limit/` owners. Exported through `model/index.ts`.

**Chat commands: `runtime/conversations/commands/`.**
- `build.ts` reads the mode through `automationStudioConversationAuthorsCandidates()`. This helper lives in `build.ts` because a separate file pushed the directory to 26 files, over the audit limit.
- In legacy mode `build.ts` sends the request without `authoringMode`, exactly as before t330, and returns `{status:"proposed", adaptationId, awaitingPermission}`. An unexpected draft still fails "saved, unverified, no apply", as it did before t330.
- In candidate mode it is t330's code unchanged.
- `create-here.ts`, `explore.ts` and `improve.ts` are restored from the parent of t330's merge, plus one branch each: `built.status === "draft"` gives t330's success text plus the `candidate` attachment.
- The capability `summary` (now a getter) and the `announce` text also follow the mode.
- `execute.ts` and `command.ts` are unchanged. t330's candidate-turn and confirm-only-without-candidate logic is neutral to the mode.
- The t298 "Build stopped" ending is kept.

**API (`api/handlers/llm-generation.ts`, `api/contracts/adaptation.ts`).**
- These files were not on the brief's list. They were the smallest place for the web panel to follow Core's setting.
- A browser cannot read Core's environment, so the panel now sends `authoringMode: "configured"`. The handler resolves it once per request; a misconfigured setting refuses before any build. The existing check that the result's status matches the mode now uses the resolved mode.
- Omitted still means legacy and an explicit `candidate` still means candidate, so raw API callers and the t333 tests are unchanged.

**Web panel (`apps/web/src/features/automation-studio/`).**
- `authoring/authoring-commands.ts` sends `configured`.
- New `authoring/flow-authoring-response.ts` (`screenFlowAuthoringResponse`): a `candidate` answer must parse as a draft of this Flow, and an `adaptation` passes through as before.
- `BlankFlowAuthoringPanel.tsx` and `ImproveFlowPanel.tsx`: the pre-t330 review flow is restored. The panel takes the candidate branch only when Core answers with `payload.candidate`. The pre-t330 description texts are back.
- t330's candidate status line was kept, but its text read "Flow?s" (a literal `?`); it now reads "Flow's".
- `conversation/capabilities/catalog/flows.ts` is a caller t330 changed. Its summary now follows the answer: the legacy texts again, or the candidate text.
- Nothing in `runtime/runtime-host.ts` needed changing. t330 did not touch it (last change `cb162a4c`).

**Docs.** `docs/architecture/automation-studio/llm-flow-bootstrap.md` has a new "Authoring mode" section, and its candidate paragraphs are now scoped to candidate mode.

### Downstream (`C:\Users\osrs_\FluxStuff\fxwork\t338\!FluxIQWebExtension`)

**The Lab's mode.**
- New `packages/test-runner/src/live-llm/authoring-mode-env.ts`: `--authoring-mode`, defaulting to Core's `legacy` and validated by Core's own resolver.
- `environment.ts` (`buildFluxIQEnvironment`) always sets `FLUXIQ_AUTHORING_MODE` on each Core it starts and drops any inherited value.
- `commands.ts` accepts `--authoring-mode` as a live-LLM option: it is refused without `--live-llm`, refused if given twice, and an invalid value is refused at parse time.
- `live-llm-plan.ts`: `LiveLlmPlan.coreAuthoringMode` is recorded in `snapshots/live-llm.json` and in the dry run's `live` record.
- `live-llm-run.ts`: a `coreAuthoringMode` getter.

**Readiness: `flow-lane/creation/readiness.ts`.**
- `assertCreatedFlowVerificationReady(authoringMode)` admits only the exact value `legacy`. `candidate`, `undefined` and any caller verdict refuse with `lab.candidate_verification_unavailable` at stage `before_provider`; the details now also carry `authoringMode`.
- New `createdFlowVerificationReady(mode)` predicate.
- `cli.ts` (not on the brief's list) now asserts readiness for created-Flow runs next to `assertChatBuildable`. That way a candidate run is refused before any topology or browser starts, and the dry run reports the refusal too.

**Legacy lanes restored from `4db30a78^1`, with the mode threaded through.**
- `build-proposal.ts`: the request carries no `authoringMode`; the pending-proposal poll after a bounded timeout is back; a proposed adaptation is read as before. A candidate answer is kept as t330's `outcome:"draft"`, as a safety net.
- `chat/build-from-chat.ts`: the proposal, apply and permission endings are restored. t330's candidate-draft reference detection comes first.
- `review-proposal.ts` takes `authoringMode`, strips it, and approves and applies the review fields only.
- `lane.ts`: `CreatedFlowLaneInput.authoringMode`, passed to every helper. t330's throw on a draft outcome is kept.
- `run-scenario.ts` (one property) passes `live.coreAuthoringMode`.
- `chat/chat-record.ts`: comment only.

**Chat check.** `extension-chat-check/prove/chat-build.ts` restores the pre-t330 provider-free chat-build proof. In candidate mode it returns t330's "unavailable" observation, untouched. The mode comes from `input.authoringMode`, or else the same `--authoring-mode` the check's Core was started with.

**Campaign (`scripts/lab/live-campaign/`).**
- `arguments.mjs`: `--authoring-mode` (default `legacy`, mirrored like `DEFAULT_LLM_MODEL`). It is campaign-owned, so it is refused after `--`.
- `lab-run/command.mjs` passes it on every run.
- `runner.mjs` puts it in the summary options; `summary/markdown.mjs` prints it in the header.
- `row/summarize-task.mjs` gives each row `authoringMode`, taken from the run's `snapshots/live-llm.json`.

**Structure.** `live-llm-run.ts` was exactly at the 800-line limit, so `assertLaneFlag` moved into `live-llm-plan.ts` as `assertLiveLlmLaneFlag` (the file is now 798 lines). A separate file would have pushed `live-llm/` to 26 files.

**Docs.**
- `docs/architecture/testing-facility.md`: an authoring-mode paragraph in the instruction-created Flow lane section, and the campaign's `--authoring-mode` beside `--llm-model`.
- `docs/architecture/build-loop.md`: a new "Which Build Runs" section.

### Tests, both modes

**Core**
- `model/authoring-mode/tests/authoring-mode.test.ts` (new): default, both modes, refusals.
- `commands/tests/build.test.ts`: legacy proposes with no mode in the request; candidate drafts.
- `commands/tests/execute.test.ts`: the five legacy tests t330 deleted are restored, including "create here ... approve and apply" with "is ready", and improve asking before it applies. t330's candidate tests now run under `FLUXIQ_AUTHORING_MODE=candidate`. Summary and announce are checked in both modes.
- `commands/tests/extension-chat.test.ts`: the five real-registry legacy tests are restored, including create-here putting the steps in, saying "is ready", and improve asking then applying. t330's two candidate tests run under candidate.
- `api/handlers/tests/llm-generation.test.ts`: a new `configured` test covers legacy, candidate, a disagreeing result, omitted, misconfigured, and requires `evidenceGuided`.

**Web**
- `authoring/tests/*`: restored pre-t330 versions, now expecting `configured`, plus candidate cases.
- `conversation/capabilities/catalog/tests/adaptations.test.ts` expects `configured`.

**Downstream**
- `lane.test.ts`, `build-proposal.test.ts` and `build-from-chat.test.ts` are restored from `4db30a78^1` with `authoringMode: "legacy"`, plus candidate refusals that touch nothing.
- `lane.test.ts`'s reset fake was updated to t336's `/__control/reset` plus `/health` contract.
- `readiness.test.ts`: legacy admits; candidate and caller verdicts refuse.
- `review-proposal.test.ts`: candidate refuses; legacy approves and applies the exact fields.
- `chat-build.test.ts`: candidate touches nothing; legacy goes on to type into the chat.
- New `live-llm/tests/authoring-mode-env.test.ts`.
- `tests/commands.test.ts`.
- Campaign tests: the arguments defaults and command lines include the mode; new tests cover the mode on every run, refusal after `--`, and the row and header.

## Commands run and observed results

**Core worktree**
- `pnpm --filter @fluxiq/contracts --filter fluxiq build`: `fluxiq:build ... Done`. Run twice, the last time after the final Core edit.
- `npx vitest run src/programs/automation-studio/model/authoring-mode src/programs/automation-studio/runtime/conversations src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts` in `packages/fluxiq`: `Test Files 21 passed (21)`, `Tests 176 passed (176)`.
- `npx vitest run src/programs/automation-studio/api src/programs/automation-studio/model`: `37 passed (37)`, `239 passed (239)`.
- `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq` (not incremental): exit 0, no output.
- `npx tsc --noEmit` in `apps/web`: exit 0.
- `npx vitest run src/features/automation-studio/authoring src/features/automation-studio/conversation` in `apps/web`, after the final rebuild: `Test Files 28 passed (28)`, `Tests 318 passed (318)`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (285 warning(s), 349 baselined).`

**Downstream worktree**
- `npx tsc -p tsconfig.json --noEmit` in `domain`: exit 0. The same with `-p tsconfig.test.json`: exit 0.
- `npx tsc -p tsconfig.json --noEmit` in `packages/test-runner`: exit 0, after `scripts/check/core-build.mjs` reported "Core's build ... is current" and `domain-dist.mjs`.
- `node ../../scripts/build-cache/cli.mjs test-runner:build`, then `node --test dist/flow-lane/creation/tests/*.test.js dist/flow-lane/creation/chat/tests/*.test.js dist/extension-chat-check/prove/tests/*.test.js dist/live-llm/tests/*.test.js`: `# tests 287 # pass 287 # fail 0`.
- `node --test dist/tests/*.test.js` (the directory of `cli.ts`, `commands.ts`, `environment.ts` and `run-scenario.ts`): `# tests 353 # pass 352 # fail 1`.
  - The failure is `cli-llm.test.ts`, "a dry run reports the Core web build it would serve, and whether it is cached": after publishing a stub build, the second dry run reports `cached:false` where `true` was expected. It fails deterministically, twice in a row.
  - It still fails with my one `cli.ts` line removed from the compiled `dist/cli.js` (A/B test; the file was restored afterwards). It is about Core web-build caching, which this task does not touch. I conclude it is not caused by this change, but it is not verified against the base commit.
- `node --test live-campaign/tests/*.test.mjs live-campaign/*/tests/*.test.mjs` in `scripts/lab`: `# tests 69 # pass 69 # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (176 warning(s), 117 baselined).`
- `pnpm lab:campaign crossborder-marketplace-hub-to-cart --dry-run --max-attempts 1` printed `pnpm lab run crossborder-marketplace --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode legacy --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48`. The campaign's dry run only prints commands; it does not reach readiness.
- To exercise readiness without a provider, I ran that printed command with `--dry-run` appended. The live guards skip `--dry-run`, and the dry run starts no topology. It printed `{"status":"ready","providerCallCount":0,...,"live":{...,"coreAuthoringMode":"legacy",...},...}`. **Readiness admits legacy.** The Lab prelude rebuilt the ignored `extension:build`.
- The same with `--authoring-mode candidate --dry-run`: `{"status":"failed","category":"facility.contract","message":"Created-Flow qualification is unavailable in candidate authoring mode: ..."}`, exit 1.

**Adjacent Core tests outside the change**
- `npx vitest run src/programs/automation-studio/runtime/service/flow-bootstrap-commands src/programs/automation-studio/runtime/service/runtime-adaptation`: 249 passed, 7 failed.
- All seven failures are re-author tests in `runtime-adaptation/tests/step-failure-port.test.ts` and `refuted-result-port.test.ts`: `port.approve` is never called, and one purse total reads 0.2 against an expected 0.22.
- Those test files import only `runtime-adaptation`, `recovery`, `flow-bootstrap` and `llm` modules, plus a type-only import from `model/index.ts`. None of those import paths touches a file this task changed. The likely cause is t296's held-repair topology refusal or an existing fixture issue. Not verified against the base commit.

## Not verified

- No live run or provider call. That a legacy chat build produces a runnable Flow on the current combined source is shown only by the restored Core real-registry tests (scripted provider) and the Lab fakes, not live.
- No browser or panel check of the restored web panel texts or the review flow; only the React renderer tests ran.
- The full suites (`pnpm check`, `pnpm test`, Core's whole vitest run) were not run, per the narrow-checks rule.
- The two pre-existing-looking failures above (`cli-llm` web-build cache; seven re-author port tests) were not compared against `a2672def` / `57ef32ce`.
- `--target existing`: live runs require isolated or persistent-isolated targets, so the Lab always owns the Core whose mode it records. A pre-existing external Core's mode is not read; the lane's draft-outcome throw is the safety net there.
- Non-live runs record no authoring mode. They build nothing, and the mode is recorded in `snapshots/live-llm.json` only. Recording it in `run.json` would mean changing the `test-contracts` manifest schema, which is outside the brief.
- The intake's inferred spend-ledger side effect of a refused run was not checked. A candidate-mode created-Flow run is now refused in `cli.ts` after the live guards admit it.
- `docs/reference/framework-reference.md` is stale. `node scripts/docs-reference.mjs --check` failed in the t338 tree, and regenerating it rewrote about 1,600 lines, nearly all unrelated to this task: 3,201 declarations became 3,320. I reverted the regeneration. I did not run `--check` on the base tree.

## Open questions or contradictions found

1. **Files outside the brief's "Owns" list that I changed, all minimal:**
   - Core `api/handlers/llm-generation.ts` and `api/contracts/adaptation.ts`, for the panel's `configured` request.
   - Core `apps/web/.../conversation/capabilities/catalog/flows.ts` and its `adaptations.test.ts`.
   - Downstream `packages/test-runner/src/{cli.ts, commands.ts, environment.ts, run-scenario.ts}` and `live-llm/{index, live-llm-plan, live-llm-run}.ts`.

   I judged these part of "the callers t330 changed" and the "campaign option plumbing". Review the `cli.ts` early refusal in particular.
2. **`authoringMode: "configured"` is a new API value.** I chose it over two alternatives:
   - Reading the mode from the readiness endpoint, which has a strict contract that the downstream Lab parses.
   - Treating an omitted field as configured, which would have silently changed raw API callers in candidate mode.
3. **Framework reference.** `framework-reference.md` will show the new public exports (`AUTOMATION_STUDIO_AUTHORING_MODE_*`, `resolveAutomationStudioAuthoringMode`, `automationStudioConversationAuthorsCandidates`, `AUTOMATION_STUDIO_CONVERSATION_CANDIDATE_SAVED`) only once someone regenerates the already-stale file.
4. **Downstream `existing-fluxiq-control.test.ts`** still uses the candidate request and response that t330 put in it. It passes, because the request type now has an optional `authoringMode`. I left it alone.

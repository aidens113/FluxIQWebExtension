# Sweep fix S2: Core apps/web (sweep 2026-10-19)

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t723/!FluxIQ`, branch `task/t723-sweep-1019-fixes`. Only `apps/web` was edited.
Nothing was committed.

## Outcome

Partial. Two of the three failures are fully fixed. The third (core-contract) went from 54 failures to 1. That last one
is a real product defect, and its correct fix is in `packages/fluxiq`, which this brief does not allow me to edit.

## What changed and why

### 1. core-contract.test.ts: 54 failures down to 1 (test fixture outdated; one real product defect remains)

- **Broken by** Core `18ee3f60` (2026-10-13, t519, "Require explicit task instructions and described supporting
  recordings"). From that commit, Core starts a run, build or adaptation only for a Flow that has an active task
  instruction, and it refuses a recording that has no description. The contract world's seed
  (`core-contract-world.ts` `seedContractData`) was never updated. Its `startRuntimeSession` threw
  `AutomationInstructionError` before any variant ran, so all 53 variants and the endpoint-reach summary failed on
  the seed, not on their own requests.
- **Side that was wrong:** the test fixture. The seed now does what the panel does: it writes the Flow's task
  instruction through `saveFlowGenerationInstruction` (the Instructions view's write), and it gives the seeded
  recording a `description`. Core's acceptance is unchanged.
- **Result:** 52 of 53 variants are accepted, and the endpoint-reach summary passes.
- **Still failing: `flow.improve`, a real product defect.** Core refuses the request with
  `flow_bootstrap.invalid_input`.
  - What the panel sends: `improveFlowFromWebsiteAdaptation` (`authoring/authoring-commands.ts`) posts
    `generate-flow-bootstrap-adaptation` with `authoringMode: "configured", mode: "extend"`.
  - What Core does with it: the handler (`packages/fluxiq/.../api/handlers/llm-generation.ts`) resolves
    `configured` to Core's configured mode, which by default is `project`. The request reader
    (`runtime/service/flow-bootstrap-commands/generation-request.ts`) then throws "Project authoring cannot extend a
    Flow yet."
  - **Broken by** Core `583a916d` (2026-10-16, "Project mode is the product default"), on top of `86770262`
    (2026-10-13), which added the project-plus-extend refusal. In the default product configuration, the panel's
    "Improve automation" button and the chat capability `flow.improve` are both refused before they do anything.
  - Confirmed: `FLUXIQ_AUTHORING_MODE=candidate npx vitest run .../core-contract.test.ts -t "flow.improve"` passed
    (1 passed, 59 skipped).
  - Core's own chat avoids this. `runtime/conversations/commands/build.ts` (86770262) sends `"candidate"` for an
    extend whenever Core is not in legacy mode. The handler's `configured` resolution has no matching rule. The panel
    cannot read Core's mode, so it cannot copy the chat.
  - **Fix I recommend (in `packages/fluxiq`, not done):** when the handler resolves `configured`, apply the chat's
    rule: if the mode is `project` and the request is `mode: "extend"`, use `candidate`. Put that rule in one shared
    function in `model/authoring-mode/`, used by both `commands/build.ts` and `handlers/llm-generation.ts`, and test
    it beside the handler. This does not loosen acceptance: an explicit `project` + `extend` request is still refused.
    The panel-only alternative is to hard-code `authoringMode: "candidate"` for improve. I rejected it because it
    would override a `legacy` setting and break the authoring-mode module's rule that callers never use a mode
    literal of their own.
  - `EXPECTED_REFUSALS["flow.improve"]` (`blank_target_required`) stays as it is. That is the correct answer once the
    Core fix lands.

### 2. architecture-contract.test.ts "forbids imports of sibling domain-private modules" (code wrong)

- **Broken by** `18ee3f60`. `flow-editor/components/FlowEditorView.tsx` imported
  `../../instructions/TaskInstructionsPanel`, a private module of the `instructions` domain.
- **The barrel import from the brief would add an import cycle.** Switching to the barrel (`../../instructions`) does
  satisfy the architecture test. But `node scripts/structure-audit.mjs` then failed with two new loops: the
  instructions barrel re-exports `InstructionsView`, which imports `views/view-registry`, then
  `canonical-view-definitions`, then `FlowEditorView`, then back to the barrel. This also pushed FlowEditorView's
  baselined cycle count from 2 to 3. Core's code-structure.md ("An import cycle") says to import from the defining
  module when a barrel leads back. The web test forbids exactly that across product domains.
- **What I did instead:** moved `TaskInstructionsPanel.tsx`, `save-task-instruction.ts` and their test from
  `instructions/` to `authoring/`.
  - Why authoring owns them: authoring already exposed this writer as its public `saveFlowGenerationInstruction` (via
    a private reach into `instructions/save-task-instruction`), and the panel is the UI for that build-task write.
    `authoring` is not a product domain.
  - FlowEditorView now takes `TaskInstructionsPanel` from the `../../authoring` barrel it already imported. That is
    the same import line, so no new loop.
  - `instructions/InstructionsView.tsx` imports the leaf `../authoring/TaskInstructionsPanel` directly, with a comment
    explaining why. That target is not a product domain, and it adds no cycle.
  - The `instructions` barrel no longer exports the two names. Nothing imported them from there.
  - `authoring-commands.ts` re-exports from `./save-task-instruction`.
- No behaviour changed, so no new test was needed. The moved test passes in its new place.

### 3. coverage.test.ts "keeps the excuse list from rotting" (test list outdated)

- **Broken by** `18ee3f60`. It removed the panel's `create-recording-flow-proposals` and
  `review-recording-flow-proposal` writes from `recordings/recording-commands.ts`, but left their entries in
  `PANEL_ENDPOINTS_WITHOUT_A_CAPABILITY`.
- **Fix:** removed both stale entries from `conversation/capabilities/registry.ts`.

Files (all under `apps/web/src/features/automation-studio/`):
- `conversation/capabilities/tests/core-contract-world.ts` (seed)
- `conversation/capabilities/registry.ts` (excuse list)
- `flow-editor/components/FlowEditorView.tsx`, `instructions/InstructionsView.tsx`, `instructions/index.ts`,
  `authoring/index.ts`, `authoring/authoring-commands.ts` (imports)
- Moved from `instructions/` to `authoring/`: `TaskInstructionsPanel.tsx`, `save-task-instruction.ts`,
  `tests/task-instructions.test.tsx`

## Commands run and observed results

All tests ran in `apps/web` with `npx vitest run`.

- **Baseline:** the three named files, before any change. 56 failed, matching the sweep: core-contract 54,
  architecture-contract 1, coverage 1.
- **Contract test after the seed fix:** `npx vitest run .../core-contract.test.ts`. "capability contract: 52/53
  variants accepted"; 1 failed, 59 passed (60). The failure is flow.improve: "generate-flow-bootstrap-adaptation
  refused: Flow Bootstrap generation failed (flow_bootstrap.invalid_input)."
- **Improve variant under candidate mode:** `FLUXIQ_AUTHORING_MODE=candidate npx vitest run .../core-contract.test.ts
  -t "flow.improve"`. 1 passed, 59 skipped.
- **Final run:** `npx vitest run` over these folders under `src/features/automation-studio/`:
  `conversation/capabilities`, `tests`, `flow-editor`, `instructions`, `recordings`, `authoring`, `views`, `router`.
  - Test Files: 1 failed, 54 passed (55). Tests: 1 failed, 425 passed (426).
  - The one failure is core-contract flow.improve, as above.
  - architecture-contract.test.ts 23/23, coverage.test.ts 7/7, authoring/tests/task-instructions.test.tsx 4/4.
- **Typecheck:** `npx tsc --noEmit -p .` in `apps/web`. Exit 0, no output.
- **Structure audit:** `node scripts/structure-audit.mjs` at the Core root. 1 violation:
  `[statement-packing] packages/fluxiq/src/programs/automation-studio/storage/canonical-authority/tests/zz-s3-wp-timing.test.ts`.
  That file is untracked in the other worker's `packages/fluxiq` area, not mine. Before the file move, this run also
  showed the two import-cycle failures described above. After the move, none of the violations are in `apps/web`.

## Not verified

- I did not run the whole `apps/web` suite. Only the folders listed above.
- No browser, Lab or e2e runs.
- I did not implement or test the Core handler fix for flow.improve.
- I did not check whether other `generate-flow-bootstrap-adaptation` callers that send `configured` together with
  `extend` exist outside `apps/web`.

## Open questions or contradictions found

- **The brief's import fix conflicts with Core's structure rule.** The brief said "move the forbidden import to the
  module's public entry". Here that public entry leads back into an import cycle, which Core's structure rules
  forbid. I resolved it by changing which directory owns the panel. The supervisor should confirm that `authoring`
  is acceptable as the owner.
- **The flow.improve fix needs `packages/fluxiq`**, which is outside this brief. It needs a follow-up brief, or the
  other worker. Until then, core-contract keeps 1 failure, and the panel's and chat's improve flow is refused in the
  default (`project`) configuration. (Resolved in the continuation below.)

---

# Continuation: the flow.improve fix in Core

## Outcome

Done. core-contract passes in full: 53 of 53 variants accepted, 60 of 60 tests.

## What changed and why

The rule: a `configured` request with `mode: "extend"` resolves to the mode that can extend. In `project` mode that
is `candidate`; in `candidate` mode it stays `candidate`; in `legacy` mode it stays `legacy`. This is exactly what
the chat already decided. An explicit `project` + `extend` request is still forwarded as asked and refused by Core's
request reader.

All paths below are under `packages/fluxiq/src/programs/automation-studio/`.

- **New `model/authoring-mode/build-authoring-mode.ts`:** `resolveAutomationStudioBuildAuthoringMode(build: "create" |
  "extend", env?)`. It reads Core's setting through `resolveAutomationStudioAuthoringMode`, so a misconfigured
  setting still throws, and it maps `extend` under `project` to `candidate`. It is exported from the barrel
  `model/authoring-mode/index.ts`.
- **Handler, `api/handlers/llm-generation.ts`:** `configured` now resolves through the new function, using the
  request's `mode` (`extend`, otherwise `create`). An explicit `candidate` or `project` passes through unchanged, so
  Core's acceptance is not loosened.
- **Chat call site, `runtime/conversations/commands/build.ts`:** `buildAutomationStudioFlowFromConversation` now
  takes its `authoringMode` from the same function, and `candidateMode` is derived from it (`!== "legacy"`). What it
  sends is identical in every mode:
  - `legacy`: no authoring mode sent.
  - `candidate`: `candidate` for both create and extend.
  - `project`: `project` for create, `candidate` for extend.
  - `automationStudioConversationAuthorsCandidates` (used by create-here, explore and improve) is unchanged.
- **Tests, written first and observed failing before the change** (5 failed: the function did not exist, and the
  handler forwarded `project` for an extend):
  - New `model/authoring-mode/tests/build-authoring-mode.test.ts`: create follows the setting; extend under unset or
    `project` gives `candidate`; extend under `candidate` gives `candidate`; `legacy` stays legacy; a misconfigured
    setting throws.
  - `api/handlers/tests/llm-generation.test.ts` gains one test (the file is now 786 lines, under the 800 ceiling):
    - `configured` + `extend` under the default (unset), `project` and `candidate` settings is accepted, forwarded as
      `candidate` + `extend`, and Core's reader `readAutomationStudioFlowBootstrapGenerationRequest` accepts what was
      forwarded.
    - Under `legacy`, no authoring mode is forwarded and the answer is a proposal.
    - An explicit `project` + `extend` is forwarded unchanged, and the reader throws "Project authoring cannot extend
      a Flow yet".

I did not touch S3's paths (`runtime/executor`, `runtime/result-verification`, `runtime/tests/refuted-result`,
`storage`) or its temporary files.

## Commands run and observed results

- **Red run, before the change:** `npx vitest run` (in `packages/fluxiq`) on `model/authoring-mode/tests` and
  `api/handlers/tests/llm-generation.test.ts`. 5 failed, 33 passed (38).
- **Green run:** `npx vitest run` (in `packages/fluxiq`) on `model/authoring-mode/tests`, `api/handlers/tests`,
  `runtime/conversations/commands/tests` and `runtime/service/flow-bootstrap-commands/tests/generation-request.test.ts`.
  37 files passed, 296 tests passed (296).
- **Conversation tests:** `npx vitest run src/programs/automation-studio/runtime/conversations/tests`. 7 files
  passed, 45 tests passed.
- **Core rebuild:** the first web run refused to start because Core's compiled dist was older than `build.ts` (the web
  tests import the compiled dist). I rebuilt with `pnpm --filter @fluxiq/contracts --filter fluxiq build`, which exited
  0 (fluxiq:build, about 95 s).
- **Web tests:** `npx vitest run` (in `apps/web`) on these folders under `src/features/automation-studio/`:
  `conversation/capabilities`, `tests`, `authoring`, `instructions`, `flow-editor`. 35 files passed, 308 tests
  passed. Output: "capability contract: 53/53 variants accepted by Core across 45 capabilities". core-contract.test.ts:
  60 tests, all passed.
- **Package check:** `pnpm --filter ./packages/fluxiq check`. Exit 0.
- **Web typecheck:** `npx tsc --noEmit -p .` in `apps/web`. Exit 0.
- **Structure audit:** `node scripts/structure-audit.mjs`. 3 violations, all `[statement-packing]` in S3's
  `storage/canonical-authority/tests/` files: `whole-process.test.ts`, and the untracked `zz-s3-old-probe.mjs` and
  `zz-s3-old-whole-process.test.ts`. None are in files I own.

## Not verified

- I did not run Core's whole vitest suite or the whole apps/web suite.
- No live, Lab or browser run of "Improve automation" or the chat's improve.
- I did not update Core's authored docs (`docs/architecture/automation-studio/flow-authoring.md` describes
  `configured`). I did not check whether they state the extend rule; they were not in my ownership.

## Open questions or contradictions found

- The brief said "core-contract (all 55)". The file has 60 tests (53 variants plus summary and registry checks), and
  all 60 pass.

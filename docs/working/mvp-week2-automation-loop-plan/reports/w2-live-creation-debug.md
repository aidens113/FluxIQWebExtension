# w2-live-creation-debug

Worker report.

## Outcome

**Done.** The live create-flow run on `instruction-only-form` now passes its
playback goal (`run-mu4vs7j1-aca950d7`). The briefed campaign ran once and
passed 2 of 6. The four failures had a second cause, which is now fixed. All
four of those tasks were then rerun live individually and passed. Both
repositories' `pnpm check` exit 0, and the affected suites are green (one
exception, in another worker's area, is noted under Not verified).

## What changed and why

### 1. The build record keeps what refused each plan (Core + Lab)

Core's failure record kept only `tool_call` steps. A build that stopped on
three refused plans therefore recorded one step, the opening inspect, and said
nothing about the three decisions. The Lab also dropped Core's `issueCodes`.

- Core `FB/generation-failure.ts`: `evidenceLoopDiagnostic` now records every
  decision in `steps`, in order. A decision that called no tool gets a reserved
  Core step id, with the first code that refused it as its `resultCode`. The
  ids are `core.decision_unusable` and `core.decision_complete`, declared in
  the new `FB/decision-step-ids.ts` and exported through the `FB` barrel.
  - The ids use the existing step shape on purpose. The Lab's parser is loaded
    from the main Core checkout's `dist`, and a reader built before this change
    still parses the record, so the two repositories need no build ordering.
  - A `resultCode` that is not a code is dropped, so it can no longer make the
    whole record unparseable.
- Core tests updated to the new steps:
  - `FB/tests/generation-failure.test.ts`, plus one new test.
  - `runtime/tests/deepseek-bootstrap-exploration.test.ts`: one expectation.
  - `runtime/tests/service-bootstrap/tests/rejections.test.ts`: one expectation.

  The last two are outside `FB/` but only pin `FB`'s output.
- Lab `flow-lane/creation/build-proposal.ts`: a refused build keeps
  `failure.issueCodes` (identifier-shaped codes only) and every step.
  `toolIds` lists only real tools and leaves out Core's `core.` decision steps.
  The test was written first in `creation/tests/build-proposal.test.ts`. The
  campaign summary already has an "Issue codes" column that reads this field.
- Node paths are **not** recorded (see Open questions).

### 2. Root cause of the refused plans (domain)

Live run 1 recorded all three decisions as `core.decision_unusable` with
`web.handle.misplaced`. A temporary log in the private worktree showed why:
**on every node, the model wrote the handle as `target: {"handle": "target.N"}`.**
The log held codes, plan paths, node ids, parameter keys and value kinds, and
no values.

- Every web element node definition lists a `target` parameter first
  ("Adapted Target", an object; `domain/src/output-nodes/definitions.ts`).
- The inspect packet names each element by a field called `target`.
- Core's plan schema says "write `{"handle": ...}` as that value" but does not
  name the parameter. The model read all of this literally.
- `resolveWebPlanNodeParameters` accepted a target handle only under
  `selector`. All three nodes were refused as `web.handle.misplaced`, three
  times in a row, and the build stopped with
  `flow_bootstrap.evidence_unusable_decision`.

**Fix** (`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`):
on an element node, `target` is now a target-handle slot, like `selector`.

- It resolves into `selector` and `element` exactly as a `selector` handle
  does.
- The `target` key is dropped, so Core derives the adapted target at dispatch
  as it does for a recorded node.
- A literal `selector` beside the handle is replaced by the handle's real
  selector. This rule matters: the plan that passed carried a guessed literal
  selector on every node.

The test was written first in `plan-resolution/tests/resolve-plan-node.test.ts`.

### 3. Found by the campaign: the catalog never offered typing or saving (Core)

All four `identity-drift` tasks built a Flow with a single `web.dom.clear`
node. Their instruction is "Rename the workspace to Aurora Field Team and save
the settings."

- The instruction contains none of Core's action words (fill, type, enter,
  click, submit, ...), so only start and end were reserved.
- The only web node that scored was "Clear Field", on the word "field".
- The evidence-guided catalog holds 12 entries, and typing and clicking were
  never in it, so the model could only clear.

**Fix** (`FB/plan/ranking.ts`): more implied intents. An implied intent only
*prefers* a node and never requires one, so it cannot refuse a domain that
lacks the node before any provider call is made.

| Words in the instruction | Node group they now prefer |
| --- | --- |
| rename, change, set, update, edit, replace | enter text |
| change, set, update | choose an option |
| save, apply, confirm, send | press a control |

The tests were written first in `FB/plan/tests/catalog.test.ts`.

### 4. Found by the campaign: handles written under `element` (domain)

Two of the eight completed campaign plans were refused only because the model
wrote `element: {"handle": ...}`. One was alone, one sat beside a `selector`
handle, and each refusal cost a provider call.

**Fix:** `element` is now a third target-handle slot.

- The resolved identity replaces the handle.
- If several slots carry handles, they must all name the same element.
  Otherwise the node is refused as `web.handle.ambiguous`.

This reverses one row of `plan-node-identity.test.ts`, which pinned "a handle
written into the element is still misplaced":

- `{selector: target.2, element: target.1}` is now refused as
  `web.handle.ambiguous` (still a refusal).
- The same handle in both slots now resolves.

The test was written first.

## Commands run and observed results

**Private Core worktree**
- `git worktree add --detach F:/fxlab/w2lcd-core HEAD` (Core `79f0ceb`).
- `pnpm install --frozen-lockfile`, then
  `pnpm --filter "./packages/**" build` with
  `npm_config_workspace_concurrency=1`: exit 0.
- My Core files were copied in, and `pnpm --filter fluxiq build` was rerun
  after each change: exit 0.
- Removed with `git worktree remove --force`. It left files behind, so I ran
  `rm -rf F:/fxlab/w2lcd-core` and `git worktree prune`. `git worktree list`
  no longer shows it.

**Failing-first tests**

| Test | Before the fix | After the fix |
| --- | --- | --- |
| Lab `build-proposal.test.js` | 7 pass, 1 fail | creation + live-llm tests: 90 pass, 0 fail |
| Domain plan-resolution, `target` slot | 15 pass, 1 fail | 16 pass, 0 fail |
| Domain plan-resolution, `element` slot | 15 pass, 1 fail | 16 pass, 0 fail, after updating the identity row |
| Core `catalog.test.ts` | 2 of 21 fail | `flow-bootstrap` suite: 5 files, 118 passed |

**Core**
- `npx vitest run` over `runtime/flow-bootstrap`,
  `runtime/tests/deepseek-bootstrap-exploration.test.ts` and
  `runtime/tests/service-bootstrap`: 15 files, 181 passed (before fix 3).
- `pnpm check`: exit 0.
  - Structure tests: 105 pass, 0 fail.
  - `structure-audit: passed (152 warning(s), 254 baselined)`.
  - The audit also said "1 baseline entries can be lowered". I did not touch
    the baseline, because it is shared.
- `npx tsc --noEmit` in `packages/fluxiq`: exit 0.
- `npx vitest run src/programs/automation-studio/runtime` in the main checkout,
  while live runs were loading the machine: 7 files failed, 133 passed.
  - Rerunning the 7 files alone: 5 passed.
  - The 2 that still failed both pass in my worktree (HEAD plus my changes
    only).
  - `instruction-readiness.test.ts` then passed alone in main. Its failure was
    a 15-second load timeout.
  - `service-adaptation/tests/subflow.test.ts` still fails in main with
    `Adaptation cannot be applied: its promotion gates were not supplied.`
    That error is raised in `AS/storage/project/adaptation-store.ts`, which
    other workers are changing, not me.

**This repository**
- `pnpm check`: exit 0.
  - Test groups: 130 pass, 0 fail; and 30 pass, 0 fail.
  - `structure-audit: passed (60 warning(s), 76 baselined)`.
- `DOMAIN_TEST_BUILD_LABEL=w2lcd node scripts/test-domain.mjs`: 614 tests,
  614 pass.
- `pnpm --filter @fluxiq-web-extension/test-runner test`: 1097 tests,
  1097 pass.

## Live runs

Every run used `FLUXIQ_TEST_ENV_FILES=none npm_config_workspace_concurrency=1
FLUXIQ_CORE_ROOT=F:/fxlab/w2lcd-core pnpm lab run <scenario> [--variant v]
--live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model
deepseek-chat --llm-task create-flow --instruction-task <task>
--llm-max-calls 26 --llm-max-cost-usd 0.25 --llm-max-input-tokens 42000
--llm-max-output-tokens 8000 --llm-max-total-tokens 50000
--llm-max-run-tokens 600000`. Costs are estimates. Tokens are what the
provider reported.

| # | Run | Task | Code state | Verdict | Created Flow | Calls | Tokens (in / out / total) | Cost USD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mu4vk93o-5f6675d7 | instruction-only-form-submit | fix 1 | failed: `evidence_unusable_decision` | none | 4 | 13,059 / 1,493 / 14,552 | 0.00772 |
| 2 | run-mu4vs7j1-aca950d7 | instruction-only-form-submit | fixes 1–2 | **passed** | type, select, click | 1 | 4,156 / 503 / 4,659 | 0.00249 |
| 3 | run-mu4w7fxz-36bac36c | identity-drift-rename | fixes 1–4 | **passed** | clear, type, click | 1 | 4,405 / 480 / 4,885 | 0.00257 |
| 4 | run-mu4wacam-715cab51 | identity-drift-rename-moved-save (moved) | fixes 1–4 | **passed** | clear, type, click | 1 | — / — / 4,920 | 0.00261 |
| 5 | run-mu4wbtau-74841fce | identity-drift-rename-relabelled-save (text-only) | fixes 1–4 | **passed** | clear, type, click | 1 | — / — / 4,910 | 0.00261 |
| 6 | run-mu4wd6gc-a845c4dc | identity-drift-rename-redesigned-save (renamed-redesign) | fixes 1–4 | **passed** | clear, type, click | 1 | — / — / 4,924 | 0.00261 |

- **Run 1** confirmed fix 1 live. The record lists `web.inspect_current_page`
  (`web.inspect.succeeded`), then three `core.decision_unusable` steps with
  `web.handle.misplaced`, and `failure.issueCodes` is
  `["web.handle.misplaced"]`.
- **Run 2:** the oracle passed and the run succeeded, with no harness
  activation. Each of the type, select and click steps ran, and the proposal
  was applied with 2 mutations.
- **Runs 3–6:** the oracle passed in every run.

### Campaign (once, as briefed)

- Command: `FLUXIQ_TEST_ENV_FILES=none npm_config_workspace_concurrency=1
  FLUXIQ_CORE_ROOT=F:/fxlab/w2lcd-core pnpm lab:campaign --kind form --limit 6`.
- Code state: the same as run 2, before fixes 3 and 4.
- Result: exit 1, because some tasks failed. Summary at
  `test-runs/campaigns/2026-09-17T02-00-12-342Z/summary.md`.
- **2 of 6 passed.** 9 provider calls, 42,191 reported tokens, $0.021053
  reported cost.

| Task | Variant | Run | Verdict | Created Flow | Calls | Tokens | Cost USD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| instruction-only-form-submit | — | run-mu4vumzi-50345198 | passed | type, select, click | 1 | 4,637 | 0.00246 |
| llm-target-drift-activate | — | run-mu4vvyyr-f3b8c458 | passed | click | 2 | 11,626 | 0.00571 |
| identity-drift-rename | — | run-mu4vx5hj-fbb98886 | failed (goal) | clear only | 1 | 4,304 | 0.00218 |
| identity-drift-rename-moved-save | moved | run-mu4vy9yn-a06fba84 | failed (goal) | clear only | 1 | 4,313 | 0.00219 |
| identity-drift-rename-relabelled-save | text-only | run-mu4vzc7y-a1558a44 | failed (goal) | clear only | 3 | 13,036 | 0.00639 |
| identity-drift-rename-redesigned-save | renamed-redesign | run-mu4w0jtd-d2352b50 | failed (goal) | clear only | 1 | 4,275 | 0.00213 |

- Every failure is `runtime.behavior`: the created Flow ran and succeeded, but
  the workspace was never renamed and saved (fix 3).
- The refusal log shows two completions refused as `web.handle.misplaced` for
  an `element` handle (fix 4), in the `llm-target-drift` and `text-only` runs.
  Both recovered on the next call.
- The campaign was **not** rerun after fixes 3 and 4. Instead, its four failed
  tasks were rerun individually (runs 3–6), and all four passed.

## Not verified

- **Single observations.** Each passing live result above was seen once, and
  this machine's RAM fault puts an error bar on single observations.
- **Other form tasks.** No live run exercised fix 3's new words ("change",
  "set", "apply", ...) beyond "rename" and "save". No run exercised fix 4's
  `element` slot resolving successfully; runs 3–6 wrote `target` and
  `selector`.
- **One Core test in the main checkout.** `runtime/tests/service-adaptation/tests/subflow.test.ts`
  fails with other workers' uncommitted storage/promotion changes, and passes
  on HEAD plus my changes. I did not re-check it after Core moved to
  `fce62f9`.
- **Web panel display.** I did not check what the web panel shows for the new
  `core.decision_*` steps. No Core or web code reads diagnostic `steps` besides
  the parser.
- **Documentation** is outside my brief. Core's
  `docs/architecture/automation-studio/llm-flow-bootstrap.md` (lines 424–426)
  still says failure diagnostics project "at most 16" tool steps. That was
  already stale, since the limit is the loop's decision ceiling plus one. A
  suggested replacement: "Public failure diagnostics project every recorded
  decision, in order, as a content-free `{toolId, effectApplied?,
  resultCode?}` step, at most the loop's decision ceiling plus one. A decision
  that called no tool is named `core.decision_unusable` or
  `core.decision_complete`, with the first code that refused it as
  `resultCode`, and a refused plan's issue codes (at most 16) ride as
  `issueCodes`." The web domain's handle slots (`selector`, `target`,
  `element`) are documented only in `resolve-plan-node.ts`'s header.

## Open questions or contradictions found

- **Core HEAD moved.** The brief names `2ae5894`, but HEAD was `79f0ceb` when
  I created the worktree. It is now `fce62f9`, after other workers' commits.
- **Node paths per refusal are not recorded.** The loop's `stalled` callback
  (`AS/runtime/llm/evidence-loop.ts`, not owned) receives only `issueCodes`.
  Carrying paths needs two changes:
  - In the loop, `unusable(step, issueCodes)` also passes the check's
    `feedback.issues` (code and path pairs) to `stalled`.
  - `flowBootstrapEvidenceUnusableDecisionFailure` bounds those pairs and
    records them, for example as `issues: [{code, path}]` capped at 16. The
    parser would need a new field for this, so the Lab could read it only
    after main Core's `dist` is rebuilt.
- **The first-choice parameter name.** The node catalog still lists `target`
  ("Adapted Target") as the first parameter of every web element node, and it
  is a parameter the author is not meant to set. The domain now accepts
  handles there, which fixes creation. Separately, it may be worth deciding
  whether `target` should be offered to a model at all
  (`domain/src/output-nodes/definitions.ts`, outside my brief).
- **Could the Lab import the step ids?** Once main Core's `dist` exports
  `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_DECISION_STEP_IDS`, the Lab could import
  it instead of recognising the `core.` prefix.

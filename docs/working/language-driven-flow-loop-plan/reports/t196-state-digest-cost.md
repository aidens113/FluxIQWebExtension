# t196 — state-digest cost and ignored redirects

Lane lead t196, 2026-09-30. **Status: the authored draft, the acts checklist (A1 cause 1), progress as the Flow
advancing (A1 cause 2) and continuation from the live page (G1) are done and validated by unit tests; ready to commit
(see "Ready to commit" at the end of the first section).** The dry run and replay boundary before it were committed as
`77b269a2`. No live or Lab run (all Labs stopped by the user).
Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQ` and extension
`C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQWebExtension`, both `task/t196-state-digest-cost` (Core from `f0dbbd6`).
Evidence: `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/reports/looking-at-page-repeat.md`
and the t193/t194/t195 bundles named below. Worker reports beside this file: `t196-wD-domain-digests.md` (domain),
`t196-wL-loop.md` (Core loop).

## Fix log

### The authored draft, the acts checklist, progress, and continuation (worker, 2026-09-30, after `77b269a2`)

`R` = `packages/fluxiq/src/programs/automation-studio/runtime` (Core). Every file is in the Core tree; nothing
downstream changed in this round (the page-evidence code is t200's and was not touched).

**Orders (supervisor, user's words):**
1. G2: "IT SHOULD NOT JUST BLINDLY ADD EACH STEP THAT IT TOOK ONE BY ONE IN ORDER. IT SHOULD ONLY ADD STEPS IN A WAY
   THAT MAKE AN INTELLIGENT FLOW!" Executed steps are evidence; the model authors the draft; promoting a step costs few
   calls.
2. G1: a continued build in a new process is forced back to the start. Remove that.
3. A1 cause 1: show the instructed acts from the first decision as the model's checklist; claims name what the model
   sees; complete only when every act is covered by an authored step.
4. A1 cause 2: progress is the draft advancing toward the acts, not a landed action; the guard names what is missing.

#### Inventory: what keeps an executed step, and what changes (before → after)

| Where | Before | After |
| --- | --- | --- |
| `R/llm/evidence-loop.ts` `draftRecord` (was :256-261) | every executed call appended `kept` (the loop decided) | appended `taken`; `kept` only if the call carried `add` (or `act`) and worked. `draftAuthoring: "transcript"` keeps the old rule for recorded replays |
| `R/llm/evidence-loop.ts` tool-call site (was :700) | recorded the call's step | passes the call's `add`/`act`; computes authored progress |
| `R/flow-draft/step.ts` disposition | `kept`/`dropped`/`exploratory` | adds `taken`; step gains `acts?: string[]` |
| `R/flow-draft/amendment.ts` | `keep` puts back a withdrawn step | new `add` (with `to` to place it, `act` to name the act); `keep` also takes `act` |
| `R/llm/evidence-loop-decision.ts` | tool_call had no draft fields | tool_call may carry `add` and `act` (offered only when authoring; `act` implies `add`); amendments may carry `act`; standing instruction says a Flow is ready only when every act is done, and a revisited state is not progress |
| `R/llm/evidence-loop/rerun-replacement.ts` | rerun appended kept at the end; replaced step dropped; routing naming it orphaned (A1 5a) | under authoring the rerun takes the replaced step's position, membership, acts and routing, and every routing reference is renamed |
| `R/flow-draft/entry.ts` | transcript guidance; entry absent until a step exists | authored guidance (three lengths); `acts` checklist carried whole on every entry, and shown from the first decision with `steps: []` |
| `R/flow-bootstrap/reachability/start-step.ts` | restores a *withdrawn* arrival | also restores a *taken* arrival (Core still puts the required start step first; `withdrawnAs: "taken"`) |
| `R/flow-bootstrap/incomplete-draft/parse.ts` | — | validates stored `acts` ids. (`kept.ts` already stores only steps in the Flow, so a continuation continues the authored Flow.) |
| `R/llm/node-tools/draft-from-flow.ts` (extend seed) | existing Flow nodes seeded `kept` | unchanged: an existing Flow is authored already |
| `R/recording-flow-proposal.ts` (recorded chain) | a person's recording becomes a proposal | unchanged: not the LLM build |
| `R/llm/decision-handlers/failed-call.ts:36`, `answered-request.ts:58` | recorded not-proposable steps | unchanged (they record `taken` now) |

**The acts checklist (A1 cause 1).**
- New `R/flow-bootstrap/instructed-acts/checklist.ts`: each act (`id`, `verb`, `quote`, `plural`) with `done: <step
  number>` or `todo: <reason>` (`no_step_added`, or the check's own fault). Computed by the same rule the completion
  check uses: `check.ts` now exports `automationStudioInstructedActStepFault`, so an act shown done is one a completion
  accepts.
- `check.ts` reads a kept step's `acts` as the model's claims (`automationStudioInstructedActDraftClaims`), so an
  authored step needs no claim written again; its refusal text now tells the model to add with `act`.
- New `R/llm/harness-options/draft-acts.ts` gives the loop `draft.acts` and `draft.actsMissing`; `R/service.ts` passes
  them on every build. `R/llm/loop-configuration.ts` declares both.
- Claims name what the model sees: `R/flow-bootstrap/plan/evidence-schema.ts` describes a claim's step as the step
  number the draft shows (the check already accepted numbers).

**Progress (A1 cause 2).**
- `R/llm/evidence-loop/no-progress.ts`: an applied call whose post-call digest is a state already visited (for the life
  of the loop, across tools) is a step without progress; a call with no digest is judged as before. New
  `refusedAgain(signature, issueSet)`: a completion refused for the same issues over the same proposed steps counts even
  after calls between.
- New `R/llm/evidence-loop/authored-progress.ts`: the authored draft advancing (a step entering the Flow for the first
  time, or fewer acts undone than ever) clears the guard, at a call or at an amendment
  (`R/llm/decision-handlers/amendment.ts`). High-water marks, so toggling a step out and in is not progress: the
  existing laundering test (`R/flow-draft/tests/accrual.test.ts`) caught a first version that counted any landed edit.
- `R/llm/evidence-loop/stall-redirect.ts`: the redirect carries `actsMissing` and leads with "Your next step is the one
  that does aN: run it and add it with act aN"; it no longer says "complete now" while acts are owed.

**G1.** `R/service.ts`: the incomplete draft is read before the harness registry is built; when the build continues it
(`automationStudioFlowBootstrapIncompleteDraftContinuation`), the registry, and the state-digest hook, get no
`startLocation`. The completion check still gets it, so the carried start step is still required.

**Other files.** `R/llm/evidence-loop/decision.ts`, `R/llm/harness/provider-result.ts`,
`R/llm/harness/structured-response.ts` (the call's `add`/`act`); `R/llm/deepseek/preflight.ts` (accepts the schema
with and without the authoring fields); `R/llm/decision-context/shown.ts` (passes `authored`/`acts`);
`R/llm/evidence-loop/draft-shown.ts` (`taken` is a shown disposition); `R/llm/evidence-loop/progress-trace.ts`
(`add=1 act=aN` on a call); `R/llm/evidence-loop/completion-check.ts`, `R/flow-bootstrap/evidence-loop-steps.ts`
(`withdrawnAs: "taken"`); `R/llm/decision-handlers/types.ts`; `R/llm/evidence-loop/index.ts`,
`R/flow-bootstrap/instructed-acts/index.ts`, `R/llm/harness-options/index.ts` (barrels);
`R/llm/harness-options/bootstrap-completion.ts` (script note); `R/llm/node-tools/run-node.ts` (description, still
under the 2,000-character provider limit); docs `docs/architecture/automation-studio/llm-flow-bootstrap.md` and the
regenerated reference (2,780 declarations).

**Tests.**
- New: `R/llm/evidence-loop/tests/authored-draft.test.ts` (taken by default; `add`/`act` on a call; `add` amendment
  with `to`/`act`; transcript rule; grammar offered only when authoring; checklist shown at decision 1; a
  `run-munwmfrs`-shaped revisit loop stops at call 5 of 20 with `actsMissing` in the redirect; an added step clears;
  toggles are not progress), `R/llm/evidence-loop/tests/no-progress.test.ts`,
  `R/flow-bootstrap/instructed-acts/tests/checklist.test.ts`, and a service test in
  `R/tests/service-bootstrap/tests/incomplete-draft.test.ts` (build 1's calls carry the start location; the continued
  build's carry none).
- `R/llm/evidence-loop/tests/rerun-replacement.test.ts`: rewritten for the rerun taking the replaced step's place, plus
  a routing-rename case and a transcript case.
- Recorded replays run under `draftAuthoring: "transcript"` (the rule they were recorded under):
  `R/llm/decision-context/tests/recorded-runs.ts`, `R/route-state/tests/build-routing.test.ts`,
  `R/llm/evidence-loop/tests/stalled-amendments-replay.test.ts`.
- Tests of other behaviour now author their Flow steps with `add: true`: `flow-draft/tests/{dry-run,accrual}.test.ts`,
  `llm/tests/{evidence-loop,evidence-loop-seeded-draft,draft-amendment-feedback}.test.ts`,
  `llm/evidence-loop/tests/progress.test.ts`, `llm/decision-handlers/tests/{completion,decision-context-wiring}.test.ts`,
  `llm/node-tools/tests/replay-draft-verify.test.ts`, `flow-bootstrap/tests/person-needed-replay.test.ts`,
  `flow-bootstrap/incomplete-draft/tests/continuation-loop.test.ts`, and the service tests
  `tests/service-bootstrap/tests/{extend,incomplete-draft,permission}.test.ts`; `generation.test.ts` now expects the
  draft entry (checklist) at decision 1.

**Gaps and notes.**
- `tests/service-bootstrap/tests/permission.test.ts` "goes ahead with nothing permitted, and keeps what the instruction
  asked for": fails on `flow_bootstrap.permission_required` for `move_money` before any draft logic. The gate changed
  in `05266957` (lane D: "money, delete and send always ask") after that test was last edited, and this round touches
  nothing in `action-permissions`. Attributed from history; not re-run on the pre-change tree.
- The act reader reads "Create a deterministic Start to End Flow" (the service fixtures' instruction) as a `create`
  act. The checklist now shows it from decision 1. Owner: whoever owns `instruction-acts.ts`.
- Early give-up (`bootstrap.cannot_answer_instruction`) is unchanged; the no-progress stop still ends a build with no
  "not doable, with reason" path (A3's top cause). Not in this change.
- `maxDraftAmendments` (16 in the service) now also bounds `add` amendments; `add` on the call costs none.
- The domain's arrival comment (`domain/src/runtime/llm-evidence/node-run/arrival.ts`) still says a resumed build starts
  not arrived; that holds only when a start location is sent, which a continuation no longer gets. Not edited.

#### Commands run and observed results

- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` → exit 0, no output.
- `heavy.sh "t196 core final" npx vitest run R/llm R/flow-draft R/flow-bootstrap R/route-state R/tests/service-bootstrap
  R/conversations --maxWorkers=2 --minWorkers=1 --testTimeout=120000` → `Test Files 2 failed | 155 passed (157)`,
  `Tests 2 failed | 1761 passed (1763)`. The two failures are the permission rule's:
  - `service-bootstrap/tests/permission.test.ts`, the test named in "Gaps and notes" above;
  - `conversations/commands/tests/execute.test.ts` "never grants a delete by typing", which matches dev's PIN change
    `3bbee17d`.
  Neither file touches the draft, loop or acts code.
- Whole `src/programs/automation-studio` suite (before the last three test edits) → `Test Files 6 failed | 452 passed
  (458)`, `Tests 12 failed | 4353 passed | 1 skipped`.
  - `extension-chat.test.ts` (3) was mine and is fixed: its mock build now adds its step, and the file passes 7/7.
  - The other failures do not reference the changed modules: the two permission tests; `native-node-runtime.test.ts`
    (a graph value is NaN); `scale-pages.test.ts`; and `storage/project/tests/runtime-stream-store.test.ts` (SQLite
    `EBUSY` and a 60 s timeout).
- Core `pnpm --filter fluxiq build` → exit 0.
- Domain: all `domain/src/runtime/llm-evidence/**/tests` plus `runtime/tests/host-runtime.test.ts` against the rebuilt
  dist, through the narrow runner → `# tests 410 # pass 410 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` → exit 0.
- Core `node scripts/structure-audit.mjs` → `passed (199 warning(s), 354 baselined)`. It briefly showed 200 because
  `loop-configuration.ts` reached 408 lines; the comments were compressed to 394.
- `node scripts/docs-reference.mjs` → 2,780 declarations. `pnpm docs:check` → `Deterministic framework reference is
  current.`

#### Not verified

- No Lab, browser or live run (all stopped by the user). It is therefore not checked whether a real model:
  - uses `add`/`act` on calls;
  - reads the checklist;
  - stops circling.
- Revisit detection depends on the web binding's post-call state digests. A domain without digests falls back to the
  old rule.
- The permission-rule failures are attributed from git history. I did not re-run them on the tree before this change.

**Ready to commit:** Core `C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQ`, 53 modified files and 6 new ones.
- New:
  - `R/flow-bootstrap/instructed-acts/checklist.ts` and its test `tests/checklist.test.ts`;
  - `R/llm/evidence-loop/authored-progress.ts`;
  - `R/llm/evidence-loop/tests/authored-draft.test.ts` and `tests/no-progress.test.ts`;
  - `R/llm/harness-options/draft-acts.ts`.
- Modified, beyond the files listed in the tables and paragraphs above:
  - `R/conversations/commands/tests/extension-chat.test.ts`;
  - `R/tests/service-bootstrap/tests/{extend,generation,incomplete-draft,permission}.test.ts`;
  - the docs and the regenerated reference (`docs/reference/framework-reference.md` and
    `packages/fluxiq/docs/reference/framework-reference.md`).
- Downstream: this report only.
- Validation: the affected Core suites → 1761 passed and 2 failed, both from the earlier permission rule; domain →
  `# pass 410 # fail 0`.

### The dry run and the build lifecycle (worker, 2026-09-30, after the WIP commits 0645df78 / 66c77aea)

`R` = `packages/fluxiq/src/programs/automation-studio/runtime` (Core), `D` = `domain/src/runtime/llm-evidence` (downstream).

**Definitions used.** N1, D1 and wH were not defined in this report. I took them from the plan and the reports:
- N1 = `t174-live-lane.md` row N1 (an unreproducible step stopped blocking once reported; keep blocking unless
  `optional`/`only_if`, record waved steps, trace a reused dry run).
- D1 = the supervisor's decision in `language-driven-flow-loop-plan.md` (never clear site data or log the person out;
  never repeat a lasting effect; verify a mutating step instead of re-executing it).
- wH = `t193-wH-row-control-replay.md` §"What the dry-run gate should do with a state-setting step whose effect
  already holds": a step whose effect is already in place must not block.

**Mid-task orders from the supervisor (user's words), which took priority:**
1. No replay from the first step during exploration or the initial build.
2. A full replay belongs to the judgement phase (test and judge once the model declares the Flow ready) and to the
   repair phase. "IT REPLAYS IT FROM THE START DURING THE JUDGEMENT PHASE. JUST NOT DURING EXPLORATION/INITIAL
   BUILD." Also: "or during repair phase directly".
3. The draft must be authored by the model as an intelligent Flow, never a transcript of the steps it took.

#### Triage of the WIP (wR's work, `t196-wR-unreproducible.md`)

wR's report says Done. All of its edits were present and I kept them. The only broken piece was the merge conflict
in `R/llm/node-tools/dry-run-gate.ts` and its test.

#### Conflict resolution (staged with `git add`, not committed)

- `R/llm/node-tools/dry-run-gate.ts`. Both sides are kept:
  - HEAD (wR): `reusedClean` callback, no `asked` in the verdict.
  - dev (lane D t195, `05266957`): `MAX_REPLAYS_OF_ONE_DRAFT = 2`, after which an unchanged draft is judged from
    its last replay's outcomes instead of being replayed again.
  - Merged behaviour:
    - The judged-again verdict takes no `asked` (N1), and its feedback marks `again`.
    - Its `conditional` set also includes the withheld steps.
    - A judged-again pass calls `reusedClean` (history row `reused_clean`).
  - The dev comment "a step put to the model as unreproducible once no longer blocks" was stale under N1 and is
    rewritten.
- `R/llm/node-tools/tests/dry-run-gate.test.ts`. Both describe blocks are kept, and dev's helper is renamed
  `pressOn`.
  - Run 18's completion 48 and run 33's 63-64 are now judged, not replayed. They are still refused, with `again`.
  - The routing test asserts `reusedClean` is called once.
- `R/flow-draft/tests/routing.test.ts` came from dev with an `asked:` argument, which no longer exists. I removed it.

#### Inventory: every place a build re-executes or returns to the start (before this change)

| # | Where | What it did | Phase now |
| --- | --- | --- | --- |
| 1 | `R/llm/evidence-loop/completion-attempt.ts:74` (was :61), calling the gate built at `R/llm/evidence-loop.ts:418` | Replayed the whole draft from its first step on **every** completion attempt, even when the check refused it. This is the loop the user saw. | **Moved to phase 2**: runs only when the check accepted the completion |
| 2 | `R/llm/evidence-loop.ts:490` (old :495, `await dryRun()` after the resume entry) | Replayed the whole draft before a continued build's first decision | **Deleted** (live phase) |
| 3 | `R/llm/node-tools/dry-run-gate.ts:130` → `R/llm/node-tools/replay-draft.ts:99` (reset) and `:111` (steps) | The replay itself: a reset navigation to the first step's `from`, then every proposed step | **Kept, phase 2/3** (the test, and again after each repair) |
| 4 | `D/node-run/replay.ts` `resetPage` | The reset: `web.browser.navigate` to the recorded location. It never clears data. | **Kept, phase 2/3**. D1 bullet 1 holds, now documented. |
| 5 | Replaying lasting steps inside #3 | Repeated saves and adds on the person's real account (run 21, run 18) | **Replaced by verify** (D1). See the changes below. |
| 6 | `R/llm/evidence-loop/rerun-request.ts:48`, `R/llm/decision-handlers/amendment.ts:37,115` (`amend_draft rerun`) | Runs **one** step again, on the live page, as that iteration's call. Never from the start. | **Kept, phases 1/3** (live work). Gap G3 below. |
| 7 | `D/node-run/arrival.ts` + `start-location.ts` (a build's opening call `initial.*` re-arms arrival; a new process has none) | Forces a navigation to the start location before any other call. Until now a continuation was re-arrived by #2's replayed navigate step. | **Kept for a fresh build**. For a continuation this is gap G1. |
| 8 | Wrap-up: `R/llm/evidence-loop.ts:532`, `R/llm/loop-budget.ts:43` | Offers only finishing in the last 3 decisions; no re-execution | Phase 1 → 2 transition. Kept. |
| 9 | Result verification: `R/result-verification/verify.ts:120` | Judges the result of a **Flow run** (after the build) | Phase 2 for runs. Kept. |
| 10 | Refuted-result repair and re-author: `R/recovery/refuted-result/repair.ts:126`, `R/service/runtime-adaptation/refuted-result-port.ts` | After a refuted run: repair, or re-author the Flow with a new build | Phase 3. Kept. |
| 11 | Person-cleared replay: `R/service.ts:1545` (`clearedResultCode: automationStudioFlowDraftReplayClearedCode`) | Reads a check a person cleared during a replay | Phase 2/3. Kept; a cleared `verify` now answers `verified`. |

**The authored draft: where an executed step is kept automatically (the loop decides, not the model).** This is gap G2.

| Where | What |
| --- | --- |
| `R/llm/evidence-loop.ts:256-261` `draftRecord` | Appends **every** executed call as a step with `disposition: "kept"` |
| `R/llm/evidence-loop.ts:700` | Every tool call's result is recorded through `draftRecord` |
| `R/llm/evidence-loop.ts:483` | The free first look is recorded as a step (observe, not proposed) |
| `R/llm/decision-handlers/failed-call.ts:36` | A failed call is recorded as a step (`effectApplied: false`, so not proposed) |
| `R/llm/decision-handlers/answered-request.ts:58` | An answered look is recorded as a step (not proposed) |
| `D/node-run/run.ts:232,259` and the `draft` statement on every result | The domain says per call whether it `proposes`. A successful action or read proposes itself. |
| `R/flow-draft/step.ts` `automationStudioFlowDraftStepIsProposed` | A kept, successful action is in the Flow unless the model withdraws it (`dropped`/`exploratory`) |
| `R/flow-bootstrap/authoring/assemble-draft.ts:63` | Assembles the Flow from the proposed steps in the order they ran |
| `R/llm/node-tools/draft-from-flow.ts:85,110` | An extend build's seed is the existing Flow's nodes, each `kept` |
| `R/llm/node-tools/draft-step.ts:44` | Writes a proposed step as a Flow node |
| `R/recording-flow-proposal.ts` | The recording path turns a recorded chain into a Flow proposal (not the LLM build) |

Today the model's only authoring tools are `amend_draft` changes: drop, exploratory, keep, rerun, repeat,
optional, only_if, and order changes. These subtract from or annotate the transcript. They do not author it.

#### Changes

**Phase boundary (the user's lifecycle).**
- `R/llm/evidence-loop/completion-attempt.ts`
  - The test (the dry-run gate) runs only after the completion check accepts.
  - A check refusal is answered from the check alone. No replay happens, and the page stays where the live work left
    it.
  - The header records why the 2026-09 "both on every attempt" rule went.
- `R/llm/evidence-loop.ts`: a continuation no longer replays its draft before the first decision.
- `R/llm/evidence-loop/resume.ts`
  - The continuation instruction now says the steps were not run again and the page is where it stands.
  - It tells the model to get to where the draft leaves off by the shortest way, marking steps taken only to get
    there `exploratory`, and says the whole Flow is run once when the model completes.
- `R/llm/loop-configuration.ts`: the `resume` and `dryRun` documentation.
- `R/flow-draft/dry-run.ts`
  - The header gains the lifecycle.
  - `DRY_RUN_INSTRUCTION` now opens "You said the Flow is ready, so it was tested", tells the model to repair live
    from where the test stopped, and says the draft is not run from the beginning again until it says it is ready
    again.

**D1 + wH (verify instead of re-execute), ported from lane A's WIP `f26e7eeb` and changed.**
- New `R/flow-draft/verify-only.ts` (with `tests/verify-only.test.ts`).
  - A proposed step is checked instead of run when it has `effect: "mutate"` and declares any consequence other than
    none.
  - It answers `verified` or `present`, and the model sees those words, never `replayed`.
  - `withheldBy` / `afterWithheld` excuses a later non-replay **only when the verified step moved the target**. That
    is read as the next proposed step's `replay.from` differing from this one's, compared whole and never read.
    Lane A excused every later failure after any verified step, which would have let most of a shopping Flow
    through unproved.
- `R/llm/node-tools/replay.ts`
  - New kind `verify`.
  - New codes `core.replay.verified` and `core.replay.present`.
  - `automationStudioNodeReplayVerifyCall` carries `from`.
  - `automationStudioNodeReplayStatus(code, mode)` passes `verified`/`present` **only for a check**. A `step` call
    answering either has failed.
- `R/llm/node-tools/replay-draft.ts`
  - Uses verify mode and computes `withheldBy`.
  - The verdict's `conditional` set also includes the withheld steps.
  - A cleared verify answers `verified`.
- `R/flow-draft/dry-run.ts`: the outcome gains `mode` and `withheldBy`, and the feedback shows the word and
  `afterWithheld`. `R/flow-draft/entry.ts` shows the word in the draft. `R/flow-draft/index.ts` exports
  `verify-only`.
- `R/llm/decision-handlers/completion.ts`: `verified` and `present` count as passed in the history row.
- `D/node-run/replay-answer.ts` (new) is the shared answer code, split out of `replay.ts` as lane A did, plus
  `present`.
- `D/node-run/verify.ts` (new):
  - It resolves the step and asserts its target `visible` and then `enabled` with `web.dom.assert`. It dispatches
    nothing that acts.
  - A missing target is **`present` when the captured page's location equals the step's own `from.location`**. That
    is the effect already in place: run 21's save, and t193-wH's "Your store".
  - A missing target is `unreproducible` otherwise, as in run 18, where the steps no longer reach the page. That still
    blocks under N1.
  - `D/node-run/replay.ts` routes `verify`.

**N1 remainder.** `R/llm/evidence-loop/progress-trace.ts` now prints a dry run's own call ids
(`dryrun.<n>.<step|reset>`). A completion that reused a verdict can therefore be told in `core.log` from one that
replayed, which was t174-w16's instrumentation gap 1.

**Docs.**
- Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`: the live and judgement phases, the replay cap,
  and D1 with `verified`/`present`/`afterWithheld`. The reference docs were regenerated (2,771 declarations).
- Extension `docs/architecture/web-capabilities.md`: the dry run's calls, the reset never clearing data, and verify.
- The stale "asks once" header in `D/node-run/tests/replay-ambiguous-target.test.ts` is fixed (wR's open question).

**Tests changed for the new boundary.**
- `completion-attempt.test.ts`: no replay when the check refused.
- `decision-handlers/tests/completion.test.ts`: rewritten. There is no test at a check-refused completion, and a
  failed test shows its steps.
- `resume.test.ts`: a new loop-level case. A continuation makes zero `executeTool` calls before its first decision.
- `recorded-runs.ts` / `recorded-windows.test.ts`: `now` lines. These are every logged completion the check refused
  that was dry-run live: bigbox 22 and 26, crossborder 19, and run 4's 40, 44 and 46. Run 4's 47 matches its log
  again. The window at run 4's 47 now shows the live page `cartextract5` and no dry-run entry.
- `route-state/tests/build-routing.test.ts`: fewer dry-run calls before decisions (15/12, 10/7 and 29/25).

#### Gaps (named, not closed here)

- **G1: a continuation across processes and the arrival rule.**
  - Without the old resume replay, a continued build's first action in a new process (or after its opening `initial.*`
    call re-arms arrival) is refused `start_location_not_reached` until it navigates. `D/node-run/arrival.ts` explains
    why.
  - The resume instruction tells the model to mark such a navigation `exploratory`, but the rule still forces a
    return to the start location.
  - Fix, in either repository:
    - (a) `R/service.ts:1538` builds the harness registry with `startLocation` for every call. For a continuation
      whose carried draft holds a proposed step, pass none, because a proposed step can only exist after arrival.
      This needs the incomplete-draft read (`:1555`) moved above the registry.
    - (b) Core names a continuation's opening call other than `initial.*`, and the domain treats a build with a
      carried navigation as arrived.
  - Continuations are rare (a build that ran out of decisions), so I did not change `service.ts` under this brief.
- **G2: the transcript draft (user: "IT SHOULD NOT JUST BLINDLY ADD EACH STEP").** Every executed step is appended by
  the loop (table above), and the model can only subtract or annotate. Closing this is a cross-module design change:
  - an `author_draft` (add, replace, move, remove a node from what was learned) replaces auto-keep;
  - `draftRecord` records calls as evidence, not as steps;
  - `assemble-draft` reads only authored steps;
  - the domain's `proposes` becomes advice, not membership.
  It touches the loop, amendments, the completion check, the domain statement and many tests, so it wants its own
  brief. I did not start it, to keep this change coherent for the merge.
- **G3: rerun may repeat a lasting effect.** `amend_draft rerun` (#6) re-executes one step live. For a step that
  worked and declares a lasting consequence, that repeats the effect (D1). It should be verified or refused with a
  note. Not changed.
- **G4: early give-up.**
  - `bootstrap.cannot_answer_instruction` (`R/flow-bootstrap/answerability/check.ts:76-79`, carried by
    `R/llm/evidence-loop/answerability.ts:6` and `R/flow-bootstrap/evidence-loop-steps.ts:474`) is a completion refusal
    stating that no step produces records.
  - I did not trace whether any path lets the model end the build on it while a record-producing node is still
    available. That needs whoever owns answerability.
- **G5: phase 2 tests the draft, not the persisted Flow.** The test replays the draft's steps through the executor. It
  does not run the assembled, persisted Flow. It is the same steps with the same arguments, but not the same code path
  as playback.

#### What lane A (t174) should drop at integration

Lane A's tree has **already dropped** its D1 work: no `flow-draft/verify-only.ts`, no `node-run/verify.ts` and no
`replay-answer.ts` remain, and `git diff dev...HEAD` shows nothing of it in Core's `flow-draft`/`node-tools`. At
integration:
- **Drop** lane A's `D/node-run/replay.ts` hunk. Take this lane's file.
- **Keep** lane A's move of `WebNodeRun` to `D/node-run/context.ts`. Then change `import type { WebNodeRun } from
  "./run"` to `"./context"` in this lane's `replay.ts`, `replay-answer.ts` and `verify.ts`. It is a one-line edit
  each, and tsc will name them.
- In `D/node-run/index.ts`, keep lane A's lines. This lane adds no export there.
- Nothing else of lane A's overlaps this lane.

#### Commands run and observed results (this worker)

- `heavy.sh "t196 core tsc 3" npx tsc -p packages/fluxiq/tsconfig.json --noEmit` → exit 0, no output.
- `heavy.sh "t196 core vitest wide 3" npx vitest run R/llm R/flow-draft R/flow-bootstrap R/route-state
  --maxWorkers=2 --minWorkers=1` (from `packages/fluxiq`) → `Test Files 126 passed (126)`,
  `Tests 1571 passed (1571)`. The run before the lifecycle change printed 126/1570, and the first run after it failed
  10 tests, all fixed as listed above.
- Core `node scripts/structure-audit.mjs` → `passed (199 warning(s), 354 baselined)`, plus "1 baseline entries can
  be lowered", the same `runtime/service.ts` entry wR reported.
- Core `node scripts/docs-reference.mjs` → `(2771 public declarations)`. `heavy.sh pnpm docs:check` → `Deterministic
  framework reference is current.`, exit 0. The first attempt failed until the reference was regenerated.
- Core dist:
  - `heavy.sh pnpm --filter fluxiq build` failed first on `executor/defensive/assess.ts(113,54)`, because the
    `@fluxiq/contracts` dist was stale after the dev merge.
  - `pnpm --filter @fluxiq/contracts build` → exit 0 (restored from the cache).
  - `pnpm --filter fluxiq build` → exit 0.
  - This build predates the lifecycle edits, which the domain does not import.
- Domain: all 56 `D/**/tests/*.test.ts` plus `runtime/tests/host-runtime.test.ts` through the narrow runner
  (`scratchpad/t196-narrow.mjs`, a copy of wD's) → `# tests 410 # pass 410 # fail 0`.
  - Before the Core dist rebuild, 2 failures in `plan-step-permission.test.ts` came from the dev-merged F10 wording
    against the stale dist, not from this lane.
- `heavy.sh pnpm --filter @fluxiq-web-extension/domain check` → exit 0. It failed once on a test type,
  `NOT_THERE[1]!`, which is fixed.
- Downstream `node scripts/structure-audit.mjs` → `passed (128 warning(s), 120 baselined)`.
  - It first failed with 2 violations in `replay-answer.ts` (`contract-spread`, `failure-as-empty`), both fixed. The
    capture keeps the original fall-through shape.
  - The warning count rose from 124 because of the dev merge. None of the warnings are on this lane's files.

#### Not verified

- No Lab, browser or live run (the user stopped all Labs). Not checked:
  - whether `web.dom.assert` resolves every resolved target shape a verify sends;
  - whether a real site's "effect already present" page matches the step's `from.location`;
  - the live behaviour of the model under the new lifecycle.
- The whole fluxiq suite and Core `pnpm check`; only the four runtime directories above were run.
- The extension package's own suites and `pnpm -r check`, which I did not run after the last edits. The domain check
  and the audit were run.
- G1 to G5 are open.

**Ready to commit:**
- Core `C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQ`:
  - The two resolved conflicts (staged): `R/llm/node-tools/dry-run-gate.ts` and
    `R/llm/node-tools/tests/dry-run-gate.test.ts`.
  - `R/flow-draft/{dry-run.ts, entry.ts, index.ts, verify-only.ts (new), tests/verify-only.test.ts (new),
    tests/routing.test.ts}`.
  - `R/llm/node-tools/{replay.ts, replay-draft.ts, tests/replay-draft-verify.test.ts (new)}`.
  - `R/llm/decision-handlers/{completion.ts, tests/completion.test.ts}`.
  - `R/llm/evidence-loop.ts` and `R/llm/evidence-loop/{completion-attempt.ts, resume.ts, progress-trace.ts,
    tests/completion-attempt.test.ts, tests/resume.test.ts, tests/progress-trace.test.ts}`.
  - `R/llm/loop-configuration.ts`.
  - `R/llm/decision-context/tests/{recorded-runs.ts, recorded-windows.test.ts}`.
  - `R/route-state/tests/build-routing.test.ts`.
  - `docs/architecture/automation-studio/llm-flow-bootstrap.md`, `docs/reference/framework-reference.md` and
    `packages/fluxiq/docs/reference/framework-reference.md`.
  - The rest of the index is the dev merge.
- Downstream `C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQWebExtension`:
  - `D/node-run/{replay.ts, replay-answer.ts (new), verify.ts (new), tests/replay-verify.test.ts (new),
    tests/replay-ambiguous-target.test.ts}`.
  - `docs/architecture/web-capabilities.md` and this report.
- Validation:
  - `npx vitest run R/llm R/flow-draft R/flow-bootstrap R/route-state` → `126 passed (126)`, `1571 passed (1571)`.
  - `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` → exit 0.
  - Core `node scripts/structure-audit.mjs` → `passed (199 warning(s), 354 baselined)`.
  - Domain narrow run → `# tests 410 # pass 410 # fail 0`.
  - `pnpm --filter @fluxiq-web-extension/domain check` → exit 0.
  - Downstream audit → `passed (128 warning(s), 120 baselined)`.
- Core and domain must land together: the domain answers the new `verify` kind that Core now sends.

### Follow-up after merge (Core 204119b / downstream cccd1e96): the route-state captures

The walkthrough (`flow-builder-walkthrough.md` §3, and §7 bullet 3) found that build routing still asked the host
for a full page capture in two places: at build start (`route-state.ts` `startAutomationStudioBuildRouting`), and
before every decision whose shown entries had grown (`observing`). A fresh `git status` showed both trees clean, with
dev merged in (Core `f0cdcfc`, downstream `aa8efb52`: t174, t191, t193).

6. **Contract (lead).**
   - An execution result may carry `routeState`: the route state of the page the call left, projected from the call's
     own capture exactly as the host's `observeRouteState` projects a fresh one (`llm/evidence-loop/tool-execution.ts`).
   - The loop accepts the key and never reads it (`evidence-loop-decision.ts`).
7. **Domain (wD2).**
   - Every result that holds a page reports `routeState` from the capture the call already took: a look's capture,
     an action's capture after acting, a refusal's page, a detection's capture, or a replay step that captured.
   - It uses `domain/src/runtime/llm-evidence/snapshot-states.ts`, which replaces `snapshot-state-digest.ts` and
     computes both the digests and the route state.
   - No command was added: captures per decision are unchanged.
   - A test shows each value deep-equals `observeRouteState` on the same page, including trimmed packets and pages
     with a blocker. A mutation run failed 4 of its 15 tests.
   - One existing test, "no refusal carries a word of the page", now excludes `routeState`:
     - `routeState` holds page words by design;
     - the loop never reads it and no trace logs it;
     - the routing context used to get the same value from its own capture.
     I accepted the change.
8. **Core routing (wL2).**
   - `route-state.ts` was split into `route-state/{observe,router-state,build-routing,index}.ts`, with tests in
     `route-state/tests/`.
   - `build-routing.ts` records the `routeState` of every call through a `recording(executeTool)` wrapper, dry-run
     replay steps included. Before a decision it records the newest call's state when a call ran since the last
     decision.
   - It captures only when the newest call carried none.
   - The trigger is now "a call ran", not "the shown count grew". The old rule stopped firing once the window was
     full, so it missed 8–28 post-call states per recorded build.
   - An evidence-guided build takes its start state from the free first look, and captures it right after the look
     only when the look carried none. The one-reply path still captures eagerly.
   - `service.ts`: 3 lines (the import, `start: evidenceGuided ? "first_look" : "now"`, and
     `executeTool: routing.recording(permissions.executeTool)`).
9. **Lead.**
   - Fixed the stale path in `tool-execution.ts`.
   - Docs: Core `docs/architecture/automation-studio.md` (route state from calls) and the extension's
     `docs/architecture/web-capabilities.md`. Reference docs regenerated.
   - Rebuilt the stale `client-gateway-websocket` dist from merged dev source. The extension check needed it for
     t191's `FluxIQClientGatewayOpenError`; this is unrelated to this lane.

**Route-state captures, per decision (build-routing tests) and per replayed build.** "Before" is the old rule.
"Calls report" is the web binding now. "None reports" is a binding without `routeState`.

| Decision | Before | Calls report | None reports |
| --- | --- | --- | --- |
| Build start | 1 | 0 | 0 |
| Free first look | 1 | 0 | 1 (the start, right after the look) |
| Look / action / first re-ask | 1 each (when the shown count grew) | 0 | 1 |
| Answered from memory / amendment | 0 | 0 | 0 |
| Call with no route state (e.g. a replay step that did not capture) | 0 | 1 | 1 |
| Completion with a dry run | 1 | 0 | 1 |

| Build (replayed) | Decisions | Before | After, web binding |
| --- | --- | --- | --- |
| bigbox-run6 | 37 | 7 | 0 |
| crossborder | 22 | 5 | 0 |
| everything-store-run4 | 48 | 6 | 0 |
| run-munneauy (rebuilt) | 15 | 12 | 0 |

In a Lab build, the free first look is refused (`not_at_start_location`) and has no page, so the start still costs
one capture; so does a decision after a dry run whose last replay step did not capture.

**Validation (lead, final code).**
- Core dist rebuilt: `heavy.sh "t196 core build 4"` → exit 0.
- Domain tests against the rebuilt dist: all `llm-evidence/**/tests` plus `runtime/tests/host-runtime.test.ts`, 50
  files through the narrow runner → `# tests 383 # pass 383 # fail 0`.
- Core `heavy.sh npx vitest run …/runtime/route-state …/runtime/llm …/runtime/flow-bootstrap --maxWorkers=2
  --minWorkers=1` → `Test Files 110 passed (110)`, `Tests 1443 passed (1443)`.
- Core `heavy.sh pnpm check` → exit 0, `structure-audit: passed (195 warning(s), 354 baselined)`, and all four
  packages `check: Done`.
- `pnpm docs:check` → current.
- Extension `heavy.sh pnpm -r check` → exit 0, all packages `Done`. It failed once until the gateway dist was rebuilt.
- Extension structure audit → `passed (124 warning(s), 120 baselined)`.

**Pre-existing, not this lane.** Six tests in `runtime/tests/service-bootstrap/tests/rejections.test.ts` fail
(reported by wL2; I reran the file myself: 6 failed, the rest passed).
- Each fails because the pre-provider rejection diagnostic now carries `issueCodes: ["thrown.Error",
  "thrown.at:…field-readings.ts:6"]`.
- Those codes come from the throw-account work in dev (`80e0ce99`).
- The throw happens in command-field validation, before routing starts, in files this lane never touched.
- `runtime/tests` as a whole also times out at the 15 s default under load. It passes with `--testTimeout=120000`,
  apart from those six.
- The supervisor still needs to run `pnpm structure:baseline` (one entry can be lowered).

### First round (merged)

1. **Core contract (lead).**
   - An execution result may carry `stateDigests: { before?, after? }` from the call's own captures
     (`runtime/llm/evidence-loop/tool-execution.ts`). It is parsed in `evidence-loop-decision.ts`, and a value that is
     not code-shaped is dropped, leaving that side unobserved.
   - A binding declares it with `stateDigestsOnCalls: true` (`runtime/llm/harness-options/binding.ts`).
   - Core dist was rebuilt so the domain compiles against it.
2. **Domain digests from its own captures (wD)** (`domain/src/runtime/llm-evidence/`).
   - Every result carries `stateDigests`:
     - a look: before and after both from its one capture;
     - an action: before from its read before acting, after from its read after;
     - a refusal that carries a page: from that page;
     - a detection: from its own captures.
   - The digest is of the capture sanitized exactly as `captureStateDigest` sanitizes it (`snapshot-state-digest.ts`).
     A test shows the two are equal even when the call's packet was bounded tighter (2,500 bytes, truncated).
   - The binding sets `stateDigestsOnCalls: true`. `captureStateDigest` stays for other callers.
3. **Core loop (wL).**
   - `service/flow-bootstrap-commands/state-digest.ts` passes no hook for such a binding, so the build loop takes no
     digest capture.
   - Each call's states come from the hook or from the result, never both at one point.
   - An answer from memory takes no capture (`decision-handlers/answer-check.ts` rewritten):
     - the first re-ask of a look in an epoch is run once more for real (one capture) and compared by digest;
     - an equal digest is a verified repeat: no progress, the new result replaces the old entry, and the note is
       `llm_evidence_loop.looked_again_unchanged`;
     - a different digest is a page that moved by itself;
     - later re-asks in the same epoch are answered from memory for free.
4. **An ignored redirect bites (wL)** (`decision-handlers/look-withdrawal.ts`).
   - When the decision right after a shown redirect again asks for what the loop holds, looks are withdrawn from the
     next decision until an action runs:
     - observe-only tools are not offered;
     - `core.run_node`'s `node` enum loses the actions seen reporting `effect: observe, proposes: false` (new tool
       field `actionInputKey`, never sent to the provider).
   - A withdrawn look asked for anyway is refused as `llm_evidence_loop.look_withdrawn`. It is never answered and never
     run, and it counts toward the no-progress stop.
   - Every redirect now warns that this will happen.
   - The history records the withdrawal as a `looks_withdrawn` redirect.
5. **Docs (lead).**
   - Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`:
     - per-call digests;
     - the free answer from memory and the one verifying re-run;
     - look withdrawal.
   - Extension `docs/architecture/web-capabilities.md` (capture_snapshot): what a build captures.
   - Core reference docs regenerated (`node scripts/docs-reference.mjs`, 2,680 declarations).

## Captures per decision type (domain tests with a command-counting gateway, wD)

| Decision | Before | After |
| --- | --- | --- |
| Look (free first look or model look) | 3 | 1 |
| Action that runs | 4 (+ the action) | 2 (+ the action) |
| Action refused before acting | 3 | 1 |
| Detection, page-wide / around a target | 3 / 4 | 1 / 2 |
| Look answered from memory | 1 | 0 (first re-ask in an epoch: runs, 1) |
| Withdrawn look (refused) | — | 0 |
| Dry-run replay step (ran / failed) | 0 / 1 | 0 / 1 (Core never digested replays) |

**Action is 2, not the brief's target of 1.** The read before acting is kept. The model decides seconds after its
last look, and the page can move without a command in that time (late results, redirects, timers). Reusing an older
capture would change four things, so it would no longer be exactly as correct:
- which stale handles are refused before acting;
- the control the person is asked about;
- where a dry run resets to;
- `pageChanged`.

The full reasoning is in `t196-wD-domain-digests.md`, task 3.

## Core loop, per decision (`decision-handlers/tests/state-digest-cost.test.ts`, wL)

With a `stateDigestsOnCalls` binding, no decision type makes a digest-hook call:
- free look, action, look, first re-ask and "look again" each make 1 `executeTool`;
- later re-asks and withdrawn looks make 0.

With a legacy hook binding, each executed call makes 2 hook calls and an answer from memory makes 0 (it used to make 1).

## Before and after per build

**run-munneauy, rebuilt with the real loop** from its recorded shape (wL, `state-digest-cost.test.ts`):

| | Decisions / provider calls | executeTool | Digest-hook calls | Answered from memory | Ended |
| --- | --- | --- | --- | --- | --- |
| before (recorded; hooks derived from f0dbbd6) | 18 / 18 | 9 | 28 | 9 | `repeat_without_progress` at 18 |
| after, `stateDigestsOnCalls` | 15 / 15 | 9 | **0** | 3 | `repeat_without_progress` at 15 |

- Decision 8, the first re-ask, is run once more and verified unchanged.
- Decisions 9–11 are answered from memory.
- The redirect after 10 is ignored at 11, so looks are withdrawn from 12.
- The looks scripted at 12–15 are refused, not answered.

**Captures and wall time on the four recorded shapes.**
- Method: each recorded step (`snapshots/flow-lane.json`) is classified and costed with the table above
  (`scratchpad/t196-measure.cjs`).
- The ms per digest capture is the median of the build-trace gaps that are one digest capture each ("loop start" →
  "tool start", "tool end" → "decide start"), where the log has them.
- "After, captures only" leaves the decisions as recorded. Only run-munneauy was replayed, so only its row includes
  the decisions that withdrawal saves.

| Build | Decisions | Provider calls | Captures before | Captures after | ms per digest capture | Build ms before | Build ms after (captures only) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t193 run-munneauy | 18 → 15 (replayed) | 18 → 15 | 39 | 12 (replayed; 13 on the recorded 18) | ~120 (no trace in bundle) | 46,461 | ≈ 43,300; ≈ 38,500 with the 3 decisions withdrawal saves (≈ 1.6 s each) |
| t193 run-munnq7vz | 64 | 63 | 146 | 57 | 111 (45 samples) | 179,890 | ≈ 170,000 |
| t194 run-munnhi5q | 32 | 25 | 75 | 35 | ~120 (no trace in bundle) | 343,580 | ≈ 338,800 |
| t195 run-munnop9n | 41 | 32 | 77 | 35 | 57 (30 samples) | 158,944 | ≈ 156,600 |

- Captures fall by 55–69% on every shape, and all of what remains is the calls' own reads.
- Provider calls change only where withdrawal ends a stall earlier (run-munneauy −3). run-munnq7vz had 5+ answered
  runs, so it is the build most likely to be shortened further; that needs a live run to know.

## Validation (lead, final code)

- Core `heavy.sh "t196 core check" pnpm check` → exit 0. `structure-audit: passed (195 warning(s), 354 baselined)`;
  contracts, client-gateway-websocket, fluxiq and apps/web `check: Done`.
- Core `npx vitest run src/programs/automation-studio/runtime/llm --maxWorkers=2 --minWorkers=1` → `Test Files 69
  passed (69)`, `Tests 658 passed (658)` (baseline 68/651).
- wL: flow-bootstrap + recovery + service + service-bootstrap state-digest test → `109 passed`, `1463 passed | 1
  skipped`.
- Core dist rebuilt with the final code (`heavy.sh "t196 core build 2" pnpm --filter fluxiq build` → exit 0).
- All 47 domain `llm-evidence` test files against it (wD's narrow runner, `heavy.sh`) → `# tests 350 # pass 350
  # fail 0`.
- Extension `heavy.sh "t196 ext -r check" pnpm -r check` → exit 0, every package `Done`.
- Extension `node scripts/structure-audit.mjs` → `passed (124 warning(s), 120 baselined)`.
- Core `pnpm docs:check` → `Deterministic framework reference is current.`

## Not verified

- No live run: the side-panel effect and live wall time come from the next integration round's live lanes.
- The one-capture-per-action target was not met: an action takes 2 (see above).
- Recovery's annotation exploration still calls `captureStateDigest` directly (a full capture), because `recovery/**`
  is outside this lane. Builds are unaffected.
- The per-build capture counts are costed from recorded shapes, not counted from the extension; the per-type costs are
  counted in domain tests.
- A detection capture is assumed to digest like a plain capture.

## Notes for integration

- Core and domain must land together: the domain's results carry `stateDigests`, which older Core rejects as an
  unknown key (`tool_result_invalid`).
- `evidence-loop.ts` is 740 lines (limit 800).
- The older t189 replays run with `lookWithdrawal: false` and no hook, so they still reproduce their logs.
- The regenerated reference docs will conflict with any other lane that regenerates them; regenerate after merging.

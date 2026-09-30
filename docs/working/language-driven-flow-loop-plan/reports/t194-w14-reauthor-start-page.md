# t194-w14: a re-author explores from where the step it changes starts

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`. Paths below are under
`packages/fluxiq/src/programs/automation-studio/runtime/` unless stated. Nothing committed.

## Outcome

**Partial.** The mechanism is complete and tested in my owned files:

- choosing the step to change;
- planning the prefix replay, including the lasting-effect refusal;
- running the prefix with no model call, with failures reported;
- the brief's lines about where the page is;
- the run record;
- the `position`-before-`generate` ordering in `reauthor.ts`.

The one production change that takes effect today is that every repair brief now says where the page in front of the model is. The prefix replay itself does **not** run in a live repair yet. The caller that must supply `position` and a step executor is `service/runtime-adaptation/refuted-result-port.ts` plus `service.ts`, and neither is in my ownership. The exact wiring is proposed below.

## Step 1: how the re-author gets its target today (established)

- The route runs in the run's own host session, so it uses the same target (tab) the playback used. `refuted-result-port.ts:118-138` builds the brief, then calls `deps.generate({ mode: "extend", evidenceGuided: true, caller, permittedConsequences }, brief, costLeftUsd)`.
- The request carries no `startLocation`. `generation-request.ts` gives extends none, and `conversations/commands/build.ts:33` drops it for `mode: "extend"` too. So the domain's arrival enforcement and the `startLocationNote` ("You are not at startLocation yet...") are both off.
- `service.ts:1573` seeds the loop with `draft: { seed: extend.seed.steps }` and no `resume`. The loop's pre-decision replay (`evidence-loop.ts:490-497`) runs only for `draft.resume`. The extend seed also carries no `replay` data (`draft-from-flow.ts` header), so the dry-run machinery could not have run it anyway.
- Result: nothing moves the target between the playback and the re-author's first decision. The model's first look is the page the last step left. In run-munw7ffn that was s5's paged read, ending on results page 4.
- The brief said nothing about this. Its item 5 said "keep the steps that reach the page as they are", which implied the page was where those steps leave it.

## What changed and why

New files in `recovery/refuted-result/`, all exported from its `index.ts`:

- **`changed-step.ts`** (`automationStudioReauthorStepToChange`): works out which step the repair changes.
  - First choice: a node id of the Flow named in the judge's `changed` advice (`directive.judgement.advice`), matched as a whole token. A short suffix such as `s5` also counts when exactly one node ends that way. If several are named, the earliest in Flow order wins.
  - Otherwise: `current.step.nodeId`, the step whose records are the answer.
- **`start-plan.ts`** (`automationStudioReauthorStepStartPlan`): decides what to run, from the Flow alone.
  - It orders the graph with the existing `automationStudioFlowDraftSeedFromFlow`, so the draft ids (`f1..fN`), the order, and the run-node `toolId`/`value` are exactly what the build's draft holds. The replay is the Flow's own steps.
  - `builtin.control.*` nodes such as the Merge are skipped.
  - Any earlier step with a declared consequence withholds the whole replay. A declaration is read from `metadata.consequences` or `parameterValues.consequences`, and every class counts, not only the destructive ones. An unreadable declaration also withholds (fail closed), as does `automationStudioNodeMutates(node)` (the executor's mutating-effect test).
  - The possible outcomes are `replay`, `first_step`, `withheld` and `unknown_step`.
- **`start-reach.ts`** (`automationStudioReauthorReachStepStart`): runs the plan through a caller's `runStep` and calls nothing else.
  - If an optional step does not run, it is recorded as `optional_not_run` and the replay continues, as the Flow's own routing does.
  - Any other step that fails or throws stops the replay there. It is reported as `failed` with the step and a closed code (a thrown `.code`, or `core.result_repair.step_start_threw`), and the steps after it are not run.
  - The reported location is bounded before use (see `start-location.ts` below).
- **`start-position.ts`** (`automationStudioReauthorPositionAtStepStart`): one call that composes choosing the step, planning, and running.
- **`start-tool-runner.ts`** (`automationStudioReauthorPrefixStepRunner`): a `runStep` over the build's `executeTool`.
  - Core owns the call ids (`core.result_repair.start.<n>`).
  - A step counts as run when its effect applied, or when it answered with no refusal and no result code. That is how a read that changed nothing still counts as run.
  - It reads the execution result narrowly itself. The loop's parser is not exported from the `llm` barrel.
- **`start-brief.ts`** (`automationStudioReauthorStepStartLines`): the brief's section "Where the page in front of you is:". It names steps by their draft ids, the names the model sees.
  - For `reached`: "At the start of your draft's step f5 (web.dom.extract_list), the step to change. ... Core ran the Flow's own steps before it again, with no model call (f1 ran, f2 ran, f3 is optional and did not run), so this is the page f5 starts on (<location>), not the later page the run ended on."
  - For `withheld`, `failed`, `first_step` and `unknown_step` there is matching wording.
  - When no start is given, the lines say nothing moved the page since the run, so it is the page the run's last step left behind and may be later than where the step starts.
- **`start-record.ts`**: the run record, with ids and codes only. The location is page data and is never recorded.
- **`start-contracts.ts`**: the types.

Edited files:

- **`reauthor.ts`**: `automationStudioReauthorRefutedResult` gains an optional `position()` port.
  - It runs before `generate`, and its answer is passed as `generate(start)` and returned as `stepStart`.
  - If `position` throws, the start is recorded as `unknown_step` with a code, and the build still runs.
  - `automationStudioRefutedResultReauthored` accepts `stepStart` and records it as `attempts[].start` through `start-record.ts`. The port already passes `...built` into this function, so recording needs no port change.
- **`brief.ts`**: accepts `start?` and adds the section right after the opening paragraph, before the refutation and "What to do", so the 6,000-character tail cut does not remove it.
- **`flow-bootstrap/start-location.ts`**: adds `automationStudioFlowLocationShown`, a non-throwing reader with the same bounds (length and control characters). The throwing `automationStudioFlowStartLocation` behaves as before.
- **`flow-bootstrap/extend.ts`**: not changed.

A layout note: the first version was a `step-start/` subdirectory. The structure audit failed it on the 9-segment depth limit, so it was flattened to `start-*.ts`. At this depth the prefix-group rule does not demand a directory. `refuted-result/` now has 16 source files, which is one over the 15-file advisory threshold (a warning, not a failure).

Tests:

- `tests/start-position.test.ts` (6) uses run-munw7ffn's Flow: s1 and s2 navigate, s3 is the optional Continue click, s4 is the Merge, s5 is extract_list. The target starts at `...&page=4`.
  - **Reached:** the log is exactly `run:s1, run:s2, run:s3, model`, so the prefix is dispatched and no model call comes first. The page at the model call is results page 1. The brief says it is at the start of f5, and the result has `stepStart.status: "reached"`.
  - **Lasting effect:** a `send_or_publish` declaration, a `metadata.effect: "mutate"` marking, or an unreadable declaration on s2 means nothing runs. The page stays at page 4, and the brief says "NOT at the start of ... f5" and "Do not run f2 again to get back".
  - **Failed prefix:** s2 returning `web.navigation_failed` or throwing stops the replay at s2 and s3 does not run. The brief reports it, and the build still runs and applies.
  - **Judge-named step:** advice naming `s2` makes s2 the target, and only s1 is replayed.
  - **Record:** the run record carries `start.status` and not the location.
  - **`position` throws:** the build runs with `unknown_step`.
- `tests/start-tool-runner.test.ts` (3): the result reading and call ids.
- `tests/brief.test.ts` (+1): a brief with no start says where the page is, before "What to do".

Each new test fails without the change: the first two files import modules that do not exist at HEAD, and the brief assertion's text is absent from HEAD's `brief.ts`. I reasoned this and did not run the tests against HEAD.

## Proposed wiring (not my files; needed for the replay to run live)

1. **`service/runtime-adaptation/refuted-result-port.ts`**
   - Add a dependency `reachStepStart?(input: { projectId; flowId; current: AutomationStudioResultRepairHistoryEntry }): Promise<AutomationStudioReauthorStepStart>`.
   - In `build()`, pass `position: deps.reachStepStart ? () => deps.reachStepStart!({ projectId: decision.projectId, flowId: decision.flowId, current: refuted.current }) : undefined`.
   - Move `automationStudioReauthorBrief(...)` inside `generate: async (start) => { const brief = automationStudioReauthorBrief({ ..., start }); ... }`. Keep the last brief in a `let` for `briefRecord`.
   - Recording already happens through `...built`.
2. **`service.ts`** (the `repairRefutedResult` wiring at about line 2597): implement `reachStepStart`.
   - Read the graph Flow the extend edits. This is the same read `automationStudioFlowBootstrapExtendSubject` makes; that function could also return `graph`, in `service/flow-bootstrap-commands/extend-subject.ts`.
   - Call `automationStudioReauthorPositionAtStepStart({ current, graph, runStep: automationStudioReauthorPrefixStepRunner({ executeTool, maxEvidenceBytes, signal }) })`.
   - `executeTool` must be the build's gated executor: the binding's `evidenceLoopBinding(...).executeTool` wrapped by `automationStudioFlowBootstrapActionPermissions(...)` and the person-needed guard, as built at `service.ts:1538-1545`.
   - Alternative with less duplication: position inside `generateFlowBootstrapAdaptationInternal`'s extend path, right before `runAutomationStudioLlmEvidenceLoop` (about line 1553), using `personNeeded.executeTool`. This needs `generate` to receive `current` and a brief factory `(start) => instruction` in place of a finished brief. `reauthor.ts`'s `position` would then go unused, and `stepStart` would come back on the generate result.

## Commands run and observed results

All run in the Core `packages/fluxiq` directory unless noted.

- `bash .../heavy.sh "t194-w14 vitest" npx vitest run src/programs/automation-studio/runtime/recovery/refuted-result`: `Test Files 6 passed (6)`, `Tests 45 passed (45)`. This ran before the flatten.
- `bash .../heavy.sh "t194-w14 vitest" npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/service/runtime-adaptation`: `Test Files 84 passed (84)`, `Tests 1314 passed (1314)`. This is the final run, after the flatten.
- `bash .../heavy.sh "t194-w14 tsc" npx tsc --noEmit -p tsconfig.json`: exit 2 with one error, `src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress-trace.test.ts(65,32): error TS2554: Expected 0 arguments, but got 1.`
  - That file and `llm/evidence-loop/progress-trace.ts` are being modified by another worker, and neither is mine. My files had produced one error, in `start-position.test.ts` (an exactOptionalPropertyTypes mismatch). I fixed it, and it is absent from the final run.
- `node scripts/structure-audit.mjs` (Core root): `1 violation(s) across 1 rule(s)`, which is `[naming] runtime/llm/: 3 files share the prefix "provider-"`.
  - That comes from another worker's untracked `llm/provider-reply-account.ts`.
  - For my files there is one advisory warning: `refuted-result/: 16 source files is past the 15-file advisory threshold`. There are no failures.

## Not verified

- No live run and no browser, as the brief requires. The replay does not run in production until the wiring above lands. Only the new "Where the page in front of you is" brief line takes effect now.
- `start-tool-runner.ts` assumes a successful domain run-node call answers `effectApplied: true`, or no refusal and no code for a read. I read this off downstream `node-run/run.ts` but did not exercise it against the real domain.
- Whether Flow nodes actually carry `metadata.consequences` in stored Flows. The plan reads both places defensively, and I found no writer that puts plan `consequences` on stored nodes.
- The claim that each new test fails at HEAD was reasoned, not run (I did not stash, because other workers are editing the tree).

## Open questions or contradictions found

- The brief names `reauthor.ts :148` as the loop start. The build's executor, and so any real prefix dispatch, only exists inside `service.ts`'s build. `reauthor.ts` can only order a port, which is why this outcome is Partial.
- Should `create_new` and `modify_existing` withhold the replay? The brief lists "money, delete, send/publish" or a mutating effect class. I withhold on every declared class, because repeating "create" makes two records. Narrow this to `isAutomationStudioDestructiveActionConsequence` if that is not wanted.
- Downstream `node-run/run.ts` already has domain-side `replay: "step"` handling tied to `startLocation`. An extend could instead be given the first navigate's destination as `startLocation`. That would put the model on the Flow's first page, but not at s5's start after s2 and s3, so I did not pursue it.

# t137 — Where the six draft steps went

## Outcome

Done — diagnosis, no code changed.

**The six steps were not lost by Core. The model withdrew them.** The build's
two `amend_draft` decisions each carried a `rerun` *and* a set of
`drop`/`exploratory` amendments for the earlier steps, and the run's record
cannot show it, because an amend row publishes one code for a whole amendment
list and `rerun` wins that contest
(`runtime/llm/evidence-loop.ts:715`). The brief's reading — "neither is a drop
and neither is an exploratory" — is not something the artifact can support: the
trace has no field that would have said so.

So the cause is legitimate in the narrow sense that Core did exactly what the
model asked. **The real defects are three**, and none of them is the draft:

1. Nothing refused a Flow that cannot reach its own page. That is t135's
   `flow_bootstrap.evidence_completion_cannot_reach_start`, already written and
   unstaged in `F:\!FluxIQ` — its own header cites this run. Not mine to redo.
2. Nothing told the model that withdrawing a step is what makes a Flow
   unrunnable, and the words it was given actively invite the mistake
   (see **Why the model did it**).
3. A draft step's disposition is published nowhere, so this had to be proved by
   elimination over three files instead of read off one row. Proposal below.

## The proof that exactly one step was proposed

Not an inference from `authoredNodes`. From the replay.

`snapshots/flow-lane.json` → `build.declaredConsequences` holds **15** actions
and `build.consequenceCrossCheck.actions` agrees. The last three are:

```json
{ "actionKind": "flow_step",        "actionId": "web.output.dom-extract_list", "ref": "main.s1",        "verb": "run",        "permitted": true }
{ "actionKind": "exploration_step", "actionId": "core.run_node",               "ref": "dryrun.1.reset", "verb": "go to",      "permitted": true }
{ "actionKind": "exploration_step", "actionId": "core.run_node",               "ref": "dryrun.1.15",    "verb": "extract list", "permitted": true }
```

`dryrun.<attempt>.<position>` is minted once per proposed step, in
`runtime/llm/node-tools/replay-draft.ts:85`, inside
`for (const step of proposed)` where `proposed = input.steps.filter(automationStudioFlowDraftStepIsProposed)`
(line 69). Three things close the gap between "one `dryrun.` ref" and "one
proposed step":

- **No proposed step can be skipped.** Line 88 skips the call when
  `automationStudioNodeReplayStepCall(step)` is `undefined`, which happens only
  when `step.ranWith` is absent — but the gate that ran the replay at all
  (`flow-draft/dry-run.ts:116`) requires `ranWith !== undefined && replay !== undefined`
  for *every* proposed step. A draft with one such step is never replayed, and
  this one was.
- **No declaration is missing.** The gate keeps 500
  (`runtime/action-permissions/declared.ts:23`,
  `AUTOMATION_STUDIO_ACTION_DECLARATIONS_MAX = 500`), and the facility's reader
  uses the same bound (`existing-fluxiq-control/adaptation-consequences.ts:21`).
  Fifteen is nowhere near it.
- **The verdict was clean.** `build.outcome` is `"proposed"` and the iteration-16
  `core.decision_complete` row carries no `resultCode`, so the dry run returned
  `ok`. A proposed step that had been skipped would have been `failed` and
  blocking.

So at completion the draft proposed **one** step, at position 15.

## The draft it proposed one step out of

Reconstructed from the trace and the call ids the model wrote. `draftRecord`
appends one step per tool call, numbered from 1
(`runtime/llm/evidence-loop.ts:360`), and a `rerun` amendment's call id is
`rerun.<position>` (line 851), which is how the numbering is pinned:

| pos | iteration | call id | tool / node | trace `resultCode` | `effectApplied` |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | `initial.core.run_node` | `web.output.dom-capture_snapshot` | `web.action.rejected.not_at_start_location` | — |
| 2 | 1 | `nav.start` | navigate | `web.action.succeeded` | **true** |
| 3 | 2 | `nav.search` | navigate | `web.action.succeeded` | **true** |
| 4 | 3 | `click.continue` ("Continue shopping") | click | `web.action.succeeded` | **true** |
| 5 | 4 | — | `web.detect_repeating_structure` | `web.structure.detected` | — |
| 6 | 5 | `extract.results` | extract list | `web.inspect.succeeded` | — |
| 7 | 6 | `click.notnow` ("Not now") | click | `web.action.succeeded` | **true** |
| 8 | 7 | `type.search` ("Search Brightaisle") | type text | `web.action.succeeded` | **true** |
| 9 | 8 | `click.searchgo` ("Go") | click | `web.action.succeeded` | **true** |
| 10 | 9 | — | `web.detect_repeating_structure` | `web.structure.detected` | — |
| 11 | 10 | `extract.searchresults` | extract list | `web.inspect.succeeded` | — |
| 12 | 11 | `extract.page1` | extract list | `web.inspect.succeeded` | — |
| 13 | 12 | `extract.allpages` | extract list | `web.inspect.succeeded` | — |
| 14 | 14 | `rerun.13` | extract list | `web.inspect.succeeded` | — |
| 15 | 15 | `rerun.14` | extract list | `web.inspect.succeeded` | — |

Verbs and control names are `build.declaredConsequences[].verb` / `.controlName`;
the pairing is by `ref`, which is the call id. `rerun.13` and `rerun.14` name
positions 13 and 14 exactly, which is what fixes the table.

Twelve of these are *action* steps — what `automationStudioFlowDraftEntry`
lists and what the model is shown with `inResult` beside each one: positions
2,3,4,6,7,8,9,11,12,13,14,15. Positions 1, 5 and 10 are not: the free look
declares `proposes: false` (`domain/.../node-run/run.ts:159`) and
`web.detect_repeating_structure` declares `effect: "observe"` with no per-call
`draft`, so `step.proposes ?? step.effect === "mutate"` is false for both
(`flow-draft/step.ts:201`).

Core itself withdrew 13 and 14: a `rerun` is carried out as a drop of the step
it replaces plus a fresh call (`evidence-loop.ts:714`). That leaves **nine**
action steps — 2,3,4,6,7,8,9,11,12 — that were proposable and were not
proposed.

## Why those nine cannot have failed the proposable rule

```ts
// flow-draft/step.ts:173, :186, :201
step.disposition === "kept" && automationStudioFlowDraftStepIsProposable(step)
automationStudioFlowDraftStepIsAction(step) && step.effectApplied !== false
step.proposes ?? step.effect === "mutate"
```

For the six mutating steps this is forced:

- `effectApplied: true` appears on their trace rows, and that field is written
  **only** when the step's own effect is `mutate`
  (`evidence-loop.ts:801`: `...(record.effect === "mutate" ? { effectApplied } : {})`).
  So `effect === "mutate"` and `effectApplied === true`. `step.effectApplied !== false` holds
  and `step.proposes ?? true` holds whatever `proposes` says — unless it says
  `false`.
- It cannot say `false`. The domain sets `proposes: node.proposes` on the
  success path (`domain/.../node-run/run.ts:323`) and
  `proposes: actionType !== WEB_LLM_OBSERVATION_NODE_ACTION`
  (`node-run/catalog.ts:94`) — `true` for every node but the snapshot, and a
  snapshot is not a mutating node.
- Nor can it be `false` by the draft statement being dropped in parsing:
  `evidence-loop.ts:395` only copies `proposes` when the domain said it, so a
  dropped statement leaves it `undefined`, which is still proposable via
  `effect === "mutate"`. (A dropped statement would also have removed
  `ranWith`/`replay` and so prevented any dry run at all — and one ran.)

The three extract steps (6, 11, 12) are the same argument with
`proposes: true` doing the work instead of the effect.

So `automationStudioFlowDraftStepIsProposable` was **true** for all nine. The
only remaining term is `disposition`, and `disposition` is written in exactly
one place in Core:

```
$ grep -rn "step.disposition =" packages/fluxiq/src --include=*.ts
flow-draft/amendment.ts:169:    step.disposition = disposition;
```

reached only from `applyAutomationStudioFlowDraftAmendments`, only for
`drop`/`exploratory`/`keep`, and called from exactly two places in the loop
(`evidence-loop.ts:713` for the model's amendments, `:714` for the rerun's own
drop). There is no other door. **The model sent nine `drop` or `exploratory`
amendments.**

## Why the run's record could not say so

```ts
// runtime/llm/evidence-loop.ts:715
recordRow({ iteration, decision: "amend_draft",
  resultCode: rerun ? "llm_evidence_loop.draft_rerun"
    : amended.applied ? "llm_evidence_loop.draft_amended"
    : "llm_evidence_loop.draft_unchanged", ... });
```

One code for the whole list, and `rerun` takes precedence over everything
applied beside it. A decision may carry sixteen amendments
(`evidence-loop-decision.ts:44`, `MAX_AMENDMENTS_PER_DECISION = 16`), so
`llm_evidence_loop.draft_rerun` is consistent with one amendment or with
sixteen. Nothing downstream recovers it:
`AutomationStudioFlowBootstrapEvidenceStep` (`flow-bootstrap/evidence-loop-steps.ts`)
has ten fields and none of them is about the draft.

Corroboration from the only number that does travel — `usage.outputTokens`:

| iteration | decision | outputTokens |
| --- | --- | --- |
| 12 | `tool_call` (`extract.allpages`, a full extract-list call) | 404 |
| 14 | `amend_draft` (`rerun.13`, the same call again as `input`) | **538** |
| 15 | `amend_draft` (`rerun.14`) | 220 |
| 16 | `complete` | 85 |

Iteration 14's reply is ~134 output tokens larger than the comparable call at
iteration 12 whose argument it is repeating. Nine `{"step":N,"change":"exploratory"}`
entries cost about that. Iteration 15, at 220, has no such surplus — so the
withdrawals sit in the iteration-14 decision.

## Why the model did it

Not an excuse for the model; a defect in what it was handed. Three texts it had
in front of it at iteration 14 all point the same way:

- `core.run_node`'s description
  (`runtime/llm/node-tools/run-node.ts`): *"Run a node that only reads — a
  snapshot, a wait, an assertion — to see where you are; run one that acts to
  make the page do what the instruction needs."*
- The draft entry's instruction (`flow-draft/entry.ts`, `DRAFT_INSTRUCTION`):
  *"drop a step that should not be there, **exploratory for one you ran only to
  look**"*.
- The amendment schema: *"exploratory: I did this only to look around."*

The nine steps it withdrew are, in its own words for them, exactly that: it
navigated, dismissed "Continue shopping" and "Not now", typed a search and
pressed "Go" — to *get to* the list. Nothing in any of those three texts says
that the step which reached the page is the one the Flow cannot run without, and
the draft entry never shows the consequence, because `inResult: false` reads as
"tidy" rather than "this Flow can no longer start". The exploration ran under a
rule the finished Flow is not held to: the domain refuses every call made before
the Flow has reached its start location
(`domain/.../node-run/start-location.ts`), so the model *had* to run
`nav.start` first and then was free to call it scenery.

t135's reach-start check closes the outcome. The wording is a separate, cheap
fix worth making with it: one clause in `DRAFT_INSTRUCTION` saying that a step
which got you to where the Flow starts, or past something in the way, is a step
of the Flow and not a look — paid for on every build, but it is the sentence
this run needed.

## Second: what the record should carry

### The one field that would have pointed at it

Add the count to the amend row, which already travels and already passes the
downstream shape test (a number):

```ts
// runtime/llm/evidence-loop.ts:715
recordRow({ iteration, decision: "amend_draft", resultCode: ...,
  ...(amended.applied ? { amended: amended.applied } : {}), ... });
```

plus `amended` in `AutomationStudioFlowBootstrapEvidenceStep` and in
`EVIDENCE_STEP_FIELDS` (they are in one file for that reason,
`flow-bootstrap/evidence-loop-steps.ts`), bounded like `iteration` is.
Iteration 14 would then read `amended: 9` beside `llm_evidence_loop.draft_rerun`
and this whole report would have been one row.

### The rows that actually answer the brief's question

Per draft step, its disposition and whether it was proposed. This cannot ride on
a decision row: `publishableStepValue` admits a list of *scalars* only — a list
of records is dropped whole (`packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts`,
`MAX_STEP_LIST_ENTRIES` path). It goes beside `declaredConsequences`, which is
already a list of records with its own reader.

**Core** — new `runtime/flow-bootstrap/draft-steps.ts`, type and field
allow-list in one file, the rule `evidence-loop-steps.ts` states in its own
header:

```ts
export type AutomationStudioFlowBootstrapDraftStepRecord = {
  /** Its position in the draft as the model read it, counting from 1. */
  step: number;
  /** The node it ran, as the domain resolved it. Absent when the step went through a domain tool. */
  actionId?: string;
  disposition: "kept" | "dropped" | "exploratory";
  /** Whether the Flow was built from it. */
  proposed: boolean;
};

export function automationStudioFlowBootstrapDraftStepRecords(
  steps: readonly AutomationStudioFlowDraftStep[]
): AutomationStudioFlowBootstrapDraftStepRecord[];
```

Built by filtering with `automationStudioFlowDraftStepIsAction` — the same
filter `automationStudioFlowDraftEntry` lists by, so the published rows are the
receipt the model was shown — and reading `automationStudioFlowDraftStepIsProposed`
for `proposed`. `actionId` held to the existing `EVIDENCE_STEP_ID` shape and
left out when it does not fit, exactly as `nodeId` already is.

Every value is closed: `step` is Core's own integer, `disposition` is Core's
three-word enum, `proposed` is a boolean, and `actionId` is the node id the
domain resolved against its catalog — never the model's spelling, which is the
same guarantee `nodeId` already rests on. All four match `PUBLISHABLE_TEXT`
or are scalars.

**Wiring.** `loop.steps` already reaches `runtime/service.ts` (it is read there
for `automationStudioFlowDraftPlanNodeIds` on the extend path), so this is one
more field carried onto the adaptation beside `evidenceTrace`, and one reader
downstream modelled on `adaptation-consequences.ts` with its own bound (a draft
holds at most `maxIterations + 1` = 65 steps; 128 is a safe cap).

**Why `actionId` is not optional in practice.** This run's published rows carry
`nodeId` on exactly one of sixteen — iteration 0, the refusal — because the
domain deliberately says `nodeId: undefined` on the success path, on the
grounds that *"the draft statement above already carries `actionId`"*
(`domain/.../node-run/run.ts:331`). That statement is published nowhere, so the
run's record never names which node any successful call ran, and the table
above had to be assembled from `declaredConsequences[].verb`. These rows close
that too.

## Commands run and observed results

None. No code was changed, so nothing was built or tested — the brief forbids
building either repository, and Core's `dist` is what the run executed.

Correspondence between what ran and what I read was checked instead:

- `test-runs/run-muht9lpw-a39aa056/run.json` records Core at
  `bd2a9dba8f457dc485edf7ccb24a9f44f900bfd8`, `dirty: false`, and the facility
  at `84215fb…`, `dirty: false`.
- `git log --oneline -5` in `F:\!FluxIQ` → `bd2a9db` is HEAD.
- `git diff --stat` in `F:\!FluxIQ` → the uncommitted changes touch
  `flow-bootstrap/{generation-failure,index}.ts`,
  `flow-bootstrap/plan/issue-feedback.ts`,
  `llm/harness-options/bootstrap-completion.ts` (+ its test), `service.ts`,
  `flow-bootstrap/reachability/` (untracked) and two docs — t135's work. Every
  file this diagnosis rests on (`flow-draft/*`, `llm/evidence-loop.ts`,
  `llm/evidence-loop-decision.ts`, `llm/node-tools/*`,
  `action-permissions/declared.ts`) is unmodified since `bd2a9db`.
- `git diff --stat 84215fb -- domain/src packages/test-runner/src` in the
  facility → empty.
- The three load-bearing lines were checked against the built `dist` the run
  actually executed:
  `dist/.../flow-draft/step.js:37,49` reproduce the proposed/proposable rule;
  `dist/.../flow-draft/amendment.js:117,128` reproduce the single
  `step.disposition =` write; `dist/.../llm/evidence-loop.js:485` reproduces the
  amend row's one-code `recordRow`; `dist/.../llm/node-tools/replay-draft.js:29,40`
  reproduce the `dryrun.<attempt>.<position>` call ids.

## Not verified

- **The model's actual amendment list is not in any artifact.** Nothing records
  a decision's body. The nine withdrawals are established by elimination over
  every other path — and the elimination is exhaustive, because `disposition`
  has one writer and the proposable rule is forced by fields the trace does
  publish — but I could not read the reply that made them. The output-token
  arithmetic is corroboration, not proof, and it cannot say whether they were
  `drop` or `exploratory`.
- **Which nine.** The set 2,3,4,6,7,8,9,11,12 follows from "twelve action steps,
  two dropped by the reruns, one proposed". Which *individual* step got which
  word is not recoverable.
- Nothing was run against a browser or a provider. No test was executed.
- I did not read t135's implementation beyond its report's opening, so my
  statement that the reach-start check now covers the outcome rests on that
  report and on `reachability/check.ts`'s own header, not on reviewing it.

## Open questions or contradictions found

1. **The brief's premise does not hold, and the artifact is why.** "Both
   recorded `llm_evidence_loop.draft_rerun` — neither is a drop and neither is
   an exploratory" reads the row as if it described the whole decision. It
   describes whether a rerun was present. Any supervisor reading this record
   would have drawn the same conclusion; that is the defect, not the reading.
2. **`runtime/flow-bootstrap/draft-reduction.ts` is dead.**
   `reduceAutomationStudioFlowBootstrapDraft` has no caller outside its own
   test. It is the module that would drop proposed steps on a digest chain, and
   it was my first suspect. Worth either wiring or deleting, because a reader
   diagnosing a short Flow will suspect it first every time.
3. **The draft entry shows `inResult` but never what it costs.** A model that
   withdraws the step which reached the page sees `inResult: false` and no
   further signal, right up to a completion that Core (before t135) accepted.
   The cheapest complement to t135's refusal is a clause in `DRAFT_INSTRUCTION`,
   noted above.

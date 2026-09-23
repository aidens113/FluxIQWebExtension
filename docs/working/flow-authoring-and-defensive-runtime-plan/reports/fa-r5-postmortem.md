# Post-mortem: both runs of campaign `ten-sites-r5`

Read-only investigation. No source, fixture or test was changed.

Evidence: `test-runs/instances/r5/run-mudwci8d-de88aa32/`,
`test-runs/instances/r5/run-mudw1ktb-0557816b/`,
`test-runs/campaigns/ten-sites-r5/{summary.json,summary.md,logs/}`,
plus the fixture and runtime sources named against each cause.

Campaign commits: facility `4cc5714`, Core `8b145c7`. Seed 241 for both runs.

---

## Headline

**The framing in the campaign row is wrong in a way that matters.** Run
`run-mudwci8d` is filed under `web.target.not_found`; that miss was fully
recovered and cost the run nothing. Run `run-mudw1ktb` is filed under
`ambiguous_or_unknown`; nothing was ambiguous — that string is a placeholder
the facility writes when a run is judged wrong and no action failed.

The real story of both runs is the same and is not in either label: **the
model never applied the instruction's filters, and the Flow it built cannot
be repaired because the repair ladder is driven by failed actions rather than
by wrong answers.** Both Flows executed cleanly to a wrong result.

One correction to the brief's known-cause list, stated up front because it
changes what "fixing the lazy tail" buys: in `run-mudwci8d` the 12-vs-16 gap
is *not* only the lazy tail. The list being read is the **unfiltered** search.
Loading the tail would yield 16 rows that are still not the 16 expected rows.

---

## Run `run-mudwci8d-de88aa32` — "first page, Plus only", action by action

Task: *"Search the store for wireless earbuds, narrow the results to
Brightaisle Plus items, and collect every product on the first page of
results, leaving out sponsored placements, into a table with columns name,
price, rating and url."*

### Build phase — 14 provider calls, 13 loop decisions

From `snapshots/flow-lane.json` `build.evidenceLoop.steps` and
`build.declaredConsequences`:

| # | Tool | Result | What it did |
|---|---|---|---|
| 1 | `core.run_node` | `web.inspect.succeeded` | read the home page |
| 2 | `core.run_node` | `web.action.succeeded` | click **"Not now"** (`dismiss.1`) |
| 3 | `core.run_node` | `web.action.succeeded` | click **"Accept"** (`cookies.accept`) |
| 4 | `core.run_node` | `web.action.succeeded` | type into **"Search Brightaisle"** (`search.1`) |
| 5 | `core.run_node` | `web.action.succeeded` | click **"Go"** (`search.submit.1`) |
| 6 | `web.detect_repeating_structure` | `web.action.rejected.page_unreadable` | results page still hydrating |
| 7 | `web.detect_repeating_structure` | `llm_evidence_loop.already_answered` | **wasted paid call** |
| 8 | `web.detect_repeating_structure` | `llm_evidence_loop.already_answered` | **wasted paid call** |
| 9 | `core.run_node` | `web.action.rejected.target_unobserved` | acted on an unobserved handle |
| 10 | `core.decision_unusable` | `llm_evidence_loop.dry_run_refused` | dry run 1 refused |
| 11 | `web.detect_repeating_structure` | `web.structure.detected` | structure finally read |
| 12 | `core.run_node` | `web.inspect.succeeded` | |
| 13 | `core.decision_amend_draft` | `llm_evidence_loop.draft_amended` | |
| 14 | `core.decision_complete` | — | |

**Five of thirteen decisions (38%) produced nothing usable.**

The four exploration actions are the whole of what the model tried on the
page. It never clicked the **Brightaisle Plus** filter link and never
scrolled. Nothing was dropped from exploration into the Flow — every executed
probe became a node. The steps the instruction needed were never attempted.

### Built Flow — 7 nodes, 0 navigate

`flowShape`: `{"web.dom.click": 3, "web.dom.type": 1, "web.dom.extract_list": 1}`,
`extractNodes: 1`, **`navigationNodes: 0`**, plus two `builtin.control.merge`.

`s1` click "Not now" → `s2` merge → `s3` click "Accept" → `s4` merge →
`s5` type "wireless earbuds" → `s6` click "Go" → `s7` extract_list.

### Playback — 9 attempts for 7 nodes

| # | Node | Action | Status | Detail |
|---|---|---|---|---|
| 0 | s1 | click | **failed** | `web.target.not_found`, 1076 ms |
| 1 | s1 | click | succeeded | retry attempt 2, rung `retry_node`, backoff 250 ms |
| 2 | s2 | merge | succeeded | |
| 3 | s3 | click | succeeded | selector, 1 candidate, score 0.643 |
| 4 | s4 | merge | succeeded | |
| 5 | s5 | type | succeeded | score 0.629 |
| 6 | s6 | click "Go" | succeeded | score 1.0; **afterAction packet 819 bytes** |
| 7 | s7 | extract_list | **failed** | `web.action.failed`, 6985 ms, "message channel closed" |
| 8 | s7 | extract_list | succeeded | retry attempt 2, 1351 ms |

Result: 12 records, 0 matching. Then ~5 minutes of nothing (below).

---

## Run `run-mudw1ktb-0557816b` — "Plus, 4.0+, under $50, all pages"

Task instruction (415 chars) demands six things: Plus eligible; rated ≥ 4.0;
under $50; every page; no sponsored; no accessories; dedupe; keep order.

### Build phase — 20 provider calls, 19 loop decisions

Exploration: `nav.search.1` (navigate), `click.continue.1` ("Continue
shopping"), then **six** extract-list probes (`extract.list.1`,
`extract.list.2`, `rerun.6`, `rerun.7`, `rerun.5`, `rerun.9`).

Loop decisions included `llm.provider_output_invalid` (step 7),
`llm_evidence_loop.draft_rerun` ×4 (steps 8, 10, 12, 14),
`llm_evidence_loop.dry_run_refused` (step 17) and
`llm_output.invalid_evidence_decision` (step 18).

**Seven of nineteen decisions (37%) produced no forward progress**, two of
them because the model's output could not be parsed at all.

The model never clicked a filter, never clicked a next-page control, and
never emitted a URL carrying filter parameters — though the store accepts
them (`tests/scenario.test.ts:107` exercises `k=wireless+earbuds&rh=plus`).

### Built Flow — 5 nodes

`s1` `web.browser.navigate` → `s2` click "Continue shopping" → `s3` merge →
`s4` `extract_list` → `s5` `extract_list`.

Two extract nodes, **no action of any kind between them**.

### Playback — 5 attempts, every one succeeded

| # | Node | Action | Status | Detail |
|---|---|---|---|---|
| 0 | s1 | navigate | succeeded | 2309 ms; afterAction packet **812 bytes** |
| 1 | s2 | click | succeeded | 34 ms |
| 2 | s3 | merge | succeeded | |
| 3 | s4 | extract_list | succeeded | 1370 ms |
| 4 | s5 | extract_list | succeeded | 1399 ms, same page |

`flow-lane.json` `failure: null`. Result: 24 records, **0 matched in
position, 1 matched anywhere** (`matchedInAnyOrder: 1`).

---

## Answers to the five questions

### 1. `web.target.not_found` — which node, which target, and did it matter

**Node** `node.bootstrap.0f195db2f2b666fc.main.s1`, attempt 0, the click on
the **"Not now"** notifications-dialog button.

**Target** (`flow-lane.json` `actions[0].failure.expected`):

> `an element matching selector #\:r13b8o\: > div > div:nth-of-type(2) > button:nth-of-type(1), element fingerprint`

**Observed** (`actions[0].failure.actual`):

> `nothing matched; 6 control(s) of the same family are on the page; best scored -0.12`

**Why it was not found: the dialog did not exist yet.** The store opens the
notifications modal on a timer —
`apps/scenario-lab/src/scenarios/everything-store/client/timings.ts`:
`notifications: 4000`, and `client/shell-script.ts:93` defers another 1500 ms
if a modal is already busy. The node fired at `09:26:00.566`; the retry at
`09:26:02.937` found the selector matching exactly one element
(`hostTargetResolution: {strategy: "selector", candidateCount: 1, bestScore: 0.643}`).
The element appeared between the two attempts.

The fingerprint score of `-0.12` across 6 candidates is therefore **correct
behaviour**, not a scoring defect: the button genuinely was not on the page.

**Did it change the outcome? No.** It was absorbed by the ladder —
`actions[1].retry = {attemptNumber: 2, maxAttempts: 3, backoffMs: 250, rung: "retry_node"}`.
The run's 12 records were produced after full recovery.

**But it became the run's headline failure anyway.**
`packages/test-runner/src/flow-lane/persisted-flow-run.ts:450`:

```ts
const failure = actions.map((action) => action.failure).find((record): record is AutomationStudioFailureRecord => record !== null) ?? null;
```

The run's failure is the **first attempt that carried a failure record**,
regardless of a later attempt of the same node recovering. So a transient,
recovered miss became `run.json.automationFailure`, the campaign's only
`issueCodes` entry, and `summary.json.firstFailure` ("The Flow reported an
unexpected target_not_found failure") — while the actual defect, a wrong
dataset, is buried in `extraction.steps[0]`.

Two further notes on durability: the selector is anchored on `#:r13b8o:`,
and `style/element-ids.ts` generates these ids **from the run seed**
("nothing about the id says what the control is or survives a different
seed"). Build and playback share seed 241 and the reset
(`reset-scenario-lab.ts`) resets fixture state, not the seed — so this run
never tested whether that selector survives. And the Flow dismisses the
dialog with an **unconditional** node: `route.fallbackUsed: true`,
`selectedRuleId: null`, `evaluations: []`, `stateObserved: false` in both
runs. There are no router rules at all, so there is no branch that skips the
dismissal on a session where the dialog does not appear.

### 2. Can the 7-node Flow reach the results page from a reset start page?

**No. It cannot navigate anywhere. The harness supplies the location.**

`packages/test-runner/src/flow-lane/creation/lane.ts:139-141`:

```ts
// Exploration may have acted on the page; the Flow is judged on state it produced itself.
await resetScenarioLab(input.scenarioOrigin, input.runToken, input.fetchLab);
await input.prepareFlowPage("playback");
```

and `prepareFlowPage` is contracted (lane.ts:66-72) as: *"Presents the task's
rendering: arms its variant, if any, **loads the scenario's start page** and
checks the armed facts. Called before the build … **and again after the
fixture's state is reset, before the run**."*

The same thing happens during the build: `build.declaredConsequences` shows
`dryrun.1.reset` and `dryrun.2.reset`, each `verb: "go to"`,
`controlKind: "page"`, `actionKind: "exploration_step"` — harness steps, not
Flow steps. Core derives that reset location from the draft itself:
`flow-draft/dry-run.ts:120` — *"Where a replay of this draft starts: what the
first proposed step found."*

So the answer to the brief's either/or is **neither, and worse**: the Flow
does not depend on state exploration left behind (the lane resets and
reloads), but it depends on **the harness navigating for it**. A
`navigate-and-extract` Flow with `navigationNodes: 0` has no URL anywhere in
it. Run from a blank tab, it clicks "Not now" on whatever is there.

The measurement therefore over-states what the Flow can do, and the
over-statement is structural: `prepareFlowPage("playback")` supplies exactly
the one node the Flow is missing. The contrast within the campaign proves the
model *can* do it — `run-mudw1ktb`'s Flow opens with
`web.browser.navigate`. The build that started on an already-loaded home page
simply recorded the clicks it made from there and never noticed it had no way
back.

### 3. `ambiguous_or_unknown` — what was ambiguous?

**Nothing. No step was ambiguous. The word is a placeholder.**

Every one of the five actions succeeded and `flow-lane.json` `failure` is
`null`. `packages/test-runner/src/flow-lane/lane-observation.ts:195-200`:

```ts
function reportedFailure(run: PersistedFlowRunOutcome): RunEvaluation["automationFailureReported"] {
  if (reportedVerdict(run) !== "failed") return null;
  const record: AutomationStudioFailureRecord | null = run.failure;
  if (!record) return { category: "ambiguous_or_unknown" };
  ...
}
```

The run was judged failed because Core's result verification refuted it
(`snapshots/live-llm.json`: `status: "refuted"`, `basis: "model"`,
`code: "core.result.does_not_answer_request"`,
`verdicts: ["does_not_answer", "does_not_answer"]`). No action carried a
failure record, so the facility wrote the placeholder. Note it carries **no
`code`** — that is how to tell it from a Core classification.

**What the loop did about it: it stopped.** Core's recovery planner reaches
the same word by a different road —
`F:\!FluxIQ\...\runtime\recovery\plan.ts:100`
(`if (!input.deterministic) return unclassifiedPlan(chain)`) and 209-229:

```ts
failureClass: "ambiguous_or_unknown",
candidateKind: "diagnosis_only",
refusals: ["No failed attempt reached the diagnosis, so nothing was classified."]
steps: [{ action: "stop", reason: "No failed attempt reached the diagnosis, so there is nothing to plan." }],
```

`harnessRecovery.runtimePatchAttempts: []`, `adaptationIds: []`,
`changeProposalIds: []`, `refusalCode: null`.

**This is the structural finding of the whole post-mortem.** The repair
ladder is keyed on a *failed action*. A Flow whose every action succeeds and
whose answer is wrong is classified "nothing to plan" and stopped — and that
is the dominant failure mode on these sites. A third producer of the same
string exists (`adaptive-orchestrator.ts:152`, the classifier's fall-through),
so the artifact cannot even tell a reader which of the three wrote it.

### 4. ~26 executed actions, 5- and 7-node Flows — where did the rest go?

The "25/26 actions" in the campaign row is the **consequence ledger**, not 25
browser actions. Breakdown from `build.declaredConsequences`:

**`run-mudwci8d`, 25 entries:**

| Group | Count | What they are |
|---|---|---|
| Live exploration probes | 4 | `dismiss.1`, `cookies.accept`, `search.1`, `search.submit.1` |
| Exploration extract | 1 | `extract.1` |
| Dry run 1 | 6 | `dryrun.1.reset` + `.2 .3 .4 .5` |
| Dry run 2 | 6 | `dryrun.2.reset` + `.2 .3 .4 .5 .11` |
| Draft-step declarations | 8 | `flow_step` `main.s1..s4`, then `main.s1,s3,s5,s6,s7` |

**Which executed actions did not become nodes: none.** All five live probes
became nodes (s1, s3, s5, s6, s7). The dry-run entries are replays of those
same steps; the `flow_step` entries are the draft declaring itself for the
consequence cross-check. Nothing was wrongly dropped.

**What the Flow needs and does not have was never executed:** the
**"Brightaisle Plus"** filter click and a **scroll** to load the tail. The
reference recording has both (`workflows/first-page.ts`: `first-plus-only`
clicking `role:link:Brightaisle Plus`, then `first-scroll-down` scrolling
6000 and `first-rest-loaded` waiting). The model tried neither, then called
`core.decision_complete`. Nothing checked the draft against the instruction's
clauses before it was accepted.

**`run-mudw1ktb`, 26 entries:** 8 exploration + 5 dry-run-1 + 5 dry-run-2 +
8 `flow_step` declarations. Here **four extract probes did not become
nodes** (`rerun.5/.6/.7/.9`) — correctly excluded: their loop result codes
are `web.inspect.succeeded`, i.e. look-only inspections while the model tuned
the field mapping. But two extract nodes were **wrongly kept**: `s4` and `s5`
read the same page with nothing between them.

### 5. Why one attempt of an allowed three, and why no repair?

**The "3 attempts" is a hardware-fault budget, not a repair budget.**
`scripts/lab/live-campaign/runner.mjs:47-48`:

```js
attempts.push({ attempt, exitCode: final.code, ramFault, ... });
if (ramFault === null) break;
```

and `lab-run/ram-fault.mjs:26`: *"An attempt that printed a run result is real
unless the runner itself classified it `process.startup`."* Both runs
produced real results, so both stopped at attempt 1. **That is correct
behaviour** and says nothing about repair. It is the campaign refusing to
re-run a real result, not the product declining to retry.

**The actual repair budget did nothing.** All 38 provider calls are
accounted for:

| Run | Build/exploration | Verification | Repair |
|---|---|---|---|
| `run-mudwci8d` | 14 | 2 | **0** |
| `run-mudw1ktb` | 20 | 2 | **0** |

The event `"The created Flow's repair attempt finished"` (events.ndjson
sequence 3) reports `repair: {calls: 2, interventions: 2,
totalEstimatedCostUsd: 0.0030844}` — and `live-llm.json`'s `verification`
block reports the *same* two calls at the *same* cost, with request ids
`llm.loop_verification.3af084e7-…` and `llm.loop_verification.a7b1e487-…`.
Those two calls asked "does this answer the request?" and both said no. **No
repair call was made in either run.** Run 2's pair is
`llm.loop_verification.27ba19a7-…` / `…3056c39f-…`, cost `0.00284988`,
identical to its repair event.

**And both runs then burned five minutes waiting for a repair record that
never came.** `terminal-run-wait.ts:48`: `RECOVERY_RECORD_WAIT_MS = 300_000`.
Run 1's last action ended `09:26:17.7`; the "repair finished" event is
`09:31:28.4` — 5 min 11 s. Run 2: `09:18:49.3` → `09:24:00.4`, 5 min 11 s.
Both snapshots carry `unsettled: "recovery"`. Of `durationMs` 417 s and
479 s, roughly **311 s each (65–75%) was this dead wait**.

**Where the artifacts do not settle it.** `terminal-run-wait.ts:74-78` says
*"The recovery ladder's diagnosis placeholder is in the first save too, so an
intervention alone says nothing about whether the recovery finished."* So the
two `kind: "diagnosis"` interventions may be placeholders rather than
evidence a diagnosis ran, and `live-llm.json` records
`perCallRecords: "not recorded"`, `observedCalls: []`,
`exploration.source: "absent"`, `toolDetail: "not-published"`. **I can prove
no repair landed and no repair was charged; I cannot prove from these files
whether Core started one and never finished writing it.** That distinction
needs a run with the recovery trace published.

---

## Numbered causes, ranked by how much each stands between us and a right answer

### 1. The instruction's filters are never applied, and nothing checks that they were

**Evidence.** `run-mudw1ktb` `snapshots/extraction-mismatches.json`: the
observed rows are the **completely unnarrowed** first-page results. The
planted listings land on their exact catalogue ranks — observed position 4 is
`Soundcrest Air Pro 2, $50.00, 4.6` (`earbuds.ts` PLANTED rank 4:
`{priceCents: 5000, plus: true, rating: 4.6}`), position 6 is
`Kinetra Run, $29.99, 3.8` (PLANTED rank 6: `{priceCents: 2999, rating: 3.8}`),
position 9 `Novaq Q20, $19.99, 3.9` (PLANTED rank 9), position 10
`Replacement Ear Tips, $12.99, 4.5` (PLANTED rank 10, `kind: "accessory"`).
Every one of the instruction's criteria is violated in the output: ratings
3.3/3.5/3.7/3.8/3.9, prices $50.00/$69.99/$79.99, an accessory the
instruction names explicitly ("accessories such as ear tips"). Only **1 of
13** expected records appears anywhere (`matchedInAnyOrder: 1`).

For `run-mudwci8d` the failure screenshot settles it visually:
`screenshots/failure-caa46de06749.png` shows the results bar reading
**"1-16 of over 1,000 results for 'wireless earbuds'"** with the
**Brightaisle Plus checkbox unticked**. `catalog/search.ts` documents
`"over 1,000"` as *"the store's habitual … for an unnarrowed earbud search"*;
the narrowed page's expected fact is `1-16 of 43 results`
(`workflows/first-page.ts` `RESULT_COUNT`, and `tests/scenario.test.ts:64`
`assert.equal(plus.organic.length, 43)`).

**This reframes the brief's known cause (2).** The 12-vs-16 count gap is the
eager/lazy split, but the *list itself is the wrong list*. Loading the tail
would give 16 unfiltered rows, not the 16 expected ones. The intruder at
observed position 7 (`Kinetra Run … Graphite, $49.99, 4.5`) is not a
sponsored card — page 1's ads are `Pulsebud Neo ANC`, `organic(3)`,
`SoundCrest AirPro` and `Kinetra Run **Hook** … $44.99, 4.2`
(`catalog/earbuds/earbud-ads.ts`) — it is a non-Plus organic listing that only
appears because the Plus filter was never applied.

**Owner.** The build loop's completion gate:
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\evidence-loop.ts`
(`core.decision_complete` is accepted with no check of the draft against the
instruction's clauses).

**Covered by the two known fixes?** **No.** Neither the rating-format fix nor
the lazy-tail fix touches this. This is the largest single gap.

**Model-free proof.** Take the built Flow's node list from
`snapshots/flow-lane.json` and assert, without a provider, that a
`navigate-and-extract` task whose instruction names a filter produces a Flow
containing either a click on a filter control or a navigate whose URL carries
the filter parameter. A fixture-level check is cheaper still: run the two
Flows against the store and assert the results bar reads `… of 43 results`,
not `over 1,000`.

### 2. A Flow that runs cleanly and answers wrongly is never repaired

**Evidence.** `run-mudw1ktb` `harnessRecovery`:
`{attempted: true, interventions: [diagnosis, diagnosis], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [], refusalCode: null}`
with `flow-lane.json` `failure: null` and all five actions `succeeded`.
`recovery/plan.ts:209-229` emits `steps: [{action: "stop", …}]` with the
refusal *"No failed attempt reached the diagnosis, so nothing was
classified."* Core's own verification had already said the answer was wrong
twice (`core.result.does_not_answer_request`), and that verdict never
reaches the planner.

**Owner.** `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\recovery\plan.ts`
(the `!input.deterministic` branch), with the input assembled in
`runtime/adaptive-orchestrator.ts`.

**Covered?** **No.**

**Model-free proof.** Unit-test `planAutomationStudioRuntimeRecovery` with no
`deterministic` diagnosis but a refuted result verification, and assert the
plan is not `stop` — that it requests exploration or a patch. That test is
writable today against the existing signature and needs no provider.

### 3. Action nodes carry no wait for the state they need

**Evidence.** Three separate symptoms, one cause.

- `run-mudwci8d` action 0: `web.target.not_found` on a dialog the store opens
  at `notifications: 4000` ms (`client/timings.ts`). Rescued by luck —
  `backoffMs: 250`, three attempts, and the element arrived ~2.4 s late.
- `run-mudwci8d` action 7: `extract_list` failed after **6985 ms** with
  *"A listener indicated an asynchronous response by returning true, but the
  message channel closed before a response was received"*. The preceding
  click on "Go" causes a full document navigation; its `afterAction` evidence
  packet is **819 bytes, `truncated: false`** — the near-empty in-flight
  document. The content script was torn down under the extract.
- `run-mudwci8d` build step 6: `web.detect_repeating_structure` refused
  `web.action.rejected.page_unreadable` for the same reason
  (`domain/src/runtime/llm-evidence/capture.ts:133`), costing two further
  wasted calls (steps 7-8).

`run-mudw1ktb` shows the same shape benignly: navigate's `afterAction` packet
is **812 bytes**, and the next click's `beforeAction` is the same 812 bytes.

`web.dom.wait_for_selector` exists and is classified `"safe"`
(`domain/src/actions/safety.ts:20`), so it needs no approval and the model
could have emitted it. It emitted none.

**Owner.** Draft construction —
`F:\!FluxIQ\...\runtime\flow-draft\` / `flow-bootstrap\` (no wait is
synthesised after a navigating step); the ladder's fixed 250 ms backoff in
`runtime/executor/`; and for the channel error specifically
`apps/extension/src/runtime/extract-list-continuation.ts`, which already has
a regression test for this exact string
(`apps/extension/src/runtime/tests/extract-list-continuation.test.ts:21`) and
a prior fix recorded in `docs/working/week2-exit-plan/reports/w2x-extract-across-pages.md`.

**Covered?** **No.**

**Model-free proof.** Deterministic replay of a hand-authored Flow on the
`everything-store` fixture: click "Go", extract immediately, assert failure;
insert `web.dom.wait_for_selector` on the results container, assert success.
Zero provider calls. The fixture's 4000 ms notifications timer gives the same
test for the first click.

### 4. The run's reported failure is the first failed attempt, even when recovered

**Evidence.** `persisted-flow-run.ts:450` takes the first non-null
`action.failure`. `run-mudwci8d` therefore reports
`web.target.not_found` — recovered at attempt 2 — as the run's failure, the
campaign's only issue code, and `summary.json.firstFailure`. The real defect
(12 wrong records) appears only inside `extraction.steps[0]`. The mirror-image
defect is `lane-observation.ts:198`, which writes the bare string
`ambiguous_or_unknown` with no code when nothing failed.

**Owner.** `packages/test-runner/src/flow-lane/persisted-flow-run.ts` and
`packages/test-runner/src/flow-lane/lane-observation.ts`.

**Covered?** **No.**

**Model-free proof.** Unit test: an action list where node A fails then
succeeds on retry, and the dataset judgement fails, must not report
`target_not_found` as the run's failure. Both functions are pure and already
have test files beside them.

### 5. The Flow is not self-contained — no navigate, no routing

**Evidence.** `run-mudwci8d` `flowShape.navigationNodes: 0` for a
`navigate-and-extract` task; the location is supplied by
`prepareFlowPage("playback")` (`creation/lane.ts:140`). Both runs:
`route: {selectedRuleId: null, fallbackUsed: true, evaluations: [], stateObserved: false}`
— no router rule was ever authored, so both dismissal clicks are
unconditional steps that cannot be skipped when the popup is absent.

**Owner.** `F:\!FluxIQ\...\runtime\flow-bootstrap\` (draft reduction) for the
missing navigate; `packages/test-runner/src/flow-lane/creation/lane.ts` for
the measurement that hides it.

**Covered?** **No.**

**Model-free proof.** Assert in `creation/lane.ts` that a built
`navigate-and-extract` Flow has `navigationNodes >= 1`, and run the
deterministic replay from `about:blank` instead of from
`prepareFlowPage("playback")`. Both are provider-free.

### 6. Structure detection can never propose scrolling, so a lazy tail is unreachable

**Evidence.** `domain/src/extraction/proposal.ts:43`: *"`scroll` is never
proposed; only the user picks it."* — repeated at
`domain/src/extraction/structure-detection.ts:54`. The store's first page is
16 results of which the last four load on scroll
(`catalog/results-page.ts`: `PER_PAGE = 16`, `EAGER = 12`,
`lazy = organic.slice(12)`; `client/timings.ts` `lazyResults: 600`). The
capability exists — `web.dom.extract_list` accepts
`pagination: {mode: "scroll", maxScrolls}` (`domain/src/actions/extraction/request.ts:119`)
— but the proposal the model reads can never name it.

**Owner.** `domain/src/extraction/proposal.ts` and
`domain/src/extraction/structure-detection.ts`.

**Covered?** **Partly** — this is the mechanism behind the known lazy-tail
cause. Worth naming because the fix belongs in the proposal contract, not in
the extraction action, and because on its own it does not make run 1 pass
(see cause 1).

### 7. Two extract nodes read the same page and both are kept

**Evidence.** `run-mudw1ktb` nodes `s4` and `s5`, 2.5 s apart, no action
between them, both `succeeded`. `extraction`:
`extractNodes: 2, extractSteps: 1, unpairedDatasets: 0, datasetPages: 1,
observedRecords: 24`. The judge pairs *"the datasets in Core's own order"*
against one expected step (`creation/judgement.ts:1-5`), so both nodes'
output concatenated into the 24 rows. Observed position 12 is
`Kinetra Run … $79.99, 3.7` — the same listing the `run-mudwci8d` screenshot
shows as the **first organic card** of the unfiltered search — which places a
repeat of row 0 at index 12, i.e. 12 rows read twice.

**Honest caveat:** rows 13–23 are published as `observed-not-expected` with
**no field values at all**, so the duplication is strongly supported by the
position-12 alignment but not directly readable. Publishing values for
unexpected rows would settle it.

**Owner.** Draft reduction in `F:\!FluxIQ\...\runtime\flow-bootstrap\`
(accepting two adjacent extracts with no intervening action) and
`packages/test-runner/src/flow-lane/creation/judgement.ts` for the silent
concatenation.

**Covered?** **No.**

**Model-free proof.** Assert no built Flow contains two `extract_list` nodes
with no action between them; and hand-author that Flow, run it
deterministically, and assert 24 rows of which rows 12–23 equal rows 0–11.

### 8. Roughly 38% of paid loop decisions produce nothing

**Evidence.** `run-mudwci8d`: 5 of 13 decisions wasted
(`page_unreadable`, `already_answered` ×2, `target_unobserved`,
`dry_run_refused`). `run-mudw1ktb`: 7 of 19
(`llm.provider_output_invalid`, `draft_rerun` ×4, `dry_run_refused`,
`llm_output.invalid_evidence_decision`). Two calls in run 2 were **unparseable
model output**. The `already_answered` pathology is already documented in
Core (`evidence-loop.ts:622-624` cites a build that "spent seven decisions
asking for the same rerun").

Cost shape: run 1 billed 167,084 input against 1,388 output tokens; run 2
198,640 against 2,526. **A 120:1 and 79:1 input-to-output ratio** — the whole
evidence transcript is resent every call, and $0.166 of the campaign's $0.172
is build input tokens.

**Owner.** `F:\!FluxIQ\...\runtime\llm\evidence-loop.ts` (repeat handling and
context assembly); `domain/src/runtime/llm-evidence/` for the tool result
vocabulary.

**Covered?** **No.**

**Model-free proof.** A recorded-transcript replay harness that feeds the
loop the same decision sequence and asserts the count of decisions whose
result code is in the "no progress" set stays below a ratchet. The result
codes are already recorded in `build.evidenceLoop.steps`.

### 9. Five minutes per run waiting for a recovery record that never arrives

**Evidence.** `RECOVERY_RECORD_WAIT_MS = 300_000`
(`terminal-run-wait.ts:48`); both runs show a 5 min 11 s gap between the last
action and the "repair attempt finished" event, and both carry
`unsettled: "recovery"`. That is 622 s of the campaign's 959 s of run time.

**Owner.** `packages/test-runner/src/flow-lane/terminal-run-wait.ts`, and
whatever in Core is expected to write `metadata.recoveryTrace` and never does
for a `diagnosis_only` plan.

**Covered?** **No.**

**Model-free proof.** A plan whose only step is `stop` should write its
recovery record immediately; assert that a run ending in `unclassifiedPlan`
settles without consuming the wait.

---

## What the artifacts cannot settle

- **Whether Core attempted a repair and failed to record it.** Both runs are
  `unsettled: "recovery"`, and `terminal-run-wait.ts:74-78` states that an
  intervention entry alone says nothing about whether recovery finished. No
  repair was *charged* and none *landed*; whether one *started* is unreadable.
- **The exact parameters of every executed action.** `live-llm.json` records
  `perCallRecords: "not recorded"`, `observedCalls: []`,
  `exploration.source: "absent"`, `toolDetail: "not-published"`. The ledger
  gives refs, verbs and control names — it does not give the selectors, typed
  text or extract field maps each node actually ran with. The one selector I
  could read came from a failure record.
- **Whether `run-mudw1ktb`'s 24 rows are 12 duplicated or 12 organic plus 12
  carousel cards.** Rows 13–23 publish no values. The position-12 alignment
  argues strongly for duplication; it is not proof.
- **Whether the `#:r13b8o:` selectors survive a different seed.** Build and
  playback share seed 241 and the reset does not re-seed, so this run tested
  only stability within one seed — by the fixture's own design
  (`style/element-ids.ts`) those ids are meant not to survive one.
- **Why `run-mudwci8d` build step 9 hit `target_unobserved`.** The code
  classifies it as *"the model getting it wrong"*
  (`domain/src/runtime/llm-evidence/harness-options/exploration-terms.ts:47`),
  but the target it named is not recorded.

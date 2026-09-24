# Run evidence audit: can one live run be post-mortemed from its artifacts?

Specimens, both on disk and read for this audit:

- Failure: `test-runs/run-muf8dstp-0135804a` — `company-directory`, task
  `company-directory-register-page`, verdict `failed`, 31 provider calls,
  $0.0271, 108 s.
- Pass: `test-runs/run-muf8gqpo-4b01df8b` — `social-scheduler`, task
  `social-scheduler-whole-queue`, verdict `passed`, 5 provider calls, 60 s.

Both were produced at facility commit `0b96526` and Core commit `a055c92`
(`run.json` `repositories`).

**Verdict: no.** The ordered chain can be reconstructed at the level of *which
tool was called and which closed-vocabulary code came back*, 32 rows deep, and
nothing below that. Parameters, node ids, prompts, replies, per-step timing and
per-step page state are all absent from the bundle by construction. Worse, the
failed run — the one that needs the post-mortem — loses a whole artifact
(`snapshots/flow-lane.json`) and a whole per-step record (`declaredConsequences`)
that the passing run keeps, so evidence is thinnest exactly where it is needed.

---

## 1. Artifact map

What a created-Flow run writes, and the question each file can actually answer.

| Path | Contains | Answers | Does not answer |
| --- | --- | --- | --- |
| `run.json` | Run id, scenario id + revision sha, seed, both repo commits and dirty flags, lockfile shas, extension sha, browser/OS/viewport, allocated ports, child-process exit codes, `redactionState`, `steps`, `actions` | "Was this run reproducible, and against which code?" — fully. | Anything about the run's behaviour. `steps` is `[]` on **both** specimens; `actions` is `[]` on the failure and one bare `{actionType, startedAt, durationMs, status}` on the pass. |
| `summary.json` | Verdict, event count, screenshot count, `firstFailure {sequence, summary}`, `metrics.steps` | "Did it pass, and what was the headline failure?" | `metrics.steps: 2` is **not** a count of anything this run did — see gap G11. |
| `evaluation.json` | Verdict, `failureCategory`, `facilityFailure`, invariants with `evidenceSequences`, `lane`, `flowCreated`, `oracleVerdict` vs `reportedVerdict`, `harnessActivations`, `durationMs`, `llm {mode, profileId, calls}`, `evidence {sanitizedPacketBytes, rawSnapshotBytes, truncationCount}`, `extraction[]` | "Did FluxIQ's own verdict agree with the oracle, and how close was the extracted dataset?" On the pass: `expectedRecords 280 / observedRecords 280 / matchedRecords 280`. | On the failure: `flowCreated: false`, `extraction: null`, `actions: []`, `evidence.sanitizedPacketBytes: []`. It states that nothing happened, not why. |
| `events.ndjson` | 3 events (failure) / 5 events (pass). Each: sequence, ISO timestamp, trigger, one-sentence summary, correlation id, small `details` object | "What were the phase boundaries, and when?" The failure's three: dispatch 07:49:21.592, settle 07:51:00.967, error 07:51:01.040. | Nothing between phases. 31 provider calls and 32 trace rows all fall inside one undivided 99,375 ms gap. |
| `snapshots/live-llm.json` | The budget contract (`authorized` / `granted` / `declared` / `highTokenConfirmation`), `observed` (call count, token totals, cost, `observedCalls`, `perCallRecords`), `exploration`, `verification`, `build`, `repair` | "What was FluxIQ allowed to spend, and what did it spend?" — fully and well. Also the **only** ordered trace of the build: `build.evidenceLoop.steps[]`. | `observed.observedCalls: []` and `perCallRecords: "not recorded"` on both specimens' build sections. Each step is `{toolId, resultCode}` and nothing else. |
| `snapshots/flow-lane.json` | Task description (ids, judgement, instruction **sha only**), the build record, `flowId`, `flowShape`, `authoredNodes` with screened `parameters` + `parametersWithheld`, `ownPage`, `route`, `harnessRecovery`, `extraction`, `actions[]` with `nodeId`/`attemptIndex`/`evidencePackets` | On a run that created a Flow: "what did the model author, and how did each node behave?" — the single most useful file in the bundle. | **Absent from the failed run entirely.** See gap G1. |
| `snapshots/redaction-attestation.json` | Scan status, scoped file/byte counts, findings | "Is this bundle safe to share?" | Nothing about the run. |
| `logs/core.log`, `logs/host-build.log`, `logs/scenario-lab.log` | 101–321 bytes each: Next.js boot lines, the gateway WebSocket bind, the host bundle size, process exit codes | "Did the processes start?" | Nothing else. There is no Core application log in the bundle. The 31 provider calls left no log line. |
| `review/timeline.json` | The same events re-keyed with a `screenshot` field | Feeds the contact sheet. Strictly a re-projection of `events.ndjson`. | Same gaps. |
| `review/contact-sheet.html` | An `<img>` grid over `screenshots/` | Human review of captured frames. | The failure's sheet has exactly one figure. |
| `report.html` | 1.5 KB HTML summary | Skim. | — |
| `screenshots/` | Failure run: one PNG, `failure-3295b9405420.png`. Pass: none at all (`screenshotCount: 0`). | The failure PNG is genuinely informative — it shows the Northbank Business Register start page, the search form, the A–Z index, the eight sector links, and the first rows of the company table. | The page at *any other moment*. Every non-error event carries `screenshotSuppressed: "capture-unavailable"`. |
| `artifact-index.json` + `bundle.complete.json` | Path, media type, byte count, sha256 and redaction state per artifact; a sha over the index | Tamper-evidence. | — |
| `evidence-policy.json` | `screenshots: "events"`, `trace: "off"`, `video: "off"`, `sampleFps: 0`, `maxScreenshots: 100`, `maxBytes: 26214400` | Why capture was as sparse as it was — except that the policy allowed 100 screenshots and 25 MB and one was taken. The limiter was not policy. |
| `snapshots/extraction-mismatches.json` | Not present on either specimen. Written by `run-flow-lane.ts:344`, reached only when a Flow ran and extraction was judged. |

---

## 2. The step-by-step reconstruction, actually attempted

The question was: for the failed run, can I recover the ordered list of *what
the model was asked, what it decided, which action ran with which parameters,
what the action returned, and what the page looked like at each point*?

### What I could recover

**(a) The instruction.** Not from the bundle — the bundle never stores it. It
is recoverable only by joining out to the repository:
`events.ndjson` sequence 1 gives `details.taskId: "company-directory-register-page"`,
and `apps/scenario-lab/src/scenarios/live-instructions.ts:559-565` at commit
`0b96526` gives the text:

> Scrape the first page of the business register into a table with columns
> name, sector, location and employees, and add a url column holding the
> address of each company's own page. A company that has filed no headcount has
> no employees figure, so leave that cell empty.

(`COMPANY_COLUMNS` and `COMPANY_HEADCOUNT_NOTE` are `live-instructions.ts:62-63`.)
The join is sound because `run.json` pins `repositories.facility.commit` and
`scenarioRevision`. On the *passing* run `snapshots/flow-lane.json`
`task.instruction` records `{characters: 115, sha256: "7609666..."}` — a
digest, never the text. The failed run has neither.

**(b) The ordered decision trace, 32 rows.** From
`snapshots/live-llm.json` → `build.evidenceLoop.steps[]`. Every row has exactly
two keys; I verified this programmatically (`[...new Set(steps.map(s =>
Object.keys(s).sort().join(",")))]` returns `["resultCode,toolId"]`):

| # | `toolId` | `resultCode` |
| --- | --- | --- |
| 1 | `core.run_node` | `web.inspect.succeeded` |
| 2 | `web.detect_repeating_structure` | `web.structure.detected` |
| 3–8 | `core.run_node` ×6 | `web.action.rejected.target_unobserved` |
| 9 | `core.decision_unusable` | `bootstrap.invalid_subflows` |
| 10–18 | `core.run_node` ×9 | `web.action.rejected.target_unobserved` |
| 19–20 | `core.decision_unusable` ×2 | `bootstrap.invalid_subflows` |
| 21 | `core.run_node` | `web.action.rejected.target_unobserved` |
| 22 | `core.decision_unusable` | `bootstrap.invalid_subflows` |
| 23 | `core.run_node` | `web.action.rejected.target_unobserved` |
| 24 | `core.decision_unusable` | `bootstrap.invalid_subflows` |
| 25 | `core.run_node` | `web.action.rejected.target_unobserved` |
| 26–30 | `core.decision_unusable` ×5 | `bootstrap.invalid_subflows` |
| 31–32 | `core.run_node` ×2 | `web.action.rejected.target_unobserved` |

Totals: `core.run_node` 21, `web.detect_repeating_structure` 1,
`core.decision_unusable` 10. Codes: `web.inspect.succeeded` 1,
`web.structure.detected` 1, `web.action.rejected.target_unobserved` **20**,
`bootstrap.invalid_subflows` **10**.

**(c) Two real causes, by joining those codes to source.** This is as far as
the artifacts go, and it is further than the bundle's own prose goes:

- `web.action.rejected.target_unobserved` (20×) is raised by
  `domain/src/runtime/llm-evidence/press.ts:117,134,137` and
  `domain/src/runtime/llm-evidence/structure/detect.ts:94,126,129`, and by
  `domain/src/runtime/llm-evidence/harness-options/execute.ts:101`. The model
  kept naming a target handle the domain would not bind.
- `bootstrap.invalid_subflows` (10×) is
  `F:\!FluxIQ\...\flow-bootstrap\authoring\json-plan.ts:54` — literally
  *"Bootstrap subflows must be an array."* Ten paid decisions produced a
  completion plan with no usable `subflows` list at all.
- The ending, `flow_bootstrap.evidence_repeat_without_progress`
  (`build.failure.code`, `stage: "provider_output_validation"`,
  `httpStatus: 400`), is the loop's no-progress guard firing.

**(d) The budget envelope and the spend.** `granted.maxCalls: 48`,
`maxTotalTokensPerRun: 600000`, `maxEstimatedCostUsd: 0.25`;
`observed.accounting` = 31 calls, 339,424 input tokens, 6,000 output tokens,
$0.027139968, `budgetBreaches: 0`, `pendingCalls: 0`. The run did not die on
budget — it died on the guard with 17 calls of headroom left.

**(e) One page image.** The failure PNG (start page, before or independent of
any exploration step).

### What I could not recover — the parts that matter

Taking the five things the brief asked for, per step:

| Per step, wanted | Recoverable? | Evidence |
| --- | --- | --- |
| What the model was asked | **No.** Not the prompt, not its version, not its token count, not even a hash. `observed.observedCalls: []`, `perCallRecords: "not recorded"`. | `snapshots/live-llm.json` |
| What it decided | **Partly.** The decision *class* only: a tool call, or `core.decision_unusable`. Never the reply, never the plan it wrote, never the issue codes that refused that plan per decision. | `build.evidenceLoop.steps[]` |
| Which action ran with which parameters | **Tool id only.** 21 of 22 tool calls are the same string, `core.run_node`. Which node each ran, and with what argument — a selector, a target handle, a field list — is nowhere in the bundle. | `build.evidenceLoop.steps[]`; `build.declaredConsequences: null` |
| What the action returned | **A closed code only.** `web.action.rejected.target_unobserved` has three distinct causes in the domain, each implying a different fix, and the discriminator is dropped. | see gap G4 |
| What the page looked like at each point | **No.** One screenshot, at the end. 26,898 bytes of page evidence were shown to the model (`evidenceLoop.evidenceBytes`) and none of it was persisted. `evaluation.json` `evidence.rawSnapshotBytes: []`, `sanitizedPacketBytes: []`. | |
| When each step happened | **No.** All 32 rows sit in one 99,375 ms gap between event 1 and event 2. No per-step timestamp or duration exists. | computed from `events.ndjson` |

The most consequential single line: **20 identical rows reading
`web.action.rejected.target_unobserved` cannot be distinguished from one
another.** The bundle cannot say whether the model retried the *same* handle
twenty times or tried twenty *different* ones, and cannot say which of
`nothing_observed_yet`, `handle_not_in_packet` or `page_moved_since_packet`
refused them. Those three are three different products of three different
defects — the model inventing handles, the packet not carrying the handles it
was shown, or the page moving underneath a valid packet — and the artifact
collapses all of it to one word, twenty times.

---

## 3. The gaps, with the producing line

### G1 — A failed build writes no `snapshots/flow-lane.json` at all

`packages/test-runner/src/flow-lane/creation/lane.ts:160-163` throws
`RunnerFailure("runtime.behavior", ...)` the moment `build.outcome !== "proposed"`.
The `flowRunHooks` callback that writes the file
(`packages/test-runner/src/run-scenario.ts:389`) is only reached after that
point. So the failed run loses, in one stroke: the task description and
instruction digest, `authoredNodes`, `ownPage`, `route`, `extraction`, and the
per-action `evidencePackets` — every one of which the passing run has.
The bundle is richest where nothing went wrong.

### G2 — Core's own per-step fields are thrown away before the bundle sees them

Core's in-memory trace row is
`{iteration, decision, callId, toolId, evidenceBytes, effectApplied, resultCode, usage}`
(`F:\!FluxIQ\...\runtime\llm\evidence-loop.ts:133-144`), and Core's sanitizer
*keeps* `iteration`, `callId`, `evidenceBytes` and `usage`
(`F:\!FluxIQ\...\service\flow-bootstrap-commands\evidence-trace.ts:42-61`).
They are then discarded twice over:

- `F:\!FluxIQ\...\flow-bootstrap\evidence-loop-steps.ts:40-46` projects each row
  to `{toolId, effectApplied?, resultCode?}`; the diagnostic's declared shape at
  `generation-failure.ts:199-203` has no room for more.
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts:314-319`
  (`buildSteps`) and the duplicate at `:329-331` re-apply the same three-field
  filter on the Lab side.

Consequence: no step in either specimen carries an iteration number, a call id,
its own evidence byte count or its own token usage. Note `decisionCount: 31`
against 32 published rows — one iteration wrote two rows, and which one is not
recoverable because `iteration` was dropped.

### G3 — No prompt, no reply, and no per-call record for a build

`packages/test-runner/src/live-llm/build-usage.ts:35-37` hard-codes
`observedCalls: []` and `perCallRecords: "not recorded"` for every build, with
the comment "Core does not itemize a build's calls one by one". Core's
`AutomationStudioLlmRunCallRecord`
(`F:\!FluxIQ\...\runtime\llm\run-call-record.ts:69-86`) — sequence, requestId,
taskKind, stage, promptVersion, validation issue codes, reported vs charged
tokens, budget breach — exists and is written for *runs*, and a build is not a
run. The 31 calls of the failed build have no individual record of any kind.

Even where records do exist, the Lab drops fields:
`packages/test-runner/src/live-llm/observed-usage.ts:120-135` (`fromProviderCall`)
omits `sequence`, `charged` and `budgetBreach`, so per-call records cannot be
put in order, and a reported token figure cannot be told from a reserved one.
The failed run's `outputTokens: 6000` across 31 calls is exactly the kind of
round number that needs that distinction.

### G4 — The refusal's discriminating reason is dropped

The domain's tool result is
`{ok: false, code: "target_unobserved", detail: {reason, target}}` with `reason`
drawn from a closed set of six words — `nothing_observed_yet`,
`handle_not_in_packet`, `page_moved_since_packet`, `handle_no_longer_on_page`,
`handle_names_several_now` (`domain/src/runtime/llm-evidence/tool-rejection.ts:128-176`,
raised at `press.ts:117,134,137,152` and `structure/detect.ts:94,126,129,136`).
Only the flattened `resultCode` survives into Core's trace and thence the
bundle. This is the single highest-value missing field in the specimen: it
would turn "20 rejections" into a named defect. It is a closed vocabulary, so
it carries no page data and needs no new redaction rule.

### G5 — `bootstrap.invalid_subflows` arrives without its issue detail

Ten decisions were refused with this code. Core builds each refusal as
`authoringError("bootstrap.invalid_subflows", "Bootstrap subflows must be an array.", "plan.subflows")`
(`F:\!FluxIQ\...\flow-bootstrap\authoring\json-plan.ts:54` and `:72`) — the
third argument is a **path**, `plan.subflows`, not page content. Neither the
path nor the sibling issue codes per decision reach the bundle;
`build.failure.issueCodes` is absent on this run entirely, and the step row
carries one code with no path. So the bundle cannot say whether the model wrote
no `subflows` key, wrote a non-array, or wrote subflows whose nodes were all
individually refused — three different repairs.

### G6 — `toolIds` omits the tool that made 21 of the 22 calls

`packages/test-runner/src/flow-lane/creation/build-proposal.ts:371-373`
(`vocabulary`) filters out every id starting with `core.`
(`CORE_DECISION_STEP_PREFIX`, `:34`). That prefix was meant to exclude Core's
*decision* step names (`core.decision_unusable`, `core.decision_complete`,
`core.decision_amend_draft` — `F:\!FluxIQ\...\flow-bootstrap\decision-step-ids.ts:11-18`),
but `core.run_node` is a genuine exploration tool
(`F:\!FluxIQ\...\runtime\action-permissions\tests\declared.test.ts:24,53`).
Both specimens therefore publish `toolIds: ["web.detect_repeating_structure"]`,
which reads as "one tool was used" when 21 of 22 calls went through another.

### G7 — The failed build loses `declaredConsequences`, the only per-step verb record

The passing run's `flow-lane.json` `build.declaredConsequences[]` carries, per
exploration step, `{actionKind: "exploration_step", actionId: "core.run_node",
ref: "extract.queue.1", verb: "extract list", effect: "observe", controlKind: "step"}` —
a `ref` that joins to the call and a human-readable verb. The refused path sets
`declaredConsequences: null` at
`packages/test-runner/src/flow-lane/creation/build-proposal.ts:345`, with the
comment that "the declarations and the cross-check live on a proposal, and a
refused build left none" (`:349`). Core's gate *does* hold those declarations for a
refused build — `flowBootstrapPermissionRequiredFailure` carries the gate's
request — but no refusal other than `permission_required` publishes them.

### G8 — Core records no per-step page state, and says so itself

`F:\!FluxIQ\...\runtime\exploration-reduction\evidence-loop-trace.ts:16-36`
states in its own header that the trace carries neither "the state before and
after each step" nor "the argument the action was given", and calls both "real
gaps in the 2.3 contract". The runner computes an evidence digest per step for
repeat detection and "it never reaches the trace"; the repeat signature
`canonicalJson([epoch, toolId, input])`
(`F:\!FluxIQ\...\runtime\llm\repeat-policy.ts:48-62`) holds the argument and is
discarded. So no artifact can say whether two `core.run_node` rows are the same
call twice.

### G9 — Every event but the failure has its screenshot suppressed

`packages/test-runner/src/run-scenario.ts:123` constructs the run-wide capture
controller with **no screenshot adapter**:
`new EvidenceCaptureController(bundle, evidence.capture)`. An adapter is built
only at `:319-320` for the recording lane's step runner, a branch the
created-Flow lane never takes. `packages/test-evidence/src/capture.ts:29` then
writes `screenshot = {suppressed: "capture-unavailable"}` for every event. The
one PNG the failed run has comes from a separate direct call at
`run-scenario.ts:517-522`. The passing run has **zero** screenshots.
This is not a policy limit: `evidence-policy.json` permits 100 and 25 MB.

### G10 — The failure's own `details` are filtered out of the event

`packages/test-runner/src/flow-lane/creation/lane.ts:161-163` raises the
failure *with* `details: {failure, providerCalls, providerInvocation}`. The
event writer at `packages/test-runner/src/run-scenario.ts:515` republishes
`error.details` only when `error.category === "recording.contract"`. A
`runtime.behavior` failure — which every instruction-lane failure is — has its
details silently dropped. That is why `events.ndjson` sequence 3 carries only
`{failureCategory: "runtime.behavior"}`.

### G11 — `metrics.steps` names something else entirely

`packages/test-runner/src/run-scenario.ts:635`:
`const metrics = { steps: workflow.recordingScript.length }`. Both specimens
report `metrics.steps: 2` in `summary.json` and `evaluation.json`. It is the
length of the *fixture's recording script*, a property of the scenario, not of
the run. A reader comparing a 32-decision failure and a 3-decision pass sees
"steps: 2" on both.

### G12 — `run.json` `steps` and `actions` are empty for an instruction-built run

`packages/test-runner/src/run-scenario.ts:632` passes
`steps: stepRunner?.timings() ?? []`. The created-Flow lane constructs no
`stepRunner`, so `steps` is always `[]`. `actions` is populated only from the
Flow run, so the failed build — which never ran a Flow — gets `[]`. Neither
field is marked "not applicable"; both read as "nothing happened".

### G13 — The exploration record is structurally present and always empty

`packages/test-runner/src/live-llm/exploration-record.ts:86-99` defines an
`EMPTY` record with `toolDetail: "not-published"`, and the header at `:64-71`
explains that Core does not publish the exploration's per-step trace on a run
detail "today". The passing run shows `exploration: {source: "absent", ...,
toolDetail: "not-published"}`; the failed run shows `exploration: null`. The
reader is in place and Core's producer is not.

### G14 — Core wrote no application log into the bundle

`logs/` holds 640 bytes across three files, all of it process start-up and exit
codes (`copyProcessLogs`, `run-scenario.ts:797`, which copies `*.log` from the
allocation's logs dir). There is no log line for any of the 31 provider calls,
any tool dispatch, or any refusal. When the structured artifacts drop a field,
there is no second place to look.

---

## 4. Cheapest fix per gap

| Gap | Cheapest fix |
| --- | --- |
| G1 | In `packages/test-runner/src/flow-lane/creation/lane.ts`, write `snapshots/flow-lane.json` from the build record *before* throwing at `:160-163`, with the run-side fields null. The snapshot builder already tolerates nulls; only the call site moves. |
| G2 | Widen the step type in `F:\!FluxIQ\...\flow-bootstrap\evidence-loop-steps.ts` to carry `iteration`, `callId`, `evidenceBytes` and `usage` (Core's sanitizer already keeps all four), then widen the mirror in `packages/test-runner/src/flow-lane/creation/build-proposal.ts` (`buildSteps`, `:314`, and the duplicate at `:329` — fold them into one function while there). All four are numbers and identifiers, so no redaction rule changes. |
| G3 | In `F:\!FluxIQ\...\runtime\llm\run-call-record.ts`'s writer, emit the same records for a build as for a run, and publish them on the bootstrap diagnostic; then in `packages/test-runner/src/live-llm/build-usage.ts` read them instead of hard-coding `[]`. Separately, add `sequence`, `charged` and `budgetBreach` to `LiveLlmObservedCall` in `packages/test-runner/src/live-llm/observed-usage.ts:9-28`. |
| G4 | Carry `detail.reason` into the trace row's result code, either by appending it (`web.action.rejected.target_unobserved.handle_not_in_packet`) or as a new `resultReason` field, in `domain/src/runtime/llm-evidence/tool-rejection.ts` where the rejection is built. Six closed words; no new redaction surface. **Highest value per line changed.** |
| G5 | Include the authoring issue's `path` (already `"plan.subflows"`) and the per-decision issue-code list on the trace row, at `F:\!FluxIQ\...\flow-bootstrap\authoring\json-plan.ts` where `authoringError` is constructed and wherever the unusable decision is recorded. Keep the sentence out; the path is enough. |
| G6 | In `packages/test-runner/src/flow-lane/creation/build-proposal.ts:371-373`, exclude the three literal ids in `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_DECISION_STEP_IDS` instead of the whole `core.` prefix. One-line change. |
| G7 | In `packages/test-runner/src/flow-lane/creation/build-proposal.ts:349` (`refused`), read `declaredConsequences` off the diagnostic once Core publishes the gate's declarations on every refusal, not only on `permission_required`. |
| G8 | Add a hash of the repeat signature to each trace row in `F:\!FluxIQ\...\runtime\llm\repeat-policy.ts` / `evidence-loop.ts` — the signature already exists and a hash carries no values. That alone separates "twenty retries of one handle" from "twenty different handles". Persisting the before/after evidence digest per step is the fuller fix, in the same place. |
| G9 | Pass the same `screenshotAdapter` built at `packages/test-runner/src/run-scenario.ts:319` to the run-wide controller at `:123`, so `runtime.dispatch` and `runtime.settle` capture frames. The policy already permits 100. |
| G10 | In `packages/test-runner/src/run-scenario.ts:515`, publish `error.details` for `runtime.behavior` as well as `recording.contract`; the created-Flow lane already passes only codes and counts. |
| G11 | Rename the field in `packages/test-runner/src/run-scenario.ts:635` to `scriptSteps`, or add the run's real decision count beside it. |
| G12 | In `packages/test-runner/src/run-scenario.ts:632`, emit `steps: null` and `actions: null` when the lane runs no step runner, so absent reads differently from empty. |
| G13 | No Lab change needed: `packages/test-runner/src/live-llm/exploration-record.ts` already reads `toolIds`/`resultCodes` off Core's `metadata.recoveryTrace`. The fix is in Core, publishing that stage's per-step detail. |
| G14 | Write Core's own runtime log into the allocation's logs dir so `copyProcessLogs` picks it up; the copier at `packages/test-runner/src/run-scenario.ts:797` already takes any `*.log`. |

### If only three were fixed

G4, G2 and G1, in that order. G4 turns the specimen's twenty identical rows
into a named defect; G2 makes the rows distinguishable and orderable at all;
G1 stops the failure case being the thinnest bundle in the set. Together they
are a few dozen lines across four files and no new redaction surface, and they
would have let this run be diagnosed from disk instead of from source-reading.

---

## 5. What I did not verify

- I did not run any test, build or check. This was a read-only audit of two
  existing run directories plus the producing sources in both repositories.
- I did not confirm that the proposed fixes compile or that the widened step
  shapes pass Core's strict parsers — `generation-failure.ts:725` uses
  `hasExactFields`, so widening the diagnostic's `evidenceLoop` shape will need
  that field list extended in lockstep or the whole record is rejected.
- I did not check whether any *other* run directory under `test-runs/` carries
  artifacts these two lack.
- I read `docs/working/language-driven-flow-loop-plan/run-debug-template.md`
  only as a filename; my brief scoped me out of the planning documents, so I
  cannot say whether this audit's gap list lines up with what that template
  asks a debugger to fill in. That is worth a five-minute check by the
  supervisor.

## 6. Contradiction found

`packages/test-runner/src/live-llm/build-usage.ts:22-25` asserts that
`perCallRecords: "not recorded"` "is the truth for a build: the per-call caps
are then judged through Core's totals." That is true as a statement about
*budget enforcement* and false as a statement about *diagnosis*. The file's own
sibling, `observed-usage.ts:1-4`, sets the policy that made both true:
"Counts, token totals and a cost figure only: no prompt, no response, and no
page data is read here, so this can be published in an evaluation." The bundle
is designed to be publishable, and publishability has been bought by making it
undiagnosable. Every gap above except G1, G6, G9, G10, G11 and G12 traces back
to that one trade. The gaps I have costed are the ones where the missing field
is a closed-vocabulary code, an identifier or a number — where diagnosis can be
bought without giving up publishability. The remaining question, which is a
product decision and not mine, is whether a run bundle should be able to hold
the prompts and the page snapshots behind a redaction boundary rather than not
hold them at all.

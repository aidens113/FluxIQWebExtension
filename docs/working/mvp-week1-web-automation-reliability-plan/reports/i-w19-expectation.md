# i-w19-expectation — design W19's fix: check where a recorded click landed

Worker: `i-w19-expectation`, read-only. I read this repository from `HEAD f4268fb`,
and it had moved to `5911011` by the time I finished. Core was read from `5d495eb`
and had moved to `267a2ca`. Every line cited below was re-anchored at the later
HEADs wherever those commits touched the file. Nothing in either tree was edited.
The probes ran from the scratchpad.

## Outcome

**Done, as a design. The decided approach, Option A, works, but it needs three
pieces the brief did not anticipate. Without them W19 still passes wrongly.**

1. **Core evaluates the recorded expectation, and then ignores the verdict.**
   - A probe ran Core's real executor on a click node carrying an
     `expectedState`. The host rejected it with an `auth_required` record.
   - Core reported the run `succeeded` and the click attempt `succeeded`, with
     `failure: null`.
   - The rejection appears only as a transition comparison of `blocked`, and the
     next node still ran.
   - The Flow lane reads a failed run's category only from each attempt's
     `failure`, so W19 would still report nothing.
   - So Option A needs a **Core behaviour change**: a host-rejected expected
     state must fail the action attempt. That is a change, not an addition.
   - The inventory row PB10b called for "one lift line", which understates it.
2. **The navigation cannot literally be attached to the click's recorded
   event.**
   - The click's `client.recording_event` is sent the moment the click is
     processed (`recorded-event-intake.ts:127`).
   - The navigation it explains only commits later. It is then debounced for
     250 ms (`navigation-recorder.ts:5,24-32`).
   - Two designs work:
     - **Recommended (the link design):** record the explained navigation as its
       own non-executable event that names the click's sequence number, and let
       Core's recording mapper see the entries that follow each observation.
     - **Alternative (the hold design):** hold the click's send until its
       navigation settles. It needs no change to Core's recording-mapper API, but
       it risks dropping or reordering every recorded click.
3. **No URL condition reports `AUTH_REQUIRED` today.**
   - The sign-in-gate check needs the action to name a selector
     (`results.ts:271`). A URL claim names none, so on a sign-in page it reports
     STATE_MISMATCH.
   - `results.ts` has to learn that a failed URL claim on a sign-in gate is
     `AUTH_REQUIRED`.

With those three pieces added, the chain goes end to end:
1. The replayed click succeeds.
2. Core asks the host to check `the page URL contains "/scenarios/auth-gate/account"`.
3. The page is the sign-in form, so the assert reports `web.auth.required`.
4. Core fails the click attempt with that record.
5. The run stops.
6. The Flow lane reports `auth_required`.

No week1 row that passes today is predicted to fail (see Blast radius).

## 1. Recorder: how the landing reaches the click

**Today's split, and the tests that pin it.**
- A top-frame `link` or `form_submit` commit is dropped at
  `recorded-event-intake.ts:86`. Script navigation such as auth-gate's
  `location.assign` (`pages.ts:44`) is reported by Chrome as `link`. That is
  `g-domain-mapping`'s reading, not observed live.
- Any other untyped commit within 5 s of a click or submit is dropped at
  `navigation-recorder.ts:48`.
- Pinned by:
  - `recorded-event-intake.test.ts:150-160` ("a link navigation is explained by
    its click": the link commit is never scheduled);
  - `recorded-event.test.ts:33-34` (typed navigation executable, link not);
  - `gateway-payloads.test.ts:32-34` (typed maps to `navigationRequested`, link
    to none);
  - `domain/src/io/input-model.ts:110-113` (only `transition: "typed"` maps to an
    input).
- `navigation-recorder.ts` has no unit test.

**The link design, recommended.**
1. `navigation-recorder.ts:18-20`: `noteExplanatoryAction` also keeps the
   sequence of the last **executable** click.
   - A `dom.submit` extends the time window but must not replace that sequence.
     Auth-gate's submit button fires `click` and then `submit`, and the submit is
     evidence, not a candidate.
2. `navigation-recorder.ts:36-53`: `shouldRecord` returns a verdict, not a
   boolean.
   - Inside the window at `:48`, a commit flagged top-frame cross-document
     returns `explainedBy: <click sequence>`.
   - An explained navigation does not claim `lastRecorded` (`:49-51`), so typed
     navigation behaves as today.
3. `recorded-event-intake.ts:83-88`: `link` and `form_submit` commits with
   `details.frameId === 0` are scheduled as explained-only candidates. They are
   recorded only when the verdict is `explainedBy`; otherwise they are still
   dropped.
   - Subframe commits and `reload` still return early.
   - `onHistoryStateUpdated` (`:90-92`) is unchanged, so single-page-app route
     changes stay out of scope for Week 1.
4. `recorded-event-intake.ts:99-110`: an explained verdict records
   `{ kind: "browser.navigation", url: <origin + pathname, no query, no hash>, metadata: { transition: "explained", explainedBy } }`.
   - The query string is removed at the source, following the same rule as
     `page-identity.ts:49-52`.
   - The 250 ms debounce means a client redirect's second commit replaces the
     first, so the landing recorded is the final one.
5. `recorded-event-intake.ts:112-135`: the explained navigation is not executable,
   so today it would only reach `sendRecordingEvidence` (`:134`). It must **also**
   be sent as `client.recording_event` through `gatewayRecordingEventFromPayload`.
   - That function forwards `metadata` untouched when there is no `inputId`
     (`gateway-payloads.ts:75-76`).
   - Core then stores it as a `domain_event` (`bridge.ts:363-379`,
     `model/recording-domain.ts:186-203`).
   - That entry type survives the mapper's compaction (`service/recordings/timeline.ts:7-12`).

**Nothing executes twice.**
- The explained navigation maps to no input (`input-model.ts:110-113`: only
  `typed` does), so the mapper returns `null` for it.
- Core's fallback candidate applies only to entries of type `action`
  (`service.ts:5776-5777`).
- The expectation added to the click is `web.dom.assert`, which reads the page
  and never navigates.

**Collision with `g-recorder-signals`.** Option A needs **neither**
`gateway-payloads.ts` nor `identity/context.ts`. The landing travels in
`payload.metadata`, which `gateway-payloads.ts:75-76` already forwards, and it is
not an identity signal.

**The hold design, the alternative.**
- Capture the click's snapshot at once, but hold its `client.recording_event`
  and evidence. Queue every later intake item behind it.
- Release the click when one of these happens: a top-frame commit (then wait for
  that tab's `content.ready`, or about 1.5 s), about 1 s passes with no commit,
  or the next executable event arrives.
- `ActiveRecording.stop` (`active-recording.ts:149-170`) sets `idle` with no
  drain today. It would have to flush the held click first, or the last click of
  every recording is lost.
- It needs no Core change to the mapper API. But a defect in it delays, reorders
  or drops **every** recorded click. This is the code path where 12 of 24 runs
  lost an action before the race fix. A defect in the link design can only lose
  the expectation.

## 2. Domain: the expectation the mapper emits

**Shape.** For a recorded `web.dom.click` that has a linked explained navigation:

```json
{ "conditions": [{ "assert": { "kind": "url", "expected": "/scenarios/auth-gate/account" } }], "mode": "all", "timeoutMs": 5000 }
```

- `conditions.ts:66-87` reads it as `{ assert: { kind: "url", expected, timeoutMs: 5000 } }`.
- It describes it as `the page URL contains "/scenarios/auth-gate/account"` (`:117`).
- Core reads `mode` and `timeoutMs` from `expectedState`
  (`transition-comparison.ts:123-127`).
- Why 5000 ms: it matches the assert verb's default window
  (`assertion-evaluation.ts:63`) and the recorder's explanation window. A URL
  claim is always judged and polls to its deadline (`:74,163-176`), so a wrong
  landing costs up to 5 s and a correct one holds on the first check.
- It carries **no value**: no query, hash, selector, element text or
  `inputValue`, only a path. The URL check is a substring test
  (`assertion-evaluation.ts:166-167`), so a path survives the Lab's run-time
  origin.

**It emits nothing when:**
- the action is not a click;
- no following entry is a `web.page.navigated` whose `metadata.explainedBy`
  equals the click's `payload.sequence` (`gateway-mapping.ts:76`);
- the landing path equals the click page's own path, or is `/` (the claim would
  prove nothing);
- the URL cannot be parsed.

**Where it goes.**
- A new focused builder in `domain/src/runtime/expectation/`, which owns the
  condition vocabulary. It is exported through that directory's `index.ts`.
  - `web-panel-host.ts` already carries 2 baselined barrel-bypass imports, so
    reach the builder through the barrel.
- `web-panel-host.ts:115-120`: `mapWebRecordingObservation(observation, context)`
  calls the builder only when `action.outputId === "web.dom.click"`.
- `candidate(...)` at `:136-138` gains an optional `expectedState`.
- The mapper is registered at `:86-88`. Core already passes a context argument
  (`service.ts:2412`).

**How the sign-in page becomes AUTH_REQUIRED.** This is an extension change,
not a domain one.
1. `results.ts:270-276` `authGateFailure` gains a second branch:
   `action.actionType === "web.dom.assert" && action.assert?.kind === "url" && signInGatePresent()`.
2. Every result passes through it (`results.ts:384`).
3. `page-identity.ts:111-118` never replaces AUTH_REQUIRED.
4. The domain evaluator keeps a client record whose code is in the closed set
   (`evaluate.ts:145-146`, pinned by `evaluate.test.ts:74`), and makes it the
   verdict's failure (`evaluate.ts:181-187`).
5. Auth-gate's sign-in page has the password control the check needs
   (`pages.ts:15-17`, `results.ts:360-363`).

## 3. Core: the candidate field, its lift, and the verdict

**Is the node's expectation evaluated after the action? Yes.**
1. `node-execution.ts:130-139` `finishAttempt` calls
   `attemptWithHostExpectationEvaluation`.
2. That function reads `expected.expectedState`
   (`expected-transition.ts:8`, `transition-comparison.ts:99`).
3. It asks the host with source `transition_comparison`
   (`transition-comparison.ts:107-113`).
4. The probe observed the call: `[[{"assert":{"kind":"url","expected":"/scenarios/auth-gate/account"}}], "all", 5000]`.

**Which category does the attempt report? None.**
1. `transition-comparison.ts:117` only replaces `transitionComparison`. The
   verdict's category becomes comparison status `blocked` (`:28,158-161`).
2. `graph-run.ts:125` branches only on `attempt.status`, so the run follows
   `success`.
3. The run detail copies `attempt.failure`, which is absent
   (`service/summaries/conversions.ts:141,162`).
4. The Flow lane reads only that field (`persisted-flow-run.ts:102,152`), and a
   run with no failure reads `passed` (`lane-observation.ts:89-98`).
5. `node-execution.test.ts:114-137` pins exactly this: a rejected state leaves
   the attempt `succeeded`.

**The Core pieces.**

| Core file | Change |
| --- | --- |
| `nodes/importer-sdk.ts:19-29` | Additive `expectedState?: JsonObject` on `AutomationStudioRecordingMapperCandidate`. |
| `nodes/importer-sdk.ts:78` | Mapper context gains `following: readonly AutomationStudioRecordingMapperObservation[]`: the next mapper-visible entries in timeline order, bounded (for example 32). Additive and domain-agnostic. |
| `runtime/recording-flow-proposal.ts:12-27` | `expectedState?: JsonObject` on `RecordingFlowActionCandidate`. The file has 1 baselined `imports` entry; add no new barrel bypass. |
| `runtime/service.ts:2396-2412` | Build the observation array once and pass `following`. |
| `runtime/service.ts:4703-4719` | `validateRecordingCandidate` lifts a plain-object `expectedState` (`structuredClone`) and drops anything else. |
| `runtime/service.ts:5855-5859` | `appendRecordingProposalToFlow` writes `expectedState` into `parameterValues`, where `expected-transition.ts:8` reads it. |
| `runtime/executor/transition-comparison.ts:93-118` | When `evaluation.passed === false`, return the attempt with `status: "failed"`, `route: "failed"`, `message`, and `failure: evaluation.failure ?? <Core expected_state_missing record>`, keeping `transitionComparison`. The gate at `:102` already skips non-succeeded attempts and `builtin.policy.expectation`. |

**`service.ts` has no headroom.** Core's `.structure-baseline.json:87` holds it
at 6919 lines under `file-lines`, which refuses growth.
- The two lifts and the `following` change must therefore be net-zero or smaller
  in `service.ts`.
- Extract the candidate construction (`:4703-4719`) and the node construction
  (`:5845-5875`) into a focused module beside `service/recordings/timeline.ts`,
  put the lift there, and call it from `service.ts`.
- `runtime/tests/service.test.ts` is held at 4789 lines too, so its tests go in
  a new file.

**After the executor change, the probe's second row shows the downstream path.**
The click attempt carries the `auth_required` record, so:
- the run is `failed` with "Recovery ladder reached LLM diagnosis fallback before a configured provider was invoked.";
- the extract node is never dispatched;
- the comparison is `blocked`;
- the recovery ladder selects `llm_diagnosis` (`recovery-ladder.ts:54-63`).

That is the same stop every failed recorded action already takes.

**Compatibility.**
- The executor change affects every host that binds `expectationEvaluator` and
  every node carrying `expectedState`.
- In this repository, web output nodes declare the parameter
  (`domain/src/output-nodes/definitions.ts:34-40`) but nothing writes it
  (`:22-25`), so no existing web Flow changes verdict.
- Core's transition-comparison and importer-SDK documentation must say so.
- AGENTS.md requires the supervisor to alert the user before the first Core
  edit.

## 4. Blast radius across the week1 corpus

A recorded click gains an expectation only when a **top-frame cross-document
commit on the same tab** follows it within 5 s. I checked each recorded click in
the fixtures (`operation: "click"` in the manifests) against the pages' own
navigation code.

| Row | Recorded click | Gains an expectation? | Effect |
| --- | --- | --- | --- |
| W18 auth-gate | `sign-in`, then `location.assign` to `/account` (`pages.ts:44`) | Yes: `/scenarios/auth-gate/account` | Should hold once the landing settles. The background waits for the tab first (`action-runner.ts:74`, `automation-tab.ts:109-120`). |
| W19 auth-gate `expired` | same Flow | Yes | Lands on `/scenarios/auth-gate/?expired=1`, a sign-in form, so `auth_required`. **This is the target.** |
| W10 navigation | `full-navigation`, a real `<a href>` to `/second` (`scenario.ts:33,93`) | Yes: `/scenarios/navigation/second` | Primary holds. |
| W10 `broken-link` | same | Yes | Lands on `link-retired`, which is not a sign-in gate, so it reports `unexpected_state`. It expects `navigation_unexpected`. **It does not pass today either**: that code has no producer on a click path (only `action-runner.ts:148` and `browser-tab.ts:126`), so the Flow lane reports no structured failure. It changes from no category to the wrong category. |
| W15 multi-tab | `open-order-details`, `target="_blank"` (`list-page.ts:37`) | No: the commit is in another tab | None. |
| W16 file-transfer | `download-report`, a `.csv` link | No, assuming a download commits nothing (not verified) | None. |
| W17 upload | `upload-submit` | No: `preventDefault` (`file-transfer/page.ts:75-76`) | None. |
| W27 failure-surfaces | `detach-target`, which does not navigate unarmed | No | `blocked-url` still expects `navigation_unexpected` from a click, still unreachable. |
| W28 iframe-checkout | clicks inside frames | No: subframe commits are excluded | None. |
| W01-W09, W11-W14, W20-W26 | no navigation code on the recorded controls | No | None. |

**Other effects.**
- **Recording lane.** The new `web.page.navigated` events leave W10's "at least
  once" satisfied (`scenario.ts:39`). Auth-gate pins exact counts only for input
  and click events. Unlisted types are not checked (`recorded-events.ts:17-18`),
  and the proposal check counts only executable types
  (`recording-flow-proposal.ts:84-87`).
- **Realistic fixtures outside week1.** `admin-console` changes routes with
  `pushState`, which is out of scope. `storefront-checkout` and
  `member-directory` use hash links, which produce no commit. None are affected.

**Replay race.**
- `waitForTabReady` wants only 1 s of URL stability (`automation-tab.ts:120`). A
  navigation that starts after that, or a slow landing, can let the assert reach
  the old page mid-poll.
- The rejected send becomes `web.action.failed` (`command-router.ts:29-33`,
  `action-runner.ts:80-88`). That code is in the closed set, so the evaluator
  keeps it, and after the Core change the result would be a false `action_failed`
  on W18.
- Auth-gate navigates after one loopback fetch, so the race is unlikely there.
  The design closes it anyway (E3 below).

## Fix design, partitioned by file

**Extension (`apps/extension`)**

| ID | Files | Change | Unit proof | Harness proof | Lab proof |
| --- | --- | --- | --- | --- | --- |
| E1 | `src/background/connection/navigation-recorder.ts`, `recorded-event-intake.ts`; tests `connection/tests/navigation-recorder.test.ts` (new), `recorded-event-intake.test.ts`, `recorded-event.test.ts`, `gateway-payloads.test.ts` | The link design, §1 | Explained verdict carries the click's sequence; a submit does not replace it. A top-frame link commit in the window goes out as `client.recording_event` with `transition: "explained"`, `explainedBy`, and a URL with no query. A subframe link, a reload, and an unexplained link are still dropped (rewrite `:150-160`). The explained row is not executable and has no input id. Mutation proof: restore the early return at `:86`. | None: the background is not in the content harness | Auth-gate recording timeline has one explained `web.page.navigated` whose `explainedBy` is the click's sequence |
| E2 | `src/content/action-runtime/results.ts`; `e2e/content/tests/failures.spec.ts` | `authGateFailure` URL-claim branch, §2. `results.ts` is 395 lines, so this crosses the 400-line warning but not the 800 limit. | None: needs a DOM | New row in "on auth-gate" (`:114-156`): a URL assert on the sign-in page reports `auth_required` / `web.auth.required` and never contains the demo password. The URL row on a non-gate page (`check-assert.spec.ts:296-313`) is the control. Mutation proof: drop the branch, and the row reads `state_mismatch`. | W19 |
| E3 | `src/runtime/action-runner.ts`; `src/runtime/tests/action-runner.test.ts` | In `runActionInFrame` (`:197-220`), a `web.dom.assert` whose send rejects with a closed port or no receiver waits for `waitForTabReady` (already imported, `:15`) and is sent once more. No other verb is re-sent. The file has 1 baselined `imports` entry; add none. | The `sendMessage` stub (`:72-120`) fails the first send and answers the second: one result, two sends. A click that fails the same way is sent once. Mutation proof. | None | W18 3 of 3 |

**Domain (`domain/src`)**

| ID | Files | Change | Unit proof | Lab proof |
| --- | --- | --- | --- | --- |
| D1 | New builder in `runtime/expectation/`, `runtime/expectation/index.ts`, `web-panel-host.ts`; tests in `runtime/expectation/tests/` and `tests/domain.test.ts` | §2 | A click plus a linked explained navigation in `following` gives the exact `expectedState` above. No link, a typed navigation, the same path, or `/` gives none. Query and hash are stripped. The explained observation maps to `null`. A `transition: "explained"` row in `io/tests/input-model.test.ts`. Mutation proof. | The proposal's click candidate carries the exact shape |

**Core (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio`)**

| ID | Files | Change | Unit proof |
| --- | --- | --- | --- |
| C1 | `runtime/executor/transition-comparison.ts`; `runtime/executor/tests/node-execution.test.ts` | Executor verdict, §3 | Rewrite `:114-137`: a rejected state gives a `failed` attempt. The host's `auth_required` record lands on `attempt.failure`, the comparison is `blocked`, the run is `failed`, and the next node is not dispatched. A rejection without a record gives Core's `expected_state_missing`. An accepted state is unchanged. Mutation proof: remove the transform. |
| C2 | `nodes/importer-sdk.ts`, `runtime/recording-flow-proposal.ts`, `runtime/service.ts` (net-zero, via a new module beside `service/recordings/timeline.ts`); new test file | Candidate field, `following`, lift, §3 | Following the pattern at `service.test.ts:244-263`, in a new file: a mapper candidate's `expectedState` reaches `reviewedGraph.nodes[0].parameterValues.expectedState`; a non-object is dropped; the mapper receives `following` containing the next entry. Mutation proof: delete the lift. |
| C3 | Core architecture pages for the importer SDK and the transition comparison | Document both changes and their compatibility | none |

**Order.**
1. **C1, E2 and E3 in parallel.** They share no file, and none of them changes a
   week1 verdict alone, because nothing writes `expectedState` yet.
2. **C2.** It is additive.
3. **Rebuild the linked Core package, then D1.** D1 needs C2's mapper context
   type.
4. **E1.** It is harmless on its own, since the explained navigation maps to no
   input and the mapper returns `null`, but W19 needs it.
5. **Lab** (below).

## What changed and why

Nothing in either repository. This file is the only output. The probe files
live in the scratchpad (`…/scratchpad/w19probe/`), outside both trees.

## Commands run and observed results

- **Core probe.** From `F:\!FluxIQ\packages\fluxiq`:
  `npx vitest run --config <scratchpad>/w19probe/vitest.probe.config.mjs`
  - Exit 0; `Tests 2 passed (2)`.
  - Row "a host-rejected expectedState on a succeeded action":
    - `"runStatus": "succeeded"`, `"dispatched": ["web.dom.click", "web.dom.extract"]`;
    - the click attempt `"status": "succeeded"`, `"failure": null`, `"comparison": "blocked"`;
    - `asked` was `[[{"assert":{"kind":"url","expected":"/scenarios/auth-gate/account"}}],"all",5000]`.
  - Row "downstream of the proposed fix":
    - `"runStatus": "failed"`, `"runMessage": "Recovery ladder reached LLM diagnosis fallback before a configured provider was invoked."`;
    - `"dispatched": ["web.dom.click"]`;
    - `"failure": {"category":"auth_required","code":"web.auth.required",…}`, `"comparison": "blocked"`, `"recoverySelected": "llm_diagnosis"`.
- **Core tests pinning today's seam.** From `F:\!FluxIQ\packages\fluxiq`:
  `npx vitest run --no-file-parallelism src/programs/automation-studio/runtime/executor/tests/transition-comparison.test.ts src/programs/automation-studio/runtime/executor/tests/node-execution.test.ts`
  - Exit 0; `Test Files 2 passed (2)`, `Tests 15 passed (15)`.
- **Drift check.**
  - `git log --oneline f4268fb..HEAD` and `git diff --stat` over the cited paths
    showed 8 new commits. The ones touching cited files changed
    `gateway-payloads.ts`, `domain/src/client/gateway-mapping.ts` and four
    `packages/test-runner/src/flow-lane` files.
  - Core `5d495eb..267a2ca` changed only `client-gateway/bridge.ts`.
  - I re-anchored every cited line in those files with `grep -n`, for example
    `bridge.ts:230,336,351,585`, `gateway-payloads.ts:58,75`,
    `persisted-flow-run.ts:102,152`, `lane-observation.ts:89,94`.
- **Structure baselines.**
  - Core `.structure-baseline.json:86-88` shows `file-lines` for `service.ts`
    at 6919 and `service.test.ts` at 4789.
  - This repository's baseline `imports` rule holds `domain/src/web-panel-host.ts`
    at 2 and `apps/extension/src/runtime/action-runner.ts` at 1.

## Not verified

- Extension and domain unit tests, the content harness, and the Lab were **not
  run**. I edited nothing, and the brief forbids the Lab. Every test cited is
  from reading.
- Whether Chrome reports auth-gate's `location.assign` commit as `link` and
  `frameId 0`, and whether a download fires no `onCommitted`.
- Whether Core appends the explained `domain_event` after the click's input
  entry in the timeline.
  - The pairing is by sequence number, so order matters only for whether the
    navigation falls inside `following`.
  - If it can arrive first, `following` must be replaced by a window around the
    entry.
- Whether a `web.dom.assert` dispatched by the evaluator returns the client's
  `failure` record through Core's runtime dispatch in a live run. Only
  `evaluate.test.ts:74` covers it, as a unit test.
- Whether the panel's "Generate Subflow" path uses `policyOverride`
  (`service.ts:2498-2519`). That path rebuilds nodes and would drop
  `expectedState`, and so would the node destination (`:5902-5919`).
- **What a Lab run must show.** Record auth-gate, then run it on the Flow lane,
  both unarmed and `expired`, 3 times each, and W10 both ways.
  1. The proposal's click candidate carries exactly
     `{"conditions":[{"assert":{"kind":"url","expected":"/scenarios/auth-gate/account"}}],"mode":"all","timeoutMs":5000}`.
     The timeline holds one explained `web.page.navigated`, with no query string.
  2. W19: `reportedVerdict: "failed"` and `automationFailureReported` of
     `{ category: "auth_required", code: "web.auth.required" }`. The click
     attempt's `comparisonStatus` is `blocked`, and no extract attempt follows.
  3. W18: passed 3 of 3, with the click's `comparisonStatus` `matched` and
     `stateCheckCount 1`.
  4. W10 primary passes. W10 `broken-link` reports `unexpected_state`.
  5. No redaction-attestation leak, and the demo password appears in no record.
  6. No other week1 row changes verdict against the preceding bench.

## Open questions or contradictions found

1. **PB10b understates Core.** The row says "additive `expectedState` … plus one
   lift line". The lift alone changes no verdict (probe row 1,
   `node-execution.test.ts:114-137`). C1 is a Core behaviour change and needs the
   user alerted and its compatibility recorded.
2. **The brief's "attached to that click's recorded event" cannot be literal**:
   the event is sent before its navigation exists. The supervisor chooses the
   link design (recommended, adds `following` to Core's mapper SDK) or the hold
   design (no change to Core's recording-mapper API, but the recorder risk
   described in §1).
3. **The brief asks for a condition "whose failure on a sign-in page the assert
   path reports as AUTH_REQUIRED".** None exists today. E2 is required. The
   `assert.ts:36-43` header's "URL claim carrying a stale selector" edge is not
   this path, because the emitted condition carries no selector.
4. **W10 `broken-link` and W27 `blocked-url` expect `navigation_unexpected` from
   a recorded click, which nothing produces.**
   - A turns W10's missing category into `unexpected_state`.
   - Closing both would take a marker on landing claims, so a failed landing that
     is not a sign-in gate reports NAVIGATION_UNEXPECTED. That is a wire change to
     `WebAutomationAssertRequest`, a separate decision.
5. **Should a rejected expectation honour the action node's
   `failureRoute: "success"`** (`nodes/policy/action.ts:23-31`)? Recorded nodes
   never set it (`service.ts:5855-5859`), so W19 is unaffected, but C1 must pick
   one.
6. **Single-page-app landings** (`pushState`, `admin-console`) are deliberately
   out of scope. Including them would add URL claims to realistic-fixture Flows.

## Follow-up: W10 and W27

Asked by the supervisor after these decisions:
- the link design (E1) is chosen;
- C1 fails a rejected expected state and routes it like any failed attempt,
  honouring `failureRoute`;
- C1, E1 and E3 are in flight, and C2 waits for Core's `service.ts`;
- E2 and D1 wait on this answer.

This follow-up is read-only too. Nothing was edited or run.

### Short answer

- **Recommended: the error-landing rule** (new piece E4).
  - A replayed click that takes its own tab's top document to a page the server
    answered with HTTP 400 or above fails as `NAVIGATION_UNEXPECTED`.
  - It covers **both** rows, because both fixtures deliberately serve a real
    error status: W10's retired link is a 302 to a 404
    (`navigation/scenario.ts:54-57,83-85`), and W27's guard answers 403
    (`failure-surfaces/manifest.ts:118-121`, `failure-surfaces/scenario.ts:29`).
  - It needs no wire change, no recording knowledge, and no claim on any click.
- **(a) The landing marker** works for W10 and is small, but it does not reach
  W27, and once E4 exists no week1 row needs it. Defer it to Week 2.
- **(b) A "no navigation" claim: reject.**
  - It needs (a) plus a second, exact-path comparison mode.
  - It adds at least 1 s to every recorded click.
  - It turns missing evidence into a claim, which likely fails W15 and every
    recording whose last click navigates after Stop.
- **(c)** Under the recommendation, E2 stays its own change. If (a) is ever
  taken, the marker and E2 must be one `results.ts` change.
- **A contradiction C1 hits now, whatever is chosen here.** W19 `expired`,
  W10 `broken-link` and W27 `blocked-url` all expect their click to
  **succeed**. Every route that reports their failure fails that click attempt.
  Three manifest amendments fix it (step 1 below).

### The contradiction: the corpus expects these clicks to succeed

- `assertFlowActions` requires an attempt with status `outcome ?? "succeeded"`
  (`flow-lane/expectations.ts:7-10`).
- A variant's expectations are merged shallowly over its workflow's
  (`test-contracts/src/scenario-workflow.ts:91`).
- **W19 `expired`** declares no `actions`, so it inherits
  `[{ web.dom.type, succeeded }, { web.dom.click, succeeded }]`
  (`auth-gate/manifest.ts:56`).
- **W10 `broken-link`** (`navigation/scenario.ts:48`) and **W27 `blocked-url`**
  (`failure-surfaces/manifest.ts:112`) list `{ action: "web.dom.click" }`, which
  defaults to `succeeded`.
- Under C1 the click attempt is `failed`, and E4 also fails it. So:
  1. `run-flow-lane.ts:122-128` publishes the observation, category included.
  2. `assertFlowFailure` passes at `:129`.
  3. `assertFlowActions` throws at `:130`: "The Flow did not produce a
     web.dom.click action with outcome succeeded".
- `v-failure-surfaces` open question 2 predicted exactly this, and named the
  fix: `outcome: "failed"`.
- Precedent: W27's `disabled` and `detached` variants already declare it
  (`failure-surfaces/manifest.ts:91`).
- I did not trace how the bench scores a run whose category matches but whose
  actions assert then throws.

### (a) The landing marker

**The change.** `WebAutomationAssertRequest` (`domain/src/actions/types.ts:172-176`)
gains `landing?: true | undefined`, meaning "this URL claim is where a recorded
action landed".
- If a landing claim does not hold, the page reports `NAVIGATION_UNEXPECTED`,
  which the code's own definition covers: "The browser landed somewhere other
  than the requested URL" (`runtime/failure/codes.ts:36-37`).
- On a sign-in gate, `AUTH_REQUIRED` still wins.

**Every file it touches.**

Domain:
1. `actions/types.ts:172-176`: the field.
2. `actions/schemas.ts:122-131`: a `landing` property in `assertSchema`.
3. `client/gateway-action-parameters.ts:157-164`: `assertRequestValue` rebuilds
   the request field by field. Without `landing` here, the marker is dropped on
   the wire and the change lands inert.
4. `runtime/expectation/conditions.ts:23-28,66-87,95-106,113-122`: carry the
   marker into the condition, the dispatched payload, and the description.
5. D1's new builder: emit `landing: true`.
6. `runtime/failure/classify.ts:89-91`: this fallback names STATE_MISMATCH for
   a failed assert that carries no record. `results.ts` always attaches one, so
   the fallback is unreachable for this path. Mirror the rule or say why not.
7. Tests:
   - `client/tests/gateway-command-parameters.test.ts`: a landing row;
   - `runtime/expectation/tests/conditions.test.ts`: extend `:31`, `:71` and `:76`;
   - `actions/tests/schemas.test.ts`;
   - D1's tests.

Extension:
1. `content/action-runtime/results.ts:238-243` `unobservedOutputCode`: a
   landing claim gets `NAVIGATION_UNEXPECTED`. E2's `authGateFailure` branch
   (`:270-276`) then replaces it on a sign-in gate inside `buildResult` (`:384`).
2. `content/actions/assert.ts:1-56`: the header's "a claim that does not hold is
   STATE_MISMATCH" gains the landing exception (comment only).
3. `content/actions/tests/assert.test.ts:70-76`: `builtFailure` restates
   `unobservedOutputCode`, so it must restate the landing rule. Add a row.
4. `e2e/content/tests/check-assert.spec.ts`: a landing row on failure-surfaces
   reports `navigation_unexpected`. The unmarked URL row at `:296-313` stays
   `state_mismatch` as the control.
5. `e2e/content/tests/failures.spec.ts` "on auth-gate" (`:114-156`): a landing
   claim on the sign-in page reports `auth_required`, which proves the precedence.

Unchanged:
- `shared/protocol.ts:422`, `content/types.ts:35` and
  `content/actions/types.ts:32` only re-export the type.
- `assertion-evaluation.ts`.
- `page-identity.ts:111-118`, which already never replaces
  NAVIGATION_UNEXPECTED.

Docs: `docs/architecture/failure-taxonomy.md:27,138` and
`docs/architecture/web-capabilities.md`.

Core: none. Core hands conditions to the host unread (`conditions.ts:3-6`,
`transition-comparison.ts:123-127`). `packages/test-runner` and
`apps/scenario-lab` build no assert requests.

**Blast radius on every week1 row.** Only claims D1 emits carry the marker, and
D1 emits them only for clicks with a linked explained navigation.
- **W10 primary:** holds, no change.
- **W10 `broken-link`:** lands on `/scenarios/navigation/link-retired`, reports
  `navigation_unexpected`, and C1 fails the click. The actions contradiction
  above applies.
- **W18:** holds.
- **W19:** reports `auth_required` through E2's precedence, as already designed.
- **W27 `blocked-url`:** no claim, because its recorded click saw no commit.
  **(a) does not reach W27.**
- **W01-W09, W11-W17, W20-W26, W28, and W27's other results:** no landing claim,
  no change.
- Authored URL asserts without the marker are unchanged.

### (b) A "no navigation" claim on clicks whose recording saw no commit

**What it would take.**
- D1 would emit a URL claim naming the click page's path on every recorded
  click with no linked explained navigation.
- The URL outcome is a substring test (`assertion-evaluation.ts:166-167`).
  W27's blocked page `/scenarios/failure-surfaces/blocked` (`render.ts:5`)
  *contains* the recorded `/scenarios/failure-surfaces/`, so a substring claim
  holds and W27 still reports nothing.
- So (b) needs (a)'s marker **and** an exact-path mode: a second wire field,
  plus `assertion-evaluation.ts`.

**Time.**
- Every such click adds an assert dispatch, and each dispatch first waits for
  `waitForTabReady`, which demands 1 s of URL stability
  (`action-runner.ts:74`, `automation-tab.ts:109-120`).
- There are roughly 30 such clicks per Flow-lane week1 pass, so at least 30 s
  per pass, times 3 repeats.
- A failing claim polls its full 5 s.

**False reds, where the recording saw no commit but replay legitimately
moves.**
- **W15 primary:** `open-order-details` opens a new tab (`list-page.ts:37`).
  The runtime re-reads the active tab before each command
  (`server-command-channel.ts:166-169`), so the claim is likely judged on the
  details tab, whose path differs, and fails a row that should pass. Not
  verified: it depends on whether the new tab takes focus.
- **Delayed navigations.** A click whose navigation starts after the 5 s window
  gets a stay claim that fails on replay. So does a last click whose commit
  arrives after Stop, or before Stop but inside the 250 ms debounce, because E1
  records nothing for it.
- **Single-page-app routes**, excluded from E1 by decision. `admin-console`'s
  `open-customer` (`client-script.ts:102`) would get a stay claim and fail on
  replay. That is not a week1 row, but it is a realistic fixture.

**Cost only, no false red.**
- W16 (a download leaves the URL alone; that no commit fires is not verified).
- W17 (`preventDefault`).
- W28 (frame clicks; the claim addresses the top frame, which does not move).
- W01, W09, W12-W14, W20-W26, and W27 primary.

**Not reached:** W27 `disabled` and `detached`. Their click fails first, and C1
evaluates only succeeded attempts (`transition-comparison.ts:102`).

**W27 `blocked-url`:** with exact paths, it reports `navigation_unexpected`.

**Verdict: reject.** The cost is spread over nearly every click, for one row.

### Something narrower for W27: what the blocked page itself does

**Why it has to be in the background.** The content script cannot see the
landing:
- a link's post-condition only claims the navigation *began* (`click.ts:67-79`);
- W27's control is a button, judged by the hit test (`click.ts:81-93`);
- the frame is torn down before the landing exists (`page-identity.ts:28-32`).

**E4, the error-landing rule, around the click the background already sends**
(`action-runner.ts:74-76`, `runActionInFrame` `:197-220`):
1. **New module `apps/extension/src/runtime/click-landing.ts`.** Before a
   `web.dom.click` is sent, it listens to `chrome.webNavigation.onBeforeNavigate`,
   `onCommitted` and `onErrorOccurred` for that tab's frame 0.
   - The permission is already declared (`manifest.chrome.json:16-24`,
     `manifest.firefox.json:14-21`).
2. **If the result comes back `succeeded` and no top-frame navigation has
   started,** wait a short grace (about 300 ms) for one, then return the result
   unchanged.
3. **If one started,** wait for `onCommitted`, or for `onErrorOccurred`, which is
   how a download ends without a commit. Then call `waitForTabReady`, and read
   the landed document's status with
   `chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func })`.
   - `func` returns `performance.getEntriesByType("navigation")[0]?.responseStatus`.
   - `scripting` is already used for reinjection
     (`action-runner.test.ts:157-165`).
   - The page-side read mirrors `content/evidence/navigation.ts:42-49`.
4. **If the status is 400 or above,** return the click as `failed` with
   `navigationUnexpectedFailure(expected, actual)` (`action-results.ts:97-98`).
   - `expected` is "the page the click leads to loads"; `actual` is "it was
     answered with HTTP 403".
   - No URL text goes in the record (the `page-identity.ts:49-52` rule).
5. **If no status is available** (Firefox has no `responseStatus`), the result
   is unchanged. It fails safe.
6. **`action-runner.ts` gains one call** around the send. E3 owns that file now,
   so E4 is serial after E3.

**What then reports the failure.**
1. The click attempt fails with `navigation_unexpected`, and C1 does not evaluate
   its expected state (`transition-comparison.ts:102`).
2. The graph run stops (`graph-run.ts:125-145`).
3. The Flow lane reports `navigation_unexpected` (`persisted-flow-run.ts:102,152`).

**Blast radius on every week1 row.**
- **W10 primary:** 200, unchanged. The wait for the landing moves from the next
  step into the click.
- **W10 `broken-link`:** 302 then 404, so `navigation_unexpected`. D1's landing
  claim is never evaluated.
- **W27 `blocked-url`:** 403, so `navigation_unexpected`.
- **W27 primary, `disabled`, `detached`:** no navigation, or the click fails
  first. Unchanged.
- **W18:** 200, unchanged. **W19:** `/account` answers 302 to a sign-in page
  served 200, so unchanged, and `auth_required` still comes from D1 and E2.
- **W15 primary and `popup-blocked`:** navigation in another tab, or none.
  Filtered out by tab id.
- **W16:** the download aborts without a commit, so unchanged (not verified live).
- **W17:** `preventDefault`, so the grace only.
- **W28:** frame navigations have `frameId` other than 0, so ignored.
- **W01, W09, W12-W14, W20-W26:** no navigation, so the grace only.
- **W02-W08, W11:** no recorded click, unaffected.

**Cost.** About 30 clicks at 300 ms is roughly 9 s per pass.

**False-red exposure.** Only a click that legitimately lands on an HTTP error
page, and no week1 row does. A sign-in page served 401 would read
`NAVIGATION_UNEXPECTED` rather than `AUTH_REQUIRED`. That is not a week1 case,
since auth-gate's page is 200.

### (c) Does E2 belong in the same `results.ts` change?

- **Under the recommendation, no.** E2 is one branch in `authGateFailure`
  (`results.ts:270-276`). E4 lives in the background and never touches
  `results.ts`. Dispatch E2 as designed.
- **If (a) is taken, yes, as one change.**
  - `unobservedOutputCode` (`:238-243`) picks NAVIGATION_UNEXPECTED, and
    `authGateFailure` overrides it at `:384`.
  - That precedence is one decision in one file, proven by one pair of harness
    rows: the sign-in page gives `auth_required`, and a page that is not a gate
    gives `navigation_unexpected`.
  - Split across two workers, whichever lands second has no row proving the
    order.

### Recommended route, and the proof each piece needs

1. **Manifests (`apps/scenario-lab`), independent of every in-flight brief.**
   - What changes:
     - `auth-gate/manifest.ts`: the `expired` variant declares
       `actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "failed" }]`.
     - `navigation/scenario.ts:48` and `failure-surfaces/manifest.ts:112`: add
       `outcome: "failed"`.
   - Unit: each fixture's `tests/scenario.test.ts` pins the variant's actions
     (auth-gate's test at `:82` already pins W19's armed facts).
   - Lab: the three variants no longer throw at `run-flow-lane.ts:130`.
2. **E2 as designed**, with no marker.
3. **D1 as designed**, with no marker.
4. **E4, the error-landing rule** (new brief, serial after E3).
   - Files: `runtime/click-landing.ts` (new); `runtime/action-runner.ts` (one
     call); `runtime/tests/click-landing.test.ts` (new);
     `runtime/tests/action-runner.test.ts` (its stub, `:114-174`, gains the
     three `webNavigation` events and `scripting.executeScript` with `func`).
   - Unit rows:
     - a 403 landing gives a `failed` click with `navigation_unexpected`, and the
       record survives `parseAutomationStudioFailureRecord`;
     - a 404 reached after a redirect gives the same;
     - a 200 landing is unchanged;
     - no navigation is unchanged, and returns after the grace;
     - a commit in another tab, or in a subframe, is ignored;
     - `onErrorOccurred` without a commit is unchanged;
     - an unreadable status is unchanged;
     - a failed click, or any other verb, is never watched.
   - Mutation proof: flip `>= 400`, watch the 403 row fail, restore the file
     byte-identical.
   - Content harness: none. The background worker is not loaded there.
   - Lab:
     - W27 `blocked-url` and W10 `broken-link` report
       `navigation_unexpected`/`web.navigation.unexpected`, 3 of 3, with the
       click attempt `failed`;
     - W15, W16 and W28 keep their verdicts, and no other week1 row changes;
     - a click's duration rises by at most the grace.
   - Docs: the producer list at `failure-taxonomy.md:138`.
5. **Deferred to Week 2:**
   - (a), for wrong landings answered 200;
   - `AUTH_REQUIRED` for a sign-in page served with an error status.

**Order.**
1. Step 1 now.
2. E2 and D1 when released.
3. E4 after E3 lands.
4. The Lab after C1, C2, D1 and E1-E4.

### Not verified (follow-up)

- Nothing was run. No scratch probe reaches a background `webNavigation` path
  without a browser.
- That the Lab's Chromium reports `responseStatus` 404 after the fixture's 302,
  and 403 on the blocked page. The field exists from Chromium 109; I did not
  observe it here.
- That W27's click result reaches the background before its synchronous
  `location.href` unloads the page. If it does not, the send rejects, and
  `command-router.ts:29-33` reports ACTION_FAILED. E4 would then also have to
  treat "click send rejected while a top-frame navigation started" as a
  succeeded click and check the landing.
- Whether W15's new tab takes focus. It matters only to (b).
- How the bench scores a negative variant whose category matches but whose
  actions assert throws. I did not trace `evaluate-run.ts` past `:81-96`.

### Open questions (follow-up)

1. **The manifest contradiction is live for W19 as soon as C1 lands.** Decide the
   amendment before C1's Lab proof. The alternative is emitting the landing check
   as its own recorded `web.dom.assert` node, which keeps the click `succeeded`
   but is not "the click carries it".
2. **Is an HTTP status an acceptable failure signal?** It is decided by the page,
   as `authGateFailure` is. A soft 404 (a 200 page carrying an error notice) goes
   unreported, and (a) would cover that for recorded landings.
3. **The click-send-rejected-by-navigation edge** above.

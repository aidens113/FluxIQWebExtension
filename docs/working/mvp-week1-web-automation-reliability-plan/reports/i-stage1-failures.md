# i-stage1-failures — W18's password field, W24's missing failure, W25's category

Worker `i-stage1-failures`, 2026-09-13. Read-only in both repositories. Evidence
comes from the Stage 1 run bundles under `F:\fxlab-runs\stage1\b\`. Code was read
at the pinned commits the runs used: this repository at `16ff729` (worktree
`F:\fxlab\fxlab-16ff729-b`) and Core at `267a2ca` (worktree `F:\fxlab\!FluxIQ`).
HEAD is checked separately, at `4d88d65` here (later than the brief's `1d7d1ab`)
and `0e6d3ac` for Core. I ran no Lab command, built nothing and edited no tracked
file.

Unless marked HEAD, file:line references are pinned (`16ff729` / `267a2ca`).
Every bundle observation below is a single Stage 1 run on a machine with faulty
RAM. Where I infer rather than observe, I say so.

## Outcome

**Done. All three root causes are found. None of them is the one the brief
suspected first, and each run also shows the partial recording loss that
`i-recording-loss` owns.**

- **(a) W18 runs 2 and 3: the Flow ran on the wrong page.** The Flow lane
  returns the browser tab to the scenario's start page only when a variant is
  armed. W18 has no variant, so the Flow started on the account page where the
  recording ended. That page has no password field. The sensitive control's
  identity was **not** withheld: the node carried a selector (`#password`), a
  point and a fingerprint, and there was simply nothing to match.
  - Separately, in both runs the username step is missing from the Flow. That is
    recording loss.
- **(b) W24 `unannounced`: nothing in the Flow can observe the missing result.**
  The generated Flow holds only typing and a click. The mapper emits no wait
  node and no expected-state claim, and Core's only `output_not_observed`
  producer checks that the click was *echoed*, not that its *effect* appeared.
  - The component that should report the failure is the submit click's
    post-condition ("the result appeared").
  - No mapper can build that claim from today's recording: a mutation event
    carries only counts, and Core compacts snapshots away before the mapper sees
    anything.
  - The W24 manifest also contradicts every possible producer (see Open
    questions 1 and 2).
- **(c) W25 `too-slow` run 3: `target_not_found` because there is no wait node.**
  The Flow was one click on the late button. Replayed target resolution is
  synchronous, so the click failed at once as `target_not_found`.
  - `timeout` can only come from a `web.dom.wait_for_selector` node. No component
    ever generates one from a recording.
  - Run 3 also lost its first recorded click ("Load content"). That is recording
    loss.
- **Left to `i-recording-loss`:** W18 run 1 and W25 runs 1-2 lost whole
  recordings (already named in the brief).
  - The partial loss is the same in W18 runs 2-3, W24 runs 1 and 3, and W25
    run 3: **the first recorded action is the one missing**. Details are under
    "The recording loss inside these runs".
- **HEAD does not fix any of the three.** The lane-observation fix (`a4564c5`)
  fixes how these runs are *filed*. The short-proposal check (B1, also
  `a4564c5`) would now stop W18 runs 2-3 and W24 runs 1 and 3 before their Flow
  runs, which hides (a) behind the recording loss. See "What HEAD changes".

## What changed and why

Nothing in either repository. I wrote only this report, and created no scratch
files.

## Findings

### (a) W18 runs 2 and 3 — what resolution saw

**Evidence, run 2 (`run-mtzhk4a3-3dba04fe`).** Run 3 (`run-mtzhlxiu-4b7622fa`)
is identical in every point below.

1. `snapshots/flow-lane.json`:
   - `candidateCount: 2`, and one action ran: `web.dom.type` `failed`.
   - `expected`: `an element matching selector #password, visual target 421,158 (refused main scoring -0.17), element fingerprint`.
   - `actual`: `nothing matched; 0 control(s) of the same family are on the page`.
2. The failure screenshot is `screenshots/failure-0f735216cf74.png`. Its
   SHA-256, `0f735216…`, is **byte-identical** to `00011-0f735216cf74.png`,
   captured at `step.start` of `account-loaded` during the recording (events
   seq 11 and 20). I opened the image. It shows "Signed in as demo.user", "Your
   account" and the account summary: the protected account page, still showing
   the recording's session.
3. `run.json`'s own timeline shows no page load between the recording's end
   (seq 16, 07:22:28.770Z) and the Flow's failure (seq 20, 07:22:49.371Z).
4. Declared-secret pairing worked. Seq 19 carries
   `"declaredSecrets":["auth-gate-password"]`, and the run did not fail
   `fixture.invalid` (`declared-secrets.ts:155` would have).

**What resolution saw.** On the account page (`auth-gate/pages.ts:54-79`) there
is no `input` of any kind: only a "Sign out" button.
- `#password` matched nothing.
- The point 421,158 lands in `main`, which is refused at -0.17.
- The family of text-entry controls is empty, hence "0 control(s) of the same
  family".
- The node carried all three strategies, so **identity was not withheld**; it
  had no page to match on.

**Root cause (test-runner).**
- `flow-lane/run-flow-lane.ts:78-79` resets the fixture's server-side state and
  then calls `input.armVariant()` only `if (input.workflow.variant)`.
- The callback that callback runs, `run-scenario.ts:301-314`, is the **only**
  place the Flow lane reloads the page: `openScenarioStart(page, …)` at `:308`.
- An unarmed Flow-lane run therefore starts wherever the recording left the tab.
- For auth-gate that is `/scenarios/auth-gate/account`: the sign-in click
  navigates there (`pages.ts:44`), and the reset does not reload the page, so
  the stale DOM stays.
- The lane's own documentation (`reset-scenario-lab.ts:6-11`) says the reset
  exists so "the Flow is judged against state it produced itself". For an
  unarmed run, the missing reload defeats that.

**The same defect in step 4b (inference).** A basic-form 2-candidate run (Stage 1
A run 4, `run-mtzhk2zd-6a6b4624`) has `failure-c20570052007.png` equal to the
recording's last capture `00012-c20570052007.png`. So W01 Flows also run on the
recording's leftover page. They pass there because the form stays usable. I did
not open that image.

**Why two candidates.** No username node ran before the password node, and
candidates are in timeline order. The username step is therefore absent from the
Flow, although the extension counted `web.element.input_changed: 2` (seq 18
`recordedEvents`). The second candidate cannot be seen in the bundle; it is most
likely the sign-in click. This is recording loss (see below). Once the start page
is fixed, W18 still fails its final state until the username entry survives.

### (b) W24 `intermediate-state` `unannounced` — who should report `output_not_observed`

**Evidence.**

| Run | runId | candidateCount | Flow actions (all `succeeded`) | Failure screenshot shows |
| --- | --- | --- | --- | --- |
| 1 | `run-mtzhs5q8-9c0d5da1` | 2 | type, click | Start form, "Employee name" **empty**, amount `42.50`, error "Enter your name and an amount such as 42.50." |
| 2 | `run-mtzhu41z-76f6a4fc` | 3 | type, type, click | "Confirm your claim" step with checkbox and Continue (the armed step) |
| 3 | `run-mtzhweg9-d6e4dbbd` | 2 | type, click | Same hash as run 1 (`300122b4…`) |

- In every run, `flow-lane.json` has `"failure": null` and `"status": "succeeded"`.
- `assertFlowFailure` threw `The Flow reported no structured failure, expected output_not_observed` (`flow-lane/expectations.ts:34-36`).
- W24 is armed, so `armVariant` did reload the start page. That is why these pages are fresh, unlike W18's.
- Runs 1 and 3 are also missing the first recorded type (employee name). The Flow typed only the amount, and the page's own validation refused the submit.
- Run 2 has a complete Flow and still reports nothing. That is the real W24 defect.

**Every place a failure could have come from, and why each was silent:**

1. **A wait node.** None exists. The domain mapper, `web-panel-host.ts:115-120`,
   maps each entry through `webAutomationRecordedAction`.
   - A `dom.mutation` becomes the non-executable event `web.dom.mutated` (`io/input-model.ts:55`), with no output.
   - Nothing in domain or pinned Core maps any entry to `web.dom.wait_for_selector`. A grep of Core `automation-studio` source for it returns nothing.
   - The runner's `waitForState` step (`await-result`) is a Playwright step, and the extension does not record it.
2. **An expected-state claim on the click.**
   - The mapper's `candidate(...)` (`web-panel-host.ts:136-138`) sets no `expectedState`.
   - Pinned Core's candidate type has no such field.
   - Even when a node has one, pinned Core left the attempt `succeeded` (`i-w19-expectation.md` §3).
3. **Core's output confirmation.**
   - Each candidate carries `expectedConfirmation: { inputId: <its own source input>, timeoutMs: 5000 }` (`web-panel-host.ts:137`).
   - Core raises `output_not_observed` only when that input never arrives (`runtime/io-policy.ts:113,135`).
   - For a click, that input is `web.user.element_clicked`, which the replayed click itself produces, so it is satisfied whether or not the result appears.

**Which component should have reported it.** The submit click's post-condition
should: "after this click, the result region appears". The taxonomy agrees:
`OUTPUT_NOT_OBSERVED` "means an action ran without its effect appearing"
(`content/actions/assert.ts:5`). The extension already uses it for a non-assert
verb whose post-condition failed (`content/action-runtime/results.ts:239-243`,
`domain/src/runtime/failure/classify.ts:90`).

**Why nothing can build that claim today:**
- The recorded `dom.mutation` payload is four counts with no identity:
  `{ added, removed, attributes, text }` (`content/recorder.ts:25-38`).
- The element-level "what changed" diff lives in snapshots
  (`content/evidence/changes.ts:1-19`). Core drops `state_checkpoint`,
  `client.state_snapshot` and `client.state_update` before the mapper
  (`runtime/service/recordings/timeline.ts:7-13`, used at `service.ts:2388`).
- The mapper therefore has no name for `claim-result`.

**Two further obstacles:**
- A wait node would report `timeout`, not `output_not_observed`
  (`content/actions/wait-for-selector.ts:30-33` → `results.ts:219`).
- A claim rejected by the domain evaluator reads `TIMEOUT` or `STATE_MISMATCH`
  (`domain/src/runtime/expectation/evaluate.ts:147`), or Core's
  `expected_state_missing` when there is no record (HEAD Core `6f172b9`).

### (c) W25 `delayed-ui` `too-slow` run 3 — why `target_not_found`

**Evidence (`run-mtzi1vgu-d40300bd`).**

1. `flow-lane.json` shows `candidateCount: 1` and one action,
   `web.dom.click` `failed`, `target_not_found`, with:
   - `expected`: `an element matching selector [data-testid="late-action"], visual target 303,146 (refused div[data-testid="late-content"] scoring -0.44), element fingerprint`;
   - `actual`: `nothing matched; 1 control(s) of the same family are on the page; best scored -0.29`;
   - `harnessActivations: 2`.
2. The failure screenshot `failure-b0c3c566239c.png` equals the fresh start page
   capture `00001-b0c3c566239c.png`: "Delayed UI" with only "Load content". The
   recording ended with "Late action" visible (`00006-ece1cd2f4fce.png`, opened).
3. `runtime.settle` (seq 10): the extension counted
   `web.element.clicked: 2, web.dom.mutated: 1, web.tab.state_changed: 1`, but
   Core's recording held `entryCount: 3`, with "Compacted 1".
4. `core.log`: `run-runtime-session 200 in 7211ms`.

**What happened.**
- The Flow lane armed `too-slow` and loaded the start page.
- The Flow's only node, the late-action click, ran at once:
  - there is no "Load content" click (lost) and no wait node (never generated);
  - replayed resolution is synchronous (`content/action-runtime/resolve-target.ts:188`, no wait) and threw `TARGET_NOT_FOUND` (`:460`);
  - the "1 control of the same family" is the "Load content" button.
- Core's harness retried twice. The late content could never appear, because
  nothing clicked "Load content".

**Root cause for the category.** Even with "Load content" present, the Flow would
be [click, click]. The late-action click would still fail `target_not_found`,
because the 20 s reveal is longer than any replay latency.
- The variant is written for a wait node: `SLOW_REVEAL_DELAY_MS = 20_000` is
  "twice the content script's 10,000 ms default"
  (`delayed-ui/scenario.ts:16-25`, `waits.ts:17`).
- It expects `web.dom.wait_for_selector: failed` and `timeout`
  (`scenario.ts:49,51`).
- As in (b), no component generates that node from a recording.
- A wait node would give exactly what is expected: `wait-for-selector.ts:30-33`
  returns `timed_out`, and `results.ts:219` gives `web.action.timeout`.

**The unarmed rows fail the same way.** The unarmed W24 and W25 Flow-lane rows
also expect `web.dom.wait_for_selector: succeeded`
(`intermediate-state/scenario.ts:45`, `delayed-ui/scenario.ts:41`). The bench runs
every unarmed row on the Flow lane too (HEAD `bench/corpus/week1.ts:16-18`), so
those rows cannot pass `assertFlowActions` (`expectations.ts:7-19`) either.

### The recording loss inside these runs (for `i-recording-loss`)

| Run | Missing from the Flow | Extension counted | Core entries |
| --- | --- | --- | --- |
| W18 run 1 `run-mtzhikvr-07c3f403` | everything | 5 events | 0 |
| W18 runs 2, 3 | the username type (the first recorded action) | `input_changed: 2` | 12 |
| W24 runs 1, 3 | the employee-name type (the first recorded action; screenshot shows the field empty) | `input_changed: 2` | 6 |
| W25 run 1 `run-mtzhyfd7-b2183105` | everything but one observation | — | 1 |
| W25 run 2 `run-mtzi00es-c9f0e565` | everything | — | 0 |
| W25 run 3 | the "Load content" click (the first recorded action) | `clicked: 2`, 4 events | 3 |

**The pattern: the earliest recorded action is the one lost.**
- `proveCoreActionRoundTrip` types into a separate Core-opened tab that it closes
  *before* recording starts (`run-scenario.ts:445-471`), so the probe is not the
  missing entry.
- A lead I did not verify: the runner waits only for the extension's local
  `recordingState === "recording"` (`run-scenario.ts:261-268`).
  - The extension begins recording **locally** when Core has not answered
    within 750 ms (`background/connection/recording-start/handshake.ts:7-10,28`).
  - Under load, the first entries may therefore go out before Core's recording
    exists.

## What HEAD changes (`4d88d65`, Core `0e6d3ac`, and running work)

- **The start-page defect (a) is unchanged at HEAD.**
  - HEAD `run-flow-lane.ts:93` still reads `if (input.workflow.variant) await input.armVariant();`.
  - HEAD `run-scenario.ts:320-327` is still the only reload.
  - The uncommitted `run-scenario.ts` diff (`g-run-scenario-followups`) touches only the discard reads and the workspace scan.
- **`a4564c5` (D1/D2, B1).**
  - These runs' `evaluation.json` read `lane: "recording"`, `flowCreated: null`, and for W18/W25 `automationFailureReported: ambiguous_or_unknown`. At HEAD the lane observation is published before any assert (HEAD `run-scenario.ts:333-337`), so they would read `flow` and the category Core reported.
  - B1 (`flow-lane/recording-flow-proposal.ts:68,84-93`) now fails a proposal short of the pinned executable counts as `recording.contract`:
    - W18 pins 3 (`auth-gate/manifest.ts:55`), so runs 2-3 stop there and the wrong-page defect would stay hidden;
    - W24 pins 3 (`intermediate-state/scenario.ts:41`), so runs 1 and 3 stop there, while run 2 (3 candidates) still reports no failure;
    - **W25 pins no executable count** (`delayed-ui/scenario.ts:40`), so B1 does not catch run 3's 1-candidate proposal.
- **`ba4a17b` (resolver corroboration, CS1d).** No effect on these three. There
  is nothing to match on W18's page or W25's.
- **W19 chain:**
  - landed: E1 (`d124b04`, `4d88d65`), E2 (`85a7e21`), E3 (`1acea4c`), Core C1 (`6f172b9`);
  - running: Core C2 (`w19-c2`);
  - queued: D1.

  After D1, W18's sign-in click carries a URL claim for
  `/scenarios/auth-gate/account`. That only matters once W18 starts on the
  sign-in page. D1 emits URL claims only after a linked navigation, so W24 and
  W25 get nothing (`i-w19-expectation.md` §4: "W20-W26 … None").
- **C1 (`6f172b9`)** is the executor half any W24 claim needs. A rejected
  expected state now fails the attempt, with `expected_state_missing` when the
  host gives no record (HEAD Core `transition-comparison.ts`).
- **`w19-e4`** (uncommitted `apps/extension/src/runtime/click-landing.ts`) judges
  only landings served with HTTP 400 or above. W18's account page is 200, and
  W24/W25 do not navigate, so no category changes. Every click that commits
  nothing gains its start-grace wait.
- **Core `0e6d3ac`.** The `io-policy.ts` change is trace wording for
  no-candidate targets. Its late-domain-event refusal (`bridge.ts`) belongs to
  `i-recording-loss`.
- **Live Core** has 4 uncommitted lines in `nodes/importer-sdk.ts` and
  `runtime/recording-flow-proposal.ts` (`w19-c2` in progress). I did not inspect
  them.

## Fix design, partitioned by file

### F1 — the Flow lane always starts on the start page (test-runner; fixes (a))

| File | Change |
| --- | --- |
| `packages/test-runner/src/flow-lane/run-flow-lane.ts` (HEAD `:93`) | Call the page-preparation callback on every run, not only when a variant exists. Rename `armVariant` to `prepareFlowPage` (or similar), because it now does more than arm. Keep the order: reset, then prepare, then read nodes, then run. |
| `packages/test-runner/src/run-scenario.ts` (HEAD `:320-333`) | Rename the callback. Its body already arms only `if (workflow.variant)` (`:321`) and always calls `openScenarioStart` (`:327`). `pageFacts.afterArm` is `[]` for an unarmed workflow (`packages/test-contracts/src/scenario-workflow.ts:68-70`), so no new check is added. |
| `packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts` (HEAD `:124`) | A new row: an unarmed workflow calls the callback exactly once, after the reset and before `startPersistedFlow`. Mutation: restore the `if (input.workflow.variant)` guard, and the row fails. |

- **Serial after** `g-run-scenario-followups` and `g-single-run-evidence`, which
  both own `run-scenario.ts`.
- Re-run `src/tests/scenario-assertions.test.ts` (`:62-86` pins the page-fact
  call order for a variant run).
- **Blast radius.** Every unarmed Flow-lane row (23 per HEAD `week1.ts:16-18`)
  moves from the recording's leftover page to a fresh start page. That is the
  lane's documented intent, but rows now passing on leftovers (W01 included) are
  re-measured.
- **Unit proof:** above. **Content harness:** none, since the runner is not in
  it.
- **Lab proof:** `lab run auth-gate --flow` shows the Flow's first node running
  on `/scenarios/auth-gate/` (a failure screenshot, if any, is the sign-in form,
  not the account page), and step 4b `basic-form --flow` keeps 4 candidates and
  passes.
  - W18 passing 3 of 3 additionally needs `i-recording-loss`'s fix (the username
    entry) and W19's chain (the click's URL claim).

### F2 — a wait node for a click whose target appeared late (domain, with Core C2; fixes (c), and W24/W25's unarmed `wait_for_selector` rows)

| Where | Change |
| --- | --- |
| Core `nodes/importer-sdk.ts`, `runtime/service.ts` (**`w19-c2`, running**) | The mapper context's `following` (C2). Core already accepts `{ candidates: [...] }` from one observation (`service.ts:2412-2413`), so no further Core change is needed if the mutation entry maps to the wait. |
| Domain: a new focused builder in `domain/src/io/` or `runtime/expectation/` (name it at dispatch), with its `index.ts` barrel; `domain/src/web-panel-host.ts:115-120` | When a `web.dom.mutated` observation reports `added > 0`, and the next executable entry in `following` is a `web.dom.click` with a CSS `selector`, emit a `web.dom.wait_for_selector` candidate on that selector with condition `present` and no `timeoutMs`, so the content default of 10 s applies. Emit nothing for a coordinates-only click, a non-click, or `added === 0`. Add no `imports` baseline entry. |
| Domain tests in that directory's `tests/` and `domain/src/tests/domain.test.ts` | Rows: mutation plus click gives a wait on that selector; `added: 0`, a following type, a coordinates-only click, or no following entry gives none. Mutation proof: drop the builder call. |
| `apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts:40` | Add `{ type: "web.element.clicked", count: 2 }` to `recordingEvents`, so B1 fails a proposal that lost "Load content" instead of letting it run. Adjust the scenario's test. |

- **Blast radius to measure before landing:** any recorded click after a DOM
  addition gains a selector-only wait (modals W12-W14, infinite feed W11,
  validation messages). A drifted selector would then time out in the wait
  before the click's scored resolver is ever tried: W20-W23 and W29
  (identity-drift), W26. Check each fixture for a node addition between recorded
  actions. If any drift row is affected, restrict the rule, for example to
  clicks whose selector did not match at the previous action's snapshot, which
  needs snapshot evidence the mapper does not see. Stop and report instead.
- **Content harness:** none new. The wait verb is covered already.
- **Lab proof:**
  - `delayed-ui --flow --variant too-slow` 3 of 3: Flow actions `web.dom.click:succeeded, web.dom.wait_for_selector:failed`, failure `timeout` / `web.action.timeout`;
  - unarmed `delayed-ui --flow` 3 of 3 with the wait `succeeded`;
  - the identity-drift variants unchanged.

### F3 — W24's producer (needs a supervisor decision; not Week 1-sized)

There is no small fix. The producer is the submit click's post-condition. It
needs all of:

| Where | Change |
| --- | --- |
| `apps/extension/src/content/recorder.ts:25-38` and the protocol type `shared/protocol.ts` `dom.mutation` | Carry a bounded identity for top-level added elements (test id, role, accessible name of a landmark; never text or values), so the mapper can name what appeared. This is a recorded-payload contract change, so the domain event and gateway payload must be synchronized. |
| Domain builder beside D1 in `runtime/expectation/`, `web-panel-host.ts` | With C2's `following`: for a click followed, before the next executable entry, by a mutation that added a named element, emit `expectedState` `{ conditions: [{ assert: { kind: "exists", target: <that identity> } }], mode: "all", timeoutMs: 5000 }`. |
| `domain/src/runtime/expectation/evaluate.ts:145-147` | For a claim evaluated as `transition_comparison` on a non-assert action, choose `OUTPUT_NOT_OBSERVED` instead of `TIMEOUT` / `STATE_MISMATCH`. This mirrors `classify.ts:90` and `results.ts:239-243`. A client record (for example W19's `auth_required`) still wins (`:145-146`). |
| `apps/scenario-lab/src/scenarios/intermediate-state/scenario.ts:60` | The click's outcome becomes `failed`, because C1 fails the attempt, as `g-negative-click-outcomes` did for three other variants. |

- Every row whose clicks add named elements gains a claim. Its blast radius needs
  the same corpus pass `i-w19-expectation` §4 did.
- **Unit proof:** a builder row, an evaluator row for the category, and a
  recorder payload row, each with a mutation.
- **Content harness:** a recorder row showing an added `section[data-testid]`
  named in the mutation payload, with no text.
- **Lab proof:** `intermediate-state --flow --variant unannounced` 3 of 3
  reporting `output_not_observed`, and the unarmed row still passing.

**Rejected alternative:** a trailing wait node for W24. It would report `timeout`
and make W24 indistinguishable from W25.

## Commands run and observed results

Read-only inspection only. There were no builds, tests or Lab commands.

- **Listed** the Stage 1 bundles under `F:\fxlab-runs\stage1\a` and `\b`, and
  the worktrees under `F:\fxlab`.
- **Read in full:** `events.ndjson`, `snapshots/flow-lane.json`,
  `evaluation.json` and `logs/core.log` for W18 run 2, W24 runs 1-3 and W25
  run 3; `review/timeline.json` for W18 run 2; and W18 run 3's `flow-lane.json`
  and events.
- **Opened these screenshots:**
  - W18 run 2 `failure-0f735216cf74.png`: the account page;
  - W24 run 1 `failure-300122b4a9c3.png`: the form, employee name empty;
  - W24 run 2 `failure-5faa06b27bde.png`: "Confirm your claim";
  - W25 run 3 `failure-b0c3c566239c.png`: the start page only;
  - W25 run 3 `00006-ece1cd2f4fce.png`: "Late action" visible.
- **Identical hashes** were read from `events.ndjson` `imageSha256` and from
  the screenshot filenames.
- **`git -C F:\!FluxIQWebExtension log --oneline 16ff729..HEAD`** showed 23
  commits from `12daaad` to `4d88d65`, and `git merge-base --is-ancestor 16ff729
  HEAD` printed `anc=0`.
- **`git -C F:\!FluxIQ log --oneline 267a2ca..0e6d3ac`** showed `0e6d3ac` and
  `6f172b9`. `git diff 267a2ca 6f172b9 -- …/transition-comparison.ts` showed the
  new `EXPECTED_STATE_REJECTED_FAILURE` (`expected_state_missing`,
  `core.policy.expectation_rejected`) and the failed-attempt transform.
- **`git -C F:\!FluxIQ diff HEAD --stat -- packages/fluxiq/src/programs/automation-studio`**
  showed `importer-sdk.ts | 2 ++` and `recording-flow-proposal.ts | 2 ++`.
- **`git diff --stat 16ff729 -- <auth-gate, intermediate-state, delayed-ui>`**
  showed only `auth-gate/manifest.ts | 4` and its test. The W24 and W25
  manifests are unchanged at HEAD.
- **`git status --porcelain -- apps/extension/src/runtime`** showed
  `?? click-landing.ts` and `M action-runner.ts` (`w19-e4`, uncommitted).
- **Greps:**
  - no `wait_for_selector` in pinned Core `automation-studio` non-test source;
  - no domain mapping from any recorded event to `web.dom.wait_for_selector`;
  - Core's only `output_not_observed` producer is `io-policy.ts:135`.

## Not verified

- **That the password node resolves on the sign-in page.** No Stage 1 run
  reached it there.
  - Add or name a content-harness row replaying the recorded shape
    (`#password`, fingerprint of a `type=password` control with its value
    withheld, point) on `auth-gate/` and expecting `resolved` by selector.
  - Lab: W18 `exit=0`, a `#password` type node `succeeded`, zero value hits.
- **That the second W18 candidate is the sign-in click.** It is not in the
  bundle.
- **Why the first entry is lost.** The 750 ms local-start lead is unproven and
  belongs to `i-recording-loss`.
- **Which W25 run 3 entry Core compacted.** I infer it was the tab-state update,
  so the `web.dom.mutated` entry would be mapper-visible, which F2 relies on.
  Core's workspace was deleted after the run.
- **F2's blast radius** on the identity-drift, modal, feed and ambiguous-target
  fixtures. I did not read those fixtures.
- **F1's effect on W01 and the other unarmed Flow rows.** The basic-form
  leftover-page reading rests on one screenshot hash I did not open.
- **Whether W24's unarmed Flow row fails today** on its leftover page (the form
  is hidden after submit, `intermediate-state/scenario.ts:123`). I inferred it;
  no Stage 1 run covered it.
- **Contents of live Core's uncommitted `w19-c2` lines.**

## Open questions or contradictions found

1. **W24's manifest cannot be met by any producer as written.**
   - It expects `{ action: "web.dom.click" }`, which `assertFlowActions` reads
     as `succeeded` (`expectations.ts:9`), together with failure
     `output_not_observed`.
   - A click post-condition (F3) fails the click under C1.
   - A trailing wait gives `timeout`.
   - Either the click outcome becomes `failed` (recommended, with F3) or the
     category changes. That is a supervisor decision.
2. **W24's and W25's unarmed workflows expect `web.dom.wait_for_selector:
   succeeded`**, which no component produces.
   - On the Flow lane both unarmed rows are unreachable today, and the bench
     counts them (HEAD `week1.ts:16-18`).
   - F2 covers W25's unarmed row. W24's needs F3 or a relaxed expectation.
3. **B1 now masks (a).** At HEAD, W18 runs with a lost username stop at
   `recording.contract` before the Flow runs. A Lab run that shows only
   `recording.contract` for W18 therefore says nothing about F1. Prove F1 on a
   run whose proposal has all 3 candidates.
4. **W25 declares no exact click count** (`delayed-ui/scenario.ts:40`), so B1
   cannot see its lost first click (F2's last row).
5. **`l-stage1` open question 2 (W25's command) is confirmed.** HEAD
   `week1.ts:54` is `row("W25", "delayed-ui", null, ["too-slow"])`, and a
   variant runs only on the Flow lane (`:16-18`), so
   `delayed-ui --flow --variant too-slow` is the row.
6. **Overlap with running briefs:**
   - `g-run-scenario-followups` and `g-single-run-evidence` own
     `run-scenario.ts`, which F1 needs, so F1 is serial after both.
   - `w19-c2` owns the Core `following` that F2 and F3 need.
   - `g-target-resolution-union` and `g-bench-evidence-size` share no file and
     no cause with these three.
   - `w19-e4` changes no category here.

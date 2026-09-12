# Report: w2-flow-lane

Worker: `w2-flow-lane`. Brief: `### Brief: w2-flow-lane` in
[briefs/wave-2.md](../briefs/wave-2.md), Phase 1.6a step 4.

## Outcome

**Partial.** The provider-free Flow lane exists and works: a recording becomes
a Flow through Core's public proposal API and that Flow runs and is judged on
the `isolated` target, with `harnessActivations: 0` in every run. Two of the
three definition-of-done Lab commands pass; the third reaches a verdict but
cannot report what the brief asks for, and the reason is a product gap I have
documented rather than papered over.

| Definition of done | Result |
| --- | --- |
| `basic-form --flow --target isolated` generates and runs the Flow provider-free and passes | **Met** (`verdict: "passed"`, exit 0) |
| `identity-drift --flow --variant selector-only` reaches a verdict | **Met** (`verdict: "passed"`, exit 0) |
| `auth-gate --flow --variant expired` reports the structured failure | **Not met.** It reaches a verdict (`failed`) and says exactly why: the Flow reports **no** structured failure, because none of its actions fails. See [Finding 3](#finding-3--w19-cannot-report-auth_required-today). |
| test-runner and test-contracts suites pass | **Met** (388/388 and 53/53) |
| Structure audit clean | **Met** (exit 0, no new finding) |

Two brief items are implemented but unproven, both for reasons outside my
owns: paginated extraction has no fixture that reaches it yet, and the declared
secret has no Core seam that consumes it. Both are in [Not verified](#not-verified).

## What changed and why

### New: `packages/test-runner/src/flow-lane/` (barrel `index.ts`)

- **`reset-scenario-lab.ts`** — `POST /__control/reset`. The lane resets
  between recording and run so a Flow cannot pass on the recording's own
  effects (a submitted form, a signed-in session). It runs *before* the arm,
  because a reset discards the arm.
- **`recording-flow-proposal.ts`** — `createRecordingFlowProposal` and
  `approveRecordingFlowProposal`, over Core's public
  `create-recording-flow-proposals` and `review-recording-flow-proposal`.
  Core builds the Flow; nothing is authored or compiled downstream. A proposal
  with no candidate is refused, since an approved Flow with no action would run
  green having done nothing.
- **`flow-action-types.ts`** — `readFlowActionTypes`, the node-id → output-id
  map. This exists because of [Finding 1](#finding-1--every-recorded-action-shares-one-node-definition-id).
- **`persisted-flow-run.ts`** — `executeRecordedFlowRun`, a **failure-tolerant**
  Flow run. `executeExistingPersistedFlow` throws on a failed action, which
  suits a lane asserting success but destroys the evidence a negative workflow
  needs: its expected failure is the thing under test. Core's structured
  `failure` field is read through Core's own
  `parseAutomationStudioFailureRecord`; no category is ever recovered from a
  message. `harnessActivations` comes from the run detail's interventions.
- **`expectations.ts`** — `expected.actions`, `expected.failure`, and
  `expected.extracted`. A workflow expecting no failure fails on any reported
  failure, so a differently broken run cannot pass.
- **`declared-secrets.ts`** — resolves a declared secret from
  `FLUXIQ_TEST_SECRET_<ID>`, fails closed when unset, and supplies it to the
  Flow run's inputs. Values join the evidence redaction list.
- **`lane-observation.ts`** — the `RunEvaluation` fields only the lane that ran
  can know, for **both** lanes. w1-bench had to infer the oracle verdict from a
  failure category, which cannot tell "the fixture disagreed" from "the rig
  broke before the oracle was reached". The lane now publishes it.
- **`run-flow-lane.ts`** — the order: proposal, approval, **reset**, **arm**,
  read the action-type map, run, record evidence, judge.

### Changed

- **`run-scenario.ts`** — `flow?: boolean`; the Flow-lane block; the oracle
  verdict published rather than inferred; `assertCoreRoundTrip` now returns the
  new recording ids (the Flow is built from exactly the recording this run
  produced, and anything but exactly one is refused); `RunScenarioResult` gains
  `observation`. Also the two fixes in [Findings 2 and 4](#finding-2--a-variant-must-not-be-armed-before-the-recording).
- **`commands.ts` / `cli.ts`** — `--flow` with no value selects the lane;
  `--flow <id>` still names a persisted Flow for existing/clone, told apart by
  whether the next token begins with `--`. `--variant` requires `--flow`, and
  the lane refuses existing/clone targets.
- **`packages/test-contracts/src/{scenario,validation}.ts`** — the smallest
  declaration the brief asks for: `secrets?: ScenarioSecret[]` where
  `ScenarioSecret = { id, step }`, plus its JSON Schema and validator.

## Findings

### Finding 1 — every recorded action shares one node definition id

`appendRecordingProposalToFlow` (Core `service.ts:5843-5874`) turns each
candidate into a node with `definitionId: "builtin.policy.action"` and puts the
real action in `parameterValues.outputId`. The stored attempt record
(`service/summaries/conversions.ts:150-171`) keeps `definitionId` and **drops
the node inputs**, so every attempt of every recorded action reports the same
`builtin.policy.action`. My first run failed against this with all four
attempts succeeding.

The only surviving link is `attempt.nodeId`, so `flow-action-types.ts` joins it
to the Flow's nodes. Approval writes those nodes onto the primary Subflow's
**graph Flow**, not the parent (`proposals/approval.ts:112`), so the map reads
the parent and then every subflow graph.

**This is a latent bug in `existing-flow-run.ts` too**:
`executeExistingPersistedFlow` matches `action.definitionId === expected.action`
(line 98), which can never match a recorded action. w1-runner-asserts recorded
that the existing/clone lanes were never validated live; this is what that
would have found. I did not change it — it is outside my owns.

### Finding 2 — a variant must not be armed before the recording

`run-scenario.ts` armed the variant before the page opened, which is right for
existing/clone (they replay a pre-existing Flow) and wrong for this lane: the
fixture drifted *while the recorder was still recording*, and identity-drift
died with `locator.click: Timeout 30000ms exceeded waiting for
[data-testid="save-changes"]`. Fixed: the Flow lane records unarmed and arms
after its reset. The arm is server-side, so the lane also reloads the page —
otherwise a drift variant is judged against a page that never drifted.

### Finding 3 — W19 cannot report `auth_required` today

`auth-gate --flow --variant expired` builds a 3-candidate Flow (type, type,
click) that runs and **succeeds**. No action fails, so there is no structured
failure to report and the assertion fails honestly.

The cause: after sign-in the fixture reaches the protected page by a
client-side `location.assign`. The domain mapper only makes a navigation
executable when `metadata.transition === "typed"`
(`domain/src/io/input-model.ts`), so the Flow contains **no step that requests
`/account`** — the one request where an expired session surfaces. The
redirect-to-sign-in does happen in the browser, but as page state, not as a
failed action.

So W19's expected category cannot be produced by action results alone. It needs
an assertion step in the Flow (`web.dom.assert`, w2-check-assert) or Core's
expectation evaluator (D10/C3, Phase 1.4). **I did not weaken the assertion to
make it pass**: a run that reports nothing has not reported success, and
tolerating that is the silent no-op Phase 1.2 exists to prevent.

### Finding 4 — the recording lane must be judged unarmed

A single merged workflow was passed to both lanes, so the *unarmed* recording
was judged against the *armed* expectation and auth-gate failed at
`Scenario fact failed: back-on-sign-in` before its Flow ever existed. The
scenario contract is explicit that a variant never changes the recording.
Fixed: the recording lane resolves the workflow with no variant, the Flow lane
keeps the armed one. basic-form and identity-drift hid this because their
variant expectations equal their workflow's.

### Finding 5 — a recorded click is not always a Flow candidate

Four Flow-lane runs of `basic-form`: three produced **5** candidates and
passed; one produced **4** and failed, missing the click, although its
recording contains `web.element.clicked: 1`. The click is recorded and then
dropped on the way to becoming a candidate — `webAutomationRecordedAction`
keeps an event only when its output's required parameters are all non-empty, so
a click whose descriptor carries no usable `selector` is silently not
executable. I did not isolate the cause; it is in the mapper/recorder, outside
my owns. This is a genuine Week-1 reliability defect and the lane now catches
it instead of tolerating it.

### Finding 6 — evidence must be recorded before it is judged

My first version wrote `snapshots/flow-lane.json` after the assertions, so the
one run that needed it had none. The lane now records what the Flow did through
a `recordEvidence` hook *before* judging, and the action-mismatch message names
the attempts observed (action types and statuses are Core's vocabulary, never
page data). Every diagnosis after that point came from this.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`, every Lab command with
`FLUXIQ_TEST_ENV_FILES=none`, **one Lab run at a time, never two at once, none
in the background**. Exit status captured by redirecting to a file and echoing
`$?`, never through a pipe. `.env.local` was not touched.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/test-contracts test` | exit 0 — `# tests 53 / # pass 53 / # fail 0` |
| `pnpm --filter …/test-runner check` | exit 0 |
| `pnpm --filter …/test-runner test` | exit 0 — `# tests 388 / # pass 388 / # fail 0` |
| `node …/cli.js run basic-form --flow --target isolated` | exit 0 — `verdict: "passed"`, `lane: "flow"`, `flowCreated: true`, 5 actions `web.dom.type, keypress, select, type, click`, all succeeded, `harnessActivations: 0` |
| `node …/cli.js run identity-drift --flow --variant selector-only --target isolated` | exit 0 — `verdict: "passed"`, `lane: "flow"`, 2 actions succeeded |
| `node …/cli.js run auth-gate --flow --variant expired --target isolated` | exit 1 — `verdict: "failed"`; Flow built (3 candidates) and ran, all actions succeeded; `The Flow reported no structured failure, expected auth_required` |
| `node scripts/structure-audit.mjs` (scratch git index) | exit 0 — `passed (31 warning(s), 19 baselined)` |

`basic-form` ran four times on the Flow lane: passed, passed, passed, and one
failure (Finding 5), rerun immediately and passed. The `test-runner` suite
failed once on `dist/tests/demo-llm-exploration-request.test.js`, a file I do
not own; rerun once per the concurrency note and it passed (383 → 388 as my
tests landed).

**Structure audit.** Exit 0, no `FAIL`, no new ratcheted finding, and
`pnpm structure:baseline` was **not** run. New files were staged into a **copy**
of the git index (`GIT_INDEX_FILE`) so the audit, which reads only tracked
files, saw them; the real index was never touched. One advisory warning is
mine: `run-scenario.ts` is now 511 lines, past the 400-line advisory (it was
430 before Wave 2 and 484 before my last change). That warning is not ratcheted
and no baseline entry was added or raised, but the file is a candidate for
decomposition.

**The tracked `apps/extension/build/` was never modified** —
`git status --short apps/extension/build` is empty.

## Not verified

- **`pnpm lab run …` itself was never run — deliberately.** See
  [Contradiction 1](#1-the-briefs-dod-command-runs-the-build-the-brief-forbids).
  I ran the built CLI directly, which is the same code path after target
  resolution.
- **Paginated extraction is implemented but unproven.** `assertFlowExtraction`
  compares per extract attempt in order and `extractionCount` is recorded, but
  no fixture reaches it: `web.dom.extract_list` is still w2-foundation's stub
  (w2-extract-list owns the verb), and no recorded event maps to it. The brief
  says paginated extraction is proven only by this lane — the lane is ready, the
  proof is not there yet.
- **The declared secret is supplied but not consumed.** No fixture declares one
  (the auth-gate manifest is in `apps/scenario-lab`, outside my owns), and see
  [Contradiction 2](#2-core-has-no-seam-that-consumes-a-declared-secret).
  The auth-gate runs above therefore replayed the recorded password.
- **`identity-drift` passing is consistent with fingerprint fallback recovery,
  not proof of it.** `selector-only` genuinely removes the recorded test id
  (`save-action.ts` renders `data-testid="settings-submit"`), the lane reloads
  after arming, and the recorded click still succeeded — but `resolution`
  diagnostics are never populated yet (w2-foundation), so I could not observe
  *which* strategy resolved it.
- **Only the `isolated` target.** `persistent-isolated`, `existing` and `clone`
  were not run, and Finding 1's latent bug in `existing-flow-run.ts` is
  therefore reasoned from source, not reproduced.
- **`pnpm check`, `pnpm test`, `pnpm build` at the repository root** were not
  run. `packages/test-runner/src/index.ts` does not re-export `flow-lane/`; it
  is not mine.
- **The bench does not consume `observation` yet.** `RunScenarioResult` carries
  it for both lanes, but wiring `bench/evaluate-run.ts` to prefer it over its
  inference is a one-file change in a file I do not own.

## Open questions or contradictions found

### 1. The brief's DoD command runs the build the brief forbids

The brief says "Do NOT run `pnpm build`: it rewrites one tracked directory",
then names `pnpm lab run basic-form --flow --target isolated` as the definition
of done. `pnpm lab` chains
`… extension test:e2e:build` → `pnpm build` → `build-extension.mjs`, which
`rm -rf`s `build/` (8 tracked files) and `dist/` before rebuilding. The literal
DoD command therefore *is* the forbidden build, and with twelve workers editing
`apps/extension` it is exactly the race that crashed a compiler today.

I ran `node packages/test-runner/dist/cli.js …` instead, building only
`scenario-lab` and `test-runner` and reusing the existing
`apps/extension/dist/e2e-chromium`. **The supervisor should run the literal
`pnpm lab` command once at integration**, when the tree is quiet, to confirm it.

### 2. Core has no seam that consumes a declared secret

A recorded `web.dom.type` carries the typed text as a **literal** node
parameter (`webAutomationOutputPayload` sets `text` from `inputValue`), and the
recorder does not redact passwords yet (Phase 1.4). A Flow run's `inputs` reach
the graph's starting values and node input ports, but a recorded node's
parameters are literals: Core has no parameter templating
(no `resolveNodeParameters`) and no per-node secret reference. So the lane can
*supply* a declared secret to the run — and does — but nothing makes the Flow
prefer it over the recorded literal.

Closing this needs a Core decision (D11): either recorded parameters can
reference a run input/secret, or the recorder must redact at capture and the
proposal carry a reference. Until then the declaration is honest bookkeeping,
not a control. I added the contract field and the lane support the brief asked
for and stopped there rather than mutating the approved Flow downstream, which
the brief forbids.

### 3. A fixture still has to declare its secret

The brief says "auth-gate W18 declares it", but every scenario manifest lives in
`apps/scenario-lab`, which my brief lists under "Must not touch". The contract
field and lane support are in place; a fixture worker must add
`secrets: [{ id: "sign-in-password", step: "enter-password" }]` to the auth-gate
manifest, and the run then needs `FLUXIQ_TEST_SECRET_SIGN_IN_PASSWORD`.

### 4. `--flow` is overloaded

`--flow <id>` (existing/clone) and bare `--flow` (this lane) now share one flag,
told apart by whether the next token starts with `--`. It is tested both ways,
but a separate `--flow-lane` would be unambiguous if the overload ever bites.

### 5. W19's corpus expectation may be unreachable by design

Finding 3 means the `week1` corpus row W19 cannot meet `expected.failure` until
an assertion step or the expectation evaluator lands. Worth deciding whether
W19 is deferred to Phase 1.4 or whether its fixture should make the expiry
surface as a failing action.

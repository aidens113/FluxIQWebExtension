# Finish-Week-1 worker briefs

Briefs for the session that finishes Week 1 of the
[MVP Week 1 plan](../../mvp-week1-web-automation-reliability-plan.md), written
by the senior supervisor agent on 2026-09-12 at `HEAD 99eca80`. Workers read the
plan's `Current State`, the binding rules below, and only their own brief. Paths
are relative to `F:\!FluxIQWebExtension`; report paths are under
`docs/working/mvp-week1-web-automation-reliability-plan/reports/`.

## Binding rules for every worker

- The Wave 3 rules still hold: read "Binding rules for every worker" in
  [wave-3.md](./wave-3.md) (lines 30-64) once. Where a rule here differs, this
  file wins.
- Set `EXTENSION_TEST_BUILD_LABEL=<brief name>`, and `DOMAIN_TEST_BUILD_LABEL`
  when you run domain tests.
- No `pnpm build` and no `pnpm lab` command in this dispatch. The Lab proof for
  these fixes runs in the supervisor's live campaign afterwards, so say under
  `Not verified` exactly what a Lab run must show.
- Content harness, from `apps/extension`:
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 <spec>`.
  The `pnpm --filter @fluxiq-web-extension/extension test:content -- --workers=2 <spec>`
  form also runs the named spec: it ran 12 tests on `select.spec.ts` on 2026-09-13.
- A guard is done only with a mutation proof: break it, quote the failing test,
  restore it, and confirm the file is byte-identical.
- This machine has faulty RAM. A uniform or impossible failure (every test
  failing the same way, an error quoting text the file on disk does not contain,
  exit 3221225477 or 139) is rerun once, alone, before it is reported. A partial
  failure with real assertion diffs is real.
- Never edit `.structure-baseline.json` or run `pnpm structure:baseline`; name
  the entry you believe should change. Never edit FluxIQ Core (`F:\!FluxIQ`).
- Re-verify your item at HEAD first: several items were briefed twice on
  2026-09-12. If it is already settled, prove it with file:line and a passing
  test, then stop.

## c-remaining — inventory of what is still open (read-only)

**Owns:** `reports/c-remaining.md` only. Edit no other file; run nothing heavier
than `git` and search.

**Task.** Mark each item below `Settled` or `Open` at HEAD, with file:line
evidence. For an `Open` item, give the smallest change and every file it would
touch.

1. Every numbered item under "Open work" in the plan's `Current State`.
2. `reports/L-review.md` findings 1-9.
3. `reports/p-openq-triage.md` Part 3 and Band A.
4. Every report under `reports/` whose Outcome is Partial or Blocked.

These six are being fixed in parallel; list them as `In flight` without
investigating: f-adapter-guard, f-evidence-producers, f-connection-split,
f-test-runner-ratchet, f-w18-secret-leg, and Core's trace withholding.

**Done when** one table has a row per item with columns Item, Source, State,
Evidence, Files, Smallest change; then a second list groups the `Open` items by
file and flags every file two items would both touch. Cite reports by section
rather than restating them.

## f-adapter-guard — the disarmed failure-record guard

**Owns:** `domain/src/runtime/adapter.ts`; the test under
`domain/src/runtime/tests/` whose subject it is (create
`adapter-failure-withholding.test.ts` if none fits);
`apps/extension/e2e/content/tests/redaction.spec.ts`.

**Read:** `reports/v-redaction-producer.md` sections 4 and 6.

**Task.** `withholdComparison` treats the client withholding layer's own
`redacted: true` stamp as a producer declaration. As a result, a sensitive
control's failure record `expected`/`actual` is never withheld, whether the
declaration is `undefined`, `false`, or `true`. Make the decision depend on what
the producer declared, not on that stamp, so no state leaks, and keep a genuine
producer redaction honoured.

**Tests.** A unit test that reproduces the report's three-state probe with a
synthetic sentinel, which must be absent in every state; a mutation proof
restoring the old conjunction; the content harness `redaction.spec.ts` green,
including the row the report's neighbours cite at `redaction.spec.ts:310`, if it
still exists.

**Report:** `reports/f-adapter-guard.md`.

## f-evidence-producers — the second page-evidence producer

**Owns:** `apps/extension/src/background/connection/dom-snapshot.ts` and its
test under `connection/tests/`; `apps/extension/src/content/evidence/index.ts`;
`apps/extension/src/content/evidence/present.ts`;
`domain/src/page-evidence/types.ts`.

**Read:** `reports/v-producer-safety.md` "The honest limit";
`reports/v-merge-safety.md` "The one line I do not own".

**Task.** At HEAD, establish whether `dom-snapshot.ts` still writes evidence
through conditional spreads, and whether it imports `present` past the
`content/evidence/` barrel. Close whatever is open, using the remedy
`v-merge-safety` measured as better. The structure audit must pass with no
baseline change.

**Tests.** Extension `check` and `test`. The structure audit, through a scratch
`GIT_INDEX_FILE` if you add files. A mutation proof that renaming a
`PageEvidence` key breaks the compile in `dom-snapshot.ts`.

**Report:** `reports/f-evidence-producers.md`.

## f-connection-split — splitting `background/connection.ts`

**Owns:** `apps/extension/src/background/connection.ts`; new files you create
directly under `apps/extension/src/background/connection/`, and their tests in
`connection/tests/`; `connection/index.ts`. **Not** `dom-snapshot.ts`,
`runtime-status.ts`, or `recording-start/`, which other work owns.

**Read:** `reports/p-connection-split.md`, whole.

**Task.** The collision that blocked this has cleared: the recording-start
handshake has landed. Check whether the four collaborator modules the report
designed were ever committed, re-derive the split against HEAD, keep behaviour
identical, and bring `connection.ts` (764 lines against an 800 limit) well under
the limit, with every structure rule passing.

**Tests.** Extension `check` and `test`, then one full content-harness run at
`--workers=2` at the end. Service-worker restart and WebSocket reconnection
cannot be proven here: name them under `Not verified` for the Lab.

**Report:** `reports/f-connection-split.md`.

## f-test-runner-ratchet — the `src/tests/` directory with no headroom

**Owns:** `packages/test-runner/src/demo-llm-create-ui*.ts`;
`packages/test-runner/src/tests/demo-llm-create-ui*.test.ts`; any new directory
you create under `packages/test-runner/src/` for this feature; the import sites
of the moved module inside `packages/test-runner/src/`, **excluding
`flow-lane/`**. List every file you touch in the report.

**Read:** `reports/p-test-split.md`, whole.

**Task.** `src/tests/demo-llm-create-ui.test.ts` (615 lines) must be split, but
`src/tests/` sits exactly at its `directory-files` ratchet of 51, so any split
fails the audit. Move the feature into its own directory with its own `tests/`
folder, so the split lands and `src/tests/` shrinks. Count tests and assertions
before and after; every one survives.

**Tests.** Test-runner `check` and `test`. The structure audit through a scratch
`GIT_INDEX_FILE`, quoting the directory's new count and no new failure.

**Report:** `reports/f-test-runner-ratchet.md`.

## f-w18-secret-leg — letting auth-gate's password replay

**Owns:** `domain/src/io/input-model.ts`, `domain/src/client/gateway-mapping.ts`,
and their tests under `domain/src/io/tests/` and `domain/src/client/tests/`;
`packages/test-runner/src/flow-lane/run-flow-lane.ts`,
`packages/test-runner/src/flow-lane/declared-secrets.ts`, and their tests under
`flow-lane/tests/`.

**Read:** `reports/p-secret-binding.md` "Open questions" findings 1-3, which
include edits 1-3; `reports/p-declared-secrets.md` Outcome.

**Context.** Finding 1's Core link is done. Core `368b3c9`, together with a
trace-withholding change the supervisor is committing, resolves
`{ $state: { path } }` at any depth of `parameterValues`, reading `path` as a
flat key of the run's `inputs` and `variables`. It also withholds every resolved
value from the persisted trace.

**Task.** None of edits 1-3 had landed at HEAD: `input-model.ts` and
`gateway-mapping.ts` do not use `webAutomationSecretBindingPath` or
`webAutomationUnresolvedSecretParameters`, and `run-flow-lane.ts:88` keys inputs
by secret id only. Land all three as the report specifies. The run must fail when
node binding paths and declarations do not pair exactly one-to-one. A rejection
message carries parameter names and paths only, never a value.

**Tests.** A unit test and a mutation proof for each edit, and a test-runner test
that the lane's run inputs carry the declared value at the node's binding path.
W18's replay is Lab-only: state what that run must show.

**Report:** `reports/f-w18-secret-leg.md`.

## Read-only investigations dispatched alongside the fixes

The next three edit nothing but their own report, in either repository. They may
run narrow unit tests and scratch probes outside the tree, and no Lab command.
Each report ends with a fix design **partitioned by file**, naming Core files
separately, with the unit, content-harness and Lab proof each change needs. The
files the six briefs above own may be read, but may change under you.

## i-resolver-safety — why the resolver acts wrongly or not at all

**Owns:** `reports/i-resolver-safety.md` only.

**Read:** the plan's `Current State` "Still open" and Open work item 2;
`reports/L-review.md` finding 1; `reports/L-veto-recordings.md`;
`reports/L-replay.md` findings 3-4; `reports/v-matcher-calibration.md`;
`reports/p-openq-triage.md` Group 1; decisions D13 and D14 in the plan's
`Decisions` section or its archive.

**Task.** Establish the root cause of each, at HEAD, with file:line:
(a) on production-shaped recordings the resolver picks a different action and
reports success, 0.633 against a 0.35 floor; (b) live, the element-target floor
sees `unresolved_no_candidates`, `candidateCount 0`, on every dispatch;
(c) live, `reworded-aria` refuses at confidence 0.173. Say whether D14
overstates the veto margin, and whether (b) is a wiring defect rather than a
calibration one. Scoring changes belong in Core (D13).

## i-flow-lane-errors — the Flow lane's missing action and opaque failure

**Owns:** `reports/i-flow-lane-errors.md` only.

**Read:** Open work item 1; `reports/L-dropped-action.md`, `L-race-fix.md`,
`L-core-discard.md`, and `L-replay.md` "defects".

**Task.** At HEAD, with file:line: (a) confirm the race fix is committed, what
its unit proof covers, and the exact Lab command and pass condition for the
24-run reproduction; (b) the root cause of a failing Flow-lane run surfacing as
an unexplained runner error, and the fix; (c) what the 30-day plan and the Core
contract say about a late recording event reaching the client, and a
recommendation, quoting the plan text that settles whether it is Week 1 scope.

## i-lab-campaign — the schedule for every Lab run still owed

**Owns:** `reports/i-lab-campaign.md` only. A scratch `git worktree` outside
both repositories is allowed if you remove it afterwards.

**Read:** `live-validation-plan.md` beside the plan; the plan's `Current State`
exit-criteria table; `reports/L-lab-concurrency.md`; `reports/v-bench-honesty.md`.

**Task.** For each exit criterion, list the Lab runs that prove it: command,
expected observation, duration, and which in-flight brief above it depends on,
if any. Then establish whether a Lab run can execute from a git worktree at
`HEAD` while the main tree is being edited (check how FluxIQ Core is linked,
what `pnpm install` and the Lab build need, where run artifacts land), and
produce a concurrency schedule bounded by this machine's RAM. Settle from the
30-day plan's text whether Week 1 requires Firefox.

---

# Second dispatch, from the `c-remaining` inventory

Written after `b43a46a`. Row IDs (LR7, B5, CS1f, ...) are rows of the table in
`reports/c-remaining.md` "The inventory"; read your rows there first, and
re-verify them at HEAD. The binding rules above still hold, plus:

- These files belong to a worker still running; do not edit them:
  `apps/extension/src/background/connection.ts`, `connection/index.ts` and any
  `connection/` file created since `b43a46a` (`f-connection-split`).
- `f-w18-secret-leg`'s changes to `input-model.ts`, `gateway-mapping.ts`,
  `run-flow-lane.ts`, `declared-secrets.ts` and their tests are verified but
  may still be uncommitted: build on them, never revert them.
- `apps/extension/e2e/content/tests/actions.spec.ts` is supervisor-only (C4).

## g-snapshot-evidence — LR7 and LR8

**Owns:** `apps/extension/src/background/connection/dom-snapshot.ts` and
`connection/tests/dom-snapshot.test.ts`; `domain/src/recording/web-state/types.ts`;
`domain/src/recording/web-state/evidence/input.ts`; test fixtures under
`domain/src/recording/` or `connection/tests/` that cast to the two local types
LR8 deletes (list each in the report). **Not** `apps/extension/src/shared/protocol.ts`,
which `g-recorder-signals` owns: if LR8 needs it, stop and report.

**Task.** LR7: the fallback merge path drops the top frame's additive evidence;
apply the table's smallest change. LR8: join the page-evidence contract at its
top-level key, as the table says, and delete the two local restatements and
their casts.

**Tests.** LR7: a test in which the frame list omits frame 0, shown failing
before the fix, with a mutation proof. LR8: after the change, renaming
`evidence` on the domain type breaks the compile in both former restatement
sites (quote both errors, then restore). Extension and domain `check` and `test`.

**Report:** `reports/g-snapshot-evidence.md`.

## g-recorder-signals — B5, a checkbox's state and a landmark's name

**Owns:** `apps/extension/src/shared/protocol.ts`;
`apps/extension/src/content/describe-element.ts`;
`apps/extension/src/content/identity/context.ts`;
`apps/extension/src/background/connection/gateway-payloads.ts`;
`domain/src/output-nodes/targets.ts`; the tests of each under its directory's
`tests/`.

**Read:** row B5; `reports/p-openq-triage.md` B5 and Part 4 Group 2;
`reports/x-identity-wire.md` Outcome, because the last identity signals added
never crossed the wire.

**Task.** Record `checked` for checkbox and radio controls, and a landmark's
accessible name (`aria-label`, then `aria-labelledby`) in the element context,
then carry both to the domain target at every hop: descriptor, protocol, gateway
payload, domain target. Both are state, not a value, so no sensitive-control
value may ride with them. Core scores neither signal; do not edit Core, and
say exactly what W26 still needs from it.

**Tests.** A unit test per hop, and one test that proves the domain target
receives both from a described element. Mutation: drop each field at
`gateway-payloads.ts` and quote the failing test. Extension and domain `check`
and `test`; the content harness `identity-resolution.spec.ts`, run but not
edited.

**Report:** `reports/g-recorder-signals.md`.

**Amended after the first attempt stopped Blocked** (a brief defect: ownership
drawn around files, not the change). Owns also `domain/src/actions/types.ts`,
`apps/extension/src/shared/tests/present.test.ts`, and a new
`apps/extension/e2e/content/tests/identity-signals.spec.ts` for the
described-element half. Decision: a sensitive checkbox or radio withholds
`checked` both when recorded and on the gateway, because its checked state is
its contents; prove that with a row and a mutation.

## g-small-fixes — C1, A3, A4, LR9, C3

**Owns:** `apps/extension/src/content/action-runtime/validation-outcome.ts` and
its `tests/validation-outcome.test.ts` (comments only);
`domain/scripts/test-domain.mjs`; `apps/extension/e2e/playwright.content.config.ts`;
`packages/test-contracts/src/scenario-workflow.ts`;
`apps/scenario-lab/src/scenarios/intermediate-state/tests/scenario.test.ts`;
`apps/scenario-lab/src/scenarios/multi-tab/tests/scenario.test.ts`;
`docs/architecture/testing-facility.md`, the "Scenario lab and contract" section
only.

**Task.** Each row as its table entry says. C1: rewrite the false paragraph.
A3: the runner reports every failing entry and continues, exiting 1. A4: pin
`workers` to 4 so the bare `pnpm exec playwright test -c
e2e/playwright.content.config.ts` is correct. LR9: point both assertions at
`scenarioPageFactSchedule(...)` and trim the doc's parenthetical. C3: one
paragraph on `expected.actions`.

**Tests.** A3: prove it with a scratch entry that throws on import, outside the
tracked tree or deleted afterwards, quoting the runner's output and exit code.
LR9: a mutation to the page-fact schedule that each re-pointed test catches.
`check` and `test` for every package touched; the bare content-harness command
lists every spec (`--list`).

**Report:** `reports/g-small-fixes.md`.

## g-flow-lane-observation — CS1f, B1, and fixes D1-D2 from `i-flow-lane-errors`

Replaces the withdrawn `g-lab-resolution` brief: CS1f, B1, D1 and D2 share
`run-scenario.ts` and `run-flow-lane.ts`, so they are one worker's.

**Owns:** in `packages/test-runner/src/`: `run-scenario.ts`;
`flow-lane/run-flow-lane.ts`, `flow-lane/persisted-flow-run.ts`,
`flow-lane/lane-observation.ts`, `flow-lane/recording-flow-proposal.ts`, and the
test of each under `flow-lane/tests/`.

**Read:** `reports/i-flow-lane-errors.md` "(b) Cause 2" and "Fix design" rows
D1 and D2; rows CS1f and B1; `reports/f-w18-secret-leg.md` Outcome, whose
uncommitted change to `run-flow-lane.ts` you build on.

**Task.**
1. D1: publish the Flow-lane observation through `recordEvidence` before the
   expectation asserts. Decision on the design's oracle choice: consult
   `checkFinalState` before the asserts, so a failing run still carries a real
   `oracleVerdict`.
2. D2: exactly as the design row says, including the selector in
   `lane-observation.ts` and the reported category and code in the error
   event's `details` (Core vocabulary only, no page data).
3. CS1f: carry `resolution` from Core's persisted action record into
   `PersistedFlowAction` and `snapshots/flow-lane.json`. Confirm the field's name
   and shape in Core source without editing it, and check it cannot carry a
   sensitive control's value (`reports/v-matcher-calibration.md` on
   `candidateLabel`). `run.json` is out of scope.
4. B1: fail `recording.contract` when `proposal.candidateCount` is below the
   workflow's expected executable actions, so a lost second `web.dom.type` fails
   the run rather than passing on exit status. Say which declaration you count
   from and why.

**Tests.** The unit proofs and mutations the design gives for D1 and D2; a unit
test and a mutation for CS1f and for B1; test-runner `check` and `test`. Under
`Not verified`, state D2's Lab invariant: whenever `flow-lane.json` exists,
`evaluation.json` says `lane "flow"` and `flowCreated true`.

**Report:** `reports/g-flow-lane-observation.md`.

## g-scenario-secrets — realistic fixtures that type into sensitive controls

**Owns:** `apps/scenario-lab/src/scenarios/storefront-checkout/manifest.ts`,
`apps/scenario-lab/src/scenarios/sensitive-input/manifest.ts`, and the tests
under each scenario's `tests/`.

**Read:** `reports/f-w18-secret-leg.md`, the pairing rule and "Other scenarios";
`packages/test-runner/src/flow-lane/declared-secrets.ts`
`declaredSecretBindingInputs` and `targetMatchesRequest` (read only).

**Task.** Since W18, a Flow-lane run fails `fixture.invalid` unless every request
for a run-time value in the approved Flow pairs one-to-one with a declared
secret. Establish from the domain's sensitivity rules which steps of each
scenario the recorder turns into requests, then declare exactly one secret for
each, with a target that pairing matches. Weaken neither pairing nor
sensitivity.

**Tests.** A unit test per scenario that its declared secrets cover exactly the
steps that act on a sensitive control; scenario-lab `check` and `test`. Name
the Lab Flow-lane command that must now get past pairing.

**Report:** `reports/g-scenario-secrets.md`.

**Amended after a Partial** (a brief defect: `sensitive-input` has no
`manifest.ts`; its manifest is inline). Owns also
`apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts` and its `tests/`.
Apply the verified patch the report gives, including the password step's target
moving to `testid:password`.

---

# Third dispatch, from `i-lab-campaign`

Written after `147fdb4`, which holds every first-dispatch fix. "Design item N"
is item N of `reports/i-lab-campaign.md` "Fix design, partitioned by file". The
binding rules and the second-dispatch rules above still hold, except that
`f-connection-split` is finished, so its files are free. `run-scenario.ts` and
`flow-lane/` belong to `g-flow-lane-observation`, which is still running.

## g-bench-coverage — the bench executes W01-W18, and measures evidence size

**Owns:** in `packages/test-runner/src/bench/`: `expand-corpus.ts`,
`run-bench.ts`, `evaluate-run.ts`, `corpus/bench-corpus.ts`, `corpus/week1.ts`,
and `tests/week1-corpus.test.ts`, `tests/run-bench.test.ts`,
`tests/evaluate-run.test.ts`; `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`
and its test.

**Read:** `reports/i-lab-campaign.md` Part 1 criteria 1, 2 and 5, and design
items 1 and 3; `reports/v-bench-honesty.md` Defect 3.

**Task.** 1. Design item 1, decided: week1 plans a row without a variant on the
Flow lane as well as the recording lane, so one bench report covers criteria 1
and 5. Keep the recording-lane results. 2. Design item 3: fill the bench's
evidence-size fields from what a run bundle records. Do its precondition first:
find where, if anywhere, a bundle records sanitized packet bytes and truncation.
If that needs an extension-side producer, stop at the finding and report the
files it would take.

**Tests.** Item 1: the count test from the design (66 runnable results per
repeat, unless HEAD's corpus says otherwise, and then say why), with the
mutation reverting `laneForResult`. Item 3: two packets yield their sizes, with
a mutation. Test-runner `check` and `test`.

**Report:** `reports/g-bench-coverage.md`.

**Amended after the first attempt stopped Blocked** (a brief defect: two lanes
for one row collide in grouping and in the report contract, so owning only the
bench planner would crash every week1 bench after its last run). Now item 1
only. Owns also `packages/test-contracts/src/bench-report.ts` and its report
validation, `bench/aggregate-report.ts` and `bench/render-markdown.ts`, and the
tests of each. Decision: every rate in the report is per lane, never combined,
because the recording lane executes no workflow and a combined rate counts each
unarmed row twice. Every unarmed row runs on both lanes (W24-W28 included), and
a bench with no Flow-lane row still validates. Item 3 moves to the Flow-lane
follow-up: the sanitized packet size is read from Core's run detail
`stateRefs` summary in `flow-lane/`; raw snapshot bytes are not Week 1, and the
report says so rather than printing an empty list.

## g-redaction-attestation — criterion 2's Lab-side leak check

**Owns:** a new `packages/test-runner/src/redaction-attestation/` (barrel,
module, `tests/`); `packages/test-runner/src/run-manifest/create-run-manifest.ts`
and its test.

**Read:** design item 2; `packages/test-runner/src/secret-leak-attestation.ts`
(read only); the plan's Phase 1.4 T3 (grep `T3` in the plan).

**Task.** Build the attestation design item 2 describes: after a run of a
scenario that declares sensitive fixtures, scan the run bundle and the isolated
workspace's persisted recording events for the fixture's synthetic literals,
through `attestWorkspaceSecretAbsence`, and report findings as
`security.redaction`. Derive the manifest's `redactionState` from its result,
after confirming the literal at `create-run-manifest.ts:80` is unconditional.
Its call site is `run-scenario.ts`, which you do not own: write the exact wiring
into your report, including where it must run relative to workspace cleanup.
The supervisor wires it once `g-flow-lane-observation` lands.

**Tests.** A literal planted in a temporary workspace yields a finding, and a
clean one none, with a mutation that skips the scan; test-runner `check` and
`test`.

**Report:** `reports/g-redaction-attestation.md`.

## g-domain-mapping — W19's navigation (B6) and an unusable parameter (B3)

**Owns:** `domain/src/io/input-model.ts` and `domain/src/io/tests/input-model.test.ts`;
`domain/src/client/gateway-action-parameters.ts`,
`domain/src/client/gateway-mapping.ts`, `domain/src/runtime/failure/codes.ts`,
and `domain/src/client/tests/gateway-command-parameters.test.ts` and
`gateway-mapping.test.ts`. If a new code must also reach an allowlist outside
these files, stop and report the file.

**Read:** rows B6 and B3; `reports/i-lab-campaign.md` design item 4;
`reports/v-flow-reload.md` Outcome, for the current reload sequencing;
`reports/f-w18-secret-leg.md` Outcome (`957c831` touched both mapping files).

**Task.** B6: `auth-gate --variant expired` must report `auth_required`, and
cannot, because the recorder's client-side navigation yields no Flow step. Check
the recorder's transition vocabulary first, then map that navigation to an
executable step outside `RECORDING_START_REASON`, without re-admitting the
reload the sequencing excludes. B3: have the parameter reader report the fields
it refused, and have `webAutomationActionFromGatewayCommand` return a rejection
with a new closed-set code when a required field was refused. Say which Core
category the code maps to and why.

**Tests.** B6: a recorded navigation to `/account` maps to an executable step,
and a recording-start reload still does not, each with a mutation. B3: a refused
required field is rejected with the new code and no value in its text, with a
mutation. Domain `check` and `test`.

**Report:** `reports/g-domain-mapping.md`.

**Amended after the first attempt stopped Blocked.** B6 is withdrawn: the
navigation is lost in the extension recorder, not in `input-model.ts`, and W19
needs a design decision (see the ledger). B3 resumes, owning also
`domain/src/runtime/failure/tests/codes.test.ts` (the pinned code list) and
`docs/architecture/failure-taxonomy.md`, with the design the report proposes:
`web.action.invalid_parameter`, category `graph_validation_or_unknown_node`, not
retryable, stage `dispatch`.

## l-stage0 — prove the Lab runs from a worktree (Lab owner)

**Owns:** no tracked file in either repository. A worktree `F:\fxlab-147fdb4` at
`147fdb4`; a run-artifacts directory `F:\fxlab-runs\stage0` outside every
worktree; memory samples in your scratch directory. This brief lifts the "no
`pnpm lab`" rule for the commands below only.

**Read:** `reports/i-lab-campaign.md` Part 2 and Part 3; the false-failure
shapes in `live-validation-plan.md`; the plan's `Current State` operating rules.

**Task.** Create the worktree as Part 2 describes and install offline. With
memory sampled every 15 seconds (Part 3's loop), run once:
`FLUXIQ_TEST_ENV_FILES=none pnpm lab run basic-form --target isolated`, with a
label unique to you and `FLUXIQ_TEST_RUNS_DIR` pointed at the artifacts
directory. Do not run a Core build. Another worker is editing Core's
`client-gateway/bridge.ts`; if the run fails where the gateway is implicated,
rerun once and say so. Keep the worktree for Stage 1.

**Report** (`reports/l-stage0.md`): exit status; from `evaluation.json` the lane,
verdicts and failure fields; the bundle path; wall time; the lowest free memory
and highest Chrome plus Node working set; the manifest's commit and `dirty` flag.
Quote, do not summarise.

---

# Fourth dispatch, from `i-resolver-safety`

"Design A/B/C" are the sets in `reports/i-resolver-safety.md` "Fix design,
partitioned by file"; R1-R9 are its probe rows. All rules above still hold.
`identity/context.ts` and `background/connection/gateway-payloads.ts` belong to
`g-recorder-signals`; `bench/corpus/week1.ts` to `g-bench-coverage`.

## g-resolver-corroboration — refuse a match nothing agrees with exactly (A, CS1d)

**Owns:** in `apps/extension/src/content/`: `identity/corroboration.ts` (new),
`identity/index.ts`, `identity/score.ts`, `identity/veto.ts`,
`action-runtime/resolve-target.ts`, and the `tests/` file of each; in
`apps/extension/e2e/content/tests/`: `identity-near-miss.spec.ts` (new) and
`identity-resolution.spec.ts`.

**Read:** `reports/i-resolver-safety.md` "(a)", "D14" and design A; row CS1d;
D14 in `archive/2026-09-12-decisions-d13-d14.md`.

**Task.**
1. **Measure first**, as design A's "Measurement before landing" says, with the
   predicate applied in a scratch copy: the legitimate profiles lost per
   recording class, and the three realistic fixtures under both identifier
   policies. If a W20-W23 drift mode or W26 would be refused, stop and report
   before landing anything.
2. Land design A's extension table: one predicate that reads Core's
   contributions and is never a second scorer, used by `score.ts` and by veto
   rule 2. The floor and margin are unchanged.
3. CS1d: a positional strategy (`coordinates`, `visual-target`) enumerates its
   candidate family before accepting a lone element, and throws `scoredAmbiguous`
   when scoring says ambiguous. Measure its cost the same way.

**Tests.** Design A's T1 rows and mutation; T2 `identity-near-miss.spec.ts` (R1-R4
and R7-R8 refused, nothing clicked, `saveCount 0`); for CS1d a unit row, a
`no-context` content row and a mutation; the whole `identity-*.spec.ts` family
and `large-page-resolution.spec.ts` green; extension `check` and `test`. Lab,
under `Not verified`: W20-W23 recover and W26 disambiguates, 3 of 3.

**Report:** `reports/g-resolver-corroboration.md`.

## g-identity-drift-mode — the R7 shape as a Scenario Lab negative variant

**Owns:** the mode, render and manifest files under
`apps/scenario-lab/src/scenarios/identity-drift/`, and its `tests/`.

**Read:** design A "Scenario Lab and bench"; "(a)" rows R7-R9.

**Task.** Add a mode that renders Save's slot as a lone, identifier-less "Save
changes and exit" whose click records its own action in the fixture state,
distinct from Save, while the recording stays on the authored baseline. Declare
its variant expecting `failure.category: "target_not_found"`. Write the exact
`bench/corpus/week1.ts` row into your report; the supervisor adds it.

**Tests.** A unit test that the mode renders the R7 shape and that its fixture
state tells the wrong action from Save; scenario-lab `check` and `test`.

**Report:** `reports/g-identity-drift-mode.md`.

**Amended after the first attempt stopped Blocked** (a brief defect: a new
variant breaks a tracked spec no named gate runs). Owns also
`apps/scenario-lab/e2e/identity-drift.spec.ts`, and `state.ts` and
`save-action.ts` under `identity-drift/` by name. That spec's type at `:19`, its
coverage test at `:131-133` and its per-variant loop at `:135-165` must admit a
variant that expects `target_not_found` and no save. Its gate, run as well:
`pnpm exec playwright test -c e2e/playwright.config.ts identity-drift.spec.ts`
from `apps/scenario-lab`. The W29 corpus row, `week1-corpus.test.ts`'s row
count and `PLAN_NEGATIVE_VARIANTS` stay the supervisor's, after
`g-bench-coverage` lands.

## g-identity-wire-chain — `reworded-aria`'s wire fix as a permanent row (C)

**Owns:** `apps/extension/e2e/content/tests/identity-fixtures.ts`, the stale
sentence at about `:19-23` only; `identity-wire-chain.spec.ts` (new), same
folder.

**Read:** `reports/i-resolver-safety.md` "(c)" and design C.

**Task.** A permanent content-harness row for R5 and R6: the recorded descriptor
through HEAD's wire projection and the real `elementFingerprint`, asserting
`reworded-aria` resolves. Call the projection function itself, not a copied
key list, because `g-recorder-signals` is adding keys to it. Correct the stale
sentence.

**Tests.** The spec, and a mutation projecting with `1b6f5df`'s 17 keys that
fails at 0.197; the import path passes the structure audit through a scratch
`GIT_INDEX_FILE`; the `identity-*.spec.ts` family stays green.

**Report:** `reports/g-identity-wire-chain.md`.

## g-core-target-gate — a truthful trace and the right fingerprint (B.1, B.2; Core)

Dispatched only after `g-core-late-event` lands, because both touch Core's
`runtime/service.ts`.

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
`runtime/io-policy.ts`; `nodes/contracts.ts`, the status union at about `:117`;
`runtime/service.ts`, the mapper-target region at about `:5769-5774` only;
`model/action-element-target.ts`; the test of each in its `tests/` folder; any
Core architecture page describing the element-target status. The "never edit
Core" rule is lifted for these files; follow `F:\!FluxIQ\AGENTS.md`.

**Read:** `reports/i-resolver-safety.md` "(b)" and design B.

**Task.** B.1: when no candidates are supplied, the trace stops presenting
`minimumConfidence` as applied, through a delegated status or by omitting it.
B.2: derive the recording mapper's target from `parameters.element` when present,
map `implicitRole` to `role`, and never promote `parameters.text` to
`visibleText` when an element is supplied. First grep this repository for
readers of the status union, and name any. B.3 is Week 2: do not wire it.
3. Added from `reports/g-core-late-event.md` open question 4:
`appendRecordingDomainEvent` in `runtime/service.ts` never checks `endedAt`, so
a late event with no registered input is written into an already-finalized
recording. Refuse it as the other appends are refused, so the bridge's
`appendOrDiscard` audits it as discarded; a probe row that fails before the fix,
with a mutation. You own that function in `service.ts` as well.

**Tests.** Design B's Core unit rows (no unapplied floor claimed; a type node's
target holds no typed text and carries the element's identity), with the
mutation restoring `?? safeString(value.text)`; `npx vitest run <file>
--no-file-parallelism` per file; Core `pnpm check` and `pnpm docs:check`, with
`pnpm docs:reference` if a public export changes. No Core `pnpm build`, no root
`pnpm test`. Lab, under `Not verified`: a generated Flow's click node carries
the recorded identity, and its type node no typed text.

**Report:** `reports/g-core-target-gate.md`.

## i-w19-expectation — design W19's fix: check where a recorded click landed (read-only)

**Owns:** `reports/i-w19-expectation.md` only. Read-only in both repositories;
scratch probes outside the tree; no Lab command.

**Read:** `reports/g-domain-mapping.md` "B6 findings", especially "What W19
needs"; row PB10b; `domain/src/runtime/expectation/evaluate.ts`;
`apps/extension/src/content/actions/assert.ts` and its test; in Core, the
expectation-evaluator seam in `runtime/executor/transition-comparison.ts` and
`node-execution.ts`.

**Decided:** W19 is fixed by Option A. The recorded click carries the state its
recording landed on, checked after the replayed click, so an expired session
fails as `auth_required`. A Flow-lane-injected assertion (B) and a navigate verb
that reclassifies redirects (C) are rejected.

**Task.** Design A end to end at HEAD, with file:line for every link, proven by
probe where you can:
1. **Recorder.** How the navigation that a click explains is attached to that
   click's recorded event instead of dropped (`recorded-event-intake.ts:86`,
   `navigation-recorder.ts:48`) without anything executing it a second time on
   replay; which extension tests pin today's split. `g-recorder-signals` is
   editing `gateway-payloads.ts` and `identity/context.ts`: say whether A needs
   either.
2. **Domain.** Which expectation the recording mapper should emit for such a
   click: a condition that holds on the recorded landing page, and whose failure
   on a sign-in page the assert path reports as `AUTH_REQUIRED`. Where in
   `mapWebRecordingObservation` it goes. It must emit nothing for a click that
   explained no navigation, and never carry a value.
3. **Core.** The additive candidate field and its lift in
   `appendRecordingProposalToFlow`; confirm that the executor evaluates the
   resulting node's expectation through the host after the action, and which
   category the attempt then reports.
4. **Blast radius.** Every week1 corpus row whose recorded clicks would gain an
   expectation, and whether any passing row would start failing.

**Done when** the report ends with a fix design partitioned by file (extension,
domain, Core), the unit, content-harness and Lab proof each change needs, and
the order the pieces must land in.

## g-redaction-wiring — run the redaction attestation in every Lab run

Dispatched once `g-flow-lane-observation` lands, because both edit
`run-scenario.ts`.

**Owns:** `packages/test-runner/src/run-scenario.ts`, the attestation's call
site only; `packages/test-runner/src/redaction-attestation/run-redaction-state.ts`
and its test; the `redactionState` union in the run-manifest contract under
`packages/test-contracts/src/`, its validation, and their tests (name each file
in the report); `run-evaluation/tests/runner-wiring.test.ts`.

**Read:** `reports/g-redaction-attestation.md` "Where the wiring goes" and its
decisions; `reports/g-flow-lane-observation.md` Outcome, for what it changed in
`run-scenario.ts`.

**Task.** Wire `attestRunRedaction` where the report says: after Core is stopped
and its logs are copied into the bundle, before the clone cleanup that deletes
the workspace, the manifest build, and bundle finalization. A finding fails the
run as `security.redaction` and writes `snapshots/redaction-attestation.json`.
Decisions:
- A scenario that declares no secrets records `redactionState:
  "not_applicable"`, a new contract value. Never `verified` when nothing was
  scanned, and never a permanent `pending`.
- Generic credential-pattern hits stay advisories; only a declared literal fails
  a run.

**Tests.** A `runner-wiring.test.ts` row pinning the call's order against close,
cleanup and manifest, with a mutation that moves it after cleanup; a contract
row for `not_applicable`; test-contracts and test-runner `check` and `test`.
Build the test-runner into a private `--outDir` at the same depth as `dist`
(for example `dist-<brief>`), since other workers build `dist`, and delete it
afterwards. Under `Not verified`, name the Lab proof: `pnpm lab run
sensitive-input --target isolated` passes with `findingCount: 0`, files scanned
in both scopes, and `redactionState: "verified"`.

**Report:** `reports/g-redaction-wiring.md`.

**Also D3** from `reports/i-flow-lane-errors.md` "Fix design", since it edits
the same file. Owns also a new `packages/test-runner/src/flow-lane/recording-discards.ts`
and its test. After `assertCoreRoundTrip`, read Core's gateway snapshot audit
log through the route the design names, and write the run recording's
`recording.action_discarded` and `recording.event_discarded` entries (type,
recording id, counts, `sinceFinalizedMs` only) into the `runtime.settle`
details. Fail with `recording.persistence` on any `action_discarded` for that
recording, and record the extension's connection state after Stop. Core
`267a2ca` now audits a late message as discarded instead of failing the
connection, so this is what makes that visible. The audit filter is a pure
function in the new module, with a test and a mutation that drops the recording
filter.

## g-flow-lane-followups — D4, one Flow read, and the packet size

Dispatched with `g-redaction-wiring`, after `g-flow-lane-observation` is
committed.

**Owns:** in `packages/test-runner/src/`: `flow-lane/persisted-flow-run.ts`,
`flow-lane/finalized-recording.ts`, `flow-lane/flow-action-types.ts`,
`flow-lane/declared-secrets.ts`, `flow-lane/run-flow-lane.ts`,
`run-expectations/recorded-events.ts`, and the test of each. **Not**
`run-scenario.ts` or `flow-lane/recording-discards.ts` (`g-redaction-wiring`),
nor `bench/` (`g-bench-coverage`).

**Read:** `reports/i-flow-lane-errors.md` "Fix design" D4;
`reports/f-w18-secret-leg.md` on the duplicated Flow read;
`reports/g-bench-coverage.md` item 3's finding on `stateRefs`;
`reports/g-flow-lane-observation.md` Outcome.

**Task.**
1. **D4.** Compare the extension's executable-event count with Core's action
   count for the recording, and fail `recording.persistence` when Core has fewer.
   First verify that Core's recording summary carries `actionCount`. If the
   extension's tally can only reach the lane through `run-scenario.ts`, stop D4
   at a design that names the exact line to pass, and report it.
2. **One Flow read.** `readFlowSecretRequests` repeats `readFlowActionTypes`'
   walk of the approved Flow. Make one walk yield both, behaviour unchanged.
3. **Packet size.** Read each web action attempt's sanitized packet size and
   `truncated` flag from Core's run detail `stateRefs` summary into
   `PersistedFlowAction` and `snapshots/flow-lane.json`: sizes and flags only,
   never content. First confirm that Core serves that summary. The bench's
   consumer lands after `g-bench-coverage`.

**Tests.** A unit test and a mutation for items 1 and 3; for item 2, the existing
secret-request and action-type rows unchanged and green; test-runner `check`
and `test`, built into a private `--outDir` at `dist`'s depth.

**Report:** `reports/g-flow-lane-followups.md`.

## l-stage1 — Lab Stage 1 against a pinned Core (Lab owner)

Dispatched once Core's late-event fix is committed; the dispatch names this
repository's commit `<R>` and Core's commit `<C>`.

**Owns:** no tracked file in either repository. A Lab root `F:\fxlab\` holding
two worktrees, `F:\fxlab\!FluxIQ` at Core `<C>` and `F:\fxlab\fxlab-<R7>` at
`<R>`; run artifacts under `F:\fxlab-runs\stage1\`; memory samples in your
scratch directory. The "no `pnpm lab`" rule is lifted for the runs below only.

**Read:** `reports/i-lab-campaign.md` Parts 2 and 3; `reports/l-stage0.md`;
`live-validation-plan.md` step 4b (corrected 2026-09-13) and the false-failure
shapes; the plan's `Current State` operating rules.

**Task.**
1. **Pin Core.** The Core links are relative (`link:../../!FluxIQ/...`), so a
   worktree beside a Core worktree inside `F:\fxlab\` resolves to that Core, not
   to `F:\!FluxIQ`. Install both offline; build only the Core packages this
   repository imports through `dist` (not `@fluxiq/web`). **Prove the pin before
   any run:** resolve `fluxiq` from the worktree's `domain`, `apps/extension`
   and `packages/test-runner` to real paths under `F:\fxlab\!FluxIQ`, quoted. If
   it cannot be pinned, stop and report; do not fall back to the live Core.
2. **Runs**, at most 2 instances, memory sampled as Part 3 says, every exit
   captured by redirect:
   - A: step 4b, 24 runs of `basic-form --flow`, judged by its pass condition
     (exactly 4 candidates per run from `snapshots/flow-lane.json`).
   - B: W18 (`auth-gate`, Flow lane, its declared secret supplied) ×3, then
     `reconnect`, W24 and W25 ×3 each as `i-lab-campaign` names them, then smoke
     gate 5.0.
   - Separately, step 4's end-to-end run in its own worktree.

**Report** (`reports/l-stage1.md`): the pin proof; for every run, the exit, the
bundle path, and from `run.json` both commits and `dirty` flags; for step 4b
the per-run `candidateCount`, `proposalIssues`, `entriesAppendedAfterStop` and
`finalizationWaitMs`; for W18 the password node's presence, the absence of the
declared value from `run.json`, `evaluation.json`, `events.ndjson` and
`snapshots/`, and the oracle verdict; the lowest free memory. Quote, do not
summarise; label every single observation.

---

# Fifth dispatch — W19 by Option A, from `i-w19-expectation`

"Design E1/E2/E3/D1/C1/C2/C3" are rows of `reports/i-w19-expectation.md` "Fix
design, partitioned by file". All rules above still hold. Decided:
- **The link design:** the navigation a click caused is recorded as its own
  non-executable event naming the click; clicks are never held back.
- **A rejected expected state fails the attempt,** and the run then routes it
  exactly as any failed attempt, honouring the node's `failureRoute`.
- **Core architecture pages are not edited by these workers:**
  `g-core-target-gate` has them open. Put the exact paragraph each page needs
  into your report.
- **Held:** C2 until `g-core-target-gate` releases `runtime/service.ts`; E2 and
  D1 until the W10 and W27 follow-up below is answered.

## w19-c1 — a rejected expected state fails the attempt (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
`runtime/executor/transition-comparison.ts`, `runtime/executor/tests/node-execution.test.ts`,
`runtime/executor/tests/transition-comparison.test.ts`. The "never edit Core" rule
is lifted for these files only; follow `F:\!FluxIQ\AGENTS.md`.

**Read:** `reports/i-w19-expectation.md` section 3 and design C1; its probe in
that worker's scratchpad `w19probe/`.

**Task.** Design C1. When the host's evaluator rejects the expected state, the
attempt becomes `status: "failed"`, `route: "failed"`, with a `message`, and
`failure` set to the evaluator's record or, when there is none, Core's
`expected_state_missing` record; `transitionComparison` stays. Routing after
that is a failed attempt's, so a node's `failureRoute` is honoured as for any
other failure. Non-succeeded attempts and `builtin.policy.expectation` are
untouched (the gate at `:102`).

**Tests.** Rewrite `node-execution.test.ts:114-137` to the new behaviour. Add
rows: the host's record lands on `attempt.failure`, the run fails, the next node
is not dispatched; a rejection without a record gives `expected_state_missing`;
an accepted state changes nothing; `failureRoute: "success"` is honoured. Mutation:
remove the transform. `npx vitest run <file> --no-file-parallelism` per file;
Core `pnpm check` and `pnpm docs:check`. No Core `pnpm build`, no root `pnpm test`.
State the compatibility effect in the report.

**Report:** `reports/w19-c1.md`.

## w19-e1 — the recorder links a click to the navigation it caused

**Owns:** `apps/extension/src/background/connection/navigation-recorder.ts` and
`recorded-event-intake.ts`; in `connection/tests/`: `navigation-recorder.test.ts`
(new), `recorded-event-intake.test.ts`, `recorded-event.test.ts`,
`gateway-payloads.test.ts`.

**Read:** `reports/i-w19-expectation.md` section 1 and design E1.

**Task.** Design E1, the link design. A top-frame, same-tab, cross-document
commit inside the explaining click's window is sent as a non-executable
`client.recording_event`, with `transition: "explained"`, `explainedBy` naming
the click's sequence, and a URL without query or hash. A subframe commit, a
reload and an unexplained link stay dropped. It is never executable and never
carries an input id. When and how the click itself is sent does not change.

**Tests.** Design E1's unit rows and its mutation, restoring the early return at
`recorded-event-intake.ts:86`; extension `check` and `test`. Under `Not
verified`: the auth-gate recording holds exactly one explained
`web.page.navigated` whose `explainedBy` is the click's sequence, with no query.

**Report:** `reports/w19-e1.md`.

**Added after the first attempt landed in `d124b04`.** `explainedBy` is the
content script's per-document sequence, which is not unique within a recording,
so a mapper could link a landing to the wrong click. Also carry the explaining
click's own unique recorded event id beside the sequence, as `explainedByEventId`
(or the id field the recorded payload already carries; name it), so the domain
mapper links a landing to exactly one click without guessing the nearest earlier
one. Same Owns; the same proof shape: a unit row, a mutation, extension `check`
and `test`.

## w19-e3 — an assert that meets a navigating tab is sent once more

**Owns:** `apps/extension/src/runtime/action-runner.ts` and
`src/runtime/tests/action-runner.test.ts`.

**Read:** `reports/i-w19-expectation.md` section 4 "Replay race" and design E3.

**Task.** Design E3. In `runActionInFrame`, a `web.dom.assert` whose send
rejects with a closed port or no receiver waits for `waitForTabReady` and is sent
exactly once more. No other verb is re-sent. Add no `imports` baseline entry.

**Tests.** Design E3's stub rows (a failed first send and an answered second
give one result from two sends; a click failing the same way is sent once), with
a mutation; extension `check` and `test`. Under `Not verified`: W18 3 of 3.

**Report:** `reports/w19-e3.md`.

## g-w29-row — the save-and-exit negative row in the bench, and honest distribution labels

Dispatched once `g-bench-coverage` is committed.

**Owns:** `packages/test-runner/src/bench/corpus/week1.ts`,
`packages/test-runner/src/bench/tests/week1-corpus.test.ts`,
`packages/test-runner/src/bench/render-markdown.ts` and its test, if it has one
(name it in the report).

**Read:** `reports/g-identity-drift-mode.md` "Corpus row, not applied";
`reports/g-bench-coverage.md` Outcome.

**Task.**
1. Add `variantOnly("W29", "identity-drift", null, ["save-and-exit"])` after W28,
   with every companion change `g-identity-drift-mode` lists: the row count
   (28 to 29), a `PLAN_NEGATIVE_VARIANTS` entry expecting `target_not_found`,
   the "W01 to W28" wording at `week1.ts:7` and `:23`, and the explicit
   runnable count in the plan test at `week1-corpus.test.ts:81-90` (66 to 67,
   Flow-lane variants 20 to 21).
2. Rates are per lane; the latency and duration distributions still mix both
   lanes, which is decided acceptable for Week 1. Label those distributions "all
   lanes" wherever `report.md` prints them, so nobody reads them as Flow-lane
   latency.

**Tests.** Test-runner `check` and `test`, built into a private `--outDir` at
`dist`'s depth: the count test at 67 and a mutation dropping the W29 row; a
render row showing the label. Before `g-resolver-corroboration` lands the bench
would score W29 as a miss; that is expected, not a defect.

**Report:** `reports/g-w29-row.md`.

## g-run-scenario-followups — a second discard read, and a bounded workspace scan

Dispatched once `g-redaction-wiring` is committed.

**Owns:** `packages/test-runner/src/run-scenario.ts`;
`packages/test-runner/src/flow-lane/recording-discards.ts` and its test;
`packages/test-runner/src/redaction-attestation/run-redaction-scopes.ts` and
`attest-run-redaction.ts`, with their tests;
`packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`.

**Read:** `reports/g-redaction-wiring.md`, its Outcome and the open points.

**Task.**
1. **A second discard read.** D3 reads Core's gateway audit log once, straight
   after the recording finalizes, so a message Core discards after that read is
   never seen. Read it again after the Flow lane finishes and before the topology
   closes. Union both reads by audit entry, never double-counting, and fail
   `recording.persistence` on any `action_discarded` for this run's recordings
   either read finds.
2. **A bounded workspace scan.** A `persistent-isolated` workspace grows across
   runs, so the attestation's workspace scan would eventually reach its limits
   and fail every run. Bound that scope to what this run wrote, for example files
   modified since the run started or the run's own recording ids, and say which
   and why. It must still fail closed on anything this run wrote that cannot be
   read. The `isolated` target is unchanged.

**Tests.** Unit rows with a mutation for each item; a `runner-wiring.test.ts` row
pinning the second read after the Flow lane and before close; test-runner `check`
and `test`, built into a private `--outDir` at `dist`'s depth.

**Report:** `reports/g-run-scenario-followups.md`.

**Added after `g-flow-lane-followups`.** Owns also
`packages/test-runner/src/flow-lane/declared-secrets.ts` and
`flow-lane/tests/declared-secrets.test.ts`. 3. `readFlowSecretRequests` has had
no production caller since the Flow is read once; it was kept only so a test row
stayed unchanged. Remove it, re-point that row at the single read, and keep every
assertion the row made. D4 is **not** Week 1 and is not yours: B1 already fails a
proposal short of the recording's pinned executable events, and Core's
`actionCount` counts entries that are not recorded actions.

## g-bench-evidence-size — the bench's evidence-size fields, from the Flow lane's packets

Dispatched once this brief is written; it shares no file with a running worker.

**Owns:** `packages/test-runner/src/bench/evaluate-run.ts` and
`bench/tests/evaluate-run.test.ts`;
`packages/test-runner/src/run-evaluation/observed-run-evaluation.ts` and its test.
**Not** `bench/render-markdown.ts`, `bench/corpus/week1.ts` or
`bench/tests/week1-corpus.test.ts`, which `g-w29-row` owns.

**Read:** `reports/g-bench-coverage.md` item 3 finding;
`reports/g-flow-lane-followups.md` Outcome (`evidencePackets`);
`reports/i-lab-campaign.md` design item 3.

**Task.** Fill the bench report's evidence fields (`sanitizedPacketBytes` and
`truncationCount`) from each Flow-lane run bundle's `snapshots/flow-lane.json`
`evidencePackets`, one entry per measured packet. A recording-lane run
contributes none; say so where the fields are assembled. `rawSnapshotBytes`
stays empty, because no producer exists and it is not Week 1. If the report's
text for that lives in `render-markdown.ts`, write the exact sentence into your
report for the supervisor instead of editing that file.

**Tests.** A Flow-lane bundle with two packets, one truncated, yields both sizes
and a truncation count of 1; a recording-lane bundle adds nothing; a mutation
that drops the read; test-runner `check` and `test`, built into a private
`--outDir` at `dist`'s depth. Under `Not verified`: a week1 bench `report.md`
Evidence size row is non-empty for Flow-lane rows.

**Report:** `reports/g-bench-evidence-size.md`.

## g-integration-small-fixes — the queued comment, cast and script corrections

Dispatched early, on 2026-09-13, because no running worker owns these files.
Two items stay queued and are not in this dispatch: after the supervisor's Core
`pnpm build`, `packages/test-runner/src/flow-lane/persisted-flow-run.ts` and its
test, importing Core's own target-resolution union in place of the local copy
(`reports/g-target-resolution-union.md`); after W19's domain mapper lands,
`domain/src/io/input-model.ts`, the checkbox comment at about `:181-184`.

**Owns:** `docs/architecture/failure-taxonomy.md`, the paragraph that miscounts
producers, and about `:133-138`; `docs/architecture/web-capabilities.md`, that
naming only. Both pages name `runtime/click-landing.ts` as the producer of
`navigation_unexpected` for a click landing on an error page (`reports/w19-e4.md`).
`domain/src/recording/tests/domain.test.ts` (about `:99-104`),
`domain/src/recording/web-state/evidence/tests/project.test.ts` (about `:47`),
`apps/extension/src/content/evidence/tests/forms.test.ts` (about `:151`), the
casts; `apps/extension/src/background/connection/recording-evidence.ts` and the
two tests whose comments still name `connection.ts`; `apps/extension/package.json`,
the `test:content` script only; `apps/extension/src/content/action-runtime/validation-outcome.ts`,
the comment at about `:17-20`; `apps/extension/e2e/content/tests/identity-fixtures.ts`,
its header's spec count; `domain/src/output-nodes/targets.ts` (about `:42-53`) and
`domain/src/client/gateway-mapping.ts` (about `:201-209`), the comments saying
Core ignores `parameters.element`, which Core's target gate changed;
`apps/extension/src/content/actions/assert.ts`, the header at about `:34-43`, which
still calls a failed claim on a sign-in gate a narrow case although `w19-e2` gave
URL claims that branch too; `packages/test-runner/src/bench/render-markdown.ts`
near `:154`, the sentence `reports/g-bench-evidence-size.md` proposes, saying raw
snapshot bytes are not measured in Week 1.

**Read:** the "Found" or "Notes" lines naming each item in
`reports/g-domain-mapping.md`, `g-recorder-signals.md`, `g-snapshot-evidence.md`,
`f-connection-split.md`, `g-small-fixes.md`, `g-identity-wire-chain.md`,
`g-bench-evidence-size.md` and `w19-e4.md`.

**Task.** Correct each comment to what the code now does; remove each cast the
widened `evidence` type made unnecessary; fix the `test:content` script so
`pnpm --filter @fluxiq-web-extension/extension test:content -- <spec>` runs that
spec. No behaviour change anywhere else.

**Tests.** Domain and extension `check` and `test` under private build labels;
test-runner `check`, and `test` built into a private `--outDir` at `dist`'s
depth (`g-single-run-evidence` builds test-runner at the same time); the fixed
script run on one spec, quoting its count; the content harness `--list`; the
structure audit.

**Report:** `reports/g-integration-small-fixes.md`.

## g-single-run-evidence — a lone `lab run --flow` records the evidence the bench reads

Dispatched once `g-run-scenario-followups` lands, since both edit `run-scenario.ts`.

**Owns:** `packages/test-runner/src/run-scenario.ts`, the evaluation call only;
`packages/test-runner/src/run-evaluation/single-run-evaluation.ts` and its test.

**Read:** `reports/g-bench-evidence-size.md`, the note on single runs and the fix
it describes.

**Task.** A bench row now reads `evidencePackets` from `snapshots/flow-lane.json`,
but a single `lab run --flow` still records empty evidence in its own
`evaluation.json`, so the two disagree about the same run. Feed the single-run
evaluation the same packets the bench reads, from the same source, so one run and
its bench row agree.

**Tests.** A single-run evaluation of a Flow-lane run with two packets carries both
sizes and its truncation count, with a mutation; test-runner `check` and `test`,
built into a private `--outDir` at `dist`'s depth.

**Report:** `reports/g-single-run-evidence.md`.

---

# Sixth dispatch — W19, W10 and W27, from the follow-up

Decided on `reports/i-w19-expectation.md` "Follow-up: W10 and W27": **E4** is
taken (a replayed click whose own tab lands on a page served with HTTP 400 or
above fails as `navigation_unexpected`); the landing marker is Week 2; the "no
navigation" claim is rejected; E2 lands alone; D1 is unchanged and is briefed
after C2. All rules above still hold.

## g-negative-click-outcomes — three negative variants whose click must fail

**Owns:** `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts`, the
`navigation` scenario's manifest (name the file), and
`apps/scenario-lab/src/scenarios/failure-surfaces/manifest.ts`, with each
scenario's `tests/`; any Scenario Lab e2e spec that pins those variants' click
outcome (name it, run it).

**Read:** the follow-up's "Something C1 hits now".

**Task.** In auth-gate `expired`, navigation `broken-link` and failure-surfaces
`blocked-url`, declare the click's expected outcome `failed`, as `disabled` and
`detached` already do. Nothing else changes.

**Tests.** Each scenario's test asserts that variant's click outcome, with a
mutation; scenario-lab `check` and `test`.

**Report:** `reports/g-negative-click-outcomes.md`.

## w19-e2 — a failed URL claim on a sign-in gate reports `auth_required`

**Owns:** `apps/extension/src/content/action-runtime/results.ts`;
`apps/extension/e2e/content/tests/failures.spec.ts`.

**Read:** `reports/i-w19-expectation.md` section 2 and design E2.

**Task.** Design E2: `authGateFailure` gains a URL-claim branch, so a failed
`web.dom.assert` URL claim on a page the sign-in-gate detector recognises reports
`AUTH_REQUIRED` (`web.auth.required`). The record never quotes a page value or
the demo password. A URL claim on any other page is unchanged.

**Tests.** The design's harness row in "on auth-gate", with its mutation (drop the
branch and the row reads `state_mismatch`); the non-gate control at
`check-assert.spec.ts:296-313`, run but not edited; extension `check` and `test`.

**Report:** `reports/w19-e2.md`.

## w19-e4 — a replayed click that lands on an error page fails as `navigation_unexpected`

**Owns:** new `apps/extension/src/runtime/click-landing.ts` and
`runtime/tests/click-landing.test.ts`; `apps/extension/src/runtime/action-runner.ts`
(the one call) and `runtime/tests/action-runner.test.ts`.

**Read:** the follow-up's E4 section, its blast radius and proof.

**Task.** After a replayed `web.dom.click`, watch for a top-frame commit on the
click's own tab within a bounded window. When that document was served with HTTP
400 or above, the click fails with `NAVIGATION_UNEXPECTED`
(`web.navigation.unexpected`), naming the status and the path without query,
never page content. A new tab, a subframe, and a click that commits nothing are
untouched. First confirm the extension's current permissions expose the status
for a redirect to a 404 and for a 403; if a new permission is needed, stop and
report. Measure the wait a click that commits nothing now pays.

**Tests.** Unit rows (a 302 then 404, a 403, a 200, a new tab, a subframe, no
commit) with a mutation; extension `check` and `test`. Under `Not verified`: W10
`broken-link` and W27 `blocked-url` report `navigation_unexpected` 3 of 3.

**Report:** `reports/w19-e4.md`.

## g-target-resolution-union — the Flow lane keeps Core's no-candidates record

Dispatched once Core's target gate is committed.

**Owns:** `packages/test-runner/src/flow-lane/persisted-flow-run.ts` and
`flow-lane/tests/persisted-flow-run.test.ts`.

**Read:** `reports/g-core-target-gate.md`, the union and its Flow-lane note.

**Task.** Core's `targetResolution` is now a union keyed on `status`, and
`unresolved_no_candidates` carries no `minimumConfidence`, so `targetResolutionOf`
drops that record. Read each variant as Core defines it, field by field, never
copying the record whole; an unknown status is still dropped.

**Tests.** A no-candidates record survives into `PersistedFlowAction`; a matched
one keeps `confidence` and `normalizedScore`; an unknown status is dropped; a
mutation; test-runner `check` and `test`, built into a private `--outDir` at
`dist`'s depth.

**Report:** `reports/g-target-resolution-union.md`.

## w19-c2 — the recording candidate's expected state, and the entries that follow it (Core)

Dispatched once Core's target gate and `w19-c1` are committed, since all three
touch `runtime/service.ts` or its documentation.

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
`nodes/importer-sdk.ts`; `runtime/recording-flow-proposal.ts`;
`runtime/service.ts`, which must not grow; one new module beside
`service/recordings/timeline.ts` for the candidate and node construction, and a
new test file for it (name both); the Core architecture page for the importer
SDK. The "never edit Core" rule is lifted for these; follow
`F:\!FluxIQ\AGENTS.md`.

**Read:** `reports/i-w19-expectation.md` section 3 and design C2.

**Task.** Design C2: an additive `expectedState` on
`AutomationStudioRecordingMapperCandidate` and `RecordingFlowActionCandidate`; a
mapper context `following` holding the next mapper-visible entries, bounded
(for example 32); `validateRecordingCandidate` lifts a plain-object
`expectedState` with `structuredClone` and drops anything else;
`appendRecordingProposalToFlow` writes it into `parameterValues`. `service.ts`
sits on its 6919-line baseline, so the construction moves out rather than growing.

**Tests.** Design C2's rows, in the new test file, with the mutation that deletes
the lift; `npx vitest run <file> --no-file-parallelism`; Core `pnpm check`,
`pnpm docs:check`, and `pnpm docs:reference` if an export changes. No Core
`pnpm build`.

**Report:** `reports/w19-c2.md`.

**Added after `w19-c1`.** Owns also `nodes/policy/expectation.ts` and
`runtime/executor/transition-comparison.ts`, for one change: `w19-c1` copied
Core's unexported `expected_state_missing` failure record into
`transition-comparison.ts`. Export it once from `expectation.ts`, import it in
`transition-comparison.ts`, and delete the copy, so the two cannot drift. The
executor tests must stay green. Nothing in Core honours a node's `failureRoute`
even for a failed dispatch; that is a Week 2 Core item, and not yours.

**Added at dispatch.** Core's target gate (`0e6d3ac`) and C1 (`6f172b9`) are
committed. Owns also `F:\!FluxIQ\docs\architecture\automation-studio.md`: land
the replacement text `reports/w19-c1.md` gives for its transition-comparison
section (about `:417-427`) and the two sentences for about `:379-397`, adjusted
to the lines as they now stand, beside your own importer-SDK documentation. Run
Core `pnpm docs:check` after.

---

# Seventh dispatch — from Lab Stage 1

`reports/l-stage1.md` ran this repository at `16ff729` against a pinned Core
`267a2ca`. Both briefs below are read-only in both repositories: they may read
the run bundles under `F:\fxlab-runs\stage1\` and the worktrees under
`F:\fxlab\`, write scratch probes outside every tree, and run no Lab command.
Each ends with a fix design partitioned by file (extension, domain, test-runner,
Core), with the unit, content-harness and Lab proof each change needs, and says
which parts HEAD (`1d7d1ab` here, Core `0e6d3ac`) already changes.

## i-recording-loss — where recording entries go missing under load

**Owns:** `reports/i-recording-loss.md` only.

**Read:** `reports/l-stage1.md` (step 4b, W18 run 1, W25, and the open
questions); `reports/i-flow-lane-errors.md` (a); `reports/L-dropped-action.md`;
`reports/L-race-fix.md`; `reports/g-core-late-event.md`.

**Task.** In 14 of 24 step 4b runs Core received fewer recording entries than a
passing run (5-6 instead of 10-13 in nine, none in five), and the losses track
load: 1 of 15 passed under two instances, 9 of 10 alone. W18 run 1 stored an
empty recording although the extension counted five events, and two W25 runs
produced no Flow. Find where entries are lost between the extension recording
them and Core finalizing, from the bundles' own evidence (the extension's log
against Core's logs and `runtime.settle`, with timestamps) and file:line across
the extension's send path, the WebSocket host, and Core's bridge queue, flush
and finalization order. Resolve the report's contradiction about entries
appended after Stop. Say whether anything committed since `16ff729` and
`267a2ca` changes the picture.

**Done when** the root cause is shown in at least two losing runs and absent in a
passing one, and the fix design's Lab proof is step 4b at 24 of 24 under
two-instance load.

## i-stage1-failures — W18's password field, W24's missing failure, W25's category

**Owns:** `reports/i-stage1-failures.md` only.

**Read:** `reports/l-stage1.md` on W18, W24 and W25; `reports/f-w18-secret-leg.md`,
`g-resolver-corroboration.md`, `g-recorder-signals.md` and
`g-flow-lane-observation.md` Outcomes.

**Task.** For each, the root cause with bundle evidence and file:line:
(a) W18 runs 2 and 3: the Flow's password type step did not find the field.
What did resolution see, and did a sensitive control's withheld identity leave
nothing to match? (b) W24 `intermediate-state` `unannounced`: the Flow reported
no failure where `output_not_observed` was expected. Which component should have
reported it, and why did it not? (c) W25 `delayed-ui` `too-slow`: why
`target_not_found` where `timeout` was expected. Where a failure is a recording
that lost its entries (W18 run 1, the two W25 runs without a Flow), name it and
leave it to `i-recording-loss`. Note any overlap with a running brief (`w19-*`,
`g-target-resolution-union`, `g-bench-evidence-size`,
`g-run-scenario-followups`).

**Report:** `reports/i-stage1-failures.md`.

## i-w19-expectation, follow-up — W10 `broken-link` and W27 `blocked-url` (read-only)

Both expect `navigation_unexpected` from a recorded click, which nothing
produces. Design each, with its blast radius on every week1 row:
(a) a landing marker on the URL claim D1 emits, so a failed landing that is not a
sign-in gate reports `NAVIGATION_UNEXPECTED`: the change to
`WebAutomationAssertRequest` and every file it touches; (b) for W27
`blocked-url`, whose recorded click navigates nowhere, what a "no navigation"
claim on clicks whose recording saw no commit would cost across the corpus, and
whether anything narrower yields `navigation_unexpected` there; (c) whether E2's
auth-gate branch belongs in the same `results.ts` change. Recommend one, with
the proof each needs. Append the answer to `reports/i-w19-expectation.md` as
"Follow-up: W10 and W27".

## g-core-late-event — CS1b′, a late recording event kills the connection (Core)

**Owns:** `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\client-gateway\bridge.ts`
and `client-gateway/tests/bridge.test.ts`. The "never edit Core" rule is lifted
for these two files only; follow `F:\!FluxIQ\AGENTS.md` "Code Structure".

**Read:** rows CS1b and CS1b′; `reports/L-core-discard.md` "The contract change
I did not make".

**Task.** An event arriving between a recording's finalization and
`activeRecordings.delete` makes `appendRecordingEvents` throw "Finalized
recordings are immutable." inside `flushRecordingEntries`, whose `try/finally`
has no `catch`. First trace, with file:line, how that throw reaches the
WebSocket host and what the extension observes. Then catch that error there and
route the batch through `noteDiscardedClientMessage`, as a discard already is.
Match the error by something sturdier than its message if Core offers one, and
say if it does not. Sending the client an error frame is CS1b and ruled into
Week 2: do not add one.

**Tests.** From `F:\!FluxIQ`: `npx vitest run <bridge test path>
--no-file-parallelism`. A test reproducing the race that fails before the fix
(quote the failure), with a mutation proof, and Core `pnpm check`. No Core
`pnpm build`, since this repository imports Core through `dist`, and no root
`pnpm test`.

**Report:** `reports/g-core-late-event.md`, in this repository.

---

# Eighth dispatch — W19's domain mapper

Written while `w19-c2` runs. All rules above still hold.

## w19-d1 — the mapper claims where a recorded click landed (domain)

Dispatched once `w19-c2` is committed and the supervisor has run Core's
`pnpm build`, so `following` and the candidate's `expectedState` are in Core's
types; the dispatch names the Core commit.

**Owns:** one new builder in `domain/src/runtime/expectation/` (name it) and
`runtime/expectation/index.ts`; `domain/src/web-panel-host.ts`, the mapper
(about `:115-138`) and `candidate(...)` only; a new test file in
`runtime/expectation/tests/`; `domain/src/tests/domain.test.ts`, new rows only;
`domain/src/io/tests/input-model.test.ts`, one row.

**Read:** `reports/i-w19-expectation.md` section 2 and design D1;
`reports/w19-e1.md` open questions 1-2 and "A gap the mapper must close";
`reports/w19-c2.md` for the exact `following` shape.

**Task.** Design D1, no landing marker. For a `web.dom.click` observation, look in
`following` for explained `web.page.navigated` entries naming this click and take
the **last** one. A landing names the click when its
`metadata.explainedByEventId` equals the click's own event id, rebuilt through the
domain's builder (`createWebAutomationRecordingEvent`,
`client/gateway-mapping.ts:66`) from `payload.sequence` and the entry's
`timestampMs`, never spelled out again. When a landing has no
`explainedByEventId`, it names the nearest preceding click in the same `sourceId`
whose `payload.sequence` equals `explainedBy`. Emit exactly
`{ conditions: [{ assert: { kind: "url", expected: <path> } }], mode: "all", timeoutMs: 5000 }`,
path only; emit nothing on the four cases section 2 lists. The explained
observation itself still maps to `null`. Reach the builder through the barrel.

**Tests.** Section 2's rows plus: two clicks sharing a sequence each get their own
landing; two landings for one click give the last. Mutation: drop the
`expectedState` from `candidate(...)`, then separately break the event-id match,
each failing a named row, restored byte-identical. Domain `check` and `test` under
a private label; the structure audit. Put the paragraph the recording
architecture page needs in the report.

**Report:** `reports/w19-d1.md`.

## g-w19-docs — the architecture pages W19's changes left unwritten

Dispatched once `w19-d1` has reported and `g-integration-small-fixes` has
released `failure-taxonomy.md`. On 2026-09-13 a search of `docs/architecture/`
for `explainedBy`, "sign-in gate" and `auth_required` found none of E1, E2, E3 or
D1 described.

**Owns:** `docs/architecture/extension-client.md`, the recording and action
execution sections only; `docs/architecture/failure-taxonomy.md`, the producer
paragraphs only.

**Read:** `reports/w19-e1.md` open question 5 (its paragraph) and the follow-up's
`explainedByEventId`; `reports/w19-e2.md`, `w19-e3.md`, `w19-d1.md`, each
report's documentation note; the two pages as they stand.

**Task.** Describe what the code now does, checking each claim against the file
the report names at HEAD: a click's explained landing and the event id naming it
(E1); the URL claim D1 gives a recorded click, and what it never carries (D1); a
failed URL claim on a sign-in gate reporting `auth_required` (E2); an assert sent
once more when its tab was navigating, and no other verb (E3). No code changes.

**Tests.** The structure audit; `pnpm docs:check` if this repository has one,
otherwise say so; every file:line you cite opened at HEAD.

**Report:** `reports/g-w19-docs.md`.

---

# Ninth dispatch — from `i-stage1-failures` and `g-single-run-evidence`

Verified by the supervisor on 2026-09-13:
- `run-flow-lane.ts:93` reads `if (input.workflow.variant) await input.armVariant();`, and `run-scenario.ts:320-333` is the only reload.
- W24 run 2's `flow-lane.json` has `candidateCount 3`, every action `succeeded`, `failure: null`.
- W25 run 3's has `candidateCount 1` and one click `failed` with `target_not_found`.
- `delayed-ui/scenario.ts:40` pins no click count.

Decided: F1 is dispatched; F2 is measured before it is built; F3 is not Week 1 (below). All rules above still hold.

**Amendment to `g-integration-small-fixes`, sent while it runs.** It also owns
`packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`, the comment
at about `:32-36`, which still says a single `lab run` passes no evidence. The
wording is in `reports/g-single-run-evidence.md`.

## f-flow-start-page — every Flow run starts on the scenario's start page (F1)

Dispatched once `g-single-run-evidence` is committed.

**Owns:** `packages/test-runner/src/flow-lane/run-flow-lane.ts` and
`flow-lane/tests/run-flow-lane.test.ts`; `packages/test-runner/src/run-scenario.ts`,
the page-preparation callback only (about `:320-333`).

**Read:** `reports/i-stage1-failures.md` finding (a) and F1.

**Task.** Design F1. Call the callback on every Flow run, in this order: reset,
prepare, read nodes, run. Rename the callback for what it now does.

**Tests.** F1's row with its mutation (restore the variant guard); rerun
`src/tests/scenario-assertions.test.ts`; test-runner `check`, and `test` in a
private `--outDir` at `dist`'s depth; the structure audit. From the manifests,
list every unarmed week1 Flow-lane row whose starting page changes, for the Lab
to re-measure.

**Report:** `reports/f-flow-start-page.md`.

## g-evidence-reader-merge — one Flow-lane evidence reader, not two

Dispatched once `g-single-run-evidence` is committed. `f-flow-start-page` runs
beside it and shares no file.

**Owns:** one new module in `packages/test-runner/src/run-evaluation/` (name it)
and that directory's `index.ts`; `run-evaluation/single-run-evaluation.ts` and its
test; `packages/test-runner/src/bench/evaluate-run.ts` and its test.

**Read:** `reports/g-single-run-evidence.md`, the note on the copied reader.

**Task.** `g-single-run-evidence` copied the bench's `snapshots/flow-lane.json`
evidence-size reader into `single-run-evaluation.ts`, because importing the bench
would form a cycle. Move the one reader into the new module, import it from both
callers, and delete both copies. Behaviour must not change.

**Tests.** The rows that pin the two copies together become rows on the new
module, malformed input included, with a mutation. Test-runner `check`, and `test`
in a private `--outDir` at `dist`'s depth. The structure audit, with no new
baseline entry.

**Report:** `reports/g-evidence-reader-merge.md`.

## i-late-target-wait — measure F2 before it is built (read-only, plus one pin)

**Owns:** `reports/i-late-target-wait.md`;
`apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts`, the `recordingEvents`
line only, and that scenario's test.

**Read:** `reports/i-stage1-failures.md` finding (c) and F2;
`reports/i-w19-expectation.md` section 4, as the model for a corpus pass;
`reports/w19-c2.md` for `following`, once it exists.

**Task.**
1. Pin `{ type: "web.element.clicked", count: 2 }` in delayed-ui's
   `recordingEvents`, so a proposal that lost "Load content" fails as
   `recording.contract`.
2. With file:line in Core's `runtime/service/recordings/timeline.ts` and the Stage 1
   bundles, establish whether the mapper sees a `web.dom.mutated` entry at all
   after Core compacts the timeline (W25 run 3: "Compacted 1").
3. For every week1 row, say whether F2's rule would add a wait node, and what
   that does to the row's expected actions and category. F2's rule is a mutation
   with `added > 0` followed by a click with a CSS selector. Cover W11, the modal
   rows W12-W14, and the drift rows W20-W23, W26 and W29 especially.
4. Recommend one of three options, with the proof each needs:
   - F2 as designed;
   - a narrower rule the mapper can evaluate from what it sees;
   - amending the W24/W25 expectations (unarmed and `too-slow`) instead.

**Tests.** Scenario-lab `check` and `test` for the pin, with a mutation. No Lab
command.

**Report:** `reports/i-late-target-wait.md`.

## F3 — W24 `unannounced` is not Week 1

W24 needs a producer that reports `output_not_observed` after an unannounced
intermediate step. Building one takes three changes and a measurement
(`reports/i-stage1-failures.md` F3):
- a recorded-payload contract change: a bounded identity for added elements;
- a new domain claim builder;
- an evaluator category rule;
- then a blast-radius pass over the whole corpus.

The W24 row stays in the week1 corpus and counts against criterion 4 as measured.
It is ranked as a blocker at Phase 1.6b and carried into Week 2.

---

# Tenth dispatch — from `i-recording-loss`

Verified by the supervisor on 2026-09-13 in Core's `client-gateway/bridge.ts`:
- `startRecordingFromClient` sets `activeRecordings` only after
  `await createRecording` (`:271-304`).
- An entry or event arriving before then is audited with no recording id
  (`:218-220`, `:341-348`).
- A snapshot or state update is dropped silently (`:518`, `:555`).
- Only `client-gateway/service/commands.ts:43` sends `server.start_recording`,
  so the extension's 750 ms fallback always fires.

Decided: the fix is in the bridge, not the WebSocket host. Core gets C1-C3, the
extension E1, the test-runner T1-T3; the domain needs nothing. The user is
alerted before the Core edit.

## g-core-start-order — a client's start is ordered with what follows it (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
`client-gateway/bridge.ts` and `client-gateway/tests/bridge.test.ts`; also
`F:\!FluxIQ\docs\architecture\automation-studio\client-gateway.md`. The "never
edit Core" rule is lifted for these; follow `F:\!FluxIQ\AGENTS.md`. `w19-c2` edits
other Core files meanwhile; touch none of them.

**Read:** `reports/i-recording-loss.md` "The mechanism, in order" and Fix design
C1-C3; `reports/g-core-late-event.md` for the held-finalization test pattern.

**Task.**
1. **C1.** Record a pending start per owner key before `startRecordingFromClient`'s
   first await. Every `handleGatewayEvent` branch that reads `activeRecordings`
   (entry, event, snapshot, state update, error, stop) awaits it first. A refused
   or throwing start discards what waited, audited with the refused recording id.
2. **C2.** After activation, acknowledge through `this.gateway.startRecording(...)`
   (`client-gateway/service/commands.ts:39-44`) in place of `markActiveRecording`.
   Say whether it does anything beyond marking and sending.
3. **C3.** A discard audit carries the message's own `recordingId` when it has
   one, and the snapshot and state-update drops are audited, not silent.

Do not serialize the WebSocket host.

**Tests.** The report's rows, with both mutations, quoting each failure;
`npx vitest run <bridge test> --no-file-parallelism`; Core `pnpm check`;
`pnpm docs:check`, plus `pnpm docs:reference` if a cited line moves. No Core
`pnpm build`.

**Report:** `reports/g-core-start-order.md`, with the compatibility effect on
every gateway client.

## f-recording-start-send — begin locally only after the start was sent (extension)

**Owns:** `apps/extension/src/background/connection/recording-start/handshake.ts`
and its test in `recording-start/tests/`; one existing test file of your choosing,
for C2's acknowledgement row, if none covers it.

**Read:** `reports/i-recording-loss.md` Fix design E1 and C2.

**Task.**
1. **E1.** Keep arming the acceptance window before the send, but let
   `acceptWindowElapsed` begin locally only once the in-flight send has settled.
2. With file:line, confirm two behaviours, and add a row for any that no test
   covers:
   - a `server.start_recording` for the pending id that arrives inside the window
     ends the handshake as accepted and starts recording exactly once;
   - one arriving after a local start changes nothing but a project link
     (`active-recording.ts:184-190`).

**Tests.** A send resolving after the window: `beginLocally` is not called before
it resolves, with the mutation. Extension `check` and `test` under a private label;
the structure audit.

**Report:** `reports/f-recording-start-send.md`.

## g-recording-completeness — a short recording fails the run on both lanes (test-runner)

Dispatched once `f-flow-start-page` is committed, since this edits `run-scenario.ts`.

**Owns:** a new `packages/test-runner/src/run-expectations/recording-completeness.ts`,
its test and barrel entry; `flow-lane/recording-discards.ts` and
`flow-lane/finalized-recording.ts`, each with its test; `run-scenario.ts`, only the
calls these need. Added once `f-flow-start-page` reported: `run-scenario.ts`, the
`openScenarioStart` comment at about `:597-615`, and the messages in
`src/tests/scenario-assertions.test.ts`, which still describe the Flow lane's
load as armed only (`reports/f-flow-start-page.md`); wording only.

**Read:** `reports/i-recording-loss.md` Fix design T1-T3, and "The entries appended
after Stop".

**Task.**
1. **T1.** On both lanes, compare the extension's executable-action count, read
   before Stop, with Core's action count from the full session. A short count fails
   as `recording.persistence`, naming the two counts and nothing recorded.
2. **T2.** Also count discard entries without a `recordingId` whose `sessionId` is
   the run's paired session, passed at both reads.
3. **T3.** Rename `entriesAppendedAfterStop` for what it measures, and label the
   `flow-lane.json` figure as the lane's second wait.

**Tests.**
- T1: equal, short and empty counts, with a mutation.
- T2: a session-only discard is counted and another session's is not, with a
  mutation.
- Test-runner `check`, and `test` in a private `--outDir` at `dist`'s depth.
- The structure audit.

**Report:** `reports/g-recording-completeness.md`.

---

# Eleventh dispatch — from `w19-c2`

Decided on `reports/w19-c2.md`'s open questions:
1. The one-line export in `runtime/service/recordings/index.ts` stands. From now
   on, a brief that creates a module in a barrelled directory owns that
   directory's `index.ts`.
2. The shared record goes to `g-core-expectation-record`, below.
3. The test's location stands.
4. Approving a proposal as a node definition, which drops `expectedState`, is
   Week 2, since the Lab and the product path approve into a Flow.
5. An empty `{}` expectation is treated as none, by `g-core-expectation-record`.
6. Shared observations within one mapper's calls stand as documented.

**Amendment to `w19-d1`, from Core as `w19-c2` left it.**
- A mapper is called `(observation, context)`, and `context.following` is the
  next 32 timeline observations, in order. Each has the same shape as the
  observation: `type`, `timestamp`, `payload`, `metadata`.
- Give `mapWebRecordingObservation` an optional second parameter, so the domain
  tests that call it with one argument still compile.
- Rebuild the click's event id from `observation.timestamp`.

## g-core-expectation-record — one expectation-rejected record, and no empty expectation (Core)

Dispatched once `w19-c2` is committed. `g-core-start-order` runs beside it and
shares no file.

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
- `nodes/policy/expectation.ts` and `nodes/policy/index.ts`;
- `runtime/executor/transition-comparison.ts` and
  `runtime/executor/tests/transition-comparison.test.ts`;
- `runtime/service/recordings/proposal-candidates.ts` and
  `runtime/service/recordings/tests/proposal-candidates.test.ts`.

Do not touch `client-gateway/`.

**Read:** `reports/w19-c2.md` open questions 2 and 5.

**Task.**
1. Export the `expected_state_missing` record once, from `expectation.ts` through
   `nodes/policy/index.ts`. Import it in `transition-comparison.ts` and delete the
   copy. Before editing, check whether importing that barrel into the executor
   creates an import cycle; if it does, stop and report the cycle.
2. An `expectedState` with no own keys counts as absent in two places:
   - `liftedExpectedState` drops it;
   - the transition comparison does not ask the host about it.

**Tests.**
- Rows for the empty expectation, in both files, each with a mutation.
- The executor tests (`node-execution`, `transition-comparison`) stay green.
- `npx vitest run <files> --no-file-parallelism`; Core `pnpm check`;
  `pnpm docs:check`, plus `pnpm docs:reference` if a cited line moves.
- No Core `pnpm build`.

**Report:** `reports/g-core-expectation-record.md`.

---

# Twelfth dispatch — from `g-integration-small-fixes` and `f-recording-start-send`

**Amendment to `g-w19-docs`.** In `docs/architecture/failure-taxonomy.md` it also
owns the `AUTH_REQUIRED` bullet (about `:121-123`) and the Dispatch bullet (about
`:124-132`). `reports/g-integration-small-fixes.md` found both stale, outside that
worker's lines.

## f-recording-start-guard — one recording start when Core's acknowledgement races the local fallback (extension)

Dispatched once `f-recording-start-send` is committed.

**Owns:** `apps/extension/src/background/connection/active-recording.ts` and
`connection/tests/active-recording.test.ts`. Also the one file where a recording
start's project lookup is bounded (`core-api.ts:34` or its caller; name it).

**Read:** `reports/f-recording-start-send.md`, its Notes and Not verified;
`reports/i-recording-loss.md` Fix design C2.

**Task.**
1. The worker's probe showed a double start. A `server.start_recording` that
   arrives while a local start is still running (before `active-recording.ts:200`)
   starts recording a second time and leaves the project link null. Core now sends
   that acknowledgement (`g-core-start-order`), so the race is likely. Make it:
   - start nothing twice;
   - link the project once the start finishes;
   - ignore an acknowledgement whose `recordingId` is neither the pending nor the
     active recording's.
2. Bound the project lookup a start now waits on, so a stalled lookup cannot hold
   off the local fallback indefinitely. Say what the start does when the bound is
   reached.
3. Added once `g-core-start-order` reported, and sent to the running worker: an
   acknowledgement for recording R that arrives after the extension stopped R,
   or while it is stopping R, must not restart recording. Core sends none once
   the Stop has reached it, but the two can cross on the wire.

**Tests.**
- A row reproducing the double start that fails before the fix (quote the
  failure), with its mutation.
- A mismatched `recordingId` is ignored.
- A stalled lookup reaches the local fallback within its bound.
- Extension `check` and `test` under a private label; the structure audit.

**Report:** `reports/f-recording-start-guard.md`.

---

# Thirteenth dispatch — from `i-late-target-wait`

Verified by the supervisor on 2026-09-13:
- `content/recorder.ts:35-39` sends the mutation batch only from a 500 ms timer,
  and `emit` (`:55-60`) does not flush it.
- Core `runtime/io-bridge.ts:53-62` appends a non-action input as
  `type: "observation"`, `observationType: "input.<role>"`, so a mutation reaches
  the mapper as `input.event` with `latestEvidence`, never as `web.dom.mutated`.

Decided: option 2 of `reports/i-late-target-wait.md` Task 4, plus its W24
correction. Option 1 never fires on its own target. Option 3 removes the corpus's
only `timeout` row, and would pass the unarmed row on a latency race.

## f-recorder-mutation-flush — a DOM addition is recorded before the action after it (extension, and W24's manifest)

**Owns:**
- `apps/extension/src/content/recorder.ts`, plus a test for it: a unit test, or
  a content-harness row if no unit seam exists (name it);
- `apps/scenario-lab/src/scenarios/intermediate-state/scenario.ts`, the unarmed
  `expected.actions` only, and that scenario's test.

**Read:** `reports/i-late-target-wait.md` Task 2, Task 4 option 2, and "Needed
under every option".

**Task.**
1. Before the recorder emits any kind that can be executable (`dom.click`,
   `dom.input`, `dom.change`, `dom.submit`, `dom.keydown`), send the pending
   mutation batch and clear its timer. No payload field changes, and no page data
   is added.
2. Drop `web.dom.wait_for_selector: succeeded` from W24's unarmed
   `expected.actions`, since no rule can put a wait after the last recorded click.
   Say how `packages/test-runner/src/flow-lane/expectations.ts:7-19` matches
   actions, and what the row asserts now.

**Tests.**
- A click after a DOM addition sends `dom.mutation` before `dom.click`, with the
  mutation proof (remove the flush).
- The recording-lane pins on `web.dom.mutated` still hold (`delayed-ui`,
  `intermediate-state`, `dynamic-list`, `reconnect`).
- Extension `check` and `test` under a private label; any content-harness spec
  that records mutations; scenario-lab `check` and `test`; the structure audit.

**Report:** `reports/f-recorder-mutation-flush.md`.

## w25-wait-mapper — a wait before a click whose target a DOM addition produced (domain)

Dispatched once `w19-d1` is committed, since both edit `web-panel-host.ts`.

**Owns:**
- one new builder in `domain/src/` (name it), with its directory's `index.ts`,
  and the builder's test;
- `domain/src/web-panel-host.ts`, the mapper only;
- `domain/src/tests/domain.test.ts`, new rows only;
- `apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts`'s `expected.actions`
  and its test, but only if `flow-lane/expectations.ts` needs the three generated
  actions listed.

**Read:** `reports/i-late-target-wait.md` Task 2, and Task 4 option 2 with its
design constraints.

**Task.** Option 2's domain half:
- Start from an `input.event` observation whose `latestEvidence.kind` is
  `dom.mutation`, with `mutation.added > 0`.
- In `context.following`, find the next executable entry, skipping evidence.
- If that entry is a `web.dom.click` with a CSS `selector`, in the same document,
  return `{ candidates: [web.dom.wait_for_selector { selector, wait: { condition: "present" } }] }`.
  Give it no `timeoutMs`, no `sourceInputIds` and no `expectedConfirmation`.
- Emit from the mutation's own call, never from the click's, which would replace
  Core's fallback click.

**Tests.**
- Option 2's seven rows, with the mutation proof (drop the builder call).
- Domain `check` and `test` under a private label; the structure audit.

**Report:** `reports/w25-wait-mapper.md`.

---

# Fourteenth dispatch — Lab Stage 2

Written while the Stage 1 fixes are still in flight. All rules above still hold.

## l-stage2 — the Stage 1 fixes, measured under load (Lab owner)

Dispatched once every Stage 1 fix above is committed and Core is built. The
dispatch names this repository's commit `<R>` and Core's `<C>`.

**Owns:** no tracked file in either repository.
- `F:\fxlab\!FluxIQ`, moved to `<C>`; a repository worktree beside it at `<R>`; a
  second repository worktree for the load instance.
- Run artifacts under `F:\fxlab-runs\stage2\`, and memory samples in your scratch
  directory.
- The "no `pnpm lab`" rule is lifted for the runs below only, each with
  `FLUXIQ_TEST_ENV_FILES=none`.

**Read:**
- `reports/l-stage1.md`, for the pin proof and run layout;
- `reports/i-recording-loss.md` "Lab proof";
- `reports/f-flow-start-page.md` Notes;
- `reports/i-late-target-wait.md`, option 2's Lab proof;
- `reports/w19-c2.md` and `reports/w19-e4.md`, "Not verified".

**Task.**
1. **Pin Core** as Stage 1 did, rebuild its packages at `<C>`, and prove the pin
   before any run.
2. **Under load.** Run a second instance, looping `basic-form --flow` in its own
   worktree, for the whole of A and B.
   - **A:** step 4b, `basic-form --flow --target isolated` ×24. Every run must show:
     - `exit=0` and `candidateCount` 4;
     - `runtime.settle` `recordedActions` for the extension equal to Core's. Entry
       counts legitimately differ between runs (15 and 16 in the first attempt),
       so they are reported, not required to match;
     - the action-count check holding;
     - zero discard audit entries for the run's session;
     - `extensionConnectionAfterStop` not `error`.
   - **B**, ×3 each:
     - W18 `auth-gate --flow`, with its declared secret: the Flow starts on
       `/scenarios/auth-gate/`, the username type is present, and the run passes;
     - W19 `auth-gate --flow --variant expired`: the click attempt `failed`,
       `auth_required` / `web.auth.required`, `comparisonStatus` `blocked`, and no
       extract attempt;
     - W25 `delayed-ui --flow`, and `--variant too-slow`, as option 2's proof says.
3. **Alone, with no load**, ×3 each unless noted:
   - W10 `broken-link` and W27 `blocked-url`: `navigation_unexpected` /
     `web.navigation.unexpected`, with the click `failed`;
   - `sensitive-input`: the leak attestation passes, and no declared value appears
     in any bundle file;
   - W24 `intermediate-state --flow`, unarmed;
   - the smoke comparison against gate 5.0, once.
4. **Then** the week1 bench once (`--repeat 1`, headed, as `v-bench-honesty`
   requires), with its report.
   - Added once `w25-wait-mapper` reported: its wait matches by CSS selector
     only. From the bench's Flow-lane rows, confirm that these rows keep their
     verdicts and gain no `web.dom.wait_for_selector` action:
     - the identity-drift variants (W20-W23, W29);
     - `ambiguous-targets` (W26);
     - `modal-flows`' interstitial rows, unarmed and armed;
     - `iframe-checkout`.
   - Quote each row's actions.

**Report** (`reports/l-stage2.md`):
- the pin proof;
- for every run, its exit, its bundle path, and both commits and `dirty` flags
  from `run.json`;
- the per-run step 4b figures;
- each observation named above, quoted from `flow-lane.json`, `evaluation.json`
  or `events.ndjson`;
- the bench report's headline rates per lane;
- the lowest free memory.

Quote, do not summarise. Label every single observation, and rerun a uniform or
impossible failure once, alone, before reporting it.

---

# Fifteenth dispatch — from `w19-d1`

Verified by the supervisor on 2026-09-13, in Core:
- `recordGatewayInput` builds the envelope metadata at
  `client-gateway/bridge.ts:649-655`.
- `runtime/io-bridge.ts:24-49` writes an action entry whose metadata is only
  `domainId`, `inputId`, `inputRole`, `envelopeId` and `policyEligible`.
- `service.ts:2411` proposes an `action` entry through
  `recordingActionEntryCandidate` (`:5726-5749`) whenever the mapper returns
  nothing.

A live click therefore never reaches `w19-d1`'s claim.

Decided:
- Core keeps the recorded event's identity on the entry.
- The domain mapper proposes a linked click from its action entry; every unlinked
  click keeps Core's fallback.
- `w25-wait-mapper` is dispatched now, and `w19-d1b` follows it, since both edit
  `web-panel-host.ts`.
- `g-w19-docs` waits for `w19-d1b`.

**Amendment to `w25-wait-mapper`.** It also owns `domain/src/io/input-model.ts`,
the checkbox comment at about `:181-184` only. `g-integration-small-fixes` left
that comment for after D1, and the correct wording is in the reports that brief
names.

## g-core-action-entry-identity — a recorded entry keeps the event it came from (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
- `client-gateway/bridge.ts`, the `recordGatewayInput` call sites and envelope
  metadata only, with no net line growth (it is 796 of 800);
- `runtime/io-bridge.ts`;
- their tests;
- the Core architecture page that describes a recording entry's metadata (name it).

Follow `F:\!FluxIQ\AGENTS.md`.

**Read:** `reports/w19-d1.md` open questions 1 and 2; `reports/w19-e1.md`, "A gap
the mapper must close".

**Task.**
- When a gateway recording event becomes a recorded input and carries an
  `eventId`, that id joins the envelope metadata.
- `io-bridge.ts` copies the envelope's `eventId` and `sourceId`, strings only,
  onto the entry's metadata, for action and observation entries alike. Copy
  nothing else from the envelope.
- Say whether anything reads entry metadata in a way these keys could disturb.

**Tests.** Each row below needs a mutation.
- A recorded click's action entry carries its `eventId` and `sourceId`.
- An event with no `eventId` yields none.
- A non-string value is not copied.

Run `npx vitest run <files> --no-file-parallelism`, Core `pnpm check`, and
`pnpm docs:check`, plus `pnpm docs:reference` if a cited line moves. No Core
`pnpm build`.

**Report:** `reports/g-core-action-entry-identity.md`, with the compatibility
effect.

## w19-d1b — a linked click's action entry carries the landing claim (domain)

Dispatched once `g-core-action-entry-identity` and `w25-wait-mapper` are committed
and Core is built.

**Owns:** `domain/src/runtime/expectation/click-landing.ts` and its test;
`domain/src/web-panel-host.ts`, the mapper only; `domain/src/tests/domain.test.ts`,
new rows only.

**Read:**
- `reports/w19-d1.md`, open questions 1-3;
- `reports/g-core-action-entry-identity.md`, for the metadata keys;
- Core `runtime/service.ts` `recordingActionEntryCandidate`, and
  `runtime/service/recordings/proposal-candidates.ts`, for what an `action`
  observation's payload holds.

**Task.**
- Take an `action` observation whose output is `web.dom.click`, with a linked
  explained landing in `following`. Match by the entry's stored `eventId` only.
  Amended once `g-core-action-entry-identity` reported: a landing's own
  `sourceId` is a top-level entry field that mappers are not shown, so a
  tab-based match cannot work for an action entry. Every current landing
  carries `explainedByEventId`.
- Return one candidate carrying the claim. It must propose what Core's fallback
  proposes for that entry: the same output, parameters, source input and
  confirmation. Name any field the mapper cannot see.
- Every other `action` entry still maps to `null`, so Core's fallback is unchanged
  for it.

**Tests.**
- A linked click's action entry gives the fallback's candidate plus the claim.
- An unlinked one gives `null`.
- Rows are built from the observation shape Core produces, with a mutation.
- Domain `check` and `test` under a private label; the structure audit.

**Report:** `reports/w19-d1b.md`.

**Amendment to `g-recording-completeness`, sent while it runs.** Its first report
left two items open:
- `src/tests/runner-wiring.test.ts` pins the old discard-read call text, so rows
  `:70` and `:90` fail;
- the `flow-lane.json` label is written in `flow-lane/run-flow-lane.ts:157`.

It now also owns the four pinning strings in `runner-wiring.test.ts` and that one
label, to finish its own change. Evidence: the mutation proof on the runner, and
a whole-suite rerun with 0 failures.

---

# Sixteenth dispatch — after Core is built at `187f40d`

## g-target-union-import — the Flow lane imports Core's target-resolution type (test-runner)

Queued in `g-integration-small-fixes` until Core was built. Core is now built at
`187f40d`.

**Owns:** `packages/test-runner/src/flow-lane/persisted-flow-run.ts` and its test.

**Read:** `reports/g-target-resolution-union.md`; the local copy of the union; the
Core type it mirrors.

**Task.**
- Replace the local copy of Core's target-resolution union in
  `persisted-flow-run.ts` with an import of Core's own exported type, through
  Core's public export path, never a deep `dist` import.
- If Core does not export that type publicly, stop and say so. Do not deep-import.
- No behaviour change.

**Tests.**
- The existing rows still pass.
- The type check should fail if Core's union gains a status the lane does not
  handle. If that check is not possible, say why.
- Test-runner `check`, and `test` in a private `--outDir` at `dist`'s depth; the
  structure audit.

**Report:** `reports/g-target-union-import.md`.

---

# Seventeenth dispatch — Lab Stage 2 starts before the last W19 piece

**Amendment to `l-stage2`, at dispatch.** Dispatched before `w19-d1b` lands, to
save wall-clock; everything else it measures is committed and built.
- `<R>` is `7263534`, and `<C>` is Core `187f40d`.
- Run everything in the brief except W19 `auth-gate --flow --variant expired`,
  whose landing claim needs `w19-d1b`. Skip it in B.
- When the supervisor names the `w19-d1b` commit: move the repository worktrees
  to it, rebuild, prove the pin again, and run W19 `expired` ×3 under the same
  two-instance load.
- For part of the campaign, two workers build and test (domain and test-runner)
  on this machine. Sample memory as `reports/i-lab-campaign.md` Part 3 says, and
  pause the load instance whenever free memory falls below Part 3's floor. Record
  any pause in the report.

**Amendment to `g-w19-docs`, written while `w19-d1b` runs.**
- Also read `reports/w19-d1b.md` and `reports/g-core-action-entry-identity.md`.
- The D1 paragraph must describe both ways a click's landing claim is built: from
  a click recorded as a domain event, and from a click Core recorded as an
  `action` entry, matched by its stored `eventId`.
- It must also say that every unlinked click keeps Core's own candidate.

---

# Eighteenth dispatch — Lab Stage 3, written ahead of need

## l-stage3 — the week1 bench twice, and the provider-free demo (Lab owner)

Dispatched after Lab Stage 2 has reported and the integration gates have passed.
The dispatch names this repository's commit `<R>` and Core's `<C>`, both pushed.

**Owns:** no tracked file in either repository. Worktrees under `F:\fxlab\`
pinned as Stage 2 pinned them; run artifacts under `F:\fxlab-runs\stage3\`;
memory samples in your scratch directory. The "no `pnpm lab`" rule is lifted for
the runs below only, each with `FLUXIQ_TEST_ENV_FILES=none`.

**Read:** `reports/l-stage2.md`, for the pin and the rows it left open; the plan's
Objective and Metrics sections; `reports/v-bench-honesty.md`; `live-validation-plan.md`
step 7.

**Task.**
1. **Pin and prove** as Stage 2 did, at `<R>` and `<C>`.
2. **Bench A, then bench B**, one at a time, with no other Lab instance running:
   `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus week1 --repeat 3 --target isolated`,
   headed as `v-bench-honesty` requires, each with its own report directory.
3. **Compare** A with B on every metric the Metrics section defines, against its
   stated tolerance, and name every metric outside it with both values.
4. **Demo:** `demo:record` then `demo:run`, with no provider configured, and the
   exit of each.

**Report** (`reports/l-stage3.md`), quoted rather than summarised:
- the pin proof;
- both bench reports' paths, exits and headline rates per lane;
- for every exit criterion, the row counts and rates it is judged on;
- the per-row verdicts that differ between A and B;
- the comparison table;
- the demo exits;
- the lowest free memory.

Label every single observation, and rerun a uniform or impossible failure once,
alone, before reporting it.

---

# Nineteenth dispatch — Lab Stage 2 is blocked by the runner's discard check

Found by `l-stage2`, and confirmed by the supervisor on 2026-09-13 from the code:
- The runner's Core action probe (`run-scenario.ts:261`) runs before it starts
  recording (`:273`).
- After any Core-dispatched action succeeds, the extension sends its runtime
  confirmation as a `client.recording_event` with `metadata.runtimeConfirmation:
  true`, whatever the recording state (`server-command-channel.ts:209-237`).
  Core's output confirmation waits for it, so it must be sent.
- With no recording open, Core's bridge discards it and audits an executable
  `recording.action_discarded` naming no recording id (`bridge.ts:479-499`).
  After a recording finalizes, the same echo names that recording.
- `g-recording-completeness` counts a discard from the run's session that names
  no recording as a loss (`flow-lane/recording-discards.ts`). So every Stage 2 run
  failed `recording.persistence` with "2 with no recording id" before measuring
  anything.

Decided: the runner's check is wrong; Core and the extension are not.
- A discard is this run's recording loss only when Core audited it inside the
  window in which this recording could lose a message: from just before the
  runner asks the extension to start recording, until the Flow lane starts
  dispatching. With no Flow lane, the window is open-ended.
- Core's audit wording, which calls a runtime confirmation a lost recorded
  action, is recorded for the Phase 1.6b ranking. Core cannot key on a web-domain
  metadata flag.

## g-discard-window — a discard counts only inside the recording's window (test-runner)

**Owns:**
- `packages/test-runner/src/flow-lane/recording-discards.ts` and its test;
- `flow-lane/run-flow-lane.ts` and its test, only to report when the lane starts
  dispatching the Flow;
- `src/run-scenario.ts`, only the recording-start timestamp and the two discard
  reads;
- `run-evaluation/tests/runner-wiring.test.ts`, only the strings that pin those
  reads.

**Read:**
- `reports/l-stage2.md`, its Notes and its "Blocker diagnosis" section once
  present;
- `reports/g-recording-completeness.md`, T2;
- Core `client-gateway/service/audit-log.ts:14-20`, for each entry's `timestamp`;
- Core `client-gateway/bridge.ts:479-499`.

**Task.**
1. Give `RecordingDiscardScope` a window: `from`, taken just before the runner
   asks the extension to start recording, and an optional `until`.
   - Ignore any discard entry timestamped outside the window, whether it names a
     recording or only the session.
   - An entry with no readable timestamp counts, so the check fails closed.
2. `run-flow-lane.ts` reports the time just before it dispatches the Flow run,
   and `run-scenario.ts` passes that as `until` to the second read.
3. Keep everything else that T2 and the completeness check do.

**Tests.** Each case needs a mutation proof.
- A pre-recording action discard naming no recording is ignored.
- One inside the window counts.
- A discard naming the recording, timestamped after the Flow lane began
  dispatching, is ignored; one timestamped before that counts.
- An entry with no timestamp counts.

Then run test-runner `check`, `test` in a private `--outDir` at `dist`'s depth,
and the structure audit.

**Report:** `reports/g-discard-window.md`.

---

# Twentieth dispatch — from `w19-d1b`

Decided on `reports/w19-d1b.md`'s open questions:
1. The read-depth defect is fixed now, by `g-mapper-stored-payload` below.
2. An action-entry click's claim on its own page's path stays: it passes on
   replay, so it can never fail a run. Restoring the exclusion needs a Core or
   extension field, which is Week 2.
3. Core's fallback label stays.
4. The domain mirrors Core's fallback for a linked click, guarded by the drift
   row. Core accepting a mapper's `expectedState` for its own fallback is
   Week 2.
5. An `AutomationStudioService` without `dataDir` writes into the working
   directory. This goes to the Phase 1.6b ranking; the supervisor removed the
   probe's `recordings/` and `indexes/`.

## g-mapper-stored-payload — the mapper reads a stored domain event where Core puts it (domain)

Dispatched once `w19-d1b` is committed, since both edit `web-panel-host.ts`.

**Owns:**
- `domain/src/web-panel-host.ts`, `recordedEventPayload` and `storedStep` only;
- a new test file in `domain/src/tests/`, which you name, since `domain.test.ts`
  is at its 400-line advisory limit;
- the existing rows that build a domain event one level shallower than Core
  stores it, in `runtime/expectation/tests/click-landing.test.ts`,
  `recording/proposals/tests/late-target-wait.test.ts` and
  `tests/domain.test.ts`.

**Read:** `reports/w19-d1b.md`, open question 1 and its probes; Core
`model/recording-domain.ts:186-203`.

**Task.**
1. Read a Core-stored domain event's own payload from inside its
   `{ target?, payload }` wrapper, and fold `storedStep` back into the one
   reader.
2. Rebuild every row that feeds the mapper a domain event in the shape Core
   stores. Prefer running a recording through Core, as `w19-d1b`'s Core row does.
3. For each of these, say what changes, with a Core-shaped row:
   - a click sent as a domain event (D1);
   - W25's URL check on the evidence between an addition and its click;
   - a recorded navigation's `web.browser.navigate` proposal.
4. From the week1 manifests, list which rows record events that reach the mapper
   as domain events rather than action entries, and what each gains or loses.

**Tests.**
- Pin each changed behaviour with a Core-shaped row. The mutation proof is
  restoring the shallow read.
- Run domain `check` and `test` under a private label, and the structure audit.

**Report:** `reports/g-mapper-stored-payload.md`.

---

# Twenty-first dispatch — Lab Stage 2 again, written ahead of the fix commits

**Amendment to `l-stage2`, for its redispatch.** Sent to the same Lab worker once
three changes are all committed: `g-discard-window`, `g-discard-window-evidence`
and `g-mapper-stored-payload`. The message names `<R2>`, the first commit holding
all three. For every run, quote each discard read's published window bounds and
excluded counts, so a pass shows the probe and Flow-lane confirmations excluded
by the window rather than merely absent.
- **Pin.** `<R2>` for this repository, and Core `5845f5d`. That adds only the
  0.4.0 version and migration note to the `187f40d` Stage 2 used. Move both
  repository worktrees to `<R2>`, rebuild, and prove the pin again before any
  run.
- **Runs.** Everything in the brief as amended, W19 `expired` included, with
  step 4b judged per run: `exit=0`, `candidateCount` 4, equal `recordedActions`,
  zero windowed discards, and entry counts reported rather than compared.
- **The discard check is windowed now.** A probe or Flow-lane confirmation must
  not fail a run. If one does, stop and report it with the audit entries' types,
  labels, recording ids and timestamps. Never skip or patch the check again.
- **Report.** Append to `reports/l-stage2.md` under a new heading, "Second
  attempt". Keep the first attempt and the blocker diagnosis above it unchanged.

## g-discard-window-evidence — a run shows what the discard window excluded (test-runner)

Dispatched once `g-discard-window` is committed, while `g-mapper-stored-payload`
still runs. Stage 2 waits for both anyway, so this adds no delay.

**Owns:** `packages/test-runner/src/flow-lane/recording-discards.ts` and its test;
`src/run-scenario.ts`, only the two `runtime.settle` events that carry
`recordingDiscards`; `run-evaluation/tests/runner-wiring.test.ts`, only pins that
the change moves.

**Read:** `reports/g-discard-window.md`, open question 1 and the failure text
note.

**Task.**
1. **Publish the window in both discard reads' `runtime.settle` details:**
   - its `from`, and its `until` when set;
   - a count of the entries it excluded, grouped by audit type, and by whether
     each names this run's recording, no recording, or another one.
   Never include an entry's message, label, input id or anything else a page
   could supply.
2. **Make the failure text match what the check now judges:**
   - a lost action inside this run's recording window;
   - naming "no recording id" when that is so;
   - saying "after finalization" only when `sinceFinalizedMs` says so.

**Tests.**
- Rows for the published counts and bounds, and for each failure wording, each
  with a mutation proof.
- Test-runner `check`, and `test` in a private `--outDir` at `dist`'s depth.
- The structure audit.

**Report:** `reports/g-discard-window-evidence.md`.

---

# Twenty-second dispatch — correction from `g-mapper-stored-payload`

`g-mapper-stored-payload` found that its brief's premise was wrong. The supervisor
confirmed it in Core's code: `model/recording-domain.ts` stores each domain event
twice.
- **As a `domain_event` entry** (`:187`), whose own payload sits inside
  `{ target?, payload }`.
- **As an `observation` entry**, through the domain's `observationExtractor`
  (`:228-237`), with the payload one level up.

The mapper already reads the observation copy. So on a real recording three
things already work, once each:
- D1's domain-event click claim;
- W25's URL check on the evidence between an addition and its click;
- a navigation proposal.

Reading the entry as well proposes every executable domain event twice. The
worker's mutation M1 shows it: 4 rows fail.

Decided:
- **Task 1 is withdrawn,** and the mapper's reader stays as it is. The worker's
  Core-run rows and the moved domain-event rows are kept, in
  `domain/src/tests/web-panel-host.test.ts`.
- **The records built on the wrong premise are corrected.** They are:
  - `reports/w19-d1b.md` open question 1;
  - the twentieth dispatch's "read-depth defect";
  - the `w19-d1b` and `g-w19-docs` ledger entries, now in the archive.

  The ledger records the correction. The architecture pages never stated the
  premise; a search of `docs/architecture/` for it finds nothing.
- **`l-stage2`'s redispatch no longer waits for a mapper change.** It waits for
  `g-discard-window-evidence`. The message names the first commit that holds both
  that change and this test change.

---

# Twenty-third dispatch — from Lab Stage 2's second attempt

From `reports/l-stage2.md` "Second attempt": 157 runs at `6c22e22` with Core
`5845f5d`, all `dirty=false`.
- **Passed:** step 4b 23 of 24 under load; W10, W27, `sensitive-input` and W24,
  3 of 3 each alone; smoke gate 5.0 equivalent.
- **Failed:** W18 0 of 3; W19 0 of 3; W25 0 of 3, and `too-slow` 0 of 3; the week1
  bench passed 37 of 67.

Decided:
- **Security first.** The auth-gate declared secret reached Core's persisted
  workspace: 13 objects per Flow-lane run, and 6 on a recording-lane run. It is
  investigated before any other auth-gate work, by the Lab owner, who has the
  environment.
- **W18's and W09's Flow-lane extraction expectation is unreachable.** A
  recording's `extract` step is the runner's own check, not a user action, so no
  extract node can be proposed. The Flow lane stops judging it; the recording
  lane keeps it.
- **W19's `comparisonStatus` is supplementary.** Its category proof holds: the
  click `failed`, and `auth_required` 3 of 3. The Flow lane will publish the
  attempt's comparison status, so the next run can quote it.
- **A single failed gateway snapshot read must not fail a run** that met its
  expectations. The second discard read retries once before failing closed.
- **Step 4b's "zero windowed discards" means zero windowed action discards.**
  Evidence discards inside the window, from a page unloading after Stop, are
  reported, not judged.
- **W25's live failure and the bench's 30 failing rows are investigated** before
  any fix.

## i-secret-in-workspace — where the declared auth-gate secret enters Core's workspace (Lab owner, read-only)

Sent to the `l-stage2` worker, resumed.

**Owns:**
- `reports/i-secret-in-workspace.md`;
- a temporary local edit in its own worktree only, reverted and proven clean, to
  keep a run's isolated Core workspace instead of deleting it;
- runs under `F:\fxlab-runs\secret\`.

**Task.**
1. Run `auth-gate --flow` once and the recording-lane `auth-gate` once, alone,
   keeping each Core workspace.
2. For every Core object the redaction attestation flags, report three things:
   - its kind: recording, timeline entry, proposal, Flow, run record, trace,
     evidence packet, audit log, or other;
   - the JSON key path that holds the value;
   - the code that writes it, with file:line in this repository or Core.
3. Say whether the value came from the recording (typed into the field) or from
   the declared secret supplied to the Flow run.
4. Never print, hash or partially quote the value. Report key paths, kinds and
   counts only.
5. End with a fix design partitioned by file, with the proof each change needs.

## i-bench-triage — why 30 of 67 week1 bench rows failed (read-only)

**Owns:** `reports/i-bench-triage.md` only.

**Read:** `reports/l-stage2.md` "The week1 bench result"; the bench bundle under
`F:\fxlab-runs\stage2b\`; `packages/test-runner/src/bench/corpus/week1.ts`.

**Task.**
1. For every failing row, lane and variant, give the failure category and code,
   and the root cause with bundle evidence and file:line.
2. Classify each failure as one of:
   - a product defect;
   - a harness or expectation defect;
   - environment (a single observation);
   - already fixed by a named decision of this dispatch.
3. Explain the recording lane's `initialExecutionSuccess` of 0.174 and the Flow
   lane's `falseSuccess` of 0.167.
4. Rank the product defects by corpus impact, as the input to Phase 1.6b.

## i-w25-live-wait — why a live `delayed-ui` recording proposes no wait (domain, read-only)

**Owns:** `reports/i-w25-live-wait.md`, and scratch probes outside every tree.

**Read:**
- `reports/i-late-target-wait.md`, `reports/w25-wait-mapper.md` and
  `reports/g-mapper-stored-payload.md`;
- the stage2b `delayed-ui` bundles;
- `domain/src/tests/web-panel-host.test.ts`, for how a row runs a recording
  through Core.

**Task.**
1. Use the bundles, and a probe that runs the recorded shape through Core's
   proposal generation.
2. Find which condition of the wait rule fails on a live recording:
   - the mutation observation's type;
   - its `latestEvidence`, or `added`;
   - its order against the click;
   - the click's `selector` or frame;
   - the between-evidence URL check.
3. Give the fix design partitioned by file, with a Core-run row as its proof.

## g-flow-lane-expectations — three runner corrections from Stage 2 (test-runner)

**Owns:**
- the Flow lane's extraction expectation and its test (name the file);
- `flow-lane/persisted-flow-run.ts` and its test, for the attempt's comparison
  status;
- `src/run-scenario.ts`, the second discard read's snapshot fetch only;
- `run-evaluation/tests/runner-wiring.test.ts`, only the pins these changes
  move.

**Read:** `reports/l-stage2.md` "Second attempt: outcome", and its open questions
2, 3 and 5.

**Task.**
1. The Flow lane does not judge a workflow's extraction expectation unless the
   generated Flow contains an extract node. It records that the expectation did
   not apply, and the recording lane still judges it.
2. The persisted Flow-lane record carries each attempt's transition comparison
   status, when Core reports one.
3. The second discard read retries a failed gateway snapshot fetch once, before
   it fails closed.

**Tests.**
- One row for each change, with a mutation.
- Test-runner `check`, and `test` in a private `--outDir` at `dist`'s depth.
- The structure audit.

**Report:** `reports/g-flow-lane-expectations.md`.

---

# Twenty-fourth dispatch — closing the auth-gate secret leak

From `reports/i-secret-in-workspace.md`, confirmed by the supervisor in code. The
auth-gate declared secret reaches Core's workspace by three routes, none of them
typing:
- **the fixture** renders it as page text (`auth-gate/pages.ts:21-26`);
- **the runner** sends it twice as Flow run inputs (`run-flow-lane.ts:133`), which
  Core persists in the session metadata (`runtime/service.ts:2832`) and in
  `runDetailEnvelope` (`storage/project/runtime-stream-store.ts:509-520`);
- **Core** saves each command attempt whole, resolved parameters included
  (`packages/fluxiq/src/runtime/storage.ts:51-52`).

The redaction attestation also skips SQLite, where 4 more rows held it.

Decided:
- Fixes 1-5 of the report's design are taken.
- Fix 6, a sensitive-display rule in the domain, goes to the Phase 1.6b ranking.
  A page that labels a secret-bearing display element is not a Week 1 case.
- Fixes 3 and 4 cross into Core. The user was told the areas, the reason and the
  compatibility effect before dispatch.

## f-authgate-fixture — the sign-in page stops showing its password (scenario-lab)

**Owns:** `apps/scenario-lab/src/scenarios/auth-gate/pages.ts` and that scenario's
tests.

**Read:** `reports/i-secret-in-workspace.md` fix 1.

**Task.** Stop rendering the demo password as page text. Drop its `<dd>`, or show
a fixed placeholder. Keep whatever the recording script and oracle still need.

**Tests.**
- A scenario test that the rendered sign-in HTML does not contain the password
  constant, with a mutation that restores the `<dd>`.
- Scenario-lab `check` and `test`.
- The structure audit.

**Report:** `reports/f-authgate-fixture.md`.

## g-attestation-sqlite — the leak check scans the databases it skipped (test-runner)

**Owns:** `packages/test-runner/src/secret-leak-attestation.ts`,
`redaction-attestation/run-redaction-scopes.ts`, and their tests.

**Read:** `reports/i-secret-in-workspace.md` fix 5.

**Task.**
1. A workspace scope scans a SQLite database and its `-wal` and `-shm` files for
   each literal, as UTF-8 and as UTF-16LE, instead of counting them as skipped
   binary.
2. A file that cannot be scanned is reported as an `unscanned-store` finding, not
   only as a count.
3. Never print, hash or partially quote a literal.

**Tests.**
- A row planting a literal inside a real SQLite file or a byte-level fixture,
  asserting a finding, with a mutation that restores the binary skip.
- Test-runner `check`, and `test` in a private `--outDir` at `dist`'s depth.
- The structure audit.

**Report:** `reports/g-attestation-sqlite.md`.

## f-runner-secret-input — the Flow run gets each secret once (test-runner)

Dispatched once `g-flow-lane-expectations` is committed, since both edit
`run-flow-lane.ts`.

**Owns:** `packages/test-runner/src/flow-lane/run-flow-lane.ts`, the run's
`inputs` only; `flow-lane/declared-secrets.ts` and its test.

**Read:** `reports/i-secret-in-workspace.md` fix 2.

**Task.** Send only the binding inputs keyed `web.secret.*`. Remove
`declaredSecretFlowInputs` from the run's inputs, and remove the function too if
nothing else calls it.

**Tests.**
- A wiring row asserting that the inputs passed to `executeRecordedFlowRun` hold
  no secret-id key, with a mutation that re-adds the spread.
- Test-runner `check`, and `test` in a private `--outDir`.
- The structure audit.

**Report:** `reports/f-runner-secret-input.md`.

## g-core-input-withholding — Core persists run inputs withheld (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
- `runtime/service.ts`, the run session's persisted `metadata.inputs` only;
- `storage/project/runtime-stream-store.ts`, `runDetailEnvelope` only;
- their tests;
- `F:\!FluxIQ\docs\architecture\package-boundaries.md`, a paragraph in the
  unreleased `0.4.0` Migration Notes entry.

Follow `F:\!FluxIQ\AGENTS.md`. `service.ts` must not grow past its baseline.

**Read:** `reports/i-secret-in-workspace.md` fix 3; Core
`runtime/executor/trace-withholding.ts`, for `AUTOMATION_STUDIO_WITHHELD_VALUE`
and the reasoning at `:29-34`.

**Task.**
1. Persist a run's supplied inputs with every value replaced by the withheld
   marker, keeping the keys, in both places. The unwithheld inputs stay in memory
   for the run only.
2. Say which readers of `metadata.inputs` or run-detail `inputs` exist in Core,
   `apps/web` included, and what each now sees.

**Tests.**
- A service row: a run with inputs persists the marker in the session record and
  every runtime event chunk, never the value.
- A stream-store row for `runDetailEnvelope`.
- Each with a mutation that restores `inputs: input.inputs`.
- `npx vitest run <files> --no-file-parallelism`; Core `pnpm check`;
  `pnpm docs:check`, plus `pnpm docs:reference` if a cited line moves.
- No Core `pnpm build`.

**Report:** `reports/g-core-input-withholding.md`, with the compatibility effect.

## g-core-attempt-withholding — Core's saved command attempts withhold resolved values (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\`):
- `runtime/service.ts` (the framework runtime, not automation-studio's), its
  command-attempt persistence only;
- `runtime/storage.ts` if needed;
- `programs/automation-studio/runtime/executor/node-execution.ts` and
  `executor/trace-withholding.ts`, only for carrying the withholding to dispatch;
- their tests.

Follow `F:\!FluxIQ\AGENTS.md`. Put the Migration Notes paragraph in your report,
not in `package-boundaries.md`, which `g-core-input-withholding` owns.

**Read:** `reports/i-secret-in-workspace.md` fix 4; Core
`executor/trace-withholding.ts:29-34,83-96`.

**Task.**
1. Carry the executor's record of what state resolution supplied into the
   dispatched command, as a generic dispatch-context field. The framework must
   not learn `web.secret.`.
2. The framework runtime replaces those values in the saved attempt's
   `command.parameters`, and in any prose in `result.message`, with the withheld
   marker before it persists the attempt. An authored parameter persists
   unchanged.

**Tests.**
- A runtime row: a command whose parameter came from a `$state` binding saves the
  marker at `command.parameters.text`, while an authored one is kept.
- An executor row proving the withholding reaches dispatch.
- Mutations: skip the rewrite, then drop the context.
- `npx vitest run <files> --no-file-parallelism`; Core `pnpm check`;
  `pnpm docs:check`.
- No Core `pnpm build`.

**Report:** `reports/g-core-attempt-withholding.md`, with the compatibility
effect.

---

# Twenty-fifth dispatch — from `i-bench-triage`

Verified by the supervisor on 2026-09-13:
- **P1.** The `keydown` listener emits without `flushPendingInput()`, which the
  pointer, input and change listeners all call
  (`content/dom-events.ts:116-131`).
- **P3.** A signature is suppressed for 750 ms whatever arrives, so a second real
  click on the same unmoved control is dropped
  (`background/connection/pointer-click-filter.ts:4-19`).
- **P2.** There is no confirmation branch for `web.dom.check`
  (`background/connection/runtime-status.ts:93-107`).
- **H2.** `scenarioRequiresCore` is true only when a workflow pins recording
  events, actions or a playback goal (`packages/test-runner/src/scenarios.ts:25-27`).

Decided:
- P1, P2, P3 and the harness defects H1-H7 are fixed now.
- P4 (a tab switch or close) and P5 (a file input mapped to typing) are designed
  first. W15 and W17 are in criterion 1's W01-W19 set, but they need recording
  capabilities.
- P6 (a child frame id after reload) and P7 (an optional dismissal) are designed in
  the same investigation. Otherwise they go to the Phase 1.6b ranking.
- A Flow-lane row that built no Flow must never pass. The bench's 37 passes
  overstate by 6.

## f-recorder-key-order-and-check-confirmation — P1 and P2 (extension)

**Owns:** `apps/extension/src/content/dom-events.ts` or `content/recorder.ts` for
P1 (name which), `background/connection/runtime-status.ts` for P2, and their
tests.

**Read:** `reports/i-bench-triage.md` P1 and P2.

**Task.**
1. **P1.** A pending debounced `dom.input` is emitted before any `dom.keydown`
   that follows it, as it already is before a click or change. No other
   ordering changes.
2. **P2.** A succeeded `web.dom.check` returns the runtime confirmation for the
   input its recorded check maps to (see `domain/src/io/input-model.ts`). It
   carries no value from a sensitive control.
3. Say which other executable verbs have a recorded node that expects a
   confirmation but get none. Do not fix them.

**Tests.**
- **P1:** typing then Enter emits `dom.input` before `dom.keydown`, with a mutation.
- **P2:** a succeeded check yields its confirmation and a failed one yields none,
  with a mutation.
- Extension `check` and `test` under a private label; the content-harness recorder
  spec, if one exists; the structure audit.

**Report:** `reports/f-recorder-key-order-and-check-confirmation.md`.

## f-pointer-click-pairing — P3, a quick second click is kept (extension)

**Owns:** `apps/extension/src/background/connection/pointer-click-filter.ts`, and
`recorded-event-intake.ts` for its use of the filter only; their tests.

**Read:** `reports/i-bench-triage.md`, P3 and W14's evidence.

**Task.** A `pointerdown` and the `click` it produces stay one recorded action.
A second activation of the same unmoved control is a second action, however soon
it comes.
- Pair each click with its own pointerdown, for example by event order in its
  frame, instead of suppressing a signature for a fixed window.
- Say what a keyboard-activated click and a synthetic click now do.

**Tests.**
- A pointerdown and its click record one action.
- Two pointerdown-click pairs 250 ms apart record two.
- A click with no pointerdown records one.
- Each of the three rows above has a mutation.
- Extension `check` and `test` under a private label, and the structure audit.

**Report:** `reports/f-pointer-click-pairing.md`.

## g-runner-harness-fixes — H1, H2, H3 and H5 (test-runner)

**Owns:**
- `packages/test-runner/src/scenarios.ts`;
- `src/run-scenario.ts`, only the regions H1, H2, H3 and H5 name;
- the extraction record reader H1 names (name the file);
- `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts`, only if H1 needs
  it;
- their tests, and `run-evaluation/tests/runner-wiring.test.ts` for only the pins
  these move.

`f-runner-secret-input` owns `run-flow-lane.ts`. If H2 needs it, stop and say
what.

**Read:** `reports/i-bench-triage.md`: H1, H2, H3, H5, and the two rates.

**Task.**
1. **H2.** A Flow-lane run always gets a Core identity, and a Flow-lane run that
   built no Flow fails instead of passing.
2. **H3.** The Core probe types only into a `type` step whose target is on the
   page the recording starts on. Otherwise it is skipped, with the reason
   published.
3. **H5.** A negative variant is not judged on its primary workflow's
   playback-goal success facts.
4. **H1.** The recording lane's final state stops requiring pagination the lane
   does not follow. Say whether the runner now follows it, or the manifest stops
   claiming it.

**Tests.**
- One row for each fix, with a mutation.
- Test-runner `check`, and `test` in a private `--outDir` at `dist`'s depth.
- Scenario-lab `check` and `test`, if the manifest changed.
- The structure audit.

**Report:** `reports/g-runner-harness-fixes.md`.

## g-bench-expectation-fixes — H4 and H7 (test-runner)

**Owns:** `packages/test-runner/src/flow-lane/expectations.ts` and its test;
`bench/read-run-bundle.ts`, `bench/run-bench.ts` and their tests.

**Read:** `reports/i-bench-triage.md` H4 and H7.

**Task.**
1. **H4.** An expected action with no `outcome` is judged on its presence only,
   never as `succeeded`.
2. **H7.** A bench row's failure message is the one belonging to its failure
   category, not the last `error` event's. If that needs `run-scenario.ts`, stop
   and say what, since `g-runner-harness-fixes` owns that file.

**Tests.**
- One row for each fix, with a mutation.
- Test-runner `check`, and `test` in a private `--outDir`.
- The structure audit.

**Report:** `reports/g-bench-expectation-fixes.md`.

## g-manifest-extract-entries — H6 (scenario-lab)

**Owns:** `apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts` and
`multi-tab/manifest.ts`, the `expected.actions` entries only, and their tests.

**Read:** `reports/i-bench-triage.md` H6; the twenty-third dispatch's extraction
decision.

**Task.** Remove each `web.dom.extract` entry in `expected.actions` that no
recording can produce, and keep the recording lane's extraction checks. Say what
each row's Flow lane now asserts.

**Tests.**
- Each scenario's test pins the corrected actions, with a mutation.
- Scenario-lab `check` and `test`.
- The structure audit.

**Report:** `reports/g-manifest-extract-entries.md`.

## i-recording-capability-gaps — P4, P5, P6 and P7 (read-only design)

**Owns:** `reports/i-recording-capability-gaps.md` only.

**Read:** `reports/i-bench-triage.md` P4-P7, and the rows they fail.

**Task.** For each defect, give:
- the root cause, with file:line;
- a fix design partitioned by file across extension, domain and Core;
- the blast radius on every week1 row;
- the unit, content-harness and Lab proof it needs;
- whether it belongs in Week 1. W15 and W17 are in criterion 1's W01-W19 set;
  W28 and W13 are not.

Recommend an order.

## g-core-attempt-withholding, redispatched — the whole dispatch chain (Core)

The first dispatch was blocked, correctly. Its brief owned the two ends of the chain
but not the three files between them, so an edit to the owned files would have
done nothing. Its report holds the design this redispatch adopts.

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\`), besides the first brief's files:
- `runtime/contracts.ts`: the dispatch-context field and the framework's marker;
- `runtime/index.ts`: a barrel line, only if the marker needs one;
- `programs/automation-studio/runtime/executor/contracts.ts`: the `effectDispatcher`
  context type;
- `programs/automation-studio/runtime/io-policy.ts`: forwarding the field;
- `programs/automation-studio/runtime/tests/io-bridge.test.ts` or
  `io-policy.test.ts`: the end-to-end row;
- `F:\!FluxIQ\docs\architecture\runtime-kernel.md`, "Persistence" only.

`g-core-input-withholding` still owns `package-boundaries.md` and
automation-studio's `runtime/service.ts`.

**Read:** `reports/g-core-attempt-withholding.md`, all of it.

**Decided:**
1. Build the design in the report's "Design, partitioned by file".
2. Withhold when the attempt is built, so the attempt in memory and on disk agree.
3. Withhold `result.message`, `result.error` and `attempt.message`.
4. The framework owns the marker, and Automation Studio's constant aliases it.
5. Say whether `result.payload` can carry a resolved value, but do not change it.
6. Say whether anything in `F:\!FluxIQWebExtension` reads a saved attempt's
   parameters or messages (read-only).

**Tests:** the report's three rows, each with its mutation.
- `npx vitest run <files> --no-file-parallelism`;
- Core `pnpm check`, `pnpm docs:check`, and `pnpm docs:reference` if a cited line
  moves.
- No Core `pnpm build`.

**Report:** append a "Redispatch" section to `reports/g-core-attempt-withholding.md`,
with the Migration Notes paragraph as finally built.

---

# Twenty-sixth dispatch — from `i-w25-live-wait`

Decided by the supervisor on 2026-09-13:
- **W25 fails on storage order, inside Core's gateway bridge.** Core's WebSocket
  host handles one client's messages concurrently. The bridge flushes queued state
  snapshots before an evidence update but not before a recorded event, so a late
  click is stored ahead of the page change that revealed it.
- **The fix is the report's design items (a) and (b) together,** in the bridge. It
  does not go in `ClientGatewayInbound` or in the WebSocket adapter. The domain wait
  rule, the recorder flush and the manifest stay as they are.
- **The Core-run row goes in the domain,** as a sibling test file. It builds the
  evidence message with the domain's builders, copying the metadata
  `recording-evidence.ts` sends and citing those lines.

## g-core-bridge-order — a client's recording messages are stored in arrival order (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\client-gateway\`):
- `bridge.ts`;
- new focused modules beside it;
- `index.ts`, only if a new export is needed;
- `tests/bridge.test.ts`, and tests for any new module;
- `F:\!FluxIQ\docs\architecture\automation-studio\client-gateway.md`: the order
  guarantee only.

`bridge.ts` is 796 lines against an 800-line budget. Move the ordering into a
focused module; don't squeeze it in. Follow `F:\!FluxIQ\AGENTS.md` and Core's code
structure. Put the migration-note line in your report, since
`g-core-input-withholding` owns `package-boundaries.md`.

**Read:** `reports/i-w25-live-wait.md`: Task 3 items 1-3, and open questions 3 and 5.

**Task.**
1. Build (a) one ordered chain per recording owner, with Stop waiting for it after
   its drain, and (b) a flush before every direct append.
2. Say whether any proposal's `stateLink`, or anything else that reads a state
   beside an action, changes now that snapshots are stored in arrival order.

**Tests.**
- The report's three rows, each with its mutation. The existing late-discard and
  ordered-start rows still pass.
- `npx vitest run <client-gateway and recording test files> --no-file-parallelism`;
  Core `pnpm check`; `pnpm docs:check`, and `pnpm docs:reference` if a cited line
  moves.
- No Core `pnpm build`.

**Report:** `reports/g-core-bridge-order.md`, with the compatibility effect.

## f-w25-core-order-row — the live W25 messages through Core's gateway (domain)

**Owns:** one new test file in `domain/src/tests/`, which you name. Nothing else.

**Read:** `reports/i-w25-live-wait.md` Task 3 item 4. Its probe is in the
scratchpad folder `iw25\` that the report names.

**Task.**
1. Write the row the report describes: 8 messages received as Core's WebSocket
   host delivers them, then the assertions on entries, the compaction issue and
   the `web` candidates.
2. Run it against Core as built now, five times. It must fail with 2 candidates
   every time. Do not skip it or mark it expected-to-fail; the supervisor commits
   it once Core's fix is built.
3. Say how long it takes, and whether it leaves any data directory behind.

**Tests.** Domain `check`; the new file under a private
`DOMAIN_TEST_BUILD_LABEL`, removed afterwards; the structure audit. Never regenerate
the tracked `domain/.test-build`, and never build Core.

**Report:** `reports/f-w25-core-order-row.md`.

## g-attestation-sqlite-reader — the leak check reads SQLite, not only its bytes (test-runner)

`g-attestation-sqlite` reported that a raw byte scan misses a literal SQLite has
split across pages: 29 of 101 test positions. A leak check that can miss a leak
cannot prove 0, so the reader is Week 1 work.

**Owns:** `packages/test-runner/src/secret-leak-attestation.ts`, a focused module
beside it if the reader needs one, and their tests. The file already carries
`g-attestation-sqlite`'s uncommitted diff; build on it and keep it.

**Read:** `reports/g-attestation-sqlite.md`.

**Task.**
1. Also read every text and blob cell of every table in each database the scope
   finds. The raw scan stays, since it covers freed pages and `-wal` frames.
2. Choose the reader and say why. Node 22.11's `node:sqlite` needs
   `--experimental-sqlite`, for example in a child process; a SQLite module
   already in this workspace's lockfile is the other option. If a new dependency
   is needed, stop and report.
3. A database the reader cannot open is an `unscanned-store` finding. Say what a
   database over the byte limit now gets, including in the demo attestations'
   1 MB default.
4. Say whether each Lab run gets a fresh Core workspace, so that an earlier run's
   leak cannot fail a later run.
5. Never print, hash or partially quote a literal.

**Tests.**
- Every split position the raw scan misses is found, with a mutation that turns
  the reader off.
- Test-runner `check`, and `test` in a private `--outDir`.
- The structure audit.

**Report:** `reports/g-attestation-sqlite-reader.md`.

## Amendment to `g-core-attempt-withholding` (redispatched), from `g-core-input-withholding`

`g-core-input-withholding` found, with a temporary probe, that a run input no Flow
node reads is still saved in clear, in two places:
- the session record's `trace.values`;
- each attempt's `inputs`.

The withholding records only values that state resolution supplied. The seed is
at `executor/graph-run.ts:30`.

**Owns, in addition:** `programs/automation-studio/runtime/executor/graph-run.ts`,
and its test.

**Task.** Every value a caller supplied as a run input is withheld wherever the
trace or an attempt saves it, whether or not a node reads it. An authored value is
kept. Say whether this changes what the runtime dispatch context carries.

**Tests.**
- A row where a supplied input that no node reads is absent from `trace.values`
  and from the attempt's `inputs`, and the marker holds its place.
- A mutation that restores the resolution-only seed.

## g-expected-action-guard — an expected action a recording cannot produce fails the check (test-runner, scenario-lab)

Dispatched once `g-bench-expectation-fixes` has reported, since both edit
`flow-lane/expectations.ts`.

`g-manifest-extract-entries` removed the unreachable `web.dom.extract` entries from
W11 and W15, and found the same entry in `admin-console/manifest.ts:143`. A
written rule did not stop the defect, so a check should.

**Owns:**
- `packages/test-runner/src/flow-lane/expectations.ts`, or the test-contracts
  scenario validator (say which, and why);
- `apps/scenario-lab/src/scenarios/admin-console/manifest.ts`, `expected.actions`
  only;
- their tests.

**Task.**
1. A workflow whose `expected.actions` names an action type that no step of its
   recording script can produce is rejected as a harness defect. It must never
   surface as a product failure.
2. Correct `admin-console`.
3. Say which other manifests the check flags.

**Tests.**
- A row that is rejected, and one that is accepted, with a mutation that removes
  the check.
- The package gates, and the structure audit.

**Report:** `reports/g-expected-action-guard.md`.

---

# Twenty-seventh dispatch — the Lab rerun after the fixes (drafted; dispatched after the Core build)

The supervisor names both pins at dispatch. The pins are this repository's commit
and Core's commit, built with every fix from the twenty-fourth to twenty-sixth
dispatches committed.

## l-stage2c — W18, W19 and W25 three times each, then the week1 bench once

**Owns:** `reports/l-stage2c.md`, the Lab worktrees under `F:\fxlab\`, and ignored
run directories. Nothing tracked.

**Read:** `reports/l-stage2.md`, the "Second attempt" setup and outcome;
`reports/i-secret-in-workspace.md`, how Core's workspace was kept and searched.

**Setup.** Move both worktrees to the named pins, then:
- build Core in its worktree;
- install only if the lockfile changed;
- rebuild this repository's shared builds in the Lab worktree before any run:
  `domain/dist`, `packages/test-contracts/dist` and `apps/scenario-lab/dist`.
  A stale `apps/scenario-lab/dist` failed 8 test-runner tests once the scenario
  validator gained a rule. Name each build's exit code in the report;
- run everything with `FLUXIQ_TEST_ENV_FILES=none`.

**Runs.** Each row is a single observation unless it repeats.
1. **`auth-gate` primary (W18), both lanes, ×3, with Core's workspace kept.**
   - The leak attestation reports `findingCount` 0 on both lanes, with no
     `unscanned-store` finding.
   - The password node reports `web.dom.type:succeeded`.
   - A search of the kept workspace, SQLite included, finds the declared value 0
     times. Report paths and counts only.
2. **`auth-gate` `expired` (W19), both lanes, ×3:** the expected verdicts, and
   `auth_required` where the manifest says so.
3. **`delayed-ui` (W25):**
   - `--flow` ×3: `candidateCount` 3, and click, wait, click all `succeeded`;
   - `--variant too-slow` ×3: `timeout`, with the wait `failed`.
4. **W15 unarmed and `popup-blocked`, W17 and W28, on the Flow lane, ×3 each.**
   - **W15:** the tab actions succeed, and `popup-blocked` still reports
     `output_not_observed`.
   - **W17:**
     - `web.dom.upload` succeeds, then `web.dom.click` succeeds, with no
       `web.dom.type`;
     - Core's workspace is kept;
     - a search of it, SQLite included, finds the supplied file's content and name
       0 times.

     The leak attestation does not look for upload content, so search directly.
   - **W28:** both frame clicks succeed after the start-page load.
5. **`pnpm lab bench --corpus week1 --repeat 1 --target isolated`, once.**
   - For each row whose verdict differs from Stage 2's 37 of 67, name the fix that
     explains it.
   - Name any row that regressed.
   - Report `recordedActions`, extension against Core, and
     `discardsAfterFirstRead`.

**Expected changes the report must still record,** not treat as regressions:
- **W05 and W07 recordings now hold Next clicks,** because `g-runner-harness-fixes`
  made the recording lane follow pagination.
- **W05 `short-catalog` may fail `target_not_found` on the Flow lane.**
  - The armed catalog shows no Next, and a recorded Flow replays fixed clicks.
  - Report the failed node and its category. The supervisor then decides how the
    row is judged.

**Stop** after run 1 if any leak count is above 0, and report it.

**Report:** `reports/l-stage2c.md`: the pins, commands, observed figures, and
single observations labelled as such.

---

# Twenty-eighth dispatch — from `i-recording-capability-gaps`

Decided by the supervisor on 2026-09-13:
- **P5 (W17), P4 (W15) and P6 (W28) are Week 1,** in that order of value.
  - W15 and W17 are in criterion 1's set.
  - P6 is small and needs no Core change.
- **P7 (W13 `banner-absent`) is ruled out of Week 1:**
  - it needs a new Core node outcome, which is a public trace change, on the
    `failureRoute` seam already deferred;
  - a loose dismissal rule would let W12 skip sending its invite and still report
    success.
- **The recorder stops sending a file input's value** (open question 2).
- **W17 will pin `web.dom.upload`** (open question 3), in the runner upload worker.
- **Two workers are briefed once their files are free:**
  - after `f-recorder-key-order-and-check-confirmation` reports, the upload and tab
    confirmations in `runtime-status.ts`. Its task 3 answer decides whether they
    join one table fix (open question 1).
  - after `g-runner-harness-fixes` reports, the runner's upload input.
- **The architecture pages are updated in one pass once these land.**
- **The twenty-seventh dispatch's Lab rerun waits for this dispatch too.** It adds
  W15 unarmed and `popup-blocked`, W17, and W28, three times each.

**The wire names, fixed here so the parallel workers agree:**
- the recorded payload's `tab: { operation: "switch" | "close"; urlPath?: string }`;
- the inputs `web.user.tab_switched`, `web.user.tab_closed` and
  `web.user.files_chosen`;
- `urlPath` on the tab switch request, as an exact pathname;
- `frameUrlPath` on `WebAutomationActionCommand`, lifted from the node parameter
  `browserFrameUrlPath`.

## f-domain-capability-gaps — upload, tab and frame mapping (domain, serial)

**Owns** (in `domain/src/`):
- `io/input-model.ts`;
- `output-nodes/payloads.ts`, `output-nodes/index.ts`, and new
  `output-nodes/upload-binding.ts` and `output-nodes/recorded-element-key.ts`;
- `output-nodes/secret-binding.ts`, only to extract the element key into that new
  file;
- `actions/types.ts` and `actions/schemas.ts`;
- `client/gateway-action-parameters.ts` and `client/gateway-mapping.ts`;
- `web-panel-host.ts`, the candidate labels only;
- their tests.

**Read:** `reports/i-recording-capability-gaps.md`: "Shared files", then the Domain
parts of P5, P4 and P6.

**Task.**
1. **First, the wire names above,** with their types, schema and lift. Two
   extension workers compile against them. Say in your report when this step
   compiled.
2. **P5.** A file input's change maps to `web.dom.upload`, whose `upload` is a
   `web.upload.` binding with no fallback. It is never typing or clearing.
3. **P4.**
   - A recorded switch that has a path maps to `web.browser.tab`, and so does a
     close.
   - The recording-start marker stays non-executable.
4. **P6.**
   - A child-frame node also carries its frame's URL path.
   - Every top-frame node stays byte-identical.
5. **No node parameter carries** an origin, query, tab id, file name or file
   content.

**Tests.**
- The report's domain rows for P5, P4 and P6, each with its mutation.
- A row pinning that top-frame node parameters are unchanged.
- Domain `check`, and `test` under a private `DOMAIN_TEST_BUILD_LABEL`.
- The structure audit.
- Never regenerate the tracked `domain/.test-build`.

**Report:** `reports/f-domain-capability-gaps.md`.

## f-tab-recording — record and replay a tab switch or close (extension)

**Owns** (in `apps/extension/src/`):
- `background/index.ts`;
- `background/connection.ts`, the `handleTabRemoved` facade method only;
- new `background/connection/tab-recorder.ts`;
- `background/connection/active-page.ts` and `gateway-payloads.ts`;
- `background/connection/recorded-event-intake.ts`, only for the send path;
- `shared/protocol.ts`, `RecordingEventPayload` only;
- `runtime/browser-tab.ts` and `runtime/automation-tab.ts`;
- their tests.

Not `runtime-status.ts`: the tab confirmation comes later.

**Read:** the report's P4 section in full, "Not verified" included.

**Task.**
1. **Build P4's extension design against the wire names above.**
   `f-domain-capability-gaps` adds them to the domain first. If they are absent
   when you need them, wait and retry. Never define a second copy.
2. **A recorded tab action reaches the path that sends its input id and counts
   it, exactly once.** Answer the report's first P4 "Not verified" item.
3. **Replay.**
   - A switch matches an exact path, and waits for a tab that is still opening.
   - A close re-points the automation tab to the one driven before it.
4. **Say whether the runner records anything** when it brings a page to the front
   or closes its control page.

**Tests.**
- The report's tab-recorder and browser-tab rows, each with its mutation.
- Extension `check`, and `test` under a private `EXTENSION_TEST_BUILD_LABEL`.
- The structure audit.

**Report:** `reports/f-tab-recording.md`.

## f-frame-address — find a child frame by its path (extension)

**Owns** (in `apps/extension/src/`):
- `runtime/command-options.ts`;
- new `runtime/frame-address.ts`;
- `runtime/action-runner.ts`, `runActionInFrame` only;
- `content/describe-element.ts`, a file input's value only;
- their tests.

**Read:** the report's P6 section in full; P5's "Optional hardening"; open
question 2.

**Task.**
1. **Build P6's extension design.** `f-domain-capability-gaps` adds `frameUrlPath`
   first. Wait for it, and never define a copy.
2. **The recorder stops reading a file input's `value`.** Say what a recorded file
   input's element now carries.

**Tests.**
- The report's action-runner rows, with the mutation.
- A describe-element row, with a mutation.
- Extension `check`, and `test` under a private label.
- The content-harness specs that read an element's value; name them.
- The structure audit.

**Report:** `reports/f-frame-address.md`.

## f-capability-confirmations — an upload and a tab change confirm like any recorded action (extension)

`f-recorder-key-order-and-check-confirmation` has reported. Its task 3 answer: no
other existing verb waits for a confirmation it never gets. So the two new verbs
get table entries, and no Core or domain rule changes (open question 1).

**Owns:**
- `apps/extension/src/background/connection/runtime-status.ts`;
- `background/connection/server-command-channel.ts`, `sendRuntimeConfirmation`
  and its failed-status check only;
- their tests.

Both files carry uncommitted diffs from P2, and `recorded-event-intake.ts` carries
one from P3. Keep them exactly.

**Read:**
- `reports/i-recording-capability-gaps.md`: the `runtime-status.ts` items under
  P5 and P4;
- `reports/f-recorder-key-order-and-check-confirmation.md`.

**Task.**
1. A succeeded `web.dom.upload` confirms as `dom.change` with
   `web.user.files_chosen`, and carries no value.
2. A succeeded `web.browser.tab` confirms as `browser.tab`, with
   `web.user.tab_switched` or `web.user.tab_closed` chosen by the command's
   operation. `sendRuntimeConfirmation` hands the tracker the command's `tab`
   request.
3. Remove the caller's failed-status check that P2's worker made redundant, if
   the tests prove it redundant.
4. The input ids come from `f-domain-capability-gaps`'s task 1. Wait for them, and
   never define a copy.

**Tests.**
- Succeeded and failed rows for upload, switch and close, each confirmation with
  no value, and a mutation.
- Extension `check`, and `test` under a private label.
- The structure audit.

**Report:** `reports/f-capability-confirmations.md`.

## g-runner-upload-input — the Flow lane supplies the file a recorded upload asks for (test-runner, scenario-lab)

Dispatched once two workers have reported:
- `g-runner-harness-fixes`, which may edit `run-flow-lane.ts`;
- `f-domain-capability-gaps`, which exports the upload binding and the recorded
  element key.

**Owns:**
- new `packages/test-runner/src/flow-lane/declared-uploads.ts`;
- `flow-lane/run-flow-lane.ts`, the run's `inputs` only;
- `apps/scenario-lab/src/scenarios/file-transfer/manifest.ts`, W17's
  `expected.actions` only;
- their tests.

**Read:** `reports/i-recording-capability-gaps.md`, P5's "Test-runner" part;
`reports/f-domain-capability-gaps.md`.

**Task.**
1. For each `upload` step in the workflow's recording script, build the input
   `web.upload.<key>` as `{ files: [{ name, mimeType, contentBase64 }] }`.
   - The key must be the one the domain derives from the recorded element. Call
     the domain's export; never copy the rule.
   - The content is the same deterministic file the recording lane uploads.
2. Spread these inputs beside the secret inputs.
   - No file content reaches a log, an event or an evidence file.
   - Say whether Core's persisted run inputs now hold it, or hold `[withheld]`.
3. W17 pins `web.dom.upload` before its click.
   - `g-expected-action-guard`'s validator
     (`packages/test-contracts/src/recordable-actions.ts`) says `upload` yields
     nothing, so it would reject that pin. You also own that file's `upload` row
     and its validator test row; the row becomes `["web.dom.upload"]`.
   - If `f-tab-recording` has reported, also set `switchTab` and `closeTab` to
     `["web.browser.tab"]`, with a test row. Otherwise, say so.
   - `packages/test-contracts/dist` is shared: rebuild it once, then run the
     test-contracts, scenario-lab and test-runner tests against it.
4. The test-runner resolves the domain through `domain/dist`. If you need a
   rebuild, build the domain once, privately, and say so. Never commit or leave a
   changed tracked build.
5. **A cancelled choice stays evidence** (`domain/src/io/input-model.ts`, its
   file-input branch only).
   - Since `f-frame-address`, a recorded file input carries `hasValue`, but no
     value.
   - So a file input recorded with `hasValue: false` must stay evidence, as an
     emptied one already does. Otherwise a cancelled choice would become an upload
     that the runner fills.
   - Add a row with its mutation, and run the domain `check` and `test` under a
     private label.
6. **What Core persists of a supplied upload.** Say where a `web.upload.<key>`
   input's file name and content end up in Core's workspace:
   - the session record;
   - trace values;
   - command-attempt parameters.

   Answer from the Core code at `F:\!FluxIQ`, and from a unit probe if needed.
   Other workers are editing Core's runtime there, so do not edit it.

**Tests.**
- The input built from the manifest's upload step, and the key equal to the
  domain's key for the recorded element, each with a mutation.
- Test-runner `check`, and `test` in a private `--outDir`.
- Scenario-lab `check`, and `test` in a private output directory.
- The structure audit.

**Report:** `reports/g-runner-upload-input.md`.

---

# Twenty-ninth dispatch — withholding must not change execution (Core)

`g-core-attempt-withholding`'s redispatch is done. Its open questions show two ways
the run-input withholding now changes execution:
- **A live-patch rerun** reads its inputs from the withheld trace
  (`automation-studio/runtime/service.ts:3528,3583` into `live-patch.ts:177`), so a
  patched node receives `"[withheld]"`.
- **A Call Flow parent** builds its outputs from the child's withheld
  `trace.values` (`composite-executor.ts:50-51`). A pass-through child therefore
  hands it the marker.

Core is not committed with either of these.

Decided by the supervisor on 2026-09-13:
- **Execution reads real values,** and only saved or published copies are
  withheld.
- **One text-replacement rule,** longest text first, is shared by the executor and
  the framework runtime. Today the executor's rule can leave fragments of a longer
  withheld text in a trace (open questions 5 and 6).
- **Open question 3 stays a known gap for Week 1.** A node could copy an unbound
  input by key into an output, and nothing withholds that copy. The Flow lane
  sends only bound `web.secret.*` inputs.

## g-core-withholding-execution — execution uses real values; the saved copy is withheld (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\`):
- `programs/automation-studio/runtime/service.ts`, the live-patch rerun inputs only;
- `programs/automation-studio/runtime/live-patch.ts` and `composite-executor.ts`;
- `programs/automation-studio/runtime/executor/graph-run.ts` and
  `trace-withholding.ts`;
- `runtime/service.ts`, the replacement rule only, plus a new focused `runtime/`
  helper file and its `runtime/index.ts` line;
- their tests, including `runtime/tests/composite-executor.test.ts`;
- `F:\!FluxIQ\docs\architecture\automation-studio.md:407-418`,
  `automation-studio-native-nodes.md`, and `package-boundaries.md`, the unreleased
  0.4.0 entry only.

`g-core-bridge-order` owns `client-gateway/` and `client-gateway.md`.

Every owned file except the new helper carries uncommitted diffs from
`g-core-input-withholding` and `g-core-attempt-withholding`. Keep those diffs,
and build on them.

**Read:** `reports/g-core-attempt-withholding.md`, the second "Outcome" through the
end; `reports/g-core-input-withholding.md`.

**Task.**
1. **Live-patch reruns** run with the run's real inputs.
2. **A Call Flow parent** reads its child's real output values. The child's saved
   trace stays withheld.
3. **One replacement helper,** longest text first, used by both
   `trace-withholding.ts` and the runtime service.
4. **Migration Notes.** Merge the attempt-withholding paragraph as built into the
   0.4.0 entry, beside the run-input paragraph already there. Say that execution
   is unchanged.
5. **The two architecture pages** state the run-input rule.

**Tests.**
- **Composite:** a child with authored defaults 5 and 0, and output `result` bound
  to `total`. The parent sees `total === 5`, and the child's saved trace withholds
  its inputs. Add a mutation.
- **Live patch:** the rerun receives the real input, and the saved trace holds the
  marker. Add a mutation.
- **Replacement rule:** a withheld text containing another leaves no fragment in
  the trace. Add a mutation.
- **Gates:**
  - `npx vitest run` over the fifteen files from the redispatch, plus these files,
    with `--no-file-parallelism`;
  - Core `pnpm check`, `pnpm docs:reference` and `pnpm docs:check`;
  - no Core `pnpm build`.

**Report:** `reports/g-core-withholding-execution.md`.

## g-lane-consistency — every lane reads an expected action the same way, and a bad manifest is fixture.invalid (test-runner)

From `g-expected-action-guard`'s decisions:
- The existing and clone lanes still read an expected action with no `outcome` as
  `succeeded` (`existing-flow-run.ts:107`), while the Flow lane judges presence
  only (H4).
- A manifest the validator rejects reaches a run classified `unknown`, not
  `fixture.invalid` (`scenarios.ts:11`).

**Owns:** `packages/test-runner/src/existing-flow-run.ts` (its expected-action
check only), `src/scenarios.ts`, and their tests.

**Read:** `reports/g-expected-action-guard.md`; `reports/g-bench-expectation-fixes.md` H4.

**Task.**
1. **One rule for every lane.** The existing and clone lanes judge expected
   actions exactly as the Flow lane does. Call the Flow lane's `assertFlowActions`
   rather than keeping a second copy, if the shapes allow it.
2. **A manifest the validator rejects** fails its run as `fixture.invalid`. The
   message names the defect, and never a page value.
3. **Answer, without changing anything:** what does the Flow lane do with a
   recording that holds zero actions, such as admin-console's
   `extract-customer-list`?

**Tests.**
- A row for each fix, with its mutation.
- Test-runner `check`, and `test` in a private `--outDir`.
- The structure audit.

**Report:** `reports/g-lane-consistency.md`.

## Amendment to `g-core-bridge-order` — the two races it left (Core)

Decided by the supervisor on 2026-09-13:
- **The reversal of `0e4edea`'s no-flush rule is accepted.** The mapper's
  `following` needs storage order. A click's write now also waits for one queued
  snapshot batch, which is the 25 ms queue.
- **Flushing before action results is accepted.** The brief said every direct
  append.
- **Both races the worker named are fixed now,** because the new chain lengthens
  the first:
  1. **Stop and start.** A Stop cleans up only the recording it stopped, never one
     started while it drains.
  2. **Messages before a start.** A message received before a start is never
     stored in the recording that start opens. Say whether the extension can send
     in that order; either way, a row pins the rule.
- **The migration-note line goes to `g-core-withholding-execution`,** which owns
  the 0.4.0 entry in `package-boundaries.md`.

**Owns:** the same client-gateway files as before.

**Tests.**
- A row for each race, with its mutation.
- The same vitest set, Core `pnpm check` and `pnpm docs:check`.
- No Core `pnpm build`.

**Mutation scripts** must copy the file aside and restore it in a `finally`, then
confirm the hash. The first run left the original `bridge.ts` on disk for
minutes.

**Report:** append an "Amendment" section to `reports/g-core-bridge-order.md`.

## d-capability-docs — the architecture pages describe uploads, tabs, frames and confirmations (docs)

The P4, P5 and P6 wire changes are substantial under AGENTS.md "Documentation
Maintenance". The domain mapping is committed (`1316533`), and the extension work
is done, though not yet committed.

**Owns:**
- `docs/architecture/web-capabilities.md`;
- `docs/architecture/extension-client.md`;
- any other page under `docs/architecture/` that describes recording, the
  recorded payload or runtime confirmations. Name each one.

**Read:**
- `reports/f-domain-capability-gaps.md` and `reports/f-tab-recording.md`;
- `reports/f-frame-address.md`;
- `reports/f-capability-confirmations.md`, its Amendment included once it exists;
- the source those reports cite.

**Task.** Describe the current design only, with no plan history:
1. **What is recorded and replayed.**
   - A file choice records as an upload that asks for its files at run time. It
     carries no file name, count or content, and a cancelled choice stays
     evidence.
   - A switch to another page, by path, and a close of the recording's tab record
     as tab actions. They replay by exact path, and a close returns to the
     previous tab.
   - A child frame is addressed by its document's path, with the recorded id as a
     tie-break.
2. **The runtime confirmation for every recorded executable verb.** That includes
   `check`, `upload`, and `tab` with its `tab` field.
3. **The recorder sends no file input value.**
4. **The wire contract:** the recorded payload's `tab`, the three new inputs, and
   `urlPath` and `frameUrlPath`.

**Tests.** The structure audit, and every relative link you add resolves.

**Report:** `reports/d-capability-docs.md`.

## g-demo-attestation-limits — the demo leak check can scan Core's databases (test-runner)

`g-attestation-sqlite-reader` found a problem with limits. The demo attestations
use `SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS`, whose `maxFileBytes` is 1 MiB.
- A Core database, or its `-wal`, larger than that is now an `unscanned-store`
  finding.
- Lab Stage 3's `demo:record` and `demo:run` could therefore fail on size alone.

**Owns:**
- `packages/test-runner/src/demo-llm-attestation.ts`, its limits only;
- `redaction-attestation/run-redaction-scopes.ts` and `attest-run-redaction.ts`,
  their comments only;
- their tests.

**Read:** `reports/g-attestation-sqlite-reader.md`.

**Task.**
1. The demo attestations scan a Core database, and its `-wal`, up to the Lab run's
   limits (8 MiB per file, 64 MiB per scan). Anything larger stays
   `unscanned-store`, and the demo fails.
2. Correct the two comments that no longer describe the check.

**Tests.**
- A demo attestation row with a database over 1 MiB and under 8 MiB, which is
  scanned. Add a mutation that restores the default.
- Test-runner `check`, and `test` in a private `--outDir`.
- The structure audit.

**Report:** `reports/g-demo-attestation-limits.md`.

---

# Thirtieth dispatch — from `l-stage2c` run 3

## i-w25-timeout-code — why W25 `too-slow` reports Core's dispatch timeout, not the action's own (read-only)

`l-stage2c` run 3 found a mismatch in three runs of 3, all
`delayed-ui --flow --variant too-slow`:
- **What was reported:** the wait failed with
  `{"category":"timeout","code":"output_dispatch.timed_out"}`. That is Core's
  dispatch deadline (`programs/automation-studio/runtime/io-policy.ts:142`, Core
  `6621d66`).
- **What the manifest expects:** `web.action.timeout`
  (`apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts:49-51`), which is the
  extension's own action timeout (`domain/src/runtime/failure/codes.ts:46,131`).
- **The result:** the category matches, but the runner fails the run on the code.

**Owns:** `reports/i-w25-timeout-code.md` only.
- Read code in both repositories.
- Run unit tests or small probes only, and no Lab command. A Lab campaign is
  running.
- Core's source is at `F:\!FluxIQ`. The Lab uses its own worktree under
  `F:\fxlab\`, so reading is safe.

**Read:** `reports/l-stage2c.md` run 3. For one `too-slow` bundle under
`F:\fxlab-runs\stage2c\c\`, read only timings, ids and codes.

**Task.**
1. Where Core's dispatch deadline for an action comes from, and how it relates to
   the wait's own `timeoutMs` and to the extension's timeout.
2. From the bundle's timings: which deadline fired first, and by how much.
3. **The right fix, with file:line.** Choose one of these:
   - Core's dispatch deadline covers the action's declared timeout plus a margin;
   - the extension's timeout is shortened;
   - the expectation names only the category.

   Say which failure code a user should see, and why.
4. Every week1 row and variant whose outcome that fix changes.

**Report:** `reports/i-w25-timeout-code.md`.

---

# Thirty-first dispatch — from `i-w25-timeout-code`

Decided by the supervisor on 2026-09-13:
- **Core's two dispatch deadlines outlast the client's own timeout,** by a named
  margin.
  - Today Core uses the node's `timeoutMs` (default 5,000 ms) for its runtime and
    client-gateway deadlines. It sends the same value to the extension as the
    action's own timeout.
  - The extension's clock starts after the tab settles, so Core always fires
    first, and `web.action.timeout` never reaches the run.
- **The client is still sent the node's `timeoutMs`, unchanged.**
- **`output_dispatch.timed_out` keeps its meaning:** the client never answered.
- **The margin covers what the client does before its own clock starts** (the tab
  settle, `apps/extension/src/runtime/automation-tab.ts:137`), plus transport. Size
  it from the settle's real bound, and state the reason in the constant's comment.

## g-core-dispatch-deadline — Core hears a client's own timeout before giving up on it (Core, plus three downstream comments)

**Owns:**
- **In `F:\!FluxIQ\packages\fluxiq\src\`:**
  - `client-gateway/service/commands.ts`, the command deadline (`:65-70`);
  - `runtime/service.ts`, the transport-target deadline (`:361-371`);
  - a focused module for the margin, if one is needed;
  - their tests.
- **In `F:\!FluxIQ\docs\architecture\`:**
  - `package-boundaries.md`, a line in the unreleased 0.4.0 entry;
  - the page that describes the deadline.
- **In `F:\!FluxIQWebExtension`, comments only:**
  - `apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts:16-19`;
  - `domain/src/recording/proposals/late-target-wait.ts:15`;
  - `apps/extension/src/runtime/action-runner.ts:197-198`.

Follow `F:\!FluxIQ\AGENTS.md`. A Lab campaign is running on separate worktrees under
`F:\fxlab\`. Do not touch them, and run no Lab command.

**Read:** `reports/i-w25-timeout-code.md`.

**Task.**
1. **Both deadlines wait the command's timeout plus the margin.** The client still
   receives the timeout unchanged.
2. **Which failure is reported:**
   - a client that answers with its own failure inside the margin is reported with
     that failure;
   - a client that never answers still gets `output_dispatch.timed_out`.
3. **State what the margin is,** and why, from the settle's real bound.
4. **Correct the three downstream comments.**

**Tests.**
- **Core rows,** each with a mutation that restores the old deadline:
  - a client that answers `web.action.timeout` just after the timeout is reported
    with it;
  - a silent client still times out as `output_dispatch.timed_out`.
- **Core gates:**
  - `npx vitest run <files> --no-file-parallelism`;
  - Core `pnpm check`, `pnpm docs:reference` if a cited line moves, and
    `pnpm docs:check`;
  - no Core `pnpm build`.
- **Downstream:** the structure audit.

**Report:** `reports/g-core-dispatch-deadline.md`, with the compatibility effect.

---

# Thirty-second dispatch — from `l-stage2c` run 4

`l-stage2c` run 4 found three problems, at `69f40c1` and Core `6621d66`:
- **W15.** The Flow's first node is a `web.browser.tab` close that names no tab.
  - In 6 of 6 runs it timed out at Core's dispatch deadline.
  - Rerun once, alone, the extension rejected it with `web.action.rejected`
    ("a tab to close" / "no tab named and none open").
  - Nothing after it ran. The recording held 5 actions, with the extension equal to
    Core.
- **W28.** Run 2 recorded a second scroll. Its Flow ran one `web.dom.scroll` to
  `succeeded`, then stopped with no failure record (`ambiguous_or_unknown`,
  `harnessActivations=1`). This is a single observation.
- **W17.** The upload's saved command attempt holds the chosen file's name twice, at
  `result.payload.result.validation.expected` and `.actual`. The upload verb's
  post-condition quotes names (`apps/extension/src/content/actions/upload.ts:19-30`).

Decided by the supervisor:
- **A chosen file's name is the user's data,** as its value is. The upload
  post-condition compares names but quotes none.
- **W15 and W28 are investigated first.** `g-core-dispatch-deadline` may change
  W15's timeout, but not its close.

## i-w15-w28-flow-order — why W15's Flow starts with a tab close, and why W28's run 2 stopped after a scroll (read-only)

**Owns:** `reports/i-w15-w28-flow-order.md` only.
- Read code in both repositories, and the bundles. Run unit probes only.
- A Lab bench is running, with worktrees under `F:\fxlab\` and runs under
  `F:\fxlab-runs\stage2c\e`. Run no Lab command, and touch neither.

**Read:**
- `reports/l-stage2c.md`, Run 4.
- The W15 bundles under `F:\fxlab-runs\stage2c\d` and `d4r`.
  `run-mtzye7ll-de4dba98` is the rejected close.
- The W28 bundles `run-mtzy9h6r-08713546` (failed) and `run-mtzy83q6-5a9b03ae`
  (passed).

Report ids, kinds, paths, orders and counts only.

**Task.**
1. **W15.**
   - List the recorded entries in stored order (types, tab operations and paths),
     and the Flow's candidates in order.
   - Say which of these puts a close first: the tab recorder, the bridge's storage
     order, the domain's mapping, or the proposal.
   - Say why the close has no tab to act on, and what it should do when the
     recording's tab is already the only one.
   - Give a fix design, partitioned by file.
2. **W28.**
   - Say where run 2's second scroll came from: the runner's start-page load, a
     frame scroll, or the user script.
   - Say why the Flow stopped after a scroll that succeeded, with no failure record.
   - Give a fix design, partitioned by file.
3. **For each fix,** list every week1 row it changes.

**Report:** `reports/i-w15-w28-flow-order.md`.

## f-upload-validation-names — the upload post-condition quotes no file name (extension)

**Owns:**
- `apps/extension/src/content/actions/upload.ts` and its test;
- `apps/extension/e2e/content/tests/upload-dialog.spec.ts`, only the rows that read
  the upload's validation text.

**Read:** `reports/l-stage2c.md`, the W17 part of Run 4.

**Task.**
1. **The validation's outcomes stay the same.** It still passes only when the input
   holds exactly the requested names, and still fails `output_not_observed`
   otherwise.
2. **Its `expected` and `actual` quote no name.** They say how many files there are
   and whether their names match. The rejection path quotes no name either.
3. **Say whether anything reads the upload validation's text:** the domain
   comparison, Core, the runner or the bench. If something depends on the names,
   stop and say what.
4. **Correct the file's header comment.**

**Tests.**
- A unit row, for a match and for a mismatch, where neither `expected` nor `actual`
  contains a requested name. Add a mutation that quotes names again.
- Extension `check`, and `test` under a private label.
- The content harness `upload-dialog.spec.ts`, run once, alone. A Lab bench is
  running, so rerun a faulty-RAM failure once.
- The structure audit.

**Report:** `reports/f-upload-validation-names.md`.

---

# Thirty-third dispatch — after the session restart (2026-09-13, 08:24)

The user killed every session at 08:22. `l-stage2c`'s run 5 (the week1 bench) stopped
after 5 of 67 rows, and it runs again on the fixed tree. Runs 1-4 are complete in
`reports/l-stage2c.md`.

## i-w05-short-catalog — how W05 `short-catalog` should be judged on the Flow lane (read-only)

Since `7a6a8e7`, the recording lane follows pagination by clicking Next, so W05's
recording holds two Next clicks. The `short-catalog` variant shows five products
and no Next. A Flow replaying those clicks is therefore predicted to fail
`target_not_found`, though that has not been observed.

**Owns:** `reports/i-w05-short-catalog.md` only. Read code, and run no Lab command.

**Read:**
- `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts`;
- `packages/test-runner/src/scenario-steps/extract-records.ts`;
- `reports/g-runner-harness-fixes.md`, H1;
- W05's row in `packages/test-runner/src/bench/corpus/week1.ts`.

**Task.**
1. **From code:** what a Flow built from W05's recording does on `short-catalog`,
   which node fails, and with what category.
2. **The options,** each with its effect on criterion 1 ("week1 W01-W19 through the
   bench, 3 of 3") and criterion 4 (a negative variant reports its expected
   category):
   - (a) the variant declares the expected failure on the Flow lane;
   - (b) the Flow follows pagination as a loop, which needs a node Core does not
     have (say what);
   - (c) the variant runs on the recording lane only;
   - (d) anything better.
3. **Recommend one,** with file:line for the change, and say whether it is honest. A
   Week 1 row must not pass by hiding a product gap.

**Report:** `reports/i-w05-short-catalog.md`.

## i-arch-pages-audit — which architecture pages are not yet in their finished Week 1 state (read-only)

Phase 1.6b needs the architecture pages in their finished state, and much changed
this session.

**Owns:** `reports/i-arch-pages-audit.md` only. Read `docs/architecture/` and the code
the pages cite. Run no build or Lab command.

**Task.**
1. **For each page under `docs/architecture/`,** list:
   - claims the code at HEAD contradicts, with file:line on both sides;
   - stale line citations;
   - behaviour committed this session that the page does not describe. The plan's
     ledger, and the archive from part thirty-one onward, list that behaviour.
2. **Skip what the in-flight workers will change:** the upload validation text
   (`content/actions/upload.ts`), Core's dispatch deadline, and W15's tab-close
   order.
3. **Group the fixes by page,** so that docs workers can be partitioned by file, and
   rank them by how misleading each error is.

**Report:** `reports/i-arch-pages-audit.md`.

---

# Thirty-fourth dispatch — from `g-core-dispatch-deadline` (blocked)

`g-core-dispatch-deadline` changed nothing, and was right not to. A web Flow action
never takes Core's gateway transport:
- **It goes through the domain's own adapter,** `web-automation.gateway`
  (`domain/src/runtime/service.ts:7-19`).
- **The 5,000 ms that fired** is the runtime's adapter deadline
  (`runtime/service.ts:361-371`).
- **The adapter sends the extension no timeout** (`domain/src/runtime/adapter.ts:76-84`,
  `domain/src/io/gateway-output-dispatcher.ts:14-22`). So the extension waits its own
  default, which is 10,000 ms for a wait (`waits.ts:17`).

Decided by the supervisor on 2026-09-13:
- **Core's runtime deadline is the dispatch timeout plus one named margin,** for
  every target. There is no per-adapter flag. An in-process adapter's work is
  bounded by the timeout anyway, so the margin only delays a hung target's failure.
- **The web adapter sends the extension the command's timeout.** The extension then
  gives up at the node's timeout and reports its own `web.action.timeout`.
- **The client-gateway timer** waits the timeout plus the same margin when a timeout
  is sent.
- **The margin is 3,000 ms,** in one named constant. It is justified by the measured
  settle (1,007-1,250 ms) plus transport.
- **`output_dispatch.timed_out` keeps its meaning:** a target that never answered.

## g-web-timeout-forwarding — the extension's own timeout reaches the run (Core, then domain)

**Owns:**
- **In `F:\!FluxIQ\packages\fluxiq\src\`:**
  - `runtime/service.ts`, the dispatch deadline;
  - `client-gateway/service/commands.ts`, the gateway timer;
  - `runtime/contracts.ts`, only if `OutputDispatchRequest` needs an optional timeout
    field;
  - a focused module for the margin constant, if one is needed;
  - their tests.
- **Core docs:** `F:\!FluxIQ\docs\architecture\package-boundaries.md` (a line in the
  unreleased 0.4.0 entry), and the runtime page that states the deadline.
- **In `F:\!FluxIQWebExtension`:**
  - `domain/src/runtime/adapter.ts` and `domain/src/io/gateway-output-dispatcher.ts`,
    and their tests;
  - comments only at `apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts:16-19`,
    `domain/src/recording/proposals/late-target-wait.ts:15` and
    `apps/extension/src/runtime/action-runner.ts:197-198`.

Follow `F:\!FluxIQ\AGENTS.md`. Do Core first, then the domain.

**Read:** `reports/g-core-dispatch-deadline.md` in full, and `reports/i-w25-timeout-code.md`.

**Task.**
1. **Build the decided design.**
2. **Check that nothing which passes today can newly fail.** List every web verb whose
   extension-side default timeout exceeds the node's timeout. For each, say whether
   Core's 5,000 ms deadline already bounded it before this change.
3. **Correct the three comments** against the final design.

**Tests.**
- **Core:** a target that answers with its own failure within the margin is reported
  with that failure, and a silent target still gets `output_dispatch.timed_out`.
  Each has a mutation that restores the old deadline.
- **Domain:** the adapter forwards the command's timeout, with a mutation that drops
  it.
- **End to end, if one fits:** a wait whose page never shows its target reports
  `web.action.timeout`, not `output_dispatch.timed_out`.
- **Gates:**
  - `npx vitest run <files> --no-file-parallelism`;
  - Core `pnpm check`, `pnpm docs:reference` if a cited line moves, and
    `pnpm docs:check`;
  - domain `check`, and `test` under a private label;
  - the structure audit;
  - no Core `pnpm build`.

**Report:** `reports/g-web-timeout-forwarding.md`, with the compatibility effect.

---

# Thirty-fifth dispatch — from `i-arch-pages-audit`

`reports/i-arch-pages-audit.md` lists, page by page, the claims the code contradicts
and the committed behaviour the pages leave out. There is one docs worker per page
group, so no two share a file.

Decided by the supervisor on 2026-09-13:
- **Fix every item the audit lists,** except the areas it held back:
  - Core's dispatch deadline and timeout forwarding (`g-web-timeout-forwarding`);
  - W15's tab-close order and W28's scroll (`i-w15-w28-flow-order`);
  - `late-target-wait.ts:15`.

  The upload validation text is now committed (`af80298`), so it is no longer held
  back.
- **Say nothing yet about W05 `short-catalog`.** It is described as ruled out only
  once the Lab has observed it.
- **`run-scenario.ts:270-277` repeats two stale claims.** Correct the comment along
  with its page. Trim the paragraph about reselecting the project, rather than
  keeping it with a 300 s window as the reason.
- **Describe the current design only,** with no plan history.

**Every worker in this dispatch:**
- **Read** its pages' sections of `reports/i-arch-pages-audit.md`, and the code those
  sections cite.
- **Tests:**
  - every relative link on its pages resolves:
    `node C:/Users/mrjoh/AppData/Local/Temp/claude/f---FluxIQWebExtension/4f264c80-323b-4673-a09a-bde5851669f3/scratchpad/dcd-check-links.mjs <pages>`,
    run from the repository root;
  - the structure audit.
- **Report:** `reports/<worker name>.md`.

## d-testing-facility-page

**Owns:** `docs/architecture/testing-facility.md`, and the comment at
`packages/test-runner/src/run-scenario.ts:270-277` only.

**Task:** the audit's `testing-facility.md` items. That includes a section on the
Flow lane, the bench, the lane rules, the run leak check and the recording checks,
which no page describes today.

## d-extension-client-page

**Owns:** `docs/architecture/extension-client.md`.

**Task:** the audit's items for this page:
- the rule that a recording starts once;
- the pending page change being sent before an executable event;
- the recording side of the late-target wait, but not its timeout.

## d-identity-evidence-sensitive-pages

**Owns:** `docs/architecture/element-identity.md`, `page-evidence.md` and
`sensitive-values.md`.

**Task:** the audit's items for those three pages.

## d-capabilities-layout-taxonomy-pages

**Owns:** `docs/architecture/web-capabilities.md`, `repository-layout.md` and
`failure-taxonomy.md`.

**Task:** the audit's items for those three pages. Before documenting the
content-harness command in `repository-layout.md`, run it once on one spec, and quote
the result.

---

# Thirty-sixth dispatch — from `i-w15-w28-flow-order`

`i-w15-w28-flow-order` found one cause for both failures:
- **The start is chosen by list order.** A Flow with no start node begins at the
  first node of its saved list (`graph-navigation.ts:13-15`). SQLite returns that list
  sorted by node id (`graph-store.ts:189`).
- **The ids sort wrongly.** Recorded node ids are `recorded.candidate.entry.<N>.<uuid>`,
  with `N` unpadded, so `entry.10` sorts before `entry.9`. A recording of more than ten
  entries can therefore start at a later action.
- **What it did:**
  - W15 started at its tab close in 7 of 7 runs;
  - W28's 12-entry run 2 started at its last scroll, and stopped with no failure
    record.
- **Only the start is wrong;** the links between actions are right.
- **Evidence:** probes in JavaScript, and in SQLite running Core's query, both put
  `entry.10` first.

Decided by the supervisor on 2026-09-13:
- **Fix it in Core.** A Flow's start is chosen from its graph, never from a sort of
  node ids.
- **The runner also fails a Flow-lane run that did not start at its first action,**
  so the bench shows every row this touched.
- **The report's Fix 3 is not taken.** Closing the active tab when no tab is driven
  would close a tab FluxIQ never opened, so the extension keeps refusing. With the
  right start, W15's close runs after its switch.
- **The report's Fix 4 waits for the Lab.** The recheck keeps W28's Core workspace
  and records where each scroll came from, before the recorder changes.

## g-core-start-node — a Flow without a declared start begins at its graph's root (Core)

**Owns** (in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`):
- `runtime/executor/graph-navigation.ts`;
- where the compiled plan's entry is chosen (`compiled-plan.ts`, or name the file);
- the recording-approval path that builds a Flow from a proposal, if it can write an
  explicit start;
- their tests;
- `F:\!FluxIQ\docs\architecture\package-boundaries.md`, a line in the unreleased 0.4.0
  entry;
- the architecture page that says how a run chooses its first node.

Follow `F:\!FluxIQ\AGENTS.md`. `g-web-timeout-forwarding` is editing Core's
`runtime/service.ts`, `client-gateway/service/commands.ts`, and perhaps
`runtime/contracts.ts`. Do not touch those.

**Read:** `reports/i-w15-w28-flow-order.md`.

**Task.**
1. **A Flow with no declared start begins at the one node no edge points to.**
   - Say what Core does today, and what it should do, when several nodes qualify or
     none does (a cycle).
   - Choose a deterministic rule that never depends on a sort of ids, and document it.
2. **Write an explicit start where the order is known.** If the path that builds a
   Flow from a recording proposal knows the order, it writes an explicit start as
   well.
3. **Check other uses of the id-sorted list.** Say whether a node list read back in id
   order matters anywhere else: display, digest or export. Fix only the start choice,
   unless another use is also wrong.

**Tests.**
- A Flow of twelve recorded nodes, `entry.1` to `entry.12`, linked in order, starts at
  `entry.1`. Add a mutation that restores the first-by-id rule.
- The several-roots case, and the no-root case.
- **Gates:**
  - `npx vitest run <files> --no-file-parallelism`;
  - Core `pnpm check`, `pnpm docs:reference` if a cited line moves, and
    `pnpm docs:check`;
  - no Core `pnpm build`.

**Report:** `reports/g-core-start-node.md`, with the compatibility effect: such Flows get
a changed start node and plan digest.

## g-runner-start-guard — a Flow-lane run that did not start at its first action fails, by name (test-runner)

**Owns:** `packages/test-runner/src/flow-lane/run-flow-lane.ts` and
`flow-lane/persisted-flow-run.ts`, and their tests.

**Read:** `reports/i-w15-w28-flow-order.md`, Fix 2.

**Task.**
1. **A wrong start fails by name.** A Flow-lane run whose first attempt is not the
   Flow's first action fails with a named runner failure, not with an assertion about a
   later action. Take "first action" from the recording's order or from the graph's
   root, and say which.
2. **An early stop is named.** A run that stopped with unvisited actions and no failed
   attempt is reported as exactly that.
3. **Say what the bench shows** for each.

**Tests.**
- A row for each, with a mutation.
- Test-runner `check`, and `test` in a private `--outDir`.
- The structure audit.

**Report:** `reports/g-runner-start-guard.md`.

**Amendment, 2026-09-13.** Task 2 is done. Task 1 was blocked on ownership: the lane
drops the data it needs before `run-flow-lane.ts` sees it.
- `flow-lane/flow-action-types.ts` (`readFlowNodes`) keeps only each node's id and
  parameters.
- `flow-lane/recording-flow-proposal.ts` keeps only the candidate count.

Decided: the first action comes from the recording's candidate order, not the graph's
root, so the check holds whatever start rule Core uses. The worker now also owns those
two files and their tests. The one-read design stays: carry the order through the
reads the lane already makes, rather than reading the Flow again or parsing Core's
node ids.

---

# Thirty-seventh dispatch — the Lab recheck (drafted; dispatched once both repositories are pushed)

## l-stage2d — W15, W28, W25 `too-slow`, W17 and W05 `short-catalog`, then the week1 bench once

The supervisor names both pins at dispatch.

**Owns:**
- `reports/l-stage2d.md`;
- the Lab worktrees under `F:\fxlab\`;
- ignored run directories under `F:\fxlab-runs\stage2d\`.

Nothing tracked.

**Read:**
- `reports/l-stage2c.md`: its setup, campaign scripts, and its method for keeping and
  searching Core's workspace, which you may reuse from the scratchpad;
- `reports/i-w15-w28-flow-order.md`;
- `reports/i-w05-short-catalog.md`.

**Setup.**
- Confirm that no other Lab or run process is alive, and that no other agent is
  running this brief.
- Move both worktrees to the named pins, and build Core in its worktree.
- Rebuild `domain/dist`, `packages/test-contracts/dist` and `apps/scenario-lab/dist`
  in the Lab worktree. Install only if the lockfile changed. Record each exit code.
- Run with `FLUXIQ_TEST_ENV_FILES=none`, one Lab instance at a time.

**Runs.** Each row is a single observation unless it repeats.
1. **W15 `multi-tab`, Flow lane, unarmed and `popup-blocked`, ×3 each.**
   - The Flow's first attempt is its first recorded action.
   - Unarmed passes, with its tab actions succeeding.
   - `popup-blocked` reports `output_not_observed`.
   - Report the order of attempts.
2. **W28 `iframe-checkout`, Flow lane, ×3, with Core's workspace kept.**
   - Both frame clicks succeed.
   - For any recorded scroll, report its frame and position from the kept recording:
     kinds, frame ids, paths and counts only.
3. **W25 `delayed-ui` `too-slow`, Flow lane, ×3.** The failure reports
   `web.action.timeout`, not `output_dispatch.timed_out`, and the run passes.
4. **W17 `file-transfer` `upload`, Flow lane, ×3, with Core's workspace kept.** The
   uploaded file's name and its content are each found 0 times, SQLite included.
5. **W05 `product-catalog` `short-catalog`, Flow lane, ×3.** Report the failing node
   and its category, for the supervisor's ruling.
6. **The week1 bench, `--repeat 1`, once.**
   - Compare every row with Stage 2's 37 of 67, and with `l-stage2c` runs 1-4.
   - Name the fix that explains each change, and any row that regressed.
   - Report `recordedActions`, extension against Core, and
     `discardsAfterFirstRead`.

**Stop** if a run shows a leak above 0, and report it.

**Report:** `reports/l-stage2d.md`: the pins, commands, observed figures, and single
observations labelled as such.

## Amendment to `f-capability-confirmations` — a tab confirmation carries its tab (extension)

Dispatched once `f-tab-recording` has reported.

The worker's open decision: the domain maps a tab event to an input only from
`payload.tab.operation`. A replayed tab change that confirms without `tab` could
therefore never be mapped the way a recorded one is.

**Decided:** a tab confirmation carries
`tab: { operation, urlPath }`, with the same shape as the recorded payload.
- `urlPath` is the pathname of the tab the action left in front, never an origin
  or a query.
- A close carries no path.

**Owns:** `runtime-status.ts` and `server-command-channel.ts`, and their tests.

**Tests.**
- The switch and close confirmations each carry `tab`, and neither holds an
  origin or a query. Add a mutation.
- Extension gates, and the structure audit.

**Report:** append an "Amendment" section to `reports/f-capability-confirmations.md`.

## f-authgate-followups — the rest of the password text (scenario-lab, extension)

Dispatched once `g-manifest-extract-entries` has reported, because scenario-lab's
`test` builds into the shared `dist`.

**Owns:**
- `apps/scenario-lab/src/scenarios/auth-gate/constants.ts`, `manifest.ts`,
  `pages.ts` and `tests/scenario.test.ts`;
- `apps/extension/e2e/content/tests/failures.spec.ts`, only its two auth-gate rows.

**Read:** `reports/f-authgate-fixture.md`.

**Task.**
1. Export the sign-in page's password placeholder as a constant, and use it in the
   page, the scenario test and the two content-harness rows.
2. Correct every comment or description that still says the page shows the
   password (`constants.ts:9`, `manifest.ts:28-30,97-98`).

**Tests.**
- Scenario-lab `check` and `test`;
- the content harness `failures.spec.ts -g "on auth-gate"`;
- the structure audit.

**Report:** `reports/f-authgate-followups.md`.

## i-leftover-sizing — confirm and size the known leftovers for the blocker ranking (read-only)

Dispatched while Core's gate runs. No tests, builds or Lab runs.

**Owns:** `reports/i-leftover-sizing.md`. Nothing tracked.

**Items**, each with where it was found:
1. `domain/src/client/gateway-mapping.ts:175`: a node's timeout overrides an output's
   own `parameters.timeoutMs` (ledger, `g-web-timeout-forwarding`).
2. The leak check misses a literal split across freed SQLite pages or WAL frames
   (`reports/g-attestation-sqlite-reader.md`, open question 1).
3. A runtime confirmation's `url` holds the full URL
   (`reports/f-capability-confirmations.md`, open question 1).
4. Plan history left on architecture pages (`reports/d-capability-docs.md` item 5,
   `reports/d-capabilities-layout-taxonomy-pages.md` item 5).
5. Core: a recording appended beside existing nodes gives a second root, so the run
   refuses (`reports/g-core-start-node.md`, open question 3).
6. Core: among several edges on one route, the smallest edge id wins (the same
   report, open question 5).
7. Core's five "Open for Core" items: `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md`,
   Current State.

**Task.** For each item:
- confirm it still holds at HEAD, with file and line, or say it no longer does;
- say whom it hits: a Week 1 exit criterion, a Lab row, an extension user, or a
  Core host;
- give the smallest fix: its repository, files and tests;
- propose a rank (Week 1 blocker, Week 2 entry, or later), with one sentence of
  reason, and say whether a Lab observation is needed to decide it.

Read excerpts around the cited lines, not whole trees. Quote no recorded page data
or secret values.

**Report:** `reports/i-leftover-sizing.md`: one table of every item, then a short
section for each.

## i-week2-entry-points — where each Week 2 phase starts in today's code (read-only)

Dispatched while Core's gate runs. No tests, builds or Lab runs.

**Owns:** `reports/i-week2-entry-points.md`. Nothing tracked.

**Read:**
- the 30-day MVP plan, from "Week 2 Objective" through "Week 2 Exit Criteria";
- Core's `docs/architecture/automation-studio.md`, "LLM-Assisted Deterministic
  Automation";
- the Current State of `docs/working/llm-production-automation-plan.md`.

**Task.**
1. For each of Phases 2.1-2.9 and each Week 2 exit criterion, name:
   - the module in either repository that owns it today, with file and line;
   - what already exists, and what is missing;
   - which Week 1 result it depends on.
2. Answer one question for the user in plain words: what exists today, and what
   is missing, for a user to type instructions, run, and have the agent explore
   a site, build a Flow, and change that Flow while it runs. Cite the code for
   each piece.

Search narrowly and read excerpts. Do not read the Week 1 plan beyond its Current
State.

**Report:** `reports/i-week2-entry-points.md`, at most 250 lines.

## d-arch-history — the architecture pages describe current design only (docs)

Dispatched once `i-leftover-sizing` reported; its item 4. Docs only.

**Owns:** in `docs/architecture/`: `web-capabilities.md`, `failure-taxonomy.md`,
`sensitive-values.md`, `page-evidence.md`, `element-identity.md` and
`repository-layout.md`.

**Read:** `reports/i-leftover-sizing.md`, section 4.

**Task.**
1. Rewrite every history line section 4 lists in the present tense, saying what the
   code does now. For each line you rewrite, check its claim against the code it
   names. Correct a claim the code contradicts, and list it in the report.
2. **`web-capabilities.md`:** drop the "Changed by (Phase 1.2)" column and its legend.
   Fold what a partial row still lacks into "Why this state", and keep every row.
3. **`repository-layout.md:95`:** keep "Never commit it" and its reason; drop the
   dated narrative.
4. Search the six pages for other history (dates, "until", "before", "used to",
   "no longer", wave, phase, step, landed) and treat it the same way.

No plan history and no working-document vocabulary (waves, phases, brief or worker
names) on the pages.

**Tests.**
- The link checker over the six pages:
  `node C:/Users/mrjoh/AppData/Local/Temp/claude/f---FluxIQWebExtension/4f264c80-323b-4673-a09a-bde5851669f3/scratchpad/dcd-check-links.mjs <pages>`.
- A grep for `Wave [0-9]|Phase 1\.[0-9]|Step [0-9]+, landed|Before Phase|until Wave`
  over `docs/architecture` finds nothing.
- Do not run `pnpm check`, `pnpm test` or any build; the supervisor's root gates are
  running.

**Report:** `reports/d-arch-history.md`.

## Amendment to `l-stage2d` — pins, and two more figures

**Pins:** this repository `d639415` and Core `3cb8976`, both `origin/dev`. Core's last
code commit is `20bb3b4`.

**Also report:**
- for every Flow-lane run, `startCandidateIndex` and `stoppedWithoutFailedAttempt`
  from its `flow-lane.json` (`g-runner-start-guard`);
- for any `recording.persistence` failure in the bench, whether its discards are
  runtime confirmations, as kinds and counts only (`i-leftover-sizing`, item 7d).

**Second amendment:** skip Run 6, the bench. Lab Stage 3 runs concurrently, and its
two benches replace it.

## Amendment to `l-stage3` — three concurrent workers at the `l-stage2d` pins

This replaces Task 2's "one at a time, with no other Lab instance running", and the
order of steps 2 and 4.

**Pins:** this repository `d639415`, Core `3cb8976`. Core is built in
`F:\fxlab\!FluxIQ`; use it read-only, and never build, check out or clean it.

| Worker | Worktree, moved to `d639415` | Runs under | Task | Report |
| --- | --- | --- | --- | --- |
| `l-stage3a` | `F:\fxlab\fxlab-7263534-load` | `F:\fxlab-runs\stage3\a\` | Bench A | `reports/l-stage3a.md` |
| `l-stage3b` | `F:\fxlab\fxlab-16ff729-b` | `F:\fxlab-runs\stage3\b\` | Bench B | `reports/l-stage3b.md` |
| `l-stage3-demo` | `F:\fxlab\fxlab-16ff729-step4` | `F:\fxlab-runs\stage3\demo\` | Step 4, the demo | `reports/l-stage3-demo.md` |

**Each worker:**
- touches only its own worktree and run directory. `l-stage2d` holds
  `F:\fxlab\fxlab-7263534`;
- sets its worktree up as `reports/l-stage2d.md` "Setup" did: rebuild `domain/dist`,
  `packages/test-contracts/dist` and `apps/scenario-lab/dist` there. The lockfile
  matches, so install only if `node_modules` is missing;
- reads free memory before each Lab command, waits in 2-minute steps while it is
  under 3 GB, and reports the lowest value seen;
- runs under concurrent load: a timing-only failure is a single observation. Rerun it
  once while free memory is above 6 GB before calling it real.

**`l-stage3-demo` first:** list the worktree's modified tracked files, as paths only.
Restore them with `git checkout --` only if every one is generated output, such as
`apps/extension/build/`; otherwise stop and report.

**Each bench report** quotes the brief's list, except the comparison:
- headline rates per lane;
- for every exit criterion, the row counts and rates it is judged on;
- each row's verdict, and `startCandidateIndex` for Flow-lane rows;
- for any `recording.persistence` failure, its discard kinds and counts.

The supervisor compares A with B once both report.

**Unchanged:** headed runs as `v-bench-honesty` requires, `FLUXIQ_TEST_ENV_FILES=none`,
the stop on a leak above 0, and quoting rather than summarising.

## d-core-llm-reachability — Core's LLM page says what the shipped app can reach (Core docs)

**Owns:** in `F:\!FluxIQ`, only `docs/architecture/automation-studio.md`'s
"LLM-Assisted Deterministic Automation" section and the sections under it.

**Read:** `reports/i-week2-entry-points.md`, open questions 1, 2 and 4; Core's
`AGENTS.md`.

**Task.**
1. Where the page says production allows the build grant only for `flow_bootstrap`,
   state what `packages/fluxiq/src/programs/_shared/runtime.ts:74-83` allows for
   each grant purpose.
2. Where it describes live patch testing, automatic promotion, the retry after an
   applied patch, or training modes as current, say which the shipped app reaches:
   - which grant purpose gives each one a provider;
   - that an explicit AI run skips the retry (`automation-studio/runtime/service.ts`
     `:3540`, `:3594`);
   - that the retry begins where the Flow begins, not at the failed node.
3. Check each sentence you write against the code it names. Describe current design
   only, with no plan history.

**Tests:** `pnpm docs:check` in `F:\!FluxIQ`. No builds and no test suites.

**Report:** `reports/d-core-llm-reachability.md`, in this repository.

## i-bench-compare-prep — a ready comparison of bench A and bench B (read-only, plus one script)

Dispatched while Lab Stage 3 runs, so the comparison takes minutes once both
benches report.

**Owns:** `reports/i-bench-compare-prep.md`, and one script in the supervisor's
scratchpad, `bench-compare.mjs`. Nothing tracked.

**Read:**
- the plan's Metrics section, and `How Week 1 Is Proven`;
- `reports/v-bench-honesty.md`;
- the bench report writer in `packages/test-runner/src/bench/`, for the report's
  file names and fields;
- one finished week1 bench report under `F:\fxlab-runs\`, from Stage 2 or
  `l-stage2c`, as a real input.

**Task.**
1. Write `bench-compare.mjs <reportDirA> <reportDirB>`. For every metric the Metrics
   section defines, it prints A's value, B's value, the stated tolerance, and
   within or outside.
2. It also prints:
   - the rows whose verdict differs between A and B;
   - for each exit criterion, the row counts and rates it is judged on, per run;
   - any `recording.persistence` failure's discard kinds and counts.
3. Run it against the finished report, given as both A and B, and against a copy
   with one row's verdict flipped. Show that the flip is caught.
4. Where the Metrics section names a metric the bench report does not carry, or
   gives no tolerance, say so. Do not invent one.

Print no recorded page data or secret values: field names, counts, rates and row
ids only. Run no Lab command, and touch no Lab worktree.

**Report:** `reports/i-bench-compare-prep.md`: the script's usage, its output on the
real report, the flip test, and every gap from task 4.

## i-ranking-draft — the Phase 1.6b blocker ranking, drafted before the benches report (read-only)

Dispatched while Lab Stage 3 runs, so the ranking needs only its figures once the
benches report.

**Owns:** `reports/i-ranking-draft.md`. Nothing tracked.

**Read:**
- the plan's Current State, Objective, `How Week 1 Is Proven` and Metrics;
- `open-questions.md`;
- `reports/i-leftover-sizing.md`;
- `reports/i-week2-entry-points.md`, task 1 only;
- the archive, only for the ledger headings that record why an item was ruled out
  of Week 1.

**Task.**
1. **Ranked list.** Draft every known reliability blocker and leftover. For each,
   give:
   - what fails;
   - the exit criterion or Lab row it touches;
   - its rank: Week 1 blocker, Week 1 close-out, Week 2 entry, or later;
   - the observation that would change that rank.
2. **Ruled-out items.** Include each one with its recorded reason, citing the ledger
   or archive heading. Include every open question that bears on a criterion.
3. **Criterion rows.** For each of the six exit criteria, say what observation closes
   it: from which report (`l-stage2d`, `l-stage3a`, `l-stage3b` or `l-stage3-demo`)
   and which field.
4. **Placeholders.** Leave one only for a figure a bench or Lab report will supply,
   and name the field that fills it.

Quote no recorded page data or secret values. Run nothing, and touch no Lab worktree
or run directory.

**Report:** `reports/i-ranking-draft.md`, at most 200 lines.

## Rulings on how the criteria count, from `i-ranking-draft` Q1-Q4

- **Criterion 1** counts the unarmed corpus workflows W01-W19, 3 of 3 on each lane,
  as the Objective says. Variant rows are reported, but outside criterion 1.
- **Criterion 4** is judged on the Objective's set, the W14, W19 and W27 negative
  variants, at least 90%. The rate over every negative variant, W24 `unannounced`
  included, is reported beside it, and every miss is ranked.
- **Ruled-out rows** (W05 `short-catalog`, W13 `banner-absent`, W24 `unannounced`)
  still run and are reported by name.
- **Criterion 5:** `l-stage3a` and `l-stage3b` are two complete runs at the same
  pins, neither selected nor discarded, under the same load, so they count as the
  two consecutive runs. If any metric falls outside tolerance, a third bench run
  alone decides before the criterion is called failed.
- **Criterion 2** needs Lab observations no dispatched run makes, so `l-evidence`
  runs them.

## l-evidence — criterion 2's Lab proofs: the 16 evidence items and `sensitive-input`'s leak check (Lab owner)

Dispatched while Lab Stage 3 runs, at its pins.

**Owns:** no tracked file. Worktree `F:\fxlab\fxlab-16ff729`, moved to `d639415`; runs
under `F:\fxlab-runs\evidence\`; report `reports/l-evidence.md`.

**Read:**
- the plan's Objective row "Browser evidence is useful", Phase 1.4 and `How Week 1
  Is Proven`, for what "the 16 items" are;
- `docs/architecture/page-evidence.md`;
- `reports/l-stage2d.md`, "Setup" and "How the campaign runs", for the commands.

**Setup:** follow the `l-stage3` amendment's "Each worker" rules, including the memory
guard and the read-only Core worktree.

**Runs.**
1. **`sensitive-input`, ×3 on each lane the Lab runs it on,** with the run leak
   attestation. Report findings per run as counts, and the declared-secret search
   over Core's workspace, SQLite included.
2. **The 16 items,** from one passing Flow-lane run's sanitized evidence packet:
   - each item the plan names, present or absent, by key;
   - the packet's bytes against its budget, and whether `truncated` is visible;
   - if the plan's items and the packet's keys do not match one to one, both lists.
3. **The fixture assertions:** name the tests that assert the 16 items and the
   `sensitive-input` leak, and whether they ran in the root gate at `f840b75` (plan
   ledger, "Integration: root gates pass"). Do not rerun the suites.

Stop on a leak above 0. Report paths, keys, kinds and counts only.

**Report:** `reports/l-evidence.md`.

## i-w04-w08-no-proposal — why W04's and W08's Flow rows get no recording Flow proposal (read-only)

Dispatched on `l-stage2d`'s open question 1, while Lab Stage 3 runs. W04 and W08 are
criterion 1 workflows, so this blocks Week 1 until explained.

**Owns:** `reports/i-w04-w08-no-proposal.md`. Nothing tracked.

**Read:**
- `reports/l-stage2d.md`: "Run 6", and open question 1;
- the archive's H2 entry (Flow-lane rows that passed with no Flow built), and the
  entries that decided which week1 rows run the Flow lane (`g-bench-coverage`,
  `g-flow-lane-expectations`);
- `packages/test-runner/src/bench/corpus/week1.ts`, rows W04 and W08, and those two
  scenarios' manifests in `apps/scenario-lab/src/scenarios/`.

**Evidence, read-only:** the W04 and W08 bundles, both lanes, of the stopped bench
under `F:\fxlab-runs\stage2d\d\`, and `l-stage2c`'s W04 Flow bundles. Report keys,
kinds and counts only. Do not open anything under `F:\fxlab-runs\stage3\`.

**Task.**
1. What each recording holds: entry kinds and counts. Does each workflow's script
   perform an action a recording can map, or does it only read and extract?
2. Why the same Flow rows passed in Stage 2, citing the archive and Stage 2's bundle
   fields if they still exist.
3. Which is true, with code and bundle citations:
   - (a) the workflow has no recordable action, so no Flow can be proposed, and the
     corpus or runner should state that the lane does not apply, with the reason;
   - (b) the workflow does act, and the recorder, mapper or Core lost the action;
   - (c) something else.
4. The smallest correct fix: owning files, the tests it needs, and whether it
   changes criterion 1's W01-W19 set.

No Lab runs and no edits. Quote no recorded page data.

**Report:** `reports/i-w04-w08-no-proposal.md`.

## i-open-questions-refresh — every open question and ruled-out item, with its true status (read-only)

Dispatched on `i-ranking-draft` open questions 5 and 6, while Lab Stage 3 runs. Week 1
is finished only when every open item is closed, or ruled out with its reason
recorded.

**Owns:** `reports/i-open-questions-refresh.md`. Nothing tracked; the supervisor
applies the edits.

**Read:**
- `open-questions.md`, in full;
- the plan's Current State;
- `reports/i-ranking-draft.md`, sections 2 and "Open questions";
- the archive and the plan's ledger, by heading search only, for each item's ruling.

**Task.**
1. **Each entry in `open-questions.md`:** its current tag, and its true status (open,
   settled or ruled out of Week 1). Cite the ledger or archive heading, or the code
   (file:line) that settles it. Give the exact replacement tag and a one-sentence
   resolution, written for pasting.
2. **The archive's ruled-out items missing from Current State's "Ruled out of Week
   1" list:** each with its reason and heading. Give a compact replacement for that
   list that fits in at most 12 lines.
3. **Items still open that bear on an exit criterion:** name them, for the ranking.

Quote no recorded page data or secret values. Run nothing, and touch no Lab worktree
or run directory.

**Report:** `reports/i-open-questions-refresh.md`.

## f-demo-cleanup-error — a demo keeps its lane's error when session cleanup fails (test-runner)

From `l-stage3-demo` open question 2. In both attempts, the demo Core's session cleanup
threw `EBUSY`, and that replaced the recording lane's own error.

**Owns:** `packages/test-runner/src/demo-workspace/core-process.ts` and its tests in
`packages/test-runner/src/demo-workspace/tests/`.

**Read:** `reports/l-stage3-demo.md`, open questions 2 and 4;
`packages/test-runner/src/secret-leak-attestation.ts:102`, for the retry the runner
already uses.

**Task.**
1. **A failed lane keeps its error.** When the lane failed and removing the session
   then fails too, report the lane's error, with the cleanup failure as a second,
   labelled line. When only the cleanup fails, fail with the cleanup error, as now.
2. **Retry the removal** on `EBUSY`, `EPERM` and `ENOTEMPTY`, after the Core process
   tree has exited.
3. **Never follow a junction.** The session directory holds junctions into the pinned
   Core. Prove with a test that the removal deletes a junction without touching its
   target: a junction to a temporary directory, whose file survives. If it does not,
   unlink junctions first.

**Tests.**
- Rows for tasks 1 and 2: a removal that throws `EBUSY` and then succeeds; a lane error
  kept when the removal throws.
- The junction row from task 3.
- A mutation for each guard, restored byte-identical.
- The test-runner gates with a private build directory, and the structure audit.

No Lab or demo runs.

**Report:** `reports/f-demo-cleanup-error.md`.

## i-demo-recording-finalize — why the demo's recording lane finds no new recording after Stop (read-only)

From `l-stage3-demo` open question 3. Both demo recordings lack an end marker, and
`waitForNewRecording` gave up after 10 s.

**Owns:** `reports/i-demo-recording-finalize.md`. Nothing tracked.

**Read:**
- `reports/l-stage3-demo.md`: attempts `a1` and `a2`, and open question 3;
- `packages/test-runner/src/demo-workspace/`: `workspace-lanes.ts`, `control-waits.ts`,
  `provisioning.ts`, and what the lane calls to stop recording;
- in `F:\!FluxIQ`: the `list-recordings` handler, and where a recording is finalized and
  indexed.

**Evidence, read-only:**
- `F:\fxlab-runs\stage3\demo\a1` and `a2`: the demo workspace, the evidence bundle and
  Core's log;
- SQLite opened read-only with `node:sqlite`, reporting table names, row counts and
  status fields only;
- for comparison, a finalized Lab recording in `F:\fxlab-runs\stage2d\kept\`.

Never delete anything under, or recurse into, a `.s\<session>` directory: those hold
junctions into Core.

**Task.**
1. What `waitForNewRecording` waits for, exactly, and what `list-recordings` would
   return for these two recordings, from their persisted state.
2. How the demo stops recording, and whether that stop reached Core's finalize. Cite
   Core's log lines and the stored state.
3. Which is true, with citations:
   - (a) finalize happened, but later than 10 s under load;
   - (b) the stop never reached finalize;
   - (c) the recording was finalized but not listed;
   - (d) something else.
4. The smallest fix: which repository and files, and which tests.

No Lab or demo runs, and no edits. Quote no recorded page data or secret values.

**Report:** `reports/i-demo-recording-finalize.md`.

## i-harness-activation — what the Flow lane's harness activations count with no provider (read-only)

From `i-bench-compare-prep` open question 1. In Stage 2, 14 of 44 Flow-lane runs had
harness activations while `llm: disabled, calls 0`, and the Metrics section says the
rate "must be 0 with provider disabled". In `l-stage2d`, every failed Flow run showed
`harnessActivations=2`, and every passing run 0.

**Owns:** `reports/i-harness-activation.md`. Nothing tracked.

**Read:**
- the plan's Metrics rows "Harness activation rate" and "Fuzzy recovery rate";
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts:170-230` and
  `packages/test-runner/src/bench/aggregate-report.ts:100-130`;
- in `F:\!FluxIQ`: where a run detail's interventions are written (the runtime service
  and the recovery ladder), and the training-mode settings a Lab-created project gets.

**Evidence, read-only:**
- `l-stage2d`'s W25 `too-slow` and W15 `popup-blocked` bundles under
  `F:\fxlab-runs\stage2d\a`, and one passing run there, for contrast;
- any Core run detail they hold.

Report kinds, statuses and counts only.

**Task.**
1. What each counted intervention is: its kind, its status, whether a provider was
   called, and which Core code writes it for a failed node with no provider.
2. Whether Core should record it in the Lab's training mode, and whether it meets the
   metric's definition, "runs requesting an LLM intervention".
3. Which is true, with citations:
   - (a) the runner counts a record that is not an LLM request, so the metric should
     filter it;
   - (b) Core requests an LLM intervention it should not in this mode;
   - (c) "must be 0" is wrong for negative variants that fail by design;
   - (d) something else.
4. The smallest correct fix: its repository, files and tests. Also say whether Lab
   Stage 3's benches can be re-read without rerunning them.

No runs and no edits. Quote no recorded page data.

**Report:** `reports/i-harness-activation.md`.

## f-actionless-flow-lane — a workflow whose script performs no action plans no Flow-lane row (test-runner, test-contracts)

From `i-w04-w08-no-proposal` (case a). W04's and W08's scripts only read the page, so
no recording can yield a Flow, and their four Flow rows can never pass.

**Decided:**
- W04 and W08 count for criterion 1 on the recording lane only. A Flow for an
  extraction-only workflow is Week 2 (the archive's paginated-extraction ruling).
- Stage 3's benches at `d639415` keep those four rows; the supervisor excludes them
  when reading the benches.

**Owns:** the bench planner `packages/test-runner/src/bench/expand-corpus.ts`, the
runner's Flow-lane decision in `packages/test-runner/src/run-scenario.ts`, one new
module in `packages/test-contracts/src/` for the shared check, its barrel export,
and their tests.

**Read:** `reports/i-w04-w08-no-proposal.md`, fix section.

**Task.**
1. **One shared check:** a workflow whose script holds no action step has no Flow lane.
   Name the step kinds that count as actions from the scenario contract, not from a
   list of rows.
2. **The planner** plans no Flow row for such a workflow, so week1 plans 63 results,
   not 67.
3. **The runner:** a `lab run --flow` of such a workflow refuses before any browser
   starts, as `fixture.invalid`, with a message naming the reason.

**Tests.**
- The shared check, both ways.
- The planner's week1 plan: 63 results, with W04's and W08's Flow rows absent.
- The runner's refusal.
- A mutation for each guard, restored byte-identical.
- The test-runner and test-contracts gates with a private build directory, and the
  structure audit.

No Lab runs.

**Report:** `reports/f-actionless-flow-lane.md`.

## i-evidence-packets — why no Flow-lane attempt carries a measured evidence packet (read-only)

From the supervisor's read of bench A's first 8 Flow-lane runs at `d639415`: no action
has `evidencePackets`, including the one failed run. So `sanitizedPacketBytes` is
empty again, as in Stage 2 (0 samples). Criterion 2 needs a "sanitized packet ≤
budget with `truncated` visible".

**Owns:** `reports/i-evidence-packets.md`. Nothing tracked.

**Read:**
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts:272-283`, and where
  `EVIDENCE_PACKET_POINTS` is defined;
- the archive's entries for `g-bench-evidence-size`, `g-single-run-evidence` and
  `g-evidence-reader-merge`, found by heading search;
- the domain's writer of that evidence summary, and where Core writes an attempt's
  `metadata.stateRefs`.

**Evidence, read-only:**
- `l-stage2d`'s kept Core workspaces under `F:\fxlab-runs\stage2d\kept\`: for the run
  detail's attempts, whether `metadata.stateRefs` exists, at which points, and
  whether each holds `summary` and `truncated`;
- those runs' `snapshots/flow-lane.json`.

Report key names and counts only.

**Task.**
1. Which attempts carry `metadata.stateRefs`, at which points, and with or without
   `summary` and `truncated`.
2. Where the chain breaks, with citations:
   - the domain never produces the summary on these runs;
   - Core stores a reference without the summary;
   - Core withholds it;
   - the runner's point names differ;
   - it is produced only on some paths, such as failure capture or LLM context.
3. Whether those earlier entries were proven on real Lab packets, or on fixtures only.
4. The smallest fix: its owner, tests, and the one Lab run that would prove it.

No runs and no edits.

**Report:** `reports/i-evidence-packets.md`.

## f-host-runtime-policy-action — the domain snapshots a recorded Flow's web actions (domain)

From `i-evidence-packets`, Part 1. `host-runtime.ts:76` refuses every node that is not
`web.output.*`. Core makes every recorded action `builtin.policy.action`, with the web
output in `parameterValues.outputId`. So no Lab Flow run has ever produced an evidence
packet.

**Owns:** `domain/src/runtime/host-runtime.ts` and
`domain/src/runtime/tests/host-runtime.test.ts`.

**Read:** `reports/i-evidence-packets.md`, sections 2 and 4.

**Task.**
1. **Which nodes count as web nodes:** a `definitionId` in `WEB_AUTOMATION_NODE_IDS`, or
   `builtin.policy.action` whose `parameterValues.outputId` is a string in
   `WEB_AUTOMATION_ACTION_TYPES`. Nothing else.
2. **A one-sided diff:** `inspectStateDiff` declines by throwing when either side's
   snapshot is missing, so no diff claims that every element was removed.
3. Correct the file's header comment where it says the binding already gives a web
   attempt its `stateRefs`.

**Tests.**
- A policy action with `outputId: "web.dom.click"` dispatches
  `web.dom.capture_snapshot` and returns a summary with a boolean `truncated`.
- A policy action with a non-web `outputId`, or none, is declined with 0 dispatches.
- A one-sided diff is declined.
- Mutations, each restored byte-identical:
  - the old `definitionId`-only check fails the first row;
  - dropping the diff guard fails the third.
- Domain `pnpm check` and `pnpm test` with a private `DOMAIN_TEST_BUILD_LABEL`, and the
  structure audit.

**Report:** `reports/f-host-runtime-policy-action.md`.

## g-core-host-state-node — the after-action capture and state diff get the executed node (Core)

From `i-evidence-packets`, Part 2. The user was alerted before this Core area's first
edit. `enrichAttemptWithHostState` hands the `after_action` capture and
`inspectStateDiff` a stub node, `{ id, definitionId, parameterValues: {} }`
(`host-state.ts:25-26,31-36`). So a host cannot tell which web action ran.

**Owns (Core):**
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/host-state.ts`;
- its callers in `runtime/executor/node-execution.ts`;
- their tests;
- the unreleased `0.4.0` entry in `docs/architecture/package-boundaries.md`;
- regenerating both framework references.

**Read:** `reports/i-evidence-packets.md`, sections 2 and 4.

**Task.** Pass the execution node, with its resolved `parameterValues`, into
`enrichAttemptWithHostState`. Use that node for the `after_action` capture and for
`inspectStateDiff`. Before-action behaviour is unchanged.

**Tests.**
- An executor row whose host runtime records both capture inputs, asserting that
  `after_action` and the diff receive the node's `parameterValues.outputId`.
- A failure-branch row: the node reaches the capture there too.
- A mutation that restores the stub node fails those rows.
- `npx vitest run <files> --no-file-parallelism`, `pnpm check` and `pnpm docs:check`.
  The supervisor runs the full gate and the build.

**Migration Notes:** one paragraph in the `0.4.0` entry. A host runtime's `after_action`
capture and `inspectStateDiff` now receive the node's resolved parameter values.

**Report:** `reports/g-core-host-state-node.md`, in this repository.

## g-evidence-budget-invariant — a Flow-lane run fails when a packet exceeds its budget (test-runner)

From `i-evidence-packets` open question 2. Criterion 2 says "sanitized packet ≤ budget",
but no runner code compares `sanitizedPacketBytes` to a budget.

**Decided:** the budget is the one the domain's host runtime applies, the exploration
budget of 6,000 bytes. Import it from the domain; do not restate it.

**Owns:** the run-evaluation module that computes a run's failed invariants, under
`packages/test-runner/src/run-evaluation/`, and its tests. Do not edit
`run-scenario.ts`, `bench/expand-corpus.ts` or anything under `demo-workspace/`; other
workers hold them. If the check needs one of those files, stop and report.

**Task.**
1. A Flow-lane run whose any measured packet is over the budget gets a failed
   invariant. Its message names the action's position, the point and the bytes, and
   quotes no packet content.
2. A run with no packets gets no such invariant, because another criterion row reports
   that gap.

**Tests.**
- A packet at the budget passes, and one over it fails.
- No packets: no invariant.
- A mutation for the comparison, restored byte-identical.
- The test-runner gates with a private build directory, and the structure audit.

No Lab runs.

**Report:** `reports/g-evidence-budget-invariant.md`.

## f-runner-no-dry-run-llm — the Lab no longer switches Core's LLM on (test-runner)

From `i-harness-activation`, which found (d). The runner sends `dryRunLlm: true`
(`existing-fluxiq-control.ts:250`), which turns Core's LLM step back on. So every failed
Flow run records an LLM request that fails with `llm.provider_missing`.

**Owns:** `packages/test-runner/src/existing-fluxiq-control.ts` (or wherever that request
is built) and its test, `existing-fluxiq-control.test.ts`. Do not edit `run-scenario.ts`,
`bench/expand-corpus.ts`, `run-evaluation/`, `demo-workspace/` or `packages/test-contracts/`;
other workers hold them.

**Read:** `reports/i-harness-activation.md`; `git log -S dryRunLlm` over the runner, to
learn why the flag was added.

**Task.**
1. Stop sending `dryRunLlm: true` on runs where no provider is configured.
2. If the flag's commit shows a purpose a Lab run still needs, name it and stop. Do not
   work around it.

**Tests.**
- The row at `existing-fluxiq-control.test.ts:259` asserts the request carries no
  `dryRunLlm`.
- A mutation restoring the flag fails it.
- The test-runner gates with a private build directory, and the structure audit.

**Report:** `reports/f-runner-no-dry-run-llm.md`.

## g-core-ladder-llm-off — the recovery ladder offers no LLM step when the LLM is off (Core)

From `i-harness-activation`. The user was alerted before this Core area's first edit. With
the LLM disabled, Core's recovery ladder still offers its LLM rung
(`runtime/executor/recovery-ladder.ts`), and a failed node records a diagnosis
intervention.

**Owns (Core):** `packages/fluxiq/src/programs/automation-studio/runtime/executor/recovery-ladder.ts`,
and its tests in `runtime/executor/tests/`.

Do not edit:
- `host-state.ts` or `node-execution.ts`, or `runtime/tests/executor.test.ts`;
- `docs/architecture/package-boundaries.md`, or the framework references.

`g-core-host-state-node` holds those. Put your Migration Notes paragraph in your report
for the supervisor to merge.

**Read:** `reports/i-harness-activation.md`.

**Task.**
1. When the run's LLM setting is off, the ladder offers no LLM rung. The deterministic
   rungs, and a run's final failure, are unchanged.
2. When the LLM is on, behaviour is unchanged.
3. Cite where the ladder reads "LLM off": the setting or policy it already receives. Add
   no new input unless none exists; if none does, stop and report.

**Tests.**
- LLM off: no LLM rung, and the failure is unchanged.
- LLM on: the rung is offered as before.
- A mutation that ignores the setting fails the first row.
- `npx vitest run <files> --no-file-parallelism` and `pnpm check` in `F:\!FluxIQ`.

**Report:** `reports/g-core-ladder-llm-off.md`, in this repository.

## f-demo-wait-finalized — the demo waits for its recording to finalize (test-runner)

From `i-demo-recording-finalize`. Under load, Core was still storing the recording's
entries when `waitForNewRecording`'s 10 s ran out. The demo then stopped Core
mid-write, so the recording never finalized.

**Owns:** `packages/test-runner/src/demo-workspace/control-waits.ts`, and a new
`packages/test-runner/src/demo-workspace/tests/control-waits.test.ts`. Do not edit
`core-process.ts` or its test; they are verified and awaiting commit.

**Read:** `reports/i-demo-recording-finalize.md`, especially its fix section.

**Task.**
1. `waitForNewRecording` waits for the recording's `endedAt`, reusing
   `awaitFinalizedRecording` with `summaries: true`.
2. Give it a named, injectable bound, with the default chosen and justified in the
   report. Its failure message names the recording id and the last observed entry
   count, and no page data.

**Tests.**
- A recording that finalizes after several polls resolves.
- One that never finalizes fails with the named bound.
- A mutation back to "any new recording" fails the first row.
- The test-runner gates with a private build directory, and the structure audit.

**Report:** `reports/f-demo-wait-finalized.md`.

## f-evidence-items-harness — the content harness asserts all 16 evidence items (extension e2e)

From `l-evidence`. Criterion 2 needs "evidence fixture assertions (16 items) green", but
`evidence.spec.ts` has rows for only 10 of the 16 items. Items 2, 4, 5, 10, 13 and 16
have none.

**Owns:** `apps/extension/e2e/content/tests/evidence.spec.ts`, and any content-harness
fixture page it needs under `apps/extension/e2e/`. Do not edit `apps/scenario-lab/src`,
`packages/test-contracts/src` or extension source; other workers hold them. If a missing
item needs a product change, stop and report it.

**Read:**
- `reports/audit-evidence.md:31-53`, which lists the 16 items;
- `reports/l-evidence.md`, section "The 16 items";
- `docs/architecture/page-evidence.md`.

**Task.** For each missing item:
- a row that asserts the page evidence carries the item on a page that has it;
- where it is cheap, the row where a page lacks it.

Follow the spec's existing fixture and assertion pattern. Quote no page content beyond
what the fixture itself defines.

**Tests.**
- From `apps/extension`, run
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 evidence.spec.ts`.
  Do not use `test:content`, which rebuilds a shared `dist` another worker is changing.
- A mutation per new row (drop the field it reads, or break its expectation), restored
  byte-identical.
- The extension's `pnpm check`, and the structure audit.

**Report:** `reports/f-evidence-items-harness.md`.

## Amendment to `l-stage3a` and `l-stage3b` — stopped

Both benches are stopped and report partial, single-observation passes. The fixes now
landing (evidence packets, the LLM rung, action-less rows, the demo wait) change runtime
behaviour, so criterion 5's pair runs later at new pins. Under concurrent load the pace
was about one run per 5 minutes, so the old pair could not finish in time to count.

## l-probe-late-rows — the week1 rows the stopped benches never reached, once each (Lab owner)

A defect-finding pass at `d639415` and Core `3cb8976`, so the late rows' defects surface
while the current fixes are still in flight. It is not a criterion proof: every run is a
single observation.

**Owns:** no tracked file. Worktree `F:\fxlab\fxlab-7263534`, already at `d639415` and
built by `l-stage2d`: verify it, and do not rebuild or check out Core. Runs under
`F:\fxlab-runs\probe\`; report `reports/l-probe-late-rows.md`.

**Read:**
- `packages/test-runner/src/bench/corpus/week1.ts`: rows W13-W29, their workflows,
  variants and lanes;
- `reports/l-stage2d.md`, "How the campaign runs", for the driver, environment and
  command shapes, including the auth-gate secret for W18;
- the `l-stage3` amendment's "Each worker" rules.

**Runs.**
- For each row from W13 to W29, and each variant the corpus lists, run one
  `lab run <scenario> [--workflow …] [--variant …] --target isolated`. Run it on the
  Flow lane (`--flow`), and on the recording lane where the bench runs one.
- Skip what `l-stage2d` measured three times at these pins: W15 unarmed and
  `popup-blocked`, W17 `upload`, W25 `too-slow`, and W28.

**Report, per run:**
- the verdict, and the reported and expected failure category and code;
- `startCandidateIndex` and `harnessActivations`;
- for W20-W23, whether the run recovered without the harness;
- the categories for W26 `no-context` and W29;
- any `recording.persistence` failure, and the lowest free memory.

Stop on a leak above 0.

**Report:** `reports/l-probe-late-rows.md`.

## Amendment to `g-core-ladder-llm-off` — Route B (Core)

The worker stopped as its step 3 required. The ladder's options
(`runtime/executor/contracts.ts:153-187`) carry no LLM field. The only LLM input is an
attempt count, set at `runtime/service.ts:3447` from `maxInterventionsPerRun`.

**Decided: Route B.** Route A would report a disabled LLM as a used-up budget, so it is
rejected.
1. Add one optional option to the graph execution options in `executor/contracts.ts`,
   saying whether the LLM rung may be offered. Absent means today's behaviour.
2. Set it at `service.ts:3447` from the run's LLM setting, with no net line growth in
   `service.ts`, which is at its line limit.
3. Check it at `recovery-ladder.ts:54`, so an LLM that is off gives no LLM rung.

**Owns, widened:** `executor/contracts.ts`, that one site in `runtime/service.ts`,
`executor/recovery-ladder.ts`, and tests in `runtime/executor/tests/`.

**Still not yours:** `host-state.ts`, `node-execution.ts`, `runtime/tests/executor.test.ts`,
`package-boundaries.md`, and both framework references. The supervisor regenerates the
references at Core's gate and merges your Migration Notes paragraph from your report.

**Tests** as the brief says, plus a row showing an absent option keeps the LLM rung.

## i-stage3-load-failures — W10's `recording.persistence` and W13's `gateway.connection` in stopped bench B (read-only)

From `l-stage3b`. Under four concurrent Lab processes, W10 failed `recording.persistence`
on both lanes, and W13's Flow row failed `gateway.connection`. At the same pins with less
load, `l-stage2d`'s partial bench passed W10 on both lanes. Stage 4's benches may run
together, so a load-only failure must be told apart from a defect first.

**Owns:** `reports/i-stage3-load-failures.md`. Nothing tracked.

**Read:**
- `reports/l-stage3b.md`, and `reports/l-stage3a.md` if it has landed;
- `reports/i-demo-recording-finalize.md`, where Core stored entries 7-21 s late under
  load;
- the runner's recording completeness check and the Flow lane's finalize wait, and their
  bounds.

**Evidence, read-only:**
- the W10 bundles, both lanes, and the W13 Flow bundle under `F:\fxlab-runs\stage3\b\`;
- `stage3\a` too, if its report has landed.

Report keys, kinds, counts and timings only.

**Task.**
1. **W10:** the exact failure message and details (a short count, a recording not
   finalized, or a bound hit); the timings from Stop to finalize to deadline; and
   `recordedActions`, extension against Core.
2. **W13:** where `gateway.connection` was raised (the runner phase and message), and the
   Core and extension log lines around it.
3. **For each:** a load artifact, meaning a bound shorter than Core's measured latency
   under load, or a defect. Cite bundle fields and code.
4. **If a bound is too short:** the smallest fix (file, named bound, and a value justified
   by the measured latency), and whether Stage 4's benches should run concurrently.

No runs and no edits.

**Report:** `reports/i-stage3-load-failures.md`.

## f-lab-wait-bounds — the Flow lane's finalize wait fits Core under load, and a pairing timeout says where it stopped (test-runner)

From `i-stage3-load-failures`. All five W10 failures hit the runner's 30 s wait for
Core to finalize the recording. A passing W10 took up to 25.8 s, and a stored entry
took p50 634 ms alone against 1,001-1,420 ms with two benches. W13 timed out waiting
for a pairing code, with nothing recording where it stalled.

**Owns:**
- `packages/test-runner/src/flow-lane/finalized-recording.ts` and its test;
- in `packages/test-runner/src/run-scenario.ts`, only the error-event details near
  `:377`;
- the pairing-code wait's file and its test.

**Read:** `reports/i-stage3-load-failures.md`.

**Task.**
1. Raise the finalize wait's `DEFAULT_TIMEOUT_MS` from 30,000 to 90,000 ms, and state
   the measured latency that justifies it in the constant's comment.
2. A `recording.persistence` failure from that wait publishes the wait's details
   (bound, waited ms, last entry count, `endedAt` seen) on its error event, as
   `recording.contract` already does. Ids, counts and times only.
3. The pairing-code wait's timeout records the extension's last reported status and
   the pairing step reached. Leave its 15 s bound unchanged.

**Tests.**
- Rows for each task.
- A mutation for the details publication, and one for the pairing status, each restored
  byte-identical.
- The test-runner gates with a private build directory, and the structure audit.

**Report:** `reports/f-lab-wait-bounds.md`.

# Lab Stage 4 — the final campaign at the fix pins

**Pins:** named by the supervisor at dispatch, after the fixes' gates, the Core build, and
both `dev` branches pushed.

**Order:**
1. `l-final-proofs` runs alone.
2. `l-final-bench-a` and `l-final-bench-b` start together only once it reports without a
   blocker.

A failed proof would waste both benches. `i-stage3-load-failures` measured about 20% more
throughput with two benches running together than with one, but W10's finalize wait
timed out only under that load. So the benches run together only at a pin that carries
`f-lab-wait-bounds`, and one after the other otherwise.

**Every Stage 4 worker:**
- sets up its worktree as `reports/l-stage2d.md` "Setup" did, uses the pinned Core read-only
  after one build, and follows the memory guard in the `l-stage3` amendment;
- uses the counting rulings in "Rulings on how the criteria count", with W04's and W08's
  Flow rows absent from the plan;
- stops on a leak above 0, and labels single observations.

## l-final-proofs — the fixes, observed live before the benches (Lab owner)

**Owns:** worktree `F:\fxlab\fxlab-7263534`, runs under `F:\fxlab-runs\final\proofs\`, and
`reports/l-final-proofs.md`.

**Runs, in order:**
1. **Evidence packets:** `product-catalog` Flow lane ×1, workspace kept.
   - Every web action has `beforeAction` and `afterAction` packets, and a `stateDiff`.
   - Each packet is at most 6,000 bytes, and `truncationCount` equals the `truncated`
     packets.
   - The budget invariant does not fire, and statuses and `comparisonStatus` values match
     `l-stage2d`'s.
2. **The LLM stays off:** W25 `too-slow` ×3 and W15 `popup-blocked` ×3, Flow lane.
   - `harnessActivations` is 0.
   - The categories are unchanged: `timeout` / `web.action.timeout`, and
     `output_not_observed`.
3. **Leak rows with snapshots stored:** `auth-gate` ×3 and `sensitive-input` ×3, on each
   lane, workspaces kept. Each declared literal is found 0 times, SQLite included.
4. **The demo:** `demo:record` then `demo:run`, provider-free, with the credentials as
   process variables. Both must exit 0.

**Report:** each run's figures, and any blocker, before the benches start.

## l-final-bench-a and l-final-bench-b — criterion 5's pair (Lab owner)

**Owns:**
- worktrees `F:\fxlab\fxlab-7263534-load` (A) and `F:\fxlab\fxlab-16ff729-b` (B);
- runs under `F:\fxlab-runs\final\a\` and `F:\fxlab-runs\final\b\`;
- reports `reports/l-final-bench-a.md` and `reports/l-final-bench-b.md`.

**Run:** `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus week1 --repeat 3 --target isolated`,
headed as `v-bench-honesty` requires, with the auth-gate secret supplied as in Stage 2.

**Report:** the `l-stage3` list, as the rulings count it, plus:
- the packet count, sizes and truncation per lane;
- `harnessActivations` per row;
- any `recording.persistence` failure's discard kinds.

The supervisor compares A with B with `bench-compare.mjs`.

## f-final-flow-run-bound — a bounded run request must not become a false no-action failure

From `i-final-w02`: both final benches reproduced W02 Flow repeat 0 as
`action.dispatch` with no durable attempt. A synthetic probe confirms that
`executeRecordedFlowRun` swallows a bounded 30-second request failure and reads
one still-running, zero-attempt detail immediately.

**Owns:**
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`;
- `packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts`;
- `reports/f-final-flow-run-bound.md`.

**Read:** Week 1 Current State; `reports/i-final-w02.md`; the two owned files;
`existing-flow-run.ts` only for its bounded-failure distinction; HTTP control
types only as needed to use the existing public seam.

**Task.**
1. Do not treat arbitrary `RunnerFailure` as permission to read a terminal run.
2. On a bounded timeout/abort for the expected run, poll boundedly for terminal
   detail and durable attempts, using a measured bound compatible with the
   existing 90-second finalization/load evidence. Preserve the original failure
   if terminal evidence never arrives; never emit the false no-action failure.
3. Keep successful and genuinely failed terminal-run behaviour unchanged.
4. Add focused rows for timeout then terminal attempts, timeout that never
   reaches terminal evidence, and non-bounded failures.

**Validation:** focused private-build tests and typecheck; a mutation that
restores the immediate detail read and makes the new row fail, restored exactly.
No Lab, source outside the owned files, commit, or push.

**Report:** `reports/f-final-flow-run-bound.md`.

## f-final-scripted-navigation-settle — preserve two intentional recording actions

From `i-final-w10`: W10 primary sometimes records only its click, so Core
faithfully runs a short Flow and the final-state oracle rejects the false
success. Historical candidate counts 1/2/1 confirm a driver/intake race.

**Owns:**
- `packages/test-runner/src/scenario-steps/step-runner.ts`;
- `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts`;
- `reports/f-final-scripted-navigation-settle.md`.

**Read:** Week 1 Current State; `reports/i-final-w10.md`; owned files; and
`navigation-recorder.ts` constants/decision rules only.

**Task.**
1. Before a scripted `navigate` following trusted user input, wait until the
   prior navigation cannot remain pending or be attributed to that input.
2. Derive the bound from both the 250 ms debounce and 5,000 ms explanatory
   window; do not assume waiting only past the debounce makes an `other`
   transition intentional. Avoid delaying navigation when no relevant input
   preceded it or the elapsed time already satisfies the bound.
3. Keep step timing honest: the barrier is part of the navigate step.
4. Add deterministic injected-clock/sleep tests for waiting, already-settled,
   and no-prior-input paths.

**Validation:** test-runner check; focused private test; mutation removing the
barrier makes its row fail, then exact restoration. No Lab, Core/extension
source, other shared docs, commits, or pushes.

**Report:** `reports/f-final-scripted-navigation-settle.md`.

## Lab Stage 4b — targeted loaded recheck before restarting full benches

**Pins:** downstream `15974e749feed931b7de3c73ec6611c801557e32` and
Core `19468b72c4472fd5cc58940737702d5e4d72c985`.

**Shared:** use the final-bench worktrees, exact clean pins, isolated instances,
process-safe reports, and the Stage 4 memory guard. Start both workers together.
No auth-gate value is needed. Stop on a leak above zero.

### l-final-recheck-w02

- Owns `F:\fxlab\fxlab-7263534-load`, `F:\fxlab-runs\final\recheck-w02`,
  and `reports/l-final-recheck-w02.md`.
- Run W02 `keyboard-forms` primary Flow lane three times.
- Require 3/3 exits and verdicts passed, a created Flow, durable attempts,
  start candidate zero, and zero harness activations. Record whether the
  initial run request crossed 30 seconds and recovery polling was exercised.

### l-final-recheck-w10

- Owns `F:\fxlab\fxlab-16ff729-b`, `F:\fxlab-runs\final\recheck-w10`,
  and `reports/l-final-recheck-w10.md`.
- Run W10 `navigation` primary Flow lane three times, then `broken-link` three
  times.
- Require two proposal candidates on all six recordings. Primary requires
  click plus navigation attempts and both verdicts passed. Variant requires
  the expected first-click `navigation_unexpected` failure and passing test
  verdict. Require start candidate zero and harness zero throughout.

Workers write exact bounded results and cleanup state; no source/shared-doc
edits, commits, pushes, or raw logs/page data.

## f-final-scripted-navigation-transition — make scripted navigation deterministic

Stage 4b proved that the settle barrier is insufficient: W10 primary recorded
two candidates 3/3, but `broken-link` recorded only one in two consecutive
loaded runs even though all functional verdicts were correct. Chromium may
still classify Playwright `page.goto` as an `other` transition after any wait;
the recorder intentionally records standalone navigation only when the browser
reports `typed`.

**Owns:**
- `packages/test-runner/src/scenario-steps/scripted-navigation.ts`;
- `packages/test-runner/src/scenario-steps/tests/scripted-navigation.test.ts`;
- `packages/test-runner/src/scenario-steps/step-runner.ts`;
- `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts`;
- `packages/test-runner/src/scenario-steps/index.ts` only if an export is needed;
- `reports/f-final-scripted-navigation-transition.md`.

**Read:** Week 1 Current State; `reports/l-final-recheck-w10.md`; owned files;
the recorder intake's transition mapping; Playwright's local CDP typings for
`Page.navigate` only.

**Task.**
1. Execute a scripted `navigate` through Chromium CDP `Page.navigate` with
   `transitionType: "typed"`, waiting for the resulting document load without
   introducing a missed-event race.
2. Make unsupported CDP behavior an explicit, categorized fixture/runner
   failure rather than silently falling back to nondeterministic `page.goto`.
3. Remove the settle barrier and its five-second cost; explicit browser
   transition metadata is the synchronization contract.
4. Add focused tests for the exact CDP request, load ordering, session cleanup,
   and failure cleanup/category. Preserve honest step timing.

**Validation:** test-runner check and focused private tests. Do not run the Lab,
edit extension/Core source or shared docs, commit, or push.

**Report:** `reports/f-final-scripted-navigation-transition.md`, including
commands and what was not verified.

### Supervisor amendment after `i-final-scripted-navigation-review`

The first implementation is not accepted. In the same owned files/report:

1. Bound CDP command completion with the scenario/default navigation timeout;
   a hung send must fail and still attempt detach.
2. Prove a navigation caused a new load. Do not let an already-current target
   URL satisfy the waiter before the CDP command.
3. Prevent early command or protocol rejection from leaving a live Playwright
   waiter; no ignored timeout may survive the adapter call.
4. Treat only a non-empty protocol `errorText` as rejection, and add the missing
   primary-failure plus detach-failure precedence row.

Add deterministic regressions for each race, rerun check/focused tests, and
record a mutation that makes at least one new race guard fail. Still no Lab,
shared-document edits, extension/Core source, commit, or push.

### Second review amendment

The loader correlation is accepted, but the adapter's bound must cover its
whole lifecycle. Bound `newCDPSession(page)` as well as navigation setup/send/
load, and arrange cleanup if acquisition resolves only after its deadline.
Also bound `session.detach()` so cleanup itself cannot hang the run; preserve
an earlier primary failure over cleanup timeout/failure. Add deterministic
pending-acquisition, late-acquisition cleanup, and pending-detach tests. Repeat
the focused suite/check and update the same report before returning.

## Lab Stage 4c — typed-navigation loaded acceptance

**Candidate pins:** downstream local commit
`8327ddd` and Core `19468b72c4472fd5cc58940737702d5e4d72c985`.

`l-final-recheck-w10-typed` owns worktree `F:\fxlab\fxlab-16ff729-b`, a new
run root `F:\fxlab-runs\final\recheck-w10-typed`, and
`reports/l-final-recheck-w10-typed.md`. Check out the exact downstream local
commit and exact shared Core pin, clean; build the required packages into the
worktree's instance paths. No auth-gate value is needed.

Run W10 `navigation` primary Flow lane three times, then `broken-link` three
times, under one isolated instance with the Stage 4 memory guard. Require all
six recordings to have two extension/Core actions and two proposal candidates.
Primary must run click then navigation and pass reported/oracle/test verdicts.
Variant must start at candidate zero, fail the click as expected with
`navigation_unexpected` / `web.navigation.unexpected`, and pass its test
verdict. Require harness activations 0 and leak findings 0 throughout; stop on
any leak. Preserve accepted bundles and report bounded identifiers/counts/
categories/timings plus exact cleanup and worktree state. No source/shared-doc
edits, commits, pushes, or raw logs/page data.

## Stage 4d investigation — explicit scripted-navigation intent

Stage 4c rejected the CDP transition hypothesis: consecutive loaded primary
runs completed `Page.navigate({ transitionType: "typed" })` but still produced
only the click candidate. Investigate an extension-owned, test-control-only
intent/acknowledgement without changing Core or source yet.

### i-final-navigation-intent-extension

Owns only `reports/i-final-navigation-intent-extension.md`. Read the extension
background composition, runtime test-control message handling, navigation
intake/recorder, and their closest tests. Specify the smallest exactly-once
state machine: arm by tab and bounded destination, consume the next top-frame
commit independent of browser transition label, preserve redirect debounce,
record one existing `typed` navigation event, acknowledge only after its send,
and cancel/expire/stop safely. Name exact source/test file ownership and
security constraints. No edits, builds, Lab, Core, commit, or push.

### i-final-navigation-intent-runner

Owns only `reports/i-final-navigation-intent-runner.md`. Read runner-side
extension-page/control-message wiring, `run-scenario` recording sequencing,
and scripted-navigation/step-runner files. Specify how the runner arms, drives,
awaits, and cancels an opaque intent with one deadline and no secret/page-data
diagnostics; name exact source/test files and preserve honest step timing.
Address navigation failure, missing acknowledgement, and cleanup precedence.
No edits, builds, Lab, Core, commit, or push.

## Stage 4e implementation — acknowledged scripted navigation

The supervisor accepts the two Stage 4d designs. Both workers use this exact
internal contract: arm `{ type, url }` returns `{ ok:true, intentId }`; await
`{ type, intentId }` returns `{ ok:true, intentId }` only after the existing
recording-event send; cancel `{ type, intentId }` always returns
`{ ok:true, cancelled }`. Negative arm/await responses are `{ ok:false, code }`
from the closed vocabulary in `i-final-navigation-intent-extension`; no response
contains URLs, page data, caught text, tokens, or tab ids. The manager, not the
caller, derives the active automation tab.

### f-final-navigation-intent-extension

**Owns:** the extension source/test partition in
`reports/i-final-navigation-intent-extension.md`, plus
`reports/f-final-navigation-intent-extension.md`. It may omit the optional
navigation-recorder test when no recorder API changes.

Implement the safe loopback URL validator, state machine, first-refusal commit
ownership, existing debounce, exactly-one forced-typed event through public
intake, post-send acknowledgement, expiry/terminal retention, sender guard,
and cancel on stop/refusal/tab close/disconnect. Preserve every unarmed rule.
Run extension check and focused private tests. Mutation A removes the owned
commit early return and must expose a duplicate; mutation B acknowledges before
the deferred send and must fail. Restore exactly. No runner/Core/shared-doc
edits, Lab, commit, or push.

### f-final-navigation-intent-runner

**Owns:** the runner source/test partition in
`reports/i-final-navigation-intent-runner.md`, plus
`reports/f-final-navigation-intent-runner.md`.

Replace the rejected CDP driver with the extension-control-page-bound factory.
Implement local URL/response validation, one absolute arm/goto/await deadline,
late-arm cancel, bounded idempotent cleanup, fixed failure mapping, and first-
failure precedence. Inject it into `ScenarioStepRunner` and bind it only after
recording is confirmed. Run test-runner check and focused private tests.
Mutate away await and failure-path cancel; each targeted row must fail, then
restore exactly. No extension/Core/shared-doc edits, Lab, commit, or push.

## Stage 4f cross-review

`i-final-navigation-intent-extension-review` reads only the Stage 4e extension
diff, its tests/report, and the agreed contract; it writes the same-named report.
`i-final-navigation-intent-runner-review` does the equivalent for the runner
diff. Each checks protocol compatibility, exactly-once/post-send ordering,
deadline/cleanup races, security/sanitization, lifecycle precedence, missing
tests, and structure. Read-only except its own report; no build, Lab, Core,
commit, push, or shared-document edit. Rank findings and give an accept/change
verdict; the supervisor independently verifies both claims.

## Stage 4g review corrections

### f-final-navigation-intent-runner-review-fixes

Owns the existing runner Stage 4e files/tests and updates its implementation
report. Observe a promise immediately on entry to `beforeDeadline`, including
when no time remains, so a late transport rejection cannot be unhandled.
Enforce exact own-key sets for every arm/await/cancel success and closed failure
shape; extra response fields are malformed and never exposed. Add deadline-edge
late-rejection, acknowledgement remaining-budget, await transport rejection,
and extra-key regressions. Run focused tests/check and mutate away the immediate
observer to make its row fail. No extension/Core/shared-doc/Lab/commit/push.

The extension review's corrections will be appended separately after its
cross-review reports; no worker edits both halves concurrently.

### f-final-navigation-intent-extension-review-fixes

Owns the existing extension Stage 4e files/tests and updates its implementation
report. Replace the shared `NavigationRecorder.schedule` dependency with an
intent-owned 250 ms redirect debounce so an earlier ordinary click-landing
callback and the scripted intent both survive exactly once. Do not add a runner
sleep. Keep expiry/terminal retention within the original arm-time 30-second
deadline rather than restarting it at completion. Add the pending ordinary
landing + two intent commits regression, send rejection, production stop/
refusal/tab-close/disconnect and sender-security rows, and a composed deferred-
send acknowledgement assertion. Mutating back to shared scheduling must fail.
Run extension check/focused suite; no runner/Core/shared-doc/Lab/commit/push.

## Stage 4h final integration review

The original extension author reviews the amended extension half and the
original runner author reviews the amended runner half. Each updates its
existing `i-final-navigation-intent-*-review.md` with a final disposition,
checking the prior findings, the exact cross-half message shapes, timers,
cleanup, lifecycle ordering, and tests. Read-only except that report; no
source/build/Lab/Core/shared-doc/commit/push. Report only new P1/P2 blockers;
otherwise explicitly accept for supervisor gates and live W10.

## Lab Stage 4i — acknowledged-intent W10 acceptance

**Candidate pins:** downstream local commit `db3cc17` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`.

`l-final-recheck-w10-intent` owns worktree `F:\fxlab\fxlab-16ff729-b`, a new
run root `F:\fxlab-runs\final\recheck-w10-intent`, and
`reports/l-final-recheck-w10-intent.md`. Check out the exact pins clean and
build required packages into the worktree instance paths. No auth secret is
needed. Do not reuse Stage 4c bundles as acceptance evidence.

Run W10 `navigation` primary Flow lane three times, then `broken-link` three
times under one isolated instance with the Stage 4 memory guard. Require every
recording to retain two extension/Core actions and two proposal candidates.
Primary must execute click then navigation and pass reported/oracle/test
verdicts. Variant must start at candidate zero, fail its first click as expected
with `navigation_unexpected` / `web.navigation.unexpected`, and pass its test
verdict. Require harness activations, leaks, persistence failures, and discards
all zero; stop immediately for any leak. Preserve accepted bundles and report
bounded ids/counts/categories/timings plus exact cleanup and worktree state.
No source/shared-doc edits, commits, pushes, or raw logs/page data.

## Stage 4j — allow the exact Lab extension-page sender

Stage 4i rejected `db3cc17` 0/6 because every arm returned `forbidden`.
`i-final-navigation-live-refusal` confirmed Chromium supplies `sender.tab` when
the exact side-panel extension URL is loaded through `context.newPage()`. The
existing unit test incorrectly called that shape a content sender.

`f-final-navigation-sender-guard` owns only
`apps/extension/src/background/scripted-navigation-control.ts`, its existing
test, and `reports/f-final-navigation-sender-guard.md`. Remove only the blanket
`sender.tab` prohibition. Continue to require this extension's exact runtime id
and exact sidepanel/popup URL; a web/content sender with a tab remains forbidden.
Add the runner-shaped exact sidepanel URL + tab acceptance row and amend the
content-sender rejection row to use a web URL + tab. Mutate the tab prohibition
back in and prove the runner-shaped row fails, then restore. Run extension check
and focused tests. No runner/Core/shared-doc/Lab edits, commit, or push.

## Stage 4k — structure-compliant intent placement

After Stage 4j, the tracked source count exposes the hard 25-file connection
directory limit. `f-final-navigation-intent-structure` owns the intent module,
its test, all direct extension source/test imports of it, a new focused child
barrel, and `reports/f-final-navigation-intent-structure.md`.

Move `connection/scripted-navigation-intent.ts` to the smallest cohesive
`connection/scripted-navigation/intent.ts` child and its test to
`connection/scripted-navigation/tests/intent.test.ts`; add that directory's
barrel and update imports without behavior changes. The parent barrel exports
through the child barrel. Run structure audit, extension check, and the moved
focused test. Do not alter behavior, runner/Core/shared docs/Lab, commit, or push.

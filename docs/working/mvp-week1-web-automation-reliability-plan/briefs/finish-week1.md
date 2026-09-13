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
  The `pnpm --filter ... test:content --` form finds no tests.
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

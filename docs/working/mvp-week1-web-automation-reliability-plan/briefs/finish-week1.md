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

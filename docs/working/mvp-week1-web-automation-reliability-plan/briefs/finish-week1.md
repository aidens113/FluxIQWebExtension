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

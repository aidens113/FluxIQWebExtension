# t150 — `run-scenario.ts` split by diagnosing why it grew

## Outcome

Done. `packages/test-runner/src/run-scenario.ts` is 688 lines, down from 812, and
`node scripts/structure-audit.mjs` no longer reports it as a `file-lines` FAIL —
it is now only the 400-line advisory warning. Twenty modules with their own
doc comments, six barrels and seventeen test files (53 tests) came out of it.
`pnpm structure:baseline` is unblocked as far as this file is concerned.

Two `working-docs` failures remain and are the supervisor's; one of them is newly
red and was not caused by this task. Details under **Commands run**.

## Why it grew

Six responsibilities had settled into the runner that say nothing about the order
a run happens in. Each is now a module under
`packages/test-runner/src/run-scenario/`:

1. **The browser session** — requiring the built extension, launching headed
   Chromium with it loaded, reading the build string over CDP, making the
   extension hold the fixture tab, and confining the whole session to three
   origins. Five modules under `run-scenario/browser-session/`.
2. **Which workflow and variant a run resolves to, and when it arms** — three
   modules under `run-scenario/workflow/`. The page-fact schedule reads both,
   because a workflow's page facts describe the unarmed rendering and a
   variant's the armed one.
3. **Which secret values a run replays, scrubs and later attests** —
   `run-scenario/resolve-run-secrets.ts`. This one had a real rule buried in it,
   now stated in one place: the declared literals are deliberately *not* added to
   what the bundle scrubs, because scrubbing them on write would hide the leak
   the attestation scans for.
4. **The fixture's entry point** — `run-scenario/open-scenario-start.ts`, still
   re-exported from `run-scenario.ts` so every caller and test that imported it
   from there still does.
5. **The Core round trip** — proving the gateway kept the session this run paired
   and that the recordings it produced are finished rather than merely started.
   Two modules under `run-scenario/core-round-trip/`.
6. **Replaying a Flow that already exists** — the clone package and the
   destination's safety assessment (`run-scenario/clone-target/`), and what the
   remote-FluxIQ and cloned-Flow lanes share: the authenticated client, the
   inputs the Flow is run with, and the three bundle snapshots its run leaves
   (`run-scenario/persisted-flow-target/`).

Two duplications disappeared with (6). The two replay lanes each built the Flow's
run context and wrote the three `runtime-*.json` snapshots independently; a field
added to one would simply never have reached the other, silently.

The same diagnosis, and the reasons the rest stays, are now the header comment of
`run-scenario.ts` itself.

## Why the rest stays in `run-scenario.ts`

Mechanically, not by preference. Both reasons are keyed to that exact path, so
moving the spine would drop a guarantee rather than carry it.

- **The failure-handling ratchet.** The structure audit keys `swallowed-failure`
  and `failure-as-empty` findings by file path, and `applyRatchet` fails a
  ratcheted finding outright when the path has no baseline entry — `--update`
  never adds one, and `--adopt` is refused for a rule that already has entries.
  `run-scenario.ts` carries 14 `swallowed-failure` and 3 `failure-as-empty`
  findings. Its catch block, its whole `finally` cleanup, its publication step,
  and the two helpers `findScenarioPageWithExpectedState` and `copyProcessLogs`
  therefore cannot move at all: any new file holding one of those findings is an
  immediate FAIL. Both counts are unchanged after this split (14 and 3), so
  nothing was recorded away.
- **Source-shape pinning.** Four test files read `run-scenario.ts` as text and
  assert on roughly sixty literals and orderings:
  `run-evaluation/tests/runner-wiring.test.ts`,
  `run-evaluation/tests/single-run-evaluation.test.ts`,
  `tests/scenario-assertions.test.ts` and `tests/coordinator-existing.test.ts`.
  They are the only thing that can check, for example, that the Core action probe
  runs before the fixture reset and the reset before the reload; that a step's
  extraction read is kept *before* the assertion that may throw; that the
  redaction scan happens after Core stops, after its logs are copied in, and
  before the bundle is sealed; that `armScenarioVariant` is called exactly three
  times in a fixed order relative to the three `openScenarioStart` loads. Those
  guarantees live in the textual ordering of one file. Moving a pinned call site
  into a collaborator and concatenating sources for the test would turn a real
  ordering guarantee into an artefact of concatenation order.

Pinned, and so deliberately left in place: `resolveWorkflow` (holds the single
`flowLaneExclusion` call), `assertFinalState`, `extensionControlPage`,
`pairExtension`, `copyProcessLogs`, the `BLANK_TAB_URL` constant, the
`RunScenarioOptions`/`RunScenarioResult` types, `flowRunHooks`, and all four lane
branches.

## What a second pass would take

688 lines is 112 under the limit. The remaining mass worth moving is the four
lane branches plus `flowRunHooks`, about 170 lines. Both need the same thing
first, and it is a real refactor rather than a move:

- **A shared run record.** The run's mutable state is a dozen `let`s that the
  catch, the cleanup and the manifest all read (`recordingStarted`,
  `scenarioPage`, `existingExecution`, `panelVerification`, `automationFailure`,
  `flowObservation`, `oracleVerdict`, `actions`, …). Each lane assigns to six of
  them *partway through* its sequence — `recordingStarted = true` before the
  dispatch so the cleanup can stop a recording a failed dispatch left open;
  `panelVerification` before the throw that rejects an unverified panel, so the
  manifest records the status it rejected. A lane module that returned its
  results instead would change what a mid-lane failure leaves in the bundle,
  which is exactly the kind of silent difference this task was told not to make.
  Turning those `let`s into one record the spine and a lane share is the
  prerequisite.
- **Then the guards move with the code.** Once a lane is a module, its pinned
  literals belong in a test that reads that module. That is safe for the
  *existing* and *clone* replay lanes today: no guard references them at all.
  It is not safe for `flowRunHooks`, whose `armScenarioVariant`,
  `openScenarioStart` and `assertExpectedFacts` call sites participate in
  count-and-order assertions that span the spine.
- **Optionally, the ratchet.** `findScenarioPageWithExpectedState`'s `catch {}`
  is a search where "this page does not show the final state" is the expected
  outcome, and `copyProcessLogs`'s is a genuinely best-effort copy. Both could
  carry the audit's own `best-effort:` marker, which would lower the
  `swallowed-failure` entry and free them to move. I did not do it: it is
  annotation rather than decomposition, and it belongs in a change that is about
  those two call sites.

## Changed and why

New, all under `packages/test-runner/src/run-scenario/` (20 modules, 6 barrels,
17 test files):

- `browser-session/` — `require-extension.ts`, `launch-browser.ts`,
  `browser-version.ts`, `activate-scenario-tab.ts`,
  `install-run-network-guard.ts`, `index.ts`, `tests/` (4 files).
- `workflow/` — `unarmed-workflow.ts`, `workflow-selection.ts`,
  `scenario-arming.ts`, `index.ts`, `tests/` (3 files).
- `core-round-trip/` — `assert-core-round-trip.ts`, `recording-ids.ts`,
  `index.ts`, `tests/` (2 files).
- `clone-target/` — `export-run-clone-package.ts`,
  `pending-clone-destination.ts`, `clone-destination-assessment.ts`,
  `index.ts`, `tests/` (2 files).
- `persisted-flow-target/` — `open-existing-fluxiq-control.ts`,
  `persisted-flow-run-context.ts`, `write-persisted-flow-snapshots.ts`,
  `index.ts`, `tests/` (2 files).
- Top level — `configured-credentials.ts`, `evidence-event.ts`,
  `resolve-run-secrets.ts`, `open-scenario-start.ts`, `index.ts`, `tests/`
  (4 files).

Modified:

- `packages/test-runner/src/run-scenario.ts` — 812 to 688 lines: the header
  comment above, the moved definitions removed, their call sites now importing
  through the one barrel `./run-scenario/index.js`, and the unused imports
  dropped.
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts` — one
  assertion follows the moved `openScenarioStart`. It checked that the harness's
  own load and the address Core is told come from one expression
  (`await page.goto(scenarioStartUrl(scenarioOrigin, scenario));`); it now reads
  that expression where it lives, via a new `runnerModuleSource` reader. The
  guarantee is unchanged; nothing else in that file or the other three pinning
  files was touched.

### Behaviour preserved, and the three places it was close

Every moved body is verbatim. Three call sites needed care:

- **The clone package export.** The original assigned `cloneState.clonePackage`
  and its hash *before* throwing on an incompatible verdict, and the cleanup
  block reads `cloneState.clonePackage` to verify the source is unchanged. So the
  new module returns the package and its hash without judging, and the throw
  stays at the call site after both assignments.
- **The clone destination assessment.** Only the pure `classifyCloneDependencies`
  projection moved; the effectful sequence around it (the destination project,
  the id map, `assertClonePackage`, the re-hash, the import, the bundle writes,
  `topology = { ...topology, projectId }`) stays in place and in order, because
  that order decides what a mid-sequence failure leaves in the manifest.
- **Three parameter types were widened, not narrowed.** `workflowSelection`,
  `armingOf`, `unarmedWorkflow` and `pendingCloneDestination` now take the narrow
  structural shape they actually read rather than the whole
  `RunScenarioOptions`/`CloneSourceConfiguration`. Every existing call still
  compiles unchanged, and this is what keeps the collaborators from depending
  back on `run-scenario.ts`.

One rename: the private `event(...)` helper became `evidenceEvent(...)` in
`run-scenario/evidence-event.ts`, with its 27 call sites renamed mechanically
(count asserted before and after). It is not an export of the package, and no
pinning assertion contains the old name.

## Commands run and observed results

- `node scripts/structure-audit.mjs` **before** any change — 2 failures:
  `FAIL [file-lines] packages/test-runner/src/run-scenario.ts: 812 lines exceeds the 800-line limit`
  and `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`.
  `docs/working/language-driven-flow-loop-plan.md` was **passing** at that point.
- `node scripts/structure-audit.mjs` **after** — 2 failures, both `working-docs`,
  both in `docs/` and neither mine:
  - `docs/working/README.md is out of date with the documents' header blocks` —
    already red before I started; expected to stay until this change lands.
  - `docs/working/language-driven-flow-loop-plan.md: 802 lines exceeds the 800-line compaction threshold`
    — **newly red, and not from this task.** That file was under the threshold
    when I started and was modified at 12:21 while I was working; `git status`
    showed it already dirty at the start of my session. I own no file under
    `docs/` except this report.
  - `run-scenario.ts` now appears only as
    `warn [file-lines] packages/test-runner/src/run-scenario.ts: 688 lines is past the 400-line advisory threshold`.
  - Per-rule check of the ratcheted findings on `run-scenario.ts`:
    `swallowed-failure value=14` and `failure-as-empty value=3`, unchanged from
    before, so both stay suppressed and neither grew. No new
    `directory-files`, `naming`, `imports` or `test-placement` finding names any
    `run-scenario` path. The one lowerable baseline entry is
    `failure-as-empty packages/test-runner/src/existing-fluxiq-control.ts 2 -> 1`,
    which pre-existed this task.
- `pnpm --filter @fluxiq-web-extension/test-runner build` — clean, no
  diagnostics, `Done`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` — `# tests 1459`,
  `# pass 1459`, `# fail 0`, `# duration_ms 33815`. One failure appeared on the
  first run of this and was fixed: `not ok 795 - the runner tells the
  created-Flow lane where the Flow starts, using the address it would have
  opened`, the pinned assertion that followed `openScenarioStart`.
- `node --test "dist/run-scenario/**/*.test.js"` — `# tests 53`, `# pass 53`,
  `# fail 0`, `# duration_ms 1737`, the new modules' own tests.

### A `domain` build failure that is not this task's, and one repair I made

`pnpm --filter @fluxiq-web-extension/test-runner... build` — the brief's exact
command — **failed in `domain`, not in `test-runner`**:

```
domain build: src/runtime/llm-evidence/node-run/run.ts(218,5): error TS2412:
Type 'WebLlmNameAssumption[] | undefined' is not assignable to type
'WebLlmNameAssumption[]' with 'exactOptionalPropertyTypes: true'.
```

That file is not mine and is on my must-not-touch list. It was modified at
12:40, while this build was running, and was not among the dirty files in the
session's opening `git status` — a concurrent worker's in-flight edit. The same
command **succeeded** earlier in this session, before that edit existed.

The failure had a side effect on shared state: `domain`'s build script is
`clean-dist && tsc && rewrite-dist-specifiers`, so the clean ran, `tsc` emitted
declarations anyway, and the rewrite step never ran — leaving
`domain/dist/index.d.ts` with unextended relative specifiers, which made
`test-runner`'s own build fail with ~30 `TS2834`/`TS2835` errors that had nothing
to do with anything in this task. I repaired that by regenerating the artifact
through its owning script, `node domain/scripts/rewrite-dist-specifiers.mjs`
(`rewrite-dist-specifiers: 791 specifier(s) in 236 file(s) under dist`), and
touched no `domain` source. `test-runner` then built clean and its 1459 tests
passed again.

**`domain` itself still does not compile**, and that is for its owner to fix.
`domain/dist` now reflects that worker's in-flight source rather than a committed
state, so the supervisor should rebuild `domain` once it compiles before treating
any downstream build as a clean measurement.

## Not verified

- **No live browser run.** This is the Lab's own runner, and nothing here was
  exercised against a real Chromium, a real Core or a real fixture. The unit
  coverage and the source-shape guards are what stand behind it. Two modules in
  particular are only proven by a live run: `browser-session/launch-browser.ts`
  (one call into Playwright's persistent context with fixed options) and
  `persisted-flow-target/open-existing-fluxiq-control.ts` (constructs the control
  client and logs in). Both are thin adapters over an external API with no branch
  of their own beyond two conditional spreads, and neither is injectable, so
  neither carries a test. Giving `openExistingFluxIQControl` a `createClient`
  seam — the pattern `exportClonePackage` already uses in this package — would
  make its `totp` and `freshLogin` spreads testable, if that is judged worth the
  extra surface.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, per the
  brief. Nothing outside `packages/test-runner/` was compiled or tested by me
  except as noted in the `domain` section above.
- **`pnpm structure:baseline` was not run**, per the brief. The
  `swallowed-failure` and `failure-as-empty` counts for `run-scenario.ts` are
  unchanged, so the baseline needs no edit on this file's account; the one
  lowerable entry elsewhere pre-existed.
- **The 53 new tests are unit tests over fakes.** The `activateScenarioTab` test
  runs the extension callback against a fake `globalThis.chrome` rather than in a
  browser page; the `assertCoreRoundTrip` test fakes Core's gateway snapshot and
  recording list. They prove the branching, not the wire.

## Open questions or contradictions found

1. **The ratchet keys failure findings by file path, which pins failure handling
   to whatever file it is already in.** This is a genuine tension with "split it
   by diagnosing why it grew": the audit both demands the split and forbids the
   part of it that would move the failure-handling code. It is the right default
   — it stops a violation being relocated to a fresh, unbaselined file — but it
   means a large file whose bulk *is* failure handling has no legal split until
   the findings themselves are addressed. Worth a decision at some point:
   either `--adopt` gains a per-key form, or files like this one resolve their
   findings rather than move them.
2. **The source-shape guards make `run-scenario.ts` deliberately rigid, and
   nothing says so where a future agent would look.** Four test files pin it; the
   file itself did not mention them until this task's header comment. A second
   pass should decide consciously whether those orderings are better expressed as
   runtime assertions over a recorded call sequence, which would free the file's
   shape entirely.
3. **Running the brief's `...build` is not safe while another worker edits
   `domain`.** It cleans and rebuilds a shared `dist`, and a failure there breaks
   every downstream package until the rewrite step is run by hand. A
   test-runner-scoped brief is better served by
   `pnpm --filter @fluxiq-web-extension/test-runner build`, or the concurrent
   work needs its own worktree.

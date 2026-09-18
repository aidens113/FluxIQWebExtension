# Worktree shared Core: keeping it current, building it once, and fitting the path limit

Worker report for task t013, worktree `F:\fxwork\t013-worktree-core-exit`, branch
`task/t013-worktree-core-exit`. The supervisor committed the first round as
`014f2de` and merged `dev` into it as `6e83e7e`. The second round, described in
the next section, is uncommitted on top of that.

## Outcome

Done, with one finding that is not mine to fix; see question 3 in round 2.

- **Round 2 (this update).** The first round's cache location,
  `<core>/node_modules/.core-web-build`, broke Core's web build every time.
  - The cause is the `node_modules` directory in the path. I proved that by
    experiment, and it is not the machine.
  - The cache now defaults to `<core>/.tmp/core-web-build`.
  - A cache root inside `node_modules` is refused with a message that names
    the cause.
  - A startup failure that comes back identical on the retry is no longer
    reported as the RAM fault.
  - A live campaign at the plain default built the web panel and earned a
    passed verdict.
- **Round 1.** Three defects were fixed:
  - **Stale shared Core:** `pnpm task sync-core`, its refusals, and the Lab's
    refusal of a Core that is behind `dev`.
  - **Duplicate web builds:** one cache and lock per Core instead of per
    worktree.
  - **Windows path limit:** the task slug is out of the path, and a path budget
    refuses before the build.

The rest of the report is the round-1 record, corrected where round 2 changed it.

## Round 2: the cache location crashed the build

### The live proof, first

These runs used the plain default: no `FLUXIQ_TEST_RUNS_DIR` and no
`FLUXIQ_CORE_WEB_BUILD_CACHE`. The other settings were
`FLUXIQ_LAB_INSTANCE=t013c`, `FLUXIQ_TEST_ENV_FILES=none` and
`FLUXIQ_TEST_TARGET=isolated`. The last two are needed because this worktree's
`.env.local` configures an existing installation. My first attempt without them
stopped at configuration with "FLUXIQ_TEST_PROJECT_ID is required for an
existing or clone target", before any build or provider call. The shared Core
was level with Core `dev` (`a0f9985`), and I removed the default cache before
each run so each run had to build it.

1. `pnpm lab:campaign social-scheduler-week-ahead`, campaign
   `2026-09-18T20-32-24-946Z`, run `run-mu7f0rfl-9e2bb3aa`.
   - **It built.** `logs/core-web-build.log` ends "Compiled successfully in
     21.1s ... [exit] code=0". The build was published at
     `F:\fxwork\!FluxIQ\.tmp\core-web-build\f25843e48938b5471f950672\`.
   - Core started, the live Flow build made 5 provider calls ($0.0163), and the
     task proposed a Flow.
   - **It then failed** as `environment.missing: http.timeout at control.request
     after 30000 ms`. That is the same failure as your `F:\cwb` run, and it did
     not reach a verdict the task earned. It is unrelated to the cache; see
     question 3 below.
2. So that the default location would be proven to reach an earned verdict, I
   ran `pnpm lab:campaign data-table-inventory`, a task that passed yesterday.
   Campaign `2026-09-18T20-39-23-568Z`, run `run-mu7faefu-2975af33`.
   - **It built** at the default location: "Compiled successfully in 25.1s ...
     [exit] code=0".
   - **Verdict `passed`**, succeeded, oracle `passed`, dataset judgement passed,
     Flow created, 4 provider calls, $0.0115, 1 attempt, no RAM faults.
3. After both runs the shared Core's `git status` was clean, and
   `git check-ignore` confirms `.tmp/` is ignored in both `F:\fxwork\!FluxIQ`
   and `F:\!FluxIQ`.

### Question 1: why `node_modules` broke the build, and where the cache went

**Proof.** I ran the real build (the real `prepareCoreWebBuild` and the real
`next build --turbopack`) against the real shared Core. Only the cache root
changed between runs:

| Run | Cache root | Result |
| --- | --- | --- |
| A | `F:\t013ab\node_modules\cwb` (outside Core) | exit 3221225501 after 5s |
| A, repeated | same | exit 3221225501 after 4s |
| B | `F:\t013ab\plain_modules\cwb` (same length) | built in 48s |
| C | `F:\fxwork\!FluxIQ\.tmp\core-web-build` (inside Core) | built in 45s |

- A fails outside Core, so being inside Core is not the cause.
- B has the same length as A and builds, so path length is not the cause.
- A fails twice in the same way within seconds, so it is not the RAM fault.
- The other explanation, that Next might have taken Core as its project root,
  is ruled out by construction: the generated `next.config.mjs` pins Turbopack's
  root to the drive root.

0xC000001D is `STATUS_ILLEGAL_INSTRUCTION`, which is how a native abort shows
up on Windows. The build log contains nothing else, so I have not seen
Turbopack's internal reason. What is proven is that the `node_modules` path
segment triggers it.

**Location chosen: `<core>/.tmp/core-web-build`.** It meets all four
requirements:

- **(a) Outside any `node_modules`.** Checked by the new `insideNodeModules`.
- **(b) Shared by every worktree that links this Core.** It is derived only
  from the Core root, so the cross-worktree lock still works.
- **(c) Within the path budget.** It is 37 characters for `F:\fxwork\!FluxIQ`,
  against the 80-character limit.
- **(d) Ignored by Core's git.** Core's own `.gitignore` already lists `.tmp/`,
  so I invented no new rule.

I also checked that nothing in Core scans `.tmp/`:

- Core's structure audit lists files with
  `git ls-files --exclude-standard`;
- every Vitest and tsc config is rooted in its own package;
- `pnpm-workspace.yaml` names only `apps/*` and `packages/*`.

The cache is removed together with the Core worktree.

**Backstop.** `prepareCoreWebBuild` refuses a cache root with a `node_modules`
segment, including one set by `FLUXIQ_CORE_WEB_BUILD_CACHE`. It does so before
Core is read, staged or built, with `environment.missing` and a message that
names the directory, the exit code, and what to do instead.

**Cleanup.** I removed the broken `F:\fxwork\!FluxIQ\node_modules\.core-web-build`
and my experiment directory `F:\t013ab`. I deleted with Node's `fs.rm`, which
does not follow junctions, because the staged workspaces link into Core's
`packages` and dependencies. Afterwards Core still had all 1011 of its tracked
`packages/` files, its `next` install, and a clean `git status`. I left your
`F:\cwb` in place.

### Question 2: a repeated build crash labelled as the RAM fault

**Cause.** `ramFaultSignature` treats every `process.startup` result as the
memory fault. Nothing ever asked whether the failure was the same each time, so
three identical build crashes were each retried and recorded in `ramFaults`. The
row's message said only "unclassified (finalized-bundle, scenario.execute)",
although the run's own bundle recorded "Core web panel production build did not
succeed".

**Fix.** A `process.startup` failure is a classified outcome: the Lab ran,
named the stage, and wrote a bundle. The new `lab-run/attempt-failure.mjs`
fingerprints such an attempt from four things:

- its category;
- its facility boundary, stage and reason;
- the first failure its bundle recorded;
- its exit code.

`runner.mjs` retries the first such failure once, logging that it "failed
before the run could start (…). This machine's memory fault can cause that, and
so can a real defect; only a retry tells them apart". If the retry fails
identically:

- it stops retrying;
- it clears the RAM label from both attempts;
- it logs that the attempt "failed exactly as attempt 1 did (…). A failure that
  repeats identically is deterministic, not this machine's memory fault";
- the row gets `repeatedFailure`;
- `summary.md` shows "same failure every time, deterministic: …".

A bare crash (an access violation or segmentation fault with no classified
result) is left as it was. It carries nothing that separates "the same failure"
from "the same symptom", and the existing test that pins two segmentation faults
as the memory fault still passes. As you instructed, I did not touch
`row/reported-spend.mjs`; the label was not in it.

### Question 3: the `F:\cwb` run that failed after 5 provider calls

**Not mine. Neither of my checks fired.**

- The staleness check refuses before any build and logs a `"lab":"core-commit"`
  line. The attempt log has none.
- The path-budget and `node_modules` refusals also fire before staging. That
  run built its web panel, started Core ("Ready in 769ms") and made 5 provider
  calls.
- I reproduced the identical failure (`http.timeout`, stage `control.request`,
  30,000 ms) at the default cache location. A second cache location giving the
  same result rules the cache out.

**What it most likely is.** The created-Flow lane
(`packages/test-runner/src/flow-lane/creation/lane.ts`) runs a live Flow
through `executeRecordedFlowRun`, in `flow-lane/persisted-flow-run.ts`.

- With a verification grant it makes one call, `control.runPersistedFlow`.
  That call executes the whole Flow and then the model check of its result,
  and it is bounded by the default 30,000 ms (`http-control/index.ts`,
  `boundedTimeout`).
- On that path the run id is only learned from the call's reply. So when the
  call times out, `executedRunId` is undefined and the recovery for bounded
  failures (`awaitTerminalRunDetail`) is skipped.
- The raw timeout therefore surfaces as `environment.missing`.

Timing supports this. The error came 68s (your run) and 84s (mine) after the
Flow build finished, which is 38s and 54s of apply, read, reset, page
preparation and authorisation, followed by exactly 30s on one request.

**This is an inference, not a proof.** Nothing in the bundle names the request
that hung, and `observedCalls` is 0 because no run id came back.

This task has never passed in any campaign on record. Earlier runs from the
main checkout failed later, on `runtime.behavior` and `security.redaction`, so
its Flows used to finish within the bound. The Flow runs longer now.

**What would fix it** is a separate unit of work in the runner's live-run
contract, not in my files. Either give the live one-call run a bound sized for
a Flow run plus its verification, or let the lane learn the run id before the
call so the timeout can be recovered.

## What I inherited, and whether I kept it

The previous worker left uncommitted changes to `scripts/task/*`,
`scripts/worktree/*` and `scripts/lab/pair/*`. They had moved `move-plan.mjs`
into `scripts/worktree/` and added `sync-core.mjs`, `apply-move.mjs`,
`install-worktree.mjs` and `shared-core-move.mjs` with tests. The design was
sound and all 108 of its tests passed, so I **kept all of it**:

- the move is split into a plan step (`planSideMove`) and an apply step
  (`applyMove`), shared with `lab:pair`;
- `planSharedCoreMove` holds the refusals;
- the install code is in one place.

**Running the real command exposed a defect the unit tests could not see.** The
real shared Core had no install or build markers, because `git worktree add`
created it and it was built by hand. So `sync-core` planned a reinstall and a
rebuild of a Core that was already correct. It then refused, because campaigns
were running, with the message "0 commit(s) behind dev and has to be moved".
Fixes 1a and 1b below address this.

## What the stale Core broke, and how I proved it

The shared Core had been left at `37679ce`, 11 commits behind Core `dev`
(`cf176fe`).

- Core's per-request token ceiling is **50,000** at `37679ce` and **64,000** at
  `cf176fe`.
- The campaign hard-codes `--llm-max-total-tokens 56000`.
- The export exists at both commits, so everything compiles and the failure
  only appears at runtime.

I passed the campaign's real budget to Core's real
`resolveAutomationStudioLlmTokenLimits`, with no provider calls:

```
BEFORE: stale proof Core (37679ce, 11 behind dev)
Core ceiling    : 50000
campaign budget : REJECTED -> llm_budget.absolute_token_ceiling: maxTotalTokens cannot exceed the absolute 50000-token per-request ceiling.
EXIT=1
AFTER pnpm task sync-core, same Core:
Core ceiling    : 64000
campaign budget : ACCEPTED {"maxInputTokens":48000,"maxOutputTokens":8000,"maxTotalTokens":56000}
EXIT=0
```

## End-to-end evidence (round 1)

Live campaigns were running against the real shared Core throughout, so every
move was made in an isolated proof base, `F:\fxwork-t013-proof\`. The only
commands run against the real shared Core were read-only `--dry-run` calls. The
proof base has since been removed with the repository's own `removeWorktree`.

**Refusals, each proven against a real checkout:**

- **Something running**, against the real shared Core while campaigns ran:
  "Bringing the shared Core F:\fxwork\!FluxIQ to 37679ce needs a checkout and a
  rebuild, but 16 running process(es) are working inside it or a worktree that
  shares it ... pass --allow-running, or open the task under another --base".
- **A dirty Core**, exit 1: "has 1 uncommitted or untracked change(s) (?? notes.txt)".
- **A commit no branch contains**, exit 1. I made it with `git commit-tree`
  because the hook blocks `git commit`, and no ref changed: "is at e1a1310...,
  which no branch or tag contains; moving it to dev would leave that commit
  reachable from nothing".
- **A Core on a branch**, checked read-only against `F:\!FluxIQ`: "is on the
  branch "dev", so it is somebody's working checkout ... It is never moved from
  here."
- **`start --worktree`** refused a dirty shared Core before creating anything.

**The move itself.** `sync-core` took the stale proof Core from `37679ce` to
`cf176fe`.

- It skipped the install, correctly: the lockfile is identical at both commits,
  and pnpm's record shows the install is already done.
- It built all four Core packages, including the web panel, in 2m13s.
- Running it again took 0.685s and did nothing.

**The Lab's refusal.** Pointed at the stale Core, the Lab refused instantly,
before any build, exiting 1: "is detached 11 commit(s) behind dev (at 37679ce).
... Bring it up with: pnpm task sync-core. Set FLUXIQ_LAB_ALLOW_BEHIND_CORE=1
to run against it anyway." There were no false alarms on any real Core on this
machine.

**Two runs racing one shared Core.** I ran two processes from two worktrees
against one Core. They used the real cache root, lock and publication; only the
Next build was a stand-in. With the cache beside the Core, one built and the
other reused its build. With one cache per worktree, both built.

**Path limit.** The deepest file Next writes is 178 characters below the cache
root, measured on a real build. So the root may be at most 80 characters.

```
REFUSE  root= 82/80  deepest=261  the path that actually failed (old layout, t015)
FITS    root= 78/80  deepest=257  the worktree beside it that worked (old layout, t010)   <- 2 characters to spare
FITS    root= 37/80                new default, <core>\.tmp\core-web-build for F:\fxwork\!FluxIQ
```

The real `prepareCoreWebBuild` refuses the t015 path before touching anything:
"The Core web build cache path is too long for this filesystem: ... is 82
characters and the deepest file Next writes below it needs 261, over the
259-character limit."

## What changed and why

### Round 2 (uncommitted, on top of `6e83e7e`)

- `packages/test-runner/src/core-web-build/cache-root.ts`: the default is now
  `<core>/.tmp/core-web-build`, with the measurements recorded in the file.
- `node-modules-root.ts` (new): `insideNodeModules`. `prepare.ts` refuses such
  a root first, and the barrel exports it.
- `scripts/lab/live-campaign/lab-run/attempt-failure.mjs` (new):
  `describeAttemptFailure`. `ram-fault.mjs` exports `STARTUP_FAILURE`.
- `runner.mjs`: detects a failure that repeats identically.
- `row/summarize-task.mjs`: adds `repeatedFailure` to the row.
- `summary/markdown.mjs`: shows it in the Attempts cell.
- `docs/architecture/testing-facility.md`: new location, why it was chosen, and
  the `node_modules` refusal.
- Tests:
  - `cache-root.test.ts`, rewritten;
  - `node-modules-root.test.ts`, new;
  - `prepare.test.ts`, a new case for the refusal before Core is read, staged
    or built;
  - `attempt-failure.test.mjs`, new, 4 cases;
  - `runner.test.mjs`, 2 new cases: a repeat is deterministic, and a
    non-repeat is retried as possibly the hardware.

### Round 1 (committed in `014f2de`)

**Defect 1: stale shared Core.** I kept the inherited work and added four
things:

- **1a.** `installed-lockfile.mjs` reads pnpm's own
  `node_modules/.pnpm/lock.yaml`, with the marker as fallback.
- **1b.** The shared Core is rebuilt only when:
  - the move checks out a different commit;
  - build output is missing; or
  - a marker names another commit.

  The busy refusal now names what would change.
- **1c.** `scripts/lab/core/commit/` makes the Lab refuse a detached Core that
  is behind `dev`. It is a Lab check rather than a `pnpm task` refusal because
  a Core goes stale after the worktree opens, when `pnpm task` does not run.
  The Lab pair waives it with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`.
- **1d.** `gitAnsweredNo` separates "git said no" from "git could not run".

**Defect 2: Core build contention.**

- `FULL_CORE_PACKAGES` means `sync-core` builds Core's full root `build`,
  including the web panel.
- **The fix that stops the duplicate builds** is the cache beside the Core,
  which lets the existing create-only lock work across worktrees.
- A run that finds the build current reuses it. One that finds it stale waits
  for the single builder rather than refusing.
- A correction to the premise: the Lab builds a staged copy into its own cache,
  so building `@fluxiq/web` inside the shared Core does not by itself stop Lab
  rebuilds.
- The cache's first location, `node_modules`, was wrong; round 2 replaced it.

**Defect 3: path limit.** `path-budget.ts` sets an 80-character limit for the
cache root on win32 and checks it before anything is staged. I did not cap the
slug, refuse at `pnpm task start`, or move the runs directory. The slug is no
longer in the path, so none of those is needed.

**Documentation.** `docs/architecture/testing-facility.md`, and in
`docs/architecture/repository-layout.md` the section "Keeping the Shared Core
Current".

## Commands run and observed results (round 2, after the live proof)

- `pnpm task:test`: 113 tests, 113 passed, 0 failed.
- `pnpm lab:test`: 69 tests, 68 passed, 0 failed, 1 skipped (a skip that was
  already there).
- `node --test scripts/lab/live-campaign/tests/runner.test.mjs`: 5 of 5.
- `node --test "dist/core-web-build/tests/*.test.js"` in `packages/test-runner`:
  27 of 27.
- Full test-runner suite, `node --test --test-concurrency=2 "dist/**/*.test.js"`:
  **1191 tests, 1191 passed, 0 failed**. Two failures on the way there:
  - `dist/run-expectations/tests/extraction-measurements.test.js` failed, but
    no source exists for it. The t015 merge moved that test to
    `extraction/tests/measurements.test.ts`, which passes 7 of 7, and `tsc`
    never deletes old outputs. I deleted that one stale untracked `dist` file;
    anyone with a `dist` built before t015 has the same leftover.
  - `bench/campaign/machine-slots` "FIFO tickets" failed once under load and
    passed 16 of 16 alone. That is one observation, so I attribute it to load.
- `pnpm check` with `npm_config_workspace_concurrency=1`: **exit 0**, and
  "structure-audit: passed (78 warning(s), 122 baselined)".
- **A correction to round 1.** I blamed that round's load-time test failures
  on the RAM fault. That rested on one observation, and I have no evidence
  either way. The cache location, by contrast, was not the RAM fault, and
  neither was the campaign's crash label.

## Not verified

- **An earned verdict for `social-scheduler-week-ahead`.** Question 3 blocks
  it, and that is outside my files. The default location reaching an earned
  verdict is proven with `data-table-inventory` instead.
- **Which request timed out in question 3.** The Flow-run request is an
  inference from the code path and the timing, not a proof.
- **Turbopack's internal reason for aborting under `node_modules`.** The worker
  prints nothing. The cause is proven by experiment, not explained.
- **The deterministic-repeat rule against a real campaign.** It is tested with
  a stubbed Lab, using the exact outputs the real failing campaign printed. It
  has not seen a second real repeated failure, because the location fix
  removed the one that existed.
- **A real `pnpm task start --worktree` from start to finish.** It was checked
  by `--dry-run`, by its refusal ordering, and by its unit tests.
- **`DEEPEST_RELATIVE_PATH = 178`** is one measurement. It must be measured
  again if Core's route tree gets deeper.

## Open questions or contradictions found

- **Question 3 needs its own unit of work.** The runner's live one-call Flow
  run is bounded at 30s and cannot recover from a timeout, because its run id
  is unknown until the call returns.
- **Stale `dist` outputs break the test-runner suite.** Any checkout built
  before the t015 test move still has
  `dist/run-expectations/tests/extraction-measurements.test.js`, which fails.
  `pnpm --filter @fluxiq-web-extension/test-runner test` does not clean `dist`.
- **Starting a task from inside a worktree picks the wrong base.** Without
  `--base`, `pnpm task start --worktree` resolves the base to
  `F:\fxwork\fxwork`. This was already the case and is outside my scope.
- **Old caches.** Old `test-runs/.core-web-build` directories, and your
  `F:\cwb`, are no longer read and can be deleted.
- **A dangling commit.** `e1a1310` is left in the proof Core's object store
  from the round-1 refusal demo. No ref points to it.

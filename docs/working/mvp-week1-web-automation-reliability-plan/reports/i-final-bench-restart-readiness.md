# i-final-bench-restart-readiness — read-only audit

**Disposition (2026-09-13): blocked, but the restart layout is available.**
Stage 4i has completed and rejected downstream candidate `db3cc17`: all six runs
failed at scripted-navigation arming, before recording or Flow creation
(`l-final-recheck-w10-intent.md:16-31,47-58`). Cleanup did succeed
(`l-final-recheck-w10-intent.md:60-67`). The accepted downstream pin therefore
does not exist yet and has not been pushed. Only after remediation, a fresh
passing Stage 4i acceptance, and the downstream `dev` push can the two complete
benches start together using the sequence below.

This report contains only paths, revisions, process counts, and operating rules.
No run bundle, page value, log, screenshot, or secret was read into it.

## Governing evidence

- Current State requires the acknowledged-intent W10 live proof, then the push of
  the accepted pin, then both repeat-three benches concurrently
  (`mvp-week1-web-automation-reliability-plan.md:31-32,115,118-119`).
- Stage 4 requires exact pins named after the gates and push, proofs before the
  paired benches, clean worktrees, a read-only once-built Core, the Stage 3
  memory guard, and immediate stop on a leak
  (`briefs/finish-week1.md:4953-4973`). The bench command and owned paths are at
  `briefs/finish-week1.md:4998-5013`.
- Stage 4i's candidate is downstream `db3cc17` with Core `19468b7`; acceptance
  requires all six W10 recordings to retain two actions/candidates and zero
  harness activations, leaks, persistence failures, and discards
  (`briefs/finish-week1.md:5316-5335`). It is a gate, not a substitute for either
  full bench.
- The old A and B campaigns are explicitly stopped and not criterion-5 evidence
  (`l-final-bench-a.md:3-10`; `l-final-bench-b.md:46-48,141`). Their partial roots
  were intentionally preserved (`l-final-bench-a.md:109-115`;
  `l-final-bench-b.md:148-155`) and must not be reused or removed.
- The prior live proofs passed at older downstream pin `4cde72d` and Core
  `19468b7` (`l-final-proofs.md:7-11,128-141`). Their evidence remains historical.
  Current State now explicitly schedules Stage 4i, push, then the two benches,
  so no repeat of that proof campaign is part of this restart unless the
  supervisor revises the brief.
- Under three simultaneous Lab instances Stage 3 reached 4.70 GiB free; its
  prescribed gate is to wait in 120-second steps below 3 GiB and to repeat a
  timing-only failure once above 6 GiB (`l-stage3b.md:43-44,139-152`). The final
  campaign should therefore run exactly two benches and admit no third Lab.
- W10's stopped-Stage-3 failures were concurrent-load finalize waits, not memory
  pressure; overlap was causal evidence (`i-stage3-load-failures.md:53-89,109-120`).
  That history is why both benches must be complete at the same accepted pin and
  why a timing miss is initially only one observation.

## Read-only machine state

At audit time:

| Item | State |
| --- | --- |
| Main downstream checkout | `dev` at `17c9004`; `origin/dev` is still `15974e7`; untracked working reports were present |
| Bench A worktree | `F:\fxlab\fxlab-7263534-load`, detached, clean, `15974e7` |
| Bench B worktree | `F:\fxlab\fxlab-16ff729-b`, detached, clean, `db3cc17` |
| Shared Core | `F:\fxlab\!FluxIQ`, detached, clean, `19468b7`; `origin/dev` matches |
| Proposed A root | `F:\fxlab-runs\final2\a` absent |
| Proposed B root | `F:\fxlab-runs\final2\b` absent |
| Old roots | `F:\fxlab-runs\final\a` and `...\b` present and preserved |
| Stage 4i root | `F:\fxlab-runs\final\recheck-w10-intent` present |
| Free physical memory | 9.30 GiB, a point-in-time reading only |
| Lab ownership | Stage 4i cleanup complete; current follow-up found zero processes matching its run root or `run-lab.mjs` |

The proposed `final2` roots are free now. Absence must be checked again
immediately before launch; creating or populating either root reserves it and a
non-empty root must cause refusal, not reuse.

## Exact safe restart sequence

Use `<DOWNSTREAM_PIN>` for the full hash that the supervisor accepted and pushed,
and `<CORE_PIN>` for the full compatible Core hash. Expected values are a pushed
descendant containing `db3cc17` and `19468b72c4472fd5cc58940737702d5e4d72c985`,
respectively; do not infer the downstream pin from a short candidate hash.

1. **Close the gates.** Diagnose and remediate the six-of-six arming refusal at
   `db3cc17`; that candidate is rejected. On a new committed candidate, rerun
   Stage 4i in a fresh root and require its final report to say 3/3 primary and
   3/3 `broken-link` accepted with every zero-condition satisfied. Require no
   unresolved P1/P2 review finding. Push downstream `dev`, fetch in both Lab
   worktrees, and prove `git rev-parse origin/dev` equals `<DOWNSTREAM_PIN>`.
   Do not repeat the older proof campaign unless the supervisor revises Current
   State; if it does, that proof runs alone and must clear before the pair.
2. **Wait for ownership to clear.** Do not touch B during the replacement Stage
   4i run. Require zero processes whose command line references its instance,
   worktree, or run root, and zero owned listeners. Also require zero other
   `run-lab.mjs` instances before launching the pair.
3. **Reserve fresh roots.** Recheck that both `F:\fxlab-runs\final2\a` and
   `F:\fxlab-runs\final2\b` are absent. The two wrappers may then create only
   their own root and an exclusive `CreateNew` lock. Never clean or recycle the
   old `final` roots. Use isolated labels `l-final2-bench-a` and
   `l-final2-bench-b` for both `FLUXIQ_LAB_INSTANCE` and
   `EXTENSION_TEST_BUILD_LABEL`.
4. **Pin before building.** In each downstream worktree run, substituting the
   full accepted hash:

   ```powershell
   git -C F:\fxlab\fxlab-7263534-load checkout --detach <DOWNSTREAM_PIN>
   git -C F:\fxlab\fxlab-16ff729-b checkout --detach <DOWNSTREAM_PIN>
   git -C F:\fxlab\fxlab-7263534-load status --porcelain=v1
   git -C F:\fxlab\fxlab-16ff729-b status --porcelain=v1
   git -C F:\fxlab\!FluxIQ rev-parse HEAD
   git -C F:\fxlab\!FluxIQ status --porcelain=v1
   ```

   Each status must have zero lines; each downstream `HEAD` must equal both
   `<DOWNSTREAM_PIN>` and fetched `origin/dev`; Core `HEAD` must equal
   `<CORE_PIN>`. Prove package resolution from `domain`, `apps/extension`,
   `packages/test-runner`, and `packages/test-contracts` lands in
   `F:\fxlab\!FluxIQ\packages\...\dist`, with `unpinned=0`, as the prior pin
   proof did (`l-stage2d.md:115-119`). Stop on any mismatch.
5. **Build once, serially.** If `node_modules` is missing, install from the
   locked workspace before builds; otherwise do not reinstall. Build shared
   Core exactly once, before either bench, then treat it as read-only:

   ```powershell
   pnpm -C F:\fxlab\!FluxIQ --filter @fluxiq/contracts build
   pnpm -C F:\fxlab\!FluxIQ --filter fluxiq build
   pnpm -C F:\fxlab\!FluxIQ --filter @fluxiq/client-gateway-websocket build
   ```

   In each downstream worktree, serially run:

   ```powershell
   pnpm -C <WORKTREE> --filter @fluxiq-web-extension/domain build
   pnpm -C <WORKTREE> --filter @fluxiq-web-extension/test-contracts build
   pnpm -C <WORKTREE> --filter @fluxiq-web-extension/scenario-lab build
   ```

   Record every exit code, recheck exact clean pins, then repeat the package
   resolution proof. These are the setup packages established at
   `l-stage2d.md:80-109`; do not build Core concurrently or once per bench.
6. **Prepare process-only wrappers.** Each wrapper must refuse a duplicate label
   with an exclusive lock, write command output directly to its owned log (never
   through a pipe), sample free memory every 15 seconds, and set only in the
   child environment:

   - `FLUXIQ_TEST_ENV_FILES=none`;
   - `FLUXIQ_LAB_INSTANCE` and `EXTENSION_TEST_BUILD_LABEL` to that lane's label;
   - `FLUXIQ_TEST_RUNS_DIR` to that lane's fresh `final2` root;
   - `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` loaded in memory from the pinned,
     built auth-gate scenario constant.

   The secret must never be printed, interpolated into a command line, written to
   wrapper/status/log files, or inherited by the supervisor. Remove it from the
   wrapper environment in `finally`. This reproduces the audited mechanism at
   `l-stage2c.md:115-139` and `l-final-bench-b.md:17-22`.
7. **Apply the memory gate, then launch together.** Immediately before each
   command, read `FreePhysicalMemory`. While below 3 GiB, wait 120 seconds and
   retry. Once both wrappers are eligible, start A and B together—no third Lab—
   with these exact commands/options:

   ```powershell
   pnpm -C F:\fxlab\fxlab-7263534-load lab bench --corpus week1 --repeat 3 --target isolated
   pnpm -C F:\fxlab\fxlab-16ff729-b lab bench --corpus week1 --repeat 3 --target isolated
   ```

   The wrappers supply the environment above, so the command line contains no
   secret. Extension-bearing executions must remain headed. Record launch time,
   PID, other-Lab count, pre-launch memory, exit code, and the sampled minimum.
8. **Observe without contaminating evidence.** After every finalized bundle,
   inspect bounded ids/categories/counts only. Stop that bench immediately if
   any leak finding is above zero. Any timing-only failure under concurrent load
   is a single observation; rerun the affected unit once only when free memory is
   above 6 GiB before classifying it as real. A product/category mismatch,
   persistence discard, missing bundle, or incomplete campaign is reported
   honestly and is not repaired by deleting or overwriting evidence. The 3 GiB
   rule gates command starts; it does not authorize an unscoped mid-run kill.
9. **Finish and compare.** Both complete benches must exit, produce their full
   repeat-three plan, and retain exact pin provenance. Only then compare A with B
   using the bounded `bench-compare.mjs` method required by
   `briefs/finish-week1.md:5013`. No repository copy of that historical scratch
   helper is currently present, so the supervisor must provide/recreate the
   audited bounded comparer before accepting criterion 5; this need not delay
   launch if its input contract is fixed first.

## Expected evidence and reports

- A root: `F:\fxlab-runs\final2\a`; B root:
  `F:\fxlab-runs\final2\b`. Each should contain its bench aggregation beneath
  `bench\`, completed `run-<id>` bundles, and private wrapper/memory logs. A
  completed run bundle is expected to expose the bounded evaluator files used by
  prior reports: `run.json`, `evaluation.json`, `summary.json`,
  `bundle.complete.json`, `events.ndjson`, and applicable snapshots including
  `flow-lane.json` and `redaction-attestation.json`. Raw contents stay in the run
  root and are never copied into reports.
- The Week 1 plan is 67 results repeated three times (201 planned results per
  bench), with W04/W08 Flow rows counted as planned absences under the Stage 4
  ruling (`briefs/finish-week1.md:4968-4972`; `l-stage3a.md:8-10`). The final
  reports must distinguish planned absences from executable results.
- Workers update the owned report paths
  `docs/working/mvp-week1-web-automation-reliability-plan/reports/l-final-bench-a.md`
  and `.../l-final-bench-b.md`, clearly retaining the prior stopped campaign as
  historical and marking only the `final2` campaign as the new criterion-5
  attempt. Each report includes the Stage 3 list plus packet counts/sizes/
  truncation by lane, per-row `harnessActivations`, persistence discard kinds,
  pins, commands, memory minimum, leak counts, and cleanup state
  (`briefs/finish-week1.md:5008-5013`).
- The supervisor records the A/B comparison from complete aggregations only.
  Partial old roots, Stage 4i bundles, staging directories, and timing-only reruns
  are not silently folded into denominator counts.

## Stop and cleanup contract

For a leak above zero, a supervisor stop, or a terminal failure, first stop new
launches and let the in-flight run reach a safe bundle boundary when that does
not risk further disclosure. Enumerate the wrapper PID's descendants and verify
their command lines belong to that lane before terminating that exact tree.
Never kill by broad image name and never touch the other lane. Stop the memory
sampler and leak watcher through their own stop mechanisms, release the lock,
and remove the secret environment variable in `finally`.

After each lane exits, require zero processes referencing its instance,
worktree, or run root and zero owned loopback listeners. Recheck downstream and
Core exact pins and cleanliness. Preserve the entire `final2` root, including
any staging bundle, for diagnosis; do not delete or move it. The stopped Stage 3
procedure demonstrated why killing a console host before the safe boundary can
manufacture an inconclusive provenance failure
(`i-stage3-load-failures.md:192-213`), while the prior final workers demonstrate
the required lane-specific zero-process/listener check
(`l-final-bench-a.md:109-115`; `l-final-bench-b.md:148-155`).

## Blocking checklist

Launch is blocked until all are true:

1. The arming refusal is fixed and a fresh Stage 4i is complete and accepted,
   with its process tree/listeners gone. The completed `db3cc17` attempt is a
   rejection, not acceptance evidence.
2. The accepted downstream `dev` is pushed; both Lab worktrees can detach at the
   same full hash and prove it equals `origin/dev`.
3. Both `final2` roots are still absent, both worktrees and Core are clean, the
   import-resolution proof is fully pinned, every build exits zero, and no third
   Lab is running.
4. Two exclusive, secret-safe, memory/leak-watched wrappers and the bounded A/B
   comparison method are ready.

At audit time, blockers 1-2 and 4 were not closed. The current process cleanup,
paths, and available
memory do not themselves block the restart.

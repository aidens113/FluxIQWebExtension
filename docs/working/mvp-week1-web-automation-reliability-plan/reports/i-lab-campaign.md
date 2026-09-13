# i-lab-campaign — the schedule for every Lab run still owed

Worker `i-lab-campaign`, read-only investigation, 2026-09-12, facility `HEAD 99eca80`.
Core was at `368b3c9` when I started and at `5d495eb` (clean, one commit ahead of
`origin/dev`) when I finished. I edited nothing in either repository except this
report. I ran no `pnpm lab` and no `pnpm build`. The one scratch worktree I made
is covered under "Commands run".

## Outcome

**Done.** The scratch worktree is removed, and Core was verified untouched
("Commands run", step 9).

The seven answers:

1. **Criterion 1 cannot be proven by the bench as it is built today.** The bench
   runs every row that has no variant on the recording lane
   (`packages/test-runner/src/bench/expand-corpus.ts:15`). By `v-bench-honesty`
   Defect 3, that lane never executes the workflow. The plan's own Phase 1.2 Lab
   proof is "corpus W01–W19 pass with `--flow`". So criterion 1 needs 54 separate
   Flow-lane runs (18 rows × 3), or a bench change (fix design item 1).
2. **Criterion 2 has no Lab-side assertion to observe at HEAD.** The plan's Lab
   proof is "`lab run sensitive-input --target isolated` with a new
   `security.redaction` assertion over persisted recording events". A grep finds
   no such assertion; the category name exists only as a label. No lane records
   packet sizes, so "packet budget" cannot come from a Lab run either. The 16
   items and the byte budget are content-harness proofs in the plan.
3. **Criterion 4 cannot reach 90% while W19 stays unable to report
   `auth_required`.** The plan names five negative results (W14, W19, W27 ×3).
   At 3 repeats that is 15 runs, so at most 1 may miss. W19 alone would miss 3
   (`v-bench-honesty` open question 3), and no in-flight brief owns that fix.
4. **A Lab run can execute from a git worktree while the main tree is being
   edited, and I recommend it.** The Core links are relative, and a worktree
   directly under `F:\` resolves them unchanged. An offline install took 1.6 s,
   and every Core junction and `fluxiq` import resolved to `F:\!FluxIQ`. Run
   manifests from a worktree will record `dirty: false`, which no recent run has.
   **A worktree does not pin FluxIQ Core.** Every instance loads the live
   `F:\!FluxIQ`, so Core must be frozen during a Lab wave.
5. **The RAM bound is 3 concurrent Lab instances machine-wide**, and fewer when
   other heavy work runs:
   - at most 2 while workers run the content harness, root tests or Core vitest;
   - 1 for the two proof benches.

   The one observation of 3 overlapping Labs showed each run 1.5–1.7× slower
   (96–108 s against 62–68 s alone): about 1.8× the throughput of one instance.
   Memory per instance has never been measured; a sampling step is in the
   schedule.
6. **Total Lab wall time is about 8.5–11 hours**, and the two proof benches are
   4.5–7 hours of it. Any fix found in Stage 2 or 3 resets the stages after it.
7. **Week 1 does not require Firefox.** It appears once in the 30-day plan, in
   Week 4: "Firefox build where practical" (quoted below).

## What changed and why

Only this report. The scratch worktree `F:\fxlab-probe-ilab` was created to
answer question 4 empirically rather than by reading, then removed from git's
worktree list (details and final state under "Commands run", step 9).

---

## Part 1 — the Lab runs each exit criterion needs

**Conventions.** Every command runs from a campaign worktree (Part 2) with:

```bash
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=<label> FLUXIQ_TEST_RUNS_DIR='F:\!FluxIQWebExtension\test-runs\campaign\<label>'
```

Capture every exit status by redirect (`> x.log 2>&1; echo $? > x.status`).

**Measured durations** come from `startedAt`/`finishedAt` in 123 `run.json`
manifests and 11 smoke bench reports on disk:

| Kind of run | Measured |
| --- | --- |
| Recording lane, alone | median about 55 s; range 39–92 s |
| Flow lane, alone | median 62–66 s; range 44–100 s |
| Any run, with 3 Labs running | about 1.6× longer |

Recording-lane figures are the smoke bench evaluations. Flow-lane figures are 11
`lab-replay` runs, plus `L-dropped-action`'s 24 runs at 53–100 s. The load factor
is a single observation (Part 3).

**"Depends on"** names the in-flight brief whose change must be committed before
the run counts as proof. `→fix` means the fix brief that will follow that
investigation, which has not been written yet.

### Criterion 1 — Core browser actions are reliable

Plan proof: "corpus workflows W01–W19 pass 3/3 replays". Phase 1.2 T3 (plan line
307): "corpus W01–W19 pass with `--flow`".

| Row | Command (`pnpm lab run …`, plus `--target isolated`) | ×3 |
| --- | --- | --- |
| W01 | `basic-form --flow` | 3 |
| W02 | `keyboard-forms --flow` | 3 |
| W03 | `keyboard-forms --workflow combobox --flow` | 3 |
| W04 | `product-catalog --flow` | 3 |
| W05 | `product-catalog --workflow paginated-extraction --flow` | 3 |
| W06 | `product-catalog --workflow search --flow` | 3 |
| W07 | `product-catalog --workflow in-stock-only --flow` | 3 |
| W08 | `data-table --flow` | 3 |
| W09 | `data-table --workflow sort-by-price --flow` | 3 |
| W10 | `navigation --flow` | 3 |
| W11 | `infinite-feed --flow` | 3 |
| W12 | `modal-flows --flow` | 3 |
| W13 | `modal-flows --workflow consent-then-click --flow` | 3 |
| W14 | `modal-flows --workflow interstitial --flow` | 3 |
| W15 | `multi-tab --flow` | 3 |
| W16 | `file-transfer --flow` | 3 |
| W17 | `file-transfer --workflow upload --flow` | 3 |
| W18 | `auth-gate --flow` | 3 |

Workflow ids are from `bench/corpus/week1.ts:26-43`, confirmed against the built
registry. W19 in the corpus is only the negative `expired` variant
(`week1.ts:44`), so it belongs to criterion 4.

- **Expected observation.** Each of the 54 runs:
  - exits 0 (`cli.ts:58` returns 0 only on `"verdict":"passed"`);
  - shows in the JSON line / `pnpm lab inspect <runId>` that a Flow was created,
    Core's run passed, and harness activations were 0;
  - records in `run.json` `repositories.facility.dirty: false` and
    `repositories.core.dirty: false`, with the same commits across all 54.

  Quote as "54 of 54". Field names are those `v-bench-honesty` gives for
  `RunScenarioResult.observation`; I did not re-read that type.
- **Duration.** 54 × 62–66 s ≈ 56–60 min alone; about 35 min split over 3
  instances.
- **Depends on:**
  - `f-w18-secret-leg`: W18 itself, and every Flow-lane run, because it edits
    `flow-lane/run-flow-lane.ts`;
  - `f-connection-split`: the background connection every run uses;
  - `i-flow-lane-errors` →fix: the dropped action and the opaque runner error;
  - `i-resolver-safety` →fix, in Core: element resolution during replay.
- **Supporting runs:**
  - Live plan step 4, the extension e2e fixture:
    `pnpm --filter @fluxiq-web-extension/extension test:e2e`, about 3 min.
    It is the only proof of MV3 service-worker restart. Depends on
    `f-connection-split`. See the tracked-output caveat in Part 2, item 7.
  - `pnpm lab run reconnect --target isolated` ×3, about 3–5 min: the WebSocket
    reconnection that `f-connection-split` must leave to the Lab.
  - Step 4b: `pnpm lab run basic-form --flow --target isolated` ×24, about
    26 min alone.
    - Pass condition: whatever `i-flow-lane-errors` (a) settles. The minimum is
      24 of 24 passed.
    - What that rules out: 24 clean runs exclude a true failure rate of 12% or
      more at 95% confidence (0.88^24 = 0.046). The old 50% rate would survive
      24 clean runs with probability 0.5^24 ≈ 6×10⁻⁸.
    - Depends on `i-flow-lane-errors` (a).
    - Must be repeated if `f-connection-split`, `f-w18-secret-leg` or the
      Flow-lane fix lands afterwards, because all three touch the
      recording-to-Flow path.

### Criterion 2 — Browser evidence is useful

- **Plan proof:** "Evidence fixture assertions (16 items) green; sanitized packet
  ≤ budget with `truncated` visible; `sensitive-input` leak assertion green".
- **Phase 1.4 (plan lines 447-452):** the content harness (T2) carries "a 16-row
  table test", and a "byte-budget spec asserts `truncated`". The Lab (T3) is
  "`lab run sensitive-input --target isolated` with a new `security.redaction`
  assertion over persisted recording events".
- **Phase 1.4 exit check (plan lines 457-459):** "a Lab scenario proves
  `web.dom.assert` conditions evaluated through the seam fail W24's `unannounced`
  variant".

| Run | Command | Expected observation | Duration |
| --- | --- | --- | --- |
| Redaction | `pnpm lab run sensitive-input --target isolated` ×3 | Verdict passed, and a `security.redaction` assertion reporting zero findings for the fixture's synthetic literal (`sensitive-input/scenario.ts:13`). **That assertion does not exist at HEAD** (below). | about 3 min |
| W24 through the seam | `pnpm lab run intermediate-state --flow --variant unannounced --target isolated` ×3 | Reported failure category `output_not_observed`, the registry's expected category | about 3–5 min |

**What exists at HEAD, by grep:**
- `security.redaction` appears only as a category label
  (`packages/test-contracts/src/evaluation.ts:16`) and as a bundle-integrity
  failure (`packages/test-runner/src/inspect.ts:26`).
- The workspace secret scan `attestWorkspaceSecretAbsence`
  (`secret-leak-attestation.ts:40`) is called only from `demo-llm-*` modules.
- `run-scenario.ts:194,350` merely suppress screenshots for `sensitive-input`.
- The fixture's own oracle checks page text, "Submitted with secrets discarded"
  (`scenario.ts:21`), which is not a leak check.
- `run-manifest/create-run-manifest.ts:80` writes `redactionState: "verified"`,
  which reads as a constant.
- **Packet budget has no Lab producer.** `bench/evaluate-run.ts:38` says "no lane
  populates sanitized packet or raw snapshot sizes", and
  `run-evaluation/observed-run-evaluation.ts:69` hard-codes empty lists.

**Depends on:**
- `f-adapter-guard`: failure-record withholding for sensitive controls;
- `f-evidence-producers`: the `dom-snapshot.ts` producer;
- **an unowned change**, the Lab redaction assertion (fix design item 2), and,
  if the Lab must show packet budget, an evidence-size producer (item 3).

Until those exist, a Lab run can prove only that `sensitive-input` passes its
page oracle.

### Criterion 3 — Target matching has deterministic fallback

- **Plan proof:** "Drift workflows W20–W23 recover without harness; W26 resolves
  ambiguity by context".
- **Phase 1.3 T3 (plan line 375):** "W20–W23 replay after arming drift passes
  without harness; W26, W28 pass".
- **Exit check (plan lines 377-379):** fuzzy recovery on drift variants ≥ 80%
  ("target; recorded as measured"), and `TARGET_AMBIGUOUS` on W26's ambiguous
  variant.
- Current State adds the realistic fixtures.

Every command below is `pnpm lab run <…> --target isolated`, three times each.
Variant ids and expected categories are from the built registry.

| Result | Command | Expected observation |
| --- | --- | --- |
| W20 | `identity-drift --flow --variant selector-only` | passed, harness activations 0, and the oracle passed; FluxIQ reporting success is not enough, see note |
| W21 | `identity-drift --flow --variant text-only` | same |
| W22 | `identity-drift --flow --variant moved` | same |
| W23 | `identity-drift --flow --variant wrapped-aria` | same |
| Live refusal case | `identity-drift --flow --variant reworded-aria` | passed; `L-replay` saw a refusal at confidence 0.173 |
| W26 ambiguous | `ambiguous-targets --flow --variant no-context` | category `target_ambiguous` |
| W26 by context | `ambiguous-targets --flow --variant form-context` | passed. **Not in the week1 corpus** (`week1.ts:51` lists only `no-context`), so the bench never runs it |
| W28 | `iframe-checkout --flow` | passed |
| Realistic | `admin-console --flow` (primary workflow) | passed |
| Realistic | `admin-console --flow --variant read-only` | `target_not_found` |
| Realistic | `admin-console --workflow extract-customer-list --flow --variant short-book` | passed |
| Realistic | `admin-console --workflow browse-to-customer --flow` | passed |
| Realistic | `admin-console --workflow switch-settings-tab --flow --variant light-dom-toggle` | passed |
| Realistic | `member-directory --flow --variant restyled` | passed |
| Realistic | `member-directory --flow --variant member-left` | `target_not_found` |
| Realistic | `member-directory --workflow filter-members --flow --variant sorted-by-activity` | passed |
| Realistic | `member-directory --workflow remove-invitations --flow --variant support-drawer` | `blocked_by_capability_or_policy` |
| Realistic | `storefront-checkout --flow --variant declined-card` | `unexpected_state`. The manifest declares `secrets` |

**Note on "passed".** `L-review` finding 1 is a resolver that picked a different
action and reported success. So "passed" here must mean the fixture oracle
passed as well as FluxIQ's reported verdict. A run where FluxIQ reports success
and the oracle fails is a false success and fails the criterion whatever the
count. For each variant, also quote `targetResolution` (level, confidence
against the 0.35 floor, candidate count) from the run's trace. `L-replay` saw
`unresolved_no_candidates`, `candidateCount 0` on every dispatch, so a nonzero
count is itself part of the proof.

- **Duration.** 18 results × 3 = 54 runs ≈ 56–60 min alone; about 35 min over 3
  instances.
- **Depends on:**
  - `i-resolver-safety` →fix: Core scoring (D13), and the floor receiving no
    candidates, which may be a wiring fix;
  - `i-flow-lane-errors` →fix;
  - `f-w18-secret-leg`: `storefront-checkout` and `auth-gate` declare `secrets`;
    all Flow-lane runs go through `run-flow-lane.ts`;
  - `f-connection-split`.
- W20–W23 and W26 `no-context` are also in the proof benches (criterion 5), so
  the benches' `fuzzyRecovery` figure can replace their standalone runs once the
  benches exist. The rows not in any corpus (`form-context`, `reworded-aria`, the
  ten realistic results) need these standalone runs regardless.

### Criterion 4 — Failures are meaningfully classified

- **Plan proof:** "Negative workflows (W14, W19, W27 variants) report the
  manifest's expected category ≥ 90%".
- **Phase 1.5 T3 (plan lines 528-530):** "negative workflows W14, W19, W27 and
  every armed variant report the manifest's `expected.failure.category`; the
  bench's classification-accuracy metric".

| Result | Command (`pnpm lab run …`, plus `--target isolated`) | Expected category |
| --- | --- | --- |
| W14 | `modal-flows --workflow interstitial --flow --variant armed` | `user_intervention_required` |
| W19 | `auth-gate --flow --variant expired` | `auth_required` |
| W27 | `failure-surfaces --flow --variant disabled` | `blocked_by_capability_or_policy` |
| W27 | `failure-surfaces --flow --variant detached` | `target_not_found` |
| W27 | `failure-surfaces --flow --variant blocked-url` | `navigation_unexpected` |
| Bench also | W10 `navigation --flow --variant broken-link` | `navigation_unexpected` |
| Bench also | W15 `multi-tab --flow --variant popup-blocked` | `output_not_observed` |
| Bench also | W24, W25, W26 (above) | `output_not_observed`, `timeout`, `target_ambiguous` |
| Realistic | the four realistic negatives in criterion 3 | as listed there |

**Threshold arithmetic.**
- *Named population:* 5 results × 3 = 15 runs. 14/15 is 93.3% and passes; 13/15
  is 86.7% and fails. **At most one miss.**
- *Bench population:* 10 variants × 3 = 30 runs. At most 3 misses.
- *W19 on its own:* by `v-bench-honesty` open question 3, quoting `w2-flow-lane`
  Finding 3, "the mapper makes a navigation executable only for
  `metadata.transition === "typed"`, so the generated Flow never requests
  `/account`". W19 alone would then miss 3 of 15 (80%). I did not re-verify that
  finding at HEAD.
- **Criterion 4 cannot close without a W19 fix nobody owns, or a recorded
  ruling.**

**Exit status is not the observation for negative variants.** I did not
establish whether `lab run` exits 0 or 1 when an expected failure is reported
correctly. Quote the reported category against the expected one.

- **Duration.** Named 15 runs ≈ 16 min alone. The four realistic negatives are
  already counted in criterion 3. The five bench-only variants add 15 runs if run
  standalone.
- **Depends on:**
  - `i-flow-lane-errors` →fix: a failing Flow-lane run currently surfaces as an
    unexplained runner error, so its category is the runner's, not the page's;
  - `f-adapter-guard`: the failure record's `expected`/`actual` for sensitive
    controls; W19 is a password page;
  - `f-w18-secret-leg`: W19 must log in before the session expires;
  - an unowned W19 navigation-mapping fix (fix design item 4).

### Criterion 5 — FluxBench exists and produces repeatable measurements

Plan proof: "`pnpm lab bench --corpus week1 --repeat 3` emits a report with every
metric in Metrics; two consecutive runs agree within tolerance". The tolerance
(plan lines 579-580) is rates within ±1 workflow, and latency p95 within 25%.

| # | Command | Expected observation | Duration |
| --- | --- | --- | --- |
| 5.0 | `pnpm lab bench --corpus smoke --repeat 2 --target isolated` (live plan step 6), then compare with the absolute path of the main tree's `test-runs/bench/bench-mtxoim0b-8ca4952c` | exit 0, 4 of 4 passed; compare `"outcome":"equivalent"` | about 5 min |
| 5.1 | `pnpm lab bench --corpus week1 --repeat 1 --target isolated` (discovery; also the Phase 1.2 exit check, plan line 310) | Report written; expect exit 1 (`v-bench-honesty` consequence 1). Read the per-run table for which rows fail before spending the proof slot | 43 runs ≈ 43 min alone; about 70 min under 3-instance load |
| 5.2 | `FLUXIQ_LAB_INSTANCE=bench-a … pnpm lab bench --corpus week1 --repeat 3 --target isolated` | `report.json` with every metric row; exit status recorded as a measurement | 129 runs (69 recording, 60 Flow) ≈ 2.2 h alone, range 2.0–3.4 h |
| 5.3 | Same with `bench-b`, **started after 5.2 finishes**, same commits | as 5.2 | 2.2 h alone, range 2.0–3.4 h |
| 5.4 | `node packages/test-runner/dist/cli.js compare <abs path to bench-a report dir> <abs path to bench-b report dir>`, then the same with `<A> --halves` and `<B> --halves` | exit 0 and `"outcome":"equivalent"` for A vs B | seconds |

Three conditions for the proof to be valid:
- **Both benches run alone.** No other Lab instance and no heavy gate may run.
  Latency p95 is a compared metric, and load inflated run time 1.5–1.7× in the
  one measurement.
- **Both benches record identical commits.** Their `run.json` manifests must
  carry the same `repositories.facility.commit` and `repositories.core.commit`,
  both `dirty: false`.
- **Neither launcher reports a Core rebuild.** Neither may print
  `"state":"changed-during-run"` (`scripts/lab/run-lab.mjs:87-100`).

Two caveats:
- **"Every metric" is only partly achievable at HEAD.** Evidence size is empty
  by construction (`bench/evaluate-run.ts:38`), and harness recovery and
  adaptation metrics are `null` by design (plan Metrics table).
- **Why 5.4 bypasses `pnpm lab`.** `pnpm lab compare` runs the whole Lab build
  phase first: `run-lab.mjs:54-70` builds for every subcommand, although :28
  already knows `compare` and `inspect` are read-only. In default mode that build
  deletes the shared `apps/extension/dist` a running default-mode Lab is loading.
  Calling the built CLI directly without `FLUXIQ_LAB_INSTANCE` avoids the build;
  with that variable set, the CLI fails closed (`L-lab-concurrency`).

**Depends on:** every in-flight fix and both follow-up fixes committed, and Core
frozen. Only `f-test-runner-ratchet` does not change runtime behaviour.

### Criterion 6 — Major reliability blockers identified

Plan proof: "The blocker list in the Phase 1.6b ledger entry, ranked by corpus
impact". There is no dedicated Lab run: the ranking is read from benches 5.2 and
5.3 and the standalone runs above.

Phase 1.6b step 3 (plan lines 550-551) adds a live check:

```bash
pnpm demo:record
pnpm demo:run
```

- **Expected:** both exit 0, provider-free.
- **Duration:** never measured; I estimate 10–20 min.
- **Depends on:** no in-flight brief. `f-test-runner-ratchet` moves
  `demo-llm-create-ui`, not `demo-workspace`.
- **Constraint:** both scripts use the old shared build chain (root
  `package.json:13,44`), so they are not concurrency-safe
  (`L-lab-concurrency` question 4). They also rewrite the tracked
  `apps/extension/build/`. Run them last, alone, in their own worktree at the
  proof commit.
- **Not established:** whether they need anything from `.env.local` in a
  worktree, which has none.

---

## Part 2 — can a Lab run execute from a worktree while the main tree is edited?

**Yes, with Core frozen.** Findings, each with its evidence:

1. **How Core is linked.**
   - Every Core dependency is a relative `link:`: `domain/package.json:23-24`
     (`link:../../!FluxIQ/…`); `apps/extension/package.json:16,18`,
     `packages/test-runner/package.json:20` and
     `packages/test-contracts/package.json:24` (`link:../../../!FluxIQ/…`).
   - pnpm installs them as Windows junctions; in the main tree,
     `domain\node_modules\fluxiq -> F:\!FluxIQ\packages\fluxiq\`.
   - The runner finds Core as `FLUXIQ_CORE_ROOT ?? <repo>/../!FluxIQ`
     (`packages/test-runner/src/cli.ts:21`), and the launcher's Core watcher
     does the same (`scripts/lab/core-build-watch.mjs:56-59`).
   - **Consequence: put a worktree directly under `F:\`** (for example
     `F:\fxlab-<sha7>`), so both relative forms reach `F:\!FluxIQ` with no
     configuration. Deeper placement breaks the install junctions;
     `FLUXIQ_CORE_ROOT` fixes only the runner.
2. **Measured.** A detached worktree at `F:\fxlab-probe-ilab`:
   - `pnpm install --frozen-lockfile --offline` exited 0 in 1.6 s ("Lockfile is
     up to date", "reused 12, downloaded 0"). The pnpm store is
     `F:\.pnpm-store\v3`, on the same drive.
   - All six Core junctions pointed at `F:\!FluxIQ\packages\…`.
   - `import('fluxiq/automation-studio')` from the worktree's `domain` resolved
     to `file:///F:/!FluxIQ/packages/fluxiq/dist/programs/automation-studio/index.js`
     with 383 exports.
   - The main tree's `git status --porcelain` was byte-identical before and
     after, and the worktree's was empty.
3. **What the Lab build needs.** A fresh worktree has none of the ignored
   outputs (`domain/dist`, `packages/test-contracts/dist`,
   `packages/test-runner/dist`, `apps/scenario-lab/dist`, `apps/extension/dist`
   all absent). The tracked `apps/extension/build/` and `domain/.test-build/`
   are present.
   - The launcher's build phase creates them in this order: scenario-lab build,
     then extension `test:e2e:build`, then `domain host:build` in instance mode,
     then the `test-runner...` build, which includes domain, test-contracts and
     test-evidence (`run-lab.mjs:55-66`).
   - Types resolve from source (`domain/package.json:6-8`; test-contracts
     `types: ./src/index.ts`). `test-runner` builds the domain only when
     `domain/dist/index.d.ts` is absent (`packages/test-runner/package.json:10`).
   - So the order should work from empty. **Not executed:** the brief forbids
     `pnpm lab` and `pnpm build`. Make the first command in any new worktree one
     `pnpm lab run basic-form --target isolated`.
4. **A worktree does not pin Core.**
   - Every worktree loads the live `F:\!FluxIQ`: its `packages/*/dist` through
     the install junctions, and its source through a junction the runner creates
     for Next's `transpilePackages` (`coordinator.ts:270-276`), with Next from
     Core's `apps/web/node_modules` (`coordinator.ts:279`).
   - A Core rebuild mid-run deletes modules in flight. Smoke bench
     `bench-mtz3zan8-d6ce4aae`, generated 2026-09-13T01:01 (the runner's UTC
     timestamp), shows four evaluations of 0.1–0.8 s, matching the incident
     described at `core-build-watch.mjs:8-12`.
   - The launcher waits for 30 s of Core quiet, up to 10 min, runs anyway if it
     never comes, and afterwards reports any change (`run-lab.mjs:33-46`).
   - Pinning Core would need a Core worktree named `!FluxIQ` inside a shared
     parent (`F:\fxlab\!FluxIQ` beside `F:\fxlab\<ext>`), plus Core's own install
     and full build (Core `package.json` `build`: contracts, fluxiq,
     client-gateway-websocket, web). I did not measure that.
   - **Recommendation: freeze Core instead.** No Core build during a Lab wave;
     tell any Core session. Quote `repositories.core.commit` and
     `dirty: false` from each run's manifest.
5. **Where artifacts land.**
   - The launcher spawns with `cwd` set to the root it derives from its own file
     location (`lab-instance.mjs:20`, `run-lab.mjs:127`); the CLI uses
     `FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd()` (`cli.ts:18`). Runs go to
     `test-runs/instances/<label>/`, or to `FLUXIQ_TEST_RUNS_DIR` when set
     (`packages/test-runner/src/lab-instance/resolve-lab-paths.ts:55-57`).
   - A worktree's benches would therefore be deleted with the worktree. **Set
     `FLUXIQ_TEST_RUNS_DIR`** to a path outside it, such as the ignored
     `F:\!FluxIQWebExtension\test-runs\campaign\<label>`. That keeps the proof
     benches beside the eight historical smoke baselines, which exist only in
     the main tree. `pnpm lab inspect` must use the same directory.
6. **The build lock is per worktree** (`.lab-locks/build.lock` under the
   worktree root, `lab-instance.mjs:54`).
   - Instances inside one worktree build one after another.
   - Instances in different worktrees do not wait for each other. They share no
     files, so nothing races, but three builds at once is a CPU and RAM spike.
     Start them a few minutes apart.
7. **Provenance comes for free, if nothing dirties the tree.**
   - `create-run-manifest.ts:121` sets `dirty` from a non-empty
     `git status --porcelain`, which ignores `.lab-instances/`, `dist/` and
     `test-runs/`. The newest main-tree manifest records facility `1b6f5df…`
     `dirty: true` and Core `a575df2…` `dirty: true`; a worktree run will record
     `false`.
   - Instanced Lab builds write only under `.lab-instances/`
     (`L-lab-concurrency`). A default-mode extension build does not: step 4's
     `test:e2e` and both `demo:*` scripts rewrite the tracked
     `apps/extension/build/`, which marks every later run `dirty: true` if the
     bytes differ.
   - `apps/extension/e2e/fixtures/extension-context.ts:10` hard-codes
     `dist/e2e-chromium`. Run step 4 and the demos in a separate worktree, and
     never in a tree where an unlabelled Lab is running.
8. **Deletion hazard: junctions into Core.**
   - A worktree's `node_modules` holds six junctions into
     `F:\!FluxIQ\packages`. The main tree's `test-runs` holds four more that
     persist (`persistent-isolated/interactive-smoke/.sessions/…/core-workspace/packages`
     and `web-extension-demo/.s/*/c/packages`, all `-> F:\!FluxIQ\packages\`).
   - A recursive delete that follows junctions would delete Core's packages.
   - `git worktree remove --force` unregistered the worktree but left its
     directory ("Directory not empty").
   - **Safe removal:** delete each junction pointing outside the worktree with
     a non-recursive `[System.IO.Directory]::Delete(path, $false)`; walk the
     directory without following reparse points and confirm none point outside;
     only then delete. Also run `git worktree prune`. The removal I performed is
     in step 9 below.

---

## Part 3 — concurrency schedule, bounded by this machine's RAM

**The machine.** 25.85 GB RAM visible. 16.88 GB was free when sampled, while
this dispatch's workers were active. CPU i5-12400F, 6 cores / 12 threads. The
RAM is known to be faulty, and load raises the rate of false failures.

**What a Lab instance costs.** Each run starts a headed Chromium with the
extension, a Next.js dev server compiling Core's source under Turbopack
(`coordinator.ts:103-110`, a fresh compile every run), the scenario lab server,
and the runner.
- **Memory per instance has never been measured.** A grep of every report for
  GB, MiB or working set finds none. My estimate is 2.5–4.5 GB at peak,
  unmeasured.
- **Throughput has one measurement.** On 2026-09-13 (runner UTC timestamps),
  between 00:23:30 and 00:25:18, three Labs overlapped:
  - `lab-a` took 106.8 s and `lab-b` took 107.8 s (both `basic-form`);
  - a default-instance `basic-form` Flow run started at 00:24:09 took 95.9 s;
  - the same scenario alone minutes earlier took 61.7–68.2 s.
  - So each run was 1.5–1.7× slower, and 3 instances gave about 1.8× the
    throughput of one. A single observation.

**Rules.**
- At most **3** Lab instances machine-wide.
- At most **2** while any worker runs the content harness, root `pnpm test` or
  `check`, or Core vitest.
- **1** (alone) for benches 5.2 and 5.3, and for anything whose latency is
  compared.
- Keep at least **4 GB free**. During the first multi-instance wave, sample
  memory in the background, and lower the instance count if free memory drops
  below 4 GB. The sum over-counts, because other `node` processes and the user's
  own `chrome` are included:

  ```powershell
  while ($true) { $os = Get-CimInstance Win32_OperatingSystem; $ws = (Get-Process chrome,node -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum; '{0:s},{1:N2},{2:N2}' -f (Get-Date), ($os.FreePhysicalMemory/1MB), ($ws/1GB) | Add-Content <scratch>\lab-mem.csv; Start-Sleep 15 }
  ```
- One label per instance. Never run an unlabelled Lab in a tree where a labelled
  one is running.
- No Core build while any instance is running.

**The schedule.** Each stage gets a fresh worktree `F:\fxlab-<sha7>` at the
commit that stage proves.

| Stage | Starts when | Instances | Runs | Wall time |
| --- | --- | --- | --- | --- |
| **0: prove the path** | Now, alongside the fix workers | at most 2 | A: `lab run basic-form --target isolated` ×1 (worktree smoke), with memory sampling. B, optional diagnostic, not proof: step 4b ×24 at HEAD, if `i-flow-lane-errors` (a) confirms the race fix is in HEAD | about 10 min for A (fresh build, unmeasured); about 40 min for B under load |
| **1: after the five `f-*` fixes are committed** | A commit containing `f-adapter-guard`, `f-evidence-producers`, `f-connection-split`, `f-test-runner-ratchet`, `f-w18-secret-leg` | 3, plus step 4 in its own worktree | A: step 4b ×24 (about 42 min). B: `sensitive-input` ×3, `reconnect` ×3, W18 ×3, W24 ×3, W25 ×3, then smoke gate 5.0 (about 32 min). C: week1 `--repeat 1` discovery 5.1 (about 70 min). Separate worktree: step 4 e2e (about 3 min) | about 1.5 h |
| **2: after the two follow-up fixes land** | A commit with the `i-flow-lane-errors` fix, plus a Core commit with the `i-resolver-safety` fix, Core built and quiet | 1 for the gate, then 3 | Gate: smoke 5.0 alone; stop if not `equivalent`. A: criterion 1 W01–W09 ×3 plus step 4b ×24 (51 runs). B: criterion 1 W10–W18 ×3 plus the criterion 4 named five ×3 (42 runs). C: criterion 3, all 18 results ×3 (54 runs) | 147 runs ≈ 160 min serial; about 1.6 h over 3 instances |
| **3: frozen proof** | Nothing further to commit for either repository; Core frozen | 1 | 5.2 bench-a alone, then 5.3 bench-b alone, then 5.4 compare. Then, in their own worktree at the same commit, `demo:record` and `demo:run` | 4.5–7 h for the benches, plus about 15 min for the demos (unmeasured) |

Total Lab wall time is about 8.5–11 h, dominated by Stage 3. If the discovery
bench in Stage 1 or any Stage 2 run exposes a defect, the fix resets every later
stage. That is the reason Stage 1 includes the cheap `--repeat 1` bench.

**Fallback if time forces it: not recommended.** Running 5.2 and 5.3 at once in
two instances saves about 1.5–2 h (3.5–5.5 h instead of 4.5–7). The ledger would
then have to say the runs were simultaneous, not "consecutive" as the plan says,
and under shared load. Agreement between two runs under identical, correlated
conditions is weaker evidence of repeatability.

---

## Part 4 — does Week 1 require Firefox?

**No.** From the 30-day plan's text:

- The Week 1 section (lines 19–361) never names a browser. Its objective
  (line 23) is "Create a reliable browser automation foundation that allows
  FluxIQ to execute real workflows, understand browser state, identify failures
  precisely, and provide high-quality evidence to the runtime harness." Its exit
  criteria (lines 352–359) are browser-agnostic.
- The only mention of Firefox in the whole document is in Week 4, Phase 4.9
  "Extension Packaging" (lines 1308–1312): "- Production Chrome build /
  - Chrome Web Store packaging / - Firefox build where practical". Even there it
  is conditional. The phase's exit criterion (line 1327) is "A clean production
  build can be installed by someone outside the development environment."

So the Week 1 campaign is Chromium-only. `p-firefox`'s findings (no `ws://`
gateway, no side panel) are input to Week 4. The rule in `AGENTS.md` about
keeping "Chrome/Edge side-panel and Firefox popup behavior aligned" is an
engineering standard, not a Week 1 exit criterion. The ledger should record
Firefox as out of Week 1 scope, quoting line 1312.

---

## Fix design, partitioned by file

These are the changes this investigation found that no in-flight brief owns.
Resolver scoring and the Flow-lane error path belong to `i-resolver-safety` and
`i-flow-lane-errors`. **FluxIQ Core files: none.** Nothing here needs a Core
change, and Core pinning is not recommended.

1. **Criterion 1 in the bench.** Optional: the alternative is the 54 standalone
   runs.
   - **Files.**
     - `packages/test-runner/src/bench/expand-corpus.ts` (`laneForResult`,
       :15): plan a row without a variant on the Flow lane as well, when the
       corpus asks for it.
     - `bench/corpus/bench-corpus.ts` and `bench/corpus/week1.ts`: the
       declaration.
     - `bench/run-bench.ts`: the routing.
     - Tests `bench/tests/week1-corpus.test.ts` and
       `bench/tests/run-bench.test.ts`.
   - **Unit proof.** week1 plans 66 runnable results per repeat (23 recording,
     23 Flow without a variant, 20 variants). Mutation: revert `laneForResult`
     and the count test fails.
   - **Lab proof.** A bench report lists Flow-lane runs for W01–W18.
   - **Cost.** 198 runs per `--repeat 3` bench, about 3.4–5.2 h each. **A
     supervisor decision:** it makes one report cover criteria 1 and 5, at
     roughly 1.5× the bench time.
2. **The Lab redaction assertion** (criterion 2; the plan's Phase 1.4 T3).
   - **Files.**
     - A new focused module `packages/test-runner/src/redaction-attestation/`
       (barrel, module, `tests/`). After a run of a scenario tagged `redaction`,
       it scans the run bundle and the isolated FluxIQ workspace's persisted
       recording events for the fixture's synthetic literals, using
       `attestWorkspaceSecretAbsence` (`secret-leak-attestation.ts:40`). A
       finding fails the run as `security.redaction`. The scan must run before
       the isolated workspace is cleaned.
     - `packages/test-runner/src/run-scenario.ts`: the call site. Owning only
       the new module would land inert.
     - `packages/test-runner/src/run-manifest/create-run-manifest.ts:80`: derive
       `redactionState` from the attestation instead of the literal. First
       confirm the literal is unconditional.
   - **Unit proof.** A planted literal in a temporary workspace produces a
     finding. Mutation: skip the scan and the test fails.
   - **Content harness.** Not applicable; T2 is already the content harness's
     `sensitive-input` spec.
   - **Lab proof.** `pnpm lab run sensitive-input --target isolated` passes with
     `findingCount: 0` recorded.
3. **An evidence-size producer** (criterion 2's packet budget; criterion 5's
   "every metric").
   - **Files.**
     - `packages/test-runner/src/bench/evaluate-run.ts` (:18, :38, and the
       `assemble` empty lists).
     - `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts:69`.
     - Tests in `bench/tests/evaluate-run.test.ts`.
     - The `BenchReport` evidence fields already exist
       (`bench/tests/compare-reports.test.ts:16` builds
       `{ sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 }`),
       so no contract change is expected.
   - **Precondition.** The brief must first locate where, if anywhere, a run
     bundle records sanitized packet bytes and `truncated`. I did not establish
     that, and it may need an extension-side producer.
   - **Unit proof.** A bundle with two packets yields their sizes.
   - **Lab proof.** The bench `report.md` Evidence size row is non-empty on
     `modal-flows`, `product-catalog` and `long-document`.
4. **W19's navigation mapping** (criterion 4).
   - **Files.** Unknown. The `w2-flow-lane` Finding 3 text points at the
     recording-to-Flow mapper's `metadata.transition === "typed"` rule. If that
     rule lives in `domain/src/client/gateway-mapping.ts`, the change is
     **serial after `f-w18-secret-leg`**, which owns that file. It needs a short
     read-only brief to locate the rule at HEAD first.
   - **Unit proof.** A recorded navigation to `/account` maps to an executable
     step.
   - **Lab proof.** `pnpm lab run auth-gate --flow --variant expired
     --target isolated` ×3 reports `auth_required` 3 of 3.
5. **`pnpm lab inspect` and `compare` should not build.**
   - **Files.**
     - `scripts/lab/run-lab.mjs:54-70`: skip the build phase when
       `READ_ONLY_COMMANDS` (:28) contains the subcommand.
     - A launcher test in `scripts/lab/tests/`, which needs the decision
       extracted into a testable function in `scripts/lab/lab-instance.mjs` or a
       new `scripts/lab/lab-command.mjs`.
     - `scripts/` is at its structure ratchet (`L-lab-concurrency` item 7), but
       the change stays inside `scripts/lab/`.
   - **Unit proof.** `compare` and `inspect` yield no build.
   - **Lab proof.** `pnpm lab compare A B` prints no build output and leaves
     `.lab-locks/` untouched.
6. **Doc truth, owned by the supervisor.** Two corrections:
   - The plan's corpus table gives W27 `disabled` as `ACTION_REJECTED`, while
     the manifest expects `blocked_by_capability_or_policy`.
   - W14's "`USER_INTERVENTION_REQUIRED` or recovered by dismiss" conflicts
     with the manifest's single category: the bench scores a recovery as a miss.

---

## Commands run and observed results

Every exit status was read from the tool's reported exit code or `$LASTEXITCODE`,
never through a pipe.

1. `git worktree list` in both repositories: each listed only its own main tree.
   `Get-CimInstance`: `TotalRAM_GB=25.85`, `FreeRAM_GB=16.88`,
   `CPU=12th Gen Intel(R) Core(TM) i5-12400F cores=6 logical=12`.
2. `pnpm store path` gave `F:\.pnpm-store\v3`. Node `v22.11.0`, pnpm `9.15.0`.
   Main-tree junction targets: all five sampled resolve to
   `F:\!FluxIQ\packages\…`.
3. Scratch `ilab-timing.ps1` over `test-runs/**/run.json` and bench reports:
   123 manifests with timing. `fluxiqExecution` carries only `targetMode`, so
   lane is not recorded in the manifest.
   - Default directory: n=98, min 33.6, median 56.4, max 99.1 s.
   - `lab-replay` (Flow lane with variants): n=11, 43.6 / 62.2 / 92.4 s.
   - Overlap window: `lab-a` 106.8 s, `lab-b` 107.8 s, default 95.9 s.
   - Smoke bench evaluations 38.8–91.5 s. `bench-mtz3zan8-d6ce4aae` has
     evaluations of `0.8,0.1,0.3,0.1` s.
   - Newest manifest `repositories`: facility `1b6f5dff…` `dirty: true`, Core
     `a575df22…` `dirty: true`.
4. `git worktree add --detach F:\fxlab-probe-ilab HEAD`: exit 0,
   "HEAD is now at 99eca80".
5. `pnpm install --frozen-lockfile --offline` in the worktree: exit 0, 2 s
   measured; pnpm printed "Done in 1.6s".
6. Worktree checks:
   - six Core junctions pointed at `F:\!FluxIQ\packages\…`;
   - `node --input-type=module -e "import('fluxiq/automation-studio')…"` exited
     0 with 383 exports, resolving to
     `file:///F:/!FluxIQ/packages/fluxiq/dist/programs/automation-studio/index.js`;
   - ignored outputs absent, tracked `apps/extension/build` and
     `domain/.test-build` present, `.env.local` absent;
   - worktree `git status --porcelain` empty;
   - main tree status before and after identical.
7. Scratch `ilab-variants.mjs` against the main tree's built
   `apps/scenario-lab/dist/registry.js`: exit 0. Built 2026-09-12T23:02:27, newer
   than the newest scenario `manifest.ts` at 18:31:17. Variant and category
   lists as quoted in Part 1.
8. Junction scan of the main tree's `test-runs`, not following reparse points,
   depth ≤ 5, not entering `node_modules`: 4 junctions into `F:\!FluxIQ\packages\`.
9. **Worktree removal, in order:**
   - six junctions pointing outside the worktree deleted non-recursively;
     "external links remaining: 0";
   - `git worktree remove --force` exited 255 with "failed to delete
     'F:/fxlab-probe-ilab': Directory not empty", but the worktree left
     `git worktree list`;
   - `cmd /c "rmdir /s /q …"` was refused by a permission hook ("Remove-Item on
     system path '/s' is blocked"), and nothing ran;
   - a walk without following reparse points found 42 reparse points, 0
     pointing outside the directory;
   - `[System.IO.Directory]::Delete(dir, $true)` threw "Access to the path
     'win32-x64' is denied" partway;
   - Core throughout: file count under `F:\!FluxIQ\packages` excluding
     `node_modules` was 2809 before and 2809 after; `git status --porcelain`
     empty; the probe file present.
   - a final inspection found 0 files left, 0 read-only files, no `esbuild`
     process, and 0 links pointing outside the directory. The retried
     `[System.IO.Directory]::Delete(dir, $true)` printed "retry delete: ok", and
     `Test-Path` was then `False`. Core status still empty; probe file present.
     The first failure was most likely a transient lock on the freshly installed
     esbuild binary. **Final state: the worktree and its directory are gone.**
10. `git -C F:\!FluxIQ log --oneline -2`: `5d495eb Withhold values resolved out
    of state from the persisted run trace`. `rev-list --left-right --count
    origin/dev...HEAD` gave `0 1`.

No unit test, content harness, build or Lab command was run. None applies to a
read-only schedule, and the brief forbids the last two.

## Not verified

- **A Lab run from a worktree, end to end.** Install and resolution were proven;
  the Lab build chain from empty outputs and a run were not, because `pnpm lab`
  and `pnpm build` were forbidden. Stage 0 run A is the check.
- **Memory per Lab instance.** Never measured, by anyone. The 2.5–4.5 GB figure
  is my estimate.
- **The concurrency slowdown (1.5–1.7×) and throughput (about 1.8×).** One
  overlap window of three runs.
- **All durations for criteria not yet run** (Flow-lane W02–W18, the realistic
  fixtures, `reconnect`, `demo:*`). Extrapolated from the medians above.
- **Whether `lab run` exits 0 or 1** when a negative variant reports its expected
  category.
- **What `RunScenarioResult.observation` contains.** Field names are taken from
  `v-bench-honesty`, not re-read.
- **Two quoted claims not re-read at HEAD:** that the recording lane executes at
  most two probe actions (`v-bench-honesty` Defect 3), and that W19 cannot report
  `auth_required` (`w2-flow-lane` Finding 3 via `v-bench-honesty`).
- **Whether `create-run-manifest.ts:80`'s `redactionState: "verified"` is
  unconditional.** Only the grep line was seen.
- **Whether the race fix is in HEAD.** Left to `i-flow-lane-errors` (a).
- **What Core `5d495eb` contains**, and whether it is the eight-file change
  Current State describes.
- **`demo:record` / `demo:run` in a worktree without `.env.local`.**
- **Whether pinning Core in its own worktree is affordable.** Its install and
  build time were not measured.

## Open questions or contradictions found

1. **Criterion 1's proof.** Current State's row says "week1 W01-W19 through the
   bench, 3 of 3". The bench cannot execute those workflows
   (`expand-corpus.ts:15`), and the plan's Phase 1.2 Lab proof says `--flow`.
   Decide between the 54 standalone runs and fix design item 1.
2. **Criterion 2's proof.** Current State asks the Lab for "the 16 items,
   packet budget, leak rows". The plan puts the 16 items and byte budget in the
   content harness, and the Lab redaction assertion is not in the code. Either
   accept the content harness for the first two and build item 2, or also build
   item 3.
3. **Criterion 4 is arithmetically blocked by W19.** Nobody owns the fix (item
   4). Decide whether to fix it or rule W19 out with a reason.
4. **Criterion 5's "every metric".** Evidence size is empty on every lane.
5. **W26 "by context"** and **the realistic fixtures** are not in any corpus.
   Their proof is standalone runs only.
6. **`pnpm lab compare` and `inspect` build**, and in default mode delete the
   shared extension `dist` (item 5).
7. **Core's uncommitted change may be settled.** Core is now at `5d495eb`,
   clean, one commit ahead of `origin/dev`.
8. **HEAD and the plan moved under me.** The facility went from `99eca80` to
   `b43a46a` while I worked. File:line citations in this report were read
   between those two commits, and the scratch worktree was at `99eca80`. The
   plan's section line numbers also shifted by about 112 lines
   between my reads (Metrics went from line 674 to 562). Plan line numbers in
   this report are from my last grep, and the Current State quoted is the one I
   read at the start.
9. **I read beyond the named sections, and why.** Besides the files the brief
   named, I read the plan's Objective (Current State links it as the definition
   of the criteria), Metrics, FluxBench Week 1 Corpus, and the T3 and exit-check
   lines of Phases 1.2–1.5. Each criterion's Lab proof text lives there, and the
   brief's named sections do not contain it.
10. **Brief defect, minor.** It says a scratch worktree is allowed "if you remove
    it afterwards", but the permission hook blocks the usual Windows recursive
    delete. It does not warn that a worktree holds junctions into Core, which a
    careless delete would follow. The safe procedure is in Part 2, item 8.

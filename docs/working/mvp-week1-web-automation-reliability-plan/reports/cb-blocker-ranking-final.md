# `cb-blocker-ranking-final`: measured Week 1 blocker ranking for the closeout pair

This ranking replaces `ab-blocker-ranking-refresh.md`. It becomes exit-criterion 6 evidence
once the supervisor records it in the Week 1 ledger.

## Outcome

Done. The closeout pair ran at downstream `3d6ecd6` and Core `19468b7`: campaign A is
`bench-mu202a52-127f75c3` and campaign B is `bench-mu202snn-ec661de2`. Together they measured
378 executable runs, of which 358 passed and 20 failed.

- **18 failures** are the three variants already ruled out of Week 1.
- **2 failures** are the only differences between A and B. Both happened while a per-run
  `next dev` Core was starting, before any browser launched or any step ran.

The comparator reports `outcome: equivalent`, and every metric that has a tolerance is within it.
It still reports `comparisonPassed: false`, because of those two runs.

Four Week 1 blockers remain; they are ranked below.

- The root-cause fix for Rank 1 exists only as unpushed commits on the worktree branch
  `week1-core-production-build`, and so does the fix for Rank 4. **No Lab run or Lab pair has
  exercised either one.** No real `next build` or `next start` has run yet.
- The fix for Rank 2 is still being written.
- Nothing below is called proven beyond what this pair measured.

## Measurement basis

- **Run counts.** Each campaign evaluated 189 runs (179 passed, 10 failed) and skipped 12
  planned cells, out of a 201-cell plan.
- **Differing verdicts**, 2 of 378 runs across 2 of 126 result groups:
  - W14 `modal-flows` / `interstitial`, Flow lane, repeat 2: failed in B with
    `process.startup`. A passed 3/3 and B 2/3.
  - W28 `iframe-checkout`, recording lane, repeat 1: failed in A with `gateway.connection`. A
    passed 2/3 and B 3/3.
- **Common failures.** W05 `short-catalog`, W13 `banner-absent` and W24 `unannounced` (all Flow
  lane) failed 3/3 in each campaign, as `runtime.behavior` with no facility failure.
- **Metrics.**
  - Run-duration p95 was 113,134 ms in A and 113,054 ms in B.
  - Evidence-packet p95 was 5,934 bytes in both. A's maximum was 5,992 bytes.
  - Truncations were 167 and 165. Harness activations were 0 in both.
  - Fallback recovered 5/5 in each campaign.
  - Classification of the required negative cases was 15/15 in each, and of all negative
    cases 30/33 in each.
  - Criterion 1 (Flow workflows stable with no harness) was 16/16 in A and 15/16 in B, the
    missing one being W14.
- **Campaign integrity.**
  - A was checked by `bq`: the checkpoint chains are intact; evaluations, receipts and bundles
    agree 189/189; all 24 merge-seal digests match; nothing was left behind; redaction findings
    were 0.
  - B sealed only after one manual quarantine (see Rank 2). The supervisor then observed a merge
    seal present, no gaps or broken links in the parent chain, 0 leases and 0 dot files.
- **Not measured by this pair: recording persistence.** The comparator's
  `persistenceDiscards` block inspected 0 runs in each report, and A's report has no
  persistence field.

## Actual remaining Week 1 blockers

Ranked by measured corpus impact: changed verdicts first, then campaign completion, then
diagnosis, then build gates.

| Rank | Blocker | Affected cells / runs | Severity | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- |
| 1 | **A per-run `next dev` Core fails topology startup under load.** Root-cause fix is on the branch (F1, F2); no Lab pair has run it | **2/378 runs, 2/126 groups.** The sole cause of `comparisonPassed: false`, and of B's 15/16 on criterion 1.<br><br>**W14:** the first request ever made to `automation-studio-context` (`coordinator.ts:137`) got no answer in 30 s (`http.timeout / project.select / 30000`). The run had `ports {}` and 0 steps. It overlapped a 19 s slot hold during the PowerShell probe churn.<br><br>**W28:** after `GET /` readiness, the 60 s TCP gateway wait timed out (`coordinator.ts:121-122`), with 0 steps and `processExits {}`.<br><br>**Recurring as a class:** supervisor notes record a Core startup failure (W25, then W05) in earlier final pairs too | Release-blocking for the strict gate. The user accepted both runs as one disclosed infrastructure exception for tonight's close, to be superseded by a pair run on a production-build Core | **Certain** about where it fails: before any browser or step, on a dev Core.<br><br>**Moderate** about the mechanism: an on-demand compile or dev-watcher wait under load. This is traced in source but not observed, because the startup-failure path deleted Core's log.<br><br>Each run is a single event on a machine with faulty RAM. W28's window overlapped supervisor build and test load; W14's did not | **Supervisor:**<br>1. Record the W14 Flow and W28 recording focused 3/3 proofs. They were launched, but their results are not in the sources read here.<br>2. Integrate F1–F3 onto `dev`.<br>3. Live-validate the Core build.<br>4. Run the production-build pair and compare |
| 2 | **The durable writer can leave an orphaned temporary file after a successful publish, and shard merge fails closed on it.** Fix in progress (F4); not compiled or tested | **1 of 2 campaigns could not seal unattended** (B); 0 verdicts changed.<br><br>The orphan was a single file in B shard 002 `evaluations/`: cell c15, 1,010 bytes, SHA-256 identical to its published target.<br><br>B's parent exited unsealed. The exact-ID resume failed with `Shard evaluation directory contains a missing or orphan receipt`. B sealed only after the file was moved to `quarantine\` and B was resumed again | High for unattended repeatability: an overnight pair can stall at merge. No data is lost | **Certain** about the state and the check that blocks:<br>- `shard-merge.ts:114-123` lists the directory including dot files;<br>- `durable-file.ts:100-111` links the temporary to the target, then removes the temporary.<br><br>**Low to moderate** about the trigger. A Windows sharing failure on the removal (perhaps Defender) is a hypothesis. The original parent's error was not captured | `ca-durable-temp-cleanup` worker, then supervisor gates. Land it before the overnight pair, or accept that another manual quarantine may be needed |
| 3 | **The TCP gateway startup wait has no closed failure projection, and startup failures destroyed Core's log.** Log retention is fixed on the branch (F1), not exercised live. No fix for the TCP stage appears in the reports read | **1/378 runs** (W28, already counted in Rank 1). Its facility failure is `finalized-bundle / scenario.execute / unclassified`, with no operation stage or bound. Neither W14 nor W28 kept a Core log | Medium diagnostic gap. The category `gateway.connection` is correct, but a recurrence cannot be tied to a stage or a bound | **Certain** the projection is absent: `bq` observed it, and `waitForTcpGateway` has no closed projector | Test-runner coordinator and facility-failure owner. The supervisor decides between Week 1 and Week 2; the previous ranking treated the unstaged startup timeout as Week 1 |
| 4 | **The structure audit fails on pushed `dev`.** 4 of 5 violations are fixed on the branch (F3); regenerating the README index is still pending | **0 corpus runs.** At `3d6ecd6`, `node scripts/structure-audit.mjs` exits 1 with 5 violations:<br>- `src/tests/` holds 50 files against a baseline of 49;<br>- barrel bypasses in `bench/shard-merge.ts`, `bench/tests/shard-merge.test.ts` and `facility-failure/project-facility-failure.ts`;<br>- `docs/working/README.md` is out of date | Gate-blocking. Root `pnpm check` fails on pushed `dev`, contrary to the handoff's "pnpm check passed" | **Certain.** The supervisor observed it with a read-only run in the main checkout, and the worktree shows the same. Core's audit at `19468b7` exits 0 | **Supervisor:**<br>1. Integrate `d64164d`.<br>2. After the working-document edits, run `pnpm structure:baseline` and confirm the baseline entries only shrink.<br>3. Run the root gates |

## Fixed or closed items

### Fixed in code, not yet proven by a Lab pair

The fixes are unpushed commits in worktree `F:\fxlab\fxlab-prod-core`: `9e3c713`, `88490df`
and `d64164d` on top of `3d6ecd6`. The supervisor observed these results in that worktree with
F1 and F2 present:

- Scenario Lab and test-runner builds exited 0.
- The test-runner suite passed 822/822, and again 822/822 after F3.
- `pnpm structure:test` passed 63/63 and `pnpm lab:test` 15/15.

| Fix | Item | Measured impact before repair | Evidence so far, and what is unproven | Severity before closure | Confidence | Next owner |
| --- | --- | --- | --- | --- | --- | --- |
| F1 `88490df` | **The Lab's Core runs from a cached production build:** `next build` once per build key and `next start` per run. Every mode shares one cache at `<runs>/.core-web-build`, and startup-failure logs are copied into the bundle | Rank 1 (2/378 runs), plus the log loss in Rank 3 | **Evidence:** the supervisor reviewed the diffs, and the suite passed 822/822. The worker claims 54/55 focused tests (one environmental failure) and 21 mutations caught.<br><br>**Unproven:**<br>- no real build or server has run;<br>- build time against the new 10-min bound;<br>- whether `sqlite3` resolves through the junctions;<br>- the `secure` login cookie and pairing in production mode;<br>- the built Core's memory footprint;<br>- several `next start` servers sharing one `.next`, which is safe only while Core uses no ISR, cached fetch or `next/image`;<br>- the empty-lock crash window in `workspace-lock.ts` | Release-blocking | **High** that the design removes on-demand compiles and the dev watcher from bounded windows.<br><br>**Unknown** whether that removes the failure class | **Supervisor:** live-validate build timing, login and pairing, W14 Flow, a smoke bench and memory; then the pair |
| F2 `9e3c713` | **The slot waiter no longer starts PowerShell on every poll.** It checks presence with signal 0 and runs the full probe only on first sight, when a PID looks absent, and once per 60 s | At least ~518 probe `powershell.exe` spawns per minute, from one live 20 s sample during the pair. A plausible load amplifier for Rank 1 | **Evidence:** the supervisor reran the focused tests (30/30) and mutation M2 (5 tests failed, as intended). The worker claims all 13 mutations were caught.<br><br>**Unproven:** the spawn rate and CPU cost after the fix, and any effect on startup failures | Throughput and load amplifier | **High** for the logic: a live owner is never archived on the cache's word.<br><br>**Unmeasured** effect | **Supervisor:** measure the spawn rate during the next campaign |
| F3 `d64164d` | **Imports go through barrels,** and the 50th `src/tests/` file is split between `bench/tests/` and `cli-llm.test.ts`, with no baseline change | Rank 4 | **Evidence:** on the supervisor's rerun, the audit's only failure left is the README index, the build exits 0, and the suite passes 822/822 (same total as before).<br><br>**Unproven:** root `pnpm check`, `pnpm test` and `pnpm build` on the integrated `dev`, and the README regeneration | Gate-blocking | High | Supervisor |
| F4, in progress | `ca-durable-temp-cleanup` | Rank 2 | **None yet.** The brief says edit now, then compile and test after the reruns. No report was read | High | n/a | Worker, then supervisor |

### Closed by this measured pair

| Closed rank | Item | Measured impact before repair | Closing evidence | Severity before closure | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- | --- |
| C1 | No fresh clean-pinned A/B pair had run (previous Rank 1) | The acceptance observation was missing | The pair ran at the clean pin. Each campaign has 189 evaluated plus 12 skipped, and both are sealed. The official comparison is `equivalent` with `comparisonPassed: false`, caused only by Rank 1 | Release-blocking | Certain | Supervisor, through Rank 1 |
| C2 | W19 lost the click landing at Stop | 2/6 `expired` repeats reported false success in the old pair | W19 is not among the 20 failures or the differing verdicts. Required classification was 15/15 in each campaign | High | High, now measured in a full pair at `3d6ecd6` | Extension lifecycle owner, only if it recurs |
| C3 | Cold MV3 service-worker readiness | 1 of the old pair's 378 runs | No extension-worker failure in 378 runs. W05's primary recording did not fail in either campaign | High availability, low frequency | Moderate: at a base rate near 1/378, absence is weak evidence | Runner lifecycle owner, if it recurs |
| C4 | HTTP startup failures erased their cause, and the startup timeout had no stage (previous C3 and Rank 2) | One bare `fetch failed`, and one W19 startup timeout with no stage | This pair's W14 failure carried the closed projection `http.timeout / project.select / 30000`. W25's primary workflow did not fail. The TCP gateway stage stays open as Rank 3 | High diagnostic value | High for HTTP stages | Runner HTTP and coordinator owner |
| C5 | Campaign durability | Interrupted campaigns lost their progress | **A** finished unattended: parent chain 3 generations and shard chains 134/122/128, all contiguous and `finished`; 189/189 agreement; seal 24/24; nothing left behind.<br><br>**B**'s shards all finished, but its parent sealed only after the manual quarantine | Critical | High for A; B did not complete unattended | Campaign-store owner, through Rank 2 |
| C6 | Evidence and fallback | Proof gaps | Fallback 5/5 with 0 harness in each campaign; harness 0/378; packet p95 5,934 bytes in each and 5,992 maximum in A; 0 redaction findings across A's 189 bundles.<br><br>**Not re-measured:** recording persistence (0 runs inspected), and B's bundle-level redaction figures (not read here) | High if violated | High for A and for fallback; persistence still open | Supervisor attestation pass |

## Ruled-out variants retained in the corpus

| Week 2 rank | Variant | Affected cells / runs | Severity | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- |
| W2-1 | W24 `unannounced` | 6/6 failed (3/3 in each campaign) as `runtime.behavior`. The expected `output_not_observed` was not reported; in A these are the 3 misses behind 30/33. The failure shape matches all six in the previous repaired pair | High product gap | High: deterministic in both pairs (12/12) | Cross-repository Week 2 contract, mapper and evaluator owners |
| W2-2 | W05 `short-catalog` | 6/6 failed (3/3 in each) | Medium-high product gap | High: 12/12 across both pairs | Week 2 recording and domain authoring owner |
| W2-3 | W13 `banner-absent` | 6/6 failed (3/3 in each) | Medium product gap | High: 12/12 across both pairs | Core failure-route and node-policy owner, plus downstream mapping |

These 18 runs account for every failure common to A and B.

## Non-repeating machine and operational observations

| Watch rank | Observation | Affected cells / runs | Severity | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- |
| M1 | Memory admission ran close to its thresholds | Across 143 finalized runs: 67 hand-offs from two active cells to fewer, mean hold 37.2 s, maximum 208.7 s.<br><br>Available memory fell to 4,889 MiB (20:44–20:53) and 5,201 MiB (23:20), with commit charge up to 90%. Each dev Core took ~2.5–2.6 GB, beside ~5–6 GB of the user's Chrome.<br><br>W28's window had 7,666–10,877 MiB available | Throughput; a plausible amplifier for Rank 1 | High for the holds; memory footprints come from single samples | Measure the built Core's footprint during the production-build pair before retuning the 3 GiB-per-slot figure |
| M2 | Supervisor and worker load overlapped W28 | Worktree builds and the 822-test suite ran ~22:00–22:11 local. W28 ran 22:09–22:11; W14 (20:19–20:21) came before any of that load | Measurement hygiene | Likely a contributor; cannot be proven | Supervisor: no heavy work while a pair runs (adopted after W28) |
| M3 | Every `pnpm lab` call rebuilds the shared `domain/dist` | Each call removes 273 emitted files in the main checkout. No failure has been observed | A latent hazard: any concurrent Lab command, `lab compare` included, could break a live run | Certain mechanism | Lab tooling owner; until then the supervisor runs Lab commands one at a time |
| M4 | The focused-proof launch script was broken | 6 attempts failed with `fixture.invalid` in ~18 s and created no runs folder, because PowerShell passed the argument array as a single string | No product impact; a proof slot was wasted | Certain | Supervisor; relaunched with literal arguments |
| M5 | An orphaned Playwright Chromium tree was running | 8 processes, 287 MB private memory, started 2026-09-14 01:30, headed, no extension loaded | Low; it predates both campaigns | High that it did not leak from this pair | Left running; the user was told |

## Closeout work that is not a measured product blocker

- The Week 1 exception holds only if the ledger discloses both startup failures and records the
  W14 and W28 focused proof results.
- The integration order from the supervisor notes:
  1. Cherry-pick F1–F3 onto `dev`.
  2. Run the root gates.
  3. Validate live.
  4. Push.
  5. Prebuild the Core cache in each runs root.
  6. Launch the pair from the worktree.
- Two handoff statements need correcting: each campaign has 12 planned skips, not 18, and
  `pnpm check` did not pass at `3d6ecd6`.

## What changed and why

Only this report was written. No code, working document, campaign state, Lab process, commit or
remote was touched.

## Commands run and observed results

None. I only read files: the previous ranking; the comparator output `compare-final-2.json`;
`supervisor-notes-2026-09-14.md` in full; and the reports `bs-w14-runner-sequence.md`,
`bt-w14-core-handler.md`, `bw-core-production-build.md`, `bx-slot-poll-probe.md`,
`by-structure-violations.md` and `bq-sharded-final-2-a.md`.

## Not verified

- **Results of the W14 and W28 focused 3/3 proofs.** They are not in the sources read.
- **B's bundle-level figures** (redaction findings, packet maximum, chain detail). They come
  from the supervisor notes and the comparator, not from B's verification report
  (`br-sharded-final-2-b`), which I did not read.
- **Everything about the production build.** Real build, server, cookie, pairing, footprint and
  effect on the failure class are all unexercised.
- **The mechanism behind Rank 1,** and the trigger behind Rank 2.
- **The state of the F4 fix.**
- **The earlier final pairs' W25 and W05 events.** They are taken from the supervisor notes.
- **Campaign data.** No campaign data was read directly; every figure comes from the named
  sources.

## Open questions or contradictions found

1. **The supervisor notes contradict themselves on skips.** Their draft terminal-verification
   brief (line 533) still says "189 evaluated + 18 skips". Observed: 12.
2. **Recording persistence has no evidence in this pair.** The previous ranking cited zero
   persistence failures, but this pair has no inspected persistence population. If criterion
   evidence depends on it, a separate check is needed.
3. **The two diagnoses disagreed on W14's premise.** `bt` assumed the route was already compiled
   when W14 hit it. `bs` and the supervisor corrected this: it was the route's first hit. The
   dev-watcher wait `bt` traced is still a candidate for requests to routes that were already
   compiled. F1 removes both, by design.
4. **Rank 3 needs a scope decision.** Is it a Week 1 blocker or Week 2 work? That is the
   supervisor's call.

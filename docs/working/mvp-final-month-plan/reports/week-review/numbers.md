# Week review 2026-09-29..2026-10-06: the numbers

Worker report for "Brief: week-review-numbers". Read-only; nothing was built, tested or launched. All times UTC.

## Outcome

Done, with two gaps that cannot be closed from what is left on disk (see "What could not be established").

## Sources and coverage

| Period | Source | Coverage |
| --- | --- | --- |
| 2026-09-29 20:47 to 2026-09-30 18:34 | Spend ledger did not exist yet. Run folders are gone (their lane worktrees t174/t193/t194/t195 were removed); one survives at `!FluxIQWebExtension/test-runs/run-mun5e1ie-5aeefbbd`. Numbers come from the 97 run debugs dated in this span under `docs/working/language-driven-flow-loop-plan/debugs/`, `debugs/t195-slot-4-balance-failures-2026-09-30.md`, and the archived ledger entry "2026-09-30 — Stopped" in `language-driven-flow-loop-plan/archive/ledger-2026-09-28-to-30.md` (line 53). | Partial: totals only, not per run |
| 2026-09-30 18:34 to 2026-10-06 21:39 | `C:/Users/osrs_/FluxStuff/lab-slots/spend-ledger.jsonl` (78 start/finish pairs). Per run, `evaluation.json` / `snapshots/live-llm.json` / `snapshots/flow-lane.json` from `C:/Users/osrs_/FluxStuff/lab-runs/<local date>/<runId>/` (Lab copies, 2026-10-02 on) and `fxwork/{t262,t274,t275}/!FluxIQWebExtension/test-runs/instances/*/`. For the 22 launches between 09-30 18:34 and 10-02 02:12 (folders gone) the run debug headers supply calls, Flow created and true cost. | Full per run, 78 launches |

Every one of the 78 ledger runs has a debug: 74 on dev, the four round-3 runs (`run-mux6n7m4`, `run-mux6pndp`, `run-mux6naez`, `run-mux74k5q`) only in the t262/t274 lane trees.

## Headline

| Measure | Value |
| --- | --- |
| Live Lab launches in the window | **about 536**: 112 paid runs before 09-30 12:18 (archived ledger) + 346 zero-cost balance-failure runs (09-30 12:21-17:22) + 78 ledger launches from 09-30 18:34 |
| Paid launches | **190** (112 + 78; 4 of the 78 were killed before a verdict) |
| Lab passes | **5 real passes**, all one task (`crossborder-marketplace-hub-to-cart`), all from 10-03 on. Plus 12 Lab "passed" on 09-30 that were permission stops with no Flow (`flowCreated=false`); the archived ledger already counts them as not passes |
| Total spend | **about $17.04**: $9.46 before 09-30 12:18 + $7.58 from 09-30 18:34 (ledger $6.36 + $1.22 the ledger missed) |
| Spend on failed runs | **about $16.82** (99%); passed runs cost $0.2194 in all |
| Provider calls (ledger period) | **3,052** over the 74 launches whose count is known; mean 41 a run |
| Builds over the per-build ceiling | **1** (`run-mup2u8o3-6697c4be`, $0.2969 against the then $0.25 ceiling, 10-01 05:11). **0** since the $0.10 ceiling took effect (10-02 02:15). Seven runs since then cost over $0.10 in total because judge and re-author spend sits outside the per-build ceiling, and `run-musq0b1m-0472cfa0` ($0.2127) ran under an overridden $0.30 ceiling |
| Runs with no Flow produced (ledger period) | **57 of 78** (73%), $4.95. 20 produced a Flow ($2.31); 1 unknown |
| Replays | **2** standalone provider-free replays, both passed with 0 model calls: `replay-mutf9b4t-7bbe92c6` and `replay-mutfcx2k-619aa48f` (10-04 06:10 and 06:13, A8 Flow from `run-mutepu6b-656f8882`). No other replay in the window |

## Live runs per day

Ledger-period figures are exact. Before 09-30 18:34 only the debugged runs can be dated individually; the debugs do not cover every run.

| Day (UTC) | Launches | Passed | Cost | Calls (known) | Flow created / none | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 09-29 (from 20:47) | 5 debugged | 0 | in the $9.46 | n/a | 0 / 5 | Lab facility failures (`lab.generation_unfinished`, provider error) |
| 09-30 to 18:34 | 92 debugged paid + 346 balance failures | 0 real (12 permission stops the Lab called passed) | $9.46 for 112 paid runs to 12:18 | n/a | n/a | Relaunch-loop incident, below |
| 09-30 from 18:34 | 6 | 0 | $0.3569 | 209 (5) | 0 / 6 | first runs after the top-up |
| 10-01 | 17 | 0 | $3.1372 | 710 (14) | 4 / 12 | $0.25 ceiling still in force; 4 launches killed (DeepSeek outage 20:44; three reconciled) |
| 10-02 | 12 | 0 | $0.9727 | 287 (12) | 6 / 6 | $0.10 ceiling from 02:15 |
| 10-03 | 15 | 2 | $1.3112 | 665 (15) | 4 / 11 | Codex lanes; first A passes |
| 10-04 | 15 | 2 | $0.8212 | 622 (15) | 2 / 13 | t262 A/B only; incl. A8 `run-mutepu6b` |
| 10-05 | 0 | - | - | - | - | no live runs |
| 10-06 | 13 | 1 | $0.9844 | 559 (13) | 4 / 9 | round 1 (04:14, 4 runs $0.2991), round 2 (06:24, 4 runs $0.3334), round 3 (21:20, 5 runs $0.3521) |

## Per scenario and task (ledger period, 09-30 18:34 to 10-06)

| Task | Runs | Passed | Cost | On failed runs | Calls | Flow / none |
| --- | --- | --- | --- | --- | --- | --- |
| crossborder-marketplace-hub-to-cart (A) | 22 | 5 | $1.6139 | $1.3945 | 833 | 7 / 14 (1 unknown) |
| bigbox-retail-pickup-cart-store-remembered-after-creation (B) | 14 | 0 | $1.0418 | $1.0418 | 650 | 1 / 13 |
| bigbox-retail-pickup-cart-redesigned-after-creation | 8 | 0 | $1.1521 | $1.1521 | 257 (6 known) | 1 / 7 |
| bigbox-retail-pickup-cart | 4 | 0 | $0.6861 | $0.6861 | 216 | 1 / 3 |
| everything-store-plus-earbuds-under-50 (C) | 17 | 0 | $2.0026 | $2.0026 | 551 (15 known) | 9 / 8 |
| social-network-feed-confirm-requests (D) | 12 | 0 | $1.0591 | $1.0591 | 529 | 1 / 11 |
| social-network-feed-group-post-regrouped-after-creation | 1 | 0 | $0.0279 | $0.0279 | 16 | 0 / 1 |
| **All** | **78** | **5** | **$7.5835** | **$7.3642** | **3,052** | **20 / 57** |

By scenario: bigbox-retail 26 runs, 0 passed, $2.88; everything-store 17, 0, $2.00; crossborder-marketplace 22, 5, $1.61; social-network-feed 13, 0, $1.09. Before 09-30 18:34 only per-lane spend exists: t174 $3.86, t193 $2.65 (bigbox redesigned), t194 $0.25 (everything-store), t195 $2.70 (bigbox pickup-order, social feed).

Passes: `run-murwd8le-79e735a8` (10-03 04:33, $0.0579, 27 calls, judge `unverified`), `run-musp8nz1-dbd3905a` (10-03 18:01, $0.0242, 20), `run-mut4fvkm-e2fc03e6` (10-04 01:07, $0.0403, 30), `run-mutepu6b-656f8882` (10-04 05:55, $0.0566, 45), `run-mux6n7m4-8273e7a0` (10-06 21:20, $0.0405, 32). The repeat of the last one, `run-mux74k5q-1c3c2127` (10-06 21:33), failed, so no lane has two passes in a row.

## Verdicts and failure categories (ledger period)

| Lab verdict / category | Runs | Cost |
| --- | --- | --- |
| failed / `runtime.behavior` | 40 | $3.0967 |
| failed / category not in a surviving bundle (09-30 18:34 to 10-01; debugs say `runtime.behavior` or `performance.budget`) | 19 | $3.1708 |
| failed / `performance.budget` (call cap exceeded: 49-73 calls against 48 or 64) | 7 | $0.5607 |
| failed / `gateway.connection` (setup, 0 calls) | 2 | $0 |
| failed / `environment.missing` (a settings update refused, 400) | 1 | $0.2127 |
| no verdict (killed) | 4 | $0.3232 known |
| passed | 5 | $0.2194 |

How the builds ended, from the 34 surviving `flow-lane.json` files whose build failed (of 53 with a `flow-lane.json`; 19 builds proposed a Flow) (a run can carry more than one code): `flow_bootstrap.evidence_budget_exhausted` 17 (the purse ran out), `flow_bootstrap.build_not_finished` 14, `llm_evidence_loop.repeat_refused` 7, `llm_evidence_loop.draft_amendments_refused` 4, `flow_bootstrap.not_doable` 2, `llm_evidence_loop.dry_run_refused` 2, `core.replay.failed` 2, one each of `instructed_act_missing`, `instructed_act_only_optional`, `full_run_required`, `flow_unchanged_since_judged_wrong`, `repeat_not_after_its_source`, `unknown_parameter`, `web.handle.misplaced`, `core.replay.unreproducible`, and one `lab.chat_ran_other_capability` (the chat ran something other than a build).

**Flows that were made but failed: 15.** In the 11 of them with both a task oracle and a result judge on record, the judge disagreed with the oracle 6 times:

- Oracle passed, judge refuted (a right Flow thrown away): `run-musp39u8-9ac026ab` (C, 10-03, $0.1859), `run-muw5zv4m-52d83027` (B, 10-06, $0.1187), `run-mux6naez-6c20f26e` (C, 10-06, $0.1037).
- Oracle failed, judge confirmed (a wrong Flow accepted): `run-muqiho5c-e830ce01`, `run-muqj2bgb-d048ec37`, `run-muqk4u32-0b36e58f` (all 10-02).
- Oracle failed, judge refuted (judge right): `run-muqilf9s-c3211328`, `run-muqiojz4-04a7a8fc`, `run-muqk713g-d08ad3dc`, `run-murwcmx2-a1c6edf7`, `run-muw60j7c-bb7c9a62`.

## The 09-30 relaunch-loop incident

The lane leads ended on a Claude session limit at about 04:00 local (11:00Z). Launcher loops (`live-run-b.sh` for t193, `t195-queue2.sh` for t195, t193 `loop2.sh` from 10:06Z) kept relaunching live runs with nobody debugging them. The supervisor killed them at 10:22 local (17:22Z); `loop2.sh` was found still running at the resume and killed then.

- **Spend.** From the archived ledger: after 11:00Z, **47 paid runs, $4.25**, last spending run 12:18:40Z (the whole 09-29..09-30 period: 112 paid runs, $9.46; before 11:00Z 65 runs, $5.21). Then **346 runs at $0** from 12:21Z to 17:22Z, all `bigbox-retail-pickup-order` on `t195-slot-4`, each failing on the first provider call against an empty DeepSeek balance.
- **The 37 relaunch-loop runs named in their debugs (10:14Z to 12:13Z), $3.12 in all:**
  - t193, `bigbox-retail-pickup-cart-redesigned-after-creation`, t193 runs 10-32 (23 runs, $1.92): `run-muny76m9-bab4e6ba`, `run-munymcpf-93148576`, `run-munyt4jo-dc4e704a`, `run-munyzo8z-3af91549`, `run-munzfk33-d85ec7a9`, `run-munzl2eh-f187a7ef`, `run-munzpdlu-4a6d83c3`, `run-munzutb0-8373bf59`, `run-muo00owc-84c87cbc`, `run-muo06beo-bcce5ab7`, `run-muo0dyu5-e2da3029`, `run-muo0ks69-b23d295e`, `run-muo0r9fk-b1168952`, `run-muo0wf2q-50776ea1`, `run-muo12lnk-9c841755`, `run-muo18781-1b1bf7c8`, `run-muo1dxrj-871073c0`, `run-muo1la5v-d4eeb7e1`, `run-muo1w558-dfbcd14a`, `run-muo20xvx-122a2f4e`, `run-muo2690x-442c6f50`, `run-muo2b224-aa7f6336`, `run-muo2gyob-a3877079`. None passed.
  - t195, `bigbox-retail-pickup-order` (14 runs, $1.20 for the 13 with a cost): `run-munzbfbj-2fb8947d`, `run-munzihwx-47ccdf7c`, `run-munzrj6r-6f754710` (cost not recorded), `run-munzz9j1-f8c30ff5`, `run-muo07nnh-9c8f7e46`, `run-muo0g1ky-f3a866ba`, `run-muo0qepn-c0aa6dd0`, `run-muo0zggr-442f9107`, `run-muo1ch23-3de731fb`, `run-muo1ni63-3e0aa746`, `run-muo1rxmv-0c617136`, `run-muo1z05y-ad79d4c3`, `run-muo2825e-5f295f24`, `run-muo2fscr-7055485a`. The Lab said "passed" for 10 of them, all permission stops with no Flow.
  - The 346 balance failures: one debug, `debugs/t195-slot-4-balance-failures-2026-09-30.md`, first `run-muo2nioi-e4a9bd18`, last `run-muodhgog-5be437d1`.
- The rest of the 47 paid runs after 11:00Z (about 20 runs, about $1.86 by subtraction) have no debug, so their ids cannot be named; the per-lane split suggests mostly t174.
- Guards added afterwards (from the balance-failure debug): `5363e39b` writes `lab-slots/STOP-balance` on the first insufficient-balance failure, refuses a failed run on unchanged source, and refuses a fourth start within 30 minutes.

## Other numbers worth knowing

- **The ledger under-records.** It shows $6.36 for its 78 launches; the debugs show $7.58. Five failed chat builds on 10-01 were written as $0 (`run-muq3ubys` $0.2272, `run-muq3vuwx` $0.1322, `run-muq3uozx` $0.2157, `run-muq4jztv` $0.2290, `run-muq5v4zg` $0.0962) because a failed chat build left no accounting the Lab could read (debug cause S1). One killed launch, `run-muq70foz-74caa189`, cost $0.3232 over 116 calls by its decision dumps and has `null` in the ledger. Two more killed launches (`run-muohgblr-ed6ddc49`, estimated $0.04-0.05; `run-muq05kas-058193f0`, DeepSeek outage) have no cost anywhere. Since 10-02 every ledger row has a cost.
- **Peak-hour runs:** 10 of the 78 ledger launches started in DeepSeek peak (weekday 01-04 or 06-10 UTC), $0.82, no passes; among them round 2 on 10-06 06:24.
- **Mean cost** per ledger run with a cost: $0.1025. **Calls at or over 64:** 9 runs, the most 116 (`run-muq70foz`) and 113 (`run-musp39u8`).
- **Rounds 1-2 of 10-06** (the Current State's "eight runs, all failed, $0.632"): confirmed, $0.6325. Round 3: 5 runs, 1 pass, $0.3521.

## What could not be established, and why

- **Per-run figures before 09-30 18:34.** The run folders were deleted with their worktrees and the spend ledger began at 09-30 18:34, so calls, Flow-created and verdict per run exist only where a debug recorded them (97 debugs, cost in 60 of them). Totals rely on the archived ledger's $9.46 / 112 runs, which was computed when the folders still existed; I could not re-derive it, and its start time is not stated (it may include runs from before 09-29 20:47).
- **Per-scenario spend before 09-30 18:34.** Only per-lane totals survive; a lane ran several scenarios.
- **The ids and debugs of about 20 paid runs after 11:00Z on 09-30**, and the cost of `run-munzrj6r-6f754710`, `run-muohgblr-ed6ddc49` and `run-muq05kas-058193f0`.
- **Provider calls** for 4 ledger launches (`run-mup2i28c` reports "5 decisions" only, `run-muq2dlhq`, `run-muohgblr`, `run-muq05kas`), and Flow-created for `run-muq70foz` (it re-authored, so probably yes).
- **In-run `--replays`** on 09-30 (the old launchers passed `--replays 2`): debugs that mention them say replays did not run because no Flow was accepted; no zero-call replay count can be built for that day.

## Commands run and observed results

- `node` over `lab-slots/spend-ledger.jsonl`: 156 lines, 78 `start` and 78 `finish`; first start 2026-09-30T18:34:38Z, last finish 2026-10-06T21:39:17Z.
- `find` for `run.json` under the fxwork test-runs and this checkout: 29 run folders (28 in t262/t274/t275, 1 in `!FluxIQWebExtension/test-runs`). `lab-runs/` holds 55 more Lab copies (10-02 on).
- `node` join of ledger rows with `evaluation.json`, `snapshots/live-llm.json`, `snapshots/flow-lane.json` (scratch `numbers.js`, `agg.js`, `final.json` in my scratchpad): totals as in the tables above (ledger $6.3600, corrected $7.5835, 3,052 calls over 74 known).
- Decoding run-id timestamps (base-36 ms) over `debugs/`: 175 run debugs, by day 09-29 5, 09-30 98, 10-01 17, 10-02 12, 10-03 15, 10-04 15, 10-06 9.
- `grep` of `archive/ledger-2026-09-28-to-30.md` lines 51-60 for the incident figures; `grep` of debug headers for cost and calls.
- `find` for `replay-mu*`: none on disk; ids from docs: two in the window (`mvp-live-continuation-2026-10-03/reports/a8-provider-free-reuse.md`).

## Not verified

- The archived ledger's $9.46 / 112 / 47-after-11:00Z figures (folders gone).
- Debug-header costs used for the 22 folderless ledger runs were read, not recomputed.
- Whether every run of the window is in the ledger or a debug: a run launched outside the Lab launcher would not be.

## Open questions or contradictions found

- The Current State says "no lane passes yet" and that A8 `run-mutepu6b` is the last passing complex run; the Lab also passed `run-murwd8le`, `run-musp8nz1`, `run-mut4fvkm` (10-03/04) and `run-mux6n7m4` (10-06 21:20, after the Current State was written). Whether the first three count as real passes is a judgement for the causes reports.
- The ledger's `totalEstimatedCostUsd` was $0 for failed chat builds until 10-02; any spend report built on the ledger alone understates 10-01 by $1.22.

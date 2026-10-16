# Cost gap: run evidence (frozen pair 8)

Brief: cost-gap-run-evidence. Read-only analysis of the 19 pair-8 Lab run records. Every number comes from
`<run>/steps/NNNN-*/meta.json` (`usage`, `costUsd`, `role`, `briefId`, `kind`, `taskKind`, `part`), the
`project.*` tool steps' `call.json`/`result.json`, and `<run>/entry.json` (`costUsd`, `verdict`).
`<run>` = `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-16/<id>` or `.../2026-10-15/<id>` for the four `mvam*` runs.
Step-level costs summed per run equal `entry.json` `costUsd` exactly in all 19 runs, so the step logs account for
every billed call. Scratch scripts: `%TEMP%/claude/.../scratchpad/costgap/{common,agg,final,fate,gap,decomp}.py`.

## Outcome

Done. The gap is not a per-call price problem: the decisions that build the kept subflows cost about the same per
decision in both modes, and in total the kept builders were cheaper in `project` (-$0.069). The gap is
**$0.371 across the nine paired runs** ($0.977 `project` against $0.606 `candidate`). Three drivers account for it:

1. **Briefs whose work was thrown away: +$0.248, 161 calls** (67% of the gap). These are blocked briefs, plus done
   proposals that a later `project.amend_plan` dropped ("its inputs or outputs changed", "its parts changed").
   This happened in 6 of 9 paired project runs. Every re-dispatched brief explored again pages an earlier brief had
   already seen.
2. **Subflow-trial judging: +$0.171, 59 calls** on kept briefs. It is offset by $0.082 (25 calls) fewer whole-run
   judge calls, so the net cost is +$0.089. Another $0.036 (17 calls) of judging belongs to discarded briefs and is
   counted in driver 1.
3. **Project supervisor: +$0.085, 83 calls**, which `candidate` does not have.

Remainder: repair briefs +$0.032 (23 calls) and playback judge -$0.014. The gap is concentrated in the tasks
where a plan with two subflows was rebuilt as one: crossborder (+$0.165 over two rounds), bigbox cart (+$0.114) and
social (+$0.116). Everything-store (-$0.022) and towels round 1 (-$0.000) are at parity or cheaper.

**Contradiction with the brief's framing.** Crossborder is not a one-part task in the record. The instruction has two
asks: "put three … in my cart" and "Collect that store's coupon while you are on the item" (step 0001 `decision.json`).
Both rounds planned two parts and two subflows. What turned out to be true is that the task is **one subflow with
two parts**, which is how both rounds ended (amend @99 in round 1 and @65 in round 2 merged p1 and p2 into one subflow).

## Per-run table

Rounds are by start time within each mode and task. Each pair started within one minute of each other, so the two
runs of a pair ran at the same price rate. Compare only within a pair. "Builder decisions" counts builder and repair
`decide` steps (for `candidate`, the single loop).

| Run | Start (UTC) | Mode | Task | Rnd | Verdict | Billed $ | Calls | Prompt tok | Cached tok | Output tok | Builder dec | Briefs | Plan parts |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| run-mvam0fjm-865b62a5 | 10-16 06:51 | candidate | bigbox cart | 1 | passed | 0.0725 | 38 | 1072371 | 879744 | 7846 | 30 | - | - |
| run-mvam03o1-4c0cb59d | 10-16 06:51 | project | bigbox cart | 1 | passed | 0.1139 | 75 | 1593700 | 1286784 | 11735 | 58 | 4 | 2 |
| run-mvans9ny-2d1b5872 | 10-16 07:41 | candidate | bigbox cart | 2 | passed | 0.0650 | 35 | 928464 | 750720 | 6016 | 29 | - | - |
| run-mvanrgho-fbff7480 | 10-16 07:40 | project | bigbox cart | 2 | passed | 0.1373 | 81 | 1632679 | 1257728 | 14413 | 60 | 6 | 4 |
| run-mvam0lys-2d3eb090 | 10-16 06:51 | candidate | bigbox towels | 1 | failed | 0.1251 | 49 | 2178104 | 1875584 | 19237 | 33 | - | - |
| run-mvam0jmn-34fba558 | 10-16 06:51 | project | bigbox towels | 1 | passed | 0.1247 | 65 | 1590349 | 1282685 | 20621 | 34 | 2 | 1 |
| run-mvaowndm-a500c971 | 10-16 08:12 | project | bigbox towels | 2 | passed | 0.1059 | 59 | 1375765 | 1118976 | 18487 | 29 | 2 | 3 |
| run-mvan7ww9-93e9ab0f | 10-16 07:25 | candidate | crossborder | 1 | passed | 0.0284 | 18 | 356368 | 277504 | 2595 | 14 | - | - |
| run-mvan7giv-4246aafb | 10-16 07:25 | project | crossborder | 1 | passed | 0.1416 | 93 | 1973697 | 1606016 | 18016 | 68 | 5 | 2 |
| run-mvaoxwx4-2df39b11 | 10-16 08:13 | candidate | crossborder | 2 | passed | 0.0293 | 18 | 357588 | 276096 | 2674 | 14 | - | - |
| run-mvaox0pl-9d52acc6 | 10-16 08:12 | project | crossborder | 2 | passed | 0.0808 | 56 | 1068341 | 851963 | 8970 | 39 | 3 | 2 |
| run-mvanatu1-20a8ffa9 | 10-16 07:27 | candidate | everything-store | 1 | passed | 0.0819 | 26 | 899958 | 675072 | 8692 | 16 | - | - |
| run-mvan8t1d-0e8a776f | 10-16 07:26 | project | everything-store | 1 | passed | 0.0813 | 31 | 851397 | 639104 | 11445 | 14 | 1 | 2 |
| run-mvapchuw-451b8cfb | 10-16 08:24 | candidate | everything-store | 2 | passed | 0.1266 | 35 | 1512532 | 1160317 | 11643 | 24 | - | - |
| run-mvapbzno-3264c80f | 10-16 08:24 | project | everything-store | 2 | passed | 0.1050 | 35 | 1104167 | 816128 | 11410 | 18 | 1 | 1 |
| run-mvanqgrc-513be545 | 10-16 07:39 | candidate | social | 1 | passed | 0.0415 | 30 | 605264 | 505600 | 7148 | 21 | - | - |
| run-mvanpwb8-b2dbd217 | 10-16 07:39 | project | social | 1 | passed | 0.0840 | 62 | 1117482 | 911872 | 14031 | 35 | 4 | 2 |
| run-mvapdyn2-a19374da | 10-16 08:26 | candidate | social | 2 | passed | 0.0355 | 28 | 594930 | 505088 | 4634 | 24 | - | - |
| run-mvapd33q-06afdebe | 10-16 08:25 | project | social | 2 | passed | 0.1088 | 78 | 1539883 | 1279488 | 19139 | 46 | 4 | 2 |

Means: `project` $1.0833/10 = $0.108; `candidate` $0.6058/9 = $0.067. These match the A8 figures in Current State.
The four `mvam*` runs sit under the `2026-10-15` folder, but `run.json` `startedAt` is 2026-10-16 06:51 UTC.

## Role attribution (how the steps were classified)

- `chat`: `kind=chat`, `taskKind=panel_command` (the extension chat turning the typed request into a command).
- Project supervisor: `kind=decide`, `role=supervisor`. Its decisions are split by `decision.json` `toolId`: "plan"
  covers every supervisor decision before the first `project.dispatch` tool step, the first dispatch decision
  included. After that come "dispatch" (`project.dispatch`), "amend" (`project.amend_plan`), and "review" (assemble,
  `core.test_candidate`, `web.find_on_page` checks, complete).
- Builder brief N or repair brief N: `kind=decide`, `role=builder|repair`, `briefId`.
- Subflow-trial judge: `kind=judge` with a `briefId` (it follows `core.test_subflow`).
- Whole-run judge: `kind=judge`, `role=supervisor` (project) or no role (candidate), `part=creation`, following
  `core.test_candidate`. In `candidate` these are its only trials.
- Playback judge: `kind=judge`, `part=null`, after the Lab's replay (`web.dom.*`).
- `candidate` decisions have `role=null`. All of them form the single build loop.

## Per-role cost, project vs candidate, per task (both rounds summed)

Format: calls / $. "Discarded" = blocked briefs plus done proposals later dropped by an amend (list below).
`project` towels counts round 1 only (`candidate` towels round 2 was skipped), so every row is like for like.

| Task | Mode | Supervisor | Kept builder dec | Discarded brief dec | Discarded brief judges | Repair dec | Subflow-trial judge (kept) | Whole-run judge | Playback judge | Chat | Total $ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| crossborder | project | 21 / 0.0194 | 45 / 0.0656 | 62 / 0.0917 | 9 / 0.0194 | 0 | 4 / 0.0087 | 4 / 0.0085 | 2 / 0.0087 | 2 / 0.0003 | 0.2224 |
| crossborder | candidate | - | 28 / 0.0443 | - | - | - | - | 4 / 0.0065 | 2 / 0.0067 | 2 / 0.0003 | 0.0577 |
| bigbox cart | project | 14 / 0.0167 | 64 / 0.0909 | 54 / 0.0856 | 6 / 0.0120 | 0 | 10 / 0.0266 | 4 / 0.0139 | 2 / 0.0051 | 2 / 0.0004 | 0.2512 |
| bigbox cart | candidate | - | 59 / 0.0914 | - | - | - | - | 10 / 0.0329 | 2 / 0.0129 | 2 / 0.0004 | 0.1375 |
| social | project | 27 / 0.0238 | 43 / 0.0462 | 28 / 0.0351 | 2 / 0.0042 | 10 / 0.0112 | 19 / 0.0454 | 6 / 0.0181 | 3 / 0.0082 | 2 / 0.0005 | 0.1928 |
| social | candidate | - | 45 / 0.0540 | - | - | - | - | 7 / 0.0120 | 4 / 0.0106 | 2 / 0.0005 | 0.0771 |
| everything-store | project | 11 / 0.0138 | 32 / 0.0821 | 0 | 0 | 0 | 13 / 0.0526 | 6 / 0.0256 | 2 / 0.0114 | 2 / 0.0006 | 0.1863 |
| everything-store | candidate | - | 40 / 0.1109 | - | - | - | - | 15 / 0.0751 | 4 / 0.0219 | 2 / 0.0006 | 0.2085 |
| bigbox towels (r1) | project | 10 / 0.0115 | 21 / 0.0324 | 0 | 0 | 13 / 0.0209 | 13 / 0.0373 | 6 / 0.0176 | 1 / 0.0047 | 1 / 0.0003 | 0.1247 |
| bigbox towels (r1) | candidate | - | 33 / 0.0855 | - | - | - | - | 15 / 0.0393 | 0 | 1 / 0.0003 | 0.1251 |

Towels round 2 (`project` only, run-mvaowndm): supervisor 11 / 0.0126, builder 20 / 0.0357, repair 9 / 0.0136,
subflow-trial judge 10 / 0.0261, whole-run judge 7 / 0.0145, playback 1 / 0.0031, chat 1 / 0.0003.

Supervisor split per project run (calls / $):

| Run | Plan (+1st dispatch) | Dispatch | Amend | Review / assemble / test |
|---|---|---|---|---|
| crossborder r1 mvan7giv | 3 / 0.0035 | 3 / 0.0036 | 2 / 0.0018 | 5 / 0.0023 |
| crossborder r2 mvaox0pl | 2 / 0.0031 | 2 / 0.0030 | 1 / 0.0008 | 3 / 0.0013 |
| bigbox cart r1 mvam03o1 | 2 / 0.0031 | 1 / 0.0005 | 1 / 0.0031 | 3 / 0.0015 |
| bigbox cart r2 mvanrgho | 2 / 0.0033 | 1 / 0.0005 | 1 / 0.0033 | 3 / 0.0016 |
| social r1 mvanpwb8 | 7 / 0.0078 | 4 / 0.0030 | 0 | 3 / 0.0014 |
| social r2 mvapd33q | 5 / 0.0060 | 2 / 0.0017 | 1 / 0.0009 | 5 / 0.0030 |
| everything-store r1 mvan8t1d | 2 / 0.0031 | 0 | 0 | 3 / 0.0036 |
| everything-store r2 mvapbzno | 3 / 0.0034 | 0 | 0 | 3 / 0.0037 |
| towels r1 mvam0jmn | 3 / 0.0039 | 1 / 0.0014 | 0 | 6 / 0.0062 |
| towels r2 mvaowndm | 4 / 0.0046 | 1 / 0.0017 | 0 | 6 / 0.0063 |

The full per-run, per-bucket table with prompt, cached and output tokens is in the appendix.

## Gap decomposition (9 paired runs)

| Driver | Project calls | Project $ | Candidate calls | Candidate $ | Delta $ | Delta calls |
|---|---|---|---|---|---|---|
| Discarded brief decisions | 144 | 0.2124 | 0 | 0 | +0.2124 | +144 |
| Discarded brief judges | 17 | 0.0356 | 0 | 0 | +0.0356 | +17 |
| Subflow-trial judge (kept briefs) | 59 | 0.1707 | 0 | 0 | +0.1707 | +59 |
| Supervisor | 83 | 0.0853 | 0 | 0 | +0.0853 | +83 |
| Repair brief decisions | 23 | 0.0321 | 0 | 0 | +0.0321 | +23 |
| Kept builder decisions | 205 | 0.3174 | 205 | 0.3862 | -0.0688 | 0 |
| Whole-run judge | 26 | 0.0838 | 51 | 0.1657 | -0.0819 | -25 |
| Playback judge | 10 | 0.0381 | 12 | 0.0521 | -0.0140 | -2 |
| Chat | 9 | 0.0020 | 9 | 0.0020 | 0 | 0 |
| **Total** | 576 | 0.9773 | 286 | 0.6060 | **+0.3713** | +290 |

### Top three drivers

1. **Discarded briefs: +$0.248, 161 calls.** By run: crossborder r1 $0.0725 / 42 calls (4 of 5 briefs);
   bigbox cart r2 $0.0533 / 33 (3 of 6); bigbox cart r1 $0.0442 / 27 (2 of 4); crossborder r2 $0.0386 / 29 (2 of 3);
   social r2 $0.0288 / 22 (2 of 4); social r1 $0.0105 / 8 (1 of 4). The figures are `spentUsd` and `calls` from the
   `project.dispatch` `result.json` `returns`, which equal the brief's decision plus judge step costs. Two general
   mechanisms, each seen more than once:
   - **A plan hand-off value that no step reads.** The supervisor's plan gives a downstream subflow an input
     (`itemPage`, `storeName`). The builder cannot read it, `core.submit_subflow` answers `subflow.input_unread`
     three times, and the loop guard ends the brief blocked. The supervisor's amend then removes the
     input and output, and Core drops the upstream subflow's *done* proposal with "its inputs or outputs changed",
     so that subflow is rebuilt from the entry page. Runs: crossborder r1 (amend @55), bigbox cart r1 (amend @61,
     "declared input storeName that no step of it reads"), bigbox cart r2 (amend @71, same).
   - **An earlier builder does a later part's lasting act during exploration.** The later brief finds nothing
     left to do and ends blocked. The supervisor then merges both parts into one subflow, which drops the
     earlier done proposal ("its role changed; its parts changed"), and a third brief rebuilds the whole thing from the
     entry page. Runs: crossborder r1 (amend @99), crossborder r2 (amend @65, "The add_to_cart builder already
     collected the store coupon"), social r2 (amend @56, "the confirm_requests subflow already read the accepted
     requests").
   - Social r1 instead lost brief-2 to an `evidence_repeat_without_progress` loop on list detection. Two dispatches
     were then refused (`project.failing_receipt_unknown` @69, `project.brief_repeated` @71) before brief-3.
   Re-exploration: every re-dispatched build brief explored only pages earlier briefs had already reached. Its
   exploration paths (`result.json` `location` before its first submit) were all paths an earlier brief had
   visited: crossborder r1 brief-3 11 decisions ($0.0199) and brief-5 14 ($0.0209); crossborder r2 brief-3 10
   ($0.0186); bigbox cart r1 brief-3 5 ($0.0074) and brief-4 22 ($0.0283); bigbox cart r2 briefs 4-6 7, 10 and 5
   ($0.0383); social r2 brief-3 8 ($0.0092). No brief is handed the earlier brief's evidence. Each rebuilt
   start subflow begins again with `web.output.browser-navigate` to the entry URL.
2. **Subflow-trial judging: +$0.171, 59 calls on kept briefs, net +$0.089 after whole-run savings.** Each
   `core.test_subflow` is judged by `loop_verification` calls at about $0.0029 a call
   (0.1707/59). The whole-run judge still runs afterwards (26 calls, $0.0838), so most project trials are judged
   twice, once per subflow and once whole. Everything-store shows it plainly: kept builders cost $0.0288 less than
   `candidate`, but the subflow-trial judges add $0.0526.
3. **Project supervisor: +$0.085, 83 calls**, about $0.0095 a run. Plan and first dispatch take 2-7 calls; social r1
   spent 7 (three `project.write_plan` attempts). Amend, re-dispatch and review calls grow with every discarded
   brief: crossborder r1 had 13 supervisor calls against 5 for everything-store.

Offsets: on the kept work, `project` builders were cheaper (-$0.069), mostly towels r1 (-$0.053) and
everything-store (-$0.029). Fewer whole-run judges saved $0.082.

## Project runs: briefs, reasons, decisions, prompt growth

Fate is taken from `project.dispatch` `returns.outcome` and later `project.amend_plan` `result.json`
`proposalsDropped`. P0 and Pend are `usage.inputTokens` of the brief's first and last `decide`. "Entry nav" means the
brief's first tool step is `browser-navigate` to the entry URL. A brief without it starts on whatever page the
previous brief left.

| Run | Brief | Kind | Subflow | Dispatch reason | Outcome / fate | $ (incl. judges) | Calls | Decisions | P0 → Pend | Entry nav | Explore dec before 1st submit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| crossborder r1 | brief-1 | build | add_hub_to_cart | first dispatch | done; dropped by amend@55 | 0.0324 | 18 | 14 | 18783 → 29196 | yes | 8 |
| crossborder r1 | brief-2 | build | collect_coupon | first dispatch | blocked (input_unread x3) | 0.0074 | 5 | 5 | 17268 → 19441 | no | 2 |
| crossborder r1 | brief-3 | build | add_hub_to_cart | re-dispatch after amend | done; dropped by amend@99 | 0.0276 | 16 | 14 | 19077 → 26766 | yes | 11 (all seen) |
| crossborder r1 | brief-4 | build | collect_coupon | re-dispatch after amend | blocked (coupon already collected) | 0.0051 | 3 | 3 | 17152 → 17807 | no | 2 |
| crossborder r1 | brief-5 | build | add_hub_to_cart (p1+p2) | re-dispatch after amend | done; final | 0.0484 | 34 | 32 | 19046 → 34105 | yes | 14 (all seen) |
| crossborder r2 | brief-1 | build | add_to_cart | first | done; dropped by amend@65 | 0.0310 | 21 | 18 | 19071 → 27654 | yes | 15 |
| crossborder r2 | brief-2 | build | collect_coupon | first | blocked (coupon already collected) | 0.0077 | 8 | 8 | 17145 → 19598 | no | 5 |
| crossborder r2 | brief-3 | build | add_to_cart (p1+p2) | re-dispatch after amend | done; final | 0.0260 | 15 | 13 | 19044 → 25946 | yes | 10 (all seen) |
| bigbox cart r1 | brief-1 | build | switch_store | first | done; dropped by amend@61 | 0.0156 | 10 | 8 | 17955 → 23050 | yes | 5 |
| bigbox cart r1 | brief-2 | build | add_items | first | blocked (input_unread) | 0.0286 | 17 | 17 | 17863 → 28921 | no | 14 |
| bigbox cart r1 | brief-3 | build | switch_store | re-dispatch after amend | done; final | 0.0138 | 10 | 8 | 18037 → 23109 | yes | 5 (all seen) |
| bigbox cart r1 | brief-4 | build | add_items | re-dispatch after amend | done; final | 0.0387 | 27 | 25 | 17855 → 32340 | no | 22 (4 of 5 paths seen) |
| bigbox cart r2 | brief-1 | build | switch_store | first | done; dropped by amend@71 | 0.0208 | 14 | 12 | 17944 → 26240 | yes | 9 |
| bigbox cart r2 | brief-2 | build | add_paper_towels | first | blocked (input_unread) | 0.0132 | 7 | 7 | 17889 → 23797 | no | 4 |
| bigbox cart r2 | brief-3 | build | add_napkins | first | done; dropped by amend@71 | 0.0194 | 12 | 10 | 17884 → 25017 | no | 5 |
| bigbox cart r2 | brief-4 | build | switch_store | re-dispatch after amend | done; final | 0.0189 | 12 | 10 | 17968 → 24010 | yes | 7 (all seen) |
| bigbox cart r2 | brief-5 | build | add_paper_towels | re-dispatch after amend | done; final | 0.0278 | 15 | 13 | 17841 → 27424 | no | 10 (all seen) |
| bigbox cart r2 | brief-6 | build | add_napkins | re-dispatch after amend | done; final | 0.0183 | 10 | 8 | 17847 → 24306 | no | 5 (all seen) |
| social r1 | brief-1 | build | confirm_requests | first | done; final | 0.0247 | 19 | 15 | 18115 → 26919 | yes | 11 |
| social r1 | brief-2 | build | read_accepted | first | blocked (repeat without progress) | 0.0105 | 8 | 8 | 16345 → 21875 | no | 8 |
| social r1 | brief-3 | build | read_accepted | re-dispatch after blocked (recordingExcerpt added) | done; then repaired | 0.0130 | 8 | 6 | 16345 → 23530 | no | 3 |
| social r1 | brief-4 | repair | read_accepted | repair: whole run hit the site's slow-down notice | done; final | 0.0126 | 8 | 6 | 18793 → 23644 | no | 2 |
| social r2 | brief-1 | build | confirm_requests | first | done; subflow removed by amend@56 | 0.0222 | 18 | 16 | 18127 → 27028 | yes | 13 |
| social r2 | brief-2 | build | read_accepted | first | blocked (already read by brief-1) | 0.0066 | 4 | 4 | 16357 → 20723 | no | 3 |
| social r2 | brief-3 | build | confirm_and_read (p1+p2) | first (new key after merge) | done; then repaired | 0.0396 | 30 | 22 | 18177 → 36904 | yes | 8 (all seen) |
| social r2 | brief-4 | repair | confirm_and_read | repair: slow-down notice not handled | done; final | 0.0128 | 7 | 4 | 21698 → 23852 | yes | 1 |
| everything-store r1 | brief-1 | build | find_earbuds (p1+p2) | first | done; final | 0.0555 | 21 | 14 | 16289 → 43778 | yes | 6 |
| everything-store r2 | brief-1 | build | find_earbuds | first | done; final | 0.0792 | 24 | 18 | 16285 → 54064 | yes | 12 |
| towels r1 | brief-1 | build | find_paper_towels | first | done; then repaired | 0.0544 | 29 | 21 | 18098 → 40897 | yes | 8 |
| towels r1 | brief-2 | repair | find_paper_towels | repair: whole-run judge no (seller field from wrong text) | done; final | 0.0362 | 18 | 13 | 20075 → 36900 | yes | 6 |
| towels r2 | brief-1 | build | find_paper_towels (p1-p3) | first | done; then repaired | 0.0557 | 28 | 20 | 18181 → 42436 | yes | 10 |
| towels r2 | brief-2 | repair | find_paper_towels | repair: whole-run judge no (where-conditions drop rows) | done; final | 0.0198 | 11 | 9 | 20578 → 31276 | yes | 6 |

Prompt size per decision is similar across modes. Briefs start at about 16-19k input tokens and grow to 23-34k,
or 40-54k on list-reading tasks. `candidate` crossborder averaged 22.6k per decision (316522/14) and `project`
brief-1 23.4k (328230/14). The gap comes from the number of calls, not their size.

## Crossborder round 1 (run-mvan7giv-4246aafb): why five briefs and 68 builder decisions

Request (step 0001): cart three hubs (Space Grey, 7-in-1, ships from Spain) **and** "Collect that store's coupon
while you are on the item". Builder decisions: 14 + 5 + 14 + 3 + 32 = 68. Candidate run-mvan7ww9: 14 decisions,
$0.0284.

1. **Plan, supervisor (steps 0003-0007).** One `web.find_on_page`, then `project.write_plan`. The decision summary
   says "one subflow to find the Voltbay hub item, choose … add three to cart and collect the store coupon", but
   the plan written (0006 `call.json`) has **two parts and two subflows**: `add_hub_to_cart` (p1, output `itemPage`)
   and `collect_coupon` (p2, input `itemPage`, after `add_hub_to_cart`). The supervisor described one subflow and
   wrote two.
2. **brief-1, first dispatch (0008).** Builder explores from the entry page. At decision 0024 it says "now I collect
   the store coupon before adding three to the cart" and **collects the coupon, which is p2's lasting act, during
   exploration**. Its first submit is refused `subflow.output_unbound` (0027: must hand back `itemPage`). Its
   revision 1 trial is judged no because "Step s9 collected the store coupon … which is the out-of-scope part p2"
   (0032 judge). It resubmits "without the out-of-scope coupon step" (0034), and revision 2 passes. Outcome done,
   $0.0324, 18 calls. The coupon stays collected on the site.
3. **brief-2, decided by the supervisor (0041: "Sending the collect_coupon brief now that add_hub_to_cart is
   done").** The builder finds the coupon already collected (0048: "The coupon is already collected on the item
   page"). It submits three times, and each is refused `subflow.input_unread` for `itemPage` (0053). The loop guard
   ends the brief blocked (`flow_bootstrap.evidence_repeat_without_progress`). $0.0074, 5 calls.
4. **Amend @55, decided by the supervisor (0054: "I amend the plan so collect_coupon takes no inputs").** Core's
   amend result **drops brief-1's done proposal**: `proposalsDropped: add_hub_to_cart — its inputs or outputs
   changed; its parts changed` (0055 `result.json`). The supervisor re-dispatches both (0056: "add_hub_to_cart's
   proposal was dropped and must be rebuilt too").
5. **brief-3 (rebuild of add_hub_to_cart).** It navigates to the entry page again and repeats the search, item,
   consent, option and coupon exploration (11 exploration decisions on pages brief-1 had already seen). Its script
   opens the item by URL, includes "collect the store coupon" although its parts are p1 only, and passes on the first
   trial. $0.0276, 16 calls.
6. **brief-4 (collect_coupon again).** The coupon is "already collected", and after 3 decisions the builder ends the
   brief blocked: "nothing of the collect_coupon brief is left to do". $0.0051.
7. **Supervisor review.** `project.assemble` is refused (0095 `project.assemble_proposal_missing` for
   `collect_coupon`). The supervisor checks the page (0096) and amends @99: "Coupon already collected on the item
   page, so I amend the plan to drop the coupon subflow and keep only the cart subflow". This merges p1 and p2 into
   `add_hub_to_cart`. Core again **drops the done proposal** (brief-3's): "its role changed; its inputs or outputs
   changed; its parts changed" (0099).
8. **brief-5 (third rebuild, both parts).** It again starts at the entry page and spends 14 exploration decisions
   on pages already seen. It then loses **15 decisions (steps 0133-0161)** because its first submit (0132) is
   refused `web.handle.unidentifiable` for `t672`. That handle is the wordless item-image link it had clicked in
   exploration (0112). Three resubmits keep `t672`, and the fourth switches to the titled link `t675` (0161).
   Revision 4 passes. $0.0484, 34 calls. brief-3 never hit this because its script navigated to the item URL
   directly.
9. Assemble, one whole-run judge pass and complete: 0168-0174, $0.0043 judge.

Which component decided each new brief: the **supervisor** chose every dispatch and amend. **Core's amend
rule** turned both amends into rebuilds by dropping the upstream done proposal whenever the subflow's
inputs/outputs, parts or role changed. Core's **scope check and trial judge** pushed brief-1 to strip the coupon
step after it had already collected the coupon live, so the later coupon briefs found nothing to do. The site
state was not reset between briefs, so the coupon stayed collected.

The waste in this run was briefs 1-4 ($0.0725, 42 calls) plus 15 handle-correction decisions inside brief-5. If the
one final brief had run alone, the build would have cost about the same as `candidate`: brief-5 minus the
handle loop is about 17 decisions against `candidate`'s 14.

## Commands run and observed results

- `python -I scratchpad/costgap/agg.py`: 19 runs parsed. The summed step `costUsd` equals `entry.json` `costUsd`
  for every run (for example mvan7giv entry $0.1416, steps $0.1416).
- `python -I .../survey2.py`: attribution keys observed. `candidate` decide has `role=None`. `project` decide has
  `role` supervisor (94), builder (369) or repair (32). Judge steps are classed by `briefId`, `role` and `part` as
  above.
- `python -I .../fate.py`, `gap.py`, `decomp.py`: produced the brief, re-exploration and decomposition tables
  above. Decomposition totals: project9 $0.9773, candidate9 $0.6060, gap $0.3713.

## Not verified

- The "explore decisions before first submit" and "paths seen by earlier briefs" figures compare URL paths only, not
  individual controls. The "all seen" verdict for crossborder, bigbox and social rebuilds was spot-checked against
  decision summaries for crossborder r1 only.
- I did not check why `t672` was accepted for a live click but refused at submit. That is Core fingerprint and
  identifiability behaviour.
- I did not check whether the cart already held the hubs when brief-3 and brief-5 ran (no site reset between
  briefs). I assumed that only the coupon state mattered.
- Price rates were not re-derived. The comparison relies on each pair running at the same time (start times above).

## Open questions or contradictions found

- Crossborder is two parts in one subflow, not a one-part task. The fix target is better described as "a plan
  whose parts share one page visit gets one subflow" (or "never drop a done proposal when only its outputs shrink"),
  rather than a one-brief path for a one-part plan. Everything-store and towels were already one brief and were at
  parity with `candidate`.
- The crossborder r1 supervisor's plan decision text ("one subflow") contradicts the plan it wrote (two subflows).
- brief-3's script included the coupon step even though it carried only p1. The scope check accepted it then,
  although brief-1's trial judge had called the same step out of scope.

## Appendix: per-run, per-bucket calls, cost and tokens

Source: each run's `steps/*/meta.json` (`usage.inputTokens`, `usage.cacheHitInputTokens`, `usage.outputTokens`,
`costUsd`), bucketed as in "Role attribution".

| Run | Role bucket | Calls | $ | Prompt | Cached | Output |
|---|---|---|---|---|---|---|
| mvam0fjm (cand bigbox cart r1) | chat | 1 | 0.0002 | 2101 | 1920 | 94 |
| mvam0fjm (cand bigbox cart r1) | builder (single loop) | 30 | 0.0468 | 905949 | 785024 | 4818 |
| mvam0fjm (cand bigbox cart r1) | whole-run judge (test_candidate) | 6 | 0.0191 | 140244 | 88320 | 2525 |
| mvam0fjm (cand bigbox cart r1) | playback judge | 1 | 0.0064 | 24077 | 4480 | 409 |
| mvam03o1 (proj bigbox cart r1) | chat | 1 | 0.0002 | 2101 | 1920 | 94 |
| mvam03o1 (proj bigbox cart r1) | supervisor: plan | 2 | 0.0031 | 20552 | 13056 | 621 |
| mvam03o1 (proj bigbox cart r1) | builder brief-1 | 8 | 0.0120 | 165561 | 131584 | 883 |
| mvam03o1 (proj bigbox cart r1) | subflow-trial judge | 6 | 0.0133 | 96624 | 60672 | 1827 |
| mvam03o1 (proj bigbox cart r1) | builder brief-2 | 17 | 0.0286 | 408395 | 331136 | 2853 |
| mvam03o1 (proj bigbox cart r1) | supervisor: amend | 1 | 0.0031 | 11232 | 3200 | 525 |
| mvam03o1 (proj bigbox cart r1) | supervisor: dispatch | 1 | 0.0005 | 11615 | 10880 | 139 |
| mvam03o1 (proj bigbox cart r1) | builder brief-3 | 8 | 0.0104 | 166200 | 137856 | 868 |
| mvam03o1 (proj bigbox cart r1) | builder brief-4 | 25 | 0.0324 | 617562 | 530944 | 2696 |
| mvam03o1 (proj bigbox cart r1) | supervisor: review/assemble/other | 3 | 0.0015 | 38182 | 35072 | 264 |
| mvam03o1 (proj bigbox cart r1) | whole-run judge (test_candidate) | 2 | 0.0064 | 44022 | 25984 | 674 |
| mvam03o1 (proj bigbox cart r1) | playback judge | 1 | 0.0025 | 11654 | 4480 | 291 |
| mvans9ny (cand bigbox cart r2) | chat | 1 | 0.0002 | 2101 | 1920 | 94 |
| mvans9ny (cand bigbox cart r2) | builder (single loop) | 29 | 0.0446 | 803954 | 684160 | 3812 |
| mvans9ny (cand bigbox cart r2) | whole-run judge (test_candidate) | 4 | 0.0137 | 98060 | 60160 | 1674 |
| mvans9ny (cand bigbox cart r2) | playback judge | 1 | 0.0065 | 24349 | 4480 | 436 |
| mvanrgho (proj bigbox cart r2) | chat | 1 | 0.0002 | 2101 | 1920 | 94 |
| mvanrgho (proj bigbox cart r2) | supervisor: plan | 2 | 0.0033 | 20570 | 13056 | 800 |
| mvanrgho (proj bigbox cart r2) | builder brief-1 | 12 | 0.0172 | 265689 | 217344 | 1200 |
| mvanrgho (proj bigbox cart r2) | subflow-trial judge | 10 | 0.0252 | 177874 | 109056 | 3280 |
| mvanrgho (proj bigbox cart r2) | builder brief-2 | 7 | 0.0132 | 147850 | 112256 | 1505 |
| mvanrgho (proj bigbox cart r2) | builder brief-3 | 10 | 0.0145 | 214562 | 176512 | 1723 |
| mvanrgho (proj bigbox cart r2) | supervisor: amend | 1 | 0.0033 | 11509 | 3200 | 663 |
| mvanrgho (proj bigbox cart r2) | supervisor: dispatch | 1 | 0.0005 | 11874 | 11136 | 191 |
| mvanrgho (proj bigbox cart r2) | builder brief-4 | 10 | 0.0141 | 210580 | 171264 | 1055 |
| mvanrgho (proj bigbox cart r2) | builder brief-5 | 13 | 0.0212 | 299186 | 239488 | 1563 |
| mvanrgho (proj bigbox cart r2) | builder brief-6 | 8 | 0.0128 | 168671 | 132352 | 952 |
| mvanrgho (proj bigbox cart r2) | supervisor: review/assemble/other | 3 | 0.0016 | 39816 | 36352 | 255 |
| mvanrgho (proj bigbox cart r2) | whole-run judge (test_candidate) | 2 | 0.0076 | 50622 | 29312 | 820 |
| mvanrgho (proj bigbox cart r2) | playback judge | 1 | 0.0026 | 11775 | 4480 | 312 |
| mvam0lys (cand bigbox towels r1) | chat | 1 | 0.0003 | 2173 | 1920 | 166 |
| mvam0lys (cand bigbox towels r1) | builder (single loop) | 33 | 0.0855 | 1831869 | 1617920 | 9697 |
| mvam0lys (cand bigbox towels r1) | whole-run judge (test_candidate) | 15 | 0.0393 | 344062 | 255744 | 9374 |
| mvam0jmn (proj bigbox towels r1) | chat | 1 | 0.0003 | 2173 | 1920 | 166 |
| mvam0jmn (proj bigbox towels r1) | supervisor: plan | 3 | 0.0039 | 31457 | 23040 | 1044 |
| mvam0jmn (proj bigbox towels r1) | builder brief-1 | 21 | 0.0324 | 628509 | 545920 | 3663 |
| mvam0jmn (proj bigbox towels r1) | subflow-trial judge | 13 | 0.0373 | 298069 | 211581 | 8437 |
| mvam0jmn (proj bigbox towels r1) | supervisor: review/assemble/other | 6 | 0.0062 | 93329 | 76544 | 555 |
| mvam0jmn (proj bigbox towels r1) | whole-run judge (test_candidate) | 6 | 0.0176 | 127284 | 84480 | 3581 |
| mvam0jmn (proj bigbox towels r1) | supervisor: dispatch | 1 | 0.0014 | 14530 | 11136 | 266 |
| mvam0jmn (proj bigbox towels r1) | repair brief-2 | 13 | 0.0209 | 377049 | 323456 | 2390 |
| mvam0jmn (proj bigbox towels r1) | playback judge | 1 | 0.0047 | 17949 | 4608 | 519 |
| mvaowndm (proj bigbox towels r2) | chat | 1 | 0.0003 | 2173 | 1920 | 166 |
| mvaowndm (proj bigbox towels r2) | supervisor: plan | 4 | 0.0046 | 44239 | 34560 | 1254 |
| mvaowndm (proj bigbox towels r2) | builder brief-1 | 20 | 0.0357 | 589741 | 498176 | 4405 |
| mvaowndm (proj bigbox towels r2) | subflow-trial judge | 10 | 0.0261 | 217552 | 156032 | 5604 |
| mvaowndm (proj bigbox towels r2) | supervisor: review/assemble/other | 6 | 0.0063 | 97743 | 80768 | 573 |
| mvaowndm (proj bigbox towels r2) | whole-run judge (test_candidate) | 7 | 0.0145 | 148949 | 118272 | 3820 |
| mvaowndm (proj bigbox towels r2) | supervisor: dispatch | 1 | 0.0017 | 17848 | 13696 | 303 |
| mvaowndm (proj bigbox towels r2) | repair brief-2 | 9 | 0.0136 | 244988 | 211072 | 1830 |
| mvaowndm (proj bigbox towels r2) | playback judge | 1 | 0.0031 | 12532 | 4480 | 532 |
| mvan7ww9 (cand crossborder r1) | chat | 1 | 0.0001 | 2078 | 1920 | 71 |
| mvan7ww9 (cand crossborder r1) | builder (single loop) | 14 | 0.0218 | 316522 | 255232 | 1552 |
| mvan7ww9 (cand crossborder r1) | whole-run judge (test_candidate) | 2 | 0.0032 | 23592 | 15872 | 632 |
| mvan7ww9 (cand crossborder r1) | playback judge | 1 | 0.0033 | 14176 | 4480 | 340 |
| mvan7giv (proj crossborder r1) | chat | 1 | 0.0001 | 2078 | 1920 | 71 |
| mvan7giv (proj crossborder r1) | supervisor: plan | 3 | 0.0035 | 31782 | 23552 | 714 |
| mvan7giv (proj crossborder r1) | builder brief-1 | 14 | 0.0225 | 328230 | 268416 | 2490 |
| mvan7giv (proj crossborder r1) | subflow-trial judge | 8 | 0.0188 | 130196 | 81536 | 3062 |
| mvan7giv (proj crossborder r1) | supervisor: dispatch | 3 | 0.0036 | 37063 | 27264 | 419 |
| mvan7giv (proj crossborder r1) | builder brief-2 | 5 | 0.0074 | 91894 | 71552 | 697 |
| mvan7giv (proj crossborder r1) | supervisor: amend | 2 | 0.0018 | 25060 | 23296 | 970 |
| mvan7giv (proj crossborder r1) | builder brief-3 | 14 | 0.0233 | 318261 | 252672 | 1753 |
| mvan7giv (proj crossborder r1) | builder brief-4 | 3 | 0.0051 | 52604 | 37504 | 258 |
| mvan7giv (proj crossborder r1) | supervisor: review/assemble/other | 5 | 0.0023 | 68237 | 63360 | 398 |
| mvan7giv (proj crossborder r1) | builder brief-5 | 32 | 0.0438 | 838195 | 731264 | 6150 |
| mvan7giv (proj crossborder r1) | whole-run judge (test_candidate) | 2 | 0.0043 | 30444 | 19200 | 691 |
| mvan7giv (proj crossborder r1) | playback judge | 1 | 0.0050 | 19653 | 4480 | 343 |
| mvaoxwx4 (cand crossborder r2) | chat | 1 | 0.0001 | 2078 | 1920 | 71 |
| mvaoxwx4 (cand crossborder r2) | builder (single loop) | 14 | 0.0225 | 317651 | 253824 | 1560 |
| mvaoxwx4 (cand crossborder r2) | whole-run judge (test_candidate) | 2 | 0.0033 | 23612 | 15872 | 749 |
| mvaoxwx4 (cand crossborder r2) | playback judge | 1 | 0.0033 | 14247 | 4480 | 294 |
| mvaox0pl (proj crossborder r2) | chat | 1 | 0.0001 | 2078 | 1920 | 71 |
| mvaox0pl (proj crossborder r2) | supervisor: plan | 2 | 0.0031 | 21006 | 13312 | 583 |
| mvaox0pl (proj crossborder r2) | builder brief-1 | 18 | 0.0258 | 415023 | 344192 | 2044 |
| mvaox0pl (proj crossborder r2) | subflow-trial judge | 5 | 0.0094 | 76634 | 54016 | 1885 |
| mvaox0pl (proj crossborder r2) | supervisor: dispatch | 2 | 0.0030 | 22777 | 14208 | 251 |
| mvaox0pl (proj crossborder r2) | builder brief-2 | 8 | 0.0077 | 146415 | 126720 | 839 |
| mvaox0pl (proj crossborder r2) | supervisor: amend | 1 | 0.0008 | 11388 | 10752 | 461 |
| mvaox0pl (proj crossborder r2) | builder brief-3 | 13 | 0.0218 | 291119 | 229120 | 1506 |
| mvaox0pl (proj crossborder r2) | supervisor: review/assemble/other | 3 | 0.0013 | 37071 | 34304 | 252 |
| mvaox0pl (proj crossborder r2) | whole-run judge (test_candidate) | 2 | 0.0042 | 29442 | 18939 | 755 |
| mvaox0pl (proj crossborder r2) | playback judge | 1 | 0.0037 | 15388 | 4480 | 323 |
| mvanatu1 (cand everything-store r1) | chat | 1 | 0.0004 | 2113 | 1280 | 107 |
| mvanatu1 (cand everything-store r1) | builder (single loop) | 16 | 0.0410 | 585640 | 474752 | 4057 |
| mvanatu1 (cand everything-store r1) | whole-run judge (test_candidate) | 7 | 0.0299 | 247097 | 164736 | 3537 |
| mvanatu1 (cand everything-store r1) | playback judge | 2 | 0.0106 | 65108 | 34304 | 991 |
| mvan8t1d (proj everything-store r1) | chat | 1 | 0.0004 | 2113 | 1280 | 107 |
| mvan8t1d (proj everything-store r1) | supervisor: plan | 2 | 0.0031 | 20431 | 13056 | 714 |
| mvan8t1d (proj everything-store r1) | builder brief-1 | 14 | 0.0250 | 428877 | 370816 | 4492 |
| mvan8t1d (proj everything-store r1) | subflow-trial judge | 7 | 0.0305 | 228465 | 144640 | 3749 |
| mvan8t1d (proj everything-store r1) | supervisor: review/assemble/other | 3 | 0.0036 | 35368 | 24960 | 253 |
| mvan8t1d (proj everything-store r1) | whole-run judge (test_candidate) | 3 | 0.0129 | 114941 | 79872 | 1543 |
| mvan8t1d (proj everything-store r1) | playback judge | 1 | 0.0057 | 21202 | 4480 | 587 |
| mvapchuw (cand everything-store r2) | chat | 1 | 0.0002 | 2113 | 1920 | 107 |
| mvapchuw (cand everything-store r2) | builder (single loop) | 24 | 0.0699 | 1114489 | 924928 | 6276 |
| mvapchuw (cand everything-store r2) | whole-run judge (test_candidate) | 8 | 0.0451 | 324842 | 195965 | 4423 |
| mvapchuw (cand everything-store r2) | playback judge | 2 | 0.0113 | 71088 | 37504 | 837 |
| mvapbzno (proj everything-store r2) | chat | 1 | 0.0002 | 2113 | 1920 | 107 |
| mvapbzno (proj everything-store r2) | supervisor: plan | 3 | 0.0034 | 31022 | 23040 | 725 |
| mvapbzno (proj everything-store r2) | builder brief-1 | 18 | 0.0571 | 708906 | 549120 | 4888 |
| mvapbzno (proj everything-store r2) | subflow-trial judge | 6 | 0.0221 | 190834 | 132992 | 3292 |
| mvapbzno (proj everything-store r2) | supervisor: review/assemble/other | 3 | 0.0037 | 35760 | 24960 | 272 |
| mvapbzno (proj everything-store r2) | whole-run judge (test_candidate) | 3 | 0.0128 | 114379 | 79616 | 1571 |
| mvapbzno (proj everything-store r2) | playback judge | 1 | 0.0057 | 21153 | 4480 | 555 |
| mvanqgrc (cand social r1) | chat | 1 | 0.0004 | 2091 | 1280 | 84 |
| mvanqgrc (cand social r1) | builder (single loop) | 21 | 0.0264 | 491052 | 424832 | 3337 |
| mvanqgrc (cand social r1) | whole-run judge (test_candidate) | 5 | 0.0081 | 63084 | 45952 | 2269 |
| mvanqgrc (cand social r1) | playback judge | 3 | 0.0066 | 49037 | 33536 | 1458 |
| mvanpwb8 (proj social r1) | chat | 1 | 0.0004 | 2091 | 1280 | 84 |
| mvanpwb8 (proj social r1) | supervisor: plan | 7 | 0.0078 | 68755 | 51712 | 1980 |
| mvanpwb8 (proj social r1) | builder brief-1 | 15 | 0.0156 | 313589 | 273408 | 1556 |
| mvanpwb8 (proj social r1) | subflow-trial judge | 8 | 0.0229 | 178238 | 116992 | 3200 |
| mvanpwb8 (proj social r1) | builder brief-2 | 8 | 0.0105 | 158793 | 134144 | 1898 |
| mvanpwb8 (proj social r1) | supervisor: dispatch | 4 | 0.0030 | 44956 | 39296 | 868 |
| mvanpwb8 (proj social r1) | builder brief-3 | 6 | 0.0067 | 119638 | 104064 | 1188 |
| mvanpwb8 (proj social r1) | supervisor: review/assemble/other | 3 | 0.0014 | 36441 | 33536 | 285 |
| mvanpwb8 (proj social r1) | whole-run judge (test_candidate) | 2 | 0.0076 | 49192 | 28672 | 1053 |
| mvanpwb8 (proj social r1) | repair brief-4 | 6 | 0.0052 | 124905 | 114560 | 1181 |
| mvanpwb8 (proj social r1) | playback judge | 2 | 0.0030 | 20884 | 14208 | 738 |
| mvapdyn2 (cand social r2) | chat | 1 | 0.0002 | 2091 | 1920 | 84 |
| mvapdyn2 (cand social r2) | builder (single loop) | 24 | 0.0276 | 552310 | 482176 | 3026 |
| mvapdyn2 (cand social r2) | whole-run judge (test_candidate) | 2 | 0.0038 | 24908 | 16512 | 1020 |
| mvapdyn2 (cand social r2) | playback judge | 1 | 0.0040 | 15621 | 4480 | 504 |
| mvapd33q (proj social r2) | chat | 1 | 0.0002 | 2091 | 1920 | 84 |
| mvapd33q (proj social r2) | supervisor: plan | 5 | 0.0060 | 49951 | 34176 | 864 |
| mvapd33q (proj social r2) | builder brief-1 | 16 | 0.0180 | 351688 | 306176 | 2110 |
| mvapd33q (proj social r2) | subflow-trial judge | 13 | 0.0267 | 206583 | 146944 | 6600 |
| mvapd33q (proj social r2) | builder brief-2 | 4 | 0.0066 | 74841 | 56832 | 716 |
| mvapd33q (proj social r2) | supervisor: amend | 1 | 0.0009 | 9978 | 9088 | 498 |
| mvapd33q (proj social r2) | supervisor: dispatch | 2 | 0.0017 | 23877 | 20096 | 385 |
| mvapd33q (proj social r2) | builder brief-3 | 22 | 0.0240 | 570399 | 516480 | 3906 |
| mvapd33q (proj social r2) | supervisor: review/assemble/other | 5 | 0.0030 | 68052 | 61056 | 464 |
| mvapd33q (proj social r2) | whole-run judge (test_candidate) | 4 | 0.0105 | 74234 | 48512 | 2047 |
| mvapd33q (proj social r2) | repair brief-4 | 4 | 0.0060 | 88114 | 73728 | 1004 |
| mvapd33q (proj social r2) | playback judge | 1 | 0.0053 | 20075 | 4480 | 461 |

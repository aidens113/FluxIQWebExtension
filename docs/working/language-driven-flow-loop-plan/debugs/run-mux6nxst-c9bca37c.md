# Run debug — `run-mux6nxst-c9bca37c`

t275 lane D round 3, slot 4, instance `t275-slot-4`, workspace `t275-d`: social-network-feed `confirm-requests`, built
from the extension chat on the tree synced to dev (downstream `f224b38a`, Core `e1551fa3`: lane A's loop fix, B's
keep-only answer, `web-state.v4`, t278, C's paging hint and `whereToFix`, D2-1 `strands_a_step`/`unreached`, D2-2,
t277 UI). Stage 1 is the round-3 expectations in `mvp-final-month-plan/reports/live-d.md` (written 21:18 UTC, before
the dry run and launch); not repeated here.

## Header

- Run id `run-mux6nxst-c9bca37c`; no runtime run (the Lab stopped before playback; no replay).
- Command: `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t275-slot-4 pnpm.cmd lab:campaign
  social-network-feed-confirm-requests --max-attempts 1 -- --target persistent-isolated --workspace t275-d
  --llm-cost-ceiling-usd 0.10`. Guard admitted (`sha256:1ad2cc04...`), headed, chat build, one launch.
- 2026-10-06 21:20:13-21:27:59 UTC (chat build 21:24:08-21:27:52), **off-peak**; DeepSeek `deepseek-flash`. A decision
  cost ~$0.0013 against round 2's ~$0.0030.
- Spend: **$0.060085** (chat $0.000090; build $0.059994 of the $0.10 ceiling). Calls actually sent: **49** = chat 1 +
  41 decisions + 7 judge calls. Core published 49 for the build alone; the campaign printed 57 (both wrong, cause D3-1).
- Verdict: `failed`, `performance.budget`: "the run made 49 provider call(s) against an authorized 48". **Inside Core
  the build succeeded**: judged yes (`judgedAt: judging_reserve`, round 3), outcome `proposed`, the chat said "Your
  automation ... is ready". The Lab refused it before playback.
- **Stage reached: 3** (a Flow proposed; no playback, no oracle).

## Stage 2 — exploration and repairs (141 step folders)

| # | Decided | Core said | Cost to here |
| --- | --- | --- | --- |
| 0003-0012 | decline cookies; navigate `~/friends/` (typed address) refused `address_not_shown`; dismiss notifications; click Friends; click Friend requests | ok; **the requests page is reached by clicks, so D2-1's shape never arose** | $0.008 |
| 0013-0022 | detect `t749`; close chat; detect again; read `{name, mutual}`; read again renaming the column `mutualFriends` | ok, 8 rows | $0.0145 |
| 0023 | rerun the read with `where matches "(?:^|[^0-9])(?:[5-9]|[1-9][0-9]+) mutual friend"` (a regex, not round 2's `atLeast 5`) | applied: **3 rows, Jonas ("Aisha Khan and 4 other mutual friends") dropped** | $0.016 |
| 0026-0035 | five amend decisions trying to add the Confirm press by amendment input (`add` with input, `rerun` of the listing with a click input, `repeat` on the listing) | `already_in_flow`, `over_not_before`, `not_a_kept_step`, `no_such_step`, `changes_nothing` | $0.022 |
| 0036-0039 | press Amara's Confirm live (`modify_existing`), repeat it over the listing | ok, applied | $0.026 |
| 0040-0047 | "I need a post-act read of accepted rows": repeat again, rerun the listing unchanged, keep | `already_so`, `changes_nothing` x2, `already_in_flow` | $0.032 |
| 0048 | complete, no read after the confirms | test 0049-0058 clean; judges 0059/0060 **no, no** (no post-confirm table; 0060 and later also: Jonas dropped) | $0.033 |
| r1 0061-0080 | snapshot; detect x3 (third refused `already_answered`); rerun the listing unchanged x4 (one ran, three `changes_nothing`) | round stopped on the refused-in-a-row guard (lane A fix fired: "too many attempts in a row went nowhere") | $0.044 |
| r1 test 0081-0092 | whole test clean; judges **no, no** | | $0.045 |
| r2 0093-0115 | detect; snapshot x2 (second `already_answered`); rerun the where with `|and [4-9] other mutual friend` and again broader (both applied: **4 rows, Jonas kept**); reorder/repeat fix; one live read of all 8 rows (0108, never added); rerun unchanged x3 `changes_nothing` | | $0.057 |
| r2 test 0116-0128 | whole test clean; judges **0127 yes / 0128 no** ("no step stores the accepted table; the stored rows are read before the confirms") -> unsettled, repair | | $0.059 |
| r3 0129-0141 | no decision possible (47 of 48 calls spent, 2 kept back for judging); the same Flow retested (byte-identical calls to 0116-0126) and judged by **one** call, 0141 **yes** | build `proposed` | $0.060 |

Lane A's fix behaved: identical reruns were refused unsent ("identical request was not sent again"), history rows read
"Not done", and the refused-in-a-row stop ended round 1. B's keep answer: not exercised. D2-1 (`strands_a_step`) and
D2-2: **not exercised** (no navigation was dropped; no test failed the listing). `web-state.v4`: `already_answered`
fired on repeated detects/snapshots of the same page (0069, 0102), as intended.

### Every read of the list (supervisor's question)

`web.output.dom-extract_list` ran **11 times**: 3 live reads, 4 reruns of the listing that were applied, 4 whole-Flow
tests. Beside them: 6 detect decisions (5 ran, 1 refused), 3 snapshot decisions (2 ran, 1 refused), and 9 listing
reruns refused `changes_nothing` (never ran).

| Step | Kind | Why the model said it read again | Outcome |
| --- | --- | --- | --- |
| 0013 | detect `t749` | first look at the list | `extraction` handle |
| 0017 | detect `t749` | after closing the chat window: "a stable extraction handle" | new handle `extraction.3` |
| 0019 | read | "see each request's name and mutual-friends text" | 8 rows |
| 0021 | read | the same read with the column renamed `mutual` -> `mutualFriends` | 8 rows |
| 0023 | rerun (applied) | add the `where` keeping 5+ | 3 rows (regex drops Jonas) |
| 0032, 0042, 0044 | rerun (refused) | 0032: to add the Confirm loop; 0042/0044: "I need a post-act read of accepted rows" | `changes_nothing` |
| 0062 | snapshot | repair 1 opens: "look where the test left it" | |
| 0064, 0066, 0068 | detect `t749` x3 | "capture each request's accepted state" / "capture all rows including accepted ones" | ran, ran, `already_answered` |
| 0070 | rerun (ran) | "read every request the list shows as accepted, after the confirm loop" | same where, ran |
| 0075, 0077, 0079 | rerun (refused) | "add a second read after the confirm loop" | `changes_nothing` |
| 0094 | detect `t754` | repair 2: "how mutual friends are written" | 10 fields, hashed labels |
| 0096, 0101 | snapshot x2 | "see which requests now show as accepted" | ran, `already_answered` |
| 0098, 0103 | rerun (applied) | keep Jonas ("and N other") | 4 rows |
| 0108 | read | "see which requests the page now shows as accepted" | 8 rows, no where; **left as draft step 14 `taken`, never added** |
| 0110, 0112, 0114 | rerun (refused) | "fix the where ... then read the accepted rows" | `changes_nothing` |

Why the re-reads happened, in order of weight:
1. **The model wanted a read after the confirms and never found how to add one.** It said so in 19 of its 41
   decisions (0040-0046, 0062-0079, 0096-0112). Every amendment it sent for that was a rerun of the existing listing
   in place, which can only replace that step and never adds one after the press. Each identical rerun was answered
   `changes_nothing`, whose `next` only steers to the loop ("If those rows are right: Step 7 is the first step after
   step 6 that changes something ... send repeat"). Nothing told it that a read after the act is a new step: run the
   read live after the press and `add` it, or write it with `core.run_node write: true`. At 0108 it did run a live read,
   and the result said `inFlow: true`. That field means only "this node kind can be a Flow step"
   (`domain/.../node-run/outcome.ts`), but the read was left `taken`, never added, and the model never added it.
2. **It could not see which column holds "Request accepted".** The detect results (0065, 0095) list 10 fields named by
   hashed class names (`div.x0531l50... > div.x1papwzz...`). The accepted state is the 13%-coverage field on Amara's row
   (`at t902`), findable only by matching handles against the page view. So the re-detects (0064-0068) and snapshots
   (0096/0101) looked for a column the model could not name. This is the supervisor's in-flight fix (b).
3. **The `where` was a hand-written regex.** Round 2 used `atLeast 5`; here the model wrote a `matches` regex that
   cannot read "Aisha Khan and 4 other mutual friends" as five, then widened it twice. It never called
   `describe_nodes`, which is the supervisor's in-flight fix (a).

## Stage 3 — the proposed Flow

1 navigate `~/`; 2 decline cookies (remembered); 3 click Friends; 4 click Friend requests; 5 close chat (remembered); 6
listing `{name, mutualFriends}` `where matches "...mutual friend|and [4-9] other mutual friend|and (...) other mutual
fr..."` (4 rows: Amara, Jonas, Lin, Freya); 7 Confirm repeated over 6 (4 passes). **No read after the confirms**: the
Flow's table is step 6's rows, read before any press. It would report Freya as accepted even if her press met "You're
going too fast" at playback, so it is not what was asked. Judge 0128 said exactly this, and 0141 said yes to the same Flow.

## Stage 4 — replay (the build's tests)

Four whole tests (0049-0058, 0081-0090, 0116-0126, 0130-0140): every step replayed/remembered/verified; Confirm
passes `present` (Amara, confirmed live at 0037) then `verified` x3 (checked, not pressed). Provider calls during
tests: zero. Excluded rows untouched: yes. Only Amara was pressed live, and no Delete was pressed.

## Stage 5 — the answer

NO EVIDENCE: no playback. Oracle not measured. The test's stored rows were 4 (Amara, Jonas, Lin, Freya, verbatim
`mutualFriends`), but they were read before the confirms.

## Stage 6 — judgement and repair

- Pairs: r0 no/no, r1 no/no, r2 **yes/no** (unsettled, `model_disagreed`), r3 **one call, yes** -> accepted.
- The r3 judgement was of the Flow r2's pair could not confirm. Round 3 made no decision, and its 11 test calls match
  0116-0126 byte for byte. The purse reserves a judging pair from non-judge calls only. After r2's pair it held 47 of
  48 calls, so round 3's reserve judgement could make one call, and `result-verification/agreement.ts` returns a lone
  first verdict as final (`if (!second || ...) return { ...first, calls: 1 }`) when the confirming second call never
  came. (Inferred from the counts: 41 + 7 = 48 sent; the refused second judge call leaves no step folder.)
- C1 (`afterWithheld`) worked: no judge blamed the withheld presses (0127, 0141 say so explicitly).

### UI review (14 moments; checked against `t277-r3-ui.md`)

- Overlay visible 16/16 at 11 moments; #1 10/16 (first appearance), #3 15/16 and #12 15/16 (a page load with the
  overlay briefly gone); #9 `flickering` (three text changes while a test ran steps back to back).
- #1 start panel shows an **earlier build's thread** ("s8 kept only Amara...", "fix s13", "the judge found"): R2-U-10,
  not landed (Lab profile shows the old chat before it selects the project). Raw ids from that old ending are visible.
- Seen fixed: R2-U-6/R2-U-7 (refusals read "Not done: that step was already tried exactly this way...", folded "Not
  done (2 times)", #5 #11); per-row test card "Testing: Click · Confirm · Amara Osei" (#6); R2-U-1 check card "Didn't
  pass: 3 rows would be stored, but Read kept Amara Osei, Lin Zhao, Freya Holm" (#9). It has the count, but the clause
  says what was kept, not why that fails, with a capital "Read" mid-sentence. The split verdict is said plainly: "This
  result was checked twice with the same evidence, and the answers differed" (#14).
- Not fixed: R2-U-8. The test card title is cut "Testing: Read list · name and..." with an ellipsis (#6), not wrapped.
- Not exercised: U11 (no unreached repeat), D2-1 wording.

## Causes

| # | Cause, precisely | Repo and file | Fix | Status |
| --- | --- | --- | --- | --- |
| D3-1 | **A build that sent exactly its call allowance is published one call over it.** The instruction reading counted itself a provider call even when the build's purse refused it unsent (`providerInvocation: "not_attempted"`). Here nothing triggered the reading during the build (`modify_existing` is not a destructive class, so the gate never asked), so it first ran in the post-build cross-check with 48 of 48 calls spent. The purse refused it; `usage.calls` still became 1; `totalProviderCallCount` = 41 + 1 + 7 = 49; the Lab's budget check failed a proposed, judged Flow. The same phantom call broke `run-spend.ts` `creationBuildSplit` (judge calls counted twice: 57). | Core `R/service/instruction-authority.ts` (`ask`) | Count a call, and its tokens, only when `answer.providerInvocation !== "not_attempted"`. Test in `R/service/tests/instruction-authority.test.ts` drives a real creation purse with `maxCalls: 1` through the harness hold. | **fixed in tree, uncommitted** |
| D3-2 | **No way to a read after the act.** The model asked in 19 decisions for a read after the confirms and only ever tried rerunning the listing in place. `changes_nothing`'s `next` steers to the loop only. A live read's `inFlow: true` reads as "added" when it was left `taken`. | Core `R/llm/draft-amendment-feedback.ts` (rerun `next`), downstream `domain/.../node-run/outcome.ts` (`inFlow` wording) | When an identical listing rerun follows an act that already repeats over it, `next` should say: a read after the act is a new step, so run the read after the press and add it (or write it). Rename or explain `inFlow` as "can be added". | open |
| D3-3 | **The column holding the accepted state has no readable name.** Detect labels are hashed class names. | downstream detect (`web.detect_repeating_structure` result) | Supervisor's in-flight fix (b): sample values and readable labels. | in flight (supervisor) |
| D3-4 | **The model wrote a regex instead of the listing's count condition.** It never read the node definition. | Core node descriptions | Supervisor's in-flight fix (a): the definition shown on first use. | in flight (supervisor) |
| D3-5 | **An unconfirmed yes finishes a build.** At the judging reserve only one of the pair's calls fit; a lone first `answers` was taken as final, on the same Flow a pair had just split on. | Core `R/result-verification/agreement.ts`; `R/flow-bootstrap/unfinished-build/reserve-judging.ts`; purse judging reserve `R/llm/build-purse/purse.ts` | A yes that the build-test judge must confirm (`confirmAnswer`) and whose second call was refused is unsettled, not yes. Also: the reserve should keep a whole pair for the reserve judgement after a judged round, or the round should not be opened. | open |
| U-R3-1 | Test card list name cut with an ellipsis ("name and...") | extension `panel/chat/stream/step/` card title CSS/`card-words.ts` | wrap, as t277 R2-U-8 intended | open |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 6 | Whether 0141's confirming second call was refused by the purse: a refused call leaves no step folder and the build's `judged` record has `unconfirmed: null`, `confidence: null`. | Core step log (`R/llm/step-log/`), `R/flow-bootstrap/unfinished-build/finishing-verdict.ts` |
| 3 | Whether the instruction reading ran or was refused: no `read` step and no refusal record; only `instructedConsequences: []` and `beyond_instruction`. | Core step log; `R/service/flow-bootstrap-commands/permission-outcome.ts` |

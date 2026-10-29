# Report: fhl-step-workload

Run: `test-runs/instances/rr6b-slot-1/run-mvsknffp-153bc89a` (t563 worktree), everything-store, kettle Buy Now checkout, verdict passed. Model deepseek-flash for every call. Step numbers are step directory numbers.

## Outcome
Done. Read-only measurement; no repo edits. Headline findings:
1. The build is cheap in dollars ($0.086 for 118 model calls). Model calls are 248 s of a ~697 s build window (36%); trials plus node runs are ~418 s (60%).
2. About 20 of 104 decides are firm bookkeeping (12 test-after-submit, 2 complete, 1 unchanged redispatch, 5 refused repeats); a further 34 are re-runs of a node already run in the same session (upper bound, partly real repair).
3. Prefix caching already works: 89.5% of input tokens are cache hits. The dollars sit in the 10% that miss (70% of cost). About 161k of the 361k decide miss tokens are excess caused by earlier evidence entries changing between calls.
4. Trimming the static packet (51% of characters) saves almost no money (hit tokens cost $0.003/M). Folding calls, append-only history, and not wasting two dead builder briefs are the real levers.

## Totals
Pricing fitted exactly from meta.json (least squares over 118 calls): miss $0.15/M, hit $0.003/M, output $0.60/M.

| | calls | input tok | hit tok | output tok | cost | LLM time |
|---|---|---|---|---|---|---|
| decide | 104 | 3,429,153 | 3,068,416 (89.5%) | 19,964 | $0.0753 | 200.7 s |
| judge | 14 | 196,076 | 156,672 (79.9%) | 7,045 | $0.0106 | 47.3 s |
| total | 118 | 3,625,229 | 3,225,088 (89.0%) | 27,009 | $0.0861 | 248.0 s |

Cost split: miss tokens 400,141 -> $0.0600 (70%); output $0.0162 (19%); hit tokens $0.0097 (11%).
Roles: 91 builder decides, 7 repair decides, 6 supervisor decides (steps 3, 5, 106, 116, 210, 233); 10 judges with role supervisor, 4 with no role (steps 247-250, final whole-Flow judging).
Request size: decide 15.45M chars total (mean 148.5k; 61k at step 3, 259k at steps 206-208); judge 0.84M (mean 60k).
Wall clock: run 20:33:20 to 20:50:39 (1039 s); build window (chat step 1 to finish) about 697 s. Summed step time: decide 200.7 s, judge 47.3 s, core.run_node 182.5 s, core.test_subflow 200.9 s, reset 21.7 s, offline 12.1 s, find/describe/detect about 7 s, submit_subflow 0.6 s. The 4 project.dispatch steps (591 s) enclose builder work, so are not additive. LLM share 248/697 = 36%; test_subflow + run_node + reset/offline = 417 s = 60%.
Tool dirs: 78 core (51 run_node, 15 submit_subflow, 12 test_subflow), 9 web, 6 project, 8 resets.

## Call classification
Rules (`classify.mjs`): supervisor plan/dispatch/complete by role; any test_subflow is bookkeeping; a submit_subflow whose next result is `repeat_refused` or `unchanged_after_no` is waste; a run_node is a re-run when the same session already ran the same node on the same target/url/text; everything else is a real choice. Re-run detection ignores changed parameters such as `resetDestination`, so it overstates bookkeeping.

| class | calls | input tok | cost | time | steps |
|---|---|---|---|---|---|
| Firm: test_subflow right after submit | 12 | 428k | $0.0058 | 21 s | 24,34,38,60,88,98,141,151,165,184,193,223 |
| Firm: refused repeat submit (waste) | 5 | 274k | $0.0050 | 15 s | 86?,202,204,206,208 |
| Firm: complete (232 repair, 233 supervisor) | 2 | 43k | $0.0009 | 2.8 s | 232,233 |
| Firm: dispatch resent unchanged | 1 | 12.6k | $0.0014 | 1.6 s | 106 |
| Firm subtotal | 20 | ~758k | $0.0131 | ~41 s | |
| Soft: run_node re-run of an already-run node | 34 | 1,222k | $0.0256 | 56 s | 26,28,48,52,54,58,62,64,66,68,72,74,82,90,92,94,100,102,104,111,113,119,127,129,131,143,145,153,155,157,159,161,172,174 |
| Real: submit_subflow authoring/repair | 14 | 482k | $0.0116 | 42 s | 20,22,30,36,80,96,139,147,149,163,182,191,200,221 |
| Real: first-time run_node | 21 | 621k | $0.0164 | 37 s | 8,10,14,16,18,32,40,46,50,70,76,84,109,133,135,137,176,178,180,213,215 |
| Real: look/inspect (find_on_page, describe, detect_repeating) | 11 | 296k | $0.0059 | 16 s | 12,42,44,56,78,115,121,123,125,217,219 |
| Real: plan and briefs | 4 | 51k | $0.0026 | 10 s | 3,5,116,210 |

Notes:
- Real choices are about 50 of 104; firm bookkeeping 20 (19%); soft 34 (33%). The soft class contains real repair work (re-pressing Buy Now with a changed `resetDestination`, steps 26-32, 143-159), so fold only re-runs with identical parameters.
- Step 86 was counted refused by next-dir match; I did not open step 87's result, so the firm refused count is 4 to 5.
- Steps 202-208 are four near-identical "fix the item read" submits. Step 201 shows the first refusal was a real schema error (`web.extract.unknown_key`), then 203 is `candidate.unchanged_after_no` and 207 is `llm_evidence_loop.repeat_refused`.
- Two dead briefs: builder 1 (steps 8-104, 49 decides, about 2.08M input tokens) was stopped for repeating calls without progress, mostly 26-104 chasing a "witnessed destination" for the Buy Now press. The resend (106) ended on an unknown tool (reason at step 116). Together steps 8-115 are about 50 decides, roughly $0.04 and 100 s of model time, before the third builder (119-165) and the repair builder (213-223) produced the passing Flow.

## Loops a macro could cover
Consecutive run_node decides within one session (18 chains, 55 decides):
`2[8-10] 3[14-18] 2[26-28] 1[32] 1[40] 5[46-54] 1[58] 8[62-76] 2[82-84] 3[90-94] 3[100-104] 3[109-113] 1[119] 6[127-137] 2[143-145] 5[153-161] 5[172-180] 2[213-215]`.
- Longest chain: 8 calls, steps 62-76 (Buy Now click, cart extract_list, navigate cart, extract, click, navigate kettle, extract, navigate checkout). The same few nodes (Buy Now click t599, cart extract_list, navigate cart, navigate kettle page) recur in 46-54, 62-76, 90-104, 143-161. A batch "run these N known nodes in order, stop on first failure, return the last page view" covers the re-run portion.
- Chains 127-137 (6) and 172-180 (5) are first-time checkout acts (delivery, gift card, Plus trial, address chooser); each needs a handle from the previous page view, so they are real choices unless the model emits the whole act list from one checkout view.
- Fixed pattern submit then test: 12 of 19 submit decides are followed by a test_subflow decide whose input is only the revision and digest from the submit result (24, 34, 38, 60, 88, 98, 141, 151, 165, 184, 193, 223). A `test: true` option on submit, or Core auto-testing a clean submit, removes all 12.
- Failed-test, re-run, resubmit cycle: steps 26-38, 46-60, 143-165. Core already holds the trial feedback code; a repair macro "re-run the last act with the named reset destination, then resubmit" is the batch.
- Refused repeats 202-208: four submits after a refusal; returning the issue list with a fix point on the first refusal, or refusing without a model call, avoids them.

## Packet composition
A decide request is `system` plus one user JSON `{taskKind, promptVersion, expectedOutput, outputSchema, context:{instructions, flowBootstrap, evidenceLoop:{tools, evidence, iteration}}}`. Chars summed over 104 decides (12.81M):

| part | chars | share | varies per call? |
|---|---|---|---|
| system prompt | 0.806M (6.1k supervisor, 7.8k builder) | 6.3% | no, per role |
| outputSchema | 3.486M (11.0k supervisor, 34.9k builder) | 27.2% | no, per role |
| flowBootstrap | 0.968M (9.3k) | 7.6% | no |
| tools catalog | 1.018M (about 9.6k builder) | 7.9% | no |
| instructions | 0.219M (1.1k to 2.2k) | 1.7% | rarely |
| evidence | 6.272M (9.5k at step 3, 120.6k at step 104) | 49.0% | yes, grows |

- Static (all but evidence) is 6.49M chars = 50.7%. In builder packets the `core.submit_subflow` variant of the schema alone is 26.7k of 34.9k chars, carried on every call including look and run steps. The tools catalog repeats descriptions the schema also carries.
- Evidence at step 104 (56 entries, 120.6k chars): core.run_node 61.8k (25 entries, 51%), route_state 17.2k (one start-state entry repeated whole in every packet, 14%), submit_subflow 17.0k, test_subflow 11.1k, evidence_history 5.3k, detect_repeating_structure 4.5k, find_on_page 2.4k. The count stays near 56 (step 102: 56, step 104: 56), so old entries are dropped.
- Provider cache: within a session consecutive requests share 78-98% of message bytes (typically 85-97%, steps 10-104). The first call of each session shares about 1% (steps 8, 106, 109, 116, 119, 210, 213), e.g. hit 1.8k of 17.6k tokens at step 8. Overall hit rate 89.5%. (request.txt text compares at only 7% because of its header; request.json messages are the right comparison.)
- History growth: input 11.8k tokens (step 3), 17.6k (step 8), 51.8k (step 104), 58.0k (step 208).
- Cache busting by history change: diffing evidence entry by entry against the previous packet of the same session, the first differing entry is often well before the tail: step 48 at index 24 of 30 (miss 8,469 tok), 66 at 27 of 40 (9,989), 84 at 39 of 49 (6,246), 174 at 30 of 36 (8,519), 215 at 1 of 2 (8,062). Plain appends diverge at the last 1-3 entries (miss 1.3-2.2k). Decide miss tokens: total 360,737; median 3,013; p75 4,858; max 15,786. Excess over a 2,200-token append baseline is 161k tokens = $0.024 (28% of the run). No top-level `supersededBy` stubs were found (count 0), so the mutation mechanism is unidentified.
- Judge packet: system 24.4k plus user 22.7k chars; resultSummary 19.7k (endView 7.1k, flowShape 5.1k, startView 2.8k, taskChecklist 2.7k, recordSets 0.7k, siteChange 0.6k).

## Judge calls
The 14 judges are 7 pairs with byte-identical requests (171, 190, 199, 229, 231, 248, 250 repeat the preceding request at 100% prefix). The second of each pair hits cache almost fully (about $0.0003 vs $0.0014) and gave the same answersRequest verdict in 7 of 7 pairs. The repeats are 7 calls, $0.0026, 23.9 s. Whether this is a deliberate double sample is not shown in the run.

| steps | judged (trial/run) | verdict | settleable from Core-held data? |
|---|---|---|---|
| 170, 171 | trial of the first full Flow (after test 165): kettle, office address, free standard delivery, gift card, no Plus; row right? | no: stored address is the home address, not office | Partly: the address act is missing from the Flow; Core's task checklist could say "address act not done", the office vs home meaning needs the task |
| 189, 190 | trial after test 184 | no: total stored `$0.00`, checkout Order total `$7.59` | Largely yes: cell `$0.00` appears nowhere in the end view while `$7.59` sits under an order-total label |
| 198, 199 | trial after test 193 | no: item cell has extra text beyond the product name | Largely yes: cell text is a superset of one element's text; Core holds the element tree |
| 228, 229 | trial after test 223 (repaired item) | no: address cell lacks the name | Cell vs end-view difference is computable; "name included" is task wording |
| 230, 231 | same Flow, later check | yes | Yes: every cell verbatim in end view, one row, columns complete, no refused rows, acts done |
| 247, 248 | final whole-Flow judging (no role) | no: address stored home-style | as 170 |
| 249, 250 | final judging | yes | Yes, as 230 |

The verdict is structured (`answersRequest`, `defects[kind,row,column,value]`, `patchNeeded`), and `resultSummary` already carries `totalRecordCount`, `totalRefusedCount`, `totalRowsMissingRequired`, `taskChecklist`, `endView`. A deterministic pre-check (row count and columns match; each cell is a verbatim substring of one end-view element; none refused or missing; checklist done) could settle the 4 yes judges (230, 231, 249, 250) and flag value-shape defects in 189/190, 198/199, 228/229. Semantic cases (home vs office, "name included") still need the model, but once instead of twice. In dollars judges are only $0.0106 (12% of the run); the gain is latency (47 s) and consistency.
Observation: wrong-value defects of the same class (item line, total, address) were found at 170, 189, 198, 228, each costing a submit, test, judge cycle of about 4-5 decides and about 25 s.

## Estimate
Baseline: 118 calls, $0.0861, 248 s model time (200.7 + 47.3).

A. Fold firm bookkeeping (20 decides): calls 118 - 20 = 98; cost 0.0861 - 0.0131 = $0.0730; model time 248 - 41 = 207 s. Wall effect 41 of 697 s (6%).
B. Also fold identical-parameter re-runs.
  - Upper bound, all 34: calls 98 - 34 = 64; cost 0.0730 - 0.0256 = $0.0474; model time 207 - 56 = 151 s.
  - Realistic, two thirds (22): calls 98 - 22 = 76; cost 0.0730 - 0.0171 = $0.0559; model time 207 - 37 = 170 s.
  - Node execution still runs (run_node total 182 s), so the wall gain is model time only: 78 s of 697 (11%) realistic, 97 s (14%) upper bound.
C. Append-only history: excess miss 161k tokens x $0.15/M = $0.0242 at most; assume half recoverable = $0.012. It overlaps A and B (fewer calls, fewer rewrites), so count about $0.006 on top.
D. Trim the static packet (submit_subflow schema only where callable, drop duplicate tool catalog): 26.7k chars x 0.265 tok/char (run mean 3.625M tok / 13.65M chars) = 7.1k tok x 98 builder/repair calls = 0.69M hit tokens x $0.003/M = $0.002. Negligible in dollars; prefill-time effect unmeasured (latency 1.1 s at 177k chars, step 64; 1.3 s at 98k, step 14, so not strongly size-bound).
E. Drop the twin judge: 7 calls, $0.0026, 24 s.

Combined realistic (A + B realistic + C 0.006 + E): calls 118 - 20 - 22 - 7 = 69; cost 0.0861 - 0.0131 - 0.0171 - 0.006 - 0.0026 = $0.0473 (55% of baseline); model time 248 - 41 - 37 - 24 = 146 s (59%). The 697 s build window falls by about 100 s (14%) because trial and node time (418 s) is untouched.
Largest single item is not a fold: the two dead builder briefs (steps 8-115, about 50 decides, roughly $0.04, 100 s, about 45% of model spend) were never proposals that passed. A Core-side answer to the "witnessed destination" trial feedback (steps 26-104) would save more than A and B combined.

## Commands run and observed results
- `node tab.mjs` (scratchpad `fhl-step-workload/tab.mjs`): wrote `rows.json`, `out.txt`; printed decide 104 calls in 3,429,153 out 19,964 hit 3,068,416 cost 0.0753 ms 200,744; judge 14 in 196,076 out 7,045 hit 156,672 cost 0.0106 ms 47,251.
- `node classify.mjs`: class table and chain listing above; total decide cost 0.075294.
- `node comp.mjs`: char shares (system 805,660; schema 3,486,424; bootstrap 968,448; tools 1,018,190; instructions 218,746; evidence 6,271,504; total 12,808,561).
- Inline node one-liners: price fit (miss 0.15, hit 0.003, out 0.60 per M), per-role schema variants, evidence sizes by tool at steps 3/90/104, evidence diff vs previous packet, miss percentiles, all 14 judge diagnoses, step durations.
- Reads: request.txt step 3; request.json steps 3, 104, 170, 213, 232, 233; result.json steps 201, 203, 207.
- Scripts are in `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/fhl-step-workload/`.

## Not verified
- Why earlier evidence entries change between packets: only positions were diffed, not contents. The "newest view whole" collapse in the system prompt is a candidate, not shown.
- Whether judge twins run concurrently or are two samples by design (start times not compared), so the 24 s may overlap.
- Step 86 and the exact count of refused repeats (4 vs 5); step 87's result was not opened.
- The soft re-run count uses a signature heuristic; the 34 were not read one by one.
- Prefill latency versus packet size: eyeballed from ms, no regression.
- The judge "settleable" column is my reading of diagnoses and `resultSummary` keys, not tested against a prototype pre-check.
- Estimates assume removed calls do not change what remaining calls decide; the dead-brief saving assumes a first-time-good builder.
